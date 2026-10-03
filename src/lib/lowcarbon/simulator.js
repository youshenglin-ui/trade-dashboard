// ==========================================
// 企業減碳模式預估：產業／廠區類型、製程節點、措施對應與計算
// ==========================================
// 設計：以「示意基準廠」為底（排放量可自行修改），從低碳技術彙編的實際案例挑選可導入措施，
// 每項措施的減碳量、投資、年效益直接採用案例實績（× 導入套數），再疊加 AI 點／線／面情境。
// 預設排放量與節點占比為量級參考（依產業公開資料粗估），不是特定工廠實績；正式評估需逐廠盤查。
import { LATEST_EF, co2Of, median } from './metrics.js';

// 節點類型：process 主製程、thermal 熱能（窯爐、烘乾、蒸汽）、fuel 鍋爐／汽電（燃料）、utility 公用（動力、冷卻、空調、電力）
// visualType 對應 ScadaVisuals 的設備圖示（沿用 EcoRisk SCADA demo）
const N = (id, title, kinds, share, visualType, metrics) => ({ id, title, kinds, share, visualType, metrics });

export const INDUSTRY_PROFILES = [
  {
    id: 'steel', name: '鋼鐵業', caseIndustries: ['鋼鐵業'],
    mechanism: '高爐、轉爐、電弧爐等高溫冶煉為主要排放源；軋鋼加熱爐與大型風機、空壓為次要。減碳路徑以餘熱餘能回收（TRT、CDQ、轉爐氣）、燃料轉換與電爐效率為主。',
    plants: [
      { id: 'bof', name: '一貫作業煉鋼廠', emission: 5000000, scope2: 0.15, nodes: [
        N('ironmaking', '高爐煉鐵／煉焦', ['process', 'thermal'], 0.62, 'blast-furnace', { temp: '1,500°C', input: '焦炭/鐵礦' }),
        N('steelmaking', '轉爐煉鋼', ['process', 'thermal'], 0.14, 'converter-furnace', { temp: '1,650°C', gas: '轉爐氣' }),
        N('rolling', '熱軋／冷軋', ['process', 'thermal', 'fuel'], 0.14, 'rolling-mill', { furnace: '加熱爐', rpm: '1,200' }),
        N('utility', '公用系統（風機、空壓、泵浦）', ['utility'], 0.10, 'chiller', { air: '空壓', fan: '鼓風機' }),
      ] },
      { id: 'eaf', name: '電弧爐煉鋼廠', emission: 300000, scope2: 0.7, nodes: [
        N('eaf', '電弧爐熔煉', ['process'], 0.55, 'converter-furnace', { current: '45kA', temp: '1,650°C' }),
        N('ladle', '精煉／盛鋼桶預熱', ['thermal', 'fuel'], 0.12, 'blast-furnace', { fuel: '天然氣' }),
        N('rolling', '軋鋼加熱爐與軋機', ['process', 'thermal', 'fuel'], 0.23, 'rolling-mill', { furnace: '加熱爐' }),
        N('utility', '公用系統', ['utility'], 0.10, 'chiller', { air: '空壓' }),
      ] },
      { id: 'mill', name: '軋鋼／不鏽鋼加工廠', emission: 150000, scope2: 0.55, nodes: [
        N('furnace', '加熱爐', ['thermal', 'fuel'], 0.40, 'blast-furnace', { temp: '1,200°C' }),
        N('rolling', '軋延機組', ['process'], 0.30, 'rolling-mill', { power: '主馬達' }),
        N('anneal', '退火／酸洗', ['thermal', 'process'], 0.18, 'scrubber', { tube: '輻射管' }),
        N('utility', '公用系統', ['utility'], 0.12, 'chiller', { air: '空壓' }),
      ] },
    ],
  },
  {
    id: 'petchem', name: '石化業', caseIndustries: ['石化業', '塑膠業'],
    mechanism: '裂解爐與蒸餾塔的燃料與蒸汽為最大排放源，大量泵浦、壓縮機與冷卻水塔耗電。減碳以熱整合、熱交換器效率、蒸汽回收發電（ORC、壓差）與 CO2 再利用為主。',
    plants: [
      { id: 'cracker', name: '輕油裂解廠', emission: 2000000, scope2: 0.1, nodes: [
        N('cracking', '裂解爐', ['process', 'thermal', 'fuel'], 0.55, 'converter-furnace', { temp: '850°C', feed: '石腦油' }),
        N('separation', '急冷與分離塔', ['process', 'thermal'], 0.25, 'scrubber', { reflux: '2.4' }),
        N('steam', '蒸汽／汽電系統', ['fuel', 'thermal'], 0.12, 'power-boiler', { steam: '高壓' }),
        N('utility', '公用系統（壓縮機、冷卻水塔）', ['utility'], 0.08, 'chiller', { cw: '冷卻水' }),
      ] },
      { id: 'downstream', name: '中下游石化廠（芳香烴、EG、PP 等）', emission: 400000, scope2: 0.35, nodes: [
        N('reaction', '反應與合成', ['process', 'thermal'], 0.35, 'fab-equipment', { temp: '280°C' }),
        N('distill', '蒸餾與純化', ['thermal', 'process'], 0.30, 'scrubber', { column: '多效' }),
        N('steam', '鍋爐／蒸汽系統', ['fuel', 'thermal'], 0.15, 'power-boiler', { steam: '21K' }),
        N('utility', '公用系統', ['utility'], 0.20, 'chiller', { cw: '冷卻水' }),
      ] },
    ],
  },
  {
    id: 'cement', name: '水泥業', caseIndustries: ['水泥業'],
    mechanism: '石灰石煅燒的製程排放約占六成以上，其次為旋窯燃煤；生料與水泥研磨耗電。減碳以預熱機與冷卻機效率、替代燃料／原料、研磨節電為主。',
    plants: [
      { id: 'kiln', name: '一貫水泥廠（含旋窯）', emission: 1500000, scope2: 0.08, nodes: [
        N('rawmill', '生料研磨', ['process', 'utility'], 0.05, 'grinder', { rpm: '850' }),
        N('kiln', '預熱機與旋窯', ['process', 'thermal', 'fuel'], 0.85, 'rotary-kiln', { temp: '1,450°C' }),
        N('cooler', '熟料冷卻與餘熱發電', ['thermal'], 0.04, 'power-boiler', { whr: '餘熱鍋爐' }),
        N('cementmill', '水泥研磨與公用', ['process', 'utility'], 0.06, 'grinder', { load: '92%' }),
      ] },
      { id: 'grinding', name: '水泥粉磨廠', emission: 60000, scope2: 0.95, nodes: [
        N('mill', '水泥研磨', ['process'], 0.75, 'grinder', { power: '6.6kV' }),
        N('separator', '選粉與輸送', ['process', 'utility'], 0.15, 'chiller', { fan: '選粉機' }),
        N('utility', '公用系統', ['utility'], 0.10, 'ups-grid', { air: '空壓' }),
      ] },
    ],
  },
  {
    id: 'paper', name: '造紙業', caseIndustries: ['造紙業'],
    mechanism: '紙機乾燥部的蒸汽（燃煤／汽電共生）為最大排放源，其次為備漿、真空與傳動用電。減碳以靴壓、烘缸罩與蒸汽熱壓縮、真空系統、鍋爐燃料轉換（SRF、天然氣）、沼氣發電為主。',
    plants: [
      { id: 'printing', name: '文化用紙廠', emission: 250000, scope2: 0.3, nodes: [
        N('stock', '備漿（散漿、篩選、磨漿）', ['process'], 0.12, 'grinder', { rpm: '散漿機' }),
        N('paper', '抄紙（網部、壓榨、真空）', ['process', 'utility'], 0.20, 'rolling-mill', { speed: '700m/min' }),
        N('dryer', '乾燥部（烘缸、氣罩）', ['thermal'], 0.38, 'chiller', { steam: '1.2t/t' }),
        N('boiler', '鍋爐／汽電共生', ['fuel'], 0.22, 'power-boiler', { fuel: '燃煤/SRF' }),
        N('utility', '公用與廢水', ['utility'], 0.08, 'scrubber', { ww: '厭氧' }),
      ] },
      { id: 'board', name: '工業用紙（紙板）廠', emission: 300000, scope2: 0.25, nodes: [
        N('stock', '廢紙備漿', ['process'], 0.15, 'grinder', { pulper: '散漿' }),
        N('paper', '抄紙（網部、壓榨、真空）', ['process', 'utility'], 0.18, 'rolling-mill', { width: '5.6m' }),
        N('dryer', '乾燥部', ['thermal'], 0.35, 'chiller', { steam: '1.5t/t' }),
        N('boiler', '鍋爐／汽電共生', ['fuel'], 0.25, 'power-boiler', { fuel: '燃煤/SRF' }),
        N('utility', '公用與廢水', ['utility'], 0.07, 'scrubber', { biogas: '沼氣' }),
      ] },
      { id: 'tissue', name: '家庭用紙廠', emission: 80000, scope2: 0.45, nodes: [
        N('stock', '備漿', ['process'], 0.15, 'grinder', { refiner: '磨漿' }),
        N('paper', '衛生紙機（靴壓、揚基烘缸）', ['process', 'thermal'], 0.45, 'rolling-mill', { yankee: '揚基' }),
        N('boiler', '鍋爐', ['fuel'], 0.28, 'power-boiler', { fuel: '天然氣' }),
        N('utility', '公用系統', ['utility'], 0.12, 'chiller', { air: '空壓' }),
      ] },
    ],
  },
  {
    id: 'textile', name: '紡織業', caseIndustries: ['紡織業'],
    mechanism: '染整的蒸汽與熱媒（燃煤／重油）及定型機為主要熱能消耗；人纖紡絲與織布以用電為主。減碳以低浴比染色機、定型機餘熱回收、燃料轉換、熱泵與高效動力設備為主。',
    plants: [
      { id: 'fiber', name: '人纖紡絲廠（聚酯、尼龍）', emission: 200000, scope2: 0.6, nodes: [
        N('polymer', '聚合', ['process', 'thermal'], 0.30, 'fab-equipment', { temp: '280°C' }),
        N('spinning', '紡絲與冷卻環吹', ['process', 'utility'], 0.35, 'rolling-mill', { fans: '24台' }),
        N('boiler', '熱媒／蒸汽鍋爐', ['fuel', 'thermal'], 0.20, 'power-boiler', { fuel: '重油/天然氣' }),
        N('utility', '冰水、空壓、空調', ['utility'], 0.15, 'chiller', { rt: '冰機' }),
      ] },
      { id: 'dyeing', name: '染整廠', emission: 60000, scope2: 0.3, nodes: [
        N('dyeing', '染色', ['process', 'thermal'], 0.35, 'scrubber', { ratio: '浴比1:6' }),
        N('stenter', '定型機', ['thermal', 'fuel'], 0.30, 'blast-furnace', { temp: '180°C' }),
        N('boiler', '鍋爐', ['fuel'], 0.25, 'power-boiler', { fuel: '燃煤' }),
        N('utility', '公用系統', ['utility'], 0.10, 'chiller', { fan: '排風機' }),
      ] },
      { id: 'weaving', name: '織布廠', emission: 20000, scope2: 0.85, nodes: [
        N('weaving', '織布機', ['process'], 0.55, 'rolling-mill', { looms: '噴氣織機' }),
        N('hvac', '空調與除塵', ['utility'], 0.30, 'chiller', { humidity: '恆濕' }),
        N('utility', '空壓與照明', ['utility'], 0.15, 'ups-grid', { air: '空壓' }),
      ] },
    ],
  },
  {
    id: 'semi', name: '半導體業', caseIndustries: ['半導體業'],
    mechanism: '外購電力占排放大宗（無塵室空調、冰水、製程機台、UPS），其次為含氟溫室氣體。減碳以冰水系統 AI 最佳化、熱回收、UPS 節能模式、排氣與超純水減量為主。',
    plants: [
      { id: 'fab', name: '晶圓製造廠', emission: 1000000, scope2: 0.75, nodes: [
        N('tools', '製程機台（蝕刻、CVD、黃光）', ['process'], 0.40, 'fab-equipment', { gas: 'CF4/NF3' }),
        N('cleanroom', '無塵室空調與排氣', ['utility', 'thermal'], 0.25, 'cleanroom', { class: 'Class 1' }),
        N('chiller', '冰水與冷卻水系統', ['utility'], 0.20, 'chiller', { rt: '冰機群' }),
        N('power', '電力與 UPS、超純水', ['utility'], 0.15, 'ups-grid', { ups: '340台' }),
      ] },
      { id: 'osat', name: '封裝測試廠', emission: 150000, scope2: 0.9, nodes: [
        N('tools', '封裝製程機台', ['process', 'thermal'], 0.40, 'fab-equipment', { clean: '水洗機' }),
        N('cleanroom', '無塵室空調', ['utility', 'thermal'], 0.30, 'cleanroom', { ffu: 'FFU' }),
        N('chiller', '冰水與空壓', ['utility'], 0.30, 'chiller', { air: '空壓' }),
      ] },
    ],
  },
  {
    id: 'opto', name: '光電業', caseIndustries: ['光電業'],
    mechanism: '面板廠以外購電力為主，無塵室 FFU、空調、冰水、空壓與真空系統占大宗。減碳以低壓損濾網、冰機最佳化、空壓群控、廢熱回收與 AI 空調控制為主。',
    plants: [
      { id: 'panel', name: '面板廠（TFT-LCD）', emission: 600000, scope2: 0.85, nodes: [
        N('array', 'Array／CF 製程', ['process'], 0.35, 'fab-equipment', { line: 'G8.5' }),
        N('cleanroom', '無塵室 FFU 與空調', ['utility', 'thermal'], 0.30, 'cleanroom', { ffu: '37,882台' }),
        N('chiller', '冰水與冷卻水塔', ['utility'], 0.20, 'chiller', { rt: '冰機' }),
        N('utility', '空壓、真空、乾燥機', ['utility'], 0.15, 'ups-grid', { cda: 'CDA' }),
      ] },
    ],
  },
  {
    id: 'glass', name: '玻璃業', caseIndustries: ['玻璃業'],
    mechanism: '熔爐燃料（重油／天然氣）與原料碳酸鹽分解為主要排放。減碳以純氧／富氧燃燒、蓄熱室與保溫、提高回收玻璃使用量、風機變頻為主。',
    plants: [
      { id: 'float', name: '平板玻璃廠', emission: 250000, scope2: 0.25, nodes: [
        N('furnace', '熔爐', ['process', 'thermal', 'fuel'], 0.70, 'blast-furnace', { temp: '1,550°C' }),
        N('tin', '錫槽成型', ['thermal'], 0.10, 'rolling-mill', { seal: '密封' }),
        N('lehr', '退火爐', ['thermal', 'fuel'], 0.08, 'rotary-kiln', { burner: '燃燒器' }),
        N('utility', '風機與公用', ['utility'], 0.12, 'chiller', { fan: '冷卻風機' }),
      ] },
      { id: 'container', name: '容器玻璃廠', emission: 80000, scope2: 0.25, nodes: [
        N('batch', '配料（熟料比例）', ['process'], 0.10, 'grinder', { cullet: '回收玻璃' }),
        N('furnace', '熔爐', ['thermal', 'fuel', 'process'], 0.65, 'blast-furnace', { temp: '1,500°C' }),
        N('lehr', '成型與徐冷爐', ['thermal', 'fuel'], 0.13, 'rotary-kiln', { lehr: '徐冷' }),
        N('utility', '公用系統', ['utility'], 0.12, 'chiller', { air: '空壓' }),
      ] },
      { id: 'fiberglass', name: '玻璃纖維廠', emission: 120000, scope2: 0.3, nodes: [
        N('furnace', '熔爐（純氧燃燒）', ['thermal', 'fuel', 'process'], 0.65, 'blast-furnace', { o2: '純氧' }),
        N('forming', '拉絲成型', ['process'], 0.20, 'rolling-mill', { bushing: '漏板' }),
        N('utility', '公用系統', ['utility'], 0.15, 'chiller', { air: '空壓' }),
      ] },
    ],
  },
];

// 措施（案例子類）→ 節點類型
const SUB_KIND = {
  動力系統: 'utility', 冷卻系統: 'utility', 空調系統: 'utility', 電力與照明: 'utility', 能源管理: 'utility', 熱泵: 'thermal',
  餘熱餘能回收: 'thermal', 熱能系統: 'thermal', 燃燒系統: 'thermal', 保溫隔熱: 'thermal',
  燃料轉換: 'fuel', 替代燃料: 'fuel', 電氣化: 'fuel', 氫能: 'fuel',
};
export const measureKind = (c) => (c.category === '製程' ? 'process' : c.category === '其他' ? 'site' : SUB_KIND[c.subcategory] || 'utility');

// 每減 1 公噸 CO2 約省下的能源成本（元），用在 AI 效益估算
//   電：電價 3.45 元/度 ÷ 電力係數 ≈ 7,300 元/公噸；熱：燃煤約 4,000 元/公噸煤 ÷ 2.4 公噸CO2 ≈ 1,700 元/公噸
export const ENERGY_VALUE_PER_TON = { electricity: 3.45 / (LATEST_EF.value / 1000), fuel: 1700 };

// 各產業流程的投入與產出（流程圖頭尾）
export const PLANT_IO = {
  steel: ['鐵礦砂、焦煤、廢鋼', '鋼胚、鋼捲'], petchem: ['石腦油、原料', '石化中間體'], cement: ['石灰石、黏土', '水泥'],
  paper: ['紙漿、廢紙', '紙捲'], textile: ['原料（PTA、紗）', '布／纖維'], semi: ['晶圓', '晶片'], opto: ['玻璃基板', '面板'],
  glass: ['矽砂、碎玻璃', '玻璃製品'],
};

// ---------- AI 監控與最佳化（三階段，依序疊加） ----------
// 1. AIoT 監控（點）：在個別製程節點裝設感測與 AI 分析（異常偵測、參數最佳化、預測維護）。
// 2. 產線聯控（線）：至少 2 個節點已監控後，跨設備協同（群控、熱整合、排程）。
// 3. 全廠 AI 能源調度（面）：產線聯控後，全廠能源與需量調度、碳排即時盤查。
// 節能幅度依低碳技術彙編 AI 案例的量級設定（冰水 AI 控制 2~17%、空壓群控、MAU 機差平衡、空調智能化），可在畫面調整。
export const AI_STAGES = [
  { id: 'point', name: 'AIoT 監控', short: '監控', layer: '點', color: '#9a90ea', desc: '設備感測＋AI 異常偵測、參數最佳化、預測維護' },
  { id: 'line', name: '產線聯控', short: '聯控', layer: '線', color: '#6d5fd0', desc: '跨設備協同控制：群控、熱整合、配方與排程最佳化' },
  { id: 'area', name: '全廠 AI 能源調度', short: '調度', layer: '面', color: '#4a3aa7', desc: '全廠能源／需量／蒸汽平衡調度與碳排即時盤查' },
];
// 技術導入階段的顏色（與 AI 紫色系區隔）
export const TECH_COLOR = '#1baf7a';
export const DEFAULT_AI_PCT = { utility: 5, thermal: 3, fuel: 3, process: 2, line: 3, area: 2 };
// 節點感測點數（示意）：公用系統設備多、感測點多
export const SENSORS_BY_KIND = { utility: 8, thermal: 6, fuel: 5, process: 6 };
export const SENSOR_TYPES = {
  utility: ['電力', '壓力', '流量', '溫度'], thermal: ['溫度', '蒸汽流量', '煙氣含氧'], fuel: ['燃料流量', '煙氣含氧', '蒸汽壓力'],
  process: ['電力', '溫度', '產量', '品質'],
};
// 未監控時節能措施效益每年衰退（設備劣化、操作偏離設計值）；AIoT 監控可維持
export const MEASURE_DECAY = 0.03;
// 主製程節點的排放有一部分是化學反應（煉鐵還原、石灰石煅燒、含氟氣體），AI 只能改善能源相關的部分
export const PROCESS_AI_SHARE = 0.5;

// 某產業可選的措施：本產業案例 + 跨產業（系統篇）案例；量化不了的列出但不計
// 原文缺投資或年效益者，以同類別（節能/燃料/製程/其他）案例的每公噸中位數推估，並標記 invEst / benefitEst，
// 避免「有效益沒投資」或「有投資沒效益」讓整體回收年限失真
function perTonMedians(cases) {
  const out = {};
  for (const cat of [...new Set(cases.map((c) => c.category))]) {
    const list = cases.filter((c) => c.category === cat);
    const inv = list.map((c) => { const t = co2Of(c, { normalizeEf: true }); return c.investment_wan > 0 && t > 0 ? c.investment_wan / t : null; }).filter((v) => v != null);
    const ben = list.map((c) => { const t = co2Of(c, { normalizeEf: true }); return c.benefit_wan > 0 && t > 0 ? c.benefit_wan / t : null; }).filter((v) => v != null);
    out[cat] = { inv: median(inv), benefit: median(ben) };
  }
  return out;
}

export function measuresFor(profile, cases) {
  const inds = new Set(profile.caseIndustries);
  const latest = cases.filter((c) => c.is_latest !== false);
  const med = perTonMedians(latest);
  return latest.filter((c) => inds.has(c.industry) || c.industry === '跨產業')
    .map((c) => {
      const co2 = co2Of(c, { normalizeEf: true });
      const est = co2 == null && c.electricity_kwh > 0 ? (c.electricity_kwh * LATEST_EF.value) / 1000 : null;
      const t = co2 ?? est;
      const m = med[c.category] || {};
      const hasInv = c.investment_wan > 0;
      const hasBen = c.benefit_wan > 0;
      return {
        id: c.case_id, c, kind: measureKind(c), co2: t, estimated: co2 == null && est != null,
        inv: hasInv ? c.investment_wan : (t && m.inv ? t * m.inv : null), invEst: !hasInv && t != null && m.inv != null,
        benefit: hasBen ? c.benefit_wan : (t && m.benefit ? t * m.benefit : null), benefitEst: !hasBen && t != null && m.benefit != null,
        crossIndustry: !inds.has(c.industry),
      };
    });
}

export function assignNode(plant, kind) {
  if (kind === 'site') return null;
  return plant.nodes.find((n) => n.kinds[0] === kind) || plant.nodes.find((n) => n.kinds.includes(kind)) || plant.nodes[plant.nodes.length - 1];
}

const NODE_CAP = 0.6; // 單一節點的措施減碳量上限：該節點排放的 60%（避免案例實績直接加總超過工廠規模）
const nodeValuePerTon = (n, scope2) => (n.kinds[0] === 'utility' ? ENERGY_VALUE_PER_TON.electricity
  : n.kinds[0] === 'process' ? scope2 * ENERGY_VALUE_PER_TON.electricity + (1 - scope2) * ENERGY_VALUE_PER_TON.fuel
    : ENERGY_VALUE_PER_TON.fuel);
const crf10 = (0.05 * 1.05 ** 10) / (1.05 ** 10 - 1);

// 模擬：selected = { [measureId]: 套數 }；aiot = { [nodeId]: true }；line / area = 是否啟用
export function simulateFactory({
  plant, emission, measures, selected, aiot = {}, line = false, area = false, pct = DEFAULT_AI_PCT, feeRate = 300, feeThreshold = 25000,
}) {
  const scope2 = plant.scope2 ?? 0.5;
  const nodes = plant.nodes.map((n) => ({ ...n, base: emission * n.share, raw: 0, cut: 0, inv: 0, benefit: 0, items: [] }));
  const byNode = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const site = { id: 'site', base: emission, raw: 0, cut: 0, inv: 0, benefit: 0, items: [] };
  let unquantified = 0;
  for (const m of measures) {
    const qty = selected[m.id] || 0;
    if (!qty) continue;
    if (m.co2 == null) { unquantified++; continue; }
    const node = assignNode(plant, m.kind);
    const t = node ? byNode[node.id] : site;
    t.raw += m.co2 * qty;
    t.inv += (m.inv || 0) * qty;
    t.benefit += (m.benefit || 0) * qty;
    t.items.push({ m, qty, co2: m.co2 * qty, inv: (m.inv || 0) * qty, benefit: (m.benefit || 0) * qty });
  }
  let capped = false;
  for (const t of [...nodes, site]) {
    const cap = t === site ? emission * 0.3 : t.base * NODE_CAP;
    t.cut = Math.min(t.raw, cap);
    if (t.raw > cap) {
      capped = true;
      const k = cap / t.raw;
      t.inv *= k;
      t.benefit *= k;
      for (const it of t.items) { it.co2 *= k; it.inv *= k; it.benefit *= k; }
    }
  }
  const techCut = nodes.reduce((s, n) => s + n.cut, 0) + site.cut;

  // AI 三階段
  const monitored = nodes.filter((n) => aiot[n.id]);
  const lineOn = line && monitored.length >= 2;
  const areaOn = area && lineOn;
  const scale = Math.max(emission / 1e5, 0.1) ** 0.85;
  for (const n of nodes) {
    const remain = n.base - n.cut;
    n.monitored = !!aiot[n.id];
    n.sensors = n.monitored ? SENSORS_BY_KIND[n.kinds[0]] || 5 : 0;
    const f = n.kinds[0] === 'process' ? PROCESS_AI_SHARE : 1;
    n.aiPoint = n.monitored ? (remain * f * (pct[n.kinds[0]] ?? 2)) / 100 : 0;
    n.aiLine = lineOn && n.monitored && (n.kinds.includes('process') || n.kinds.includes('thermal')) ? ((remain - n.aiPoint) * f * pct.line) / 100 : 0;
    n.aiArea = areaOn ? ((remain - n.aiPoint - n.aiLine) * f * pct.area) / 100 : 0;
    // 投資（萬元）：感測、邊緣運算、AI 模型導入；依節點規模放大
    n.aiInvPoint = n.monitored ? 60 + 60 * (n.base / 1e4) ** 0.85 : 0;
    n.after = Math.max(0, n.base - n.cut - n.aiPoint - n.aiLine - n.aiArea);
    n.valuePerTon = nodeValuePerTon(n, scope2);
  }
  const sum = (f) => nodes.reduce((s, n) => s + f(n), 0);
  const ai = {
    point: { cut: sum((n) => n.aiPoint), inv: sum((n) => n.aiInvPoint), benefit: sum((n) => n.aiPoint * n.valuePerTon) / 1e4 },
    line: { cut: sum((n) => n.aiLine), inv: lineOn ? Math.max(200, 500 * scale) : 0, benefit: sum((n) => n.aiLine * n.valuePerTon) / 1e4 },
    area: { cut: sum((n) => n.aiArea), inv: areaOn ? Math.max(400, 1000 * scale) : 0, benefit: sum((n) => n.aiArea * n.valuePerTon) / 1e4 },
  };
  const aiCut = ai.point.cut + ai.line.cut + ai.area.cut;
  const aiInv = ai.point.inv + ai.line.inv + ai.area.inv;
  const aiBenefit = ai.point.benefit + ai.line.benefit + ai.area.benefit;
  const techInv = sum((n) => n.inv) + site.inv;
  const techBenefit = sum((n) => n.benefit) + site.benefit;
  // 監控節點上的措施效益不衰退 → AI 的「效益維持」價值（以 10 年平均計）
  const monitoredTechBenefit = monitored.reduce((s, n) => s + n.benefit, 0);
  const monitoredTechCut = monitored.reduce((s, n) => s + n.cut, 0);
  const avgDecayLoss = 1 - (1 - (1 - MEASURE_DECAY) ** 10) / (10 * MEASURE_DECAY); // 10 年平均衰退比例
  const persistCut = monitoredTechCut * avgDecayLoss;

  const stages = [
    { id: 'base', label: '基準排放', emission },
    { id: 'tech', label: '導入減碳技術', emission: emission - techCut, cut: techCut, inv: techInv },
    { id: 'point', label: '＋AIoT 監控', emission: emission - techCut - ai.point.cut, cut: ai.point.cut, inv: ai.point.inv },
    { id: 'line', label: '＋產線聯控', emission: emission - techCut - ai.point.cut - ai.line.cut, cut: ai.line.cut, inv: ai.line.inv },
    { id: 'area', label: '＋全廠調度', emission: emission - techCut - aiCut, cut: ai.area.cut, inv: ai.area.inv },
  ];
  const after = Math.max(0, emission - techCut - aiCut);
  const fee = (e) => (Math.max(0, e - feeThreshold) * feeRate) / 1e4;
  const feeSavingTech = fee(emission) - fee(emission - techCut);
  const feeSaving = fee(emission) - fee(after);
  const totalInv = techInv + aiInv;
  const totalBenefit = techBenefit + aiBenefit + feeSaving;

  // 10 年累計現金流（萬元）：僅技術（效益逐年衰退） vs 技術＋AI（監控節點不衰退）
  const cash = [{ year: 0, tech: -techInv, techAi: -totalInv }];
  for (let y = 1; y <= 10; y++) {
    const d = (1 - MEASURE_DECAY) ** (y - 1);
    const tech = (techBenefit + feeSavingTech) * d;
    const unmon = techBenefit - monitoredTechBenefit;
    const techAi = monitoredTechBenefit + unmon * d + aiBenefit + feeSaving - (feeSavingTech * (1 - d) * (techCut ? (techCut - monitoredTechCut) / techCut : 0));
    cash.push({ year: y, tech: cash[y - 1].tech + tech, techAi: cash[y - 1].techAi + techAi });
  }
  const lcoa = (inv, ben, cut) => (cut > 0 ? ((inv * crf10 - ben) * 1e4) / cut : null);

  return {
    nodes, site, capped, unquantified, techCut, techInv, techBenefit, ai, aiCut, aiInv, aiBenefit, monitored: monitored.length,
    lineOn, areaOn, sensors: sum((n) => n.sensors), persistCut, stages, after, feeBefore: fee(emission), feeAfter: fee(after), feeSaving,
    totalInv, totalBenefit, payback: totalBenefit > 0 ? totalInv / totalBenefit : null, rate: emission ? (emission - after) / emission : 0,
    techPayback: techBenefit + feeSavingTech > 0 ? techInv / (techBenefit + feeSavingTech) : null,
    lcoaTech: lcoa(techInv, techBenefit, techCut), lcoaAi: lcoa(aiInv, aiBenefit, aiCut), lcoaAll: lcoa(totalInv, techBenefit + aiBenefit, techCut + aiCut),
    amortAll: techCut + aiCut > 0 ? (totalInv * crf10 * 1e4) / (techCut + aiCut) : null,
    cash,
  };
}
