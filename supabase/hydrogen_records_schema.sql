-- ==========================================
-- 氫能戰情室：正規化資料表 + 後台管理權限
-- ==========================================
-- 背景：氫能資料原本是「寬表格」CSV（每個年度一組欄位，例如 2025_產能、2025_產量），
-- 直接對應存進 energy_facility_records 的 raw jsonb（見 schema.sql）。這個設計方便匯入，
-- 但沒辦法做「新增一筆資料」這種後台管理表單——使用者要新增資料時，不會知道也不該
-- 需要理解 jsonb 裡的動態欄位命名規則。
--
-- 這裡改用一張正規化的 hydrogen_records 表：「一個公司/廠區/年度/製程(或用途)」一筆列，
-- 直接對應前端 HydrogenDashboard.jsx 原本 strictParseHydrogen() 展開後的資料形狀，
-- 這樣：
--   1. 後台新增資料只要填「公司、廠區、年度、製程或用途、幾個數字欄位」，不用碰 jsonb
--   2. 前端讀取邏輯改動最小（src/lib/fetchHydrogenRecords.js 把 DB 列組回原本圖表
--      邏輯吃的形狀，下游 900 多行的圖表/JSX 完全不用改）
--
-- 執行方式：在 Supabase Dashboard > SQL Editor 貼上整份檔案執行一次。
-- 可重複執行（create or replace / if not exists / do 區塊裡的 exception 處理）。

create table if not exists hydrogen_records (
  id bigint generated always as identity primary key,
  record_type text not null check (record_type in ('production', 'usage')),
  company text not null,           -- 公司（原始名稱，簡化顯示在前端讀取時處理，見 hydrogenHelpers.js）
  plant text,                      -- 廠區
  region text,                     -- 區域（原始值，如「南部」；前端讀取時會用 getRefinedRegion 校正）
  process text,                    -- 製程（production 用，如「甲醇裂解」）
  usage_type text,                 -- 用途（usage 用，如「化學製程」）
  year int not null,
  purity numeric,                  -- 純度
  carbon_intensity numeric,        -- 單位碳排
  capacity_tons numeric,           -- 產能（production）
  output_tons numeric,             -- 產量（production）
  trade_vol numeric,               -- 外售量（production）/ 外購量（usage）
  trade_target text,               -- 外售對象（production）
  demand_tons numeric,             -- 用量（usage）
  source_company text,             -- 外購來源公司（usage）
  transport_method text,           -- 運輸方式（usage）
  latitude numeric,
  longitude numeric,
  note text,
  synced_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

-- 同一公司/廠區/年度/製程(或用途) 只留一筆，後台編輯時用這個鍵做 upsert。
create unique index if not exists uq_hydrogen_natural_key
  on hydrogen_records (record_type, company, plant, year, coalesce(process, ''), coalesce(usage_type, ''));

create index if not exists idx_hydrogen_type_year on hydrogen_records (record_type, year);
create index if not exists idx_hydrogen_company on hydrogen_records (company);

-- ---------- Row Level Security ----------
-- 讀取對外開放（前端戰情室不需要登入就能看圖表），寫入只給登入過的使用者
-- （後台管理頁面用 Supabase Auth 登入後才能新增/編輯/刪除）。
alter table hydrogen_records enable row level security;

drop policy if exists "public read hydrogen_records" on hydrogen_records;
create policy "public read hydrogen_records" on hydrogen_records
  for select using (true);

drop policy if exists "authenticated write hydrogen_records" on hydrogen_records;
create policy "authenticated write hydrogen_records" on hydrogen_records
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
