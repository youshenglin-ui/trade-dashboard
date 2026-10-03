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

// 事業座標（carbonfee_facility_coords，見 supabase/carbonfee_coords.sql）。讀不到時不擋整頁，地圖退回縣市中心示意。
async function fetchFacilityCoords() {
  try {
    return await fetchAll('carbonfee_facility_coords', 'control_no, lat, lon, coord_source, matched', 'control_no');
  } catch (err) {
    console.warn(err);
    return [];
  }
}

export async function fetchCarbonfeeData() {
  const [plans, rawFacilities, measures, runsRes, changesRes, coords] = await Promise.all([
    fetchAll('carbonfee_plans', '*', 'control_no'),
    fetchAll(
      'carbonfee_facilities',
      'plan_control_no, control_no, is_representative, name, company, city, address, industries, primary_industry, base_emission, first_year_target, target_emission',
      'control_no'
    ),
    fetchAll('carbonfee_measures', 'id, plan_control_no, facility_control_no, roc_year, code, type_raw, categories, name', 'id'),
    supabase.from('carbonfee_crawl_runs').select('*').eq('ok', true).order('started_at', { ascending: false }).limit(12),
    fetchAll('carbonfee_changes', '*', 'id'), // 全部異動（首次建檔約 250 筆 new，之後每月少量）
    fetchFacilityCoords(),
  ]);
  const coordByNo = new Map(coords.filter((c) => c.lat != null && c.lon != null).map((c) => [c.control_no, c]));
  const facilities = rawFacilities.map((f) => {
    const c = coordByNo.get(f.control_no);
    return c ? { ...f, lat: Number(c.lat), lon: Number(c.lon), coord_source: c.coord_source, coord_matched: c.matched } : f;
  });
  if (runsRes.error) throw new Error(`carbonfee_crawl_runs 查詢失敗: ${runsRes.error.message}`);

  return { plans, facilities, measures, runs: runsRes.data || [], changes: [...changesRes].sort((a, b) => String(b.detected_at).localeCompare(String(a.detected_at))) };
}
