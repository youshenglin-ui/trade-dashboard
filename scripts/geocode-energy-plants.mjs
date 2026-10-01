// ==========================================
// 廠區地址 → 座標（產生 data/energy/plant_coords.csv）
// ==========================================
// 用法：node scripts/geocode-energy-plants.mjs <氫能問卷整併.xlsx> [<CCUS問卷整併.xlsx>]
//
// 用 OpenStreetMap Nominatim（每秒 1 次、免金鑰）把「廠區主檔」的詳細地址轉成座標，逐步放寬：
//   完整門牌 → 路名 → 行政區，結果寫 coord_source：geocode_address / geocode_road / geocode_area。
// 已存在於 CSV 且 coord_source = 'manual' 的列不會被覆蓋——人工校正過的座標請直接改 CSV
// 並把 coord_source 改成 manual，再跑 npm run db:import-energy 寫回資料庫。
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseWorkbook, plantsFromCcus } from './lib/energy-survey-parse.mjs';
import { candidates, nominatim, parseCsv, csvCell } from './lib/geocode.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'energy', 'plant_coords.csv');

async function main() {
  const [h2File, ccusFile] = process.argv.slice(2);
  if (!h2File) {
    console.error('用法：node scripts/geocode-energy-plants.mjs <氫能問卷整併.xlsx> [<CCUS問卷整併.xlsx>]');
    process.exit(1);
  }
  const h2 = await parseWorkbook(h2File, 'hydrogen');
  const plants = [...h2.tables.energy_plants];
  if (ccusFile) {
    const ccus = await parseWorkbook(ccusFile, 'ccus');
    plants.push(...plantsFromCcus(ccus.tables, new Set(plants.map((p) => p.plant_id))));
  }

  const existing = existsSync(OUT) ? parseCsv(await readFile(OUT, 'utf-8')) : [];
  const byId = new Map(existing.map((r) => [r.plant_id, r]));

  for (const p of plants) {
    const prev = byId.get(p.plant_id);
    if (prev && (prev.coord_source === 'manual' || prev.lat)) continue;
    let row = { plant_id: p.plant_id, short_name: p.short_name, lat: '', lon: '', coord_source: '', query: '', matched: '' };
    for (const [source, q] of candidates(p.address)) {
      const hit = await nominatim(q);
      if (hit) {
        row = { ...row, lat: hit.lat.toFixed(5), lon: hit.lon.toFixed(5), coord_source: source, query: q, matched: hit.label };
        break;
      }
    }
    console.log(`${p.plant_id} ${p.short_name}: ${row.coord_source || '找不到'} ${row.lat},${row.lon}`);
    byId.set(p.plant_id, row);
  }

  const cols = ['plant_id', 'short_name', 'lat', 'lon', 'coord_source', 'query', 'matched'];
  const body = [...byId.values()].sort((a, b) => a.plant_id.localeCompare(b.plant_id)).map((r) => cols.map((c) => csvCell(r[c])).join(','));
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, [cols.join(','), ...body].join('\n') + '\n');
  console.log(`\n已寫入 ${OUT}`);
}

export { parseCsv };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
