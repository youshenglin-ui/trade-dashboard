import { supabase } from './supabaseClient';
import { simplifyCompanyName } from '../utils/helpers';
import { getRefinedRegion, getDashboardPlantName } from '../utils/hydrogenHelpers';

// 把 hydrogen_records 的原始列組回前端圖表邏輯原本吃的形狀（跟舊版
// HydrogenDashboard.jsx 的 strictParseHydrogen() 輸出完全一致），這樣下游
// 900 多行的圖表/JSX 完全不用改，只有這裡的資料來源從「抓 CSV 再展開」
// 換成「查 Supabase 正規化資料表」。
//
// 公司名稱簡化、區域校正這些「顯示層」的轉換，統一在這裡做一次，不要存進
// 資料庫（資料庫存原始輸入值），這樣後台新增資料時不用先手動套用這些規則，
// 舊資料跟新資料在前端顯示上自然保持一致。
function toDisplayRecord(row, extra) {
  const region = String(row.region || '').replace('部', '區');
  const correctRegion = getRefinedRegion(row.plant, row.company);
  const finalRegion = correctRegion !== '其他' ? correctRegion : (region || '其他');
  return {
    Company: simplifyCompanyName(row.company),
    Plant: row.plant,
    label: getDashboardPlantName(row.company, row.plant),
    Region: finalRegion,
    Year: String(row.year),
    Carbon_Intensity: row.carbon_intensity || 0,
    Latitude: row.latitude,
    Longitude: row.longitude,
    ...extra,
  };
}

function toSupplyRecord(row) {
  return toDisplayRecord(row, {
    Process: row.process || '',
    Output_Tons: row.output_tons || 0,
    Capacity_Tons: row.capacity_tons || 0,
    Trade_Vol: row.trade_vol || 0,
    Trade_Target: row.trade_target || (row.trade_vol > 0 ? '公用網路(無指名對象)' : ''),
  });
}

function toUsageRecord(row) {
  return toDisplayRecord(row, {
    Usage_Type: row.usage_type || '',
    Demand_Tons: row.demand_tons || 0,
    Trade_Vol: row.trade_vol || 0,
    Source_Company: row.source_company || (row.trade_vol > 0 ? '公用網路(無指名來源)' : ''),
    Transport_Method: row.transport_method || '',
  });
}

// 分頁抓完 hydrogen_records（目前只有一百多筆，一頁抓得完，但保留分頁邏輯
// 避免未來後台累積資料後又要重踩 trade_records 那個「一次抓全表」的坑）。
async function fetchAllRows(recordType) {
  const PAGE_SIZE = 1000;
  const { count, error: countError } = await supabase
    .from('hydrogen_records')
    .select('*', { count: 'exact', head: true })
    .eq('record_type', recordType);
  if (countError) throw new Error(`Supabase 查詢失敗(hydrogen_records count): ${countError.message}`);

  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);
  const rows = [];
  for (let p = 0; p < totalPages; p++) {
    const from = p * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('hydrogen_records')
      .select('*')
      .eq('record_type', recordType)
      .order('id', { ascending: true })
      .range(from, to);
    if (error) throw new Error(`Supabase 查詢失敗(hydrogen_records): ${error.message}`);
    rows.push(...(data || []));
  }
  return rows;
}

export async function fetchHydrogenRecords() {
  const [productionRows, usageRows] = await Promise.all([
    fetchAllRows('production'),
    fetchAllRows('usage'),
  ]);

  return {
    supplyData: productionRows.map(toSupplyRecord),
    demandData: usageRows.map(toUsageRecord),
    rawSupply: productionRows,
    rawUsage: usageRows,
  };
}
