-- 115 年 CCUS 第二次調查（115.09.24 發放、10 月回收）：供需匹配（CCS Hub 意願）與產業人力供需
-- 資料由各廠回覆問卷人工整理成 data/energy/ccus_r2_*.csv（不含填表人姓名、電話、Email），
-- 以 scripts/build-ccus-r2-seed.mjs 產生 supabase/ccus_survey_r2_seed.sql 匯入。代碼說明見前端 ccusRound2.js。
create table if not exists ccus_r2_plants (
  plant_key text primary key, company text not null, plant text, county text, region text, industry text,
  scope1_wan_t numeric, capture_volume text, start_timing text, handover text, transport_pref text,
  barriers text[], cost_knowledge text, cost_estimate text,
  share_lt1500 text, share_1500_3000 text, share_3000_5000 text, share_5000_8000 text, share_gt8000 text,
  comment text, lat numeric, lon numeric  -- 依問卷廠址地址概略定位
);
alter table ccus_r2_plants add column if not exists lat numeric, add column if not exists lon numeric;
create table if not exists ccus_r2_units (
  id bigserial primary key, plant_key text references ccus_r2_plants(plant_key) on delete cascade,
  seq int, unit_code text, unit_note text, emission_code int, conc_code int, temp_code int, pressure_code int, basis_code int
);
create table if not exists ccus_r2_hr (
  company text primary key, industry text, employees int, outlook text, talent_status text,
  ccus_fulltime int, ccus_parttime int, no_dedicated boolean,
  opt_116 int, opt_117 int, opt_118 int, base_116 int, base_117 int, base_118 int, cons_116 int, cons_117 int, cons_118 int,
  evaluating boolean, sources text[], shortage_reasons text[], training_areas text[],
  method_rank_1 text, method_rank_2 text, method_rank_3 text, comment text
);
create table if not exists ccus_r2_hr_jobs (
  id bigserial primary key, company text, stage text, title text, field text, degree text, experience text,
  difficulty text, overseas text, n116 int, n117 int, n118 int
);
do $$ declare t text; begin
  foreach t in array array['ccus_r2_plants','ccus_r2_units','ccus_r2_hr','ccus_r2_hr_jobs'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "public read %s" on %I', t, t);
    execute format('create policy "public read %s" on %I for select using (true)', t, t);
  end loop;
end $$;
