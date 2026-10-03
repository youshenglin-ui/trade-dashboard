// ==========================================
// 產發署「低碳技術彙編」相關頁面解析
// ==========================================
// 來源（都是伺服器端渲染的 HTML，不需要跑 JS）：
//   1. 產業節能減碳資訊網 資源下載／訓練講義
//      https://sdd.nat.gov.tw/ghg/Resources/lecture?id=<分類>
//      分類「低碳技術彙編」「典範案例」是一串 PDF 下載連結（ReadFile/?p=ResourcesLecture&n=<uuid>.pdf）
//   2. 企業減碳案例 https://sdd.nat.gov.tw/ghg/ZeroCase/index?p=N → 明細 ZeroCase_more?id=
//   3. 低碳製程技術資料庫（台灣綠色生產力基金會）https://lgiptd.tgpf.org.tw/page/TechnologyList.aspx
//      ASP.NET WebForms：列表頁點技術名稱是 __doPostBack，POST 回去後會 302 到 TechnologyDetail.aspx?...
// 這裡只做「HTML → 物件」，不碰網路也不碰資料庫，方便用存下來的 HTML 做回歸測試。
// 注意：技術資料庫明細頁有廠商聯絡人姓名、電話、Email，這裡刻意不解析、不保存。

import * as cheerio from 'cheerio';

const clean = (s) => (s || '').replace(/[\s　]+/g, ' ').trim();
const toNum = (s) => {
  if (s == null) return null;
  const n = Number(String(s).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};
const slashDate = (s) => {
  const m = /(\d{4})\/(\d{1,2})\/(\d{1,2})/.exec(s || '');
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : null;
};

// 書名裡的產業：「造紙產業減碳技術案例彙編(114年)」→ 造紙業；跨產業的系統篇 → 跨產業
const INDUSTRY_WORDS = [
  ['造紙', '造紙業'], ['紡織', '紡織業'], ['石化', '石化業'], ['半導體', '半導體業'], ['光電', '光電業'],
  ['玻璃', '玻璃業'], ['鋼鐵', '鋼鐵業'], ['水泥', '水泥業'],
];
export function industryFromTitle(title) {
  for (const [w, name] of INDUSTRY_WORDS) if (title.includes(w)) return name;
  return '跨產業';
}
export function rocYearFromTitle(title) {
  const m = /[(（](\d{2,3})\s*年[)）]/.exec(title || '');
  return m ? Number(m[1]) : null;
}

// ---------- 1. 訓練講義列表（低碳技術彙編 / 典範案例） ----------
// 回傳 { items: [{ docId, title, fileUrl, publishedOn, views }], lastPage }
export function parseLectureList(html, baseUrl) {
  const $ = cheerio.load(html);
  const items = [];
  $('ul.downloadList > li').each((_, li) => {
    const a = $(li).find('dt a').first();
    const href = a.attr('href') || '';
    const m = /[?&]n=([0-9a-f-]{36})\.pdf/i.exec(href);
    if (!m) return;
    const title = clean(a.text());
    items.push({
      docId: m[1].toLowerCase(),
      title,
      fileUrl: new URL(href, baseUrl).href,
      publishedOn: slashDate($(li).find('.entry-date').text()),
      views: toNum(/(\d[\d,]*)/.exec($(li).find('.entry-view').text())?.[1]),
      rocYear: rocYearFromTitle(title),
      industry: industryFromTitle(title),
    });
  });
  return { items, lastPage: parseLastPage($) };
}

function parseLastPage($) {
  const m = /第\s*\d+\s*\/\s*(\d+)\s*頁/.exec($('#page .total').text());
  return m ? Number(m[1]) : 1;
}

// ---------- 2. 企業減碳案例 ----------
export function parseZeroCaseList(html) {
  const $ = cheerio.load(html);
  const items = [];
  $('ul.ZeroCaseList > li').each((_, li) => {
    const a = $(li).find('dt a').first();
    const m = /ZeroCase_more\?id=([0-9a-f]{32})/i.exec(a.attr('href') || '');
    if (!m) return;
    items.push({
      id: m[1].toLowerCase(),
      title: clean(a.attr('title') || a.text()),
      keywords: $(li).find('strong.kw').map((__, k) => clean($(k).text())).get().filter(Boolean),
      publishedOn: slashDate($(li).find('.entry-date').text()),
      views: toNum(/(\d[\d,]*)/.exec($(li).find('.entry-view').text())?.[1]),
    });
  });
  return { items, lastPage: parseLastPage($) };
}

export function parseZeroCaseDetail(html, baseUrl) {
  const $ = cheerio.load(html);
  const header = $('header.pageTit');
  const body = $('.pageWord');
  body.find('img, script, style').remove();
  const text = body.find('p').map((_, p) => clean($(p).text())).get().filter(Boolean).join('\n');
  const attachments = $('.pageDownload .dnLink ul li a').map((_, a) => ({
    name: clean($(a).find('dt').text().replace('檔案名稱：', '')),
    url: new URL($(a).attr('href'), baseUrl).href,
    updatedOn: slashDate($(a).find('time').text()),
  })).get();
  return {
    title: clean(header.find('h3').text()),
    publishedOn: slashDate(header.find('.date').text()),
    source: clean(header.find('.source').text()).replace(/^資料來源：/, ''),
    summary: text.slice(0, 2000),
    attachments,
  };
}

// ---------- 3. 低碳製程技術資料庫 ----------
// 列表頁：依「製程別」分組（【製程餘熱回收】資料數：24筆），每列有 postback 目標、技術名稱、設備、廠商、瀏覽/下載次數
export function parseTechList(html) {
  const $ = cheerio.load(html);
  const hidden = {};
  $('input[type=hidden]').each((_, el) => { hidden[$(el).attr('name')] = $(el).attr('value') ?? ''; });
  const rows = [];
  $('div.ListDetail').each((_, block) => {
    const head = clean($(block).find('h3').first().text());
    const processType = /【(.+?)】/.exec(head)?.[1] || null;
    $(block).find('tr.gvItem, tr.gvAlternatingItem').each((__, tr) => {
      const a = $(tr).find('a[id*=lbtnTechnologyName]').first();
      const target = /__doPostBack\('([^']+)'/.exec((a.attr('href') || '').replace(/&#39;/g, "'"))?.[1];
      if (!target) return;
      rows.push({
        processType,
        techName: clean(a.attr('title') || a.text()),
        equipment: clean($(tr).find('span[id*=lbEquipmentName]').text()),
        vendor: clean($(tr).find('span[id*=lbCompanyName]').text()),
        views: toNum(/(\d[\d,]*)/.exec($(tr).find('span[id*=lblVCount]').text())?.[1]),
        downloads: toNum(/(\d[\d,]*)/.exec($(tr).find('span[id*=lblDCount]').text())?.[1]),
        postbackTarget: target,
      });
    });
  });
  const groups = [...$.root().text().matchAll(/【([^】]+)】\s*資料數：(\d+)筆/g)].map((m) => ({ processType: m[1], count: Number(m[2]) }));
  return { hidden, rows, groups };
}

// 明細頁：章節標題是 span.font-black-title（「4. 技術應用原理與流程」…），內容在同一個 div 裡
export function parseTechDetail(html) {
  const $ = cheerio.load(html);
  const pick = (id) => clean($(`#${id}`).text());
  const sections = {};
  $('span.font-black-title').each((_, el) => {
    const title = clean($(el).text()).replace(/^\d+\.\s*/, '');
    if (/設備廠商|技術\/設備名稱/.test(title)) return; // 基本資料另外取；聯絡人資訊不保存
    const box = $(el).parent().clone();
    box.find('span.font-black-title, img, script, style').remove();
    box.find('br').replaceWith('\n');
    const text = box.text().split('\n').map(clean).filter(Boolean).join('\n');
    if (text) sections[title] = text.slice(0, 6000);
  });
  const industries = [];
  $('#cph_divProcess table tr').each((_, tr) => {
    const tds = $(tr).find('td').map((__, td) => clean($(td).text())).get();
    if (tds.length >= 3) industries.push({ industry: tds[1], process: tds[2] });
  });
  const caseText = Object.entries(sections).find(([k]) => k.includes('典型應用案例'))?.[1] || '';
  return {
    techName: pick('cph_lblTechnologyName'),
    equipment: pick('cph_lblEquipmentName'),
    techSource: pick('cph_lblTechnicalSource'),
    vendor: pick('cph_lblCompanyName'),
    website: pick('cph_lblURL'),
    industries,
    industryRemark: pick('cph_lblTechnologyProcessIDsRemarks'),
    sections,
    caseText,
    caseMetrics: parseCaseMetrics(caseText),
  };
}

// 從「典型應用案例簡介」抓效益數字（規則式、盡力而為；抓不到就是 null，原文另外保存）
// 常見寫法：「節能量：209,226 kwh/年」「節能效益：約63萬元/年」「減碳量：約105公噸CO2e/年」「回收年限：約3年」「投資金額：約120萬元」
export function parseCaseMetrics(text) {
  const t = (text || '').replace(/\s+/g, '');
  const num = (re) => { const m = re.exec(t); return m ? toNum(m[1]) : null; };
  let kwh = num(/節(?:能|電)量[:：]?約?([\d,.]+)(?:kWh|kwh|度)/i);
  const wanKwh = num(/節(?:能|電)量[:：]?約?([\d,.]+)萬(?:kWh|kwh|度)/i);
  if (kwh == null && wanKwh != null) kwh = wanKwh * 1e4;
  let payback = num(/回收年限[:：]?約?([\d.]+)年/);
  const months = num(/回收年限[:：]?約?([\d.]+)個?月/);
  if (payback == null && months != null) payback = Math.round((months / 12) * 100) / 100;
  return {
    electricityKwh: kwh,
    benefitWan: num(/(?:節能效益|節省金額|節能績效|年效益|節省費用)[:：]?約?(?:新台幣)?([\d,.]+)萬元/),
    co2T: num(/減碳(?:量|效益)?[:：]?約?([\d,.]+)(?:公噸|噸|tCO2|t-CO2)/i),
    paybackYears: payback,
    investmentWan: num(/(?:投資金額|投資費用|投資成本|總投資|設備費用)[:：]?約?(?:新台幣)?([\d,.]+)萬/),
  };
}
