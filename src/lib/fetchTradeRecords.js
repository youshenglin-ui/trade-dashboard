import { supabase } from './supabaseClient';

// PostgREST 單次請求有列數上限（Supabase 專案預設 1000），
// 45 萬+ 筆資料要分頁抓。用少量併發（而非全部一次發或完全序列）
// 平衡「不要對資料庫瞬間灌太多連線」跟「不要一頁一頁乾等」。
const PAGE_SIZE = 1000;
const CONCURRENCY = 6;

function mapRow(row, idx) {
  return {
    id: `row-${idx}-${row.hs_code}`,
    date: row.period,
    year: row.period ? row.period.slice(0, 4) : '',
    hsCode: row.hs_code,
    productName: row.product_name || row.hs_code,
    country: row.country || 'Unknown',
    type: row.flow_type,
    value: row.value_ntd_thousand,
    weight: row.weight_kg,
  };
}

async function fetchPage(from, to) {
  const { data, error } = await supabase
    .from('trade_records')
    .select('id, source, period, hs_code, product_name, country, flow_type, value_ntd_thousand, weight_kg')
    // 只排 id（主鍵，天生有索引，幾乎不用額外排序成本）。不要在這裡排 source：
    // 45 萬列 + 深分頁（.range() 底層是 OFFSET）配上沒有索引支援的排序，
    // Postgres 會整批排序一次，深分頁時直接撞 statement timeout。
    .order('id', { ascending: true })
    .range(from, to);
  if (error) throw new Error(`Supabase 查詢失敗: ${error.message}`);
  return data || [];
}

// 取代原本「fetch 25 個 Google Sheet CSV 連結」的角色：
// 回傳跟 parseCSV_Safe 完全一樣形狀的陣列，讓 App.jsx 後續的階層去重、
// dataHealth 統計邏輯不用改一行。
export async function fetchAllTradeRecords() {
  const { count, error: countError } = await supabase
    .from('trade_records')
    .select('*', { count: 'exact', head: true });
  if (countError) throw new Error(`Supabase 計數查詢失敗: ${countError.message}`);

  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);
  const allRows = [];

  for (let batchStart = 0; batchStart < totalPages; batchStart += CONCURRENCY) {
    const batchPages = [];
    for (let p = batchStart; p < Math.min(batchStart + CONCURRENCY, totalPages); p++) {
      const from = p * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      batchPages.push(fetchPage(from, to));
    }
    const results = await Promise.all(batchPages);
    results.forEach((rows) => allRows.push(...rows));
  }

  // App.jsx 的階層去重邏輯（同一個 date+country+type 群組裡，稅號長度相同時
  // 只留排序後第一筆）依賴「active 來源一定排在 archive 之前」這個隱性前提
  // （原本用 Promise.all 照陣列固定順序處理）。改成資料全部抓回來後在這裡
  // 用一次穩定排序（JS Array.sort 保證穩定）處理，取代原本在資料庫端排序、
  // 會因深分頁而逾時的做法。
  allRows.sort((a, b) => {
    if (a.source === b.source) return 0;
    return a.source === 'active' ? -1 : 1;
  });

  return allRows.map(mapRow);
}
