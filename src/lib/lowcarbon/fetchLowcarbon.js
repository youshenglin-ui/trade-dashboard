import { supabase } from '../supabaseClient';

// 低碳技術彙編：資料量小（數百筆），全量抓回前端再篩選/聚合。schema 見 supabase/lowcarbon.sql。
const PAGE_SIZE = 1000;

async function fetchAll(table, columns, orderBy) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase.from(table).select(columns).order(orderBy, { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table} 查詢失敗: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

// numeric 欄位 PostgREST 會回字串，統一轉成 number
const NUMERIC = /(_wan|_kwh|_t|_kl|_m3|_years|emission_factor|pub_year_roc|page|year_done|views|downloads|roc_year|electricity_kwh_max)$/;
const toNumbers = (row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [
  k, v != null && typeof v === 'string' && NUMERIC.test(k) && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v,
]));

export async function fetchLowcarbonData() {
  const [cases, documents, techs, articles, runs] = await Promise.all([
    fetchAll('lowcarbon_cases', '*', 'case_id'),
    fetchAll('lowcarbon_documents', '*', 'doc_id'),
    fetchAll('lowcarbon_techs', 'tech_id, process_type, tech_name, equipment, vendor, website, tech_source, industries, case_text, case_kwh, case_benefit_wan, case_co2_t, case_payback_years, case_investment_wan, views, downloads, detail_url, status', 'tech_id'),
    fetchAll('lowcarbon_articles', 'article_id, title, keywords, published_on, source, views, summary, attachments, url, status', 'article_id'),
    supabase.from('lowcarbon_crawl_runs').select('*').eq('ok', true).order('started_at', { ascending: false }).limit(5),
  ]);
  return {
    cases: cases.map(toNumbers),
    documents: documents.map(toNumbers),
    techs: techs.map(toNumbers),
    articles: articles.map(toNumbers),
    lastRun: runs.data?.[0] || null,
  };
}
