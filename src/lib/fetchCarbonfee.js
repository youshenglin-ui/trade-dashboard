import { supabase } from './supabaseClient';

// 碳費自主減量計畫資料量小（數百計畫、數千措施），全量抓回前端再篩選/聚合即可。
// PostgREST 單次上限 1000 列，措施表要分頁。
const PAGE_SIZE = 1000;

async function fetchAll(table, columns, orderBy) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(orderBy, { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table} 查詢失敗: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

export async function fetchCarbonfeeData() {
  const [plans, facilities, measures, runsRes, changesRes] = await Promise.all([
    fetchAll('carbonfee_plans', '*', 'control_no'),
    fetchAll(
      'carbonfee_facilities',
      'plan_control_no, control_no, is_representative, name, company, city, address, industries, primary_industry, base_emission, first_year_target, target_emission',
      'control_no'
    ),
    fetchAll('carbonfee_measures', 'id, plan_control_no, facility_control_no, roc_year, code, type_raw, categories, name', 'id'),
    supabase.from('carbonfee_crawl_runs').select('*').eq('ok', true).order('started_at', { ascending: false }).limit(12),
    supabase.from('carbonfee_changes').select('*').order('detected_at', { ascending: false }).limit(500),
  ]);
  if (runsRes.error) throw new Error(`carbonfee_crawl_runs 查詢失敗: ${runsRes.error.message}`);
  if (changesRes.error) throw new Error(`carbonfee_changes 查詢失敗: ${changesRes.error.message}`);
  return { plans, facilities, measures, runs: runsRes.data || [], changes: changesRes.data || [] };
}
