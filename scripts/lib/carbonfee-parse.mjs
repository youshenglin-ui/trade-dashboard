// ==========================================
// 環境部「碳費自主減量計畫公開資訊」頁面解析
// ==========================================
// 來源：https://carbonfee.moenv.gov.tw/front/reductionpublic/list
// 網站是伺服器端渲染的 HTML（不需要跑 JS），三種頁面：
//   1. 列表頁  /front/reductionpublic/list?page=N          → 每頁 10 筆核定計畫
//   2. 明細頁  /front/reductionpublic/list/Detail?controlNo=  → 單一事業：基本資料+逐年措施
//                                                            共同申請：計畫合計排放+參與事業清單
//   3. 個別明細 /front/reductionpublic/list/GetIndividualDetail?controlNo=
//                                                          → 共同申請中各參與事業的明細（HTML 片段，
//                                                            版型與單一事業明細頁相同）
// 這裡只做「HTML → 物件」，不碰網路也不碰資料庫，方便用存下來的 HTML 做回歸測試。

import * as cheerio from 'cheerio';

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

export function parseNumber(s) {
  const t = clean(s).replace(/,/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// '114/05/27 ~ 119/12/31' → { start: '2025-05-27', end: '2030-12-31' }
function rocToIso(s) {
  const m = /^(\d{2,3})\/(\d{1,2})\/(\d{1,2})$/.exec(clean(s));
  if (!m) return null;
  const y = Number(m[1]) + 1911;
  return `${y}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

export function parsePeriod(text) {
  const t = clean(text);
  const [a, b] = t.split('~').map((x) => x && x.trim());
  return { text: t.replace(/\s*~\s*/, '~'), start: rocToIso(a), end: rocToIso(b) };
}

const CITIES = [
  '臺北市', '新北市', '桃園市', '臺中市', '臺南市', '高雄市', '基隆市', '新竹市', '嘉義市',
  '新竹縣', '苗栗縣', '彰化縣', '南投縣', '雲林縣', '嘉義縣', '屏東縣', '宜蘭縣', '花蓮縣',
  '臺東縣', '澎湖縣', '金門縣', '連江縣',
];

export function cityFromAddress(address) {
  const a = clean(address).replace(/^台/, '臺').replace(/^\d{3,6}/, '');
  return CITIES.find((c) => a.startsWith(c)) || null;
}

// 「台灣積體電路製造股份有限公司先進封測五廠」→「台灣積體電路製造股份有限公司」
// 用來把同一家公司的多廠/分期案件歸成一組（集團分析用）
export function companyFromName(name) {
  const n = clean(name);
  const m = /^(.+?(?:股份有限公司|有限公司|公司))/.exec(n);
  return m ? m[1] : n;
}

// 行業別：多個行業用半形逗號分隔（「、」是行業名稱本身的一部分，例如「紙漿、紙及紙板製造業」）
export function splitIndustries(s) {
  return clean(s).split(/[,，]/).map((x) => x.trim()).filter(Boolean);
}

// 減量方式原文很不一致（「提升能源效率、製程改善」「提升能源效率/製程改善」「能源效率提升」「再生能源」…），
// 用關鍵字歸到官網的四大類，一筆措施可同時屬於多類。原文另外保留在 type_raw。
const CATEGORY_RULES = [
  ['提升能源效率', /能源效率|節能|能效/],
  ['使用再生能源', /再生能源|綠電|太陽能|風力/],
  ['製程改善', /製程/],
  ['轉換低碳燃料', /低碳燃料|燃料轉換|天然氣/],
];

export function normalizeMeasureCategories(typeRaw) {
  const t = clean(typeRaw);
  const cats = CATEGORY_RULES.filter(([, re]) => re.test(t)).map(([name]) => name);
  return cats.length ? cats : ['其他'];
}

export function parseListPage(html) {
  const $ = cheerio.load(html);
  const plans = [];
  $('table.table-result tbody tr').each((_, tr) => {
    const $tr = $(tr);
    const controlNo = clean($tr.find('td[data-th="管制編號"]').text());
    if (!controlNo) return;
    const tierClass = ($tr.find('td[data-th="優惠費率級別"] .discount-rate').attr('class') || '');
    const tier = (/\b([A-Z])\b/.exec(tierClass.replace('discount-rate', '')) || [])[1] || clean($tr.find('td[data-th="優惠費率級別"]').text()) || null;
    const baseTd = $tr.find('td').filter((__, td) => ($(td).attr('data-th') || '').startsWith('基準年'));
    const targetTd = $tr.find('td').filter((__, td) => ($(td).attr('data-th') || '').startsWith('目標年'));
    plans.push({
      controlNo,
      name: clean($tr.find('td[data-th="事業名稱"]').text()),
      tier,
      baseEmission: parseNumber(baseTd.text()),
      targetEmission: parseNumber(targetTd.text()),
      period: parsePeriod($tr.find('td[data-th="自主減量計畫執行期間"]').text()),
      isJoint: ($tr.attr('class') || '').includes('co-application'),
    });
  });

  let maxPage = 1;
  $('ul.pagination a.page-link').each((_, a) => {
    const m = /[?&]page=(\d+)/.exec($(a).attr('href') || '');
    if (m) maxPage = Math.max(maxPage, Number(m[1]));
  });
  return { plans, maxPage };
}

// 排放量卡片：「基準年排放量」「114年指定目標」「目標年指定目標」（共同申請合計前面會多「總計」）
function parseEmissionBoxes($, $scope) {
  const out = { base: null, firstYearTarget: null, firstYear: null, target: null };
  $scope.find('.emissions-box').each((_, box) => {
    const header = clean($(box).find('.card-header').clone().children('small').remove().end().text()).replace(/^總計/, '');
    const value = parseNumber($(box).find('.card-body').text());
    if (header.startsWith('基準年')) out.base = value;
    else if (header.startsWith('目標年')) out.target = value;
    else {
      const m = /^(\d{2,3})年指定目標/.exec(header);
      if (m) { out.firstYear = Number(m[1]); out.firstYearTarget = value; }
    }
  });
  return out;
}

function parseMeasures($) {
  const measures = [];
  let year = null;
  $('#yaersReview tbody tr').each((_, tr) => {
    const $tr = $(tr);
    const yearTd = $tr.find('td[data-th="年度"]');
    if (yearTd.length) year = Number(clean(yearTd.text())) || year;
    const typeTd = $tr.find('td[data-th="減量措施方式"]');
    if (!typeTd.length) return; // 手機版展開按鈕列
    const typeRaw = clean(typeTd.text());
    measures.push({
      year,
      code: clean($tr.find('td[data-th="減量措施序號"]').text()),
      typeRaw,
      categories: normalizeMeasureCategories(typeRaw),
      name: clean($tr.find('td[data-th="減量措施執行項目"]').text()),
    });
  });
  return measures;
}

// 單一事業明細（明細頁 or GetIndividualDetail 片段，版型相同）
export function parseFacilityDetail(html) {
  const $ = cheerio.load(html);
  const info = {};
  $('.info-data-grid .info-item').each((_, item) => {
    const label = clean($(item).find('.h5-label').text());
    info[label] = clean($(item).find('.value').text());
  });
  const get = (prefix) => {
    const k = Object.keys(info).find((key) => key.startsWith(prefix));
    return k ? info[k] : '';
  };
  const tierText = get('優惠費率級別');
  const industries = splitIndustries(get('行業別'));
  const address = get('登記地址');
  const titleName = clean($('.card-header-custom span, .card-title-custom span').first().text()).replace(/^申請事業\s*│?\s*/, '');
  const emissions = parseEmissionBoxes($, $.root());
  return {
    controlNo: get('管制編號'),
    name: titleName || null,
    period: parsePeriod(get('自主減量計畫執行期間')),
    tier: (/\b([AB])\b/.exec(tierText) || [])[1] || null,
    industries,
    address,
    city: cityFromAddress(address),
    boundaryNo: get('計畫邊界'),
    participantCount: parseInt(get('共同申請參與事業'), 10) || null,
    isRepresentative: $('.bage-represent').length > 0,
    emissions,
    measures: parseMeasures($),
    info,
  };
}

export function isJointDetailPage(html) {
  return html.includes('id="factoryinfos"') || html.includes('共同申請參與事業單位清單');
}

// 共同申請的代表頁：計畫合計排放 + 參與事業清單（各事業明細要另外呼叫 GetIndividualDetail）
export function parseJointDetail(html) {
  const $ = cheerio.load(html);
  const totals = parseEmissionBoxes($, $('#factoryinfos'));
  const participants = [];
  $('table[summary*="共同申請"] tbody tr').each((_, tr) => {
    const $tr = $(tr);
    const controlNo = clean($tr.find('td[data-th="管制編號"]').text()) || $tr.find('[data-control-no]').attr('data-control-no');
    if (!controlNo) return;
    participants.push({
      controlNo,
      name: clean($tr.find('td[data-th="事業名稱"]').text()),
      isRepresentative: ($tr.attr('class') || '').includes('rep'),
    });
  });
  return { totals, participants };
}
