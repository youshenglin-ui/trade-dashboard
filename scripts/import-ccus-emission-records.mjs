// ==========================================
// 匯入環境部溫室氣體排放量登錄平台的年度排放清冊到 Supabase
// ==========================================
// 用法: node scripts/import-ccus-emission-records.mjs <CSV路徑>
//
// 資料來源沒有批次下載 API（https://ghgregistry.moenv.gov.tw/epa_ghg/Accession/PublicInformation.aspx
// 是查詢表單，不是資料集），所以每年更新的流程是：
//   1. 去上面那個網址查詢/下載最新年度的清冊（或用使用者自己整理好的
//      104-113年彙整檔，欄位需一致，見下方 REQUIRED_HEADERS）
//   2. 跑這支腳本，指定 CSV 路徑
//   3. 腳本會依 (roc_year, control_no) 這組自然鍵 upsert 進
//      ccus_emission_records，同一年度重複匯入不會產生重複資料，
//      數值也會被覆蓋成最新版本（不會像 trade_records 那樣加總）。
//
// 檔案編碼：政府網站/Excel 匯出的 CSV 常常是 Big5，不是 UTF-8，這支腳本
// 會自動偵測（UTF-8 解碼失敗或含有大量替代字元就改用 Big5 試一次）。
//
// 前置需求：.env 設定 SUPABASE_DB_HOST / SUPABASE_DB_PASSWORD 等
// （跟 import-to-supabase.mjs 用同一組，見 .env.example）。

import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import iconv from 'iconv-lite';
import 'dotenv/config';
import { parseCSVLine } from '../src/utils/helpers.js';

const REQUIRED_HEADERS = ['年度', '管制編號', '事業名稱', '直接排放量(公噸CO2e)', '能源間接排放量(公噸CO2e)', '合計排放量(公噸CO2e)', '縣市別', '行業分類'];

const { SUPABASE_DB_HOST, SUPABASE_DB_PORT, SUPABASE_DB_USER, SUPABASE_DB_PASSWORD, SUPABASE_DB_NAME } = process.env;
if (!SUPABASE_DB_HOST || !SUPABASE_DB_PASSWORD) {
  console.error('缺少 SUPABASE_DB_HOST / SUPABASE_DB_PASSWORD，請先在 .env 設定（參考 .env.example）。');
  process.exit(1);
}

const DB_CONFIG = {
  host: SUPABASE_DB_HOST,
  port: Number(SUPABASE_DB_PORT) || 5432,
  user: SUPABASE_DB_USER || 'postgres',
  password: SUPABASE_DB_PASSWORD,
  database: SUPABASE_DB_NAME || 'postgres',
  ssl: { rejectUnauthorized: false },
};

function readCsvSmart(path) {
  const buf = readFileSync(path);
  const utf8Text = buf.toString('utf-8');
  const replacementCount = (utf8Text.match(/�/g) || []).length;
  if (replacementCount > 0) {
    console.log(`  偵測到 ${replacementCount} 個無法辨識字元，改用 Big5 解碼...`);
    return iconv.decode(buf, 'big5');
  }
  return utf8Text;
}

function cleanNum(s) {
  if (s === undefined || s === null) return null;
  const t = String(s).trim().replace(/,/g, '');
  if (t === '' || t === '-') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseRegistryCsv(text) {
  const lines = text.split(/\r\n|\n/).filter(l => l.trim());
  // 使用者自己整理的彙整檔第一行常常是「共N筆資料」的備註，不是欄位名稱；
  // 偵測不到必要欄位就跳過第一行再試一次。
  let header = parseCSVLine(lines[0]).map(h => h.trim());
  let dataLines = lines.slice(1);
  if (!REQUIRED_HEADERS.every(h => header.includes(h))) {
    header = parseCSVLine(lines[1]).map(h => h.trim());
    dataLines = lines.slice(2);
  }
  const missing = REQUIRED_HEADERS.filter(h => !header.includes(h));
  if (missing.length > 0) {
    throw new Error(`CSV 缺少必要欄位: ${missing.join(', ')}（實際欄位: ${header.join(', ')}）`);
  }

  return dataLines.map(line => {
    const cells = parseCSVLine(line).map(c => c.trim());
    const r = {};
    header.forEach((h, i) => { r[h] = cells[i]; });
    return {
      roc_year: Number(r['年度']),
      control_no: r['管制編號'],
      business_id: r['事業統編'] || null,
      company_name: r['事業名稱'],
      scope1_tons: cleanNum(r['直接排放量(公噸CO2e)']),
      scope2_tons: cleanNum(r['能源間接排放量(公噸CO2e)']),
      total_tons: cleanNum(r['合計排放量(公噸CO2e)']),
      county: r['縣市別'] || null,
      industry: r['行業分類'] || null,
      seven_major_industry: r['七大製造業'] || null,
    };
  }).filter(r => r.control_no && r.roc_year && r.company_name);
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('用法: node scripts/import-ccus-emission-records.mjs <CSV路徑>');
    process.exit(1);
  }

  const text = readCsvSmart(csvPath);
  const rows = parseRegistryCsv(text);
  console.log(`解析出 ${rows.length} 筆資料，涵蓋年度: ${[...new Set(rows.map(r => r.roc_year))].sort((a, b) => a - b).join(', ')}`);

  const client = new Client(DB_CONFIG);
  await client.connect();
  console.log('已連線 Supabase Postgres。');

  let imported = 0;
  const batchSize = 400;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values = [];
    const placeholders = batch.map((r, idx) => {
      const base = idx * 9;
      values.push(r.roc_year, r.control_no, r.business_id, r.company_name, r.scope1_tons, r.scope2_tons, r.total_tons, r.county, r.industry);
      return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9})`;
    }).join(',');

    await client.query(
      `insert into ccus_emission_records
         (roc_year, control_no, business_id, company_name, scope1_tons, scope2_tons, total_tons, county, industry)
       values ${placeholders}
       on conflict (roc_year, control_no) do update set
         business_id = excluded.business_id, company_name = excluded.company_name,
         scope1_tons = excluded.scope1_tons, scope2_tons = excluded.scope2_tons,
         total_tons = excluded.total_tons, county = excluded.county, industry = excluded.industry,
         updated_at = now()`,
      values
    );
    imported += batch.length;
    console.log(`  已匯入 ${imported}/${rows.length}`);
  }

  await client.end();
  console.log(`完成，共匯入/更新 ${imported} 筆。`);
}

main().catch(err => {
  console.error('匯入腳本發生未預期錯誤:', err);
  process.exit(1);
});
