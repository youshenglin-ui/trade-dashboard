// ==========================================
// 爬取環境部「碳費自主減量計畫公開資訊」並寫入 Supabase
// ==========================================
// 用法：
//   npm run crawl:carbonfee                         爬取 → 驗證 → 寫入資料庫 → 存快照
//   npm run crawl:carbonfee -- --dry-run            只爬取與存快照，不寫資料庫（本機檢查用）
//   npm run crawl:carbonfee -- --from-snapshot data/carbonfee/snapshot.json
//                                                  不重爬，直接把既有快照寫入資料庫
//   其他參數：--max-pages N（測試用）、--force（跳過「筆數驟減」防呆）、--out <path>
//
// 資料庫連線沿用 .env 的 SUPABASE_DB_HOST / SUPABASE_DB_PASSWORD 等欄位（同 db:import）。
// 排程：.github/workflows/crawl-carbonfee.yml（每月第一個週六，需人工核准後才執行）。
//
// 禮貌爬取：單線程、每個請求間隔 ~0.8 秒、失敗重試 3 次，整輪約 300 個請求 / 5 分鐘。

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import {
  companyFromName,
  isJointDetailPage,
  parseFacilityDetail,
  parseJointDetail,
  parseListPage,
} from './lib/carbonfee-parse.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASE = 'https://carbonfee.moenv.gov.tw';
const LIST_URL = `${BASE}/front/reductionpublic/list`;
const DELAY_MS = 800;
const USER_AGENT =
  'Mozilla/5.0 (compatible; trade-dashboard-crawler/1.0; +https://github.com/youshenglin-ui/trade-dashboard)';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const DRY_RUN = flag('--dry-run');
const FORCE = flag('--force');
const MAX_PAGES = opt('--max-pages') ? Number(opt('--max-pages')) : Infinity;
const FROM_SNAPSHOT = opt('--from-snapshot');
const OUT = opt('--out') || join(ROOT, 'data', 'carbonfee', 'snapshot.json');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let requestCount = 0;

async function fetchText(url) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (requestCount++ > 0) await sleep(DELAY_MS);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'zh-TW,zh;q=0.9' },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      console.warn(`  ! ${url} 第 ${attempt} 次失敗：${err.message}`);
      await sleep(2000 * attempt);
    }
  }
  throw new Error(`抓取失敗 ${url}：${lastErr?.message}`);
}

function toFacility(detail, fallback = {}) {
  const name = detail.name || fallback.name || null;
  return {
    controlNo: detail.controlNo || fallback.controlNo,
    isRepresentative: fallback.isRepresentative ?? detail.isRepresentative,
    name,
    company: name ? companyFromName(name) : null,
    city: detail.city,
    address: detail.address,
    industries: detail.industries,
    boundaryNo: detail.boundaryNo,
    emissions: detail.emissions,
    measures: detail.measures,
    info: detail.info,
  };
}

async function crawlPlanDetail(listPlan) {
  const html = await fetchText(`${LIST_URL}/Detail?controlNo=${encodeURIComponent(listPlan.controlNo)}`);
  if (!isJointDetailPage(html)) {
    const d = parseFacilityDetail(html);
    if (!d.controlNo) throw new Error('明細頁解析不到管制編號（版型可能變了）');
    const facility = toFacility(d, { controlNo: listPlan.controlNo, name: listPlan.name, isRepresentative: true });
    return {
      isJoint: false,
      totals: {
        base: d.emissions.base ?? listPlan.baseEmission,
        firstYearTarget: d.emissions.firstYearTarget,
        firstYear: d.emissions.firstYear,
        target: d.emissions.target ?? listPlan.targetEmission,
      },
      facilities: [facility],
    };
  }

  const joint = parseJointDetail(html);
  if (!joint.participants.length) throw new Error('共同申請頁解析不到參與事業清單（版型可能變了）');
  const facilities = [];
  for (const p of joint.participants) {
    const frag = await fetchText(`${LIST_URL}/GetIndividualDetail?controlNo=${encodeURIComponent(p.controlNo)}`);
    facilities.push(toFacility(parseFacilityDetail(frag), p));
  }
  return {
    isJoint: true,
    totals: {
      base: joint.totals.base ?? listPlan.baseEmission,
      firstYearTarget: joint.totals.firstYearTarget,
      firstYear: joint.totals.firstYear,
      target: joint.totals.target ?? listPlan.targetEmission,
    },
    facilities,
  };
}

async function crawl() {
  const crawledAt = new Date().toISOString();
  console.log(`[1/2] 抓列表頁 ${LIST_URL}`);
  const first = parseListPage(await fetchText(`${LIST_URL}?page=1`));
  const lastPage = Math.min(first.maxPage, MAX_PAGES);
  const listPlans = [...first.plans];
  for (let page = 2; page <= lastPage; page++) {
    const { plans } = parseListPage(await fetchText(`${LIST_URL}?page=${page}`));
    listPlans.push(...plans);
    process.stdout.write(`  第 ${page}/${lastPage} 頁，累計 ${listPlans.length} 筆\r`);
  }
  console.log(`\n  列表共 ${listPlans.length} 筆（官網顯示 ${first.maxPage} 頁）`);

  // 同一管制編號只保留第一次出現（分頁期間官網若有新增，可能造成重複）
  const unique = [...new Map(listPlans.map((p) => [p.controlNo, p])).values()];

  console.log('[2/2] 抓各計畫明細');
  const plans = [];
  for (const [i, lp] of unique.entries()) {
    const base = {
      controlNo: lp.controlNo,
      name: lp.name,
      company: companyFromName(lp.name),
      tier: lp.tier,
      listBaseEmission: lp.baseEmission,
      listTargetEmission: lp.targetEmission,
      period: lp.period,
      isJoint: lp.isJoint,
    };
    try {
      const d = await crawlPlanDetail(lp);
      plans.push({ ...base, isJoint: d.isJoint, participantCount: d.facilities.length, totals: d.totals, facilities: d.facilities });
    } catch (err) {
      console.warn(`  ! ${lp.controlNo} 明細失敗：${err.message}`);
      plans.push({
        ...base,
        participantCount: 1,
        totals: { base: lp.baseEmission, firstYearTarget: null, firstYear: null, target: lp.targetEmission },
        facilities: [],
        detailError: err.message,
      });
    }
    process.stdout.write(`  ${i + 1}/${unique.length}\r`);
  }
  console.log('');
  return { source: LIST_URL, crawledAt, requestCount, plans };
}

// 爬完、寫入前的基本檢查：版型變了通常會表現成「整批欄位是空的」
function validate(snapshot) {
  const { plans } = snapshot;
  const problems = [];
  if (plans.length === 0) problems.push('列表頁一筆都沒抓到');
  const failed = plans.filter((p) => p.detailError);
  if (failed.length > Math.max(3, plans.length * 0.05)) {
    problems.push(`明細抓取失敗 ${failed.length} 筆，超過 5%`);
  }
  const noBase = plans.filter((p) => typeof p.totals.base !== 'number');
  if (noBase.length > plans.length * 0.05) problems.push(`${noBase.length} 筆沒有基準年排放量`);
  const detailed = plans.filter((p) => !p.detailError);
  const noMeasures = detailed.filter((p) => p.facilities.every((f) => f.measures.length === 0));
  if (noMeasures.length > detailed.length * 0.2) problems.push(`${noMeasures.length} 筆計畫沒有任何減量措施`);
  const noCity = detailed.flatMap((p) => p.facilities).filter((f) => !f.city);
  if (noCity.length > detailed.length * 0.2) problems.push(`${noCity.length} 個事業無法判讀縣市`);

  // 共同申請：每件都必須抓齊所有參與事業（數量要等於代表事業明細上寫的「共同申請參與事業 N家」），
  // 且每個參與事業都要有基準年排放與逐年措施。任何一件不完整就整批不寫入，避免合計排放被低估。
  const jointIssues = [];
  for (const p of detailed.filter((x) => x.isJoint)) {
    const reps = p.facilities.filter((f) => f.isRepresentative);
    const declared = parseInt(reps[0]?.info?.['共同申請參與事業'] ?? '', 10);
    const missing = [];
    if (reps.length !== 1) missing.push(`代表事業 ${reps.length} 個`);
    if (!Number.isNaN(declared) && declared !== p.facilities.length) missing.push(`官網寫 ${declared} 家、抓到 ${p.facilities.length} 家`);
    if (p.facilities.length < 2) missing.push('參與事業少於 2 家');
    const noBase = p.facilities.filter((f) => f.emissions.base == null).map((f) => f.controlNo);
    if (noBase.length) missing.push(`缺基準年排放：${noBase.join(',')}`);
    const noMs = p.facilities.filter((f) => f.measures.length === 0).map((f) => f.controlNo);
    if (noMs.length) missing.push(`缺逐年措施：${noMs.join(',')}`);
    if (missing.length) jointIssues.push(`${p.controlNo}（${missing.join('；')}）`);
  }
  if (jointIssues.length) problems.push(`共同申請資料不完整 ${jointIssues.length} 件：${jointIssues.slice(0, 10).join('、')}`);
  return problems;
}

async function writeToDb(snapshot) {
  const { SUPABASE_DB_HOST, SUPABASE_DB_PORT, SUPABASE_DB_USER, SUPABASE_DB_PASSWORD, SUPABASE_DB_NAME, SUPABASE_DB_SSL } = process.env;
  if (!SUPABASE_DB_HOST || !SUPABASE_DB_PASSWORD) {
    throw new Error('缺少 SUPABASE_DB_HOST / SUPABASE_DB_PASSWORD（.env 或 GitHub Secrets），無法寫入資料庫。');
  }
  const { default: pg } = await import('pg');
  const { writeSnapshot } = await import('./lib/carbonfee-db.mjs');
  const client = new pg.Client({
    host: SUPABASE_DB_HOST,
    port: Number(SUPABASE_DB_PORT) || 5432,
    user: SUPABASE_DB_USER || 'postgres',
    password: SUPABASE_DB_PASSWORD,
    database: SUPABASE_DB_NAME || 'postgres',
    ssl: SUPABASE_DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    return await writeSnapshot(client, snapshot, { force: FORCE });
  } finally {
    await client.end();
  }
}

function printSummary(snapshot) {
  const facilities = snapshot.plans.flatMap((p) => p.facilities);
  const measures = facilities.reduce((s, f) => s + f.measures.length, 0);
  const joint = snapshot.plans.filter((p) => p.isJoint);
  console.log(
    `快照：${snapshot.plans.length} 筆計畫、${facilities.length} 個事業、${measures} 筆逐年措施；` +
      `明細失敗 ${snapshot.plans.filter((p) => p.detailError).length} 筆`
  );
  console.log(
    `  共同申請 ${joint.length} 件，參與事業 ${joint.reduce((s, p) => s + p.facilities.length, 0)} 家、` +
      `措施 ${joint.reduce((s, p) => s + p.facilities.reduce((t, f) => t + f.measures.length, 0), 0)} 筆`
  );
}

async function main() {
  let snapshot;
  if (FROM_SNAPSHOT) {
    snapshot = JSON.parse(await readFile(FROM_SNAPSHOT, 'utf8'));
    console.log(`讀取快照 ${FROM_SNAPSHOT}（擷取時間 ${snapshot.crawledAt}）`);
  } else {
    snapshot = await crawl();
    await mkdir(dirname(OUT), { recursive: true });
    await writeFile(OUT, JSON.stringify(snapshot, null, 1));
    console.log(`已存快照 ${OUT}（${snapshot.requestCount} 個請求）`);
  }
  printSummary(snapshot);

  const problems = validate(snapshot);
  if (problems.length && !FORCE) {
    throw new Error(`驗證未通過，不寫入資料庫：\n  - ${problems.join('\n  - ')}`);
  }
  if (DRY_RUN) {
    console.log('--dry-run：不寫入資料庫。');
    return;
  }
  const { runId, summary, changes } = await writeToDb(snapshot);
  console.log(`已寫入資料庫（run #${runId}）：`, summary);
  for (const c of changes.slice(0, 50)) {
    console.log(`  [${c.change_type}] ${c.control_no} ${c.plan_name || ''}${c.field ? ` ${c.field}: ${c.old_value} → ${c.new_value}` : ''}`);
  }
  if (changes.length > 50) console.log(`  …另有 ${changes.length - 50} 筆異動`);
}

main().catch((err) => {
  console.error(`\n✖ ${err.message}`);
  process.exit(1);
});
