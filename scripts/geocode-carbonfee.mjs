// ==========================================
// 碳費自主減量計畫：事業地址 → 座標（產生 data/carbonfee/facility_coords.csv）
// ==========================================
// 用法：node scripts/geocode-carbonfee.mjs [--snapshot data/carbonfee/snapshot.json] [--retry]
//
// 讀爬蟲快照裡每個事業（管制編號 control_no）的地址，用 Nominatim 轉座標：
//   完整門牌 → 去掉樓層的門牌 → 路名 → 行政區，coord_source 記錄用到哪一層。
// 已在 CSV 裡、地址沒變的事業不會重查（--retry 會重查「找不到」的列）；coord_source = 'manual'
// 的列永遠不覆蓋——人工校正請直接改 CSV 並把 coord_source 改成 manual。
// 寫回資料庫：npm run db:import-carbonfee-coords（寫 carbonfee_facility_coords 表）。
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geocodeAddress, parseCsv, csvCell } from './lib/geocode.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const COORDS_CSV = join(ROOT, 'data', 'carbonfee', 'facility_coords.csv');
export const COORD_COLS = ['control_no', 'name', 'city', 'address', 'lat', 'lon', 'coord_source', 'query', 'matched'];

export async function readFacilityCoords(file = COORDS_CSV) {
  return existsSync(file) ? parseCsv(await readFile(file, 'utf-8')) : [];
}

async function main() {
  const args = process.argv.slice(2);
  const snapArg = args.indexOf('--snapshot');
  const snapFile = snapArg >= 0 ? args[snapArg + 1] : join(ROOT, 'data', 'carbonfee', 'snapshot.json');
  const retry = args.includes('--retry');

  const snap = JSON.parse(await readFile(snapFile, 'utf-8'));
  const facilities = new Map();
  for (const p of snap.plans || []) {
    for (const f of p.facilities || []) {
      if (f.controlNo && !facilities.has(f.controlNo)) facilities.set(f.controlNo, f);
    }
  }

  const byId = new Map((await readFacilityCoords()).map((r) => [r.control_no, r]));
  const save = async () => {
    const body = [...byId.values()].sort((a, b) => a.control_no.localeCompare(b.control_no)).map((r) => COORD_COLS.map((c) => csvCell(r[c])).join(','));
    await mkdir(dirname(COORDS_CSV), { recursive: true });
    await writeFile(COORDS_CSV, [COORD_COLS.join(','), ...body].join('\n') + '\n');
  };

  let n = 0;
  for (const [id, f] of facilities) {
    const prev = byId.get(id);
    if (prev?.coord_source === 'manual') continue;
    if (prev && prev.address === (f.address || '') && (prev.lat || !retry)) continue;
    const hit = await geocodeAddress(f.address);
    const row = { control_no: id, name: f.name, city: f.city, address: f.address || '', lat: '', lon: '', coord_source: 'not_found', query: '', matched: '' };
    if (hit) Object.assign(row, { lat: hit.lat.toFixed(5), lon: hit.lon.toFixed(5), coord_source: hit.coord_source, query: hit.query, matched: hit.matched });
    byId.set(id, row);
    console.log(`${id} ${f.name}: ${row.coord_source} ${row.lat},${row.lon}`);
    if (++n % 20 === 0) await save(); // 中途存檔，中斷後重跑會接著做
  }
  await save();
  const rows = [...byId.values()];
  const count = (s) => rows.filter((r) => r.coord_source === s).length;
  console.log(`\n已寫入 ${COORDS_CSV}：共 ${rows.length} 筆；門牌 ${count('geocode_address')}、路名 ${count('geocode_road')}、行政區 ${count('geocode_area')}、人工 ${count('manual')}、找不到 ${count('not_found')}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
