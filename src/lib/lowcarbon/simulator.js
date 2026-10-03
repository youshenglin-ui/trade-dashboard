// ==========================================
// 企業減碳模式預估：產業／廠區類型、製程節點、措施對應與計算
// ==========================================
// 設計：以「示意基準廠」為底（排放量可自行修改），從低碳技術彙編的實際案例挑選可導入措施，
// 每項措施的減碳量、投資、年效益直接採用案例實績（× 導入套數），再疊加 AI 點／線／面情境。
// 預設排放量與節點占比為量級參考（依產業公開資料粗估），不是特定工廠實績；正式評估需逐廠盤查。
import { LATEST_EF, co2Of, median } from './metrics';

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

// 每減 1 公噸 CO2 約省下的能源成本（元），用在 AI 情境估算年效益
//   電：電價 3.45 元/度 ÷ 電力係數 ≈ 7,300 元/公噸；熱：燃煤約 4,000 元/公噸煤 ÷ 2.4 公噸CO2 ≈ 1,700 元/公噸
export const ENERGY_VALUE_PER_TON = { electricity: 3.45 / (LATEST_EF.value / 1000), fuel: 1700 };

// AI 點／線／面：預設減碳率與投資（可在畫面調整）。依據彙編中 AI 案例實績的量級：
//   點＝單機 AI 最佳化（例：冰水系統 AI 控制節電約 2~17%，台積 F14B、彙編 110 年冷卻篇）
//   線＝產線/系統聯控（例：空壓群控、MAU 機差平衡、冰機 3.0）
//   面＝全廠能源調度（例：中龍轉爐氣智能化輸出、日月光空調供應智能化）
export const AI_LAYERS = [
  { id: 'point', name: '點：設備級 AIoT', short: '點', desc: '單機感測＋AI 參數最佳化與預測維護（冰機、空壓、泵浦、風機）', basis: 'utility', defaultPct: 4, max: 12, invPerPct: 120, color: '#9a90ea' },
  { id: 'line', name: '線：產線／系統級聯控', short: '線', desc: '跨設備聯控與製程參數最佳化（群控、熱整合、配方與排程）', basis: 'process', defaultPct: 3, max: 10, invPerPct: 400, color: '#6d5fd0' },
  { id: 'area', name: '面：全廠能源管理（EMS）', short: '面', desc: '全廠能源調度、需量與蒸汽平衡、碳排即時盤查與預測', basis: 'total', defaultPct: 2, max: 6, invPerPct: 800, color: '#4a3aa7' },
];

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

// 計算：selected = { [measureId]: qty }；ai = { point: pct, line: pct, area: pct }
export function simulate({ plant, emission, measures, selected, ai, feeRate, feeThreshold = 25000 }) {
  const nodes = plant.nodes.map((n) => ({ ...n, base: emission * n.share, cut: 0, raw: 0, inv: 0, benefit: 0, count: 0 }));
  const byNode = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const site = { cut: 0, inv: 0, benefit: 0, count: 0 };
  const cat = { 節能: 0, 燃料: 0, 製程: 0, 其他: 0 };
  let unquantified = 0;
  for (const m of measures) {
    const qty = selected[m.id] || 0;
    if (!qty) continue;
    if (m.co2 == null) { unquantified++; continue; }
    const node = assignNode(plant, m.kind);
    const target = node ? byNode[node.id] : site;
    target.raw = (target.raw || 0) + m.co2 * qty;
    target.inv += (m.inv || 0) * qty;
    target.benefit += (m.benefit || 0) * qty;
    target.count += 1;
    cat[m.c.category] += m.co2 * qty;
  }
  // 節點上限截斷，類別貢獻依比例縮減
  let capped = false;
  let scaleSum = 0;
  let rawSum = 0;
  for (const n of nodes) {
    const cap = n.base * NODE_CAP;
    n.cut = Math.min(n.raw, cap);
    if (n.raw > cap) {
      capped = true;
      // 截斷時投資與效益同比例縮減（相當於只導入可用到的規模）
      n.inv *= cap / n.raw;
      n.benefit *= cap / n.raw;
    }
    scaleSum += n.cut;
    rawSum += n.raw;
  }
  site.cut = Math.min(site.raw || 0, emission * 0.3);
  if ((site.raw || 0) > emission * 0.3) {
    capped = true;
    site.inv *= site.cut / site.raw;
    site.benefit *= site.cut / site.raw;
  }
  scaleSum += site.cut;
  rawSum += site.raw || 0;
  const scale = rawSum ? scaleSum / rawSum : 1;
  for (const k of Object.keys(cat)) cat[k] *= scale;
  const measureCut = scaleSum;

  // AI：以措施後剩餘排放為基礎
  const scope2 = (plant.scope2 ?? 0.5);
  const remain = (n) => n.base - n.cut;
  const utilityRemain = nodes.filter((n) => n.kinds.includes('utility')).reduce((s, n) => s + remain(n), 0);
  const processRemain = nodes.filter((n) => n.kinds.includes('process')).reduce((s, n) => s + remain(n), 0);
  const afterMeasures = emission - measureCut;
  const aiCut = {};
  aiCut.point = (utilityRemain * (ai.point || 0)) / 100;
  aiCut.line = ((processRemain) * (ai.line || 0)) / 100;
  aiCut.area = ((afterMeasures - aiCut.point - aiCut.line) * (ai.area || 0)) / 100;
  const aiTotal = aiCut.point + aiCut.line + aiCut.area;
  const scale100 = emission / 1e5; // AI 投資依廠規模縮放（以 10 萬公噸為 1 單位，規模經濟取 0.8 次方）
  const aiInv = AI_LAYERS.reduce((s, l) => s + (ai[l.id] || 0) * l.invPerPct * Math.max(scale100, 0.1) ** 0.8, 0);
  const valuePerTon = scope2 * ENERGY_VALUE_PER_TON.electricity + (1 - scope2) * ENERGY_VALUE_PER_TON.fuel;
  const aiBenefit = (aiTotal * valuePerTon) / 1e4;

  // AI 分到節點（畫圖用）
  for (const n of nodes) {
    const share = (x, pool) => (pool ? x * (remain(n) / pool) : 0);
    n.aiPoint = n.kinds.includes('utility') ? share(aiCut.point, utilityRemain) : 0;
    n.aiLine = n.kinds.includes('process') ? share(aiCut.line, processRemain) : 0;
    n.aiArea = afterMeasures ? aiCut.area * ((remain(n) - n.aiPoint - n.aiLine) / Math.max(1, afterMeasures - aiCut.point - aiCut.line)) : 0;
    n.after = Math.max(0, n.base - n.cut - n.aiPoint - n.aiLine - n.aiArea);
  }

  const after = Math.max(0, emission - measureCut - aiTotal);
  const inv = nodes.reduce((s, n) => s + n.inv, 0) + site.inv;
  const benefit = nodes.reduce((s, n) => s + n.benefit, 0) + site.benefit;
  const fee = (e) => (Math.max(0, e - feeThreshold) * feeRate) / 1e4;
  const feeSaving = fee(emission) - fee(after);
  const totalInv = inv + aiInv;
  const totalBenefit = benefit + aiBenefit + feeSaving;
  return {
    nodes, site, cat, capped, unquantified, measureCut, aiCut, aiTotal, aiInv, aiBenefit, after,
    inv, benefit, feeBefore: fee(emission), feeAfter: fee(after), feeSaving, totalInv, totalBenefit,
    payback: totalBenefit > 0 ? totalInv / totalBenefit : null, rate: emission ? (emission - after) / emission : 0,
  };
}
