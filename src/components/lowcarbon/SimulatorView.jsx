// ==========================================
// 企業減碳模式預估（版型沿用 youshenglin-ui/ecirisk-demo「EcoRisk SCADA」）
// ==========================================
// 1. 產業 → 廠區類型 → 示意基準廠（排放量可改）
// 2. 製程流程（PFD）：每個節點顯示基準排放、導入措施後、AI 後
// 3. 減碳措施：取自低碳技術彙編實際案例（本產業 + 跨產業系統篇），可勾選、調整導入套數
// 4. AI 點／線／面：設備級、產線級、全廠級 AI 的減碳情境與概念圖
// 5. 儀表板：瀑布圖、碳費、投資回收
import React, { useEffect, useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Activity, ArrowRight, BrainCircuit, CheckSquare, Coins, Database, Factory, Leaf, Network, Receipt, ShieldCheck, Sliders,
  Square, Timer,
} from 'lucide-react';
import {
  CARBON_FEE_RATES, CATEGORIES, CATEGORY_COLOR, fmtNum, fmtTon, fmtWan, fmtYears, paybackOf,
} from '../../lib/lowcarbon/metrics';
import { AI_LAYERS, INDUSTRY_PROFILES, assignNode, measuresFor, simulate } from '../../lib/lowcarbon/simulator';
import { EquipmentVisual } from './ScadaVisuals';
import { AXIS_TICK, Card, GRID, Kpi, Note, TipBox } from './ui';

const AI_COLOR = Object.fromEntries(AI_LAYERS.map((l) => [l.id, l.color]));

// 換產業/廠型時的預設勾選：本產業、可量化、回收 3 年內，最多 8 項
function defaultSelection(measures) {
  return Object.fromEntries(measures
    .filter((m) => !m.crossIndustry && m.co2 != null && (paybackOf(m.c) ?? 99) <= 3)
    .sort((a, b) => (b.co2 || 0) - (a.co2 || 0)).slice(0, 8).map((m) => [m.id, 1]));
}

export default function SimulatorView({ data }) {
  const [industryId, setIndustryId] = useState('paper');
  const profile = INDUSTRY_PROFILES.find((p) => p.id === industryId);
  const [plantId, setPlantId] = useState(profile.plants[0].id);
  const plant = profile.plants.find((p) => p.id === plantId) || profile.plants[0];
  const [emission, setEmission] = useState(plant.emission);
  const measures = useMemo(() => measuresFor(profile, data.reportCases), [profile, data]);
  const [selected, setSelected] = useState(() => defaultSelection(measures));
  const [ai, setAi] = useState(() => Object.fromEntries(AI_LAYERS.map((l) => [l.id, l.defaultPct])));
  const [feeKey, setFeeKey] = useState('general');

  useEffect(() => { setPlantId(profile.plants[0].id); }, [industryId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setEmission(plant.emission); }, [plant]);
  useEffect(() => { setSelected(defaultSelection(measures)); }, [measures]);

  const feeRate = CARBON_FEE_RATES.find((r) => r.key === feeKey).value;
  const sim = useMemo(() => simulate({ plant, emission, measures, selected, ai, feeRate }), [plant, emission, measures, selected, ai, feeRate]);

  return (
    <div className="space-y-5">
      {/* 產業選擇（沿用 demo 的頂部產業切換） */}
      <div className="bg-slate-900 rounded-2xl border border-slate-700 p-3 md:p-4 space-y-3">
        <div className="flex items-center gap-2 text-white">
          <Leaf className="text-emerald-400" size={22} />
          <span className="font-bold tracking-wide">EcoRisk<span className="text-sky-400"> SCADA</span></span>
          <span className="text-xs text-slate-400 ml-1">企業減碳模式預估</span>
        </div>
        <div className="flex overflow-x-auto no-scrollbar gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
          {INDUSTRY_PROFILES.map((p) => (
            <button key={p.id} onClick={() => setIndustryId(p.id)}
              className={`px-3 h-9 rounded-md text-[13px] font-semibold whitespace-nowrap transition-colors ${industryId === p.id ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
              {p.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-[13px] text-slate-300">廠區類型
            <select value={plant.id} onChange={(e) => setPlantId(e.target.value)} className="mt-1 block h-9 rounded-lg bg-slate-800 border border-slate-600 text-white px-2 text-sm">
              {profile.plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="text-[13px] text-slate-300">年排放量（公噸CO2e）
            <input type="number" value={emission} min={1000} step={1000} onChange={(e) => setEmission(Math.max(0, Number(e.target.value) || 0))}
              className="mt-1 block h-9 w-40 rounded-lg bg-slate-800 border border-slate-600 text-white px-2 text-sm num text-right" />
          </label>
          <div className="text-[12px] text-slate-400 pb-1.5">範疇二（外購電力）約 {Math.round(plant.scope2 * 100)}%・示意基準廠，可依貴廠盤查結果修改</div>
        </div>
        <div className="bg-slate-800/70 rounded-lg border border-slate-700 p-3 flex gap-2 text-[13px] text-slate-300 leading-relaxed">
          <ShieldCheck size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
          <span><b className="text-white">{profile.name}減碳重點：</b>{profile.mechanism}</span>
        </div>
      </div>

      <ProcessFlow sim={sim} />

      <Dashboard sim={sim} emission={emission} feeKey={feeKey} setFeeKey={setFeeKey} feeRate={feeRate} />

      <AiPanel sim={sim} ai={ai} setAi={setAi} emission={emission} cases={data.reportCases} plant={plant} />

      <MeasurePicker plant={plant} measures={measures} selected={selected} setSelected={setSelected} sim={sim} />

      <Note>
        模擬方法：措施減碳量、投資與年效益直接採用低碳技術彙編案例實績（減碳量以 113 年電力係數換算）× 導入套數；原文缺投資或年效益者，以同類別案例每公噸中位數推估（標「推估」）。單一製程節點的措施減碳以該節點排放的 60% 為上限，超過時投資與效益同比例縮減。
        AI 點／線／面為情境假設，依彙編中 AI 控制案例的節能幅度量級設定，可自行調整。所有預設排放與節點占比皆為量級參考，不代表特定工廠。
      </Note>
    </div>
  );
}

// ---------- 製程流程（PFD，dark SCADA 風格） ----------
function ProcessFlow({ sim }) {
  return (
    <div className="bg-[#1e293b] p-4 sm:p-6 rounded-2xl shadow-lg border-2 border-slate-700 relative overflow-hidden font-mono">
      <div className="absolute inset-0 opacity-[0.12] bg-[linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)]" style={{ backgroundSize: '20px 20px' }} />
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 mb-5 pb-3 border-b-2 border-slate-600">
        <div className="flex items-center gap-2 text-slate-200">
          <Sliders size={18} className="text-sky-400" />
          <h3 className="text-base font-bold tracking-wider">PROCESS FLOW DIAGRAM（製程節點減碳）</h3>
        </div>
        <span className="flex items-center text-xs font-bold text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />SIMULATION LIVE</span>
      </div>
      <div className="relative z-10 flex flex-col lg:flex-row gap-4 items-stretch justify-center">
        {sim.nodes.map((n, i) => (
          <React.Fragment key={n.id}>
            <NodeCard n={n} />
            {i < sim.nodes.length - 1 && <div className="hidden lg:flex items-center text-slate-500"><ArrowRight size={26} strokeWidth={1.5} /></div>}
          </React.Fragment>
        ))}
      </div>
      <div className="relative z-10 mt-6 flex flex-col items-center">
        <div className="h-8 w-3 bg-slate-700 border-x border-slate-800 overflow-hidden">
          <div className="w-full h-full bg-[linear-gradient(180deg,transparent_25%,rgba(52,211,153,0.5)_50%,transparent_75%)] bg-[length:100%_200%] animate-[lcSlideDown_2s_linear_infinite]" />
        </div>
        <div className="bg-slate-800 border-2 border-slate-600 p-4 rounded-xl w-full max-w-4xl flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h4 className="text-white font-bold text-sm flex items-center"><Database size={17} className="mr-2 text-sky-400" />AI 碳核算與能源調度閘道器</h4>
            <p className="text-slate-400 text-xs mt-1 font-sans">彙整各節點感測數據，執行點（設備）、線（產線）、面（全廠）三層 AI 最佳化。</p>
          </div>
          <div className="flex gap-2 text-xs flex-wrap">
            {AI_LAYERS.map((l) => (
              <span key={l.id} className="bg-slate-900 px-2.5 py-1.5 rounded border border-slate-700 font-bold flex items-center gap-1.5 text-slate-200">
                <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />{l.short} −{fmtNum(sim.aiCut[l.id])} t
              </span>
            ))}
            <span className="bg-slate-900 text-sky-400 px-2.5 py-1.5 rounded border border-slate-700 font-bold flex items-center"><Network size={13} className="mr-1.5 animate-spin" style={{ animationDuration: '3s' }} />DATA INTEGRATED</span>
          </div>
        </div>
      </div>
      <style>{'@keyframes lcSlideDown{0%{background-position:0 -100%}100%{background-position:0 100%}}'}</style>
    </div>
  );
}

function NodeCard({ n }) {
  const ai = n.aiPoint + n.aiLine + n.aiArea;
  const pct = n.base ? (n.base - n.after) / n.base : 0;
  const hot = pct < 0.02;
  return (
    <div className={`flex-1 min-w-0 lg:max-w-[300px] bg-slate-800 border-2 rounded-xl flex flex-col overflow-hidden ${hot ? 'border-amber-500/70' : 'border-slate-600'}`}>
      <div className="p-3 bg-[#0f172a] flex items-center justify-center border-b-2 border-slate-700 h-24 lg:h-36 relative [&_svg]:!w-16 [&_svg]:!h-16 lg:[&_svg]:!w-24 lg:[&_svg]:!h-24">
        <EquipmentVisual visualType={n.visualType} />
        <div className="absolute top-2 left-2 flex items-center bg-slate-900/80 px-2 py-1 rounded text-[9px] font-bold text-slate-300">
          <span className={`w-2 h-2 rounded-full mr-1.5 ${hot ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />{n.count ? `已導入 ${n.count} 項` : '尚未導入'}
        </div>
      </div>
      <div className="p-3 flex-1 flex flex-col gap-2 text-xs">
        <div className="flex justify-between items-start gap-2 border-b border-slate-700 pb-2">
          <h5 className="text-[13px] font-bold text-white font-sans leading-snug">{n.title}</h5>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-900/40 text-emerald-300 border border-emerald-800 whitespace-nowrap">−{Math.round(pct * 100)}%</span>
        </div>
        <div className="flex justify-around bg-slate-900 rounded border border-slate-700 py-1.5">
          {Object.entries(n.metrics).map(([k, v]) => (
            <div key={k} className="text-center"><div className="text-[9px] text-slate-500 uppercase">{k}</div><div className="text-[11px] text-slate-200 font-bold font-sans">{v}</div></div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Cell2 label="基準排放" value={fmtNum(n.base)} unit="t" tone="text-slate-200" />
          <Cell2 label="措施減碳" value={`−${fmtNum(n.cut)}`} unit="t" tone="text-emerald-400" />
          <Cell2 label="AI 減碳" value={`−${fmtNum(ai)}`} unit="t" tone="text-violet-300" />
          <Cell2 label="導入後" value={fmtNum(n.after)} unit="t" tone="text-amber-300" />
        </div>
        {/* 節點排放組成條 */}
        <div className="h-2 rounded-full bg-slate-700 overflow-hidden flex" title="灰：剩餘排放；綠：措施；紫：AI">
          <div style={{ width: `${(n.after / n.base) * 100}%` }} className="bg-slate-500" />
          <div style={{ width: `${(n.cut / n.base) * 100}%` }} className="bg-emerald-500" />
          <div style={{ width: `${(ai / n.base) * 100}%` }} className="bg-violet-400" />
        </div>
      </div>
    </div>
  );
}
const Cell2 = ({ label, value, unit, tone }) => (
  <div className="bg-slate-700/50 p-1.5 rounded border border-slate-600/50">
    <div className="text-[9px] text-slate-400 font-sans">{label}</div>
    <div className={`text-[13px] font-bold ${tone}`}>{value}<span className="text-[9px] text-slate-500 ml-0.5">{unit}</span></div>
  </div>
);

// ---------- 儀表板：KPI、瀑布圖、碳費 ----------
function Dashboard({ sim, emission, feeKey, setFeeKey, feeRate }) {
  const steps = [
    { name: '基準排放', value: emission, type: 'total' },
    ...CATEGORIES.map((c) => ({ name: c, value: -sim.cat[c], color: CATEGORY_COLOR[c] })),
    ...AI_LAYERS.map((l) => ({ name: `AI ${l.short}`, value: -sim.aiCut[l.id], color: l.color })),
    { name: '導入後', value: sim.after, type: 'total' },
  ];
  let run = 0;
  const wf = steps.map((s) => {
    if (s.type === 'total') { run = s.value; return { ...s, base: 0, bar: s.value, color: '#64748b' }; }
    const top = run;
    run += s.value;
    return { ...s, base: run, bar: -s.value, top };
  });
  // 減碳占比小時（例如大型鋼廠），縱軸由接近導入後排放處起算，放大減碳段
  const zoom = sim.rate < 0.3 && emission > 0;
  const yMin = zoom ? niceFloor(sim.after - (emission - sim.after) * 0.6) : 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Kpi icon={Factory} label="基準年排放" value={fmtTon(emission)} />
        <Kpi icon={Leaf} label="導入後排放" value={fmtTon(sim.after)} note={`減碳 ${fmtTon(emission - sim.after)}/年`} />
        <Kpi tone="dark" label="減碳率" value={`${(sim.rate * 100).toFixed(1)}%`} note={`措施 ${fmtTon(sim.measureCut)}＋AI ${fmtTon(sim.aiTotal)}`} />
        <Kpi icon={Coins} label="總投資" value={fmtWan(sim.totalInv)} note={`措施 ${fmtWan(sim.inv)}＋AI ${fmtWan(sim.aiInv)}`} />
        <Kpi icon={Receipt} label="年效益（含碳費）" value={fmtWan(sim.totalBenefit)} note={`碳費節省 ${fmtWan(sim.feeSaving)}`} />
        <Kpi icon={Timer} label="整體回收年限" value={fmtYears(sim.payback)} />
      </div>
      {(sim.capped || sim.unquantified > 0) && (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <Activity size={14} />
          {sim.capped && '部分節點的措施減碳加總超過該節點排放的 60%，已截斷（案例實績的工廠規模可能大於本基準廠）。'}
          {sim.unquantified > 0 && ` 另有 ${sim.unquantified} 項已勾選措施原文未量化減碳量，未計入。`}
        </div>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2" title="減碳瀑布圖" subtitle={`基準排放 → 各類技術措施 → AI 點／線／面 → 導入後排放（公噸CO2e/年）${zoom ? `。縱軸由 ${fmtNum(yMin)} 起算以放大減碳段` : ''}`}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <BarChart data={wf} margin={{ top: 18, right: 8, left: 8, bottom: 0 }} barCategoryGap="18%">
                <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ ...AXIS_TICK, fill: '#334155' }} interval={0} tickLine={false} />
                <YAxis tick={AXIS_TICK} width={60} axisLine={false} tickLine={false} domain={[yMin, 'auto']} allowDataOverflow tickFormatter={(v) => (v >= 1e4 ? `${fmtNum(v / 1e4, 1)}萬` : fmtNum(v))} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} content={({ active, payload }) => (active && payload?.length ? (
                  <TipBox title={payload[0].payload.name} rows={[[payload[0].payload.type === 'total' ? '排放量' : '減碳量', fmtTon(payload[0].payload.bar), payload[0].payload.color]]} />
                ) : null)} />
                <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
                <Bar dataKey="bar" stackId="w" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {wf.map((d) => <Cell key={d.name} fill={d.color} />)}
                  <LabelList dataKey="bar" position="top" fontSize={10} fill="#475569" formatter={(v) => (v > 0 ? (v >= 1e4 ? `${fmtNum(v / 1e4, 1)}萬` : fmtNum(v)) : '')} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="碳費財務影響" subtitle="收費排放量 = 年排放量 − 2.5 萬公噸（K 值）">
          <div className="space-y-3">
            <div className="seg w-full">
              {CARBON_FEE_RATES.map((r) => (
                <button key={r.key} onClick={() => setFeeKey(r.key)} className={`seg-btn flex-1 !h-8 !px-2 text-[12px] ${feeKey === r.key ? 'seg-btn-on' : ''}`}>{r.value} 元</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3"><div className="text-xs text-slate-500">導入前年碳費</div><div className="num text-lg font-bold">{fmtWan(sim.feeBefore)}</div></div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3"><div className="text-xs text-slate-500">導入後年碳費</div><div className="num text-lg font-bold">{fmtWan(sim.feeAfter)}</div></div>
            </div>
            <div className="bg-slate-900 text-white rounded-lg p-3">
              <div className="text-xs text-slate-400">10 年累計節省（能源＋碳費，未折現）</div>
              <div className="num text-2xl font-black text-emerald-400">{fmtWan(sim.totalBenefit * 10)}</div>
              <div className="text-[11px] text-slate-400 mt-1">總投資 {fmtWan(sim.totalInv)}；費率 {feeRate} 元/公噸</div>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">適用自主減量計畫優惠費率者，收費排放量另依排放量調整係數計算，本處以簡化方式估算量級。</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function niceFloor(v) {
  if (v <= 0) return 0;
  const step = 10 ** Math.floor(Math.log10(v));
  return Math.floor(v / step) * step;
}

// ---------- AI 點／線／面 ----------
const AI_KEYWORDS = /AI|智能|智慧|最佳化控制|群控|機差平衡|自動負載|預測/;

function AiPanel({ sim, ai, setAi, emission, cases }) {
  const [layers, setLayers] = useState({ point: true, line: true, area: true });
  const evidence = useMemo(() => cases.filter((c) => c.is_latest !== false && AI_KEYWORDS.test(c.tech_name)), [cases]);
  // 模擬 24 小時碳流率（示意）：日間負載較高；點／線降低整體，面再削峰
  const profile = useMemo(() => {
    const hourly = (emission - sim.measureCut) / 8760;
    const pl = ai.point / 100;
    const ln = ai.line / 100;
    const ar = ai.area / 100;
    return Array.from({ length: 24 }, (_, h) => {
      const shape = 0.82 + 0.28 * Math.max(0, Math.sin(((h - 6) / 24) * 2 * Math.PI)) + 0.04 * Math.sin(h * 1.7);
      const base = hourly * shape;
      const pt = base * (1 - pl * 0.9);
      const lnv = pt * (1 - ln * 0.9);
      const peak = hourly * 1.02;
      const area = lnv > peak ? peak + (lnv - peak) * (1 - Math.min(1, ar * 20)) : lnv * (1 - ar * 0.6);
      return { h: `${String(h).padStart(2, '0')}:00`, base, point: pt, line: lnv, area };
    });
  }, [emission, sim.measureCut, ai]);

  return (
    <Card title={<span className="flex items-center gap-2"><BrainCircuit size={18} className="text-violet-600" />AI 應用於減碳：點、線、面</span>}
      subtitle="點＝單一設備的 AIoT 感測與最佳化；線＝產線或公用系統的跨設備聯控；面＝全廠能源管理與碳排即時調度。滑桿可調整各層的節能幅度假設。">
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-2 space-y-3">
          {AI_LAYERS.map((l) => (
            <div key={l.id} className="border border-brand-line rounded-xl p-3">
              <div className="flex items-center justify-between gap-2">
                <button onClick={() => setLayers((s) => ({ ...s, [l.id]: !s[l.id] }))} className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  {layers[l.id] ? <CheckSquare size={16} style={{ color: l.color }} /> : <Square size={16} className="text-slate-400" />}
                  <span className="w-3 h-3 rounded-full" style={{ background: l.color }} />{l.name}
                </button>
                <span className="num text-sm font-bold text-violet-700">−{fmtTon(sim.aiCut[l.id])}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{l.desc}</p>
              <div className="flex items-center gap-2 mt-2">
                <input type="range" min={0} max={l.max} step={0.5} value={ai[l.id]} onChange={(e) => setAi((s) => ({ ...s, [l.id]: Number(e.target.value) }))} className="flex-1 accent-violet-600" />
                <span className="num text-xs w-28 text-right text-slate-600">節能 {ai[l.id]}%・{l.basis === 'utility' ? '公用系統' : l.basis === 'process' ? '主製程' : '全廠'}</span>
              </div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2">
            <Kpi label="AI 合計減碳" value={fmtTon(sim.aiTotal)} unit="/年" />
            <Kpi label="AI 投資／年效益" value={fmtWan(sim.aiInv)} note={`年效益約 ${fmtWan(sim.aiBenefit)}（不含碳費）`} />
          </div>
        </div>
        <div className="xl:col-span-3 space-y-3">
          <PlantMap sim={sim} layers={layers} />
          <div>
            <div className="text-sm font-bold text-slate-700 mb-1">AIoT 即時碳流率（模擬示意，公噸CO2e/小時）</div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <AreaChart data={profile} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="h" tick={AXIS_TICK} interval={3} tickLine={false} />
                  <YAxis tick={AXIS_TICK} width={44} tickFormatter={(v) => fmtNum(v, 1)} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                  <Tooltip content={({ active, payload, label }) => (active && payload?.length ? (
                    <TipBox title={`${label}（模擬）`} rows={[
                      ['未導入 AI', `${fmtNum(payload[0].payload.base, 2)} t/h`, '#94a3b8'],
                      ['＋點', `${fmtNum(payload[0].payload.point, 2)} t/h`, AI_COLOR.point],
                      ['＋線', `${fmtNum(payload[0].payload.line, 2)} t/h`, AI_COLOR.line],
                      ['＋面（削峰）', `${fmtNum(payload[0].payload.area, 2)} t/h`, AI_COLOR.area],
                    ]} />
                  ) : null)} />
                  <Legend verticalAlign="top" height={22} iconType="plainline" wrapperStyle={{ fontSize: 12 }} itemSorter={(it) => ['未導入 AI', '＋點', '＋線', '＋面'].indexOf(it.value)} />
                  <Area name="未導入 AI" dataKey="base" stroke="#94a3b8" fill="#e2e8f0" strokeWidth={2} isAnimationActive={false} />
                  {layers.point && <Area name="＋點" dataKey="point" stroke={AI_COLOR.point} fill="none" strokeWidth={2} isAnimationActive={false} />}
                  {layers.line && <Area name="＋線" dataKey="line" stroke={AI_COLOR.line} fill="none" strokeWidth={2} isAnimationActive={false} />}
                  {layers.area && <Area name="＋面" dataKey="area" stroke={AI_COLOR.area} fill="#ede9fe" fillOpacity={0.5} strokeWidth={2} isAnimationActive={false} />}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 border-t border-brand-line pt-3">
        <div className="text-sm font-bold text-slate-700 mb-2">彙編中的 AI／智慧控制實績（{evidence.length} 件）</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          {evidence.slice(0, 10).map((c) => (
            <div key={c.case_id} className="py-1.5 border-b border-slate-100 text-sm flex flex-wrap gap-x-2 items-baseline">
              <span className="font-medium text-slate-800">{c.tech_name}</span>
              <span className="text-xs text-slate-500">{c.company || c.industry}</span>
              <span className="text-xs text-slate-500 num">{c.co2_t ? `減碳 ${fmtTon(c.co2_t)}/年` : c.electricity_kwh ? `節電 ${fmtNum(c.electricity_kwh)} kWh/年` : ''}{c.investment_wan ? `・投資 ${fmtWan(c.investment_wan)}` : ''}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// 廠區概念圖：面＝節點區塊（全廠能源管理覆蓋範圍）、線＝製程動線（產線聯控）、點＝設備感測點（設備級 AI）
function PlantMap({ sim, layers }) {
  const W = 640;
  const H = 260;
  const cols = Math.min(3, sim.nodes.length);
  const rowsN = Math.ceil(sim.nodes.length / cols);
  const zw = (W - 40 - (cols - 1) * 20) / cols;
  const zh = (H - 40 - (rowsN - 1) * 24) / rowsN;
  const zones = sim.nodes.map((n, i) => {
    const r = Math.floor(i / cols);
    const c = r % 2 ? cols - 1 - (i % cols) : i % cols; // 蛇行排列讓動線連續
    return { n, x: 20 + c * (zw + 20), y: 20 + r * (zh + 24) };
  });
  const maxCut = Math.max(1, ...sim.nodes.map((n) => n.aiPoint + n.aiLine + n.aiArea));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-slate-900 rounded-xl" role="img" aria-label="AI 點線面減碳概念圖">
      <defs>
        <pattern id="lcgrid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#334155" strokeWidth="0.5" /></pattern>
      </defs>
      <rect width={W} height={H} fill="url(#lcgrid)" />
      {zones.map(({ n, x, y }) => (
        <g key={n.id}>
          <rect x={x} y={y} width={zw} height={zh} rx={10} fill={layers.area ? AI_COLOR.area : '#1e293b'}
            fillOpacity={layers.area ? 0.15 + 0.5 * (n.aiArea / maxCut) : 1} stroke="#64748b" strokeDasharray="4 3" />
          <text x={x + 10} y={y + 18} fontSize="12" fill="#e2e8f0" fontWeight="bold">{(() => { const max = layers.area ? 8 : 13; const t = n.title.replace(/（.*?）/, ''); return t.length > max ? `${t.slice(0, max)}…` : t; })()}</text>
          {layers.area && <text x={x + zw - 8} y={y + 18} fontSize="10" fill="#c4b5fd" textAnchor="end">面 −{fmtNum(n.aiArea)}t</text>}
        </g>
      ))}
      {layers.line && zones.slice(1).map((z, i) => {
        const a = zones[i];
        const w = 2 + 8 * ((a.n.aiLine + z.n.aiLine) / 2 / maxCut);
        return (
          <line key={z.n.id} x1={a.x + zw / 2} y1={a.y + zh / 2} x2={z.x + zw / 2} y2={z.y + zh / 2}
            stroke={AI_COLOR.line} strokeWidth={w} strokeLinecap="round" strokeDasharray="10 6" opacity={0.9}>
            <animate attributeName="stroke-dashoffset" from="32" to="0" dur="1.6s" repeatCount="indefinite" />
          </line>
        );
      })}
      {layers.point && zones.map(({ n, x, y }) => {
        const k = n.kinds.includes('utility') ? 6 : 3;
        return Array.from({ length: k }, (_, j) => {
          const px = x + 18 + ((j % 3) * (zw - 36)) / 2;
          const py = y + zh - 18 - Math.floor(j / 3) * 22;
          const r = 3 + 5 * (n.aiPoint / maxCut);
          return (
            <g key={`${n.id}${j}`}>
              <circle cx={px} cy={py} r={r + 4} fill={AI_COLOR.point} opacity="0.25">
                <animate attributeName="r" values={`${r};${r + 7};${r}`} dur={`${1.6 + j * 0.2}s`} repeatCount="indefinite" />
              </circle>
              <circle cx={px} cy={py} r={r} fill={AI_COLOR.point} stroke="#fff" strokeWidth="1" />
            </g>
          );
        });
      })}
      <g fontSize="10" fill="#cbd5e1">
        <circle cx={W - 150} cy={H - 12} r={4} fill={AI_COLOR.point} /><text x={W - 142} y={H - 8}>點</text>
        <line x1={W - 118} y1={H - 12} x2={W - 100} y2={H - 12} stroke={AI_COLOR.line} strokeWidth={3} /><text x={W - 96} y={H - 8}>線</text>
        <rect x={W - 70} y={H - 18} width={12} height={12} fill={AI_COLOR.area} fillOpacity={0.5} /><text x={W - 54} y={H - 8}>面</text>
      </g>
    </svg>
  );
}

// ---------- 措施選擇 ----------
function MeasurePicker({ plant, measures, selected, setSelected, sim }) {
  const [showCross, setShowCross] = useState(true);
  const groups = useMemo(() => {
    const g = plant.nodes.map((n) => ({ key: n.id, title: n.title, list: [] }));
    const site = { key: 'site', title: '廠區綠能與碳管理（再生能源、CCUS、資源循環）', list: [] };
    for (const m of measures) {
      if (!showCross && m.crossIndustry) continue;
      const node = assignNode(plant, m.kind);
      (node ? g.find((x) => x.key === node.id) : site).list.push(m);
    }
    for (const x of [...g, site]) x.list.sort((a, b) => (a.crossIndustry - b.crossIndustry) || (b.co2 || 0) - (a.co2 || 0));
    return [...g, site].filter((x) => x.list.length);
  }, [plant, measures, showCross]);
  const toggle = (id) => setSelected((s) => { const n = { ...s }; if (n[id]) delete n[id]; else n[id] = 1; return n; });
  const setQty = (id, q) => setSelected((s) => ({ ...s, [id]: Math.max(1, Math.min(10, q)) }));
  const recommend = () => setSelected(Object.fromEntries(measures.filter((m) => m.co2 != null && (paybackOf(m.c) ?? 99) <= 3).map((m) => [m.id, 1])));
  const count = Object.keys(selected).length;

  return (
    <Card title={`可導入的減碳措施（已選 ${count} 項）`}
      subtitle="來自低碳技術彙編與典範案例的實際案例；「跨產業」為系統篇（動力、冷卻、餘熱）中適用各產業的技術。減碳量為案例實績，可調整導入套數。"
      right={(
        <div className="flex flex-wrap gap-2 justify-end">
          <label className="flex items-center gap-1.5 text-[13px] text-slate-600"><input type="checkbox" checked={showCross} onChange={(e) => setShowCross(e.target.checked)} className="accent-brand w-4 h-4" />顯示跨產業技術</label>
          <button onClick={recommend} className="h-8 px-3 rounded-lg border border-brand-line text-[13px] hover:bg-brand-ground">選取回收 3 年內</button>
          <button onClick={() => setSelected({})} className="h-8 px-3 rounded-lg border border-brand-line text-[13px] hover:bg-brand-ground">清除</button>
        </div>
      )}>
      <div className="space-y-4">
        {groups.map((g) => {
          const node = sim.nodes.find((n) => n.id === g.key);
          return (
            <div key={g.key}>
              <div className="flex items-baseline justify-between gap-2 border-b border-brand-line pb-1 mb-1">
                <span className="text-sm font-bold text-slate-800">{g.title}</span>
                {node && <span className="text-xs text-slate-500 num">節點排放 {fmtTon(node.base)}・措施減碳 {fmtTon(node.cut)}{node.raw > node.cut ? '（已達上限）' : ''}</span>}
              </div>
              <ul className="divide-y divide-slate-100">
                {g.list.map((m) => {
                  const on = !!selected[m.id];
                  return (
                    <li key={m.id} className={`py-1.5 flex items-center gap-2 text-sm ${m.co2 == null ? 'opacity-60' : ''}`}>
                      <button onClick={() => toggle(m.id)} aria-label={on ? '取消' : '導入'} className="flex-shrink-0">
                        {on ? <CheckSquare size={18} className="text-brand" /> : <Square size={18} className="text-slate-400" />}
                      </button>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLOR[m.c.category] }} title={m.c.category} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-medium text-slate-800">{m.c.tech_name}</span>
                          {m.crossIndustry && <span className="text-[10px] text-sky-700 bg-sky-50 border border-sky-200 rounded px-1">跨產業</span>}
                          {m.estimated && <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1">減碳由節電推估</span>}
                          <span className="text-[11px] text-slate-400">{m.c.company || m.c.industry}・{m.c.doc_title}</span>
                        </div>
                        <div className="text-xs text-slate-500 num">
                          {m.co2 != null ? `減碳 ${fmtTon(m.co2)}/年` : '原文未量化減碳'}・投資 {fmtWan(m.inv)}{m.invEst ? '（推估）' : ''}・年效益 {fmtWan(m.benefit)}{m.benefitEst ? '（推估）' : ''}・回收 {fmtYears(paybackOf(m.c))}
                        </div>
                      </div>
                      {on && (
                        <div className="flex items-center gap-1 flex-shrink-0" title="導入套數（同類設備台數或產線數）">
                          <button onClick={() => setQty(m.id, selected[m.id] - 1)} className="w-7 h-7 rounded border border-brand-line">−</button>
                          <span className="num w-6 text-center text-sm">{selected[m.id]}</span>
                          <button onClick={() => setQty(m.id, selected[m.id] + 1)} className="w-7 h-7 rounded border border-brand-line">＋</button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
