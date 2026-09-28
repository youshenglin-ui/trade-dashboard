// ==========================================
// 氫能 / CCUS 問卷整併資料讀取（Supabase）
// ==========================================
// 資料表定義見 supabase/energy_survey.sql；匯入見 scripts/import-energy-survey.mjs。
// 每張表都只有數十到數百列，全量抓回前端再組裝即可（PostgREST 單次上限 1000 列，保留分頁）。
// 這裡只負責「抓」，彙總/換算放 energyMetrics.js，元件只負責畫——之後介面改版只要換元件，
// 資料層不用動。
import { supabase } from '../supabaseClient';

const PAGE_SIZE = 1000;

async function fetchAll(table, { select = '*', order = 'id', filter } = {}) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let q = supabase.from(table).select(select);
    if (filter) q = filter(q);
    if (order) q = q.order(order, { ascending: true });
    const { data, error } = await q.range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table} 查詢失敗: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

const cache = new Map();
const once = (key, fn) => {
  if (!cache.has(key)) cache.set(key, fn().catch((e) => { cache.delete(key); throw e; }));
  return cache.get(key);
};

export const fetchEnergyPlants = () => once('plants', () => fetchAll('energy_plants', { order: 'plant_id' }));
export const fetchRefParameters = () => once('params', () => fetchAll('energy_ref_parameters', { order: 'sort_order' }));

export function fetchHydrogenSurvey() {
  return once('hydrogen', async () => {
    const [plants, production, usage, flows, plans, answers, assistance, params] = await Promise.all([
      fetchEnergyPlants(),
      fetchAll('h2_production'),
      fetchAll('h2_usage'),
      fetchAll('h2_flows'),
      fetchAll('h2_future_plans'),
      fetchAll('survey_answers', { filter: (q) => q.eq('domain', 'hydrogen') }),
      fetchAll('survey_assistance_requests', { filter: (q) => q.eq('domain', 'hydrogen') }),
      fetchRefParameters(),
    ]);
    return { plants, production, usage, flows, plans, answers, assistance, params };
  });
}

export function fetchCcusSurvey() {
  return once('ccus', async () => {
    const [plants, sources, captures, plans, utilization, answers, assistance, sites, nodes, hsMap, params] = await Promise.all([
      fetchEnergyPlants(),
      fetchAll('ccus_emission_sources'),
      fetchAll('ccus_capture_units'),
      fetchAll('ccus_plans'),
      fetchAll('ccus_utilization'),
      fetchAll('survey_answers', { filter: (q) => q.eq('domain', 'ccus') }),
      fetchAll('survey_assistance_requests', { filter: (q) => q.eq('domain', 'ccus') }),
      fetchAll('ccus_storage_sites', { order: 'sort_order' }),
      fetchAll('ccus_network_nodes', { order: 'node_id' }),
      fetchAll('ccus_product_hs_map', { order: 'product' }),
      fetchRefParameters(),
    ]);
    return { plants, sources, captures, plans, utilization, answers, assistance, sites, nodes, hsMap, params };
  });
}

// CCU 產品的年度進出口均價（view：v_ccus_product_trade_price，只含有對應稅號的產品）
export const fetchCcuProductPrices = () =>
  once('ccuPrices', () => fetchAll('v_ccus_product_trade_price', { order: 'year' }));

// CCUS 管線規劃地圖用的範疇一排放源：原本讀 public/data/ccus/scope1.csv，
// 資料已由 npm run db:import 匯入 energy_facility_records（category = 'ccus_scope1'，raw 為原 CSV 欄位）。
export const fetchScope1Rows = () =>
  once('scope1', async () => {
    const rows = await fetchAll('energy_facility_records', { select: 'id, raw', filter: (q) => q.eq('category', 'ccus_scope1') });
    // 早期 db:import 重跑時是「追加」不是「取代」，資料表裡同一列可能出現多次（2026-09 查到 486 列存成 1458 列），
    // 這裡以整列內容去重，避免排放量被重複加總。import-to-supabase.mjs 已改成先刪再寫。
    const seen = new Set();
    return rows.map((r) => r.raw).filter((raw) => {
      const key = JSON.stringify(raw);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

// 已查證地址的排放源座標（ccus_emission_records，coord_source = 'verified' / 'verified_road'），
// 以管制編號對應 scope1 列；沒有的沿用公司名推估座標。
export const fetchVerifiedEmitterCoords = () =>
  once('verifiedCoords', async () => {
    const rows = await fetchAll('ccus_emission_records', {
      select: 'control_no, latitude, longitude, address, coord_source',
      filter: (q) => q.not('latitude', 'is', null),
      order: 'control_no',
    });
    const seen = new Map();
    rows.forEach((r) => { if (!seen.has(r.control_no)) seen.set(r.control_no, r); });
    return [...seen.values()];
  });
