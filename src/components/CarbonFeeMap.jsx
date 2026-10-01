// ==========================================
// 碳費自主減量計畫：區域分布地圖（依減量措施類別疊圖）
// ==========================================
// 吃 CarbonFeeDashboard 已組裝、已套用篩選的 plans（含 facilities / measures），
// 每個參與事業（facility）依其採取的減量措施類別出現在對應圖層，可勾選疊圖比較各地區採取的手段。
// 位置：優先用 carbonfee_facility_coords 的地址座標（fetchCarbonfee 已併入 facility.lat/lon/coord_source）；
// 沒有座標的事業才放在縣市中心並依管制編號做固定偏移（示意位置）。縣市底色＝事業家數。
import React, { useMemo, useState } from 'react';
import TaiwanLayerMap from './maps/TaiwanLayerMap';
import { countyCentroid, normalizeCounty, useTaiwanCounties } from '../lib/geo/taiwanCounties';
import { regionLabel } from '../lib/energy/energyMetrics';
import { CATEGORY_COLOR, MEASURE_CATEGORIES, OTHER_COLOR, SEQ_BLUE, fmtTon, fmtWan } from '../lib/carbonfeeMetrics';

const SHAPES = ['circle', 'square', 'diamond', 'triangle'];
const NO_MEASURE = '未列措施類別';

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// 座標精度說明（coord_source → 文字）
const COORD_LABEL = {
  manual: '人工校正',
  geocode_address: '地址門牌定位',
  geocode_road: '依路名定位（誤差約數百公尺）',
  geocode_area: '依鄉鎮區定位（僅示意）',
};

function pointOf(counties, facility) {
  if (facility.lat != null && facility.lon != null) return { lat: facility.lat, lon: facility.lon };
  const c = countyCentroid(counties, facility.city);
  if (!c) return null;
  const h = hash(String(facility.control_no || facility.name));
  const ang = (h % 360) * (Math.PI / 180);
  const r = 0.03 + ((h >> 9) % 100) / 100 * 0.1;
  return { lat: c.lat + r * Math.sin(ang), lon: c.lon + r * Math.cos(ang) };
}

export default function CarbonFeeMap({ plans, onSelectPlan }) {
  const counties = useTaiwanCounties();
  const [yearMode, setYearMode] = useState('all');

  const { facilities, years } = useMemo(() => {
    const ys = new Set();
    const list = [];
    plans.forEach((p) => {
      p.measures.forEach((m) => ys.add(m.roc_year));
      p.facilities.forEach((f) => {
        const ms = p.measures.filter((m) => (m.facility_control_no ? m.facility_control_no === f.control_no : true));
        list.push({ plan: p, facility: f, measures: ms });
      });
    });
    return { facilities: list, years: [...ys].sort() };
  }, [plans]);

  const categoriesOf = (x) => {
    const ms = yearMode === 'all' ? x.measures : x.measures.filter((m) => String(m.roc_year) === yearMode);
    const cats = new Set(ms.flatMap((m) => m.categories || []));
    return cats.size ? [...cats] : [NO_MEASURE];
  };

  const layers = (() => {
    const cats = [...MEASURE_CATEGORIES, NO_MEASURE];
    return cats.map((cat, i) => ({
      id: cat,
      label: cat,
      color: CATEGORY_COLOR[cat] || OTHER_COLOR,
      shape: SHAPES[i] || 'hexagon',
      points: facilities.filter((x) => categoriesOf(x).includes(cat)).map((x) => {
        const pt = counties.length ? pointOf(counties, x.facility) : null;
        const ms = x.measures.filter((m) => (m.categories || []).includes(cat));
        return {
          id: `${x.plan.control_no}-${x.facility.control_no}`,
          lat: pt?.lat ?? null,
          lon: pt?.lon ?? null,
          value: x.facility.base_emission,
          valueLabel: fmtTon(x.facility.base_emission),
          title: x.facility.name || x.plan.plan_name,
          subtitle: `${x.facility.city || ''}｜${x.facility.primary_industry || ''}`,
          details: [
            ['計畫', x.plan.plan_name],
            ['管制編號', x.facility.control_no],
            ['地址', x.facility.address],
            ['基準年排放', fmtTon(x.facility.base_emission)],
            ['計畫減量率', x.plan.rate != null ? `${(x.plan.rate * 100).toFixed(1)}%` : null],
            ['此類措施', ms.length ? ms.map((m) => `${m.roc_year}年 ${m.name || m.type_raw || ''}`).slice(0, 6).join('；') + (ms.length > 6 ? `…等 ${ms.length} 項` : '') : null],
            ['位置', COORD_LABEL[x.facility.coord_source] || '縣市中心示意位置（非實際廠址）'],
          ],
          actions: onSelectPlan ? [{ label: '開啟計畫明細', onClick: () => onSelectPlan(x.plan.control_no) }] : [],
        };
      }),
    }));
  })();

  // 縣市彙總：事業家數、基準年排放、各措施類別家數
  const byCounty = (() => {
    const m = new Map();
    facilities.forEach((x) => {
      const county = x.facility.city || '未填';
      const cur = m.get(county) || { county, region: regionLabel(null, county), count: 0, emission: 0, plans: new Set(), cats: Object.fromEntries([...MEASURE_CATEGORIES, NO_MEASURE].map((c) => [c, 0])) };
      cur.count += 1;
      cur.emission += Number(x.facility.base_emission) || 0;
      cur.plans.add(x.plan.control_no);
      categoriesOf(x).forEach((c) => { cur.cats[c] += 1; });
      m.set(county, cur);
    });
    return [...m.values()].sort((a, b) => b.count - a.count);
  })();

  const byRegion = (() => {
    const m = new Map();
    byCounty.forEach((c) => {
      const cur = m.get(c.region) || { region: c.region, count: 0, emission: 0, cats: Object.fromEntries([...MEASURE_CATEGORIES, NO_MEASURE].map((k) => [k, 0])) };
      cur.count += c.count;
      cur.emission += c.emission;
      Object.entries(c.cats).forEach(([k, v]) => { cur.cats[k] += v; });
      m.set(c.region, cur);
    });
    return ['北區', '中區', '南區', '東區', '其他'].map((r) => m.get(r)).filter(Boolean);
  })();

  const maxCount = Math.max(1, ...byCounty.map((c) => c.count));
  const countByName = new Map(byCounty.map((c) => [normalizeCounty(c.county).slice(0, 2), c.count]));
  const countyFill = (name) => {
    const n = countByName.get(name.slice(0, 2));
    if (!n) return '#ffffff';
    return SEQ_BLUE[Math.min(SEQ_BLUE.length - 1, Math.floor((n / maxCount) * 4))];
  };

  const catCols = [...MEASURE_CATEGORIES, NO_MEASURE];
  const located = facilities.filter((x) => x.facility.lat != null).length;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
      <div className="xl:col-span-3">
        <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
          <span className="text-slate-500 font-bold">措施年度</span>
          <select value={yearMode} onChange={(e) => setYearMode(e.target.value)} className="bg-slate-100 border border-slate-200 rounded px-2 py-1 font-bold text-slate-700">
            <option value="all">全部年度</option>
            {years.map((y) => <option key={y} value={String(y)}>{y}年</option>)}
          </select>
          <span className="text-slate-400">點位大小＝基準年排放；縣市底色＝參與事業家數</span>
        </div>
        <TaiwanLayerMap
          layers={layers}
          countyFill={countyFill}
          height="min(640px, 70vh)"
          footnote={`點位依事業地址定位（OpenStreetMap，${located} / ${facilities.length} 家；多數為路名層級，誤差約數百公尺）${located < facilities.length ? '，其餘放在縣市中心示意' : ''}；一個事業採取多類措施時會同時出現在多個圖層。`}
        />
      </div>
      <div className="xl:col-span-2 space-y-3">
        <div className="text-xs font-bold text-slate-600">區域彙總（事業家數；共 {facilities.length} 家）</div>
        <div className="overflow-auto border border-slate-100 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-2 text-left">區域</th>
                <th className="p-2 text-right">家數</th>
                <th className="p-2 text-right">基準年排放(萬噸)</th>
                {catCols.map((c) => <th key={c} className="p-2 text-right whitespace-nowrap" title={c}>{c.slice(0, 4)}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {byRegion.map((r) => (
                <tr key={r.region}>
                  <td className="p-2 font-bold">{r.region}</td>
                  <td className="p-2 text-right font-mono">{r.count}</td>
                  <td className="p-2 text-right font-mono">{fmtWan(r.emission)}</td>
                  {catCols.map((c) => <td key={c} className="p-2 text-right font-mono">{r.cats[c] || '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-xs font-bold text-slate-600">縣市明細（採取該類措施的事業家數）</div>
        <div className="overflow-auto border border-slate-100 rounded-lg max-h-[420px]">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="p-2 text-left">縣市</th>
                <th className="p-2 text-right">家數</th>
                <th className="p-2 text-right">計畫數</th>
                <th className="p-2 text-right">排放(萬噸)</th>
                {catCols.map((c) => (
                  <th key={c} className="p-2 text-right whitespace-nowrap" title={c}>
                    <span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ background: CATEGORY_COLOR[c] || OTHER_COLOR }} />{c.slice(0, 2)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {byCounty.map((c) => (
                <tr key={c.county} className="hover:bg-slate-50">
                  <td className="p-2 font-bold whitespace-nowrap">{c.county}<span className="ml-1 text-[10px] text-slate-400">{c.region}</span></td>
                  <td className="p-2 text-right font-mono">{c.count}</td>
                  <td className="p-2 text-right font-mono">{c.plans.size}</td>
                  <td className="p-2 text-right font-mono">{fmtWan(c.emission)}</td>
                  {catCols.map((k) => <td key={k} className="p-2 text-right font-mono">{c.cats[k] || '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
