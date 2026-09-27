import { supabase } from './supabaseClient';

// 環境部溫室氣體排放量登錄平台歷年清冊（104-113年，逐年擴大揭露家數，目前
// 每年約 280-560 筆，總量遠小於 trade_records，不需要 RPC，直接分頁抓全表
// 讓前端自行篩選/彙總即可。地址/座標欄位目前只有「排放地圖上的優先碳源」
// (206家，scope1 >= 2.5萬噸或電廠) 有值，其餘大部分家數仍是 null——CCUS
// 規劃地圖 (CcusDashboard) 用 control_no 對應這裡的 address/latitude/
// longitude/coord_source，有值就取代原本的公司名關鍵字座標推估。
const PAGE_SIZE = 1000;

async function fetchAllRows() {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('ccus_emission_records')
      .select('roc_year, control_no, company_name, scope1_tons, scope2_tons, total_tons, county, industry, address, latitude, longitude, coord_source')
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Supabase 查詢失敗(ccus_emission_records): ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

let cachedRows = null;
export async function fetchAllEmissionRecords() {
  if (cachedRows) return cachedRows;
  cachedRows = await fetchAllRows();
  return cachedRows;
}
