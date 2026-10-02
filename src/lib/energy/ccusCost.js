// CCUS 成本計算：捕捉均化成本（CcusCostCompare 用）與運輸估價（規劃地圖用）。

export const num = (v) => {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

// 「10~15年」→ 12.5、「5年以上」→ 5、11 → 11
export const parseYears = (v) => {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const m = String(v).match(/(\d+(?:\.\d+)?)\s*[~～\-–]\s*(\d+(?:\.\d+)?)/);
  if (m) return (Number(m[1]) + Number(m[2])) / 2;
  const one = String(v).match(/(\d+(?:\.\d+)?)/);
  return one ? Number(one[1]) : null;
};

export const crf = (r, n) => (r > 0 ? (r * (1 + r) ** n) / ((1 + r) ** n - 1) : 1 / n);

export function financeRows(finance, rate, defaultYears) {
  return finance.map((f) => {
    const a = f.answers || {};
    const scale = num(a['捕捉規模(噸/年)']);
    const capexTotal = num(a['捕捉CAPEX(萬元)']);
    const opexTotal = num(a['捕捉OPEX(萬元/年)']);
    const uCapex = num(a['單位CAPEX(元/噸年產能)']) ?? (capexTotal && scale ? (capexTotal * 1e4) / scale : null);
    const uOpex = num(a['單位OPEX(元/噸)']) ?? num(a['申報OPEX(元/噸)']) ?? (opexTotal && scale ? (opexTotal * 1e4) / scale : null);
    const yearsRaw = a['財務攤提年限'];
    const years = parseYears(yearsRaw) || defaultYears;
    const capexPart = uCapex != null ? uCapex * crf(rate, years) : null;
    const lcoc = capexPart != null || uOpex != null ? (capexPart || 0) + (uOpex || 0) : null;
    const ccfd = num(a['CCfD執行價格(元/噸以上)']);
    const status = [a['捕捉規模(噸/年)'], a['捕捉CAPEX(萬元)']].some((v) => String(v ?? '').includes('評估中')) ? '評估中' : null;
    return {
      key: f.plant_id || f.short_name, name: f.short_name, scale, uCapex, uOpex, years, yearsRaw, usedDefaultYears: !parseYears(yearsRaw),
      capexPart, opexPart: uOpex, lcoc, partial: lcoc != null && (capexPart == null || uOpex == null), ccfd,
      ccfdMode: a['CCfD參考價格模式'], irr: a['IRR門檻'], status, fixed: a['_欄位校正'],
    };
  });
}


// ---------- 運輸估價（案場與管線規劃地圖用） ----------
// 規劃地圖的拓樸（ccsTopology）分成四類路段，各自用可調整的理論單價計算：
//   主幹管線 mainRoutes（flow 噸/年、可拖曳節點的長度 recalcDist）
//   分支管線 branchRoutes（排放源 → 最近節點；量＝該源範疇一）
//   海運 seaRoutes（flow、distance 含控制點）
//   陸運槽車 landRoutes（weight、distance）
// 管線單價有規模效應：單價(USD/噸/100km) = 基準單價 × (Q / 基準量)^(−規模指數)，限制在基準的 0.5–5 倍，
// 基準單價預設取 energy_ref_parameters 的 IEA 2023 值（陸管 3、離岸 4.5 USD/噸/100km，對應基準量 2 百萬噸/年）。
export const TRANSPORT_DEFAULTS = {
  fx: 32,                 // NTD/USD
  pipeLand: 3,            // USD/噸/100km @ 基準量
  pipeOffshore: 4.5,      // USD/噸/100km @ 基準量
  pipeRefMt: 2,           // 基準量（百萬噸/年）
  scaleExp: 0.5,          // 規模指數
  shipBase: 17.5,         // USD/噸（液化、港口裝卸）
  shipPer100km: 1,        // USD/噸/100km
  truckBase: 300,         // 元/噸（裝卸、液化）
  truckPerKm: 8,          // 元/噸/km
};

const dist = (a, b) => {
  const R = 6371;
  const toR = (d) => (Number(d) * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat);
  const dLon = toR(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export function pipeUnitUsd(flowT, base, p) {
  const q = Math.max(1, flowT) / (p.pipeRefMt * 1e6);
  const factor = Math.min(5, Math.max(0.5, q ** -p.scaleExp));
  return base * factor; // USD/噸/100km
}

export function transportCosts(topo, p = TRANSPORT_DEFAULTS) {
  if (!topo) return { rows: [], total: null };
  const rows = [];
  const add = (r) => rows.push({ ...r, ntdPerT: r.usdPerT * p.fx, annualNtd: r.usdPerT * p.fx * r.flowT });
  (topo.mainRoutes || []).forEach((e) => {
    const km = e.recalcDist ? e.recalcDist(e.nodes) : dist(e.from, e.to) * 1.3;
    const unit = pipeUnitUsd(e.flow, p.pipeLand, p);
    add({ id: `m-${e.id}`, kind: '主幹管線', from: e.from.name, to: e.to.name, km, flowT: e.flow, unitUsd100: unit, usdPerT: (unit * km) / 100 });
  });
  (topo.branchRoutes || []).forEach((e, i) => {
    const km = dist(e.from, e.to) * 1.3;
    const flowT = Number(e.from.Scope1) || 0;
    if (!flowT || km < 0.2) return;
    const unit = pipeUnitUsd(flowT, p.pipeLand, p);
    add({ id: `b-${i}`, kind: '分支管線', from: e.from.Plant || e.from.name, to: e.to.name, km, flowT, unitUsd100: unit, usdPerT: (unit * km) / 100 });
  });
  (topo.seaRoutes || []).forEach((e) => {
    const km = e.distance || 0;
    add({ id: `s-${e.id}`, kind: '海運', from: e.from.name, to: e.to.name, km, flowT: e.flow, unitUsd100: p.shipPer100km, usdPerT: p.shipBase + (p.shipPer100km * km) / 100 });
  });
  (topo.landRoutes || []).forEach((e, i) => {
    const km = e.distance || 0;
    const ntd = p.truckBase + p.truckPerKm * km;
    add({ id: `l-${i}`, kind: '陸運槽車', from: e.from.Plant || e.from.name, to: e.to.name, km, flowT: Number(e.weight) || 0, unitUsd100: null, usdPerT: ntd / p.fx });
  });
  const annual = rows.reduce((a, r) => a + r.annualNtd, 0);
  // 每噸「送達封存點」的平均運輸成本：以進入樞紐的總量為分母（同一噸可能走過分支＋主幹＋海運）
  const delivered = Object.values(topo.hubEmissions || {}).reduce((a, v) => a + v, 0); // 已含陸運直送樞紐的量
  return { rows, annual, delivered, avgNtdPerT: delivered ? annual / delivered : null };
}
