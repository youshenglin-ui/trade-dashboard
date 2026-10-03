// ==========================================
// 低碳技術彙編：分類、指標定義（集中一處，前端圖表與 Excel 匯出共用）
// ==========================================
// 純 JS、不依賴瀏覽器，scripts/export-lowcarbon-xlsx.mjs 也直接 import 這支。

// ---------- 四大類（使用者定義，2026-10） ----------
// 順序 = 固定的顏色槽位順序，不要依排名重排。
export const CATEGORIES = ['節能', '燃料', '製程', '其他'];
export const CATEGORY_DESC = {
  節能: '設備或系統效率提升：動力（馬達、泵浦、空壓、鼓風）、冷卻空調、餘熱餘能回收、熱泵、燃燒效率、保溫、能源管理',
  燃料: '燃料轉換與替代：燃煤/重油改天然氣、電氣化、生質與廢棄物衍生燃料（SRF）、氫能',
  製程: '製程技術或原料改變：低浴比染色、靴壓、散漿/磨漿、原料替代、新製程',
  其他: '再生能源、CCUS（碳捕捉再利用）、資源循環與環保設施',
};
// 經 CVD 驗證的類別色（與碳費模組同一組色票）
export const CATEGORY_COLOR = { 節能: '#2a78d6', 燃料: '#eb6834', 製程: '#1baf7a', 其他: '#eda100' };
export const OTHER_COLOR = '#94a3b8';

// 低碳製程技術資料庫的「製程別」→ 四大類 / 子類（技術資料庫的廠商案例納入分析時用）
export const TECHDB_PROCESS_MAP = {
  製程餘熱回收: ['節能', '餘熱餘能回收'],
  製程燃燒系統: ['節能', '燃燒系統'],
  製程熱能系統: ['節能', '熱能系統'],
  製程保溫隔熱: ['節能', '保溫隔熱'],
  製程冷卻系統: ['節能', '冷卻系統'],
  製程動力系統: ['節能', '動力系統'],
  製程監控系統: ['節能', '能源管理'],
  行業製程技術: ['製程', '行業製程技術'],
};

// ---------- 電力排碳係數（經濟部能源署公告，kgCO2e/kWh） ----------
// 各版彙編用的是出版當年可取得的係數（0.554 → 0.474），跨年比較時可換算成同一係數。
export const LATEST_EF = { value: 0.474, label: '113年度電力排碳係數 0.474 kgCO2e/kWh' };

// ---------- 經濟性假設（年化減碳成本） ----------
// 年化減碳成本（元/公噸CO2e）=（投資 × 資本回收因子 − 年效益）÷ 年減碳量；負值代表「減碳同時省錢」。
// 資本回收因子 CRF = r(1+r)^n / ((1+r)^n − 1)，預設折現率 5%、設備壽命 10 年。
export const ECON = { discountRate: 0.05, lifetimeYears: 10 };
export const crf = (r = ECON.discountRate, n = ECON.lifetimeYears) => (r * (1 + r) ** n) / ((1 + r) ** n - 1);

const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

// 年減碳量：原文值；勾選「以最新係數換算」且原文是以電力係數計算時，等比例換算
export function co2Of(c, { normalizeEf = false } = {}) {
  const co2 = num(c.co2_t);
  const ef = num(c.emission_factor);
  if (co2 != null) return normalizeEf && ef ? co2 * (LATEST_EF.value / ef) : co2;
  return null;
}

// 原文沒寫減碳量、但有節電量 → 以最新係數推估（圖表上標示「推估」）
export function co2Estimated(c) {
  const kwh = num(c.electricity_kwh);
  return co2Of(c) == null && kwh != null && kwh > 0 ? (kwh * LATEST_EF.value) / 1000 : null;
}

// 每年每公噸減碳所需的初始投資（萬元 ÷ 公噸/年）＝ 投資強度，越低越划算
export function investPerTon(c, opts) {
  const inv = num(c.investment_wan);
  const co2 = co2Of(c, opts);
  return inv != null && inv > 0 && co2 != null && co2 > 0 ? inv / co2 : null;
}

// 年化減碳成本（元/公噸CO2e）
export function abatementCost(c, opts) {
  const inv = num(c.investment_wan);
  const ben = num(c.benefit_wan);
  const co2 = co2Of(c, opts);
  if (inv == null || ben == null || co2 == null || co2 <= 0) return null;
  return ((inv * crf() - ben) * 1e4) / co2;
}

// 回收年限：原文有寫用原文；沒寫但有投資與年效益時用 投資 ÷ 年效益 推算
export function paybackOf(c) {
  const p = num(c.payback_years);
  if (p != null) return p;
  const inv = num(c.investment_wan);
  const ben = num(c.benefit_wan);
  return inv != null && ben != null && ben > 0 ? inv / ben : null;
}

export const PAYBACK_BUCKETS = [
  { key: 'p1', label: '1 年內', max: 1 },
  { key: 'p2', label: '1~3 年', max: 3 },
  { key: 'p3', label: '3~5 年', max: 5 },
  { key: 'p4', label: '5~10 年', max: 10 },
  { key: 'p5', label: '10 年以上', max: Infinity },
];
export const paybackBucket = (p) => (p == null ? null : PAYBACK_BUCKETS.find((b) => p < b.max)?.key ?? null);

export const median = (arr) => {
  const a = arr.filter((v) => v != null && Number.isFinite(v)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
export const quantile = (arr, q) => {
  const a = arr.filter((v) => v != null && Number.isFinite(v)).sort((x, y) => x - y);
  if (!a.length) return null;
  const pos = (a.length - 1) * q;
  const lo = Math.floor(pos);
  return a[lo] + (a[Math.min(lo + 1, a.length - 1)] - a[lo]) * (pos - lo);
};

// ---------- 格式化 ----------
export const fmtNum = (v, digits = 0) =>
  v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('zh-TW', { maximumFractionDigits: digits });
// 萬元 → 自動換成億元
export const fmtWan = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1e4) return `${(v / 1e4).toLocaleString('zh-TW', { maximumFractionDigits: 2 })} 億元`;
  return `${v.toLocaleString('zh-TW', { maximumFractionDigits: v < 10 ? 1 : 0 })} 萬元`;
};
export const fmtTon = (v) => {
  if (v == null || !Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1e4) return `${(v / 1e4).toLocaleString('zh-TW', { maximumFractionDigits: 1 })} 萬公噸`;
  return `${v.toLocaleString('zh-TW', { maximumFractionDigits: v < 10 ? 1 : 0 })} 公噸`;
};
export const fmtYears = (v) => (v == null || !Number.isFinite(v) ? '—' : `${v < 1 ? v.toFixed(2) : v.toFixed(1)} 年`);
export const rocToAd = (y) => (y ? Number(y) + 1911 : null);
