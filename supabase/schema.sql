-- ==========================================
-- trade-dashboard 資料庫 schema (PostgreSQL / Supabase)
-- ==========================================
-- 設計原則：
--   1. trade_records 是主要資料表（38萬+ 列，格式穩定：年月/稅號/國家/進出口/金額/重量），
--      給完整的型別欄位 + 索引，支援前端高頻率篩選查詢。
--   2. 氫能/CCUS 來源目前欄位還在演變中（原始 CSV 是「年度前綴」的寬表格，
--      例如 2025_產能、2024_產量，且各分頁欄位不完全一致），
--      這裡用「常用欄位開型別 + raw jsonb 存完整原始列」的混合設計，
--      不會因為 schema 設計跟不上來源變動而漏資料，之後要新增查詢欄位
--      只要加 generated column 或直接查 jsonb，不需要重新跑一次匯入。
-- 執行方式：在 Supabase Dashboard > SQL Editor 貼上整份檔案執行一次即可。

-- ---------- 貿易資料 ----------
create table if not exists trade_records (
  id bigint generated always as identity primary key,
  period text not null,                    -- 'YYYY-MM'
  hs_code text not null,
  product_name text,
  country text,
  flow_type text,                          -- '進口' / '出口'
  value_ntd_thousand numeric,
  weight_kg numeric,
  source text not null,                    -- 'active' | 'archive'
  synced_at timestamptz not null default now()
);

create index if not exists idx_trade_hs_code on trade_records (hs_code);
create index if not exists idx_trade_period on trade_records (period);
create index if not exists idx_trade_country on trade_records (country);
create index if not exists idx_trade_hs_period on trade_records (hs_code, period);

-- 同一批次重新匯入時避免重複（以來源+期間+稅號+國家+別 視為同一筆）
create unique index if not exists uq_trade_natural_key
  on trade_records (source, period, hs_code, country, flow_type);

-- ---------- 氫能 / CCUS（寬表格來源，混合式 schema） ----------
create table if not exists energy_facility_records (
  id bigint generated always as identity primary key,
  category text not null,                  -- 'hydrogen_production' | 'hydrogen_usage' | 'ccus_capture' | 'ccus_utilization' | 'ccus_storage' | 'ccus_scope1'
  company text,
  plant text,
  year int,
  raw jsonb not null,                      -- 該列的完整原始欄位（含所有年度前綴欄位）
  synced_at timestamptz not null default now()
);

create index if not exists idx_energy_category on energy_facility_records (category);
create index if not exists idx_energy_company_plant on energy_facility_records (company, plant);
create index if not exists idx_energy_raw_gin on energy_facility_records using gin (raw);

-- ---------- 同步紀錄（取代 dataManifest.json，方便追溯每次匯入的狀態） ----------
create table if not exists sync_runs (
  id bigint generated always as identity primary key,
  source_key text not null,
  rows_imported int,
  ok boolean not null,
  error text,
  synced_at timestamptz not null default now()
);

-- ---------- Row Level Security：先全部開放唯讀，之後要分級再收緊 ----------
alter table trade_records enable row level security;
alter table energy_facility_records enable row level security;
alter table sync_runs enable row level security;

create policy "public read trade_records" on trade_records
  for select using (true);
create policy "public read energy_facility_records" on energy_facility_records
  for select using (true);

-- sync_runs 不對外開放讀取（僅供後端/管理端查詢，用 service_role key 繞過 RLS）
