-- ==========================================
-- 低碳技術彙編資料庫（經濟部產業發展署 產業節能減碳資訊網）
-- ==========================================
-- 來源：
--   低碳技術彙編  https://sdd.nat.gov.tw/ghg/Resources/lecture?id=e2d61c527f544928a98b68fc87c45995
--   典範案例      https://sdd.nat.gov.tw/ghg/Resources/lecture?id=23c53f0e3e77443a924be7e752dc5bed
--   企業減碳案例  https://sdd.nat.gov.tw/ghg/ZeroCase/index
--   低碳製程技術資料庫 https://lgiptd.tgpf.org.tw/page/TechnologyList.aspx
--
-- 兩條寫入管線：
--   1. 爬蟲 scripts/crawl-lowcarbon.mjs（GitHub Actions 每月 1 日檢查，見 .github/workflows/crawl-lowcarbon.yml）
--      → lowcarbon_documents（PDF 書目）、lowcarbon_articles（企業減碳案例）、lowcarbon_techs（技術資料庫）
--   2. 人工＋AI 擷取的案例表 data/lowcarbon/cases.csv → scripts/import-lowcarbon.mjs → lowcarbon_cases
--      PDF 版面每年不同、典範案例是圖文排版，數字擷取無法全自動；新報告出現時爬蟲開 Issue 通知，
--      擷取後補進 cases.csv 再匯入。
--
-- 金額單位一律「萬元新台幣」（名目值，未做物價調整）；減碳量「公噸 CO2e/年」；回收年限「年」。
-- 原文有區間（如 800~1,500 萬元）時 *_min / *_max 存兩端，主欄位存中點。
-- 執行方式：Supabase Dashboard > SQL Editor 貼上執行（可重複執行）。

create table if not exists lowcarbon_documents (
  doc_id text primary key,                    -- 官網 PDF 檔名的 uuid（ReadFile/?n=<uuid>.pdf）
  kind text not null,                         -- 'compilation' 低碳技術彙編 | 'model_case' 典範案例
  title text not null,
  roc_year int,                               -- 書名上的出版年（民國）
  industry text,                              -- 由書名推得；系統篇 = 跨產業
  published_on date,                          -- 官網「發佈日期」
  views int,
  file_url text,
  status text not null default 'active',      -- 'active' | 'removed'（官網下架不刪除）
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists lowcarbon_cases (
  case_id text primary key,                   -- <doc_id 前 8 碼>-p<頁碼>-<序號>，cases.csv 的鍵
  doc_id text not null,                       -- 不設外鍵：新書尚未被爬蟲寫入前也能先匯入案例
  doc_title text,
  doc_kind text,
  pub_year_roc int,
  page int,                                   -- PDF 頁碼（不是印刷頁碼）
  case_key text,                              -- 同一案例在不同年版重複收錄時共用（例如 107 與 113 年紡織業）
  is_latest boolean not null default true,    -- 同 case_key 中出版年最新的一筆；統計時預設只算這些，避免重複計算
  industry text,
  tech_name text not null,
  category text not null,                     -- 節能 | 燃料 | 製程 | 其他（定義見 src/lib/lowcarbon/metrics.js）
  subcategory text,
  company text,                               -- 案例廠（彙編多半匿名，典範案例有公司名）
  supplier text,                              -- 技術/設備供應商
  overseas boolean not null default false,
  status text,                                -- 已執行 | 規劃中
  year_done int,                              -- 完工年（西元），原文有寫才填
  investment_wan numeric, investment_min_wan numeric, investment_max_wan numeric, investment_text text,
  saving_text text,
  electricity_kwh numeric, electricity_kwh_max numeric,   -- 年節電（負值 = 增加用電）
  steam_t numeric, fuel_oil_kl numeric, coal_t numeric, gas_m3 numeric,
  benefit_wan numeric, benefit_min_wan numeric, benefit_max_wan numeric, benefit_text text,  -- 年效益（負值 = 增加成本）
  co2_t numeric, co2_min_t numeric, co2_max_t numeric, co2_text text,
  emission_factor numeric,                    -- 原文採用的電力排碳係數 kgCO2e/kWh
  payback_years numeric, payback_min_years numeric, payback_max_years numeric, payback_text text,
  note text,
  updated_at timestamptz not null default now()
);
create index if not exists lowcarbon_cases_doc_idx on lowcarbon_cases (doc_id);

create table if not exists lowcarbon_articles (
  article_id text primary key,                -- ZeroCase_more?id=
  title text not null,
  keywords text[] not null default '{}',
  published_on date,
  source text,
  views int,
  summary text,
  attachments jsonb not null default '[]',
  url text,
  status text not null default 'active',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists lowcarbon_techs (
  tech_id text primary key,                   -- 明細頁網址上的 TechnologyID（加密字串，固定不變）
  process_type text,                          -- 製程別：製程餘熱回收 / 製程燃燒系統 / …
  tech_name text not null,
  equipment text,
  vendor text,                                -- 設備廠商/代理商（公司名；不保存聯絡人個資）
  website text,
  tech_source text,
  industries jsonb not null default '[]',     -- [{industry, process}]
  industry_remark text,
  sections jsonb not null default '{}',       -- 技術原理、規格、優勢、限制、實績、典型案例原文
  case_text text,
  case_kwh numeric, case_benefit_wan numeric, case_co2_t numeric, case_payback_years numeric, case_investment_wan numeric,
  views int,
  downloads int,
  detail_url text,
  status text not null default 'active',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists lowcarbon_crawl_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null,
  finished_at timestamptz,
  ok boolean not null default false,
  summary jsonb
);

-- 前端唯讀
alter table lowcarbon_documents enable row level security;
alter table lowcarbon_cases enable row level security;
alter table lowcarbon_articles enable row level security;
alter table lowcarbon_techs enable row level security;
alter table lowcarbon_crawl_runs enable row level security;

drop policy if exists "public read lowcarbon_documents" on lowcarbon_documents;
create policy "public read lowcarbon_documents" on lowcarbon_documents for select using (true);
drop policy if exists "public read lowcarbon_cases" on lowcarbon_cases;
create policy "public read lowcarbon_cases" on lowcarbon_cases for select using (true);
drop policy if exists "public read lowcarbon_articles" on lowcarbon_articles;
create policy "public read lowcarbon_articles" on lowcarbon_articles for select using (true);
drop policy if exists "public read lowcarbon_techs" on lowcarbon_techs;
create policy "public read lowcarbon_techs" on lowcarbon_techs for select using (true);
drop policy if exists "public read lowcarbon_crawl_runs" on lowcarbon_crawl_runs;
create policy "public read lowcarbon_crawl_runs" on lowcarbon_crawl_runs for select using (true);
