-- ==========================================
-- 氫能 / CCUS 問卷整併資料庫（112–115 年）
-- ==========================================
-- 來源：台綜院整併的兩本 Excel
--   * 工業部門氫氣供需問卷整併(112-115)   → domain = 'hydrogen'
--   * 工業部門負碳(CCUS)問卷數據整併(112-115) → domain = 'ccus'
-- 匯入：scripts/import-energy-survey.mjs（見檔案開頭說明）。
--
-- 設計（兩層）：
--   1. 完整保存層 survey_imports / survey_sheet_rows：兩本 Excel「每一張工作表、每一列」原樣存成
--      jsonb（欄名→值），含說明、聯絡窗口、來源比對等所有分頁。不開放前端讀取（含個資與內部
--      檔案路徑），只在 Supabase Dashboard（後台）查看。確保「所有資料都有寫入」。
--   2. 分析層：前端圖表會用到的分頁拆成有型別欄位的資料表，每列另帶 raw jsonb（該列完整原文），
--      之後要用新欄位直接查 raw 或加欄位即可，不必重新設計。數值欄保留 *_raw 原文（例如
--      「200-300」「≧90」「常溫(25)」）與解析後的數值兩份，解析不了的不硬填。
--   其他：參考參數、產品稅號對照、封存場址/管網節點都放資料表，前端不寫死數字。
--
-- 單位：萬噸/年（除欄名另註明）。survey_year = 問卷調查年度(民國)，data_year = 數據所屬西元年。
-- 可重複執行（if not exists / drop policy if exists）。

-- ---------- 1. 完整保存層（後台用，不對外） ----------
create table if not exists survey_imports (
  id bigint generated always as identity primary key,
  domain text not null check (domain in ('hydrogen', 'ccus')),
  file_name text not null,
  version_tag text,                          -- 例：'1150928'（檔名上的版本日期）
  sheet_count int,
  row_count int,
  is_current boolean not null default true,  -- 同 domain 只有最新一次為 true
  imported_at timestamptz not null default now(),
  note text
);

create table if not exists survey_sheet_rows (
  id bigint generated always as identity primary key,
  import_id bigint not null references survey_imports (id) on delete cascade,
  domain text not null,
  sheet text not null,
  row_no int not null,                       -- Excel 實際列號
  header_row_no int,                         -- 該列套用的表頭列號（無表頭的說明型分頁為 null，欄名用 A/B/C）
  plant_id text,                             -- 有「廠區ID」欄時填入，方便後台依廠查
  cells jsonb not null
);
create index if not exists idx_survey_rows_sheet on survey_sheet_rows (import_id, sheet);
create index if not exists idx_survey_rows_plant on survey_sheet_rows (plant_id);

-- ---------- 2. 廠區主檔 ----------
create table if not exists energy_plants (
  plant_id text primary key,                 -- P01…（問卷廠區）、X01…（外部交易對象）、C01…（旗艦問卷）
  short_name text,
  company text,
  tax_id text,
  plant_name text,
  factory_reg_no text,
  address text,
  county text,
  region text,                               -- 北部/中部/南部/東部（原文）
  zone text,                                 -- 工業區聚落
  lat numeric,
  lon numeric,
  coord_source text,                         -- 'manual'（人工校正，匯入不覆蓋）| 'geocode_address' | 'geocode_road' | 'geocode_area' | 'county_centroid'
  coord_note text,
  is_survey_target boolean not null default true,
  responded_years int[] not null default '{}',
  note text,
  raw jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- 3. 氫能 ----------
create table if not exists h2_production (
  id bigint generated always as identity primary key,
  survey_year int not null,
  data_year int,
  plant_id text,
  short_name text,
  production_type text,                      -- 主產氫 / 副產氫 / 回收氫
  process_category text,                     -- 製程分類
  process_raw text,                          -- 原始製程名稱
  output_wt numeric,                         -- 產量(萬噸/年)
  max_capacity_wt numeric,
  utilization numeric,                       -- 產能利用率 (0–1)
  spare_capacity_wt numeric,
  co2_wt numeric,                            -- 產氫碳排(萬噸CO2/年)
  intensity_reported numeric,                -- kgCO2/kgH2
  intensity_calc numeric,
  intensity_used numeric,
  purity_raw text,
  expansion_plan text,
  capture_equipment text,
  data_nature text,                          -- 問卷回覆 / 沿用114(115未回覆) / 訪談資料
  source text,
  note text,
  calibrated_113_wt numeric,                 -- 113訪談校正值
  raw jsonb not null
);
create index if not exists idx_h2_prod_year on h2_production (survey_year);

create table if not exists h2_usage (
  id bigint generated always as identity primary key,
  survey_year int not null,
  data_year int,
  plant_id text,
  short_name text,
  usage_category text,                       -- 用途大類
  usage_subcategory text,                    -- 用途細類
  process_raw text,
  h2_wt numeric,                             -- 用氫量(萬噸/年)
  purity_raw text,
  product_output_wt numeric,
  product_capacity_wt numeric,
  data_nature text,
  source text,
  note text,
  raw jsonb not null
);
create index if not exists idx_h2_usage_year on h2_usage (survey_year);

create table if not exists h2_flows (          -- 外購外售起訖
  id bigint generated always as identity primary key,
  survey_year int not null,
  data_year int,
  reporter_plant_id text,
  reporter_name text,
  direction text,                            -- 購入 / 售出
  counterparty_raw text,
  counterparty_id text,
  counterparty_name text,
  inference_basis text,
  origin_name text,
  origin_zone text,
  dest_name text,
  dest_zone text,
  volume_wt numeric,
  transport text,
  process text,
  purity_raw text,
  avg_price_ntd_per_kg numeric,
  internal_external text,
  data_nature text,
  source text,
  note text,
  raw jsonb not null
);

create table if not exists h2_future_plans (
  id bigint generated always as identity primary key,
  survey_year int,
  plant_id text,
  short_name text,
  plan_type text,                            -- 既有製程用氫變化 / 新增製程/應用 / 115未來應用規劃
  item text,
  y2030_raw text, y2040_raw text, y2050_raw text,
  y2030_low numeric, y2030_high numeric,
  y2040_low numeric, y2040_high numeric,
  y2050_low numeric, y2050_high numeric,
  reason text,
  trl text,
  start_year_raw text,
  h2_demand_raw text,
  h2_demand_wt numeric,
  co2_reduction_t numeric,                   -- 減碳量(噸CO2/年)
  bottleneck text,
  capacity_other text,
  source text,
  raw jsonb not null
);

-- ---------- 4. CCUS ----------
create table if not exists ccus_emission_sources (   -- 排放源潛力（點源煙氣性質）
  id bigint generated always as identity primary key,
  survey_year int not null,
  program text,                              -- 產發署-製造部門 / 環境部-CCUS旗艦 …
  plant_id text,
  short_name text,
  company text,
  county text,
  source_desc text,                          -- 排放源/捕捉位置
  emission_wt numeric,
  temp_raw text,
  temp_c numeric,                            -- 解析值（區間取中點）
  pressure_raw text,
  pressure_unit text,
  pressure_bar numeric,                      -- 統一換算成 bar（MPa×10；常壓=1.013）
  co2_conc_raw text,
  co2_conc_pct numeric,
  transport_pref text,
  storage_need text,
  note text,
  source text,
  raw jsonb not null
);

create table if not exists ccus_capture_units (      -- 已裝置捕捉
  id bigint generated always as identity primary key,
  survey_year int not null,
  program text,
  plant_id text,
  short_name text,
  source_process text,
  capture_tech text,
  out_temp_raw text,
  out_pressure_raw text,
  purity_raw text,
  flow_slpm numeric,
  capture_wt numeric,
  unit_emission_wt numeric,
  net_capture_wt numeric,
  net_ratio numeric,
  cost_ntd_per_kg numeric,
  trl text,
  operation_status text,
  co2_destination text,
  note text,
  source text,
  raw jsonb not null
);

create table if not exists ccus_plans (              -- 捕捉/封存/CCS 未來規劃
  id bigint generated always as identity primary key,
  survey_year int not null,
  program text,
  plant_id text,
  short_name text,
  item text,
  plan_type text,                            -- 碳捕捉 / CCS / 碳封存 / CCU / …
  stage text,                                -- 'capture' | 'storage' | 'utilization' | 'ccs'（依 plan_type 正規化）
  new_or_expand text,
  start_year_raw text,
  start_year int,
  capacity_wt numeric,
  trl text,
  disposal text,
  note text,
  source text,
  raw jsonb not null
);

create table if not exists ccus_utilization (        -- CCU 與去化
  id bigint generated always as identity primary key,
  survey_year int not null,
  program text,
  plant_id text,
  short_name text,
  product text,
  tech_type text,
  trl text,
  co2_demand_wt numeric,
  co2_source text,
  destination text,
  note text,
  source text,
  raw jsonb not null
);

create table if not exists ccus_storage_sites (      -- 封存場址 / 管網樞紐（取代前端寫死的 INITIAL_CCS_HUBS）
  site_id text primary key,
  name text not null,
  kind text not null,                        -- 'storage'（實際/規劃封存場）| 'hub'（管網規劃接收樞紐）
  site_type text,                            -- 顯示用分類（本土外海封存、陸地封存、港口轉運…）
  region text,
  lat numeric,
  lon numeric,
  capacity_raw text,
  capacity_wt numeric,                       -- 年封存量能(萬噸/年)，未知為 null
  start_year int,
  status text,
  operator_plant_id text,
  note text,
  source text,
  sort_order int
);

create table if not exists ccus_network_nodes (      -- 管線規劃聚落節點（取代前端寫死的 INITIAL_CLUSTERS）
  node_id text primary key,
  name text not null,
  lat numeric not null,
  lon numeric not null,
  next_node_id text,                         -- 下一個節點或樞紐（site_id）
  transport text not null default 'land',    -- 'land' | 'sea'
  note text
);

-- ---------- 5. 其他問卷回答（成本財務、意願障礙、減碳策略、人才） ----------
create table if not exists survey_answers (
  id bigint generated always as identity primary key,
  domain text not null,
  sheet text not null,
  section text,                              -- 同一分頁多個表格時的區段名稱
  survey_year int,
  program text,
  plant_id text,
  short_name text,
  column_order text[] not null,              -- 欄位順序
  answers jsonb not null
);
create index if not exists idx_survey_answers_sheet on survey_answers (domain, sheet);

create table if not exists survey_assistance_requests (   -- 期待政府協助
  id bigint generated always as identity primary key,
  domain text not null,
  survey_year int,
  program text,
  plant_id text,
  short_name text,
  topic text,
  content text,
  issues text[] not null default '{}'
);

-- ---------- 6. 參考參數與對照表 ----------
create table if not exists energy_ref_parameters (
  key text primary key,
  domain text not null,
  label text not null,
  value numeric,
  unit text,
  category text,                             -- 'h2_intensity_benchmark' | 'conversion' …
  sort_order int,
  note text,
  source text
);

create table if not exists ccus_product_hs_map (
  product text primary key,                  -- 與 ccus_utilization.product 相同寫法
  hs_code text,                              -- 6 碼；null = 無對應稅號
  trade_name text,
  match_note text
);

-- 年度進出口均價（只算有對應 CCU 產品的稅號，避免掃全表）
-- 單價 = 金額×1000 ÷ 重量。trade_records.value_ntd_thousand 實際是「千美元」（以醋酸/PC/CO2 行情驗證），
-- 所以單價單位是 USD/kg。
drop view if exists v_ccus_product_trade_price;
create view v_ccus_product_trade_price with (security_invoker = true) as
select m.product,
       m.hs_code,
       m.trade_name,
       substr(t.period, 1, 4)::int as year,
       t.flow_type,
       sum(t.value_ntd_thousand) as value_thousand,
       sum(t.weight_kg) as weight_kg,
       case when sum(t.weight_kg) > 0 then sum(t.value_ntd_thousand) * 1000 / sum(t.weight_kg) end as unit_price_usd_per_kg
from ccus_product_hs_map m
join trade_records t on t.hs_code like m.hs_code || '%' and t.source = 'active'
where m.hs_code is not null
group by m.product, m.hs_code, m.trade_name, substr(t.period, 1, 4), t.flow_type;

-- 廠區年度平衡（生產＋外購−外售−使用），由事實表即時計算
create or replace view v_h2_plant_balance with (security_invoker = true) as
with p as (select survey_year, plant_id, sum(output_wt) v from h2_production group by 1, 2),
     u as (select survey_year, plant_id, sum(h2_wt) v from h2_usage group by 1, 2),
     b as (select survey_year, reporter_plant_id plant_id, sum(volume_wt) v from h2_flows where direction = '購入' and internal_external = '外部' group by 1, 2),
     s as (select survey_year, reporter_plant_id plant_id, sum(volume_wt) v from h2_flows where direction = '售出' and internal_external = '外部' group by 1, 2),
     k as (select survey_year, plant_id from p union select survey_year, plant_id from u
           union select survey_year, plant_id from b union select survey_year, plant_id from s)
select k.survey_year, k.plant_id,
       coalesce(p.v, 0) production_wt, coalesce(b.v, 0) purchased_wt,
       coalesce(s.v, 0) sold_wt, coalesce(u.v, 0) usage_wt,
       coalesce(p.v, 0) + coalesce(b.v, 0) - coalesce(s.v, 0) - coalesce(u.v, 0) as gap_wt
from k
left join p using (survey_year, plant_id)
left join u using (survey_year, plant_id)
left join b using (survey_year, plant_id)
left join s using (survey_year, plant_id);

-- ---------- 7. RLS ----------
-- 分析層：公開唯讀（與既有 trade_records / carbonfee_* 一致）；寫入只透過後端直連（postgres 角色）。
-- 完整保存層 survey_imports / survey_sheet_rows：啟用 RLS 但不給 anon 任何 policy → 前端讀不到。
do $$
declare t text;
begin
  foreach t in array array['energy_plants','h2_production','h2_usage','h2_flows','h2_future_plans',
    'ccus_emission_sources','ccus_capture_units','ccus_plans','ccus_utilization','ccus_storage_sites',
    'ccus_network_nodes','survey_answers','survey_assistance_requests','energy_ref_parameters','ccus_product_hs_map']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "public read %s" on %I', t, t);
    execute format('create policy "public read %s" on %I for select using (true)', t, t);
  end loop;
end $$;

alter table survey_imports enable row level security;
alter table survey_sheet_rows enable row level security;

-- ---------- 8. 分析表對應回原始 Excel 列（2026-09 追加） ----------
-- source_sheet / source_row 對應 survey_sheet_rows 的 sheet / row_no；raw 可由原列補上，因此放寬 not null。
do $$
declare t text;
begin
  foreach t in array array['energy_plants','h2_production','h2_usage','h2_flows','h2_future_plans',
    'ccus_emission_sources','ccus_capture_units','ccus_plans','ccus_utilization','survey_answers','survey_assistance_requests']
  loop
    execute format('alter table %I add column if not exists source_sheet text', t);
    execute format('alter table %I add column if not exists source_row int', t);
  end loop;
  foreach t in array array['h2_production','h2_usage','h2_flows','h2_future_plans',
    'ccus_emission_sources','ccus_capture_units','ccus_plans','ccus_utilization']
  loop
    execute format('alter table %I alter column raw drop not null', t);
  end loop;
end $$;
