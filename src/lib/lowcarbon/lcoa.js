// ==========================================
// 技術均化減碳成本（Levelized Cost of Abatement）：案例層級經濟性、資料年代加權、技術類型加權平均
// ==========================================
// 純 JS，前端各分頁與 Excel 匯出共用。
//
// 案例層級（元/公噸CO2e，皆以「每年減 1 公噸」計）：
//   投資攤提 amort  = 投資 × CRF(折現率, 壽命) ÷ 年減碳量
//   節能收益 saving = 年效益 ÷ 年減碳量
//   淨成本   net    = amort − saving（負值 = 省下的能源費超過設備攤提）
//
// 資料年代（使用者需求 2026-10）：越舊的案例代表性越差、標準誤差越大。
//   假設案例的標準誤差隨年代線性放大：σ_i = σ0 ×（1 + 年代_i ÷ A），A =「誤差倍增年限」（每 A 年誤差多 1 倍）。
//   加權平均採「反變異數權重」w_i = 1 ÷（1 + 年代_i ÷ A）²：新資料權重 1，A 年前的資料 0.25。
//   A = null 時不調整（每筆權重 1）。年代 = 資料集中最新出版年 − 該案例出版年。
//
// 技術類型（子類）加權平均：以「減碳量 × 年代權重」加權，等同 Σ(w·攤提金額) ÷ Σ(w·減碳量)，
// 代表「把這類技術全部推動時，每減 1 公噸的平均成本」，大案例影響較大；另提供加權中位數（抗極端值）。
import { amortCost, co2Of, crf, paybackOf } from './metrics.js';

export const AGE_ERROR_OPTIONS = [
  { value: '', label: '不調整' },
  { value: '10', label: '每 10 年誤差倍增' },
  { value: '5', label: '每 5 年誤差倍增' },
  { value: '3', label: '每 3 年誤差倍增' },
];
export const DEFAULT_AGE_ERROR = '5';
// 技術資料庫的廠商案例沒有年份，視為 3 年前的資料
const TECHDB_AGE = 3;

export const caseAge = (c, refRoc) => (c.pub_year_roc ? Math.max(0, refRoc - c.pub_year_roc) : TECHDB_AGE);
export const ageWeight = (age, A) => (A ? 1 / (1 + age / A) ** 2 : 1);
export const ageSigma = (age, A) => (A ? 1 + age / A : 1);

// 案例的經濟性（opts: normalizeEf, discountRate, lifetimeYears）
export function caseEcon(c, opts = {}) {
  const co2 = co2Of(c, opts);
  const inv = c.investment_wan > 0 ? Number(c.investment_wan) : null;
  const ben = c.benefit_wan != null && c.benefit_wan !== '' ? Number(c.benefit_wan) : null;
  const amort = amortCost(c, opts);
  const saving = ben != null && co2 > 0 ? (ben * 1e4) / co2 : null;
  return {
    co2, inv, benefit: ben, amort, saving,
    net: amort != null && saving != null ? amort - saving : null,
    payback: paybackOf(c),
  };
}

// 加權分位數（values 與 weights 同長度，忽略 null）
export function weightedQuantile(values, weights, q) {
  const pairs = values.map((v, i) => [v, weights[i]]).filter(([v, w]) => v != null && Number.isFinite(v) && w > 0)
    .sort((a, b) => a[0] - b[0]);
  if (!pairs.length) return null;
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let acc = 0;
  for (const [v, w] of pairs) {
    acc += w;
    if (acc >= q * total) return v;
  }
  return pairs[pairs.length - 1][0];
}

// 一組案例的加權結果
//   ctx: { opts, A, refRoc }
export function aggregate(cases, { opts = {}, A = null, refRoc } = {}) {
  const rows = cases.map((c) => {
    const e = caseEcon(c, opts);
    const age = caseAge(c, refRoc);
    return { c, ...e, age, w: ageWeight(age, A) };
  });
  const complete = rows.filter((r) => r.net != null);
  const withAmort = rows.filter((r) => r.amort != null);
  const sum = (list, f) => list.reduce((s, r) => s + f(r), 0);
  const ratio = (list, num) => {
    const den = sum(list, (r) => r.w * r.co2);
    return den > 0 ? sum(list, num) / den : null;
  };
  const k = crf(opts.discountRate, opts.lifetimeYears) * 1e4;
  // 減碳量加權（攤提用有投資的全部案例；淨成本／收益用三項俱全的案例，三者才對得起來）
  const amortAll = ratio(withAmort, (r) => r.w * r.inv * k);
  const amort = ratio(complete, (r) => r.w * r.inv * k);
  const saving = ratio(complete, (r) => r.w * r.benefit * 1e4);
  const net = amort != null && saving != null ? amort - saving : null;
  // 加權中位數與四分位距（每筆權重 = 年代權重，不乘減碳量 → 代表「典型案例」）
  const nets = complete.map((r) => r.net);
  const ws = complete.map((r) => r.w);
  const amorts = withAmort.map((r) => r.amort);
  const was = withAmort.map((r) => r.w);
  const sw = sum(rows, (r) => r.w);
  const nEff = sw > 0 ? sw ** 2 / sum(rows, (r) => r.w ** 2) : 0;
  // 標準誤：加權標準差 ÷ √有效樣本數，再乘上平均年代造成的誤差放大
  const cw = sum(complete, (r) => r.w);
  const mean = cw > 0 ? sum(complete, (r) => r.w * r.net) / cw : null;
  const sd = complete.length > 1 && cw > 0 ? Math.sqrt(sum(complete, (r) => r.w * (r.net - mean) ** 2) / cw) : null;
  const nEffC = cw > 0 ? cw ** 2 / sum(complete, (r) => r.w ** 2) : 0;
  const meanAge = rows.length ? sum(rows, (r) => r.age) / rows.length : null;
  const se = sd != null && nEffC > 0 ? (sd / Math.sqrt(nEffC)) * ageSigma(meanAge, A) : null;
  const benSum = sum(complete, (r) => r.w * r.benefit);
  return {
    n: rows.length, nComplete: complete.length, nAmort: withAmort.length, nEff,
    co2Sum: sum(rows.filter((r) => r.co2 > 0), (r) => r.co2),
    invSum: sum(rows.filter((r) => r.inv > 0), (r) => r.inv),
    amortAll, amort, saving, net,
    netMedian: weightedQuantile(nets, ws, 0.5), netP25: weightedQuantile(nets, ws, 0.25), netP75: weightedQuantile(nets, ws, 0.75),
    amortMedian: weightedQuantile(amorts, was, 0.5),
    payback: benSum > 0 ? sum(complete, (r) => r.w * r.inv) / benSum : null,
    paybackMedian: weightedQuantile(rows.map((r) => r.payback), rows.map((r) => r.w), 0.5),
    invMedian: weightedQuantile(rows.map((r) => r.inv), rows.map((r) => r.w), 0.5),
    meanAge, se, reliability: reliabilityOf(nEffC, meanAge),
    industries: [...new Set(cases.map((c) => c.industry).filter(Boolean))],
    rows,
  };
}

// 資料可信度：有效樣本數與平均資料年代
export function reliabilityOf(nEff, meanAge) {
  if (nEff >= 8 && (meanAge ?? 99) <= 5) return { level: '高', tone: 'good', note: `有效樣本 ${nEff.toFixed(1)}、平均 ${meanAge?.toFixed(1)} 年前` };
  if (nEff >= 3) return { level: '中', tone: 'mid', note: `有效樣本 ${nEff.toFixed(1)}、平均 ${meanAge?.toFixed(1)} 年前` };
  return { level: '低', tone: 'low', note: nEff ? `有效樣本僅 ${nEff.toFixed(1)}` : '無可計算成本的案例' };
}

// 依技術類型（類別＋子類）分組並彙總
export const groupKey = (c) => `${c.category}|${c.subcategory || '未分類'}`;
export function groupByTech(cases, ctx) {
  const m = new Map();
  for (const c of cases) {
    const k = groupKey(c);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(c);
  }
  return [...m.entries()].map(([key, list]) => {
    const [category, subcategory] = key.split('|');
    return { key, category, subcategory, cases: list, ...aggregate(list, ctx) };
  });
}

export const refRocOf = (cases) => Math.max(...cases.map((c) => c.pub_year_roc || 0).filter(Boolean), 0) || 114;

// 回收年限篩選
export const PAYBACK_FILTERS = [
  { value: '', label: '全部' },
  { value: '1', label: '1 年內' },
  { value: '2', label: '2 年內' },
  { value: '3', label: '3 年內' },
  { value: '5', label: '5 年內' },
];
export const passPayback = (c, max) => !max || ((paybackOf(c) ?? Infinity) <= Number(max));

// 元/公噸格式
export const fmtCost = (v) => (v == null || !Number.isFinite(v) ? '—' : `${Math.round(v).toLocaleString('zh-TW')} 元`);
