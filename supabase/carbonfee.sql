-- ==========================================
-- 碳費自主減量計畫（環境部公開資訊）資料表
-- ==========================================
-- 來源：https://carbonfee.moenv.gov.tw/front/reductionpublic/list
-- 由 scripts/crawl-carbonfee.mjs 定期爬取後寫入（見 .github/workflows/crawl-carbonfee.yml）。
-- 資料量小（數百個計畫、數千筆措施），前端直接全量讀取即可。
--
-- 資料模型：
--   plan（核定計畫，列表頁的一列）1 ── n facility（參與事業/廠）1 ── n measure（逐年措施）
--   一般計畫 = 1 個 facility；「共同申請」= 代表事業 + 多個參與事業。
--   注意：列表頁上共同申請案件顯示的排放量只是「代表事業本身」的數字，
--   計畫整體的合計在明細頁的「總計」卡片 → 分別存在 list_* 與 total_* 欄位。
--
-- 執行方式：Supabase Dashboard > SQL Editor 貼上執行（可重複執行）。

create table if not exists carbonfee_plans (
  control_no text primary key,               -- 列表頁上的管制編號（共同申請時 = 代表事業）
  plan_name text not null,
  company text,                              -- 由名稱推得的公司（去掉廠別），集團彙整用
  tier text,                                 -- 優惠費率級別 'A'（技術標竿）| 'B'（達成效益）
  list_base_emission numeric,                -- 列表頁：基準年排放量（公噸CO2e）
  list_target_emission numeric,              -- 列表頁：目標年指定目標
  total_base_emission numeric,               -- 計畫整體基準年排放（共同申請 = 各參與事業合計）
  total_first_year_target numeric,           -- 計畫整體首年指定目標
  first_year int,                            -- 首年（民國年）
  total_target_emission numeric,             -- 計畫整體目標年指定目標
  period_text text,
  period_start date,
  period_end date,
  is_joint boolean not null default false,
  participant_count int not null default 1,
  status text not null default 'active',     -- 'active' | 'removed'（官網下架不刪除，保留歷史）
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists carbonfee_facilities (
  plan_control_no text not null references carbonfee_plans (control_no) on delete cascade,
  control_no text not null,
  is_representative boolean not null default false,
  name text,
  company text,
  city text,
  address text,
  industries text[] not null default '{}',
  primary_industry text,
  boundary_no text,
  base_emission numeric,
  first_year_target numeric,
  target_emission numeric,
  raw jsonb,                                 -- 明細頁所有「標籤 → 值」原文，之後要多用欄位不必重爬
  updated_at timestamptz not null default now(),
  primary key (plan_control_no, control_no)
);

create table if not exists carbonfee_measures (
  id bigint generated always as identity primary key,
  plan_control_no text not null references carbonfee_plans (control_no) on delete cascade,
  facility_control_no text not null,
  roc_year int not null,                     -- 民國年
  code text,                                 -- 措施代號（各計畫自編，跨公司不可比）
  type_raw text,                             -- 減量方式原文
  categories text[] not null default '{}',   -- 正規化後的四大類（可多選）
  name text
);
create index if not exists idx_carbonfee_measures_plan on carbonfee_measures (plan_control_no);

create table if not exists carbonfee_crawl_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean not null default false,
  plan_count int,
  facility_count int,
  measure_count int,
  new_count int,
  removed_count int,
  updated_count int,
  note text
);

create table if not exists carbonfee_changes (
  id bigint generated always as identity primary key,
  run_id bigint references carbonfee_crawl_runs (id) on delete set null,
  control_no text not null,
  plan_name text,
  change_type text not null,                 -- 'new' | 'removed' | 'restored' | 'updated'
  field text,
  old_value text,
  new_value text,
  detected_at timestamptz not null default now()
);
create index if not exists idx_carbonfee_changes_detected on carbonfee_changes (detected_at desc);

-- ---------- RLS：公開資料，全部開放唯讀；寫入走後端直連（postgres 角色不受 RLS 限制） ----------
alter table carbonfee_plans enable row level security;
alter table carbonfee_facilities enable row level security;
alter table carbonfee_measures enable row level security;
alter table carbonfee_crawl_runs enable row level security;
alter table carbonfee_changes enable row level security;

drop policy if exists "public read carbonfee_plans" on carbonfee_plans;
create policy "public read carbonfee_plans" on carbonfee_plans for select using (true);
drop policy if exists "public read carbonfee_facilities" on carbonfee_facilities;
create policy "public read carbonfee_facilities" on carbonfee_facilities for select using (true);
drop policy if exists "public read carbonfee_measures" on carbonfee_measures;
create policy "public read carbonfee_measures" on carbonfee_measures for select using (true);
drop policy if exists "public read carbonfee_crawl_runs" on carbonfee_crawl_runs;
create policy "public read carbonfee_crawl_runs" on carbonfee_crawl_runs for select using (true);
drop policy if exists "public read carbonfee_changes" on carbonfee_changes;
create policy "public read carbonfee_changes" on carbonfee_changes for select using (true);
