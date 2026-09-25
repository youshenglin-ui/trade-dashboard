// ==========================================
// 把氫能寬表格 CSV 匯入正規化的 hydrogen_records 表
// ==========================================
// 用法: node scripts/migrate-hydrogen-to-supabase.mjs
// 前置需求:
//   1. 已在 Supabase SQL Editor 執行過 supabase/hydrogen_records_schema.sql
//   2. .env 裡設定 SUPABASE_DB_HOST / SUPABASE_DB_PASSWORD（同 import-to-supabase.mjs）
//
// 跟 import-to-supabase.mjs 匯入 energy_facility_records（存 raw jsonb）不同，
// 這支腳本是「一次性」把歷史寬表格資料展開成 hydrogen_records 的正規化列，
// 之後新資料一律透過後台管理頁面（/admin，src/pages/HydrogenAdmin.jsx）新增，
// 不需要再跑這支腳本——除非未來又要整批匯入一次新的 Google Sheet 匯出。
//
// 展開邏輯刻意跟前端原本 HydrogenDashboard.jsx 的 strictParseHydrogen()
// 保持一致（哪些欄位算「有效資料」、公司名稱簡化、廠區改名等），避免像
// CLAUDE.md 提到的貿易資料那樣，匯入腳本自己重寫一份簡化清洗邏輯導致跟前端
// 顯示對不上。

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import 'dotenv/config';
import { parseHydrogenCSV, cleanNumber } from '../src/utils/helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

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

// 跟 strictParseHydrogen() 一致：原始資料裡「台化」在「台北」的列，實際廠區是麥寮，
// 這個修正只在匯入時做一次，之後前端讀取正規化資料表不用再處理這個特例。
function correctPlant(company, plant) {
  if (String(company).includes('台化') && String(plant).includes('台北')) return '麥寮廠';
  return plant;
}

// 展開一份寬表格 CSV（每列是一個公司/廠區，年度資料橫向展開成多欄）成
// hydrogen_records 的正規化列（一列 = 一個公司/廠區/年度/製程或用途）。
function expandRows(rawArr, recordType) {
  const results = [];
  rawArr.forEach((row) => {
    const company = String(row['公司'] || row['Company'] || row['廠商'] || '').trim();
    if (!company || company.toUpperCase().includes('SUMMARY') || company.includes('總計')) return;

    const plant = correctPlant(company, row['廠區'] || row['Plant'] || '');
    const region = String(row['區域'] || row['Region'] || '').trim();
    const processOrUsage = String(row[recordType === 'production' ? '製程' : '用途'] || '').trim();
    const purity = cleanNumber(row['純度']);
    const intensity = cleanNumber(row['單位碳排'] || row['Carbon_Intensity'] || 0);
    const note = String(row['備註'] || '').trim();
    const latitude = cleanNumber(row['緯度'] || row['Latitude']) || null;
    const longitude = cleanNumber(row['經度'] || row['Longitude']) || null;

    const years = new Set();
    Object.keys(row).forEach((k) => {
      const m = k.match(/^(\d{4})_(產量|產能|用量|外售量|外購量)/);
      if (m) years.add(m[1]);
    });

    years.forEach((year) => {
      if (recordType === 'production') {
        const capacity = cleanNumber(row[`${year}_產能`]);
        const output = cleanNumber(row[`${year}_產量`]);
        const tradeVol = cleanNumber(row[`${year}_外售量`]);
        const tradeTarget = String(row[`${year}_外售對象`] || '').trim();
        if (capacity > 0 || output > 0 || tradeVol > 0) {
          results.push({
            record_type: 'production', company, plant, region, process: processOrUsage,
            usage_type: null, year: Number(year), purity, carbon_intensity: intensity,
            capacity_tons: capacity, output_tons: output, trade_vol: tradeVol,
            trade_target: tradeTarget || null, demand_tons: null, source_company: null,
            transport_method: null, latitude, longitude, note: note || null,
          });
        }
      } else {
        const demand = cleanNumber(row[`${year}_用量`]);
        const tradeVol = cleanNumber(row[`${year}_外購量`]);
        const sourceCompany = String(row[`${year}_外購來源公司`] || row['外購來源公司'] || '').trim();
        const transport = String(row[`${year}_運輸方式`] || row['運輸方式'] || '').trim();
        if (demand > 0 || tradeVol > 0) {
          results.push({
            record_type: 'usage', company, plant, region, process: null,
            usage_type: processOrUsage, year: Number(year), purity, carbon_intensity: intensity,
            capacity_tons: null, output_tons: null, trade_vol: tradeVol, trade_target: null,
            demand_tons: demand, source_company: sourceCompany || null,
            transport_method: transport || null, latitude, longitude, note: note || null,
          });
        }
      }
    });
  });
  return results;
}

async function readLocalCsv(relPath) {
  return readFile(join(ROOT, relPath), 'utf-8');
}

async function upsertRows(client, rows) {
  const cols = [
    'record_type', 'company', 'plant', 'region', 'process', 'usage_type', 'year', 'purity',
    'carbon_intensity', 'capacity_tons', 'output_tons', 'trade_vol', 'trade_target',
    'demand_tons', 'source_company', 'transport_method', 'latitude', 'longitude', 'note',
  ];
  const batchSize = 200;
  let imported = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values = [];
    const placeholders = batch.map((r, idx) => {
      const base = idx * cols.length;
      cols.forEach((c) => values.push(r[c]));
      return `(${cols.map((_, j) => `$${base + j + 1}`).join(',')})`;
    }).join(',');

    await client.query(
      `insert into hydrogen_records (${cols.join(',')})
       values ${placeholders}
       on conflict (record_type, company, plant, year, coalesce(process, ''), coalesce(usage_type, ''))
       do update set
         region = excluded.region, purity = excluded.purity, carbon_intensity = excluded.carbon_intensity,
         capacity_tons = excluded.capacity_tons, output_tons = excluded.output_tons,
         trade_vol = excluded.trade_vol, trade_target = excluded.trade_target,
         demand_tons = excluded.demand_tons, source_company = excluded.source_company,
         transport_method = excluded.transport_method, latitude = excluded.latitude,
         longitude = excluded.longitude, note = excluded.note, synced_at = now()`,
      values
    );
    imported += batch.length;
  }
  return imported;
}

async function main() {
  const client = new Client(DB_CONFIG);
  await client.connect();
  console.log('已連線 Supabase Postgres。\n');

  const productionCsv = await readLocalCsv('public/data/hydrogen/production.csv');
  const usageCsv = await readLocalCsv('public/data/hydrogen/usage.csv');

  const productionRows = expandRows(parseHydrogenCSV(productionCsv), 'production');
  const usageRows = expandRows(parseHydrogenCSV(usageCsv), 'usage');

  console.log(`供給面（production）展開 ${productionRows.length} 筆...`);
  const nP = await upsertRows(client, productionRows);
  console.log(`  匯入完成: ${nP} 筆`);

  console.log(`需求面（usage）展開 ${usageRows.length} 筆...`);
  const nU = await upsertRows(client, usageRows);
  console.log(`  匯入完成: ${nU} 筆`);

  await client.end();
  console.log(`\n完成，共匯入 ${nP + nU} 筆。`);
}

main().catch((err) => {
  console.error('匯入腳本發生未預期錯誤:', err);
  process.exit(1);
});
