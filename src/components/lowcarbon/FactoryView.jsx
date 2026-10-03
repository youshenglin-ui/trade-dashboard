// 企業試算：工廠減碳模擬（2026-10 重製）
//   1. 選產業與廠型 → 工廠生產流程圖（主製程鏈＋能源公用系統）
//   2. 點製程節點 → 選擇可導入的減碳技術（彙編實際案例）＋是否導入 AIoT 監控
//   3. AIoT 監控中心：監控（點）→ 產線聯控（線）→ 全廠調度（面），看 AI 帶來的深度減碳
//   4. 導入效益儀表板：深度減碳路徑、投資與效益對照、10 年累計現金流
import React, { useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Activity, ArrowDown, ArrowRight, BrainCircuit, CheckSquare, Cpu, Factory, Flame, Fuel, Gauge, Leaf, Network, Radio, Square,
  Timer, Wrench, Zap,
} from 'lucide-react';
import { CARBON_FEE_RATES, CATEGORY_COLOR, fmtNum, fmtTon, fmtWan, fmtYears, paybackOf } from '../../lib/lowcarbon/metrics';
import { fmtCost } from '../../lib/lowcarbon/lcoa';
import {
  AI_STAGES, DEFAULT_AI_PCT, INDUSTRY_PROFILES, MEASURE_DECAY, PLANT_IO, SENSOR_TYPES, TECH_COLOR, assignNode, measuresFor, simulateFactory,
} from '../../lib/lowcarbon/simulator';
import { AXIS_TICK, Card, GRID, Kpi, Note, Segmented, TipBox } from './ui';

const KIND_ICON = { process: Factory, thermal: Flame, fuel: Fuel, utility: Zap };
const KIND_LABEL = { process: '主製程', thermal: '熱能', fuel: '鍋爐／燃料', utility: '公用系統' };
const AI_COLOR = Object.fromEntries(AI_STAGES.map((s) => [s.id, s.color]));
const CRF10 = (0.05 * 1.05 ** 10) / (1.05 ** 10 - 1);
const measureLcoa = (m) => (m.co2 > 0 && m.inv != null && m.benefit != null ? ((m.inv * CRF10 - m.benefit) * 1e4) / m.co2 : null);
const AI_KEYWORDS = /AI|智能|智慧|最佳化控制|群控|機差平衡|自動負載|預測/;

// 換產業／廠型時的預設：本產業、可量化、回收 3 年內的技術最多 6 項；全部節點導入 AIoT 監控並啟用聯控與調度（呈現深度減碳）
function defaults(plant, measures) {
  const selected = Object.fromEntries(measures
    .filter((m) => !m.crossIndustry && m.co2 != null && (paybackOf(m.c) ?? 99) <= 3)
    .sort((a, b) => (b.co2 || 0) - (a.co2 || 0)).slice(0, 6).map((m) => [m.id, 1]));
  const aiot = Object.fromEntries(plant.nodes.map((n) => [n.id, true]));
  return { selected, aiot };
}

export default function FactoryView({ data }) {
  const [industryId, setIndustryId] = useState('paper');
  const profile = INDUSTRY_PROFILES.find((p) => p.id === industryId);
  const [plantId, setPlantId] = useState(profile.plants[0].id);
  const plant = profile.plants.find((p) => p.id === plantId) || profile.plants[0];
  const measures = useMemo(() => measuresFor(profile, data.reportCases), [profile, data]);
  const pickIndustry = (id) => { setIndustryId(id); setPlantId(INDUSTRY_PROFILES.find((p) => p.id === id).plants[0].id); };
  // 換產業／廠型時整個工作區以新的預設值重建（key 改變即重設狀態）
  return (
    <FactoryWorkspace key={`${industryId}-${plant.id}`} data={data} profile={profile} plant={plant} measures={measures}
      industryId={industryId} pickIndustry={pickIndustry} setPlantId={setPlantId} />
  );
}

function FactoryWorkspace({ data, profile, plant, measures, industryId, pickIndustry, setPlantId }) {
  const [emission, setEmission] = useState(plant.emission);
  const [selected, setSelected] = useState(() => defaults(plant, measures).selected);
  const [aiot, setAiot] = useState(() => defaults(plant, measures).aiot);
  const [line, setLine] = useState(true);
  const [area, setArea] = useState(true);
  const [pct, setPct] = useState(DEFAULT_AI_PCT);
  const [feeKey, setFeeKey] = useState('general');
  const [selNode, setSelNodeState] = useState(plant.nodes[0].id);
  // 手機版技術面板在流程圖下方：點節點後捲到面板
  const setSelNode = (id) => {
    setSelNodeState(id);
    if (window.innerWidth < 1280) setTimeout(() => document.getElementById('lc-node-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const feeRate = CARBON_FEE_RATES.find((r) => r.key === feeKey).value;
  const sim = useMemo(() => simulateFactory({ plant, emission, measures, selected, aiot, line, area, pct, feeRate }),
    [plant, emission, measures, selected, aiot, line, area, pct, feeRate]);
  const node = sim.nodes.find((n) => n.id === selNode) || (selNode === 'site' ? { ...sim.site, id: 'site', title: '廠區綠能與碳管理', kinds: ['site'] } : sim.nodes[0]);

  return (
    <div className="space-y-4">
      <Card title="工廠設定" subtitle="選擇產業與廠區類型；預設排放量與各製程占比為示意基準廠（依產業公開資料粗估），請依貴廠盤查結果修改。">
        <div className="space-y-3">
          <Segmented value={industryId} onChange={pickIndustry} options={INDUSTRY_PROFILES.map((p) => ({ value: p.id, label: p.name }))} />
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-[13px] text-slate-600">廠區類型
              <select value={plant.id} onChange={(e) => setPlantId(e.target.value)} className="mt-1 block h-10 rounded-lg border border-brand-line bg-white px-2 text-sm min-w-[12rem]">
                {profile.plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="text-[13px] text-slate-600">年排放量（公噸CO2e）
              <input type="number" value={emission} min={1000} step={1000} onChange={(e) => setEmission(Math.max(0, Number(e.target.value) || 0))}
                className="mt-1 block h-10 w-40 rounded-lg border border-brand-line px-2 text-sm num text-right" />
            </label>
            <label className="text-[13px] text-slate-600">碳費費率
              <select value={feeKey} onChange={(e) => setFeeKey(e.target.value)} className="mt-1 block h-10 rounded-lg border border-brand-line bg-white px-2 text-sm">
                {CARBON_FEE_RATES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </label>
          </div>
          <p className="text-[13px] text-slate-600 leading-relaxed bg-brand-ground border border-brand-line rounded-lg px-3 py-2">
            <b>{profile.name}減碳重點：</b>{profile.mechanism}
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-start">
        <div className="xl:col-span-3">
          <FlowDiagram plant={plant} sim={sim} io={PLANT_IO[profile.id]} selNode={selNode} setSelNode={setSelNode} />
        </div>
        <div className="xl:col-span-2 scroll-mt-20" id="lc-node-panel">
          <NodePanel node={node} plant={plant} measures={measures} selected={selected} setSelected={setSelected}
            aiot={aiot} setAiot={setAiot} pct={pct} />
        </div>
      </div>

      <AiotCenter sim={sim} plant={plant} aiot={aiot} setAiot={setAiot} line={line} setLine={setLine} area={area} setArea={setArea}
        pct={pct} setPct={setPct} node={node} cases={data.reportCases} />

      <ResultDashboard sim={sim} emission={emission} feeRate={feeRate} />

      <Note>
        模擬方法：技術的減碳量、投資與年效益採低碳技術彙編案例實績（減碳量以 113 年電力係數換算）× 導入套數，原文缺投資或年效益者以同類別每公噸中位數推估；
        單一製程節點的技術減碳以該節點排放的 60% 為上限，超過時投資與效益同比例縮減。AI 三階段為情境假設：主製程節點只計能源相關排放的一半（化學反應排放 AI 無法改善），
        投資含感測、邊緣運算與 AI 模型導入，依節點規模放大；未監控的節能措施效益假設每年衰退 {MEASURE_DECAY * 100}%（設備劣化、操作偏離）。所有預設值皆為量級參考，正式評估需逐廠診斷。
      </Note>
    </div>
  );
}

// ---------- 工廠生產流程圖 ----------
function FlowDiagram({ plant, sim, io, selNode, setSelNode }) {
  const chain = sim.nodes.filter((n) => n.kinds[0] === 'process' || n.kinds[0] === 'thermal');
  const support = sim.nodes.filter((n) => !chain.includes(n));
  return (
    <Card title={`${plant.name}：生產流程圖`} subtitle="點選製程節點，在右側選擇要導入的減碳技術與 AIoT 監控。條狀圖：灰＝剩餘排放、綠＝技術減碳、紫＝AI 減碳。">
      <div className="flex flex-col md:flex-row md:items-stretch gap-2">
        <IoPill label="投入" text={io?.[0]} />
        {chain.map((n) => (
          <React.Fragment key={n.id}>
            <Arrow />
            <NodeCard n={n} on={selNode === n.id} onClick={() => setSelNode(n.id)} />
          </React.Fragment>
        ))}
        <Arrow />
        <IoPill label="產出" text={io?.[1]} />
      </div>
      <div className="mt-3 rounded-xl border-2 border-dashed border-slate-300 p-2.5">
        <div className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5"><Zap size={14} />能源與公用系統（供應蒸汽、電力、冷卻水、壓縮空氣給上方製程）</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {support.map((n) => <NodeCard key={n.id} n={n} on={selNode === n.id} onClick={() => setSelNode(n.id)} />)}
          <button onClick={() => setSelNode('site')}
            className={`text-left rounded-xl border p-3 bg-white ${selNode === 'site' ? 'ring-2 ring-brand border-brand' : 'border-brand-line hover:border-slate-400'}`}>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><Leaf size={16} className="text-emerald-600" />廠區綠能與碳管理</div>
            <div className="text-xs text-slate-500 mt-1">再生能源、CCUS、資源循環</div>
            <div className="text-xs text-slate-600 mt-1 num">{sim.site.items.length ? `已導入 ${sim.site.items.length} 項・−${fmtTon(sim.site.cut)}` : '尚未導入'}</div>
          </button>
        </div>
      </div>
    </Card>
  );
}

const IoPill = ({ label, text }) => (
  <div className="md:w-20 flex-shrink-0 rounded-xl bg-slate-100 border border-slate-200 px-2 py-2 flex md:flex-col items-center justify-center gap-1 text-center">
    <span className="text-xs font-bold text-slate-500">{label}</span>
    <span className="text-xs text-slate-700 leading-tight">{text}</span>
  </div>
);
const Arrow = () => (
  <div className="flex items-center justify-center text-slate-400 flex-shrink-0">
    <ArrowDown size={18} className="md:hidden" /><ArrowRight size={18} className="hidden md:block" />
  </div>
);

function NodeCard({ n, on, onClick }) {
  const Icon = KIND_ICON[n.kinds[0]] || Factory;
  const ai = n.aiPoint + n.aiLine + n.aiArea;
  const pctCut = n.base ? (n.base - n.after) / n.base : 0;
  return (
    <button onClick={onClick} className={`relative flex-1 min-w-0 text-left rounded-xl border p-3 bg-white transition-shadow ${on ? 'ring-2 ring-brand border-brand shadow-md' : 'border-brand-line hover:border-slate-400'}`}>
      {n.monitored && (
        <span className="absolute -top-2 right-2 flex items-center gap-1 text-[11px] font-bold text-white rounded-full px-2 py-0.5" style={{ background: AI_COLOR.point }}>
          <Radio size={11} className="animate-pulse" />AIoT {n.sensors} 點
        </span>
      )}
      <div className="flex items-start gap-2">
        <Icon size={18} className="text-slate-500 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <div className="text-[13px] md:text-sm font-bold text-slate-800 leading-snug">{n.title.split('（')[0]}</div>
          {n.title.includes('（') && <div className="text-xs text-slate-500 leading-snug">{n.title.slice(n.title.indexOf('（') + 1).replace('）', '')}</div>}
        </div>
      </div>
      <div className="mt-1.5 text-xs text-slate-500 num">{fmtTon(n.base)}（{Math.round(n.share * 100)}%）</div>
      <div className="mt-1.5 h-2.5 rounded-full bg-slate-200 overflow-hidden flex" aria-hidden>
        <div style={{ width: `${(n.after / n.base) * 100}%` }} className="bg-slate-400" />
        <div style={{ width: `${(n.cut / n.base) * 100}%`, background: TECH_COLOR }} />
        <div style={{ width: `${(ai / n.base) * 100}%`, background: AI_COLOR.line }} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
        <span className="num font-semibold text-slate-700">−{Math.round(pctCut * 100)}%</span>
        <span className="text-slate-500">技術 {n.items.length} 項</span>
      </div>
    </button>
  );
}

// ---------- 節點面板：技術選擇＋AIoT ----------
function NodePanel({ node, plant, measures, selected, setSelected, aiot, setAiot, pct }) {
  const [showAll, setShowAll] = useState(false);
  const isSite = node.id === 'site';
  const list = useMemo(() => measures.filter((m) => {
    const n = assignNode(plant, m.kind);
    return isSite ? !n : n?.id === node.id;
  }).sort((a, b) => (a.crossIndustry - b.crossIndustry) || ((b.co2 ?? -1) - (a.co2 ?? -1))), [measures, plant, node.id, isSite]);
  const shown = showAll ? list : list.slice(0, 10);
  const toggle = (id) => setSelected((s) => { const x = { ...s }; if (x[id]) delete x[id]; else x[id] = 1; return x; });
  const setQty = (id, q) => setSelected((s) => ({ ...s, [id]: Math.max(1, Math.min(10, q)) }));
  const kind = node.kinds?.[0];
  const on = !!aiot[node.id];
  return (
    <Card title={isSite ? '廠區綠能與碳管理' : node.title}
      subtitle={isSite ? '再生能源、CCUS、資源循環等全廠層級措施（上限為全廠排放 30%）' : `${KIND_LABEL[kind] || ''}節點・基準排放 ${fmtTon(node.base)}，技術減碳上限為節點排放的 60%`}>
      {!isSite && (
        <div className={`rounded-xl border p-3 mb-3 ${on ? 'border-violet-300 bg-violet-50' : 'border-brand-line'}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><Radio size={16} style={{ color: AI_COLOR.point }} />在此節點導入 AIoT 監控</div>
            <Switch on={on} onChange={(v) => setAiot((s) => ({ ...s, [node.id]: v }))} label="AIoT 監控" />
          </div>
          <div className="text-xs text-slate-600 mt-1.5 leading-relaxed">
            感測：{(SENSOR_TYPES[kind] || []).join('、')}；AI 異常偵測與參數最佳化約可再省 {pct[kind] ?? 2}%{kind === 'process' ? '（只計能源相關的一半）' : ''}。
            {on && <span className="num">本節點 −{fmtTon(node.aiPoint)}／年，投資約 {fmtWan(node.aiInvPoint)}。</span>}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-bold text-slate-700">可導入的減碳技術（{list.length}）</span>
        <span className="text-xs text-slate-500">勾選並設定套數</span>
      </div>
      {list.length === 0 && <p className="text-sm text-slate-500 py-4">彙編中尚無對應此節點的案例。</p>}
      <ul className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto -mx-1 px-1">
        {shown.map((m) => {
          const sel = !!selected[m.id];
          const lc = measureLcoa(m);
          return (
            <li key={m.id} className={`py-2 flex items-start gap-2 ${m.co2 == null ? 'opacity-60' : ''}`}>
              <button onClick={() => toggle(m.id)} aria-label={sel ? '取消導入' : '導入'} className="mt-0.5 flex-shrink-0">
                {sel ? <CheckSquare size={20} className="text-brand" /> : <Square size={20} className="text-slate-400" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800 leading-snug">{m.c.tech_name}</div>
                <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-1.5 items-center">
                  <span className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLOR[m.c.category] }} />{m.c.subcategory}
                  <span>・{m.c.company || m.c.industry}</span>
                  {m.crossIndustry && <span className="text-sky-700 bg-sky-50 border border-sky-200 rounded px-1">跨產業</span>}
                  {(m.invEst || m.benefitEst || m.estimated) && <span className="text-amber-800 bg-amber-50 border border-amber-200 rounded px-1">含推估</span>}
                </div>
                <div className="text-xs text-slate-600 num mt-0.5">
                  {m.co2 != null ? `減碳 ${fmtTon(m.co2)}` : '原文未量化'}・投資 {fmtWan(m.inv)}・回收 {fmtYears(paybackOf(m.c))}・均化 {fmtCost(lc)}/t
                </div>
              </div>
              {sel && (
                <div className="flex items-center gap-1 flex-shrink-0" title="導入套數">
                  <button onClick={() => setQty(m.id, selected[m.id] - 1)} className="w-7 h-7 rounded border border-brand-line">−</button>
                  <span className="num w-5 text-center text-sm">{selected[m.id]}</span>
                  <button onClick={() => setQty(m.id, selected[m.id] + 1)} className="w-7 h-7 rounded border border-brand-line">＋</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {list.length > 10 && (
        <button onClick={() => setShowAll((s) => !s)} className="mt-2 text-sm text-brand">{showAll ? '收合' : `顯示全部 ${list.length} 項`}</button>
      )}
    </Card>
  );
}

const Switch = ({ on, onChange, label, disabled }) => (
  <button role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
    className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${disabled ? 'bg-slate-200 cursor-not-allowed' : on ? 'bg-violet-600' : 'bg-slate-300'}`}>
    <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`} />
  </button>
);

// ---------- AIoT 監控中心 ----------
function AiotCenter({ sim, plant, aiot, setAiot, line, setLine, area, setArea, pct, setPct, node, cases }) {
  const [adv, setAdv] = useState(false);
  const allOn = plant.nodes.every((n) => aiot[n.id]);
  const evidence = useMemo(() => cases.filter((c) => c.is_latest !== false && AI_KEYWORDS.test(c.tech_name) && (c.co2_t || c.electricity_kwh)), [cases]);
  const monNode = node.id !== 'site' && node.monitored ? node : sim.nodes.find((n) => n.monitored);
  const mech = [
    { icon: Activity, name: '異常偵測', desc: '洩漏、溫差偏離、空轉等浪費即時告警', t: sim.ai.point.cut * 0.5 },
    { icon: Gauge, name: '參數最佳化', desc: '依負載即時調整設定值（冰水溫度、壓力、風量）', t: sim.ai.point.cut * 0.5 },
    { icon: Network, name: '聯控與調度', desc: '跨設備群控、熱整合、全廠能源與需量調度', t: sim.ai.line.cut + sim.ai.area.cut },
    { icon: Wrench, name: '效益維持', desc: '預測維護，避免技術效益逐年衰退（10 年平均；另計，不含在 AI 減碳內）', t: sim.persistCut },
  ];
  return (
    <div className="rounded-2xl bg-slate-900 text-slate-100 p-4 md:p-5 shadow-lg">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2">
        <div>
          <div className="text-xs font-bold tracking-[0.15em] text-violet-300">AIoT MONITORING CENTER</div>
          <h2 className="text-lg md:text-xl font-black text-white mt-0.5 flex items-center gap-2"><BrainCircuit size={22} className="text-violet-300" />AI 監控中心：技術＋AI 的深度減碳</h2>
          <p className="text-[13px] text-slate-300 mt-1 leading-relaxed">導入減碳技術後，再以 AIoT 監控（點）→ 產線聯控（線）→ 全廠調度（面）逐層加深減碳，並維持技術效益不衰退。</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Chip k="監控節點" v={`${sim.monitored}／${plant.nodes.length}`} />
          <Chip k="感測點" v={`${sim.sensors} 點`} />
          <Chip k="資料頻率" v="每分鐘" />
          <Chip k="AI 減碳" v={`${fmtTon(sim.aiCut)}／年`} hi />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        <StageCard s={AI_STAGES[0]} cut={sim.ai.point.cut} inv={sim.ai.point.inv} active={sim.monitored > 0}
          control={<button onClick={() => setAiot(Object.fromEntries(plant.nodes.map((n) => [n.id, !allOn])))} className="h-9 px-3 rounded-lg bg-violet-600 text-white text-[13px] font-semibold">{allOn ? '取消全部監控' : '全部節點導入監控'}</button>}
          hint={`已監控 ${sim.monitored} 個節點；也可在流程圖逐一開啟`} />
        <StageCard s={AI_STAGES[1]} cut={sim.ai.line.cut} inv={sim.ai.line.inv} active={sim.lineOn}
          control={<Switch on={line && sim.monitored >= 2} onChange={setLine} disabled={sim.monitored < 2} label="產線聯控" />}
          hint={sim.monitored < 2 ? '需至少 2 個節點導入 AIoT 監控' : '監控中的主製程與熱能節點協同控制'} />
        <StageCard s={AI_STAGES[2]} cut={sim.ai.area.cut} inv={sim.ai.area.inv} active={sim.areaOn}
          control={<Switch on={area && sim.lineOn} onChange={setArea} disabled={!sim.lineOn} label="全廠調度" />}
          hint={!sim.lineOn ? '需先啟用產線聯控' : '全廠能源、需量與蒸汽平衡調度'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mt-4">
        <div className="xl:col-span-3 rounded-xl bg-slate-800/80 border border-slate-700 p-3">
          <LiveMonitor n={monNode} />
        </div>
        <div className="xl:col-span-2 grid grid-cols-2 gap-2 content-start">
          {mech.map((x) => {
            const Icon = x.icon;
            return (
              <div key={x.name} className="rounded-xl bg-slate-800/80 border border-slate-700 p-3">
                <div className="flex items-center gap-1.5 text-sm font-bold text-white"><Icon size={15} className="text-violet-300" />{x.name}</div>
                <div className="num text-lg font-extrabold text-violet-200 mt-1">−{fmtTon(x.t)}</div>
                <div className="text-xs text-slate-400 leading-snug mt-0.5">{x.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <button onClick={() => setAdv((s) => !s)} className="text-[13px] text-violet-200 underline">{adv ? '收合' : '調整'} AI 節能幅度假設</button>
          {adv && (
            <div className="mt-2 grid grid-cols-2 gap-3 rounded-xl bg-slate-800/80 border border-slate-700 p-3">
              {[['utility', '監控：公用系統'], ['thermal', '監控：熱能'], ['fuel', '監控：鍋爐燃料'], ['process', '監控：主製程'], ['line', '產線聯控'], ['area', '全廠調度']].map(([k, label]) => (
                <label key={k} className="text-xs text-slate-300">
                  <div className="flex justify-between"><span>{label}</span><span className="num font-bold text-white">{pct[k]}%</span></div>
                  <input type="range" min={0} max={k === 'utility' ? 15 : 10} step={0.5} value={pct[k]} onChange={(e) => setPct((p) => ({ ...p, [k]: Number(e.target.value) }))} className="w-full accent-violet-400" />
                </label>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="text-[13px] font-bold text-slate-200 mb-1">低碳技術彙編中的 AI／智慧控制實績（{evidence.length} 件）</div>
          <ul className="text-xs text-slate-300 divide-y divide-slate-700">
            {evidence.slice(0, 6).map((c) => (
              <li key={c.case_id} className="py-1.5">
                <span className="text-slate-100 font-medium">{c.tech_name}</span>
                <span className="text-slate-400">・{c.company || c.industry}・{c.co2_t ? `年減碳 ${fmtTon(c.co2_t)}` : `年節電 ${fmtNum(c.electricity_kwh)} kWh`}{c.investment_wan ? `・投資 ${fmtWan(c.investment_wan)}` : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

const Chip = ({ k, v, hi }) => (
  <span className={`rounded-lg border px-2.5 py-1.5 ${hi ? 'border-violet-400 bg-violet-500/20 text-white' : 'border-slate-600 bg-slate-800 text-slate-200'}`}>
    <span className="text-slate-400 mr-1">{k}</span><b className="num">{v}</b>
  </span>
);

function StageCard({ s, cut, inv, active, control, hint }) {
  return (
    <div className={`rounded-xl border p-3 ${active ? 'border-violet-400 bg-violet-500/10' : 'border-slate-700 bg-slate-800/60'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs text-slate-400">{s.layer}狀</div>
          <div className="text-base font-bold text-white flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: s.color }} />{s.name}</div>
        </div>
        {control}
      </div>
      <div className="text-xs text-slate-300 mt-1 leading-snug">{s.desc}</div>
      <div className="mt-2 flex gap-4 text-sm">
        <div><div className="text-xs text-slate-400">年減碳</div><div className="num font-bold text-white">{active ? `−${fmtTon(cut)}` : '—'}</div></div>
        <div><div className="text-xs text-slate-400">投資</div><div className="num font-bold text-white">{active ? fmtWan(inv) : '—'}</div></div>
      </div>
      <div className="text-xs text-slate-400 mt-1">{hint}</div>
    </div>
  );
}

// 即時監控（模擬示意）：未最佳化負載 vs AI 最佳化後，標出 AI 偵測到的異常
const ANOMALY = {
  utility: ['壓縮空氣洩漏', '冰水溫差偏離'], thermal: ['蒸汽疏水器失效', '排氣溫度偏高'], fuel: ['過剩空氣比偏高', '燃燒器結焦'],
  process: ['設備空轉', '負載配置不均'],
};
function LiveMonitor({ n }) {
  if (!n) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-center text-slate-400 text-sm gap-2">
        <Cpu size={28} />尚未導入 AIoT 監控。點選流程圖節點並開啟監控，即可看到 AI 偵測與最佳化的示意。
      </div>
    );
  }
  const kind = n.kinds[0];
  const hourly = n.base / 8760;
  const saving = n.base ? (n.aiPoint + n.aiLine + n.aiArea) / (n.base - n.cut || 1) : 0;
  const series = Array.from({ length: 24 }, (_, h) => {
    const shape = 0.85 + 0.25 * Math.max(0, Math.sin(((h - 6) / 24) * 2 * Math.PI)) + 0.05 * Math.sin(h * 1.9);
    const spike = h === 3 || h === 15 ? 0.18 : 0;
    const raw = hourly * (1 - n.cut / n.base) * (shape + spike);
    return { h: `${String(h).padStart(2, '0')}:00`, raw, ai: hourly * (1 - n.cut / n.base) * shape * (1 - saving), spike: !!spike };
  });
  const [a1, a2] = ANOMALY[kind] || ANOMALY.process;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-sm font-bold text-white flex items-center gap-1.5"><Radio size={14} className="text-violet-300 animate-pulse" />{n.title}</div>
        <span className="text-xs text-slate-400">即時碳流率（模擬示意，公噸CO2e/小時）</span>
      </div>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <LineChart data={series} margin={{ top: 30, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="h" tick={{ fontSize: 12, fill: '#94a3b8' }} interval={3} tickLine={false} axisLine={{ stroke: '#475569' }} />
            <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} width={48} tickFormatter={(v) => fmtNum(v, 1)} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
            <Tooltip content={({ active, payload, label }) => (active && payload?.length ? (
              <TipBox title={`${label}（模擬）`} rows={[
                ['未最佳化', `${fmtNum(payload[0].payload.raw, 2)} t/h`, '#94a3b8'],
                ['AI 最佳化後', `${fmtNum(payload[0].payload.ai, 2)} t/h`, AI_COLOR.point],
                payload[0].payload.spike ? ['AI 告警', payload[0].payload.h === '03:00' ? a1 : a2] : null,
              ]} />
            ) : null)} />
            <Legend verticalAlign="bottom" height={24} wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />
            <Line name="未最佳化（含浪費）" dataKey="raw" stroke="#94a3b8" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line name="AI 最佳化後" dataKey="ai" stroke={AI_COLOR.point} strokeWidth={2.5} dot={false} isAnimationActive={false} />
            {series.filter((d) => d.spike).map((d, i) => (
              <ReferenceDot key={d.h} x={d.h} y={d.raw} r={6} fill="#f97316" stroke="#fff" strokeWidth={1.5}
                label={{ value: `⚠ ${i ? a2 : a1}`, position: 'top', fill: '#fdba74', fontSize: 12 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------- 導入效益儀表板 ----------
function ResultDashboard({ sim, emission, feeRate }) {
  const stageColor = { base: '#64748b', tech: TECH_COLOR, point: AI_COLOR.point, line: AI_COLOR.line, area: AI_COLOR.area };
  const data = sim.stages.map((s) => ({ ...s, fill: stageColor[s.id] }));
  const zoom = sim.rate < 0.3;
  const yMin = zoom ? Math.floor((sim.after - (emission - sim.after) * 0.8) / 10 ** Math.floor(Math.log10(Math.max(1, sim.after)))) * 10 ** Math.floor(Math.log10(Math.max(1, sim.after))) : 0;
  const items = [
    ...sim.nodes.flatMap((n) => n.items.map((it) => ({ ...it, where: n.title }))),
    ...sim.site.items.map((it) => ({ ...it, where: '廠區' })),
  ].map((it) => ({
    key: it.m.id, name: it.m.c.tech_name, where: it.where, qty: it.qty, co2: it.co2, inv: it.inv, benefit: it.benefit, kind: 'tech',
    lcoa: it.co2 > 0 ? ((it.inv * CRF10 - it.benefit) * 1e4) / it.co2 : null, payback: it.benefit > 0 ? it.inv / it.benefit : null,
  }));
  for (const s of AI_STAGES) {
    const a = sim.ai[s.id];
    if (a.cut > 0) {
      items.push({
        key: s.id, name: s.name, where: s.id === 'point' ? `${sim.monitored} 個節點` : '全廠', co2: a.cut, inv: a.inv, benefit: a.benefit, kind: s.id,
        lcoa: ((a.inv * CRF10 - a.benefit) * 1e4) / a.cut, payback: a.benefit > 0 ? a.inv / a.benefit : null,
      });
    }
  }
  items.sort((a, b) => (a.lcoa ?? Infinity) - (b.lcoa ?? Infinity));
  const maxCo2 = Math.max(1, ...items.map((i) => i.co2));
  const breakeven = (key) => sim.cash.find((c) => c[key] >= 0)?.year;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-black text-brand-ink flex items-center gap-2"><Gauge size={20} />導入效益儀表板</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        <Kpi icon={Factory} label="基準排放" value={fmtTon(emission)} />
        <Kpi icon={Leaf} label="導入後排放" value={fmtTon(sim.after)} note={`減碳率 ${(sim.rate * 100).toFixed(1)}%`} />
        <Kpi label="技術減碳" value={fmtTon(sim.techCut)} note={`投資 ${fmtWan(sim.techInv)}`} />
        <Kpi tone="dark" label="AI 加碼減碳" value={fmtTon(sim.aiCut)} note={`投資 ${fmtWan(sim.aiInv)}`} />
        <Kpi label="總投資" value={fmtWan(sim.totalInv)} note={`年效益 ${fmtWan(sim.totalBenefit)}（含碳費 ${fmtWan(sim.feeSaving)}）`} />
        <Kpi icon={Timer} label="整體回收年限" value={fmtYears(sim.payback)} note={`僅技術 ${fmtYears(sim.techPayback)}`} />
        <Kpi label="均化減碳成本" value={fmtCost(sim.lcoaAll)} unit="/t" note={`投資攤提 ${fmtCost(sim.amortAll)}/t`} />
      </div>
      {(sim.capped || sim.unquantified > 0) && (
        <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {sim.capped && '部分節點的技術減碳超過節點排放 60%（案例工廠規模可能大於本廠），已截斷並同比例縮減投資與效益。'}
          {sim.unquantified > 0 && ` 另有 ${sim.unquantified} 項已勾選技術原文未量化減碳量，未計入。`}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="深度減碳路徑" subtitle={`每一階段導入後的年排放量（公噸CO2e）${zoom ? `；縱軸由 ${fmtNum(yMin)} 起算以放大差異` : ''}`}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <BarChart data={data} margin={{ top: 22, right: 8, left: 4, bottom: 0 }} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ ...AXIS_TICK, fill: '#334155' }} interval={0} tickLine={false} />
                <YAxis tick={AXIS_TICK} width={58} axisLine={false} tickLine={false} domain={[yMin, 'auto']} allowDataOverflow
                  tickFormatter={(v) => (v >= 1e4 ? `${fmtNum(v / 1e4, 1)}萬` : fmtNum(v))} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} content={({ active, payload }) => (active && payload?.length ? (
                  <TipBox title={payload[0].payload.label} rows={[
                    ['年排放', fmtTon(payload[0].payload.emission), payload[0].payload.fill],
                    payload[0].payload.cut != null ? ['本階段減碳', `−${fmtTon(payload[0].payload.cut)}`] : null,
                    payload[0].payload.inv != null ? ['本階段投資', fmtWan(payload[0].payload.inv)] : null,
                  ]} />
                ) : null)} />
                <Bar dataKey="emission" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {data.map((d) => <Cell key={d.id} fill={d.fill} />)}
                  <LabelList dataKey="emission" position="top" fontSize={12} fill="#334155" formatter={(v) => (v >= 1e4 ? `${fmtNum(v / 1e4, 1)}萬` : fmtNum(v))} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-4 gap-1 mt-2 text-center text-xs">
            {sim.stages.slice(1).map((s) => (
              <div key={s.id} className="rounded-lg bg-brand-ground border border-brand-line py-1.5">
                <div className="text-slate-500">{s.label.replace('＋', '')}</div>
                <div className="num font-bold text-slate-800">−{fmtTon(s.cut)}</div>
                <div className="num text-slate-500">{fmtWan(s.inv)}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="10 年累計淨現金流" subtitle={`萬元；含能源節省與碳費（${feeRate} 元/公噸）。僅技術時節能效益每年衰退 ${MEASURE_DECAY * 100}%，AIoT 監控節點不衰退。`}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <LineChart data={sim.cash} margin={{ top: 10, right: 16, left: 4, bottom: 0 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" tick={AXIS_TICK} tickFormatter={(v) => `${v}年`} tickLine={false} />
                <YAxis tick={AXIS_TICK} width={64} axisLine={false} tickLine={false} tickFormatter={(v) => (Math.abs(v) >= 1e4 ? `${fmtNum(v / 1e4, 1)}億` : fmtNum(v))} />
                <ReferenceLine y={0} stroke="#64748b" />
                <Tooltip content={({ active, payload, label }) => (active && payload?.length ? (
                  <TipBox title={`第 ${label} 年`} rows={[
                    ['僅技術', fmtWan(payload[0].payload.tech), TECH_COLOR],
                    ['技術＋AI', fmtWan(payload[0].payload.techAi), AI_COLOR.area],
                  ]} />
                ) : null)} />
                <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: 12 }} />
                <Line name="僅技術" dataKey="tech" stroke={TECH_COLOR} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
                <Line name="技術＋AI" dataKey="techAi" stroke={AI_COLOR.area} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            第 10 年累計：僅技術 <b className="num">{fmtWan(sim.cash[10].tech)}</b>，技術＋AI <b className="num">{fmtWan(sim.cash[10].techAi)}</b>；
            回本年：{breakeven('tech') ?? '10 年以上'}{breakeven('tech') != null ? ' 年' : ''}／{breakeven('techAi') ?? '10 年以上'}{breakeven('techAi') != null ? ' 年' : ''}。
          </p>
        </Card>
      </div>

      <Card title={`導入項目：投資與減碳效益對照（${items.length} 項）`} subtitle="依均化減碳成本由低到高排序（折現率 5%、壽命 10 年）；條長為年減碳量。">
        {items.length === 0 ? <p className="text-sm text-slate-500 py-6 text-center">尚未導入任何技術或 AI</p> : (
          <ul className="divide-y divide-slate-100">
            {items.map((it) => (
              <li key={it.key} className="py-2 grid grid-cols-1 md:grid-cols-12 gap-x-3 gap-y-1 items-center">
                <div className="md:col-span-4 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 leading-snug flex items-center gap-1.5">
                    {it.kind !== 'tech' && <BrainCircuit size={14} style={{ color: AI_COLOR[it.kind] }} />}{it.name}{it.qty > 1 ? ` ×${it.qty}` : ''}
                  </div>
                  <div className="text-xs text-slate-500">{it.where}</div>
                </div>
                <div className="md:col-span-3 flex items-center gap-2">
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(it.co2 / maxCo2) * 100}%`, background: it.kind === 'tech' ? TECH_COLOR : AI_COLOR[it.kind] }} />
                  </div>
                  <span className="num text-xs w-20 text-right">−{fmtTon(it.co2)}</span>
                </div>
                <div className="md:col-span-5 grid grid-cols-4 gap-2 text-xs num">
                  <div><div className="text-slate-400 md:hidden">投資</div>{fmtWan(it.inv)}</div>
                  <div><div className="text-slate-400 md:hidden">年效益</div>{fmtWan(it.benefit)}</div>
                  <div><div className="text-slate-400 md:hidden">回收</div>{fmtYears(it.payback)}</div>
                  <div className="font-semibold"><div className="text-slate-400 md:hidden font-normal">均化成本</div>{fmtCost(it.lcoa)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="hidden md:grid grid-cols-12 gap-x-3 text-xs text-slate-400 border-t border-brand-line pt-1.5 mt-1">
          <div className="col-span-7" /><div className="col-span-5 grid grid-cols-4 gap-2"><span>投資</span><span>年效益</span><span>回收</span><span>均化成本/t</span></div>
        </div>
      </Card>
    </div>
  );
}
