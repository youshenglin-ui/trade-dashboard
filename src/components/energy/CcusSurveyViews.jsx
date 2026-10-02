// ==========================================
// CCUS 問卷資料頁面：整合地圖（疊圖）、碳捕捉、碳封存、碳再利用
// ==========================================
// 資料：Supabase 問卷整併表（src/lib/energy/fetchEnergySurvey.js），數值一律來自資料庫。
// 捕捉 / 封存 / 再利用 三個領域分開呈現；整合地圖可勾選圖層疊加。
// 介面改版時：這幾個 View 都只吃 props（data / onOpenTrade），可直接放進新版版面。
import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Label, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts';
import { Box, ExternalLink, Factory, FlaskConical, Map as MapIcon, Rocket, Thermometer } from 'lucide-react';
import { ErrorBoundary } from '../SharedComponents';
import TaiwanLayerMap, { LegendSwatch } from '../maps/TaiwanLayerMap';
import { AnswersTable, Badge, Card, Collapsible, DataTable, ErrorBlock, Kpi, LoadingBlock } from './ui';
import CcusCostCompare from './CcusCostCompare';
import CcuCaseList from './CcuCaseList';
import { fetchCcuProductPrices } from '../../lib/energy/fetchEnergySurvey';
import { useCcusSurvey } from '../../lib/energy/useEnergySurvey';
import { buildCcusLayers } from '../../lib/energy/ccusLayers';
import {
  ccusSummary, concentrationClass, fmtWt, latestPrice, paramsByKey, programShort, sum,
} from '../../lib/energy/energyMetrics';
import { CAT, CCUS_LAYERS, NEUTRAL, PROGRAM_COLOR } from '../../lib/energy/palette';

const AXIS_TICK = { fontSize: 11, fill: '#64748b' };
const GRID = '#e2e8f0';

const yearOptions = (rows) => ['ALL', ...Array.from(new Set(rows.map((r) => r.survey_year))).filter(Boolean).sort()];
const inYear = (year) => (r) => year === 'ALL' || r.survey_year === Number(year);

function YearSelect({ value, onChange, years }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold px-2 py-1 rounded-lg">
      {years.map((y) => <option key={y} value={y}>{y === 'ALL' ? '全部調查年度' : `${y}年調查`}</option>)}
    </select>
  );
}

const ProgramBadge = ({ program }) => <Badge tone={programShort(program) === '環境部旗艦' ? 'amber' : 'blue'}>{programShort(program)}</Badge>;

// ==========================================
// 1. 整合地圖（捕捉 / 封存 / 再利用 / 規劃 疊圖）
// ==========================================
function useCcuPrices() {
  const [rows, setRows] = useState([]);
  useEffect(() => { fetchCcuProductPrices().then(setRows).catch(() => setRows([])); }, []);
  return rows;
}

export function CcusOverviewView({ data, onOpenTrade }) {
  const [year, setYear] = useState('ALL');
  const priceRows = useCcuPrices();
  const years = yearOptions([...data.sources, ...data.captures, ...data.plans, ...data.utilization]);
  const layers = useMemo(() => buildCcusLayers(data, { year, onOpenTrade, priceRows }), [data, year, onOpenTrade, priceRows]);
  const summary = useMemo(() => ccusSummary(data), [data]);
  const missing = layers.flatMap((l) => l.points.filter((p) => p.lat == null).map((p) => `${l.label}：${p.title}`));

  return (
    <div className="space-y-4">
      <Card
        title="CCUS 價值鏈整合地圖"
        subtitle="點選上方圖層可開關疊圖；點位大小依量體（同圖層內相對比例），點擊點位看明細。同一工業區多家廠商會自動錯開。"
        icon={MapIcon}
        right={<YearSelect value={year} onChange={setYear} years={years} />}
      >
        <TaiwanLayerMap
          layers={layers}
          defaultActive={['sources', 'capture', 'plans', 'utilization', 'storage']}
          height="min(680px, 70vh)"
          footnote="座標：廠區主檔地址經 OpenStreetMap 定位（部分為人工校正，見資料表 energy_plants.coord_source）；管網樞紐為規劃情境假設。"
        />
        {missing.length > 0 && <p className="text-[11px] text-amber-700 mt-2">無座標未上圖：{missing.join('；')}</p>}
      </Card>

      <Card title="各年度彙總（由事實表即時計算，對應問卷「總覽」分頁）" subtitle="單位：萬噸CO₂/年。產發署（製造部門淨零轉型）與環境部（CCUS旗艦）屬不同委辦計畫，對外引用請分開呈現。">
        <DataTable
          rows={summary}
          rowKey={(r) => `${r.survey_year}-${r.program}`}
          columns={[
            { key: 'survey_year', label: '調查年度' },
            { key: 'program', label: '計畫/問卷', render: (r) => <ProgramBadge program={r.program} /> },
            { key: 'emission', label: '具捕捉潛力排放源', align: 'right', render: (r) => fmtWt(r.emission, 4) },
            { key: 'capture', label: '已裝置捕捉量', align: 'right', render: (r) => fmtWt(r.capture, 4) },
            { key: 'unitEmission', label: '捕捉單元排放', align: 'right', render: (r) => fmtWt(r.unitEmission, 4) },
            { key: 'net', label: '淨捕捉量', align: 'right', render: (r) => fmtWt(r.net, 4) },
            { key: 'planned', label: '規劃新增捕捉量能', align: 'right', render: (r) => fmtWt(r.planned, 3) },
            { key: 'ccuDemand', label: 'CCU/去化CO₂需求', align: 'right', render: (r) => fmtWt(r.ccuDemand, 4) },
          ]}
        />
        <p className="text-[11px] text-slate-500 mt-2">115年產發署問卷長春未填捕捉單元排放，故該年淨捕捉量為 0（非實際無排放）。規劃量能不含台塑化「CCS潛在需求」126萬噸（假定封存場域備妥下的潛在需求）。</p>
      </Card>

      <AssistanceCard rows={data.assistance} />
    </div>
  );
}

// 政府協助需求：歸納議題次數 + 原文
export function AssistanceCard({ rows, title = '期待政府協助（問卷原文與歸納議題）' }) {
  const counts = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => (r.issues || []).forEach((i) => m.set(i, (m.get(i) || 0) + 1)));
    return [...m.entries()].map(([issue, n]) => ({ issue, n })).sort((a, b) => b.n - a.n);
  }, [rows]);
  return (
    <Card title={title} subtitle={`共 ${rows.length} 則回覆`}>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 h-[260px]">
          <ErrorBoundary>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={counts} layout="vertical" margin={{ top: 4, right: 30, left: 10, bottom: 4 }}>
                <CartesianGrid stroke={GRID} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} />
                <YAxis type="category" dataKey="issue" width={130} tick={AXIS_TICK} interval={0} />
                <Tooltip formatter={(v) => [`${v} 則`, '提及次數']} />
                <Bar dataKey="n" fill={CAT[0]} radius={[0, 4, 4, 0]} barSize={14} label={{ position: 'right', fontSize: 11, fill: '#475569' }} />
              </BarChart>
            </ResponsiveContainer>
          </ErrorBoundary>
        </div>
        <div className="lg:col-span-3">
          <DataTable
            maxHeight={260}
            rows={rows}
            columns={[
              { key: 'short_name', label: '廠商', className: 'font-bold whitespace-nowrap' },
              { key: 'survey_year', label: '年度' },
              { key: 'content', label: '內容（原文）', render: (r) => <span className="leading-relaxed">{r.content}</span> },
              { key: 'issues', label: '歸納議題', render: (r) => <div className="flex flex-wrap gap-1">{(r.issues || []).map((i) => <Badge key={i}>{i}</Badge>)}</div> },
            ]}
          />
        </div>
      </div>
    </Card>
  );
}

// ==========================================
// 2. 碳捕捉（點源煙氣性質、已裝置設施、規劃）
// ==========================================
function FlueGasTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs max-w-[260px]">
      <div className="font-bold text-slate-800">{r.short_name}｜{r.source_desc}</div>
      <div className="text-slate-500 mb-1">{r.survey_year}年 {programShort(r.program)}</div>
      <div>溫度：<b>{r.temp_raw ?? '—'}</b> ℃{r.temp_raw && String(r.temp_c) !== r.temp_raw ? `（圖上取 ${r.temp_c}）` : ''}</div>
      <div>CO₂濃度：<b>{r.co2_conc_raw ?? '—'}</b> %{r.co2_conc_raw && String(r.co2_conc_pct) !== r.co2_conc_raw ? `（圖上取 ${r.co2_conc_pct}）` : ''}</div>
      <div>壓力：<b>{r.pressure_raw ?? '—'}</b> {r.pressure_unit || ''}{r.pressure_bar != null ? `（≈ ${r.pressure_bar.toFixed(2)} bar）` : ''}</div>
      <div>排放量：<b>{r.emission_wt != null ? `${fmtWt(r.emission_wt)} 萬噸/年` : '未填'}</b></div>
    </div>
  );
}

export function CcusCaptureView({ data }) {
  const years = yearOptions([...data.sources, ...data.captures]);
  // 預設最新調查年度：跨年度加總會把同一廠不同年度的申報重複計入
  const [year, setYear] = useState(String(years[years.length - 1]));
  const sources = data.sources.filter(inYear(year));
  const captures = data.captures.filter(inYear(year));
  const plans = data.plans.filter(inYear(year)).filter((r) => r.stage === 'capture' || r.stage === 'ccs');

  const plotted = sources.filter((r) => r.temp_c != null && r.co2_conc_pct != null)
    .map((r) => ({ ...r, z: r.emission_wt ?? 0.5, programKey: programShort(r.program) }));
  const unplotted = sources.filter((r) => r.temp_c == null || r.co2_conc_pct == null);
  const programs = [...new Set(plotted.map((r) => r.programKey))];

  const captureBars = captures.filter((r) => r.capture_wt != null).map((r) => ({
    name: `${r.short_name}｜${r.source_process}`.slice(0, 22), capture: r.capture_wt, unit: r.unit_emission_wt, net: r.net_capture_wt, raw: r,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {year === 'ALL' && <span className="text-[11px] text-amber-700">全部年度為跨年度加總，同一廠不同年度的申報會重複計入，僅供檢視明細。</span>}
        <YearSelect value={year} onChange={setYear} years={years} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="具捕捉潛力排放源" value={fmtWt(sum(sources, 'emission_wt'), 1)} unit="萬噸/年" note={`${sources.length} 個排放源（有填排放量 ${sources.filter((r) => r.emission_wt != null).length}）`} />
        <Kpi label="已裝置捕捉量" value={fmtWt(sum(captures, 'capture_wt'), 3)} unit="萬噸/年" note={`${captures.length} 筆設施`} />
        <Kpi label="淨捕捉量（扣除捕捉單元排放）" value={fmtWt(sum(captures, 'net_capture_wt'), 3)} unit="萬噸/年" note="淨捕捉量＝捕捉量−捕捉單元自身碳排" />
        <Kpi label="規劃新增捕捉量能" value={fmtWt(sum(plans.filter((r) => r.plan_type !== 'CCS潛在需求'), 'capacity_wt'), 2)} unit="萬噸/年" note="不含 CCS 潛在需求" />
      </div>

      <Card
        title="點源煙氣性質：溫度 × CO₂濃度"
        subtitle="濃度越高、壓力越高，捕捉能耗與成本越低；≥20% 多為製程氣（氫廠尾氣、丙烯醇/醋酸乙烯酯製程氣），<10% 多為燃燒後煙道氣。圓點大小＝排放量。區間值取中點。"
        icon={Thermometer}
      >
        <div className="h-[380px]">
          <ErrorBoundary>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 16, right: 24, bottom: 28, left: 8 }}>
                <CartesianGrid stroke={GRID} />
                <XAxis type="number" dataKey="temp_c" tick={AXIS_TICK} domain={[(min) => Math.floor((min - 20) / 50) * 50, (max) => Math.ceil((max + 20) / 50) * 50]}>
                  <Label value="溫度 (℃)" position="insideBottom" offset={-14} fontSize={11} fill="#475569" />
                </XAxis>
                <YAxis type="number" dataKey="co2_conc_pct" tick={AXIS_TICK} domain={[0, 100]}>
                  <Label value="CO₂濃度 (%)" angle={-90} position="insideLeft" fontSize={11} fill="#475569" />
                </YAxis>
                <ZAxis type="number" dataKey="z" range={[60, 900]} />
                <ReferenceLine y={20} stroke={NEUTRAL} strokeDasharray="4 4" label={{ value: '高濃度製程氣 20%', position: 'insideTopRight', fontSize: 10, fill: '#64748b' }} />
                <ReferenceLine y={10} stroke={NEUTRAL} strokeDasharray="2 4" label={{ value: '10%', position: 'insideTopRight', fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip content={<FlueGasTooltip />} />
                <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: 11 }} />
                {programs.map((prog) => (
                  <Scatter key={prog} name={prog} data={plotted.filter((r) => r.programKey === prog)} fill={PROGRAM_COLOR[prog] || NEUTRAL} fillOpacity={0.75} stroke="#fff" strokeWidth={2} />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </ErrorBoundary>
        </div>
        {unplotted.length > 0 && <p className="text-[11px] text-slate-500">未上圖（溫度或濃度未填）：{unplotted.map((r) => `${r.short_name}·${r.source_desc || '未填排放單元'}`).join('、')}</p>}
      </Card>

      <Card title="排放源煙氣條件明細" subtitle="原文與解析值並列；壓力統一換算 bar（115年問卷原單位 MPa）。">
        <DataTable
          rows={sources}
          initialSort={{ key: 'emission_wt', dir: 'desc' }}
          columns={[
            { key: 'survey_year', label: '年度' },
            { key: 'program', label: '計畫', render: (r) => <ProgramBadge program={r.program} /> },
            { key: 'short_name', label: '廠區', className: 'font-bold whitespace-nowrap' },
            { key: 'source_desc', label: '排放源/捕捉位置' },
            { key: 'emission_wt', label: '排放量(萬噸)', align: 'right', render: (r) => fmtWt(r.emission_wt, 4) },
            { key: 'temp_raw', label: '溫度(℃)', align: 'right', sortValue: (r) => r.temp_c },
            { key: 'pressure_raw', label: '壓力(原文)', render: (r) => (r.pressure_raw ? `${r.pressure_raw} ${r.pressure_unit || ''}` : '—') },
            { key: 'pressure_bar', label: '≈bar', align: 'right', render: (r) => (r.pressure_bar != null ? r.pressure_bar.toFixed(2) : '—') },
            { key: 'co2_conc_raw', label: 'CO₂濃度(%)', align: 'right', sortValue: (r) => r.co2_conc_pct },
            { key: 'cls', label: '濃度分級', sortValue: (r) => r.co2_conc_pct, render: (r) => concentrationClass(r.co2_conc_pct).label },
            { key: 'transport_pref', label: '期待運輸' },
            { key: 'storage_need', label: '封存需求' },
            { key: 'note', label: '備註', render: (r) => <span className="text-slate-500">{r.note || '—'}</span> },
          ]}
        />
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="已裝置捕捉：捕捉量 vs 捕捉單元排放 vs 淨捕捉" subtitle="單位：萬噸/年。捕捉能耗約占捕捉量 26–70%，淨效益有限。" icon={Factory}>
          <div className="h-[340px]">
            <ErrorBoundary>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={captureBars} layout="vertical" margin={{ top: 4, right: 30, left: 10, bottom: 4 }} barGap={2}>
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis type="number" tick={AXIS_TICK} />
                  <YAxis type="category" dataKey="name" width={150} tick={{ ...AXIS_TICK, fontSize: 10 }} interval={0} />
                  <Tooltip formatter={(v, n) => [v == null ? '未填' : `${fmtWt(v, 4)} 萬噸`, n]} />
                  <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine x={0} stroke="#475569" />
                  <Bar dataKey="capture" name="捕捉量" fill={CAT[0]} barSize={8} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="unit" name="捕捉單元排放" fill={CAT[1]} barSize={8} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="net" name="淨捕捉量" fill={CAT[2]} barSize={8} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ErrorBoundary>
          </div>
          <p className="text-[11px] text-amber-700">奇美熱煤油鍋爐：單元排放填 2.45 萬噸遠大於捕捉量 8 噸，推測填列為鍋爐總排放，致淨捕捉量為負（問卷原值照列）。</p>
        </Card>

        <Card title="捕捉 / CCS 規劃" subtitle="預期投入年與規劃量能（評估中者量能留白）" icon={Rocket}>
          <DataTable
            maxHeight={360}
            rows={plans}
            initialSort={{ key: 'capacity_wt', dir: 'desc' }}
            columns={[
              { key: 'short_name', label: '廠區', className: 'font-bold whitespace-nowrap' },
              { key: 'item', label: '規劃項目/排放源' },
              { key: 'plan_type', label: '類型', render: (r) => <Badge>{r.plan_type}</Badge> },
              { key: 'start_year_raw', label: '投入年', sortValue: (r) => r.start_year },
              { key: 'capacity_wt', label: '量能(萬噸)', align: 'right', render: (r) => (r.capacity_wt != null ? fmtWt(r.capacity_wt, 3) : '評估中') },
              { key: 'trl', label: 'TRL' },
              { key: 'note', label: '說明', render: (r) => <span className="text-slate-500">{r.note || '—'}</span> },
            ]}
          />
        </Card>
      </div>

      <Card title="已裝置捕捉設施明細">
        <DataTable
          rows={captures}
          columns={[
            { key: 'survey_year', label: '年度' },
            { key: 'program', label: '計畫', render: (r) => <ProgramBadge program={r.program} /> },
            { key: 'short_name', label: '廠區', className: 'font-bold whitespace-nowrap' },
            { key: 'source_process', label: '排放源/製程' },
            { key: 'capture_tech', label: '捕捉技術' },
            { key: 'out_temp_raw', label: '處理後溫度' },
            { key: 'out_pressure_raw', label: '處理後壓力' },
            { key: 'purity_raw', label: 'CO₂純度(%)' },
            { key: 'capture_wt', label: '捕捉量', align: 'right', render: (r) => fmtWt(r.capture_wt, 4) },
            { key: 'unit_emission_wt', label: '單元排放', align: 'right', render: (r) => fmtWt(r.unit_emission_wt, 4) },
            { key: 'net_capture_wt', label: '淨捕捉', align: 'right', render: (r) => fmtWt(r.net_capture_wt, 4) },
            { key: 'cost_ntd_per_kg', label: '成本(元/kg)', align: 'right', render: (r) => fmtWt(r.cost_ntd_per_kg) },
            { key: 'trl', label: 'TRL' },
            { key: 'operation_status', label: '運轉' },
            { key: 'co2_destination', label: 'CO₂流向' },
            { key: 'note', label: '備註', render: (r) => <span className="text-slate-500">{r.note || '—'}</span> },
          ]}
        />
      </Card>
    </div>
  );
}

// ==========================================
// 3. 碳封存（場址、封存需求、意願與障礙、成本財務）
// ==========================================
export function CcusStorageView({ data }) {
  const sites = data.sites.filter((s) => s.kind === 'storage');
  const storageDemand = [
    ...data.sources.filter((r) => /是|自有/.test(r.storage_need || '')).map((r) => ({
      key: `s${r.id}`, short_name: r.short_name, survey_year: r.survey_year, program: r.program, what: r.source_desc,
      volume: r.emission_wt, kind: '排放源封存需求', note: [r.transport_pref && `期待運輸：${r.transport_pref}`, r.storage_need].filter(Boolean).join('；'),
    })),
    ...data.plans.filter((r) => r.stage === 'storage' || r.stage === 'ccs').map((r) => ({
      key: `p${r.id}`, short_name: r.short_name, survey_year: r.survey_year, program: r.program, what: r.item,
      volume: r.capacity_wt, kind: r.plan_type, note: [r.start_year_raw && `投入年：${r.start_year_raw}`, r.disposal, r.note].filter(Boolean).join('；'),
    })),
  ];
  const willingness = data.answers.filter((a) => a.sheet === '意願與障礙' && a.section?.startsWith('旗艦'));
  const strategy = data.answers.filter((a) => a.sheet === '意願與障礙' && !a.section?.startsWith('旗艦'));
  const finance = data.answers.filter((a) => a.sheet === '成本與財務');
  const talent = data.answers.filter((a) => a.sheet === '人才需求');
  const params = paramsByKey(data.params);
  const lcoc = params.ccus_ccs_lcoc_ntd_t;

  const barrierCols = ['障礙：缺乏基礎設施', '障礙：缺乏去化路徑', '障礙：投資成本過高', '促進：目標提前/加嚴', '促進：高碳價(2,000元/噸)', '碳捕捉', '碳利用', '碳運輸', '碳封存'];
  const barrierCounts = barrierCols.map((c) => ({ name: c.replace(/^障礙：|^促進：/, ''), group: c.startsWith('障礙') ? '障礙' : c.startsWith('促進') ? '促進因素' : '使用意向', n: willingness.filter((w) => w.answers?.[c] === '✓').length }));

  const storageMap = buildCcusLayers(data).filter((l) => ['storage', 'hubs', 'sources'].includes(l.id))
    .map((l) => (l.id === 'sources' ? { ...l, label: '排放源（有封存需求）', points: l.points.filter((p) => storageDemand.some((d) => d.key === p.id)) } : l));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <Card className="xl:col-span-2" title="封存場址與管網樞紐" subtitle="樞紐為管線規劃情境假設（預設隱藏，可勾選）" icon={Box}>
          <TaiwanLayerMap layers={storageMap} defaultActive={['storage', 'sources']} height="min(520px, 65vh)" />
        </Card>
        <div className="xl:col-span-3 space-y-4">
          <Card title="封存場址" subtitle="資料：問卷「封存與其他」分頁（零星資料），量能未明者照原文。">
            <DataTable
              maxHeight={240}
              rows={sites}
              rowKey={(r) => r.site_id}
              columns={[
                { key: 'name', label: '場址', className: 'font-bold' },
                { key: 'site_type', label: '類型' },
                { key: 'capacity_raw', label: '量能(原文)' },
                { key: 'start_year', label: '啟用年' },
                { key: 'status', label: '狀態' },
                { key: 'note', label: '說明', render: (r) => <span className="text-slate-500">{r.note || '—'}</span> },
              ]}
            />
          </Card>
          <Card title="封存需求與 CCS 規劃" subtitle="排放源勾選封存需求 + 規劃中的封存/CCS 項目（萬噸/年）">
            <DataTable
              maxHeight={260}
              rows={storageDemand}
              rowKey={(r) => r.key}
              initialSort={{ key: 'volume', dir: 'desc' }}
              columns={[
                { key: 'short_name', label: '廠區', className: 'font-bold whitespace-nowrap' },
                { key: 'survey_year', label: '年度' },
                { key: 'program', label: '計畫', render: (r) => <ProgramBadge program={r.program} /> },
                { key: 'kind', label: '類型', render: (r) => <Badge>{r.kind}</Badge> },
                { key: 'what', label: '項目' },
                { key: 'volume', label: '量(萬噸)', align: 'right', render: (r) => (r.volume != null ? fmtWt(r.volume, 3) : '評估中') },
                { key: 'note', label: '說明', render: (r) => <span className="text-slate-500">{r.note || '—'}</span> },
              ]}
            />
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="CCUS 使用意向、障礙與促進因素（勾選家數）" subtitle={`115年環境部 CCUS 旗艦供需匹配問卷，共 ${willingness.length} 份`}>
          <div className="h-[300px]">
            <ErrorBoundary>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barrierCounts} layout="vertical" margin={{ top: 4, right: 30, left: 10, bottom: 4 }}>
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} domain={[0, willingness.length || 'auto']} />
                  <YAxis type="category" dataKey="name" width={120} tick={AXIS_TICK} interval={0} />
                  <Tooltip formatter={(v, n, p) => [`${v} 家`, p.payload.group]} />
                  <Bar dataKey="n" barSize={12} radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, fill: '#475569' }}>
                    {barrierCounts.map((b) => <Cell key={b.name} fill={b.group === '障礙' ? CAT[1] : b.group === '促進因素' ? CAT[2] : CAT[0]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ErrorBoundary>
          </div>
          <div className="flex gap-4 text-[11px] text-slate-600 mt-1">
            <span className="flex items-center gap-1"><LegendSwatch shape="square" color={CAT[0]} />使用意向</span>
            <span className="flex items-center gap-1"><LegendSwatch shape="square" color={CAT[1]} />障礙</span>
            <span className="flex items-center gap-1"><LegendSwatch shape="square" color={CAT[2]} />促進因素</span>
          </div>
        </Card>

      </div>

      <CcusCostCompare finance={finance} benchmark={lcoc} />

      <Collapsible title={`意願與障礙勾選明細（${willingness.length} 份）`} defaultOpen><AnswersTable rows={willingness} /></Collapsible>
      <Collapsible title={`成本與財務（${finance.length} 份，金額：萬元）`}><AnswersTable rows={finance} /></Collapsible>
      <Collapsible title={`115年產發署問卷：減碳策略中 CCUS 占比（${strategy.length} 廠）`}><AnswersTable rows={strategy} /></Collapsible>
      <Collapsible title={`CCUS 人才需求（${talent.length} 家）`}><AnswersTable rows={talent} /></Collapsible>
    </div>
  );
}

// ==========================================
// 4. 碳再利用（產品、CO₂需求、貿易價格連結）
// ==========================================
export function CcusUtilizationView({ data, onOpenTrade }) {
  const priceRows = useCcuPrices();
  const hsByProduct = new Map((data.hsMap || []).map((m) => [m.product, m]));
  const products = data.utilization;
  // 同一稅號的不同寫法（例如「液化CO2」與「LCO2」）合併成一條
  const demandByProduct = Object.values(products.reduce((acc, r) => {
    const k = hsByProduct.get(r.product)?.hs_code || r.product;
    (acc[k] ||= { names: new Set(), demand: 0, plants: new Set() });
    acc[k].names.add(r.product);
    acc[k].demand += Number(r.co2_demand_wt) || 0;
    acc[k].plants.add(r.short_name);
    return acc;
  }, {})).map((r) => ({ product: [...r.names].join(' / '), demand: r.demand, plants: [...r.plants].join('、') })).sort((a, b) => b.demand - a.demand);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="CCU 產品/去化項目" value={products.length} unit="項" note={`${new Set(products.map((r) => r.product)).size} 種產品`} />
        <Kpi label="114年 CO₂ 需求/去化量" value={fmtWt(sum(products.filter((r) => r.survey_year === 114), 'co2_demand_wt'), 2)} unit="萬噸/年" />
        <Kpi label="115年 CO₂ 需求/去化量" value={fmtWt(sum(products.filter((r) => r.survey_year === 115), 'co2_demand_wt'), 3)} unit="萬噸/年" />
        <Kpi label="有貿易價格可對照" value={[...hsByProduct.values()].filter((m) => m.hs_code && priceRows.some((p) => p.product === m.product)).length} unit="項產品" note="稅號對照表：ccus_product_hs_map" />
      </div>

      <CcuCaseList cases={data.ccuCases} onOpenTrade={onOpenTrade} />

      <Card title="CO₂ 需求/去化量（依產品）" subtitle="萬噸/年；各年度加總。大連醋酸需 CO₂ 11 萬噸，但廠內捕捉僅 6.1 萬噸，缺碳源。" icon={FlaskConical}>
        <div className="h-[260px]">
          <ErrorBoundary>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={demandByProduct} layout="vertical" margin={{ top: 4, right: 40, left: 10, bottom: 4 }}>
                <CartesianGrid stroke={GRID} horizontal={false} />
                <XAxis type="number" tick={AXIS_TICK} />
                <YAxis type="category" dataKey="product" width={140} tick={AXIS_TICK} interval={0} />
                <Tooltip formatter={(v, n, p) => [`${fmtWt(v, 3)} 萬噸（${p.payload.plants}）`, 'CO₂需求']} />
                <Bar dataKey="demand" fill={CAT[2]} barSize={14} radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, fill: '#475569', formatter: (v) => (v > 0 ? fmtWt(v, 3) : '未填') }} />
              </BarChart>
            </ResponsiveContainer>
          </ErrorBoundary>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {products.map((r) => {
          const hs = hsByProduct.get(r.product);
          const series = priceRows.filter((p) => p.product === r.product && p.flow_type === '進口' && p.unit_price_usd_per_kg != null)
            .map((p) => ({ year: p.year, price: Number(p.unit_price_usd_per_kg) }));
          const imp = latestPrice(priceRows, r.product, '進口');
          const exp = latestPrice(priceRows, r.product, '出口');
          return (
            <div key={r.id} className="card p-4 flex flex-col gap-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-800">{r.product}</span>
                <span className="text-xs text-slate-500">{r.short_name}</span>
                <ProgramBadge program={r.program} />
                <Badge>{r.survey_year}年</Badge>
                {r.trl && <Badge tone="green">TRL {r.trl}</Badge>}
                {r.tech_type && <Badge tone={r.tech_type === '已成熟技術' ? 'green' : 'amber'}>{r.tech_type}</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-400">CO₂需求/去化：</span><b className="font-mono">{r.co2_demand_wt != null ? `${fmtWt(r.co2_demand_wt, 4)} 萬噸/年` : '未填'}</b></div>
                <div><span className="text-slate-400">CO₂來源：</span>{r.co2_source || '—'}</div>
                <div><span className="text-slate-400">流向/客戶：</span>{r.destination || '—'}</div>
                <div><span className="text-slate-400">備註：</span>{r.note || '—'}</div>
              </div>
              <div className="mt-1 rounded-lg bg-slate-50 border border-slate-100 p-2">
                {hs?.hs_code && (imp || exp) ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-xs">
                      <div className="text-slate-500">貿易均價｜{hs.trade_name}（{hs.hs_code}）</div>
                      <div className="font-mono">
                        {imp && <span className="mr-3">進口 <b>{imp.price.toFixed(2)}</b> USD/kg（{imp.year}）</span>}
                        {exp && <span>出口 <b>{exp.price.toFixed(2)}</b> USD/kg（{exp.year}）</span>}
                      </div>
                      {hs.match_note && <div className="text-[10px] text-amber-700">{hs.match_note}</div>}
                    </div>
                    {series.length > 1 && (
                      <div className="w-32 h-10" title="歷年進口均價（USD/kg）">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={series}><Line type="monotone" dataKey="price" stroke={CAT[0]} strokeWidth={2} dot={false} isAnimationActive={false} /><Tooltip formatter={(v) => [`${Number(v).toFixed(2)} USD/kg`, '進口均價']} labelFormatter={(l, p) => p?.[0]?.payload?.year} /></LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    {onOpenTrade && (
                      <button type="button" onClick={() => onOpenTrade(hs.hs_code, hs.trade_name)} className="ml-auto flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-md">
                        <ExternalLink size={12} /> 貿易資訊
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500">{hs?.match_note || (hs ? '貿易資料庫無此稅號資料' : '尚未對應貿易稅號（可在 ccus_product_hs_map 新增）')}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================
// 容器：四個分頁
// ==========================================
export default function CcusSurveyPanel({ view, onOpenTrade }) {
  const { data, error, loading, reload } = useCcusSurvey();
  if (loading) return <LoadingBlock text="CCUS 問卷資料載入中…" />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!data.sources.length && !data.captures.length) {
    return <ErrorBlock message="資料庫中尚無 CCUS 問卷資料，請先執行 npm run db:import-energy 匯入問卷整併檔。" onRetry={reload} />;
  }
  if (view === 'capture') return <CcusCaptureView data={data} />;
  if (view === 'storage') return <CcusStorageView data={data} />;
  if (view === 'utilization') return <CcusUtilizationView data={data} onOpenTrade={onOpenTrade} />;
  return <CcusOverviewView data={data} onOpenTrade={onOpenTrade} />;
}


