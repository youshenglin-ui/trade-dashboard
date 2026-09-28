// ==========================================
// 氫能問卷深度分析：原儀表板沒有呈現的問卷資料
// ==========================================
// 產能利用率/剩餘產能、外購外售起訖（工業區流向）、廠區供需平衡、2030/2040/2050 未來規劃、
// 115 減碳策略、政府協助需求、資料性質（沿用/推定）標示。資料全部來自 Supabase 問卷表。
import React, { useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ArrowRightLeft, Gauge, Rocket, Scale } from 'lucide-react';
import { ErrorBoundary } from '../SharedComponents';
import { AnswersTable, Badge, Card, Collapsible, DataTable, Kpi, Segmented } from './ui';
import { AssistanceCard } from './CcusSurveyViews';
import { fmtWt, h2YearOf, planRangeMid, sum } from '../../lib/energy/energyMetrics';
import { CAT } from '../../lib/energy/palette';

const AXIS_TICK = { fontSize: 11, fill: '#64748b' };
const GRID = '#e2e8f0';

const NatureBadge = ({ value }) => {
  if (!value || value === '問卷回覆') return null;
  return <Badge tone="amber" title="非當年度問卷回覆值">{value}</Badge>;
};

export default function HydrogenSurveyPanels({ data, selectedYear }) {
  const years = useMemo(() => [...new Set(data.production.map(h2YearOf))].sort(), [data]);
  const year = selectedYear === 'ALL' ? years[years.length - 1] : selectedYear;
  const inYear = (r) => h2YearOf(r) === year;
  const byId = useMemo(() => new Map(data.plants.map((p) => [p.plant_id, p])), [data]);

  // ---------- 1. 產能利用率 ----------
  const capacity = (() => {
    const m = new Map();
    data.production.filter(inYear).forEach((r) => {
      const k = r.plant_id;
      const cur = m.get(k) || { plant: r.short_name, output: 0, capacity: 0, spareReported: 0, nature: new Set(), processes: new Set() };
      cur.output += Number(r.output_wt) || 0;
      cur.capacity += Number(r.max_capacity_wt) || 0;
      cur.spareReported += Number(r.spare_capacity_wt) || 0;
      if (r.data_nature && r.data_nature !== '問卷回覆') cur.nature.add(r.data_nature);
      cur.processes.add(r.process_category);
      m.set(k, cur);
    });
    return [...m.values()].filter((r) => r.capacity > 0).map((r) => ({
      ...r, spare: Math.max(0, r.capacity - r.output), utilization: r.capacity > 0 ? r.output / r.capacity : null,
      nature: [...r.nature].join('、'), processes: [...r.processes].join('、'),
    })).sort((a, b) => b.capacity - a.capacity);
  })();

  // ---------- 2. 外購外售起訖 ----------
  const [flowSide, setFlowSide] = useState('購入');
  const flows = data.flows.filter((f) => h2YearOf(f) === year && f.direction === flowSide);
  const zoneFlows = useMemo(() => {
    const m = new Map();
    flows.forEach((f) => {
      const k = `${f.origin_zone || '未明'} → ${f.dest_zone || '未明'}`;
      const cur = m.get(k) || { route: k, volume: 0, count: 0, sameZone: f.origin_zone && f.origin_zone === f.dest_zone };
      cur.volume += Number(f.volume_wt) || 0;
      cur.count += 1;
      m.set(k, cur);
    });
    return [...m.values()].sort((a, b) => b.volume - a.volume);
  }, [flows]);
  const transportMix = useMemo(() => {
    const m = new Map();
    flows.forEach((f) => { const k = f.transport || '未填'; m.set(k, (m.get(k) || 0) + (Number(f.volume_wt) || 0)); });
    return [...m.entries()].map(([name, volume]) => ({ name, volume })).sort((a, b) => b.volume - a.volume);
  }, [flows]);

  // ---------- 3. 廠區供需平衡（生產＋外購−外售−使用；與資料庫 view v_h2_plant_balance 同定義） ----------
  const balance = (() => {
    const m = new Map();
    const get = (id, name) => {
      if (!m.has(id)) m.set(id, { id, plant: byId.get(id)?.short_name || name || id, production: 0, purchased: 0, sold: 0, usage: 0 });
      return m.get(id);
    };
    data.production.filter(inYear).forEach((r) => { get(r.plant_id, r.short_name).production += Number(r.output_wt) || 0; });
    data.usage.filter(inYear).forEach((r) => { get(r.plant_id, r.short_name).usage += Number(r.h2_wt) || 0; });
    data.flows.filter((f) => h2YearOf(f) === year && f.internal_external === '外部').forEach((f) => {
      const b = get(f.reporter_plant_id, f.reporter_name);
      if (f.direction === '購入') b.purchased += Number(f.volume_wt) || 0;
      if (f.direction === '售出') b.sold += Number(f.volume_wt) || 0;
    });
    return [...m.values()].map((b) => ({ ...b, gap: b.production + b.purchased - b.sold - b.usage }))
      .filter((b) => Math.abs(b.gap) > 0.0001 || b.production || b.usage)
      .sort((a, b) => a.gap - b.gap);
  })();

  // ---------- 4. 未來規劃 ----------
  const existingTrend = useMemo(() => {
    const rows = data.plans.filter((p) => p.plan_type === '既有製程用氫變化');
    const bySurvey = new Map();
    rows.forEach((p) => {
      const k = p.survey_year;
      const cur = bySurvey.get(k) || { survey: `${k}年問卷`, y2030: 0, y2040: 0, y2050: 0 };
      cur.y2030 += planRangeMid(p.y2030_low, p.y2030_high) || 0;
      cur.y2040 += planRangeMid(p.y2040_low, p.y2040_high) || 0;
      cur.y2050 += planRangeMid(p.y2050_low, p.y2050_high) || 0;
      bySurvey.set(k, cur);
    });
    return [...bySurvey.values()].sort((a, b) => a.survey.localeCompare(b.survey));
  }, [data]);
  const newApps = data.plans.filter((p) => p.plan_type && p.plan_type !== '既有製程用氫變化');

  const policy = data.answers.filter((a) => a.sheet === '減碳政策_115');
  const carryOver = data.production.filter(inYear).filter((r) => r.data_nature && r.data_nature !== '問卷回覆');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-4 py-2">
        <span className="font-bold text-slate-700">分析年度：{year}（數據年）</span>
        {selectedYear === 'ALL' && <Badge>全年度彙總時以最新年度呈現</Badge>}
        {carryOver.length > 0 && (
          <span className="text-amber-700">
            其中 {carryOver.length} 筆生產資料非當年回覆（{[...new Set(carryOver.map((r) => r.data_nature))].join('、')}：{[...new Set(carryOver.map((r) => r.short_name))].join('、')}）
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="總產量" value={fmtWt(sum(data.production.filter(inYear), 'output_wt'), 2)} unit="萬噸/年" />
        <Kpi label="最大產能（有填者）" value={fmtWt(sum(capacity, 'capacity'), 2)} unit="萬噸/年" note={`利用率 ${capacity.length ? ((sum(capacity, 'output') / sum(capacity, 'capacity')) * 100).toFixed(0) : '—'}%（僅計有填產能之廠）`} />
        <Kpi label="總用氫量" value={fmtWt(sum(data.usage.filter(inYear), 'h2_wt'), 2)} unit="萬噸/年" />
        <Kpi label="外部購入申報量" value={fmtWt(sum(data.flows.filter((f) => h2YearOf(f) === year && f.direction === '購入' && f.internal_external === '外部'), 'volume_wt'), 2)} unit="萬噸/年" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="產能利用率與剩餘產能" subtitle="產量＋剩餘產能＝最大產能；剩餘產能可作為區域供氫備援。" icon={Gauge}>
          <div className="h-[360px]">
            <ErrorBoundary>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={capacity} layout="vertical" margin={{ top: 4, right: 48, left: 10, bottom: 4 }}>
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis type="number" tick={AXIS_TICK} unit=" 萬噸" />
                  <YAxis type="category" dataKey="plant" width={80} tick={AXIS_TICK} interval={0} />
                  <Tooltip formatter={(v, n) => [`${fmtWt(v, 3)} 萬噸`, n]} labelFormatter={(l, p) => `${l}｜利用率 ${p?.[0] ? (p[0].payload.utilization * 100).toFixed(0) : '—'}%`} />
                  <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="output" name="產量" stackId="c" fill={CAT[0]} barSize={12} />
                  <Bar dataKey="spare" name="剩餘產能" stackId="c" fill="#86b6ef" barSize={12} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ErrorBoundary>
          </div>
          <DataTable
            maxHeight={200}
            rows={capacity}
            rowKey={(r) => r.plant}
            columns={[
              { key: 'plant', label: '廠區', className: 'font-bold' },
              { key: 'processes', label: '製程' },
              { key: 'output', label: '產量', align: 'right', render: (r) => fmtWt(r.output, 3) },
              { key: 'capacity', label: '最大產能', align: 'right', render: (r) => fmtWt(r.capacity, 3) },
              { key: 'utilization', label: '利用率', align: 'right', render: (r) => (r.utilization != null ? `${(r.utilization * 100).toFixed(0)}%` : '—') },
              { key: 'nature', label: '資料性質', render: (r) => <NatureBadge value={r.nature} /> },
            ]}
          />
        </Card>

        <Card title="廠區供需平衡（生產＋外購−外售−使用）" subtitle="負值＝使用＋外售大於生產＋外購，代表有未申報來源；正值＝可能有未申報去向。" icon={Scale}>
          <div className="h-[360px]">
            <ErrorBoundary>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={balance} layout="vertical" margin={{ top: 4, right: 30, left: 10, bottom: 4 }}>
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis type="number" tick={AXIS_TICK} unit=" 萬噸" />
                  <YAxis type="category" dataKey="plant" width={80} tick={{ ...AXIS_TICK, fontSize: 10 }} interval={0} />
                  <ReferenceLine x={0} stroke="#475569" />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const r = payload[0].payload;
                    return (
                      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-2 text-xs">
                        <div className="font-bold mb-1">{r.plant}</div>
                        <div>生產 {fmtWt(r.production, 3)}｜外購 {fmtWt(r.purchased, 3)}</div>
                        <div>外售 {fmtWt(r.sold, 3)}｜使用 {fmtWt(r.usage, 3)}</div>
                        <div className="font-bold mt-1">差額 {fmtWt(r.gap, 3)} 萬噸</div>
                      </div>
                    );
                  }} />
                  <Bar dataKey="gap" barSize={10} radius={[0, 4, 4, 0]}>
                    {balance.map((r) => <Cell key={r.id} fill={r.gap >= 0 ? CAT[0] : CAT[1]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ErrorBoundary>
          </div>
          <div className="flex gap-4 text-[11px] text-slate-600">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: CAT[0] }} />供給有餘</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: CAT[1] }} />有未申報來源</span>
          </div>
        </Card>
      </div>

      <Card
        title="外購外售起訖（工業區流向）"
        subtitle="買方申報「購入」與賣方申報「售出」是同一批氫氣的兩面，切換檢視避免重複計算；對象推定依據見明細。"
        icon={ArrowRightLeft}
        right={<Segmented value={flowSide} onChange={setFlowSide} options={[{ value: '購入', label: '依買方申報' }, { value: '售出', label: '依賣方申報' }]} />}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-[300px]">
            <ErrorBoundary>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={zoneFlows} layout="vertical" margin={{ top: 4, right: 40, left: 10, bottom: 4 }}>
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis type="number" tick={AXIS_TICK} />
                  <YAxis type="category" dataKey="route" width={220} tick={{ ...AXIS_TICK, fontSize: 10 }} interval={0} />
                  <Tooltip formatter={(v, n, p) => [`${fmtWt(v, 3)} 萬噸（${p.payload.count} 筆）`, p.payload.sameZone ? '同工業區互供' : '跨工業區']} />
                  <Bar dataKey="volume" barSize={12} radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 10, fill: '#475569', formatter: (v) => (v > 0 ? fmtWt(v, 2) : '量未填') }}>
                    {zoneFlows.map((r) => <Cell key={r.route} fill={r.sameZone ? CAT[0] : CAT[3]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ErrorBoundary>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 mb-2">運輸方式（萬噸）</div>
            <DataTable maxHeight={260} rows={transportMix} rowKey={(r) => r.name}
              columns={[{ key: 'name', label: '方式' }, { key: 'volume', label: '量', align: 'right', render: (r) => fmtWt(r.volume, 3) }]} />
            <div className="flex gap-3 text-[11px] text-slate-600 mt-2">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: CAT[0] }} />同工業區</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: CAT[3] }} />跨工業區</span>
            </div>
          </div>
        </div>
        <div className="mt-3">
          <DataTable
            maxHeight={300}
            rows={flows}
            initialSort={{ key: 'volume_wt', dir: 'desc' }}
            columns={[
              { key: 'reporter_name', label: '申報廠區', className: 'font-bold whitespace-nowrap' },
              { key: 'counterparty_raw', label: '對象原文' },
              { key: 'counterparty_name', label: '對象推定' },
              { key: 'inference_basis', label: '推定依據', render: (r) => <span className="text-slate-500">{r.inference_basis || '—'}</span> },
              { key: 'origin_zone', label: '起點工業區' },
              { key: 'dest_zone', label: '訖點工業區' },
              { key: 'volume_wt', label: '量(萬噸)', align: 'right', render: (r) => (r.volume_wt != null ? fmtWt(r.volume_wt, 4) : '未填') },
              { key: 'transport', label: '運輸' },
              { key: 'avg_price_ntd_per_kg', label: '均價(元/kg)', align: 'right', render: (r) => fmtWt(r.avg_price_ntd_per_kg) },
              { key: 'data_nature', label: '資料性質', render: (r) => <NatureBadge value={r.data_nature} /> },
              { key: 'note', label: '備註', render: (r) => <span className="text-slate-500">{r.note || '—'}</span> },
            ]}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <Card className="xl:col-span-2" title="既有製程用氫：2030 / 2040 / 2050 推估" subtitle="各廠填報區間取中點後加總（萬噸/年）；113、114 年問卷分開呈現。" icon={Rocket}>
          <div className="h-[300px]">
            <ErrorBoundary>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={existingTrend} margin={{ top: 16, right: 10, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="survey" tick={AXIS_TICK} />
                  <YAxis tick={AXIS_TICK} />
                  <Tooltip formatter={(v, n) => [`${fmtWt(v, 2)} 萬噸`, n]} />
                  <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="y2030" name="2030" fill={CAT[0]} barSize={16} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="y2040" name="2040" fill={CAT[1]} barSize={16} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="y2050" name="2050" fill={CAT[2]} barSize={16} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ErrorBoundary>
          </div>
        </Card>
        <Card className="xl:col-span-3" title="新增製程 / 氫能應用規劃" subtitle={`${newApps.length} 項；原文照列，數值可解析者另列萬噸`}>
          <DataTable
            maxHeight={300}
            rows={newApps}
            columns={[
              { key: 'short_name', label: '廠區', className: 'font-bold whitespace-nowrap' },
              { key: 'survey_year', label: '問卷' },
              { key: 'item', label: '項目' },
              { key: 'start_year_raw', label: '預估開始年' },
              { key: 'trl', label: 'TRL' },
              { key: 'h2_demand_raw', label: '氫需求(原文)', render: (r) => r.h2_demand_raw || [r.y2030_raw && `2030:${r.y2030_raw}`, r.y2040_raw && `2040:${r.y2040_raw}`, r.y2050_raw && `2050:${r.y2050_raw}`].filter(Boolean).join('；') || '—' },
              { key: 'co2_reduction_t', label: '減碳量(噸)', align: 'right', render: (r) => fmtWt(r.co2_reduction_t, 0) },
              { key: 'bottleneck', label: '發展瓶頸', render: (r) => <span className="text-slate-500">{r.bottleneck || r.reason || '—'}</span> },
            ]}
          />
        </Card>
      </div>

      <AssistanceCard rows={data.assistance} title="待政府協助（氫能）" />
      <Collapsible title={`115年減碳政策與策略（${policy.length} 廠）`}><AnswersTable rows={policy} /></Collapsible>
      <Collapsible title={`既有製程用氫變化明細（${data.plans.filter((p) => p.plan_type === '既有製程用氫變化').length} 筆）`}>
        <DataTable
          rows={data.plans.filter((p) => p.plan_type === '既有製程用氫變化')}
          columns={[
            { key: 'short_name', label: '廠區', className: 'font-bold whitespace-nowrap' },
            { key: 'survey_year', label: '問卷' },
            { key: 'item', label: '項目' },
            { key: 'y2030_raw', label: '2030' },
            { key: 'y2040_raw', label: '2040' },
            { key: 'y2050_raw', label: '2050' },
            { key: 'reason', label: '原因/說明', render: (r) => <span className="text-slate-500">{r.reason || '—'}</span> },
          ]}
        />
      </Collapsible>
    </div>
  );
}
