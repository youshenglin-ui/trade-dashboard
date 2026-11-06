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


-- ==========================================
-- 預先聚合表（2026-11 補）：anon 的 statement_timeout 只有 3 秒，
-- 即時對 18 萬列 group by 在冷快取時會逾時，所以匯入後先算好各層級彙總，RPC 只做索引查詢。
-- lvl: 0 = 全部貨品（code ''）、2 / 4 / 6 = HS 位數；country is null = 全部國家合計。
-- 匯入新資料後必須執行 select trade_annual_refresh_agg();（匯入腳本會自動呼叫）
-- ==========================================
create table if not exists trade_annual_agg (
  year int not null, flow_type text not null, lvl int not null, code text not null, country text,
  name text, value_usd_thousand numeric, weight_kg numeric, n_countries int, n_items int
);
create index if not exists idx_taa_drill on trade_annual_agg (year, flow_type, lvl, country, code);
create index if not exists idx_taa_code on trade_annual_agg (year, flow_type, lvl, code);
alter table trade_annual_agg enable row level security;
drop policy if exists "public read trade_annual_agg" on trade_annual_agg;
create policy "public read trade_annual_agg" on trade_annual_agg for select using (true);

create or replace function trade_annual_refresh_agg()
returns void language plpgsql security definer set search_path = public as $$
begin
  set local statement_timeout = '120s';
  truncate trade_annual_agg;
  create temp table _b on commit drop as
    select year, flow_type, country, hs6, max(product_name) pn, sum(value_usd_thousand) v, sum(weight_kg) w
    from trade_annual_hs6 where not is_suppressed group by 1, 2, 3, 4;
  create temp table _names on commit drop as
    with item as (select year, flow_type, hs6, max(pn) pn, sum(v) v from _b group by 1, 2, 3),
    lv as (select l from (values (2), (4), (6)) t(l))
    select distinct on (year, flow_type, l, left(hs6, l)) year, flow_type, l lvl, left(hs6, l) code, pn
    from item, lv order by year, flow_type, l, left(hs6, l), v desc nulls last;
  insert into trade_annual_agg
  select b.year, b.flow_type, l.lvl, left(b.hs6, l.lvl), c.country, n.pn,
         sum(b.v), sum(b.w), count(distinct b.country)::int, count(distinct b.hs6)::int
  from _b b
  cross join (values (0), (2), (4), (6)) l(lvl)
  cross join lateral (values (null::text), (b.country)) c(country)
  left join _names n on n.year = b.year and n.flow_type = b.flow_type and n.lvl = l.lvl and n.code = left(b.hs6, l.lvl)
  group by b.year, b.flow_type, l.lvl, left(b.hs6, l.lvl), c.country, n.pn;
  analyze trade_annual_agg;
end $$;
revoke execute on function trade_annual_refresh_agg() from public, anon, authenticated;

create or replace function trade_annual_years()
returns table (year int, flow_type text, rows bigint, value_usd_thousand numeric)
language sql stable as $$
  select year, flow_type, n_items::bigint, value_usd_thousand
  from trade_annual_agg where lvl = 0 and country is null order by 1 desc, 2;
$$;

create or replace function trade_annual_drill(
  p_year int, p_flow text, p_level int default 2, p_prefix text default '', p_country text default null
)
returns table (code text, name text, value_usd_thousand numeric, weight_kg numeric, n_countries int, n_items int)
language sql stable as $$
  select code, name, value_usd_thousand, weight_kg, n_countries, n_items
  from trade_annual_agg
  where year = p_year and flow_type = p_flow and lvl = p_level
    and country is not distinct from p_country
    and code like coalesce(p_prefix, '') || '%'
  order by value_usd_thousand desc nulls last;
$$;

create or replace function trade_annual_countries(p_year int, p_flow text, p_prefix text default '')
returns table (country text, value_usd_thousand numeric, weight_kg numeric)
language sql stable as $$
  select country, value_usd_thousand, weight_kg
  from trade_annual_agg
  where year = p_year and flow_type = p_flow and lvl = length(coalesce(p_prefix, ''))
    and code = coalesce(p_prefix, '') and country is not null
  order by value_usd_thousand desc nulls last;
$$;

-- 跨層級搜尋：代碼開頭或品名包含關鍵字（HS6 層），回傳前 50 筆
create or replace function trade_annual_search(p_year int, p_flow text, p_q text)
returns table (code text, name text, value_usd_thousand numeric, n_countries int)
language sql stable as $$
  select code, name, value_usd_thousand, n_countries
  from trade_annual_agg
  where year = p_year and flow_type = p_flow and lvl = 6 and country is null
    and (code like regexp_replace(p_q, '\D', '', 'g') || '%' and regexp_replace(p_q, '\D', '', 'g') <> '' or name ilike '%' || p_q || '%')
  order by value_usd_thousand desc nulls last limit 50;
$$;

grant execute on function trade_annual_years() to anon, authenticated;
grant execute on function trade_annual_drill(int, text, int, text, text) to anon, authenticated;
grant execute on function trade_annual_countries(int, text, text) to anon, authenticated;
grant execute on function trade_annual_search(int, text, text) to anon, authenticated;
