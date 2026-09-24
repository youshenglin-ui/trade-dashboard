-- ==========================================
-- trade-dashboard 效能優化：把篩選/聚合邏輯搬進資料庫查詢 (RPC)
-- ==========================================
-- 背景：前端原本是「全量抓取 trade_records 45 萬+ 列，篩選/去重/聚合都在瀏覽器做」，
-- 每次載入要 40-50 秒。這份檔案新增 RPC function，把「篩選」這一步搬進資料庫，
-- 前端只抓「跟目前搜尋條件相關」的列，數量通常是幾百~幾千筆，不是全表。
-- 去重（同一天+國家+進出口別下，稅號長度較短的蓋掉較長的，見 App.jsx cleanDataset 邏輯）
-- 跟圖表聚合維持在前端算，這兩塊邏輯已經穩定驗證過、且天生需要逐列資料，
-- 搬進 SQL 反而容易跟前端行為兜不起來——這裡只搬「篩選」這一步。
--
-- 執行方式：跟 schema.sql 一樣，在 Supabase Dashboard > SQL Editor 貼上整份檔案執行一次。
-- 可重複執行（create or replace / if not exists）。
--
-- ！！這份檔案踩過三個坑，記錄下來避免以後重踩：
--
-- 坑 1：function 本體裡不能有 ORDER BY。
-- 只要 function body 有 ORDER BY，Postgres 就不會把這個 SQL function inline
-- 進呼叫端組出來的外層查詢（PostgREST 的 .order('id').range()），會整個
-- function 當黑盒子先算完、materialize 全部符合條件的列，才套外層分頁——
-- 等於每次分頁都要重新評估整張表，連第一頁都會逾時。
--
-- 坑 2：稅號比對不能寫成 `hs_code like (code || '%') or code like (hs_code || '%')`
-- 這種寫法（不論是寫在 WHERE...EXISTS 裡，還是改寫成 JOIN／LATERAL）Postgres
-- 幾乎都不會用到索引，會整批 Seq Scan 全表（EXPLAIN 實測過，怎麼改寫都一樣）。
-- 真正能吃到索引的寫法是「明確不等式範圍」：
--   t.hs_code >= code and t.hs_code < (code || chr(1114111))   -- 前綴比對（data 較細）
--   t.hs_code = any(prefixes_of(code))                          -- 反向比對（data 較粗，
--                                                                   用 code 的所有前綴做等值查詢）
-- 兩者都能吃到 idx_trade_hs_code / idx_trade_hs_code_pattern 索引，EXPLAIN 驗證從
-- 全表 Seq Scan（數百 ms ~ 數秒）降到個位數 ms。
--
-- 坑 3：就算查詢本身幾十 ms 就跑完，前端如果一次併發打太多個分頁請求，一樣會在
-- Supabase 免費方案的 anon 角色 statement_timeout（3 秒，見下面的 ALTER ROLE）
-- 撞牆——不是查詢慢，是同時間太多查詢搶 CPU/連線，個別查詢被拖過 3 秒被砍掉。
-- 前端 fetchTradeRecords.js 的併發數（CONCURRENCY）因此要壓低（測過 2 併發穩定、
-- 5-6 併發會斷續 500）。也把 anon/authenticated 的 plan_cache_mode 固定成
-- force_custom_plan，避免 Postgres 對重複執行的參數化查詢在第 5 次之後退化成
-- 「通用執行計畫」（會選錯 Seq Scan，這個問題本身也是查全表逾時的成因之一）。
alter role anon set plan_cache_mode = force_custom_plan;
alter role authenticated set plan_cache_mode = force_custom_plan;

-- ---------- 1. 主要查詢：依稅號前綴 / 品名關鍵字搜尋貿易紀錄（分頁版） ----------
-- 對應前端 TradeDashboard.jsx 原本 filterData() 裡的比對邏輯：
--   - isHsCodeMatch(dataCode, targetCode)：雙向前綴比對，因為同一批資料裡，
--     同一天/國家/進出口別下可能同時有較粗的稅號（如 4 碼）跟較細的稅號
--     （如 8 碼）代表同一筆交易，去重邏輯依賴這個雙向比對才抓得到彼此。
--   - p_excludes：戰略專題（STRATEGIC_TOPICS）裡某些細項會排除特定子稅號。
--   - p_name_query：非專題搜尋時，用品名做子字串比對（沿用前端既有 normalizeCode
--     前處理，呼叫端負責把查詢字串正規化後再傳進來，這裡不重複處理）。
--   - p_limit / p_offset：分頁參數直接當 function 參數傳進來，不依賴 PostgREST
--     外層的 .order().range()（那個組合正是坑 1 的成因）。呼叫端固定分頁大小、
--     用不同 p_offset 分批呼叫。
create or replace function search_trade_records(
  p_codes text[],
  p_excludes text[] default '{}',
  p_name_query text default null,
  p_limit int default 1000,
  p_offset int default 0
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
  select * from (
    select distinct t.id, t.source, t.period, t.hs_code, t.product_name, t.country, t.flow_type,
           t.value_ntd_thousand, t.weight_kg
    from unnest(p_codes) as c(code)
    join trade_records t
      on (t.hs_code >= c.code and t.hs_code < (c.code || chr(1114111)))
      or t.hs_code = any(array(select substring(c.code from 1 for n) from generate_series(1, length(c.code)) as n))
    where not exists (
      select 1 from unnest(p_excludes) as e(code)
      where t.hs_code >= e.code and t.hs_code < (e.code || chr(1114111))
    )
    union
    select t.id, t.source, t.period, t.hs_code, t.product_name, t.country, t.flow_type,
           t.value_ntd_thousand, t.weight_kg
    from trade_records t
    where p_name_query is not null and p_name_query <> ''
      and t.product_name is not null
      and t.product_name ilike ('%' || p_name_query || '%')
      and not exists (
        select 1 from unnest(p_excludes) as e(code)
        where t.hs_code >= e.code and t.hs_code < (e.code || chr(1114111))
      )
  ) matched
  order by id
  limit p_limit offset p_offset;
$$;

grant execute on function search_trade_records(text[], text[], text, int, int) to anon, authenticated;

-- ---------- 1b. 配套的計數查詢 ----------
-- 前端要先知道「總共比對到幾筆」才能算要分幾頁抓。因為分頁 LIMIT/OFFSET 現在是
-- function 參數（見上面坑 1），不能再靠 PostgREST 的 count: 'exact' + head 請求
-- 直接對 search_trade_records 要總數（那樣拿到的只會是「這一頁」的筆數，不是總數）。
-- 邏輯跟 search_trade_records 完全一致，只是回傳 count(*) 不回傳列資料本身。
create or replace function search_trade_records_count(
  p_codes text[],
  p_excludes text[] default '{}',
  p_name_query text default null
)
returns bigint
language sql
stable
as $$
  select count(*) from (
    select distinct t.id
    from unnest(p_codes) as c(code)
    join trade_records t
      on (t.hs_code >= c.code and t.hs_code < (c.code || chr(1114111)))
      or t.hs_code = any(array(select substring(c.code from 1 for n) from generate_series(1, length(c.code)) as n))
    where not exists (
      select 1 from unnest(p_excludes) as e(code)
      where t.hs_code >= e.code and t.hs_code < (e.code || chr(1114111))
    )
    union
    select t.id
    from trade_records t
    where p_name_query is not null and p_name_query <> ''
      and t.product_name is not null
      and t.product_name ilike ('%' || p_name_query || '%')
      and not exists (
        select 1 from unnest(p_excludes) as e(code)
        where t.hs_code >= e.code and t.hs_code < (e.code || chr(1114111))
      )
  ) matched;
$$;

grant execute on function search_trade_records_count(text[], text[], text) to anon, authenticated;

-- LIKE 前綴比對／等值查詢都要吃到索引：純 btree（預設 collation）撐一般等值與
-- 明確範圍比較（>=/<），text_pattern_ops 額外撐 C-locale 下的前綴排序比較，
-- 兩個都留著讓 planner 自己選。
create index if not exists idx_trade_hs_code_pattern on trade_records (hs_code text_pattern_ops);

-- ---------- 2. 稅號目錄：給搜尋框自動完成用 ----------
-- 前端原本是「掃描已載入的全量資料前 5000 筆找符合的稅號/品名」，現在全量資料不再
-- 整包載入瀏覽器，改成獨立抓「每個稅號一筆代表列」的小目錄（列數遠小於 45 萬，
-- 目前只有一百多筆，一頁抓得完），只在 App 啟動時抓一次。
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
