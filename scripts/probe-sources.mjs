// ==========================================
// 第 0 階段：資料來源連線驗證（爬蟲正式開發前用）
// ==========================================
// 用法：
//   node scripts/probe-sources.mjs            全部來源各打一次，印出結果表
//   node scripts/probe-sources.mjs --tw       只測台灣來源（關務署、經濟部統計處）
//
// 每個來源的回應原文存到 data/_probe/<key>.(html|json)（已在 .gitignore），
// 台灣來源的查詢頁 HTML 用來分析表單欄位與背後的資料端點，之後才寫正式爬蟲。
//
// 2026-10 在雲端（美國 IP）測試：關務署 portal.sw.nat.gov.tw 直接斷線、
// 經濟部 dmz9.moea.gov.tw / publicinfo.trade.gov.tw 被 Cloudflare 擋（403/502），
// 國際來源（UN Comtrade、Eurostat Comext、CEPII）都正常。
// 台灣來源請在台灣網路（本機或 self-hosted runner）執行本腳本。

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'data', '_probe');
const USER_AGENT =
  'Mozilla/5.0 (compatible; trade-dashboard-crawler/1.0; +https://github.com/youshenglin-ui/trade-dashboard)';

const SOURCES = [
  // ---- 台灣（需台灣 IP）----
  {
    key: 'tw-customs-ga30',
    tw: true,
    label: '關務署 海關進出口統計 綜合查詢（11 碼 × 國家 × 月）',
    url: 'https://portal.sw.nat.gov.tw/APGA/GA30',
  },
  {
    key: 'tw-trade-cuswebo',
    tw: true,
    label: '國貿署 中華民國進出口貿易統計',
    url: 'https://publicinfo.trade.gov.tw/cuswebo/',
  },
  {
    key: 'tw-moea-gmweb',
    tw: true,
    label: '經濟部統計處 工業產銷存動態調查（產品別）',
    url: 'https://dmz9.moea.gov.tw/gmweb/investigate/InvestigateDA.aspx',
  },
  // ---- 國際 ----
  {
    key: 'comtrade-cn-cement-2024',
    label: 'UN Comtrade（免金鑰 preview）：中國 2024 年水泥熟料 252329 出口，各目的國',
    url: 'https://comtradeapi.un.org/public/v1/preview/C/A/HS?reporterCode=156&period=2024&cmdCode=252329&flowCode=X',
    check: (j) => `${j.count} 列`,
  },
  {
    key: 'comtrade-availability',
    label: 'UN Comtrade 月資料更新進度（各報告國最新月份）',
    url: 'https://comtradeapi.un.org/public/v1/getDA/C/M/HS',
    check: (j) => {
      const latest = {};
      for (const r of j.data) latest[r.reporterISO] = Math.max(latest[r.reporterISO] ?? 0, r.period);
      return ['CHN', 'JPN', 'KOR', 'VNM', 'IDN', 'THA', 'MYS', 'IND', 'SAU', 'EUR']
        .map((k) => `${k}:${latest[k] ?? '-'}`)
        .join(' ');
    },
  },
  {
    key: 'eurostat-hrc-cn8',
    label: 'Eurostat Comext：歐盟自台/中/韓/越進口熱軋鋼 CN8 72083900（月）',
    url:
      'https://ec.europa.eu/eurostat/api/comext/dissemination/statistics/1.0/data/DS-045409?format=JSON&lang=en' +
      '&freq=M&reporter=EU27_2020&partner=TW&partner=CN&partner=KR&partner=VN&product=72083900&flow=1&sinceTimePeriod=2026-01',
    check: (j) => `${Object.keys(j.value ?? {}).length} 個數值`,
  },
  {
    key: 'cepii-baci',
    label: 'CEPII BACI（年度 HS6 雙邊整批下載頁）',
    url: 'https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37',
  },
];

async function probe(src) {
  const started = Date.now();
  try {
    const res = await fetch(src.url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(60_000),
    });
    const body = await res.text();
    const isJson = (res.headers.get('content-type') ?? '').includes('json');
    await writeFile(join(OUT_DIR, `${src.key}.${isJson ? 'json' : 'html'}`), body);
    let note = '';
    if (/challenge-platform|Just a moment/.test(body)) note = '被 Cloudflare 驗證擋下';
    else if (src.check && isJson) note = src.check(JSON.parse(body));
    else if (!isJson) note = `${(body.length / 1024).toFixed(0)} KB HTML`;
    return { status: res.status, ms: Date.now() - started, note };
  } catch (err) {
    return { status: 'ERR', ms: Date.now() - started, note: err.cause?.code ?? err.message };
  }
}

await mkdir(OUT_DIR, { recursive: true });
const onlyTw = process.argv.includes('--tw');
for (const src of SOURCES.filter((s) => !onlyTw || s.tw)) {
  const r = await probe(src);
  const ok = r.status === 200 && !r.note.includes('Cloudflare');
  console.log(`${ok ? '✔' : '✘'} ${src.label}\n   ${r.status}  ${r.ms} ms  ${r.note}`);
}
console.log(`\n回應原文已存到 ${OUT_DIR}`);
