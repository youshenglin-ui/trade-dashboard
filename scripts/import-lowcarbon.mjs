// ==========================================
// 低碳技術彙編案例 data/lowcarbon/cases.csv → Supabase lowcarbon_cases
// ==========================================
// 用法：
//   npm run db:import-lowcarbon                  匯入案例（整批替換）
//   npm run db:import-lowcarbon -- --catalog     另外把 data/lowcarbon/snapshot.json（書目/企業減碳案例/技術資料庫）寫入
//   npm run db:import-lowcarbon -- --dry-run     只檢查 CSV，不連資料庫
// 資料庫連線沿用 .env 的 SUPABASE_DB_HOST / SUPABASE_DB_PASSWORD 等欄位（同 db:import）。
// schema：supabase/lowcarbon.sql

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { readCasesCsv } from './lib/lowcarbon-csv.mjs';
import { normalizeCaseRows } from './lib/lowcarbon-db.mjs';
import { CATEGORIES } from '../src/lib/lowcarbon/metrics.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const CATALOG = args.includes('--catalog');

async function main() {
  const rows = normalizeCaseRows(await readCasesCsv(join(ROOT, 'data', 'lowcarbon', 'cases.csv')));
  const badCat = rows.filter((r) => !CATEGORIES.includes(r.category));
  if (badCat.length) throw new Error(`分類不在 ${CATEGORIES.join('/')}：${badCat.map((r) => r.case_id).join(', ')}`);
  const docs = new Set(rows.map((r) => r.doc_id));
  console.log(`cases.csv：${rows.length} 筆案例、${docs.size} 本書；重複收錄（非最新版）${rows.filter((r) => !r.is_latest).length} 筆`);
  if (DRY_RUN) return;

  if (!process.env.SUPABASE_DB_HOST || !process.env.SUPABASE_DB_PASSWORD) {
    throw new Error('缺少 SUPABASE_DB_HOST / SUPABASE_DB_PASSWORD（見 .env.example）');
  }
  const { default: pg } = await import('pg');
  const { resolveDbConfig } = await import('./lib/db-config.mjs');
  const { writeCases, writeCatalog } = await import('./lib/lowcarbon-db.mjs');
  const client = new pg.Client(resolveDbConfig(process.env));
  await client.connect();
  try {
    console.log(`已寫入 lowcarbon_cases ${await writeCases(client, rows)} 筆`);
    if (CATALOG) {
      const snapshot = JSON.parse(await readFile(join(ROOT, 'data', 'lowcarbon', 'snapshot.json'), 'utf8'));
      const { summary } = await writeCatalog(client, snapshot);
      console.log('已寫入書目/企業減碳案例/技術資料庫：', summary);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`\n✖ ${err.message}`);
  process.exit(1);
});
