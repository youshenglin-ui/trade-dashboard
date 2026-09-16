// ==========================================
// 匯入本地 CSV 資料到 Supabase (PostgreSQL)
// ==========================================
// 用法: npm run db:import
// 前置需求:
//   1. 已在 Supabase 專案的 SQL Editor 執行過 supabase/schema.sql
//   2. .env 裡設定 SUPABASE_DB_URL（Supabase Dashboard > Project Settings >
//      Database > Connection string，選 "URI"，記得把密碼帶進去）
//
// 這支腳本讀 public/data/ 底下 `npm run sync-data` 產生的 CSV
// （所以流程還是：改 Google Sheet → npm run sync-data → npm run db:import），
// 之後等前端全面改讀 Supabase，這支腳本會變成正式的 ETL 入口。
//
// 連線用分開的欄位（host/port/user/password/database）而非單一 URI 字串，
// 是刻意的：Postgres 密碼常見特殊符號（* ! & 等）塞進 URI 容易被解析器誤判，
// 用物件形式傳給 pg.Client 就完全不會經過 URL 解析，不用煩惱要不要跳脫。

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import 'dotenv/config';
import { DATA_SOURCES } from './data-sources.config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'public', 'data');

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

// 與 CcusDashboard.jsx 的 parseCSV 邏輯一致，處理引號跳脫與欄位內逗號
function parseCSV(text) {
  if (!text) return [];
  const result = [];
  let row = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === ',' && !inQuotes) {
      row.push(current.trim()); current = '';
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
      if (char === '\r') i++;
      row.push(current.trim()); result.push(row); row = []; current = '';
    } else {
      current += char;
    }
  }
  if (current || row.length > 0) { row.push(current.trim()); result.push(row); }
  if (result.length < 2) return [];
  const headers = result[0].map((h) => h.replace(/^[﻿\s]+|[\s]+$/g, ''));
  return result.slice(1).map((rowArray) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = rowArray[i] !== undefined ? rowArray[i] : ''; });
    return obj;
  });
}

function toNumber(val) {
  if (val === undefined || val === null || val === '') return null;
  const num = parseFloat(String(val).replace(/[,%\s]/g, ''));
  return Number.isFinite(num) ? num : null;
}

async function readLocalCsv(key) {
  const path = join(DATA_DIR, `${key}.csv`);
  const text = await readFile(path, 'utf-8');
  return parseCSV(text);
}

async function importTrade(client, key, source) {
  const rows = await readLocalCsv(key);
  let imported = 0;
  const batchSize = 500;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize).filter((r) => r.Date && r.HScode);
    if (batch.length === 0) continue;

    const values = [];
    const placeholders = batch.map((r, idx) => {
      const base = idx * 8;
      values.push(
        r.Date,
        r.HScode,
        r.Name || null,
        r.Country || null,
        r.Type || null,
        toNumber(r.Value),
        toNumber(r.Weight),
        source
      );
      return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8})`;
    }).join(',');

    await client.query(
      `insert into trade_records (period, hs_code, product_name, country, flow_type, value_ntd_thousand, weight_kg, source)
       values ${placeholders}
       on conflict (source, period, hs_code, country, flow_type)
       do update set product_name = excluded.product_name,
                      value_ntd_thousand = excluded.value_ntd_thousand,
                      weight_kg = excluded.weight_kg,
                      synced_at = now()`,
      values
    );
    imported += batch.length;
  }
  return imported;
}

async function importEnergy(client, key, category) {
  const rows = await readLocalCsv(key);
  let imported = 0;

  for (const r of rows) {
    const company = r.Company || r.company || r.Source_Company || r.Target_Company || r['公司'] || null;
    const plant = r.Plant || r.plant || r.Storage_Site || r.Target_Plant || r['廠區'] || null;
    const yearRaw = r.Year || r.year || r['年度'];
    const year = yearRaw ? parseInt(yearRaw, 10) : null;

    await client.query(
      `insert into energy_facility_records (category, company, plant, year, raw) values ($1,$2,$3,$4,$5)`,
      [category, company, plant, Number.isFinite(year) ? year : null, JSON.stringify(r)]
    );
    imported++;
  }
  return imported;
}

async function main() {
  const client = new Client(DB_CONFIG);
  await client.connect();
  console.log('已連線 Supabase Postgres。\n');

  const tradeActiveKeys = DATA_SOURCES.filter((s) => s.key.startsWith('trade/active/')).map((s) => s.key);
  const tradeArchiveKeys = DATA_SOURCES.filter((s) => s.key.startsWith('trade/archive/')).map((s) => s.key);
  const energyKeys = DATA_SOURCES.filter((s) => s.key.startsWith('hydrogen/') || s.key.startsWith('ccus/')).map((s) => s.key);

  let totalImported = 0;

  for (const key of tradeActiveKeys) {
    process.stdout.write(`  [trade active] ${key} ... `);
    try {
      const n = await importTrade(client, key, 'active');
      console.log(`OK (${n} 筆)`);
      totalImported += n;
    } catch (err) { console.log(`失敗 - ${err.message}`); }
  }

  for (const key of tradeArchiveKeys) {
    process.stdout.write(`  [trade archive] ${key} ... `);
    try {
      const n = await importTrade(client, key, 'archive');
      console.log(`OK (${n} 筆)`);
      totalImported += n;
    } catch (err) { console.log(`失敗 - ${err.message}`); }
  }

  for (const key of energyKeys) {
    const category = key.replace('/', '_'); // e.g. hydrogen/production -> hydrogen_production
    process.stdout.write(`  [energy] ${key} ... `);
    try {
      const n = await importEnergy(client, key, category);
      console.log(`OK (${n} 筆)`);
      totalImported += n;
    } catch (err) { console.log(`失敗 - ${err.message}`); }
  }

  await client.end();
  console.log(`\n完成，共匯入 ${totalImported} 筆。`);
}

main().catch((err) => {
  console.error('匯入腳本發生未預期錯誤:', err);
  process.exit(1);
});
