// ==========================================
// 低碳技術彙編：快照 / 案例 CSV → Supabase (PostgreSQL)
// ==========================================
// writeCatalog：爬蟲快照（書目、企業減碳案例、技術資料庫）upsert；這次沒出現的標 removed，不刪除。
// writeCases：data/lowcarbon/cases.csv 整批替換 lowcarbon_cases（CSV 是唯一真實來源，人工修正改 CSV）。
// 批次寫入用 jsonb_to_recordset 一次帶一整包 JSON。

export async function writeCatalog(client, snapshot) {
  const seenAt = snapshot.crawledAt;
  await client.query('begin');
  try {
    const { rows: [run] } = await client.query(
      'insert into lowcarbon_crawl_runs (started_at) values ($1) returning id', [seenAt]);

    const docs = snapshot.documents.map((d) => ({
      doc_id: d.docId, kind: d.kind, title: d.title, roc_year: d.rocYear, industry: d.industry,
      published_on: d.publishedOn, views: d.views, file_url: d.fileUrl,
    }));
    await client.query(
      `insert into lowcarbon_documents (doc_id, kind, title, roc_year, industry, published_on, views, file_url, status, first_seen_at, last_seen_at)
       select doc_id, kind, title, roc_year, industry, published_on, views, file_url, 'active', $2, $2
         from jsonb_to_recordset($1::jsonb) as x(doc_id text, kind text, title text, roc_year int, industry text,
              published_on date, views int, file_url text)
       on conflict (doc_id) do update set kind = excluded.kind, title = excluded.title, roc_year = excluded.roc_year,
         industry = excluded.industry, published_on = excluded.published_on, views = excluded.views,
         file_url = excluded.file_url, status = 'active', last_seen_at = excluded.last_seen_at`,
      [JSON.stringify(docs), seenAt]);
    await client.query(
      `update lowcarbon_documents set status = 'removed' where status = 'active' and last_seen_at < $1`, [seenAt]);

    const arts = snapshot.articles.map((a) => ({
      article_id: a.id, title: a.title, keywords: a.keywords, published_on: a.publishedOn, source: a.source,
      views: a.views, summary: a.summary, attachments: a.attachments || [], url: a.url,
    }));
    await client.query(
      `insert into lowcarbon_articles (article_id, title, keywords, published_on, source, views, summary, attachments, url, status, first_seen_at, last_seen_at)
       select article_id, title, coalesce(keywords, '{}'), published_on, source, views, summary, coalesce(attachments, '[]'), url, 'active', $2, $2
         from jsonb_to_recordset($1::jsonb) as x(article_id text, title text, keywords text[], published_on date,
              source text, views int, summary text, attachments jsonb, url text)
       on conflict (article_id) do update set title = excluded.title, keywords = excluded.keywords,
         published_on = excluded.published_on, source = coalesce(excluded.source, lowcarbon_articles.source),
         views = excluded.views, summary = coalesce(excluded.summary, lowcarbon_articles.summary),
         attachments = case when excluded.attachments = '[]'::jsonb then lowcarbon_articles.attachments else excluded.attachments end,
         url = excluded.url, status = 'active', last_seen_at = excluded.last_seen_at`,
      [JSON.stringify(arts), seenAt]);
    await client.query(
      `update lowcarbon_articles set status = 'removed' where status = 'active' and last_seen_at < $1`, [seenAt]);

    const techs = snapshot.techs.map((t) => ({
      tech_id: t.techId, process_type: t.processType, tech_name: t.techName, equipment: t.equipment, vendor: t.vendor,
      website: t.website, tech_source: t.techSource, industries: t.industries || [], industry_remark: t.industryRemark,
      sections: t.sections || {}, case_text: t.caseText, case_kwh: t.caseMetrics?.electricityKwh,
      case_benefit_wan: t.caseMetrics?.benefitWan, case_co2_t: t.caseMetrics?.co2T,
      case_payback_years: t.caseMetrics?.paybackYears, case_investment_wan: t.caseMetrics?.investmentWan,
      views: t.views, downloads: t.downloads, detail_url: t.detailUrl,
    }));
    await client.query(
      `insert into lowcarbon_techs (tech_id, process_type, tech_name, equipment, vendor, website, tech_source, industries,
            industry_remark, sections, case_text, case_kwh, case_benefit_wan, case_co2_t, case_payback_years,
            case_investment_wan, views, downloads, detail_url, status, first_seen_at, last_seen_at)
       select tech_id, process_type, tech_name, equipment, vendor, website, tech_source, coalesce(industries, '[]'),
            industry_remark, coalesce(sections, '{}'), case_text, case_kwh, case_benefit_wan, case_co2_t, case_payback_years,
            case_investment_wan, views, downloads, detail_url, 'active', $2, $2
         from jsonb_to_recordset($1::jsonb) as x(tech_id text, process_type text, tech_name text, equipment text, vendor text,
              website text, tech_source text, industries jsonb, industry_remark text, sections jsonb, case_text text,
              case_kwh numeric, case_benefit_wan numeric, case_co2_t numeric, case_payback_years numeric,
              case_investment_wan numeric, views int, downloads int, detail_url text)
       on conflict (tech_id) do update set process_type = excluded.process_type, tech_name = excluded.tech_name,
         equipment = excluded.equipment, vendor = excluded.vendor, website = excluded.website,
         tech_source = excluded.tech_source, industries = excluded.industries, industry_remark = excluded.industry_remark,
         sections = excluded.sections, case_text = excluded.case_text, case_kwh = excluded.case_kwh,
         case_benefit_wan = excluded.case_benefit_wan, case_co2_t = excluded.case_co2_t,
         case_payback_years = excluded.case_payback_years, case_investment_wan = excluded.case_investment_wan,
         views = excluded.views, downloads = excluded.downloads, detail_url = excluded.detail_url,
         status = 'active', last_seen_at = excluded.last_seen_at`,
      [JSON.stringify(techs), seenAt]);
    await client.query(
      `update lowcarbon_techs set status = 'removed' where status = 'active' and last_seen_at < $1`, [seenAt]);

    const summary = {
      documents: docs.length, articles: arts.length, techs: techs.length,
      newDocuments: snapshot.diff?.newDocuments?.length ?? null,
      newArticles: snapshot.diff?.newArticles?.length ?? null,
      newTechs: snapshot.diff?.newTechs?.length ?? null,
    };
    await client.query('update lowcarbon_crawl_runs set finished_at = now(), ok = true, summary = $2 where id = $1',
      [run.id, JSON.stringify(summary)]);
    await client.query('commit');
    return { runId: run.id, summary };
  } catch (err) {
    await client.query('rollback');
    throw err;
  }
}

// 數值欄位（CSV 字串 → number）
const NUMERIC = new Set([
  'pub_year_roc', 'page', 'year_done', 'investment_wan', 'investment_min_wan', 'investment_max_wan', 'electricity_kwh',
  'electricity_kwh_max', 'steam_t', 'fuel_oil_kl', 'coal_t', 'gas_m3', 'benefit_wan', 'benefit_min_wan',
  'benefit_max_wan', 'co2_t', 'co2_min_t', 'co2_max_t', 'emission_factor', 'payback_years', 'payback_min_years',
  'payback_max_years',
]);

export function normalizeCaseRows(rows) {
  const out = rows.map((r) => {
    const o = {};
    for (const [k, v] of Object.entries(r)) {
      if (v === '' || v == null) o[k] = null;
      else if (NUMERIC.has(k)) {
        const n = Number(v);
        if (!Number.isFinite(n)) throw new Error(`${r.case_id} 欄位 ${k} 不是數字：${v}`);
        o[k] = n;
      } else o[k] = v;
    }
    o.overseas = r.overseas === 'Y';
    if (!o.case_id || !o.doc_id || !o.tech_name || !o.category) throw new Error(`案例缺必要欄位：${JSON.stringify(r).slice(0, 120)}`);
    return o;
  });
  // 同 case_key 只標最新出版的一筆為 is_latest（同年則取資料較完整者）
  const filled = (o) => ['investment_wan', 'co2_t', 'payback_years', 'benefit_wan'].filter((k) => o[k] != null).length;
  const best = new Map();
  for (const o of out) {
    if (!o.case_key) continue;
    const cur = best.get(o.case_key);
    if (!cur || o.pub_year_roc > cur.pub_year_roc || (o.pub_year_roc === cur.pub_year_roc && filled(o) > filled(cur))) {
      best.set(o.case_key, o);
    }
  }
  for (const o of out) o.is_latest = !o.case_key || best.get(o.case_key) === o;
  const ids = new Set();
  for (const o of out) {
    if (ids.has(o.case_id)) throw new Error(`case_id 重複：${o.case_id}`);
    ids.add(o.case_id);
  }
  return out;
}

export async function writeCases(client, rows) {
  const cols = Object.keys(rows[0]);
  await client.query('begin');
  try {
    await client.query('delete from lowcarbon_cases');
    const types = cols.map((c) => `${c} ${c === 'overseas' || c === 'is_latest' ? 'boolean' : NUMERIC.has(c) ? 'numeric' : 'text'}`);
    for (let i = 0; i < rows.length; i += 200) {
      await client.query(
        `insert into lowcarbon_cases (${cols.join(', ')})
         select ${cols.join(', ')} from jsonb_to_recordset($1::jsonb) as x(${types.join(', ')})`,
        [JSON.stringify(rows.slice(i, i + 200))]);
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  }
  return rows.length;
}
