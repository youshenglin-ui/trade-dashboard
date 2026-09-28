// ==========================================
// 氫能 / CCUS 指標與資料組裝（純函式，不碰 React / Supabase）
// ==========================================
// 定義集中在這裡：要改「怎麼算」只改這個檔案，圖表都會跟著變。
// 單位：萬噸/年（與問卷整併檔一致）。

export const sum = (rows, key) => rows.reduce((s, r) => s + (Number(typeof key === 'function' ? key(r) : r[key]) || 0), 0);
export const rocToAd = (y) => (y ? Number(y) + 1911 : null);
export const fmtWt = (v, digits = 2) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString('zh-TW', { maximumFractionDigits: digits }));

// 問卷主檔的區域是「北部/中部/南部/東部」，戰情室沿用「北區/中區…」
export function regionLabel(region, county) {
  const s = String(region || county || '');
  if (/北/.test(s) || /(基隆|臺北|台北|新北|桃園|新竹|宜蘭)/.test(s)) return '北區';
  if (/中/.test(s) || /(苗栗|臺中|台中|彰化|南投|雲林)/.test(s)) return '中區';
  if (/南/.test(s) || /(嘉義|臺南|台南|高雄|屏東)/.test(s)) return '南區';
  if (/東/.test(s) || /(花蓮|臺東|台東)/.test(s)) return '東區';
  return '其他';
}

export const plantIndex = (plants) => new Map((plants || []).map((p) => [p.plant_id, p]));

export function paramsByKey(params) {
  return Object.fromEntries((params || []).map((p) => [p.key, p]));
}

// ---------- 氫能 ----------

// 年度選單：用「數據年」（西元），問卷年度 = 數據年 + 1 − 1911
export const h2YearOf = (row) => String(row.data_year ?? rocToAd(row.survey_year) - 1);

// 把問卷事實表組回 HydrogenDashboard 圖表原本吃的形狀（Company/Plant/label/Region/Year/…），
// 這樣既有圖表不用重寫，只是資料來源換成資料庫。
// 外購/外售量來自「外購外售起訖」，以「廠區×年度」加總後掛在該廠區該年度的第一筆製程/用途列上，
// 避免同一廠多個製程時重複計算。
export function toLegacyHydrogen({ plants, production, usage, flows }) {
  const byId = plantIndex(plants);
  const plantInfo = (id, fallbackName) => {
    const p = byId.get(id) || {};
    return {
      PlantId: id,
      Company: p.short_name || fallbackName || id,
      Plant: p.plant_name || '',
      label: p.short_name || fallbackName || id,
      Region: regionLabel(p.region, p.county),
      zone: p.zone || '其他獨立廠區',
      County: p.county || '',
      Latitude: p.lat == null ? null : Number(p.lat),
      Longitude: p.lon == null ? null : Number(p.lon),
    };
  };

  const flowAgg = new Map(); // key: `${direction}|${plantId}|${surveyYear}`
  for (const f of flows || []) {
    if (f.internal_external && f.internal_external !== '外部') continue;
    const k = `${f.direction}|${f.reporter_plant_id}|${f.survey_year}`;
    const cur = flowAgg.get(k) || { volume: 0, parties: new Set(), transports: new Set() };
    cur.volume += Number(f.volume_wt) || 0;
    if (f.counterparty_name || f.counterparty_raw) cur.parties.add(f.counterparty_name || f.counterparty_raw);
    if (f.transport) cur.transports.add(f.transport);
    flowAgg.set(k, cur);
  }
  const takeFlow = (dir, id, sy, seen) => {
    const k = `${dir}|${id}|${sy}`;
    if (seen.has(k)) return null;
    seen.add(k);
    return flowAgg.get(k) || null;
  };

  const seenSupply = new Set();
  const supplyData = (production || []).map((r) => {
    const sold = takeFlow('售出', r.plant_id, r.survey_year, seenSupply);
    return {
      ...plantInfo(r.plant_id, r.short_name),
      Year: h2YearOf(r),
      SurveyYear: r.survey_year,
      Process: r.process_category || r.process_raw || '未分類',
      Process_Raw: r.process_raw,
      Production_Type: r.production_type,
      Carbon_Intensity: Number(r.intensity_used) || 0,
      Output_Tons: Number(r.output_wt) || 0,
      Capacity_Tons: Number(r.max_capacity_wt) || 0,
      Trade_Vol: sold?.volume || 0,
      Trade_Target: sold ? [...sold.parties].join('、') || '未填對象' : '',
      Data_Nature: r.data_nature,
    };
  });

  const seenDemand = new Set();
  const demandData = (usage || []).map((r) => {
    const bought = takeFlow('購入', r.plant_id, r.survey_year, seenDemand);
    return {
      ...plantInfo(r.plant_id, r.short_name),
      Year: h2YearOf(r),
      SurveyYear: r.survey_year,
      Usage_Type: r.usage_subcategory || r.process_raw || '未分類',
      Usage_Category: r.usage_category || '其他',
      Demand_Tons: Number(r.h2_wt) || 0,
      Trade_Vol: bought?.volume || 0,
      Source_Company: bought ? [...bought.parties].join('、') || '未填來源' : '',
      Transport_Method: bought ? [...bought.transports].join('、') : '',
      Data_Nature: r.data_nature,
    };
  });

  // 地圖流向線：直接用起訖表（有明確對象、且兩端都有座標的才畫）
  const flowLines = (flows || [])
    .filter((f) => f.direction === '購入' && (f.internal_external || '外部') === '外部')
    .map((f) => {
      const from = byId.get(f.counterparty_id);
      const to = byId.get(f.reporter_plant_id);
      return {
        Year: String(f.data_year ?? rocToAd(f.survey_year) - 1),
        fromLabel: from?.short_name || f.counterparty_raw || '未明示',
        toLabel: to?.short_name || f.reporter_name,
        from: from?.lat != null ? { lat: Number(from.lat), lon: Number(from.lon), label: from.short_name } : null,
        to: to?.lat != null ? { lat: Number(to.lat), lon: Number(to.lon), label: to.short_name } : null,
        value: Number(f.volume_wt) || 0,
        method: f.transport || '未填',
      };
    })
    .filter((f) => f.from && f.to && f.from.label !== f.to.label);

  return { supplyData, demandData, flowLines };
}

// 參考線：energy_ref_parameters 裡 category = h2_intensity_benchmark / h2_intensity_standard
export function h2IntensityRefs(params) {
  return (params || [])
    .filter((p) => p.category === 'h2_intensity_benchmark' || p.category === 'h2_intensity_standard')
    .map((p) => ({ key: p.key, label: p.label, value: Number(p.value), isStandard: p.category === 'h2_intensity_standard', note: p.note }));
}

// 未來規劃：區間值 → 中點；只有原文沒有數字的保留原文
export function planRangeMid(low, high) {
  const l = low == null ? null : Number(low);
  const h = high == null ? null : Number(high);
  if (l == null && h == null) return null;
  if (l == null) return h;
  if (h == null) return l;
  return (l + h) / 2;
}

// ---------- CCUS ----------

// 問卷計畫別（跨計畫提醒：產發署與環境部屬不同委辦計畫，對外引用需分開呈現）
export const CCUS_PROGRAMS = ['產發署-製造部門', '環境部-CCUS旗艦'];
export const programShort = (p) => (String(p || '').startsWith('環境部') ? '環境部旗艦' : String(p || '').startsWith('產發署') ? '產發署' : p || '—');

// 各年度×計畫別的彙總（對應 CCUS 問卷「總覽」分頁，但由事實表即時計算）
export function ccusSummary({ sources, captures, plans, utilization }) {
  const keys = new Map();
  const bucket = (sy, program) => {
    const k = `${sy}|${programShort(program)}`;
    if (!keys.has(k)) keys.set(k, { survey_year: sy, program: programShort(program), emission: 0, capture: 0, unitEmission: 0, net: 0, planned: 0, ccuDemand: 0 });
    return keys.get(k);
  };
  for (const r of sources || []) bucket(r.survey_year, r.program).emission += Number(r.emission_wt) || 0;
  for (const r of captures || []) {
    const b = bucket(r.survey_year, r.program);
    b.capture += Number(r.capture_wt) || 0;
    b.unitEmission += Number(r.unit_emission_wt) || 0;
    b.net += Number(r.net_capture_wt) || 0;
  }
  for (const r of plans || []) if (r.stage === 'capture' || r.stage === 'ccs') bucket(r.survey_year, r.program).planned += (r.plan_type === 'CCS潛在需求' ? 0 : Number(r.capacity_wt) || 0);
  for (const r of utilization || []) bucket(r.survey_year, r.program).ccuDemand += Number(r.co2_demand_wt) || 0;
  return [...keys.values()].sort((a, b) => a.survey_year - b.survey_year || a.program.localeCompare(b.program));
}

// 點源煙氣條件分級（高濃度製程氣 vs 燃燒後煙道氣），影響捕捉難度與成本
export function concentrationClass(pct) {
  if (pct == null) return { key: 'unknown', label: '濃度未填' };
  if (pct >= 20) return { key: 'high', label: '高濃度製程氣 (≥20%)' };
  if (pct >= 10) return { key: 'mid', label: '中濃度煙道氣 (10–20%)' };
  return { key: 'low', label: '低濃度煙道氣 (<10%)' };
}

// 最新一年的產品均價（元/kg），flow = '進口' | '出口'
export function latestPrice(priceRows, product, flow) {
  const rows = (priceRows || []).filter((r) => r.product === product && r.flow_type === flow && r.unit_price_ntd_per_kg != null);
  if (!rows.length) return null;
  const last = rows.reduce((a, b) => (b.year > a.year ? b : a));
  return { year: last.year, price: Number(last.unit_price_ntd_per_kg), weightKg: Number(last.weight_kg) };
}
