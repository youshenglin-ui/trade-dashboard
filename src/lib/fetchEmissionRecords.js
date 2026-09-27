import { supabase } from './supabaseClient';

// 環境部溫室氣體排放量登錄平台歷年清冊（104-113年，逐年擴大揭露家數，目前
// 每年約 280-560 筆，總量遠小於 trade_records，不需要 RPC，直接分頁抓全表
// 讓前端自行篩選/彙總即可。地址/座標欄位目前多半是空的，是後續視需要另外
// 補上的欄位，不是這張表的必要資料。
const PAGE_SIZE = 1000;

async function fetchAllRows() {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('ccus_emission_records')
      .select('roc_year, control_no, company_name, scope1_tons, scope2_tons, total_tons, county, industry')
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
