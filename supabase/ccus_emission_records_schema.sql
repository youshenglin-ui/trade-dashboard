-- 環境部溫室氣體排放量登錄平台的年度排放清冊（104-113年，逐年擴大揭露家數）。
-- 這份資料本身只到縣市層級，沒有街道地址；地址/座標是後續視需要另外人工或
-- 網頁搜尋補充的欄位，先留空，不影響歷年查詢功能。
--
-- 資料來源本身沒有批次下載 API（https://ghgregistry.moenv.gov.tw/epa_ghg/Accession/PublicInformation.aspx
-- 是查詢表單），每年更新流程見 scripts/import-ccus-emission-records.mjs 開頭的說明。
--
-- 跟 CCUS 管線規劃地圖用的 scope1.csv 快照是分開的兩件事：管線規劃只需要
-- 「最新一年」，這張表則是給「歷年登錄總覽」查詢功能用，兩者資料來源相同、
-- 用途不同，故意不合併成同一份資料流程，避免規劃地圖被歷史資料的載入拖慢。

create table ccus_emission_records (
  id bigint generated always as identity primary key,
  roc_year int not null,                 -- 民國年，跟原始資料/使用者慣用單位一致，不轉換成西元年
  control_no text not null,              -- 管制編號，同一年度內唯一
  business_id text,                      -- 事業統一編號（舊資料沒有這欄，可為空）
  company_name text not null,
  scope1_tons numeric,                   -- 直接排放量(公噸CO2e)
  scope2_tons numeric,                   -- 能源間接排放量(公噸CO2e)
  total_tons numeric,                    -- 合計排放量(公噸CO2e)
  county text,                           -- 縣市別
  industry text,                         -- 行業分類
  seven_major_industry text,             -- 七大製造業（不是每個年度都有揭露這欄）
  district text,                         -- 行政區（比縣市更細，目前只有部分廠區有）
  address text,                          -- 詳細地址（人工/網頁搜尋補充，可為空）
  latitude numeric,
  longitude numeric,
  coord_source text,                     -- 'verified' | 'approximate' | null，標示座標可信度
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (roc_year, control_no)
);

create index idx_ccus_emission_year on ccus_emission_records (roc_year);
create index idx_ccus_emission_company on ccus_emission_records (company_name);
create index idx_ccus_emission_county on ccus_emission_records (county);

alter table ccus_emission_records enable row level security;
create policy "public read access" on ccus_emission_records for select using (true);
create policy "authenticated write access" on ccus_emission_records for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
