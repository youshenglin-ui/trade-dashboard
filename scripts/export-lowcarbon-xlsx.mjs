// ==========================================
// 匯出「製造業低碳技術」完整 Excel（網站「案例與資料來源」分頁的下載檔）
// ==========================================
// 用法：npm run export:lowcarbon
//   讀 data/lowcarbon/cases.csv（PDF 擷取的案例明細）與 data/lowcarbon/snapshot.json（爬蟲快照：書目、
//   企業減碳案例、低碳製程技術資料庫）→ public/data/lowcarbon/lowcarbon-database.xlsx
// 案例或快照更新後重跑一次再 commit，網站的下載檔就會更新。
// 不輸出廠商聯絡人、電話、Email（快照本來就不存）。

import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { readCasesCsv } from './lib/lowcarbon-csv.mjs';
import { normalizeCaseRows } from './lib/lowcarbon-db.mjs';
import {
  CATEGORIES, CATEGORY_DESC, LATEST_EF, TECHDB_PROCESS_MAP, abatementCost, co2Of, investPerTon, median, paybackOf,
} from '../src/lib/lowcarbon/metrics.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'public/data/lowcarbon/lowcarbon-database.xlsx');

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } };

function addSheet(wb, name, columns, rows) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns.map(([key, header, width = 14, numFmt]) => ({ key, header, width, style: numFmt ? { numFmt } : {} }));
  ws.getRow(1).eachCell((c) => { c.fill = HEADER_FILL; c.font = HEADER_FONT; c.alignment = { vertical: 'middle', wrapText: true }; });
  ws.getRow(1).height = 32;
  for (const r of rows) ws.addRow(r);
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return ws;
}

const round = (v, d = 2) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

async function main() {
  const cases = normalizeCaseRows(await readCasesCsv(join(ROOT, 'data/lowcarbon/cases.csv')));
  const snap = JSON.parse(await readFile(join(ROOT, 'data/lowcarbon/snapshot.json'), 'utf8'));
  const wb = new ExcelJS.Workbook();
  wb.creator = 'trade-dashboard';
  wb.created = new Date();

  // 1. 說明
  const info = wb.addWorksheet('說明');
  info.columns = [{ width: 22 }, { width: 110 }];
  const lines = [
    ['資料集', '製造業低碳技術資料庫（經濟部產業發展署 產業節能減碳資訊網）'],
    ['產出時間', new Date().toISOString().slice(0, 10)],
    ['爬蟲快照時間', snap.crawledAt],
    ['來源', '低碳技術彙編、典範案例（PDF）：https://sdd.nat.gov.tw/ghg/Resources/lecture?id=e2d61c527f544928a98b68fc87c45995'],
    ['', '企業減碳案例：https://sdd.nat.gov.tw/ghg/ZeroCase/index'],
    ['', '低碳製程技術資料庫：https://lgiptd.tgpf.org.tw/page/TechnologyList.aspx'],
    ['單位', '投資、年效益：萬元（新台幣）；年減碳量：公噸CO2e/年；節電：kWh/年；回收年限：年'],
    ['區間值', '原文為區間者，主欄位填中位值，另列 _min / _max；原文文字保留在「原文」欄'],
    ['重複收錄', '同一案例被多個年度彙編收錄時 case_key 相同，「最新版」= 出版年最新（同年取資料較完整）者，統計一律只算最新版'],
    ['電力係數換算', `「減碳量（${LATEST_EF.value} 換算）」= 純節電案例依最新電力係數重算，便於跨年度比較；原文減碳量欄保留原值`],
    ['技術類別', CATEGORIES.map((c) => `${c}：${CATEGORY_DESC[c]}`).join('\n')],
    ['分類原則', '餘熱回收歸節能、電氣化歸燃料；子類為整併後的技術子類'],
    ['年化減碳成本', '（投資 × 資本回收因子 − 年效益）÷ 年減碳量，折現率 5%、壽命 10 年；負值代表省錢又減碳'],
    ['注意', '各案例數值為原文所載，未經查核；跨案例加總僅供量級參考'],
  ];
  for (const l of lines) info.addRow(l);
  info.getColumn(1).font = { bold: true };
  info.eachRow((r) => { r.alignment = { vertical: 'top', wrapText: true }; });

  // 2. 案例明細
  const norm = { normalizeEf: true };
  addSheet(wb, '案例明細', [
    ['case_id', '案例編號', 16], ['doc_title', '出處', 36], ['pub_year_roc', '出版年(民國)', 10], ['page', '頁碼', 7],
    ['is_latest', '最新版', 8], ['industry', '產業', 12], ['category', '類別', 8], ['subcategory', '子類', 14],
    ['tech_name', '技術名稱', 40], ['company', '所屬公司/廠', 22], ['supplier', '設備/技術供應商', 20], ['overseas', '海外案例', 8],
    ['status', '狀態', 10], ['year_done', '完成年', 8],
    ['investment_wan', '投資(萬元)', 12, '#,##0.0'], ['investment_min_wan', '投資下限', 10, '#,##0.0'], ['investment_max_wan', '投資上限', 10, '#,##0.0'],
    ['electricity_kwh', '節電(kWh/年)', 14, '#,##0'], ['steam_t', '節省蒸汽(公噸/年)', 12, '#,##0'], ['fuel_oil_kl', '節省燃料油(kL/年)', 12, '#,##0'],
    ['coal_t', '節省煤(公噸/年)', 12, '#,##0'], ['gas_m3', '節省天然氣(m3/年)', 14, '#,##0'],
    ['benefit_wan', '年效益(萬元)', 12, '#,##0.0'], ['co2_t', '年減碳(公噸)', 12, '#,##0.0'], ['co2_norm', `年減碳(${LATEST_EF.value}換算)`, 14, '#,##0.0'],
    ['emission_factor', '原文電力係數', 10], ['payback_years', '回收年限(年)', 10, '0.00'], ['payback_calc', '回收年限(原文或計算)', 12, '0.00'],
    ['intensity', '投資強度 萬元/(t/年)', 12, '0.000'], ['abatement', '年化減碳成本(元/t)', 14, '#,##0'],
    ['investment_text', '投資原文', 30], ['saving_text', '節能量原文', 40], ['benefit_text', '效益原文', 30], ['co2_text', '減碳原文', 30],
    ['payback_text', '回收原文', 16], ['note', '備註', 30],
  ], cases.map((c) => ({
    ...c, is_latest: c.is_latest ? 'Y' : '', overseas: c.overseas ? 'Y' : '',
    co2_norm: round(co2Of(c, norm), 1), payback_calc: round(paybackOf(c)), intensity: round(investPerTon(c, norm), 3),
    abatement: round(abatementCost(c, norm), 0),
  })));

  // 3. 書目
  const byDoc = new Map();
  for (const c of cases) byDoc.set(c.doc_id, (byDoc.get(c.doc_id) || 0) + 1);
  addSheet(wb, '書目', [
    ['title', '書名', 46], ['kind', '類型', 12], ['industry', '產業', 12], ['rocYear', '出版年(民國)', 10], ['publishedOn', '上架日', 12],
    ['cases', '已擷取案例數', 12], ['status', '擷取狀態', 12], ['views', '瀏覽數', 10], ['fileUrl', 'PDF 連結', 60],
  ], snap.documents.map((d) => ({
    ...d, kind: d.kind === 'model_case' ? '典範案例' : '低碳技術彙編', cases: byDoc.get(d.docId) || 0,
    status: byDoc.has(d.docId) ? '已擷取' : '待擷取', fileUrl: { text: d.fileUrl, hyperlink: d.fileUrl },
  })));

  // 4. 技術資料庫
  addSheet(wb, '技術資料庫', [
    ['processType', '製程類型', 16], ['category', '類別', 8], ['techName', '技術名稱', 34], ['equipment', '設備', 24], ['vendor', '廠商', 26],
    ['techSource', '技術來源', 12], ['industries', '適用產業', 40],
    ['investmentWan', '典型案例投資(萬元)', 14, '#,##0.0'], ['electricityKwh', '節電(kWh/年)', 14, '#,##0'], ['benefitWan', '年效益(萬元)', 12, '#,##0.0'],
    ['co2T', '年減碳(公噸)', 12, '#,##0.0'], ['paybackYears', '回收年限(年)', 10, '0.00'], ['caseText', '典型應用案例原文', 60],
    ['detailUrl', '明細頁', 40],
  ], snap.techs.map((t) => ({
    ...t, ...(t.caseMetrics || {}), category: (TECHDB_PROCESS_MAP[t.processType] || ['節能'])[0],
    industries: (t.industries || []).map((i) => `${i.industry}/${i.process}`).join('、'),
    detailUrl: t.detailUrl ? { text: '開啟', hyperlink: t.detailUrl } : null,
  })));

  // 5. 企業減碳案例
  addSheet(wb, '企業減碳案例', [
    ['title', '標題', 30], ['keywords', '關鍵字', 24], ['publishedOn', '上架日', 12], ['views', '瀏覽數', 10],
    ['summary', '摘要', 80], ['url', '連結', 40],
  ], snap.articles.map((a) => ({ ...a, keywords: (a.keywords || []).join('、'), url: { text: '開啟', hyperlink: a.url } })));

  // 6. 分類統計（只算最新版）
  const latest = cases.filter((c) => c.is_latest);
  const stat = (list) => {
    const co2 = list.map((c) => co2Of(c, norm)).filter((v) => v != null);
    return {
      n: list.length, inv_sum: round(list.reduce((s, c) => s + (c.investment_wan || 0), 0), 1),
      co2_sum: round(co2.reduce((s, v) => s + v, 0), 1), inv_med: round(median(list.map((c) => c.investment_wan).filter((v) => v > 0)), 1),
      co2_med: round(median(co2), 1), intensity_med: round(median(list.map((c) => investPerTon(c, norm)).filter((v) => v != null)), 3),
      payback_med: round(median(list.map(paybackOf).filter((v) => v != null))),
    };
  };
  const statRows = [];
  for (const cat of CATEGORIES) {
    const list = latest.filter((c) => c.category === cat);
    statRows.push({ level: '類別', cat, sub: '（小計）', ...stat(list) });
    const subs = [...new Set(list.map((c) => c.subcategory))].sort((a, b) => String(a).localeCompare(String(b), 'zh-Hant'));
    for (const s of subs) statRows.push({ level: '子類', cat, sub: s, ...stat(list.filter((c) => c.subcategory === s)) });
  }
  statRows.push({ level: '合計', cat: '全部', sub: '', ...stat(latest) });
  const ws = addSheet(wb, '分類統計', [
    ['level', '層級', 8], ['cat', '類別', 8], ['sub', '子類', 18], ['n', '案例數', 8], ['inv_sum', '投資合計(萬元)', 14, '#,##0'],
    ['co2_sum', `年減碳合計(公噸，${LATEST_EF.value}換算)`, 16, '#,##0'], ['inv_med', '投資中位數(萬元)', 14, '#,##0.0'],
    ['co2_med', '年減碳中位數(公噸)', 14, '#,##0.0'], ['intensity_med', '投資強度中位數 萬元/(t/年)', 16, '0.000'], ['payback_med', '回收年限中位數(年)', 14, '0.00'],
  ], statRows);
  ws.eachRow((r, i) => { if (i > 1 && r.getCell(1).value !== '子類') r.font = { bold: true }; });

  await mkdir(dirname(OUT), { recursive: true });
  await wb.xlsx.writeFile(OUT);
  console.log(`已輸出 ${OUT.replace(`${ROOT}/`, '')}：案例 ${cases.length}（最新版 ${latest.length}）、書目 ${snap.documents.length}、技術 ${snap.techs.length}、企業案例 ${snap.articles.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
