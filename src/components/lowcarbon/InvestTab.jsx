// 政府決策：投資門檻與減碳效益
//   - 投資 × 年減碳 × 年效益 泡泡圖（雙對數；縱軸與泡泡大小可互換），斜線 = 每公噸年減碳的投資強度
//   - 投資級距分布：案例數 vs 減碳量貢獻（看出「門檻」在哪）
//   - 政策投入情境：補助門檻 × 補助比例 × 推廣家數 → 帶動投資與年減碳
import React, { useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts';
import { Coins, Factory, Gauge, Leaf, Timer } from 'lucide-react';
import {
  CATEGORIES, CATEGORY_COLOR, INVEST_BUCKETS, co2Of, fmtNum, fmtTon, fmtWan, fmtYears, investBucket, investPerTon,
  median, paybackOf,
} from '../../lib/lowcarbon/metrics';
import { amortCost } from '../../lib/lowcarbon/metrics';
import { fmtCost } from '../../lib/lowcarbon/lcoa';
import { useOpenTech } from './techDrawerContext';
import { AXIS_TICK, Card, GRID, Kpi, Note, Segmented, TipBox } from './ui';

const METRICS = {
  co2: { label: '年減碳量', unit: '公噸CO2e/年', pick: (c, o) => co2Of(c, o), fmt: fmtTon },
  benefit: { label: '年效益', unit: '萬元/年', pick: (c) => (c.benefit_wan > 0 ? c.benefit_wan : null), fmt: fmtWan },
};
// 縱軸與泡泡大小互換
const LAYOUTS = [
  { value: 'co2', label: '泡泡＝年效益', y: 'co2', z: 'benefit' },
  { value: 'benefit', label: '泡泡＝年減碳', y: 'benefit', z: 'co2' },
];
// 投資強度參考斜線：每「公噸/年」減碳需投資多少萬元
const INTENSITY_LINES = [1, 10, 100];
const logTicks = (min, max) => {
  const out = [];
  for (let p = Math.floor(Math.log10(min)); p <= Math.ceil(Math.log10(max)); p++) out.push(10 ** p);
  return out;
};
const tickLabel = (v) => (v >= 1e4 ? `${v / 1e4}萬` : fmtNum(v));

export default function InvestTab({ rows, ctx }) {
  const openTech = useOpenTech();
  const [yMetric, setYMetric] = useState('co2');
  const layout = LAYOUTS.find((l) => l.value === yMetric);
  const metric = METRICS[layout.y];
  const zMetric = METRICS[layout.z];
  const opts = ctx.opts;

  const points = useMemo(() => rows.map((c) => {
    const z = zMetric.pick(c, opts);
    return { c, x: c.investment_wan > 0 ? c.investment_wan : null, y: metric.pick(c, opts), z: z > 0 ? z : null };
  }).filter((p) => p.x != null && p.y != null && p.y > 0), [rows, metric, zMetric, opts]);
  const zs = points.map((p) => p.z).filter(Boolean);
  const zDomain = zs.length ? [Math.min(...zs), Math.max(...zs)] : [1, 2];
  // 泡泡面積用平方根尺度避免大案例把小案例蓋掉；缺值者畫最小並空心
  const sized = points.map((p) => ({ ...p, zr: p.z ? Math.sqrt(p.z) : Math.sqrt(zDomain[0]) }));

  const withBoth = useMemo(() => rows.filter((c) => c.investment_wan > 0 && co2Of(c, opts) > 0), [rows, opts]);
  const kpi = {
    n: withBoth.length,
    inv: median(withBoth.map((c) => c.investment_wan)),
    co2: median(withBoth.map((c) => co2Of(c, opts))),
    intensity: median(withBoth.map((c) => investPerTon(c, opts))),
    payback: median(rows.map(paybackOf)),
  };

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xDomain = xs.length ? [10 ** Math.floor(Math.log10(Math.min(...xs))), 10 ** Math.ceil(Math.log10(Math.max(...xs)))] : [1, 10];
  const yDomain = ys.length ? [10 ** Math.floor(Math.log10(Math.min(...ys))), 10 ** Math.ceil(Math.log10(Math.max(...ys)))] : [1, 10];

  // 投資級距：案例數與減碳量（依類別堆疊）
  const buckets = useMemo(() => INVEST_BUCKETS.map((b) => {
    const inB = withBoth.filter((c) => investBucket(c.investment_wan) === b.key);
    const row = { name: b.label, n: inB.length, co2: inB.reduce((s, c) => s + co2Of(c, opts), 0) };
    for (const cat of CATEGORIES) {
      const sub = inB.filter((c) => c.category === cat);
      row[`n_${cat}`] = sub.length;
      row[`co2_${cat}`] = sub.reduce((s, c) => s + co2Of(c, opts), 0);
    }
    return row;
  }), [withBoth, opts]);
  const totalCo2 = buckets.reduce((s, b) => s + b.co2, 0);
  const totalN = buckets.reduce((s, b) => s + b.n, 0);
  const smallShare = totalN ? (buckets[0].n + buckets[1].n) / totalN : 0;
  const smallCo2Share = totalCo2 ? (buckets[0].co2 + buckets[1].co2) / totalCo2 : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi icon={Factory} label="有投資與減碳數據案例" value={fmtNum(kpi.n)} unit="件" note={`篩選範圍共 ${rows.length} 件`} />
        <Kpi icon={Coins} label="投資金額中位數" value={fmtWan(kpi.inv)} />
        <Kpi icon={Leaf} label="年減碳量中位數" value={fmtTon(kpi.co2)} unit="/年" />
        <Kpi icon={Gauge} label="投資強度中位數" value={fmtNum(kpi.intensity, 2)} unit="萬元 /（公噸/年）" note="每年多減 1 公噸需投入的初始投資" />
        <Kpi icon={Timer} label="回收年限中位數" value={fmtYears(kpi.payback)} note="原文值；未列者以投資÷年效益推算" />
      </div>

      <Card title="投入金額 × 減碳量 × 年效益" subtitle={`雙對數座標。泡泡大小＝${zMetric.label}（空心＝原文未載）。斜虛線為投資強度等值線：越靠左上方，同樣的錢換到越多減碳；越往右投資門檻越高。點泡泡看該技術類型的組成。`}
        right={<Segmented value={yMetric} onChange={setYMetric} options={LAYOUTS} />}>
        <div className="h-[420px] -ml-2">
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <ScatterChart margin={{ top: 10, right: 24, bottom: 28, left: 8 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
              <XAxis type="number" dataKey="x" scale="log" domain={xDomain} ticks={logTicks(...xDomain)} tickFormatter={tickLabel}
                tick={AXIS_TICK} allowDataOverflow
                label={{ value: '初始投資（萬元，對數）', position: 'insideBottom', offset: -16, fontSize: 12, fill: '#475569' }} />
              <YAxis type="number" dataKey="y" scale="log" domain={yDomain} ticks={logTicks(...yDomain)} tickFormatter={tickLabel}
                tick={AXIS_TICK} width={56} allowDataOverflow
                label={{ value: `${metric.label}（${metric.unit}）`, angle: -90, position: 'insideLeft', offset: 2, fontSize: 12, fill: '#475569', dy: 70 }} />
              <ZAxis type="number" dataKey="zr" range={[30, 900]} domain={[Math.sqrt(zDomain[0]), Math.sqrt(zDomain[1])]} />
              {yMetric === 'co2' && INTENSITY_LINES.map((k) => (
                <ReferenceLine key={k} ifOverflow="hidden" stroke="#94a3b8" strokeDasharray="5 4"
                  segment={[{ x: xDomain[0], y: xDomain[0] / k }, { x: xDomain[1], y: xDomain[1] / k }]}
                  label={{ value: `${k} 萬元/(t/年)`, position: 'insideTopRight', fontSize: 12, fill: '#64748b' }} />
              ))}
              <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const { c } = payload[0].payload;
                return (
                  <TipBox title={c.tech_name} rows={[
                    ['類別', `${c.category}／${c.subcategory || '—'}`, CATEGORY_COLOR[c.category]],
                    ['產業', c.industry],
                    c.company ? ['公司', c.company] : null,
                    ['投資', fmtWan(c.investment_wan)],
                    ['年減碳', fmtTon(co2Of(c, opts))],
                    ['年效益', fmtWan(c.benefit_wan)],
                    ['投資攤提成本', fmtCost(amortCost(c, opts))],
                    ['回收年限', fmtYears(paybackOf(c))],
                  ]} footer={`${c.doc_title}・點擊看技術類型明細`} />
                );
              }} />
              {CATEGORIES.map((cat) => (
                <Scatter key={cat} name={cat} data={sized.filter((p) => p.c.category === cat)} fill={CATEGORY_COLOR[cat]}
                  isAnimationActive={false} style={{ cursor: 'pointer' }}
                  onClick={(p) => openTech(`${p.payload?.c?.category ?? p.c.category}|${(p.payload?.c ?? p.c).subcategory || '未分類'}`)}
                  shape={(props) => (
                    <circle cx={props.cx} cy={props.cy} r={Math.max(3, props.width / 2)}
                      fill={props.payload.z ? CATEGORY_COLOR[cat] : '#fff'} fillOpacity={props.payload.z ? 0.55 : 1}
                      stroke={CATEGORY_COLOR[cat]} strokeWidth={1.5} />
                  )} />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="投資門檻分布：案例數" subtitle="依單案初始投資分級；顏色為技術類別">
          <BucketChart data={buckets} prefix="n" fmt={(v) => `${fmtNum(v)} 件`} />
        </Card>
        <Card title="投資門檻分布：年減碳量合計" subtitle="同一級距內案例的年減碳量加總">
          <BucketChart data={buckets} prefix="co2" fmt={fmtTon} />
        </Card>
      </div>
      <Note>
        樣本中 <b>{Math.round(smallShare * 100)}%</b> 的案例投資在 500 萬元以下，合計貢獻 <b>{Math.round(smallCo2Share * 100)}%</b> 的年減碳量；
        大額投資（2,000 萬元以上）件數少但單件減碳量大。中小企業可優先從低門檻的系統節能著手，政策資源則可針對高門檻、高減碳的製程與燃料轉換案提供融資或補助。
      </Note>

      <PolicyScenario rows={withBoth} opts={opts} />
    </div>
  );
}

function BucketChart({ data, prefix, fmt }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 64, left: 0, bottom: 0 }} barCategoryGap={6}>
          <CartesianGrid horizontal={false} stroke={GRID} strokeDasharray="3 3" />
          <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => (prefix === 'co2' ? tickLabel(v) : v)} />
          <YAxis type="category" dataKey="name" width={96} tick={{ ...AXIS_TICK, fill: '#334155' }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: '#f1f5f9' }} content={({ active, payload }) => (active && payload?.length ? (
            <TipBox title={`投資 ${payload[0].payload.name}`} rows={[
              ...CATEGORIES.map((c) => [c, fmt(payload[0].payload[`${prefix}_${c}`]), CATEGORY_COLOR[c]]),
              ['合計', fmt(payload[0].payload[prefix])],
            ]} />
          ) : null)} />
          {CATEGORIES.map((c, i) => (
            <Bar key={c} dataKey={`${prefix}_${c}`} stackId="a" fill={CATEGORY_COLOR[c]} stroke="#fff" strokeWidth={1}
              radius={i === CATEGORIES.length - 1 ? [0, 4, 4, 0] : 0} maxBarSize={22} isAnimationActive={false}>
              {i === CATEGORIES.length - 1 && <LabelList dataKey={prefix} position="right" fontSize={12} fill="#475569" formatter={fmt} />}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// 政策投入情境：以彙編案例為「代表性專案」，估算補助政策可帶動的規模（示意，非預測）
function PolicyScenario({ rows, opts }) {
  const [cap, setCap] = useState(2000);
  const [ratio, setRatio] = useState(30);
  const [spread, setSpread] = useState(10);
  const eligible = rows.filter((c) => c.investment_wan <= cap);
  const inv = eligible.reduce((s, c) => s + c.investment_wan, 0) * spread;
  const subsidy = (inv * ratio) / 100;
  const co2 = eligible.reduce((s, c) => s + co2Of(c, opts), 0) * spread;
  const withBen = eligible.filter((c) => c.benefit_wan > 0);
  const pbBefore = median(withBen.map((c) => c.investment_wan / c.benefit_wan));
  const pbAfter = median(withBen.map((c) => (c.investment_wan * (1 - ratio / 100)) / c.benefit_wan));
  const tonPerYi = subsidy ? co2 / (subsidy / 1e4) : null;

  return (
    <Card title="政策投入情境模擬" subtitle="假設每個彙編案例代表一種可推廣的技術方案，複製到多家工廠時，補助政策可帶動的投資與減碳規模。">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-4 bg-brand-ground border border-brand-line rounded-xl p-4">
          <Slider label="補助對象：單案投資上限" value={cap} min={100} max={20000} step={100} onChange={setCap} fmt={fmtWan} />
          <Slider label="補助比例" value={ratio} min={0} max={70} step={5} onChange={setRatio} fmt={(v) => `${v}%`} />
          <Slider label="每項技術推廣家數" value={spread} min={1} max={50} step={1} onChange={setSpread} fmt={(v) => `${v} 家`} />
        </div>
        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3 content-start">
          <Kpi label="符合條件的技術" value={fmtNum(eligible.length)} unit="項" note={`占有投資數據案例 ${rows.length ? Math.round((eligible.length / rows.length) * 100) : 0}%`} />
          <Kpi label="帶動總投資" value={fmtWan(inv)} />
          <Kpi label="政府補助經費" value={fmtWan(subsidy)} />
          <Kpi label="可達年減碳量" value={fmtTon(co2)} unit="/年" />
          <Kpi label="每 1 億元補助年減碳" value={fmtTon(tonPerYi)} unit="/年" />
          <Kpi label="企業回收年限（中位數）" value={`${fmtYears(pbBefore)} → ${fmtYears(pbAfter)}`} note="補助前 → 補助後" />
        </div>
      </div>
      <div className="mt-3"><Note>情境模擬僅示意量級：減碳量與投資直接以案例實績等比例放大，未考慮不同廠規模、技術適用性與重複導入；正式評估仍需逐廠診斷。</Note></div>
    </Card>
  );
}

export function Slider({ label, value, min, max, step, onChange, fmt }) {
  return (
    <label className="block">
      <div className="flex justify-between items-center text-[13px] mb-1.5">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="num font-bold text-brand-dark">{fmt ? fmt(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand" />
    </label>
  );
}
