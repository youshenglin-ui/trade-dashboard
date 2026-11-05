// ==========================================
// CCUS 第二次調查（115.09.24 發放）整合到既有分頁的區塊
// ==========================================
// - 碳捕捉頁：R2FlueGasCard（主要排放單元煙道氣性質，代碼區間）
// - 碳封存頁：HubSupplySection（CCS Hub 潛在供給區域：廠商、排放、可投入量、成本與自付意願；與第一次調查耦合）
// - 人才供需頁：CcusTalentView（第一次＋第二次人力調查：人才缺口與職缺種類）
// 資料：src/lib/energy/ccusRound2.js（Supabase ccus_r2_*）；第一次調查來自 survey_answers。
import React, { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Factory, GraduationCap, Handshake, MapPin, Users } from 'lucide-react';
import TaiwanLayerMap from '../maps/TaiwanLayerMap';
import { buildCcusLayers } from '../../lib/energy/ccusLayers';
import { Badge, Card, DataTable, ErrorBlock, Kpi, LoadingBlock } from './ui';
import {
  BASIS_CODES, CAPTURE_ORDER, CAPTURE_RANGE, CONC_CODES, COST_BANDS, EMISSION_CODES, SHARE_VALUE, STAGES,
  TEMP_CODES, TIMING_ORDER, UNIT_CODES, countBy, fetchCcusRound2,
} from '../../lib/energy/ccusRound2';

const AXIS_TICK = { fontSize: 12, fill: '#64748b' };
const R1 = '#94a3b8';
const R2 = '#0f766e';
const isScan = (r) => (r.comment || '').includes('掃描檔');
const ScanBadge = ({ r }) => (isScan(r) ? <Badge tone="amber" title="掃描 PDF 回覆，勾選辨識不完整">待確認</Badge> : null);
// 公司名稱模糊比對（第一次調查用簡稱，第二次用全名）
const norm = (s) => String(s || '').replace(/股份有限公司|有限公司|公司|（.*?）|\(.*?\)|工業|股份有公司/g, '').replace('台塑化', '台塑石化').replace('中國鋼鐵', '中鋼').trim();
const sameCo = (a, b) => { const x = norm(a); const y = norm(b); return !!x && !!y && (x.includes(y) || y.includes(x)); };

export function useCcusRound2() {
  const [state, setState] = useState({ data: null, error: null });
  useEffect(() => { fetchCcusRound2().then((data) => setState({ data, error: null })).catch((e) => setState({ data: null, error: e.message })); }, []);
  return state;
}

function HBar({ data, height, color = R2, unit = '家' }) {
  return (
    <div style={{ height: height || Math.max(140, data.length * 32 + 30) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} />
          <YAxis type="category" dataKey="name" width={130} tick={AXIS_TICK} interval={0} />
          <Tooltip formatter={(v) => [`${v} ${unit}`, '']} />
          <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const shareCell = (v) => {
  if (!v) return <span className="text-slate-300">—</span>;
  const n = SHARE_VALUE[v] ?? 0;
  const bg = n === 0 ? 'bg-slate-100 text-slate-500' : n >= 75 ? 'bg-emerald-600 text-white' : n >= 50 ? 'bg-emerald-400 text-white' : 'bg-emerald-100 text-emerald-800';
  return <span className={`inline-block min-w-[48px] text-center px-1.5 py-0.5 rounded text-xs font-bold ${bg}`}>{v}</span>;
};

const R2Note = () => <p className="text-[11px] text-slate-500">第二次調查：115.09.24 發放、10 月回收（環境部 CCUS 旗艦）。個別廠資料僅供內部規劃，對外請去識別化；標「待確認」者為掃描檔，勾選未完整辨識。</p>;

// ------------------------------------------
// 碳捕捉頁：主要排放單元煙道氣性質
// ------------------------------------------
export function R2FlueGasCard() {
  const { data, error } = useCcusRound2();
  if (error) return <ErrorBlock message={error} />;
  if (!data) return <LoadingBlock text="讀取第二次調查…" />;
  const byKey = new Map(data.plants.map((p) => [p.plant_key, p]));
  const rows = data.units.map((u) => ({ ...u, p: byKey.get(u.plant_key) }));
  return (
    <Card title="第二次調查：主要排放單元煙道氣性質（代碼區間）" icon={Factory}
      subtitle="補充第一次調查的實測溫壓濃度：第二次以勾選區間回覆，涵蓋更多廠區。CO₂ 濃度越高、溫度越低，捕捉成本越低。">
      <div className="grid md:grid-cols-3 gap-4 mb-3">
        <div><div className="text-xs font-bold text-slate-600 mb-1">排放單元類型</div><HBar data={countBy(rows, (u) => UNIT_CODES[u.unit_code])} unit="單元" /></div>
        <div><div className="text-xs font-bold text-slate-600 mb-1">CO₂ 濃度</div><HBar data={countBy(rows, (u) => CONC_CODES[u.conc_code] || '未填', [...Object.values(CONC_CODES), '未填'])} unit="單元" color="#b45309" /></div>
        <div><div className="text-xs font-bold text-slate-600 mb-1">煙氣溫度</div><HBar data={countBy(rows, (u) => TEMP_CODES[u.temp_code] || '未填', [...Object.values(TEMP_CODES), '未填'])} unit="單元" color="#7c3aed" /></div>
      </div>
      <DataTable rows={rows} rowKey={(r) => r.id} maxHeight={320} columns={[
        { key: 'co', label: '廠區', sortValue: (r) => r.p?.company, render: (r) => <span className="font-bold">{r.p?.company}<span className="font-normal text-slate-400">｜{r.p?.plant}</span> <ScanBadge r={r.p || {}} /></span> },
        { key: 'unit_code', label: '排放單元', render: (r) => `${UNIT_CODES[r.unit_code] || r.unit_code}${r.unit_note ? `（${r.unit_note}）` : ''}` },
        { key: 'emission_code', label: '年排放', render: (r) => EMISSION_CODES[r.emission_code] || '—' },
        { key: 'conc_code', label: 'CO₂濃度', render: (r) => CONC_CODES[r.conc_code] || '—' },
        { key: 'temp_code', label: '溫度', render: (r) => TEMP_CODES[r.temp_code] || '—' },
        { key: 'pressure_code', label: '壓力', render: (r) => ({ 1: '常壓', 2: '加壓' }[r.pressure_code] || '—') },
        { key: 'basis_code', label: '依據', render: (r) => BASIS_CODES[r.basis_code] || '—' },
      ]} />
      <div className="mt-2"><R2Note /></div>
    </Card>
  );
}

// ------------------------------------------
// 碳封存頁：CCS Hub 潛在供給區域（第一次＋第二次）
// ------------------------------------------
const REGIONS = ['北部', '中部', '南部', '東部'];
const REGION_ROUTE = {
  北部: '管線送鐵砧山；桃園等較遠者經台北港船運或管線至台中',
  中部: '管線直送台中港內側／麥寮外海／鐵砧山',
  南部: '高雄港船運北送',
  東部: '花蓮港（或蘇澳港）集運，船運至台中港',
};
const R1_BARRIER = { '障礙：缺乏基礎設施': '運輸暫存設施', '障礙：缺乏去化路徑': '封存去化路徑', '障礙：投資成本過高': '成本過高' };
const BARRIERS = ['成本過高', '運輸暫存設施', '封存去化路徑', '廠區空間不足', '法規未明'];
const rangeOf = (rows) => rows.reduce((a, p) => { const r = CAPTURE_RANGE[p.capture_volume]; return r ? [a[0] + r[0], a[1] + r[1]] : a; }, [0, 0]);

export function HubSupplySection({ data: r1 }) {
  const { data, error } = useCcusRound2();
  const [region, setRegion] = useState('ALL');
  const willingness = useMemo(() => (r1.answers || []).filter((a) => a.sheet === '意願與障礙' && a.section?.startsWith('旗艦')), [r1.answers]);
  const finance = useMemo(() => (r1.answers || []).filter((a) => a.sheet === '成本與財務'), [r1.answers]);
  if (error) return <ErrorBlock message={error} />;
  if (!data) return <LoadingBlock text="讀取第二次調查…" />;
  const plants = data.plants;
  const shown = region === 'ALL' ? plants : plants.filter((p) => p.region === region);

  // 地圖：封存場址＋樞紐＋第二次調查潛在供給廠區（點大小＝可投入量區間上限）
  const base = buildCcusLayers(r1).filter((l) => ['storage', 'hubs'].includes(l.id));
  const supplyLayer = {
    id: 'r2supply', label: '潛在供給廠區（第二次調查）', color: '#eb6834', shape: 'triangle',
    points: plants.map((p) => {
      const r = CAPTURE_RANGE[p.capture_volume];
      return {
        id: p.plant_key, lat: Number(p.lat), lon: Number(p.lon), value: r ? r[1] : 1,
        valueLabel: p.capture_volume || '可投入量未填', title: `${p.company}｜${p.plant}`, subtitle: `${p.region}・${p.industry}`,
        details: [
          ['113年範疇一', p.scope1_wan_t != null ? `${Number(p.scope1_wan_t).toLocaleString()} 萬噸` : null],
          ['可投入量', p.capture_volume], ['開始投入', p.start_timing], ['交接方式', p.handover], ['運輸偏好', p.transport_pref],
          ['捕捉成本預估', p.cost_estimate ? `${p.cost_estimate} 元/噸` : null], ['集運路徑', REGION_ROUTE[p.region]], ['意見', p.comment],
        ],
      };
    }),
  };

  const regionRows = REGIONS.map((rg) => {
    const ps = plants.filter((p) => p.region === rg);
    const [lo, hi] = rangeOf(ps);
    const r1n = willingness.filter((w) => plants.some((p) => p.region === rg && sameCo(p.company, w.answers?.簡稱))).length;
    return {
      region: rg, n: ps.length, scope1: ps.reduce((s, p) => s + (Number(p.scope1_wan_t) || 0), 0), lo, hi,
      early: ps.filter((p) => ['2030年前', '2030–2035年'].includes(p.start_timing)).length,
      willing: ps.filter((p) => COST_BANDS.some((b) => SHARE_VALUE[p[b.key]] > 0)).length,
      inds: [...new Set(ps.map((p) => p.industry))].join('、'), route: REGION_ROUTE[rg], r1n,
    };
  }).filter((r) => r.n);
  const [tlo, thi] = rangeOf(plants);

  const wtp = COST_BANDS.map((b) => {
    const ans = shown.filter((p) => p[b.key]);
    const vals = ans.map((p) => SHARE_VALUE[p[b.key]] ?? 0);
    return { name: b.label, 平均自付比例: ans.length ? Math.round(vals.reduce((a, c) => a + c, 0) / ans.length) : 0, n: ans.length, yes: vals.filter((v) => v > 0).length };
  });

  const barrierCmp = BARRIERS.map((b) => ({
    name: b,
    第一次: willingness.length ? Math.round((100 * willingness.filter((w) => Object.entries(R1_BARRIER).some(([k, v]) => v === b && w.answers?.[k] === '✓')).length) / willingness.length) : 0,
    第二次: Math.round((100 * plants.filter((p) => (p.barriers || []).includes(b)).length) / plants.length),
  }));

  // 第一次 → 第二次 對照（同一公司兩次都有回覆）
  const linked = plants.map((p) => {
    const w = willingness.find((x) => sameCo(p.company, x.answers?.簡稱) || sameCo(p.company, x.company));
    const f = finance.find((x) => sameCo(p.company, x.answers?.簡稱) || sameCo(p.company, x.company));
    return w || f ? { p, w: w?.answers, f: f?.answers } : null;
  }).filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-black text-slate-800 text-lg flex items-center gap-2"><MapPin size={18} className="text-orange-600" />CCS Hub 潛在供給區域</h3>
        <div className="seg">
          {['ALL', ...REGIONS].map((r) => <button key={r} type="button" onClick={() => setRegion(r)} className={`seg-btn ${region === r ? 'seg-btn-on' : ''}`}>{r === 'ALL' ? '全部區域' : r}</button>)}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="潛在供給廠區" value={shown.length} unit="廠" note={region === 'ALL' ? `第二次調查回收；第一次旗艦問卷 ${willingness.length} 份` : REGION_ROUTE[region]} />
        <Kpi label="可投入 CO₂（勾選區間）" value={region === 'ALL' ? `${tlo}–${thi}` : `${rangeOf(shown)[0]}–${rangeOf(shown)[1]}`} unit="萬噸/年" note="≥100 萬噸以 100 計；未填者不計" />
        <Kpi label="113 年範疇一合計" value={Math.round(shown.reduce((s, p) => s + (Number(p.scope1_wan_t) || 0), 0)).toLocaleString()} unit="萬噸" note="廠商自填，誤填單位已校正" />
        <Kpi label="2035 年前可投入" value={shown.filter((p) => ['2030年前', '2030–2035年'].includes(p.start_timing)).length} unit="廠" note={`2035 年後 ${shown.filter((p) => p.start_timing === '2035年後').length} 廠`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <Card className="xl:col-span-2" title="潛在供給 × 封存場址" subtitle="三角形＝第二次調查廠區（大小＝可投入量區間上限，座標依問卷廠址概略定位）">
          <TaiwanLayerMap layers={[supplyLayer, ...base]} defaultActive={['r2supply', 'storage', 'hubs']} height="min(520px, 65vh)" />
        </Card>
        <Card className="xl:col-span-3" title="分區彙總：廠商、碳排放與集運路徑" subtitle="集運路徑依問卷所附「目前封存場址規劃」說明（台中港內側、麥寮外海、苗栗鐵砧山）。">
          <DataTable rows={regionRows} rowKey={(r) => r.region} columns={[
            { key: 'region', label: '區域', className: 'font-bold' },
            { key: 'n', label: '廠區', align: 'right' },
            { key: 'inds', label: '產業' },
            { key: 'scope1', label: '範疇一(萬噸)', align: 'right', render: (r) => Math.round(r.scope1).toLocaleString() },
            { key: 'hi', label: '可投入(萬噸/年)', align: 'right', render: (r) => `${r.lo}–${r.hi}` },
            { key: 'early', label: '2035前', align: 'right' },
            { key: 'willing', label: '有自付意願', align: 'right' },
            { key: 'route', label: '集運路徑', render: (r) => <span className="text-[11px] text-slate-600">{r.route}</span> },
          ]} />
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div><div className="text-xs font-bold text-slate-600 mb-1">可投入量</div><HBar data={countBy(shown, (p) => p.capture_volume || '未填', [...CAPTURE_ORDER, '未填'])} /></div>
            <div><div className="text-xs font-bold text-slate-600 mb-1">開始投入時程</div><HBar data={countBy(shown, (p) => p.start_timing || '未填', [...TIMING_ORDER, '未填'])} /></div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="捕捉成本 vs 自行負擔意願" icon={Handshake}
          subtitle="運輸封存由政府／樞紐負責時，各成本區間作答廠區的平均自付比例（不參與計 0%）。參考：碳費一般費率 300 元/噸；試驗型捕捉約 2,800–3,500 元/噸。">
          <div style={{ height: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={wtp} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={AXIS_TICK} interval={0} />
                <YAxis tick={AXIS_TICK} unit="%" domain={[0, 100]} />
                <Tooltip formatter={(v, k, { payload }) => [`${v}%（${payload.yes}/${payload.n} 廠願負擔）`, k]} />
                <Bar dataKey="平均自付比例" fill={R2} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-xs font-bold text-slate-600 mt-2 mb-1">捕捉成本預估（第二次）</div>
          <HBar data={countBy(shown, (p) => (p.cost_estimate ? `${p.cost_estimate} 元/噸` : '未填'))} color="#7c3aed" height={150} />
        </Card>
        <Card title="推動障礙：第一次 vs 第二次（勾選比例）" subtitle={`第一次旗艦問卷 ${willingness.length} 份、第二次 ${plants.length} 廠；第二次可複選並新增「廠區空間不足」「法規未明」選項。`}>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barrierCmp} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" unit="%" domain={[0, 100]} tick={AXIS_TICK} />
                <YAxis type="category" dataKey="name" width={100} tick={AXIS_TICK} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend />
                <Bar dataKey="第一次" fill={R1} barSize={10} />
                <Bar dataKey="第二次" fill={R2} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="廠區明細：排放、可投入量與各成本區間自付意願" subtitle="依區域篩選；點欄位標題排序。">
        <DataTable rows={shown} rowKey={(r) => r.plant_key} maxHeight={520} initialSort={{ key: 'scope1_wan_t', dir: 'desc' }} columns={[
          { key: 'company', label: '公司／廠區', render: (r) => <div><div className="font-bold">{r.company} <ScanBadge r={r} /></div><div className="text-[11px] text-slate-500">{r.plant}・{r.county}・{r.industry}</div></div> },
          { key: 'scope1_wan_t', label: '範疇一(萬噸)', align: 'right', sortValue: (r) => (r.scope1_wan_t == null ? null : Number(r.scope1_wan_t)), render: (r) => (r.scope1_wan_t != null ? Number(r.scope1_wan_t).toLocaleString() : '—') },
          { key: 'capture_volume', label: '可投入量', sortValue: (r) => CAPTURE_ORDER.indexOf(r.capture_volume) },
          { key: 'start_timing', label: '時程' },
          { key: 'handover', label: '交接方式' },
          { key: 'cost_estimate', label: '成本預估' },
          ...COST_BANDS.map((b) => ({ key: b.key, label: b.label, align: 'center', render: (r) => shareCell(r[b.key]), sortValue: (r) => SHARE_VALUE[r[b.key]] ?? -1 })),
          { key: 'comment', label: '意見', render: (r) => <span className="text-[11px] text-slate-600">{r.comment}</span> },
        ]} />
      </Card>

      {linked.length > 0 && (
        <Card title="兩次調查對照（同一公司）" subtitle="第一次（115 上半年旗艦問卷）的 Hub 意願與成本，對照第二次的可投入量與自付意願。">
          <DataTable rows={linked} rowKey={(r) => r.p.plant_key} columns={[
            { key: 'co', label: '廠區', render: (r) => <span className="font-bold">{r.p.company}｜{r.p.plant}</span> },
            { key: 'hub1', label: '第一次：Hub 意願／連結模式', render: (r) => <span className="text-[11px]">{[r.w?.['CCS Hub意願'], r.w?.['Hub連結模式']].filter(Boolean).join('；') || '—'}</span> },
            { key: 'cost1', label: '第一次：單位 OPEX／CCfD', render: (r) => <span className="text-[11px]">{[r.f?.['單位OPEX(元/噸)'] && `OPEX ${r.f['單位OPEX(元/噸)']} 元/噸`, r.f?.['CCfD執行價格(元/噸以上)'] && `CCfD ≥${r.f['CCfD執行價格(元/噸以上)']}`].filter(Boolean).join('；') || '—'}</span> },
            { key: 'hub2', label: '第二次：交接／可投入／時程', render: (r) => <span className="text-[11px]">{[r.p.handover, r.p.capture_volume, r.p.start_timing].filter(Boolean).join('；')}</span> },
            { key: 'cost2', label: '第二次：成本預估／3–5千元自付', render: (r) => <span className="text-[11px]">{[r.p.cost_estimate, r.p.share_3000_5000 && `自付 ${r.p.share_3000_5000}`].filter(Boolean).join('；') || '—'}</span> },
          ]} />
        </Card>
      )}
      <R2Note />
    </div>
  );
}

// ------------------------------------------
// 人才供需頁（第一次＋第二次）
// ------------------------------------------
export function CcusTalentView({ data: r1 }) {
  const { data, error } = useCcusRound2();
  const talent1 = useMemo(() => (r1.answers || []).filter((a) => a.sheet === '人才需求'), [r1.answers]);
  if (error) return <ErrorBlock message={error} />;
  if (!data) return <LoadingBlock text="讀取人力調查…" />;
  const { hr, jobs } = data;

  const need = (r) => { const s = r.base_116 != null ? 'base' : r.cons_116 != null ? 'cons' : r.opt_116 != null ? 'opt' : null; return s ? [r[`${s}_116`], r[`${s}_117`], r[`${s}_118`]] : null; };
  const demand = [116, 117, 118].map((y, i) => ({ name: `${y}年`, value: hr.reduce((s, r) => s + (need(r)?.[i] || 0), 0) }));
  const total = demand.reduce((s, d) => s + d.value, 0);
  const methodScore = (() => {
    const m = new Map();
    hr.forEach((r) => [[r.method_rank_1, 3], [r.method_rank_2, 2], [r.method_rank_3, 1]].forEach(([k, w]) => k && m.set(k, (m.get(k) || 0) + w)));
    return [...m].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  })();

  // 職缺種類：第二次填報職缺＋第一次「CCUS職缺」文字（依環節拆）
  const r1Jobs = talent1.flatMap((t) => String(t.answers?.['CCUS職缺(價值鏈/職稱/學歷/經驗/難度)'] || '').split('；')
    .map((seg) => seg.match(/^(碳捕捉|碳利用|碳封存|碳運輸|共通職務)[：:](.+)$/)).filter((m) => m && !/^(無|評估中)/.test(m[2].trim()))
    .map((m, i) => ({ id: `r1-${t.answers.公司}-${i}`, round: '第一次', company: t.answers.公司, stage: { 碳捕捉: '捕捉', 碳利用: '利用', 碳封存: '封存', 碳運輸: '運輸', 共通職務: '共通' }[m[1]], title: m[2].trim() })));
  const allJobs = [...jobs.map((j) => ({ ...j, round: '第二次' })), ...r1Jobs];
  const stageCount = STAGES.map((s) => ({ name: s, 第一次: r1Jobs.filter((j) => j.stage === s).length, 第二次: jobs.filter((j) => j.stage === s).length }));

  const companies = [...new Set([...hr.map((r) => r.company), ...talent1.map((t) => t.answers?.公司)].filter(Boolean))]
    .filter((c, i, arr) => arr.findIndex((x) => sameCo(x, c)) === i)
    .map((c) => ({ company: c, r2: hr.find((r) => sameCo(r.company, c)), r1: talent1.find((t) => sameCo(t.answers?.公司, c))?.answers }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="回覆公司（兩次合計）" value={companies.length} unit="家" note={`第一次 ${talent1.length} 家、第二次 ${hr.length} 家`} />
        <Kpi label="尚無 CCUS 專責人力" value={hr.filter((r) => r.no_dedicated).length} unit={`/ ${hr.length} 家`} note={`現有專職 ${hr.reduce((s, r) => s + (r.ccus_fulltime || 0), 0)} 人、兼任 ${hr.reduce((s, r) => s + (r.ccus_parttime || 0), 0)} 人（第二次）`} />
        <Kpi label="116–118 年 CCUS 新增職缺" value={total} unit="人" note={`持平情境為主；另 ${hr.filter((r) => r.evaluating).length} 家評估中無法提供數字`} />
        <Kpi label="全公司人才不足" value={hr.filter((r) => r.talent_status === '人才不足').length} unit={`/ ${hr.length} 家`} note="招募時間拉長或無法補足" />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card title="人才缺口：逐年新增職缺" icon={Users}><HBar data={demand} unit="人" height={150} /></Card>
        <Card title="人才欠缺原因" subtitle="第二次，複選"><HBar data={countBy(hr, (r) => r.shortage_reasons)} color="#b45309" /></Card>
        <Card title="缺口填補來源" subtitle="第二次，複選"><HBar data={countBy(hr, (r) => r.sources)} color="#1d4ed8" /></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="職缺種類：各環節職務數" subtitle="第一次為問卷文字拆解、第二次為職務表填報">
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageCount} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={AXIS_TICK} />
                <YAxis allowDecimals={false} tick={AXIS_TICK} />
                <Tooltip /><Legend />
                <Bar dataKey="第一次" fill={R1} stackId="a" />
                <Bar dataKey="第二次" fill={R2} stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="受訓後將負責之業務（培育需求）" icon={GraduationCap} subtitle="第二次，複選"><HBar data={countBy(hr, (r) => r.training_areas)} color="#7c3aed" /></Card>
      </div>

      <Card title="職缺明細與任職門檻">
        <DataTable rows={allJobs} rowKey={(r) => r.id} maxHeight={380} initialSort={{ key: 'stage', dir: 'asc' }} columns={[
          { key: 'stage', label: '環節', sortValue: (r) => STAGES.indexOf(r.stage), render: (r) => <Badge tone="blue">{r.stage}</Badge> },
          { key: 'title', label: '職務／說明' },
          { key: 'company', label: '公司' },
          { key: 'field', label: '學類', render: (r) => r.field || '—' },
          { key: 'degree', label: '學歷', render: (r) => r.degree || '—' },
          { key: 'experience', label: '年資', render: (r) => r.experience || '—' },
          { key: 'difficulty', label: '招募', render: (r) => (r.difficulty ? <Badge tone={r.difficulty === '困難' ? 'rose' : 'slate'}>{r.difficulty}</Badge> : '—') },
          { key: 'n', label: '116/117/118', align: 'center', render: (r) => (r.n116 == null ? '—' : `${r.n116}/${r.n117}/${r.n118}`) },
          { key: 'round', label: '調查', render: (r) => <Badge tone={r.round === '第二次' ? 'green' : 'slate'}>{r.round}</Badge> },
        ]} />
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="希望政府資助之培育方式" subtitle="加權：第一順位 3 分、第二 2 分、第三 1 分（第二次）"><HBar data={methodScore} unit="分" /></Card>
        <Card title="各公司兩次填答對照">
          <DataTable rows={companies} rowKey={(r) => r.company} maxHeight={380} columns={[
            { key: 'company', label: '公司', render: (r) => <span className="font-bold">{r.company} {r.r2 && <ScanBadge r={r.r2} />}</span> },
            { key: 'r1', label: '第一次：缺才主因／CCUS 職缺', render: (r) => <span className="text-[11px]">{r.r1 ? [r.r1.缺才主因, r.r1['CCUS職缺(價值鏈/職稱/學歷/經驗/難度)']].filter((x) => x && x !== '—').join('；') : '—'}</span> },
            { key: 'r2', label: '第二次：現有人力／新增需求', render: (r) => {
              if (!r.r2) return '—';
              const n = need(r.r2);
              return <span className="text-[11px]">{r.r2.no_dedicated ? '尚無專責' : `專職 ${r.r2.ccus_fulltime ?? 0}／兼任 ${r.r2.ccus_parttime ?? 0}`}；{n ? `${n.join('/')} 人` : r.r2.evaluating ? '評估中' : '未填'}{r.r2.comment ? `；${r.r2.comment}` : ''}</span>;
            } },
          ]} />
        </Card>
      </div>
      <R2Note />
    </div>
  );
}
