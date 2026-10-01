-- 碳費自主減量計畫：事業座標（2026-10 新增）
-- 獨立成一張表、以管制編號為鍵，爬蟲重寫 carbonfee_facilities 時座標不會被洗掉。
-- 產生：node scripts/geocode-carbonfee.mjs → data/carbonfee/facility_coords.csv
-- 寫入：npm run db:import-carbonfee-coords（coord_source = 'manual' 的列不會被自動結果覆蓋）
create table if not exists carbonfee_facility_coords (
  control_no text primary key,               -- 事業管制編號（= carbonfee_facilities.control_no）
  name text,
  city text,
  address text,                              -- 轉座標時用的地址（地址變了會重查）
  lat numeric,
  lon numeric,
  coord_source text not null,                -- geocode_address / geocode_road / geocode_area / manual / not_found
  query text,                                -- 實際送給 Nominatim 的字串
  matched text,                              -- Nominatim 回傳的地名，人工檢查用
  updated_at timestamptz not null default now()
);

alter table carbonfee_facility_coords enable row level security;
drop policy if exists "public read carbonfee_facility_coords" on carbonfee_facility_coords;
create policy "public read carbonfee_facility_coords" on carbonfee_facility_coords for select using (true);

comment on column trade_records.value_ntd_thousand is
  '金額，單位實為「千美元」（欄名沿用舊稱；2026-10 與資料來源確認）。單價 = 金額×1000÷weight_kg → USD/kg';
