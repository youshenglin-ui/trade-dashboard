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

// ---------- 製程改善細分 ----------
// 環境部只把措施分成四大類，「製程改善」裡面混了原料替代、含氟氣體削減、操作優化、設備汰換等性質差很多的手段。
// 依措施名稱關鍵字再分一層（由上往下比對，先中先贏）；要調整分類只改這個陣列。
export const PROCESS_SUBTYPES = [
  { key: 'fgas', capex: '中', label: '非 CO₂ 溫室氣體削減', desc: '含氟氣體（PFCs、SF6）、N2O 破壞處理設備（Local Scrubber 等）',
    re: /scrubber|含氟|氟化|CF4|C2F6|C3F8|C4F8|PFC|SF6|NF3|N2O|氧化亞氮|尾氣處理|尾氣去除|破壞|防制設備|洗滌塔|R407C|R22|冷媒/i },
  { key: 'feedstock', capex: '低', label: '原料替代／配方調整', desc: '替代原料、熟料替代、廢鋼與碎玻璃比例、低碳原料',
    re: /替代原料|原物料替代|原料替代|熟料|礦物摻料|水泥品種|鈣質原料|石灰石|廢鋼|鐵水|碎玻璃|低碳原料|低碳材料|低排碳|鐵源|碎鐵|配料|焦炭減量|碳粉|冷材|物料轉換|取代C3F8/ },
  { key: 'fuel', capex: '高', label: '燃料轉換／能源回收', desc: '製程內改燒天然氣、沼氣與尾氣回燒取代燃料、廢水轉能',
    re: /改燒天然氣|天然氣.*取代|取代.*燃煤|燃氣機組|燃氣鍋爐|沼氣|尾氣導回|尾氣回收|取代燃料|轉能|油氣兩用|減煤|液化瓦斯/ },
  { key: 'newprocess', capex: '高', label: '新製程／製程改造', desc: '導入新製程或技術、觸媒、製程精簡、燃燒方式與反應路徑改變、碳捕捉',
    re: /新製程|製程開發|製程改造|製程精簡|改造工程|改造案|爐改造|富氧|全氧|純氧|複循環|Bipolar|電解槽|碳捕捉|CO2回收|鋼化聯產|甘油法|裂解反應|觸媒|轉化率|低溫低損材料|淘汰高碳排製程|低排碳煉鋼|雙倍寬|改用大面積|乾式焠火|電磁攪拌|低碳產業轉型|取代糖蜜/i },
  { key: 'heat', capex: '中', label: '熱能回收／節汽', desc: '餘熱、廢熱回收發電（ORC）、熱整合、冷凝水回收、熱泵',
    re: /餘熱|廢熱|熱回收|熱能回收|ORC|熱整合|冷凝水|回收.*蒸汽|蒸汽.*回收|熱泵|預熱|熱值回收|MVR|多效蒸餾|壓降發電|背壓.*發電|熱能整合/ },
  { key: 'operation', capex: '低', label: '操作條件優化', desc: '調降溫度、壓力、汽提比，APC 高階控制、閒置關閉等不需大型投資的改善',
    re: /調降|降低|降溫|降壓|優化|最適化|APC|IDLE|關閉|調整|縮短|減少.*使用|減量|降載|生產條件|操作|智慧化|智能控制|自動化控制/ },
  { key: 'utility', capex: '中', label: '公用設備汰換', desc: '空壓機、冰水主機、冷卻水塔、泵浦、馬達、照明、FFU、鍋爐等公用系統',
    re: /空壓|冰水|冷凍|chiller|冷卻水|泵浦|PUMP|馬達|風扇|風車|鼓風機|真空|LED|燈|Lamp|FFU|鍋爐|變頻|空調|祛水器|變壓器/i },
  { key: 'equipment', capex: '中', label: '生產設備汰換更新', desc: '生產線、窯爐、加熱爐、抄紙機等主要製程設備汰舊換新',
    re: /汰舊換新|汰換|更新|更換|換新|改善工程|新增|增設|設置|安裝|改裝|設備改善|窯爐|高爐|加熱爐|熱風爐|電弧爐/ },
  { key: 'shutdown', capex: '低', label: '產能調整／設備停用', desc: '拆除、停用、除役低效率或高碳排設備',
    re: /拆除|停用|除役|汰除|停止使用|報廢|註銷/ },
];

export function processSubtype(name) {
  const n = String(name || '');
  // 停用、拆除類優先判斷（名稱常同時含「改善」等字）
  const shut = PROCESS_SUBTYPES.find((s) => s.key === 'shutdown');
  if (shut.re.test(n)) return shut.key;
  return PROCESS_SUBTYPES.find((s) => s.key !== 'shutdown' && s.re.test(n))?.key ?? 'other';
}

export const PROCESS_SUBTYPE_LABEL = { ...Object.fromEntries(PROCESS_SUBTYPES.map((s) => [s.key, s.label])), other: '其他製程改善' };

// ---------- 深入分析（CarbonFeeInsights） ----------
// 減量路徑：首年就承諾的減量占全程減量的比例 = (基準 − 首年目標) ÷ (基準 − 目標年目標)。
// 首年 114、目標年 119，若從基準年線性遞減，首年約占 1/6（≈17%）。
export const LINEAR_FIRST_SHARE = 1 / 6;
export function frontShare(plan) {
  const b = plan.total_base_emission;
  const f = plan.total_first_year_target;
  const t = plan.total_target_emission;
  if (b == null || f == null || t == null || !(b > t)) return null;
  return (b - f) / (b - t);
}
export const TRAJECTORY_BUCKETS = [
  { key: 'none', label: '首年未減（後段才減）', test: (s) => s <= 0.02 },
  { key: 'back', label: '後段集中', test: (s) => s < LINEAR_FIRST_SHARE * 0.6 },
  { key: 'linear', label: '接近線性', test: (s) => s <= LINEAR_FIRST_SHARE * 1.6 },
  { key: 'front', label: '前段集中', test: (s) => s < 0.9 },
  { key: 'done', label: '首年即達標', test: () => true },
];
export const trajectoryBucket = (s) => (s == null ? null : TRAJECTORY_BUCKETS.find((b) => b.test(s)).key);

// 措施組合：計畫執行期間曾採用的大類集合（依 MEASURE_CATEGORIES 固定順序）
export const measureCombo = (plan) => MEASURE_CATEGORIES.filter((c) => plan.measures.some((m) => (m.categories || []).includes(c)));
