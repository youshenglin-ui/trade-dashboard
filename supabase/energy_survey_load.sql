-- ==========================================
-- energy_survey_load(payload jsonb)：問卷整併資料一次寫入（單一交易）
-- ==========================================
-- 由 scripts/import-energy-survey.mjs 呼叫（payload 格式見該腳本）。
-- 規則：
--   * payload.imports[] 每個 domain：舊的 survey_sheet_rows 刪除、survey_imports 保留紀錄但 is_current=false
--   * 分析表：payload 有帶的表 → 該 domain 的資料整批替換（問卷整併檔是完整快照，不是增量）
--   * energy_plants：upsert；資料庫裡 coord_source='manual' 的座標不會被非 manual 的匯入值覆蓋
-- 只給後端（postgres / service_role）執行，前端 anon 不能呼叫。

create or replace function energy_survey_load(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  imp jsonb;
  new_id bigint;
  t text;
  cols text;
  n int;
  result jsonb := '{}'::jsonb;
  domains text[];
  h2_tables text[] := array['h2_production', 'h2_usage', 'h2_flows', 'h2_future_plans'];
  ccus_tables text[] := array['ccus_emission_sources', 'ccus_capture_units', 'ccus_plans', 'ccus_utilization'];
begin
  select coalesce(array_agg(x->>'domain'), '{}') into domains from jsonb_array_elements(coalesce(payload->'imports', '[]')) x;

  -- 1. 完整保存層
  for imp in select * from jsonb_array_elements(coalesce(payload->'imports', '[]')) loop
    update survey_imports set is_current = false where domain = imp->>'domain' and is_current;
    delete from survey_sheet_rows where domain = imp->>'domain';
    insert into survey_imports (domain, file_name, version_tag, sheet_count, row_count, note)
    values (imp->>'domain', imp->>'file_name', imp->>'version_tag', (imp->>'sheet_count')::int,
            jsonb_array_length(imp->'rows'), imp->>'note')
    returning id into new_id;
    insert into survey_sheet_rows (import_id, domain, sheet, row_no, header_row_no, plant_id, cells)
    select new_id, imp->>'domain', r->>'sheet', (r->>'row_no')::int, (r->>'header_row_no')::int, r->>'plant_id', r->'cells'
    from jsonb_array_elements(imp->'rows') r;
    result := result || jsonb_build_object('survey_sheet_rows:' || (imp->>'domain'), jsonb_array_length(imp->'rows'));
  end loop;

  -- 2. 分析表（整批替換）
  foreach t in array h2_tables || ccus_tables || array['survey_answers', 'survey_assistance_requests'] loop
    continue when not payload ? t;
    if t = any(h2_tables) then
      continue when not 'hydrogen' = any(domains);
      execute format('delete from %I', t);
    elsif t = any(ccus_tables) then
      continue when not 'ccus' = any(domains);
      execute format('delete from %I', t);
    else
      execute format('delete from %I where domain = any($1)', t) using domains;
    end if;

    select string_agg(quote_ident(column_name), ',' order by ordinal_position) into cols
    from information_schema.columns
    where table_schema = 'public' and table_name = t and column_name <> 'id';

    execute format('insert into %I (%s) select %s from jsonb_populate_recordset(null::%I, $1)', t, cols, cols, t)
    using payload->t;
    get diagnostics n = row_count;
    result := result || jsonb_build_object(t, n);
  end loop;

  -- 3. 廠區主檔
  if payload ? 'energy_plants' then
    insert into energy_plants (plant_id, short_name, company, tax_id, plant_name, factory_reg_no, address, county, region, zone,
                               lat, lon, coord_source, coord_note, is_survey_target, responded_years, note, raw, updated_at)
    select plant_id, short_name, company, tax_id, plant_name, factory_reg_no, address, county, region, zone,
           lat, lon, coord_source, coord_note, coalesce(is_survey_target, true), coalesce(responded_years, '{}'), note, raw, now()
    from jsonb_populate_recordset(null::energy_plants, payload->'energy_plants')
    on conflict (plant_id) do update set
      short_name = excluded.short_name, company = coalesce(excluded.company, energy_plants.company),
      tax_id = excluded.tax_id, plant_name = excluded.plant_name, factory_reg_no = excluded.factory_reg_no,
      address = coalesce(excluded.address, energy_plants.address), county = coalesce(excluded.county, energy_plants.county),
      region = excluded.region, zone = excluded.zone,
      lat = case when energy_plants.coord_source = 'manual' and excluded.coord_source is distinct from 'manual' then energy_plants.lat else excluded.lat end,
      lon = case when energy_plants.coord_source = 'manual' and excluded.coord_source is distinct from 'manual' then energy_plants.lon else excluded.lon end,
      coord_note = case when energy_plants.coord_source = 'manual' and excluded.coord_source is distinct from 'manual' then energy_plants.coord_note else excluded.coord_note end,
      coord_source = case when energy_plants.coord_source = 'manual' and excluded.coord_source is distinct from 'manual' then energy_plants.coord_source else excluded.coord_source end,
      is_survey_target = excluded.is_survey_target, responded_years = excluded.responded_years,
      note = excluded.note, raw = excluded.raw, updated_at = now();
    get diagnostics n = row_count;
    result := result || jsonb_build_object('energy_plants', n);
  end if;

  return result;
end;
$$;

revoke all on function energy_survey_load(jsonb) from public;
revoke all on function energy_survey_load(jsonb) from anon, authenticated;
