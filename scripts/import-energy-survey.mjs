// ==========================================
// 氫能 / CCUS 問卷整併 Excel → Supabase
// ==========================================
// 用法：
//   npm run db:import-energy -- --h2 <氫能問卷整併.xlsx> --ccus <CCUS問卷整併.xlsx>
//   （可只給其中一本；--dry-run 只解析不寫入；--out payload.json 另存寫入內容供檢查）
//
// 前置：
//   1. Supabase 已執行 supabase/energy_survey.sql、energy_survey_load.sql、energy_survey_seed.sql
//   2. .env 設定 SUPABASE_DB_HOST / SUPABASE_DB_PASSWORD 等（同 npm run db:import）
//
// 流程：Excel → scripts/lib/energy-survey-parse.mjs 解析 → 合併 data/energy/plant_coords.csv 座標
//       → 呼叫資料庫函式 energy_survey_load(payload)（單一交易，整批替換，見 supabase/energy_survey_load.sql）
//
// Excel 原始檔含聯絡窗口個資，不進 git（data/energy/*.xlsx 已列入 .gitignore），放在本機即可。
// 問卷改版時：先 --dry-run，看 warnings 有沒有「找不到欄位」，再改 scripts/lib/energy-survey-parse.mjs 的 TABLES。
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseWorkbook, plantsFromCcus } from './lib/energy-survey-parse.mjs';
import { parseCsv } from './geocode-energy-plants.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COORDS = join(ROOT, 'data', 'energy', 'plant_coords.csv');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

export async function buildPayload({ h2File, ccusFile }) {
  const payload = { imports: [] };
  const warnings = [];
  let plants = [];

  const addImport = (domain, file, parsed) => {
    payload.imports.push({
      domain,
      file_name: basename(file),
      version_tag: basename(file).match(/1\d{6}/)?.[0] ?? null,
      sheet_count: parsed.sheetCount,
      rows: parsed.rows,
    });
    for (const [t, rows] of Object.entries(parsed.tables)) {
      if (t === 'energy_plants') continue;
      payload[t] = [...(payload[t] || []), ...rows];
    }
    warnings.push(...parsed.warnings);
  };

  if (h2File) {
    const parsed = await parseWorkbook(h2File, 'hydrogen');
    plants = parsed.tables.energy_plants || [];
    addImport('hydrogen', h2File, parsed);
  }
  if (ccusFile) {
    const parsed = await parseWorkbook(ccusFile, 'ccus');
    plants.push(...plantsFromCcus(parsed.tables, new Set(plants.map((p) => p.plant_id))));
    addImport('ccus', ccusFile, parsed);
  }

  if (plants.length) {
    const coords = existsSync(COORDS) ? new Map(parseCsv(await readFile(COORDS, 'utf-8')).map((r) => [r.plant_id, r])) : new Map();
    payload.energy_plants = plants.map((p) => {
      const c = coords.get(p.plant_id);
      if (!c?.lat) warnings.push(`[座標] ${p.plant_id} ${p.short_name ?? ''} 沒有座標（地圖上不會顯示；可跑 scripts/geocode-energy-plants.mjs 或手動補 CSV）`);
      return {
        ...p,
        lat: c?.lat ? Number(c.lat) : null,
        lon: c?.lon ? Number(c.lon) : null,
        coord_source: c?.coord_source || null,
        coord_note: c?.matched || null,
      };
    });
  }
  return { payload, warnings };
}

async function main() {
  const h2File = arg('--h2');
  const ccusFile = arg('--ccus');
  if (!h2File && !ccusFile) {
    console.error('用法：npm run db:import-energy -- --h2 <氫能問卷整併.xlsx> --ccus <CCUS問卷整併.xlsx> [--dry-run] [--out payload.json]');
    process.exit(1);
  }
  const { payload, warnings } = await buildPayload({ h2File, ccusFile });

  for (const imp of payload.imports) console.log(`[${imp.domain}] ${imp.file_name}：${imp.sheet_count} 張工作表、${imp.rows.length} 列原始資料`);
  for (const [k, v] of Object.entries(payload)) if (Array.isArray(v) && k !== 'imports') console.log(`  ${k}: ${v.length} 筆`);
  if (warnings.length) console.log('\n注意：\n  ' + warnings.join('\n  '));

  const out = arg('--out');
  if (out) {
    await writeFile(out, JSON.stringify(payload));
    console.log(`\n已另存 ${out}`);
  }
  if (process.argv.includes('--dry-run')) return;

  await import('dotenv/config');
  const { default: pg } = await import('pg');
  const { SUPABASE_DB_HOST, SUPABASE_DB_PORT, SUPABASE_DB_USER, SUPABASE_DB_PASSWORD, SUPABASE_DB_NAME } = process.env;
  if (!SUPABASE_DB_HOST || !SUPABASE_DB_PASSWORD) {
    console.error('缺少 SUPABASE_DB_HOST / SUPABASE_DB_PASSWORD，請先在 .env 設定（參考 .env.example）。');
    process.exit(1);
  }
  const client = new pg.Client({
    host: SUPABASE_DB_HOST, port: Number(SUPABASE_DB_PORT) || 5432, user: SUPABASE_DB_USER || 'postgres',
    password: SUPABASE_DB_PASSWORD, database: SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const { rows } = await client.query('select energy_survey_load($1::jsonb) as result', [JSON.stringify(payload)]);
    console.log('\n寫入完成：', rows[0].result);
  } finally {
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
