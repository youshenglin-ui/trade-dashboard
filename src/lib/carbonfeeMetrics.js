// ==========================================
// 碳費自主減量計畫：指標定義（集中一處，之後要改定義只改這裡）
// ==========================================

// 減量率 = (基準年排放 − 目標年指定目標) ÷ 基準年排放
// 用「計畫整體」數字（共同申請 = 各參與事業合計），不是列表頁上代表事業本身的數字。
// 若之後要改成「年均減量率」或「相對首年目標」等定義，改這個函式即可，圖表都會跟著變。
export function reductionAmount(plan) {
  const base = plan.total_base_emission;
  const target = plan.total_target_emission;
  if (base == null || target == null) return null;
  return base - target;
}

export function reductionRate(plan) {
  const amt = reductionAmount(plan);
  const base = plan.total_base_emission;
  if (amt == null || !base) return null;
  return amt / base;
}

// 排放規模分級（與原 Excel 分析一致）
export const SCALE_BUCKETS = [
  { key: 's1', label: '5萬公噸以下', short: '<5萬', max: 5e4 },
  { key: 's2', label: '5~10萬公噸', short: '5-10萬', max: 1e5 },
  { key: 's3', label: '10~30萬公噸', short: '10-30萬', max: 3e5 },
  { key: 's4', label: '30~100萬公噸', short: '30-100萬', max: 1e6 },
  { key: 's5', label: '100~500萬公噸', short: '100-500萬', max: 5e6 },
  { key: 's6', label: '500萬公噸以上', short: '≥500萬', max: Infinity },
];

export function scaleBucket(base) {
  if (base == null) return null;
  return SCALE_BUCKETS.find((b) => base < b.max)?.key ?? null;
}

// 減量措施四大類（順序 = 固定的顏色槽位順序，不要依排名重排）
export const MEASURE_CATEGORIES = ['提升能源效率', '使用再生能源', '製程改善', '轉換低碳燃料'];

export const TIER_LABEL = { A: 'A級・技術標竿', B: 'B級・達成效益' };

// 圖表色票（經 CVD 驗證的類別色，依固定順序指派）
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'];
export const CATEGORY_COLOR = Object.fromEntries(MEASURE_CATEGORIES.map((c, i) => [c, SERIES_COLORS[i]]));
export const TIER_COLOR = { A: SERIES_COLORS[0], B: SERIES_COLORS[1] };
export const OTHER_COLOR = '#94a3b8';
// 熱力圖用的單色藍階（淺 → 深）
export const SEQ_BLUE = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];

export const fmtTon = (v) => {
  if (v == null || Number.isNaN(v)) return '—';
  if (Math.abs(v) >= 1e8) return `${(v / 1e8).toFixed(2)} 億公噸`;
  if (Math.abs(v) >= 1e4) return `${(v / 1e4).toLocaleString('zh-TW', { maximumFractionDigits: 1 })} 萬公噸`;
  return `${Math.round(v).toLocaleString('zh-TW')} 公噸`;
};
export const fmtWan = (v) => (v == null ? '—' : (v / 1e4).toLocaleString('zh-TW', { maximumFractionDigits: 1 }));
export const fmtPct = (v, digits = 1) => (v == null ? '—' : `${(v * 100).toFixed(digits)}%`);
