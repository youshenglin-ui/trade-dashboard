// ==========================================
// 爬取產發署「低碳技術彙編」相關公開資料，偵測新報告
// ==========================================
// 用法：
//   npm run crawl:lowcarbon                       爬取 → 存快照 data/lowcarbon/snapshot.json → 與上次比對
//   npm run crawl:lowcarbon -- --write-db         另外把書目/企業減碳案例/技術資料庫寫入 Supabase
//   npm run crawl:lowcarbon -- --full             明細頁全部重抓（預設只抓新出現的；每年 12 月排程會加這個）
//   npm run crawl:lowcarbon -- --report <file>    輸出 Markdown 報告（GitHub Actions 用來開 Issue）
//   npm run crawl:lowcarbon -- --from-snapshot <file>  不重爬，直接用既有快照（搭配 --write-db）
//
// 爬什麼（見 scripts/lib/lowcarbon-parse.mjs）：
//   1. 低碳技術彙編、典範案例：PDF 書目（不下載 PDF；PDF 數值擷取需人工＋AI，見 data/lowcarbon/README.md）
//   2. 企業減碳案例（ZeroCase）：列表＋明細摘要＋附件連結
//   3. 低碳製程技術資料庫：109 項技術、廠商、典型應用案例效益（規則式解析）
//
// 「新報告」= 官網書目中，doc_id 還沒出現在 data/lowcarbon/cases.csv 的書 → 報告列出待擷取清單。
// 禮貌爬取：單線程、每個請求間隔 ~0.8 秒、失敗重試 3 次。

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import {
  parseLectureList, parseTechDetail, parseTechList, parseZeroCaseDetail, parseZeroCaseList,
} from './lib/lowcarbon-parse.mjs';
import { readCasesCsv } from './lib/lowcarbon-csv.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const GHG = 'https://sdd.nat.gov.tw/ghg';
const LECTURE = `${GHG}/Resources/lecture`;
const SOURCES = {
  compilation: `${LECTURE}?id=e2d61c527f544928a98b68fc87c45995`,
  model_case: `${LECTURE}?id=23c53f0e3e77443a924be7e752dc5bed`,
  zerocase: `${GHG}/ZeroCase/index`,
  techdb: 'https://lgiptd.tgpf.org.tw/page/TechnologyList.aspx',
};
const DELAY_MS = 800;
const USER_AGENT =
  'Mozilla/5.0 (compatible; trade-dashboard-crawler/1.0; +https://github.com/youshenglin-ui/trade-dashboard)';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const FULL = flag('--full');
const WRITE_DB = flag('--write-db');
const REPORT = opt('--report');
const FROM_SNAPSHOT = opt('--from-snapshot');
const OUT = opt('--out') || join(ROOT, 'data', 'lowcarbon', 'snapshot.json');
const CASES_CSV = join(ROOT, 'data', 'lowcarbon', 'cases.csv');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let requestCount = 0;
let cookie = '';

async function request(url, init = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (requestCount++ > 0) await sleep(DELAY_MS);
    try {
      const res = await fetch(url, {
        ...init,
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'zh-TW,zh;q=0.9', ...(cookie ? { Cookie: cookie } : {}), ...init.headers },
        signal: AbortSignal.timeout(30_000),
      });
      const setCookie = res.headers.getSetCookie?.() || [];
      if (setCookie.length) cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { url: res.url, html: await res.text() };
    } catch (err) {
      lastErr = err;
      console.warn(`  ! ${url} 第 ${attempt} 次失敗：${err.message}`);
      await sleep(2000 * attempt);
    }
  }
  throw new Error(`抓取失敗 ${url}：${lastErr?.message}`);
}
const fetchText = async (url) => (await request(url)).html;

async function crawlLectures(kind) {
  const base = SOURCES[kind];
  const first = parseLectureList(await fetchText(base), base);
  const items = [...first.items];
  for (let p = 2; p <= first.lastPage; p++) items.push(...parseLectureList(await fetchText(`${base}&p=${p}`), base).items);
  return items.map((d) => ({ ...d, kind }));
}

async function crawlArticles(prev) {
  const first = parseZeroCaseList(await fetchText(SOURCES.zerocase));
  const list = [...first.items];
  for (let p = 2; p <= first.lastPage; p++) list.push(...parseZeroCaseList(await fetchText(`${SOURCES.zerocase}?&p=${p}`)).items);
  const unique = [...new Map(list.map((a) => [a.id, a])).values()];
  const prevById = new Map((prev?.articles || []).map((a) => [a.id, a]));
  const out = [];
  for (const [i, a] of unique.entries()) {
    const url = `${GHG}/ZeroCase/ZeroCase_more?id=${a.id}`;
    const old = prevById.get(a.id);
    if (old && !FULL) { out.push({ ...old, ...a, url }); continue; }
    try {
      const d = parseZeroCaseDetail(await fetchText(url), url);
      out.push({ ...a, url, source: d.source, summary: d.summary, attachments: d.attachments });
    } catch (err) {
      console.warn(`  ! 企業減碳案例 ${a.id} 明細失敗：${err.message}`);
      out.push({ ...(old || {}), ...a, url, detailError: err.message });
    }
    process.stdout.write(`  企業減碳案例明細 ${i + 1}/${unique.length}\r`);
  }
  console.log('');
  return out;
}

// 技術資料庫：每筆都要用列表頁的 __VIEWSTATE POST 一次（__doPostBack），伺服器回 302 到明細頁
async function crawlTechs(prev) {
  const { hidden, rows, groups } = parseTechList(await fetchText(SOURCES.techdb));
  const expected = groups.reduce((s, g) => s + g.count, 0);
  if (rows.length !== expected) console.warn(`  ! 技術資料庫列表解析 ${rows.length} 筆，但分組合計 ${expected} 筆`);
  const prevByKey = new Map((prev?.techs || []).map((t) => [`${t.processType}|${t.techName}|${t.vendor}`, t]));
  const out = [];
  for (const [i, r] of rows.entries()) {
    const key = `${r.processType}|${r.techName}|${r.vendor}`;
    const old = prevByKey.get(key);
    const listPart = { processType: r.processType, techName: r.techName, equipment: r.equipment, vendor: r.vendor, views: r.views, downloads: r.downloads };
    if (old?.techId && !FULL) { out.push({ ...old, ...listPart }); continue; }
    try {
      const body = new URLSearchParams({ ...hidden, __EVENTTARGET: r.postbackTarget, __EVENTARGUMENT: '' });
      const res = await request(SOURCES.techdb, {
        method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const techId = new URL(res.url).searchParams.get('TechnologyID');
      if (!techId) throw new Error(`沒有導向明細頁（${res.url}）`);
      const d = parseTechDetail(res.html);
      out.push({
        techId, detailUrl: res.url, ...listPart, techSource: d.techSource, website: d.website, industries: d.industries,
        industryRemark: d.industryRemark, sections: d.sections, caseText: d.caseText, caseMetrics: d.caseMetrics,
      });
    } catch (err) {
      console.warn(`  ! 技術 ${r.techName} 明細失敗：${err.message}`);
      out.push({ ...(old || {}), ...listPart, detailError: err.message });
    }
    process.stdout.write(`  技術資料庫明細 ${i + 1}/${rows.length}\r`);
  }
  console.log('');
  return out;
}

async function crawl(prev) {
  const crawledAt = new Date().toISOString();
  console.log('[1/3] 低碳技術彙編、典範案例書目');
  const documents = [...(await crawlLectures('compilation')), ...(await crawlLectures('model_case'))];
  console.log(`  ${documents.length} 本`);
  console.log('[2/3] 企業減碳案例');
  const articles = await crawlArticles(prev);
  console.log(`  ${articles.length} 篇`);
  console.log('[3/3] 低碳製程技術資料庫');
  const techs = await crawlTechs(prev);
  console.log(`  ${techs.length} 項`);
  return { sources: SOURCES, crawledAt, full: FULL, requestCount, documents, articles, techs };
}

function validate(s, prev) {
  const problems = [];
  if (!s.documents.length) problems.push('書目一本都沒抓到（官網可能改版）');
  if (!s.articles.length) problems.push('企業減碳案例一篇都沒抓到');
  if (!s.techs.length) problems.push('技術資料庫一筆都沒抓到');
  const failedTechs = s.techs.filter((t) => t.detailError || !t.techId).length;
  if (failedTechs > Math.max(3, s.techs.length * 0.1)) problems.push(`技術資料庫明細失敗 ${failedTechs} 筆`);
  for (const k of ['documents', 'articles', 'techs']) {
    const before = prev?.[k]?.length || 0;
    if (before && s[k].length < before * 0.8) problems.push(`${k} 從 ${before} 筆驟減為 ${s[k].length} 筆`);
  }
  return problems;
}

async function buildDiff(s, prev) {
  const cases = await readCasesCsv(CASES_CSV);
  const extracted = new Set(cases.map((c) => c.doc_id));
  const prevDocs = new Set((prev?.documents || []).map((d) => d.docId));
  const prevArts = new Set((prev?.articles || []).map((a) => a.id));
  const prevTechs = new Set((prev?.techs || []).map((t) => t.techId).filter(Boolean));
  const nowDocs = new Set(s.documents.map((d) => d.docId));
  return {
    pendingDocuments: s.documents.filter((d) => !extracted.has(d.docId)),
    newDocuments: s.documents.filter((d) => prev && !prevDocs.has(d.docId)),
    removedDocuments: (prev?.documents || []).filter((d) => !nowDocs.has(d.docId)),
    newArticles: s.articles.filter((a) => prev && !prevArts.has(a.id)),
    newTechs: s.techs.filter((t) => prev && t.techId && !prevTechs.has(t.techId)),
    extractedCaseCount: cases.length,
  };
}

function renderReport(s, diff, problems) {
  const kindLabel = { compilation: '低碳技術彙編', model_case: '典範案例' };
  const lines = [`# 低碳技術彙編資料檢查（${s.crawledAt.slice(0, 10)}）`, ''];
  if (problems.length) lines.push('## ⚠️ 驗證問題', ...problems.map((p) => `- ${p}`), '');
  lines.push(
    `書目 ${s.documents.length} 本（已擷取案例 ${s.documents.length - diff.pendingDocuments.length} 本、${diff.extractedCaseCount} 筆案例）、` +
      `企業減碳案例 ${s.articles.length} 篇、技術資料庫 ${s.techs.length} 項。`, '');
  if (diff.pendingDocuments.length) {
    lines.push('## 📘 待擷取的新報告', '',
      '以下 PDF 尚未擷取到 `data/lowcarbon/cases.csv`，請開 Claude 工作階段擷取（流程見 `data/lowcarbon/README.md`）：', '');
    for (const d of diff.pendingDocuments) {
      lines.push(`- [${d.title}](${d.fileUrl})｜${kindLabel[d.kind]}｜官網發佈 ${d.publishedOn || '—'}｜doc_id \`${d.docId}\``);
    }
    lines.push('');
  }
  if (diff.removedDocuments.length) lines.push('## 官網已下架的書', ...diff.removedDocuments.map((d) => `- ${d.title}`), '');
  if (diff.newArticles.length) {
    lines.push('## 📰 新的企業減碳案例', ...diff.newArticles.map((a) => `- [${a.title}](${a.url})｜${a.publishedOn || ''}`), '');
  }
  if (diff.newTechs.length) {
    lines.push('## 🛠 技術資料庫新增技術', ...diff.newTechs.map((t) => `- ${t.processType}｜${t.techName}｜${t.vendor}`), '');
  }
  return lines.join('\n');
}

async function writeToDb(snapshot) {
  if (!process.env.SUPABASE_DB_HOST || !process.env.SUPABASE_DB_PASSWORD) {
    throw new Error('缺少 SUPABASE_DB_HOST / SUPABASE_DB_PASSWORD（.env 或 GitHub Secrets），無法寫入資料庫。');
  }
  const { default: pg } = await import('pg');
  const { resolveDbConfig, describeDbConfig } = await import('./lib/db-config.mjs');
  const { writeCatalog } = await import('./lib/lowcarbon-db.mjs');
  const cfg = resolveDbConfig(process.env);
  const client = new pg.Client(cfg);
  try {
    await client.connect();
  } catch (err) {
    throw new Error(`資料庫連線失敗：${err.message}\n  ${describeDbConfig(cfg, process.env.SUPABASE_DB_HOST)}`);
  }
  try {
    return await writeCatalog(client, snapshot);
  } finally {
    await client.end();
  }
}

async function main() {
  let prev = null;
  try { prev = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* 第一次執行 */ }

  let snapshot;
  if (FROM_SNAPSHOT) {
    snapshot = JSON.parse(await readFile(FROM_SNAPSHOT, 'utf8'));
    console.log(`讀取快照 ${FROM_SNAPSHOT}（擷取時間 ${snapshot.crawledAt}）`);
  } else {
    snapshot = await crawl(prev);
  }
  const problems = validate(snapshot, FROM_SNAPSHOT ? null : prev);
  const diff = await buildDiff(snapshot, FROM_SNAPSHOT ? null : prev);
  snapshot.diff = {
    pendingDocuments: diff.pendingDocuments.map((d) => d.docId),
    newDocuments: diff.newDocuments.map((d) => d.docId),
    newArticles: diff.newArticles.map((a) => a.id),
    newTechs: diff.newTechs.map((t) => t.techId),
  };
  if (!FROM_SNAPSHOT && !problems.length) {
    await mkdir(dirname(OUT), { recursive: true });
    await writeFile(OUT, `${JSON.stringify(snapshot, null, 1)}\n`);
    console.log(`已存快照 ${OUT}（${snapshot.requestCount} 個請求）`);
  }

  const report = renderReport(snapshot, diff, problems);
  console.log(`\n${report}`);
  if (REPORT) {
    await writeFile(REPORT, report);
    // 給 GitHub Actions 判斷要不要開 Issue
    const needsAttention = problems.length > 0 || diff.pendingDocuments.length > 0 || diff.newArticles.length > 0 || diff.newTechs.length > 0;
    if (process.env.GITHUB_OUTPUT) {
      // changed：書目/企業案例/技術有增減 → 才需要送出「寫入資料庫」核准請求
      const changed = diff.newDocuments.length + diff.removedDocuments.length + diff.newArticles.length + diff.newTechs.length > 0;
      await writeFile(process.env.GITHUB_OUTPUT, `attention=${needsAttention}\npending=${diff.pendingDocuments.length}\nchanged=${changed}\n`, { flag: 'a' });
    }
  }
  if (problems.length) throw new Error(`驗證未通過，不更新快照也不寫入資料庫：\n  - ${problems.join('\n  - ')}`);
  if (WRITE_DB) {
    const { runId, summary } = await writeToDb(snapshot);
    console.log(`已寫入資料庫（run #${runId}）：`, summary);
  }
}

main().catch((err) => {
  console.error(`\n✖ ${err.message}`);
  process.exit(1);
});
