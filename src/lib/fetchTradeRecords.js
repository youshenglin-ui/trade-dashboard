import { supabase } from './supabaseClient';

// PostgREST 單次請求有列數上限（Supabase 專案預設 1000）。RPC 呼叫也一樣受限，
// 所以即使搜尋結果只有幾千筆，還是要分頁抓完，只是頁數比「全表 45 萬列」少非常多。
const PAGE_SIZE = 1000;
// 併發數刻意壓低：Supabase 免費方案 anon 角色的 statement_timeout 只有 3 秒，
// 個別查詢雖快，但併發一多（測過 5-6）還是會搶 CPU/連線把彼此拖過 3 秒而 500。
// 實測 2 併發在深分頁、broad 專題（比對到 25 萬+ 列）下都穩定，見
// supabase/rpc_search_trade_records.sql 開頭的踩坑記錄。
const CONCURRENCY = 2;

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

// 通用：分頁抓完一個 RPC 的全部結果列（用 count: 'exact' 先問總數，再用少量併發分頁抓）。
// orderColumn 一定要給：PostgREST 對 RPC 結果做 range 分頁時，沒有外層 order by
// 就不保證跨頁順序穩定，分頁抓到重複或漏掉列的風險就是從這裡來的。
// 只適合用在「function 本體沒有自己的分頁參數」的 RPC（目前是 trade_code_catalog，
// 列數固定很小，一頁就抓完，不會踩到 search_trade_records 那個深分頁+高併發的坑）。
async function fetchAllPages(rpcName, params, orderColumn) {
  const countQuery = await supabase.rpc(rpcName, params, { count: 'exact', head: true });
  if (countQuery.error) throw new Error(`Supabase RPC(${rpcName}) 計數失敗: ${countQuery.error.message}`);

  const total = countQuery.count || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const allRows = [];

  for (let batchStart = 0; batchStart < totalPages; batchStart += CONCURRENCY) {
    const batchPages = [];
    for (let p = batchStart; p < Math.min(batchStart + CONCURRENCY, totalPages); p++) {
      const from = p * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      batchPages.push(
        supabase.rpc(rpcName, params).order(orderColumn, { ascending: true }).range(from, to).then(({ data, error }) => {
          if (error) throw new Error(`Supabase RPC(${rpcName}) 查詢失敗: ${error.message}`);
          return data || [];
        })
      );
    }
    const results = await Promise.all(batchPages);
    results.forEach((rows) => allRows.push(...rows));
  }

  return allRows;
}

// 取代原本「抓全表 45 萬列再篩選」：只跟資料庫要「跟目前搜尋條件相符」的列。
// codes / excludes 已經是正規化過的純數字稅號（呼叫端負責 normalizeCode）。
//
// search_trade_records 的分頁參數（p_limit/p_offset）是 function 本身的參數，
// 不是透過 PostgREST 的 .order().range()——那個組合會讓 function 沒辦法被
// inline 進外層查詢、整個 materialize 全表評估一次，連第一頁都會逾時（詳見
// supabase/rpc_search_trade_records.sql 的踩坑記錄）。總筆數改問配套的
// search_trade_records_count（同一套比對邏輯，只回傳 count）。
export async function searchTradeRecords({ codes, excludes = [], nameQuery = null }) {
  const countArgs = { p_codes: codes, p_excludes: excludes, p_name_query: nameQuery };
  const { data: total, error: countError } = await supabase.rpc('search_trade_records_count', countArgs);
  if (countError) throw new Error(`Supabase RPC(search_trade_records_count) 查詢失敗: ${countError.message}`);

  const totalPages = Math.ceil((total || 0) / PAGE_SIZE);
  const rows = [];

  for (let batchStart = 0; batchStart < totalPages; batchStart += CONCURRENCY) {
    const batchPages = [];
    for (let p = batchStart; p < Math.min(batchStart + CONCURRENCY, totalPages); p++) {
      batchPages.push(
        supabase.rpc('search_trade_records', {
          ...countArgs,
          p_limit: PAGE_SIZE,
          p_offset: p * PAGE_SIZE,
        }).then(({ data, error }) => {
          if (error) throw new Error(`Supabase RPC(search_trade_records) 查詢失敗: ${error.message}`);
          return data || [];
        })
      );
    }
    const results = await Promise.all(batchPages);
    results.forEach((pageRows) => rows.push(...pageRows));
  }

  // App.jsx 的階層去重邏輯（同一個 date+country+type 群組裡，稅號長度相同時
  // 只留排序後第一筆）依賴「active 來源一定排在 archive 之前」這個隱性前提。
  // 用一次穩定排序（JS Array.sort 保證穩定）處理，取代在資料庫端排序、
  // 深分頁會逾時的做法。
  rows.sort((a, b) => {
    if (a.source === b.source) return 0;
    return a.source === 'active' ? -1 : 1;
  });

  return rows.map(mapRow);
}

// 搜尋框自動完成用：每個稅號一筆代表列，列數遠小於全表，開一次就好。
export async function fetchTradeCodeCatalog() {
  const rows = await fetchAllPages('trade_code_catalog', {}, 'hs_code');
  return rows.map((row) => ({ code: row.hs_code, name: row.product_name || row.hs_code }));
}

// 「變動與關聯」頁籤：前 N 大貿易國在目前稅號以外的關聯產品排行，資料庫端聚合，
// 結果列數固定（p_limit），不需要分頁。
export async function fetchRelatedProductsByCountries({ countries, excludeCode = null, limit = 5 }) {
  if (!countries || countries.length === 0) return [];
  const { data, error } = await supabase.rpc('related_products_by_countries', {
    p_countries: countries,
    p_exclude_code: excludeCode,
    p_limit: limit,
  });
  if (error) throw new Error(`Supabase RPC(related_products_by_countries) 查詢失敗: ${error.message}`);
  return (data || []).map((row) => ({
    code: row.hs_code,
    name: row.product_name || row.hs_code,
    totalValue: row.total_value,
  }));
}
