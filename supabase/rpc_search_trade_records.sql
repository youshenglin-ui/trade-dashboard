-- ==========================================
-- trade-dashboard 效能優化：把篩選/聚合邏輯搬進資料庫查詢 (RPC)
-- ==========================================
-- 背景：前端原本是「全量抓取 trade_records 45 萬+ 列，篩選/去重/聚合都在瀏覽器做」，
-- 每次載入要 40-50 秒。這份檔案新增三個 RPC function，把「篩選」這一步搬進資料庫，
-- 前端只抓「跟目前搜尋條件相關」的列，數量通常是幾百~幾千筆，不是全表。
-- 去重（同一天+國家+進出口別下，稅號長度較短的蓋掉較長的，見 App.jsx cleanDataset 邏輯）
-- 跟圖表聚合維持在前端算，這兩塊邏輯已經穩定驗證過、且天生需要逐列資料，
-- 搬進 SQL 反而容易跟前端行為兜不起來——這裡只搬「篩選」這一步。
--
-- 執行方式：跟 schema.sql 一樣，在 Supabase Dashboard > SQL Editor 貼上整份檔案執行一次。
-- 可重複執行（create or replace / if not exists）。

-- ---------- 1. 主要查詢：依稅號前綴 / 品名關鍵字搜尋貿易紀錄 ----------
-- 對應前端 TradeDashboard.jsx 原本 filterData() 裡的比對邏輯：
--   - isHsCodeMatch(dataCode, targetCode)：雙向前綴比對（d.startsWith(t) || t.startsWith(d)），
--     因為同一批資料裡，同一天/國家/進出口別下可能同時有較粗的稅號（如 4 碼）跟較細的稅號
--     （如 8 碼）代表同一筆交易，去重邏輯依賴這個雙向比對才抓得到彼此。
--   - p_excludes：戰略專題（STRATEGIC_TOPICS）裡某些細項會排除特定子稅號。
--   - p_name_query：非專題搜尋時，用品名做子字串比對（沿用前端既有 normalizeCode 前處理，
--     呼叫端負責把查詢字串正規化後再傳進來，這裡不重複處理）。
create or replace function search_trade_records(
  p_codes text[],
  p_excludes text[] default '{}',
  p_name_query text default null
)
returns table (
  id bigint,
  source text,
  period text,
  hs_code text,
  product_name text,
  country text,
  flow_type text,
  value_ntd_thousand numeric,
  weight_kg numeric
)
language sql
stable
as $$
  select t.id, t.source, t.period, t.hs_code, t.product_name, t.country, t.flow_type,
         t.value_ntd_thousand, t.weight_kg
  from trade_records t
  where
    (
      exists (
        select 1 from unnest(p_codes) as c(code)
        where t.hs_code like (code || '%') or code like (t.hs_code || '%')
      )
      or (
        p_name_query is not null and p_name_query <> ''
        and t.product_name is not null
        and t.product_name ilike ('%' || p_name_query || '%')
      )
    )
    and not exists (
      select 1 from unnest(p_excludes) as e(code)
      where t.hs_code like (code || '%')
    )
  order by t.id;
$$;

grant execute on function search_trade_records(text[], text[], text) to anon, authenticated;

-- LIKE 'prefix%' 要吃到索引需要 text_pattern_ops（預設 collation 下純 btree 不支援前綴掃描）
create index if not exists idx_trade_hs_code_pattern on trade_records (hs_code text_pattern_ops);

-- ---------- 2. 稅號目錄：給搜尋框自動完成用 ----------
-- 前端原本是「掃描已載入的全量資料前 5000 筆找符合的稅號/品名」，現在全量資料不再
-- 整包載入瀏覽器，改成獨立抓「每個稅號一筆代表列」的小目錄（列數遠小於 45 萬），
-- 只在 App 啟動時抓一次。
create or replace function trade_code_catalog()
returns table (hs_code text, product_name text)
language sql
stable
as $$
  select distinct on (t.hs_code) t.hs_code, t.product_name
  from trade_records t
  where t.hs_code is not null
  order by t.hs_code, (t.product_name is null), length(t.product_name) desc nulls last;
$$;

grant execute on function trade_code_catalog() to anon, authenticated;

-- ---------- 3. 核心夥伴之關聯產品：找前 N 大貿易國的其他稅號交易額 ----------
-- 對應「變動與關聯」頁籤的 crossProductComparison，原本要掃全表（所有稅號）
-- 才能算出某幾個國家在「目前搜尋稅號以外」的產品貿易額排名，改成資料庫端聚合。
create or replace function related_products_by_countries(
  p_countries text[],
  p_exclude_code text default null,
  p_limit int default 5
)
returns table (hs_code text, product_name text, total_value numeric)
language sql
stable
as $$
  select t.hs_code,
         max(t.product_name) as product_name,
         sum(t.value_ntd_thousand) as total_value
  from trade_records t
  where t.country = any(p_countries)
    and (p_exclude_code is null or t.hs_code <> p_exclude_code)
  group by t.hs_code
  order by total_value desc
  limit p_limit;
$$;

grant execute on function related_products_by_countries(text[], text, int) to anon, authenticated;
