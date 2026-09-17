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
import { parseCSV_Safe } from '../src/utils/helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// 跟 sync-data.mjs 的存放規則一致：trade/* 在 data/（非 public），
// hydrogen/*、ccus/* 在 public/data/（前端還在直接讀）。
function baseDirFor(key) {
  return key.startsWith('trade/') ? join(ROOT, 'data') : join(ROOT, 'public', 'data');
}

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

async function readLocalCsv(key) {
  const path = join(baseDirFor(key), `${key}.csv`);
  return readFile(path, 'utf-8');
}

// 貿易資料一律走 parseCSV_Safe（跟前端過去解析 Google Sheet CSV 用的是
// 同一個函式），確保日期補零、進出口別正規化、World/Total 彙總列過濾、
// 稅號只留數字這些清洗規則跟原本前端行為完全一致，不會因為匯入腳本自己
// 重寫一份簡化邏輯而讓資料跟以前對不上。
async function importTrade(client, key, source) {
  const text = await readLocalCsv(key);
  const { data: rawRows } = parseCSV_Safe(text);

  // 同一個「年月+稅號+國家+進出口別」在原始資料裡可能拆成好幾筆
  // （例如國家欄位空白時會歸類成同一個 Unknown 桶），金額/重量不同、
  // 不是重複資料。資料表對這個組合有唯一鍵限制，所以先在這裡把同鍵
  // 的金額和重量加總成一筆，總額才會跟原本前端「全部列加總」的結果一致，
  // 不會因為只留最後一筆而漏算。
  const merged = new Map();
  for (const r of rawRows) {
    const k = `${r.date}|${r.hsCode}|${r.country}|${r.type}`;
    const existing = merged.get(k);
    if (existing) {
      existing.value += r.value || 0;
      existing.weight += r.weight || 0;
    } else {
      merged.set(k, { ...r, value: r.value || 0, weight: r.weight || 0 });
    }
  }
  const rows = [...merged.values()];

  let imported = 0;
  const batchSize = 500;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    if (batch.length === 0) continue;

    const values = [];
    const placeholders = batch.map((r, idx) => {
      const base = idx * 8;
      values.push(r.date, r.hsCode, r.productName || null, r.country || null, r.type || null, r.value, r.weight, source);
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
  const text = await readLocalCsv(key);
  const rows = parseCSV(text);
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
