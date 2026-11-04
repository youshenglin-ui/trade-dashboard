-- ==========================================
-- 全貨品年度進出口（海關 HS6 × 國家 × 年）
-- ==========================================
-- 來源：外部提供的彙整 Excel（例：114 年進口總值／出口總值兩個分頁，
--       欄位 進出口別/日期/國家/貨品號列/中文貨名/英文貨名/美元(千元)/新臺幣(千元)/重量(公斤)）。
-- 為什麼不併進 trade_records：
--   trade_records 是「精選稅號 × 月」，這份是「全部 HS6（約 5,000 個）× 年」。
--   混在一起會讓同一年同時有月資料與年資料（顆粒不一致），前端全量抓取也會多 18 萬列。
--   所以獨立成表，前端只透過下面的 RPC 拿「聚合後」的結果（HS2 → HS4 → HS6 → 國家逐層下鑽）。
-- 注意：貨品號列 0「實施資訊保護貨品」是海關的補充資訊，原檔註明「勿加計於總量值」，
--       匯入時標 is_suppressed = true，RPC 預設排除。
-- 匯入：npm run db:import-trade-annual -- <檔案.xlsx>

create table if not exists trade_annual_hs6 (
  id bigint generated always as identity primary key,
  year int not null,                         -- 西元年（114 年 → 2025）
  flow_type text not null,                   -- '進口' / '出口'（與 trade_records 一致）
  country text not null,
  hs6 text not null,                         -- 6 碼，左補 0；資訊保護貨品為 '000000'
  hs4 text generated always as (left(hs6, 4)) stored,
  hs2 text generated always as (left(hs6, 2)) stored,
  product_name text,
  product_name_en text,
  value_usd_thousand numeric,
  value_ntd_thousand numeric,
  weight_kg numeric,
  is_suppressed boolean not null default false,
  dataset text not null,                     -- 匯入批次標籤（例 '114-v1'）
  source_row int not null,                   -- 原檔列號（資訊保護貨品同國家可能多列，不能用自然鍵）
  synced_at timestamptz not null default now(),
  unique (dataset, flow_type, source_row)
);

create index if not exists idx_ta_year_flow_hs2 on trade_annual_hs6 (year, flow_type, hs2);
create index if not exists idx_ta_year_flow_hs4 on trade_annual_hs6 (year, flow_type, hs4);
create index if not exists idx_ta_year_flow_hs6 on trade_annual_hs6 (year, flow_type, hs6);
create index if not exists idx_ta_year_flow_country on trade_annual_hs6 (year, flow_type, country);

alter table trade_annual_hs6 enable row level security;
drop policy if exists "public read trade_annual_hs6" on trade_annual_hs6;
create policy "public read trade_annual_hs6" on trade_annual_hs6 for select using (true);

-- 有哪些年份可選
create or replace function trade_annual_years()
returns table (year int, flow_type text, rows bigint, value_usd_thousand numeric)
language sql stable as $$
  select year, flow_type, count(*), sum(value_usd_thousand)
  from trade_annual_hs6 where not is_suppressed
  group by 1, 2 order by 1 desc, 2;
$$;

-- 逐層下鑽：p_level = 2/4/6，p_prefix = 上一層代碼（'' 表全部），p_country 可選
-- 回傳每個代碼的金額、重量、國家數、代表品名（HS6 直接是品名；HS2/HS4 給金額最大的 HS6 品名當提示）
create or replace function trade_annual_drill(
  p_year int, p_flow text, p_level int default 2, p_prefix text default '', p_country text default null
)
returns table (code text, name text, value_usd_thousand numeric, weight_kg numeric, n_countries int, n_items int)
language sql stable as $$
  with base as (
    select left(hs6, p_level) as code, hs6, product_name, country, value_usd_thousand v, weight_kg w
    from trade_annual_hs6
    where year = p_year and flow_type = p_flow and not is_suppressed
      and hs6 like coalesce(p_prefix, '') || '%'
      and (p_country is null or country = p_country)
  ), item as (
    select code, hs6, max(product_name) pn, sum(v) v from base group by 1, 2
  ), top_item as (
    select distinct on (code) code, pn from item order by code, v desc nulls last
  )
  select b.code, t.pn, sum(b.v), sum(b.w), count(distinct b.country)::int, count(distinct b.hs6)::int
  from base b join top_item t using (code)
  group by b.code, t.pn
  order by 3 desc nulls last;
$$;

-- 某代碼前綴（'' 表全部）的國家排行
create or replace function trade_annual_countries(p_year int, p_flow text, p_prefix text default '')
returns table (country text, value_usd_thousand numeric, weight_kg numeric)
language sql stable as $$
  select country, sum(value_usd_thousand), sum(weight_kg)
  from trade_annual_hs6
  where year = p_year and flow_type = p_flow and not is_suppressed
    and hs6 like coalesce(p_prefix, '') || '%'
  group by 1 order by 2 desc nulls last;
$$;

grant execute on function trade_annual_years() to anon, authenticated;
grant execute on function trade_annual_drill(int, text, int, text, text) to anon, authenticated;
grant execute on function trade_annual_countries(int, text, text) to anon, authenticated;
