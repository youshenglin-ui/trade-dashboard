// ==========================================
// 匯入「全貨品年度進出口」Excel → trade_annual_hs6
// ==========================================
// 用法: npm run db:import-trade-annual -- <檔案.xlsx> [--dataset 114-v1] [--dry-run] [--out rows.json]
// - 每個工作表第一列為表頭：進出口別/日期/國家/貨品號列/中文貨名/英文貨名/美元(千元)/新臺幣(千元)/重量(公斤)
//   （出口分頁右側多出的三欄是全表合計，忽略）。
// - 年度取自「日期」欄（114年 → 2025）；進出口別含「進口」→'進口'，含「出口」→'出口'。
// - 貨品號列左補 0 到 6 碼；0 =「實施資訊保護貨品（勿加計於總量值）」→ is_suppressed。
// - 同 dataset 整批替換（單一交易），會先執行 supabase/trade_annual.sql（冪等）。
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { Client } from 'pg';
import 'dotenv/config';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const dsIdx = args.indexOf('--dataset');
const optVal = new Set(['--dataset', '--out'].map((o) => args.indexOf(o) + 1).filter((i) => i > 0));
const file = args.find((a, i) => !a.startsWith('--') && !optVal.has(i));
if (!file) { console.error('用法: npm run db:import-trade-annual -- <檔案.xlsx> [--dataset 標籤] [--dry-run]'); process.exit(1); }

const HEADERS = { flow: '進出口別', date: '日期', country: '國家', hs: '貨品號列', zh: '中文貨名', en: '英文貨名', usd: '美元(千元)', ntd: '新臺幣(千元)', kg: '重量(公斤)' };
const cellVal = (c) => { const v = c?.value; return v && typeof v === 'object' && 'result' in v ? v.result : v; };
const num = (v) => { if (v == null || v === '') return null; const n = Number(String(v).replace(/,/g, '')); return Number.isFinite(n) ? n : null; };

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
const rows = [];
let rocYear = null;
for (const ws of wb.worksheets) {
  const head = ws.getRow(1);
  const col = {};
  head.eachCell((c, i) => { const t = String(cellVal(c) ?? '').trim(); for (const [k, h] of Object.entries(HEADERS)) if (t === h) col[k] = i; });
  const missing = Object.keys(HEADERS).filter((k) => !col[k]);
  if (missing.length) { console.warn(`[${ws.name}] 缺欄位 ${missing.map((k) => HEADERS[k]).join(',')}，略過此工作表`); continue; }
  let n = 0;
  ws.eachRow({ includeEmpty: false }, (row, rowNo) => {
    if (rowNo === 1) return;
    const g = (k) => cellVal(row.getCell(col[k]));
    const flowRaw = String(g('flow') ?? '');
    const flow = flowRaw.includes('進口') ? '進口' : flowRaw.includes('出口') ? '出口' : null;
    const hsRaw = g('hs');
    if (!flow || hsRaw == null || hsRaw === '') return;
    const m = String(g('date') ?? '').match(/(\d{2,4})/);
    const y = m ? Number(m[1]) : null;
    if (!y) return;
    rocYear ??= y < 1911 ? y : y - 1911;
    const hs6 = String(hsRaw).trim().replace(/\D/g, '').padStart(6, '0');
    rows.push({
      year: y < 1911 ? y + 1911 : y, flow_type: flow, country: String(g('country') ?? '').trim() || 'Unknown',
      hs6, product_name: String(g('zh') ?? '').trim(), product_name_en: String(g('en') ?? '').trim(),
      value_usd_thousand: num(g('usd')), value_ntd_thousand: num(g('ntd')), weight_kg: num(g('kg')),
      is_suppressed: /^0+$/.test(hs6), source_row: rowNo,
    });
    n++;
  });
  console.log(`[${ws.name}] ${n} 列`);
}
const dataset = dsIdx >= 0 ? args[dsIdx + 1] : `${rocYear}-${basename(file).replace(/\.xlsx$/i, '').slice(-12)}`;
const sum = {};
for (const r of rows) if (!r.is_suppressed) { const k = `${r.year} ${r.flow_type}`; sum[k] = (sum[k] || 0) + (r.value_usd_thousand || 0); }
console.log(`共 ${rows.length} 列（資訊保護 ${rows.filter((r) => r.is_suppressed).length} 列），dataset=${dataset}`);
for (const [k, v] of Object.entries(sum)) console.log(`  ${k}: US$ ${(v / 1e6).toFixed(2)}B（金額欄單位千美元）`);
const outIdx = args.indexOf('--out');
if (outIdx >= 0) { await writeFile(args[outIdx + 1], JSON.stringify(rows.map((r) => ({ ...r, dataset })))); console.log(`已輸出 ${args[outIdx + 1]}`); }
if (dryRun) process.exit(0);

const { SUPABASE_DB_HOST, SUPABASE_DB_PORT, SUPABASE_DB_USER, SUPABASE_DB_PASSWORD, SUPABASE_DB_NAME } = process.env;
if (!SUPABASE_DB_HOST || !SUPABASE_DB_PASSWORD) { console.error('缺少 SUPABASE_DB_HOST / SUPABASE_DB_PASSWORD（見 .env.example）'); process.exit(1); }
const client = new Client({
  host: SUPABASE_DB_HOST.trim().replace(/^@/, ''), port: Number(SUPABASE_DB_PORT) || 5432, user: SUPABASE_DB_USER || 'postgres',
  password: SUPABASE_DB_PASSWORD, database: SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
});
await client.connect();
try {
  await client.query(await readFile(join(ROOT, 'supabase', 'trade_annual.sql'), 'utf8'));
  await client.query('begin');
  const del = await client.query('delete from trade_annual_hs6 where dataset = $1 or year = any($2::int[])', [dataset, [...new Set(rows.map((r) => r.year))]]);
  console.log(`刪除舊資料 ${del.rowCount} 列`);
  const COLS = ['year', 'flow_type', 'country', 'hs6', 'product_name', 'product_name_en', 'value_usd_thousand', 'value_ntd_thousand', 'weight_kg', 'is_suppressed', 'source_row'];
  const BATCH = 2000;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const payload = JSON.stringify(chunk.map((r) => ({ ...r, dataset })));
    await client.query(
      `insert into trade_annual_hs6 (${COLS.join(',')}, dataset)
       select ${COLS.join(',')}, dataset from jsonb_to_recordset($1::jsonb) as x(
         year int, flow_type text, country text, hs6 text, product_name text, product_name_en text,
         value_usd_thousand numeric, value_ntd_thousand numeric, weight_kg numeric, is_suppressed boolean, source_row int, dataset text)`,
      [payload],
    );
    process.stdout.write(`\r寫入 ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }
  await client.query('select trade_annual_refresh_agg()');
  await client.query('commit');
  console.log('\n完成');
} catch (e) {
  await client.query('rollback').catch(() => {});
  console.error('\n匯入失敗，已回滾：', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
