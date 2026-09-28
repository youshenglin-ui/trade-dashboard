// CCUS 整合地圖的圖層組裝：把問卷資料表轉成 TaiwanLayerMap 的 layers 格式（純函式）。
import { concentrationClass, fmtWt, latestPrice, plantIndex, programShort } from './energyMetrics';
import { CCUS_LAYERS } from './palette';

const inYear = (year) => (r) => year === 'ALL' || r.survey_year === Number(year);
const tt = (v, unit = '萬噸') => (v == null ? '—' : `${fmtWt(v, 3)} ${unit}`);

export function buildCcusLayers(data, { year = 'ALL', onOpenTrade, priceRows = [] } = {}) {
  const byId = plantIndex(data.plants);
  const at = (id) => {
    const p = byId.get(id);
    return p?.lat != null ? { lat: Number(p.lat), lon: Number(p.lon), plant: p } : { lat: null, lon: null, plant: p };
  };
  const hsByProduct = new Map((data.hsMap || []).map((m) => [m.product, m]));
  const f = inYear(year);

  const sources = data.sources.filter(f).map((r) => {
    const { lat, lon, plant } = at(r.plant_id);
    const cls = concentrationClass(r.co2_conc_pct);
    return {
      id: `s${r.id}`, lat, lon, value: r.emission_wt, valueLabel: r.emission_wt != null ? `${fmtWt(r.emission_wt)} 萬噸` : '排放量未填',
      title: `${r.short_name}｜${r.source_desc || '排放源'}`, subtitle: `${r.survey_year}年 ${programShort(r.program)}｜${plant?.zone || r.county || ''}`,
      details: [
        ['排放量', r.emission_wt != null ? `${fmtWt(r.emission_wt)} 萬噸CO₂/年` : '未填'],
        ['溫度', r.temp_raw ? `${r.temp_raw} ℃` : null],
        ['壓力', r.pressure_raw ? `${r.pressure_raw} ${r.pressure_unit || ''}`.trim() : null],
        ['CO₂濃度', r.co2_conc_raw ? `${r.co2_conc_raw} %（${cls.label}）` : null],
        ['期待運輸', r.transport_pref], ['封存需求', r.storage_need], ['備註', r.note],
      ],
    };
  });

  const captures = data.captures.filter(f).map((r) => {
    const { lat, lon, plant } = at(r.plant_id);
    return {
      id: `c${r.id}`, lat, lon, value: r.capture_wt, valueLabel: `捕捉 ${fmtWt(r.capture_wt, 4)} 萬噸`,
      title: `${r.short_name}｜${r.source_process || '捕捉設施'}`, subtitle: `${r.survey_year}年 ${programShort(r.program)}｜${plant?.zone || ''}`,
      details: [
        ['捕捉技術', r.capture_tech], ['捕捉量', tt(r.capture_wt)], ['捕捉單元排放', tt(r.unit_emission_wt)],
        ['淨捕捉量', tt(r.net_capture_wt)], ['CO₂純度', r.purity_raw ? `${r.purity_raw} %` : null],
        ['處理後溫壓', [r.out_temp_raw && `${r.out_temp_raw}℃`, r.out_pressure_raw].filter(Boolean).join('、') || null],
        ['TRL', r.trl], ['運轉狀態', r.operation_status], ['CO₂流向', r.co2_destination], ['備註', r.note],
      ],
    };
  });

  const plans = data.plans.filter(f).filter((r) => r.stage !== 'utilization').map((r) => {
    const { lat, lon } = at(r.plant_id);
    return {
      id: `p${r.id}`, lat, lon, value: r.capacity_wt, valueLabel: r.capacity_wt != null ? `${fmtWt(r.capacity_wt)} 萬噸` : '量能評估中',
      title: `${r.short_name}｜${r.item || r.plan_type}`, subtitle: `${r.survey_year}年 ${programShort(r.program)}｜${r.plan_type || ''}`,
      details: [
        ['類型', r.plan_type], ['新增/擴增', r.new_or_expand], ['預期投入年', r.start_year_raw], ['規劃量能', r.capacity_wt != null ? tt(r.capacity_wt) : '評估中'],
        ['TRL', r.trl], ['去化方式', r.disposal], ['說明/瓶頸', r.note],
      ],
    };
  });

  const utilization = data.utilization.filter(f).map((r) => {
    const { lat, lon } = at(r.plant_id);
    const hs = hsByProduct.get(r.product);
    const imp = hs?.hs_code ? latestPrice(priceRows, r.product, '進口') : null;
    const exp = hs?.hs_code ? latestPrice(priceRows, r.product, '出口') : null;
    return {
      id: `u${r.id}`, lat, lon, value: r.co2_demand_wt, valueLabel: r.co2_demand_wt != null ? `CO₂ ${fmtWt(r.co2_demand_wt)} 萬噸` : '需求未填',
      title: `${r.short_name}｜${r.product}`, subtitle: `${r.survey_year}年 ${programShort(r.program)}｜${r.tech_type || ''}`,
      details: [
        ['產品', r.product], ['CO₂需求/去化', r.co2_demand_wt != null ? tt(r.co2_demand_wt) : '未填'], ['TRL', r.trl],
        ['CO₂來源', r.co2_source], ['流向/客戶', r.destination],
        ['貿易均價(進口)', imp ? `${imp.price.toFixed(1)} 元/kg（${imp.year}）` : null],
        ['貿易均價(出口)', exp ? `${exp.price.toFixed(1)} 元/kg（${exp.year}）` : null],
        ['備註', r.note],
      ],
      actions: hs?.hs_code && onOpenTrade && (imp || exp) ? [{ label: `查看 ${hs.trade_name}（${hs.hs_code}）貿易資訊`, onClick: () => onOpenTrade(hs.hs_code, hs.trade_name) }] : [],
    };
  });

  const storage = data.sites.filter((s) => s.kind === 'storage').map((s) => ({
    id: s.site_id, lat: s.lat == null ? null : Number(s.lat), lon: s.lon == null ? null : Number(s.lon), value: s.capacity_wt,
    valueLabel: s.capacity_raw, title: s.name, subtitle: `${s.site_type || ''}｜${s.status || ''}`,
    details: [['量能', s.capacity_raw], ['啟用年', s.start_year], ['狀態', s.status], ['說明', s.note], ['資料來源', s.source]],
  }));

  const hubs = data.sites.filter((s) => s.kind === 'hub').map((s) => ({
    id: s.site_id, lat: Number(s.lat), lon: Number(s.lon), value: null, title: s.name, subtitle: s.site_type,
    details: [['性質', '管線規劃情境假設（非問卷資料）'], ['說明', s.note]],
  }));

  return [
    { ...CCUS_LAYERS.sources, points: sources },
    { ...CCUS_LAYERS.capture, points: captures },
    { ...CCUS_LAYERS.plans, points: plans },
    { ...CCUS_LAYERS.utilization, points: utilization },
    { ...CCUS_LAYERS.storage, points: storage, fixedRadius: 9 },
    { ...CCUS_LAYERS.hubs, points: hubs, fixedRadius: 5 },
  ];
}
