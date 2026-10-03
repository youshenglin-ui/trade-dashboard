// ==========================================
// 碳費自主減量計畫：深入分析分頁
// ==========================================
// 1. 減量率 vs 排放規模：大排放源是否承諾較低的減量率
// 2. 同產業排名：產業內減量率排名，標出落後者（低於產業 P25）
// 3. 措施組合型態：各計畫採用四大類措施的組合，與其減量率
// 4. 逐年減量路徑：首年承諾占全程減量的比例（前段集中／線性／後段集中）
// 吃 CarbonFeeDashboard 已套用篩選的 plans；定義集中在 carbonfeeMetrics.js。
import React, { useMemo, useState } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell, LineChart, Line, Legend } from 'recharts';
import {
  SCALE_BUCKETS, MEASURE_CATEGORIES, CATEGORY_COLOR, TIER_COLOR, OTHER_COLOR, fmtPct, fmtTon, fmtWan,
  frontShare, trajectoryBucket, TRAJECTORY_BUCKETS, LINEAR_FIRST_SHARE, measureCombo,
} from '../lib/carbonfeeMetrics';

const AXIS = { fontSize: 11, fill: '#64748b' };
const GRID = '#e2e8f0';
const median = (xs) => {
  const v = xs.filter((x) => x != null && isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

function Section({ title, subtitle, children, right }) {
  return (
    <div className="card p-3 md:p-4 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="font-bold text-slate-800 text-base">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

const Tip = ({ title, rows }) => (
  <div className="bg-white/95 border border-slate-200 shadow-lg rounded-lg px-3 py-2 text-xs max-w-[280px]">
    <div className="font-bold text-slate-800 mb-1">{title}</div>
    {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><span className="text-slate-500">{k}</span><span className="font-mono text-slate-800">{v}</span></div>)}
  </div>
);

// ---------- 1. 減量率 vs 排放規模 ----------
function RateVsScale({ plans, onSelectPlan }) {
  const pts = plans.filter((p) => p.total_base_emission > 0 && p.rate != null)
    .map((p) => ({ x: p.total_base_emission, y: +(p.rate * 100).toFixed(2), p }));
  const clipY = 40;
  const byTier = ['A', 'B'].map((t) => ({ tier: t, data: pts.filter((d) => d.p.tier === t).map((d) => ({ ...d, y: Math.max(-5, Math.min(clipY, d.y)) })) }));
  const overall = median(pts.map((d) => d.p.rate));
  const buckets = SCALE_BUCKETS.map((b, i) => {
    const lo = i === 0 ? 0 : SCALE_BUCKETS[i - 1].max;
    const ps = pts.filter((d) => d.x >= lo && d.x < b.max).map((d) => d.p);
    return { ...b, n: ps.length, med: median(ps.map((p) => p.rate)), amount: ps.reduce((a, p) => a + (p.amount || 0), 0), base: ps.reduce((a, p) => a + p.total_base_emission, 0) };
  }).filter((b) => b.n);
  const totalAmount = buckets.reduce((a, b) => a + b.amount, 0);

  return (
    <Section title="① 減量率 vs 排放規模" subtitle={`每點一件計畫（共 ${pts.length} 件），橫軸為基準年排放（對數尺度）；虛線為整體減量率中位數 ${fmtPct(overall)}。減量率超過 ${clipY}% 的點畫在上緣。點擊點位開啟計畫明細。`}>
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3 h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 16, bottom: 20, left: 0 }}>
              <CartesianGrid stroke={GRID} />
              <XAxis type="number" dataKey="x" scale="log" domain={[1e4, 3e7]} allowDataOverflow ticks={[1e4, 3e4, 1e5, 3e5, 1e6, 3e6, 1e7, 3e7]} tick={AXIS} tickFormatter={(v) => `${(v / 1e4).toLocaleString()}萬`}
                label={{ value: '基準年排放（公噸CO₂e，對數）', position: 'insideBottom', offset: -12, fontSize: 11, fill: '#64748b' }} />
              <YAxis type="number" dataKey="y" tick={AXIS} unit="%" domain={[-5, clipY]} width={44} />
              <ZAxis range={[36, 36]} />
              {overall != null && <ReferenceLine y={overall * 100} stroke="#64748b" strokeDasharray="4 4" />}
              <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const { p } = payload[0].payload;
                return <Tip title={p.plan_name} rows={[['產業', p.industry || '—'], ['基準年排放', fmtTon(p.total_base_emission)], ['減量率', fmtPct(p.rate)], ['級別', p.tier ? `${p.tier}級` : '—']]} />;
              }} />
              {byTier.map((t) => (
                <Scatter key={t.tier} name={`${t.tier}級`} data={t.data} fill={TIER_COLOR[t.tier]} fillOpacity={0.7}
                  onClick={(d) => onSelectPlan?.(d?.p?.control_no ?? d?.payload?.p?.control_no)} className="cursor-pointer" />
              ))}
              <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: 11 }} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="xl:col-span-2">
          <table className="w-full text-xs">
            <thead className="text-slate-500 border-b">
              <tr><th className="text-left py-1.5">排放規模</th><th className="text-right">計畫數</th><th className="text-right">減量率中位數</th><th className="text-right">承諾減量占比</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {buckets.map((b) => (
                <tr key={b.key}>
                  <td className="py-1.5">{b.label}</td>
                  <td className="text-right font-mono">{b.n}</td>
                  <td className="text-right">
                    <span className="inline-flex items-center gap-1.5 justify-end w-full">
                      <span className="h-2 rounded" style={{ width: `${Math.max(0, (b.med || 0) * 400)}px`, maxWidth: 60, background: (b.med ?? 0) >= (overall ?? 0) ? '#1baf7a' : '#eb6834' }} />
                      <span className="font-mono font-bold">{fmtPct(b.med)}</span>
                    </span>
                  </td>
                  <td className="text-right font-mono">{fmtPct(totalAmount ? b.amount / totalAmount : null, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
            「承諾減量占比」＝該級距計畫的承諾減量合計 ÷ 全部承諾減量。規模大的計畫減量率通常較低，但因基數大，仍貢獻多數減量；
            綠色＝中位數高於整體、橘色＝低於整體。
          </p>
        </div>
      </div>
    </Section>
  );
}


// ---------- 2. 同產業排名 ----------
const quantile = (xs, q) => {
  const v = xs.filter((x) => x != null && isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const i = (v.length - 1) * q;
  const lo = Math.floor(i);
  return v[lo] + (v[Math.ceil(i)] - v[lo]) * (i - lo);
};

function IndustryRanking({ plans, onSelectPlan }) {
  // A 級（技術標竿）與 B 級（達成效益）門檻不同，預設分開排名，避免 B 級被 A 級拉成落後
  const [tierPick, setTierPick] = useState('B');
  // 頁面上方已篩選單一級別時，跟著上方走
  const pageTiers = new Set(plans.map((p) => p.tier).filter(Boolean));
  const tier = pageTiers.size === 1 ? [...pageTiers][0] : tierPick;
  const setTier = setTierPick;
  const tierCount = (t) => plans.filter((p) => p.rate != null && p.tier === t).length;
  const groups = useMemo(() => {
    const m = new Map();
    plans.forEach((p) => {
      if (p.rate == null) return;
      if (tier !== 'ALL' && p.tier !== tier) return;
      const k = p.industry || '未填產業';
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(p);
    });
    return [...m.entries()].map(([name, ps]) => {
      const rates = ps.map((p) => p.rate);
      const p25 = quantile(rates, 0.25);
      const med = quantile(rates, 0.5);
      const ranked = [...ps].sort((a, b) => b.rate - a.rate).map((p, i) => ({
        p, rank: i + 1,
        // 容許 0.5 個百分點誤差：A 級多為法定 42%，小數差異不算落後
        lag: p.rate < (ps.length >= 4 ? p25 : med) - 0.005,
      }));
      return { name, n: ps.length, med, p25, p75: quantile(rates, 0.75), ranked, lagCount: ranked.filter((r) => r.lag).length,
        base: ps.reduce((a, p) => a + (p.total_base_emission || 0), 0) };
    }).sort((a, b) => b.n - a.n);
  }, [plans, tier]);
  const [picked, setPicked] = useState(null);
  const cur = groups.find((g) => g.name === picked) || groups[0];
  const tierSwitch = (
    <div className="seg">
      {[['B', `B級 ${tierCount('B')}`], ['A', `A級 ${tierCount('A')}`], ['ALL', '不分級']].map(([k, l]) => (
        <button key={k} type="button" onClick={() => setTier(k)} className={`seg-btn ${tier === k ? 'seg-btn-on' : ''}`}>{l}</button>
      ))}
    </div>
  );
  if (!cur) {
    return (
      <Section title="② 同產業減量率排名" right={tierSwitch}>
        <div className="text-sm text-slate-400 py-6 text-center">目前篩選條件下沒有{tier === 'ALL' ? '' : ` ${tier} 級`}計畫</div>
      </Section>
    );
  }
  const maxRate = Math.max(0.05, ...cur.ranked.map((r) => r.p.rate));
  const minRate = Math.min(0, ...cur.ranked.map((r) => r.p.rate));
  const span = maxRate - minRate;
  const x = (v) => `${((v - minRate) / span) * 100}%`;

  return (
    <Section title="② 同產業減量率排名" right={tierSwitch}
      subtitle={`${tier === 'ALL' ? 'A、B 級混合排名（A 級門檻較高，B 級容易被拉成落後）' : tier === 'A' ? '只比較 A 級計畫（技術標竿；A 級目標多為法定 42%，排名差異有限）' : '只比較 B 級計畫（達成效益）'}。左表為各產業計畫數與減量率分布（P25／中位數／P75），點產業看該產業內每件計畫的排名。「落後」＝減量率低於該產業 P25 超過 0.5 個百分點（產業不足 4 件時改用中位數）。`}>
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-2 overflow-auto max-h-[460px] border border-slate-100 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0 text-slate-500">
              <tr><th className="text-left p-2">產業</th><th className="text-right p-2">計畫</th><th className="text-right p-2">P25</th><th className="text-right p-2">中位數</th><th className="text-right p-2">P75</th><th className="text-right p-2">落後</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groups.map((g) => (
                <tr key={g.name} onClick={() => setPicked(g.name)} className={`cursor-pointer ${g.name === cur.name ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                  <td className={`p-2 ${g.name === cur.name ? 'font-bold text-blue-700' : 'text-slate-700'}`} title={g.name}>{g.name.length > 14 ? `${g.name.slice(0, 14)}…` : g.name}</td>
                  <td className="p-2 text-right font-mono">{g.n}</td>
                  <td className="p-2 text-right font-mono text-slate-500">{fmtPct(g.p25)}</td>
                  <td className="p-2 text-right font-mono font-bold">{fmtPct(g.med)}</td>
                  <td className="p-2 text-right font-mono text-slate-500">{fmtPct(g.p75)}</td>
                  <td className="p-2 text-right font-mono text-rose-600">{g.lagCount || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="xl:col-span-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
            <div className="font-bold text-slate-800 text-sm">{cur.name}{tier !== 'ALL' && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{tier} 級</span>}<span className="ml-2 text-xs font-normal text-slate-500">{cur.n} 件・基準排放 {fmtWan(cur.base)} 萬噸</span></div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1"><i className="w-3 h-2 rounded-sm bg-blue-500" />減量率</span>
              <span className="flex items-center gap-1"><i className="w-3 h-2 rounded-sm bg-rose-500" />落後</span>
              <span className="flex items-center gap-1"><i className="w-0.5 h-3 bg-slate-600" />產業中位數</span>
              <span className="flex items-center gap-1"><i className="w-3 h-3 bg-slate-100 border border-slate-200" />P25–P75</span>
            </div>
          </div>
          <div className="overflow-auto max-h-[420px] pr-1 space-y-1">
            {cur.ranked.map(({ p, rank, lag }) => (
              <button key={p.control_no} type="button" onClick={() => onSelectPlan?.(p.control_no)}
                className="w-full grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1.3fr)_56px] items-center gap-2 text-xs text-left hover:bg-slate-50 rounded px-1 py-0.5">
                <span className="font-mono text-slate-400 text-right">{rank}</span>
                <span className={`truncate ${lag ? 'text-rose-700 font-bold' : 'text-slate-700'}`} title={p.plan_name}>
                  {p.tier && <span className="mr-1 text-[10px] px-1 rounded border border-slate-200 text-slate-500">{p.tier}</span>}{p.plan_name}
                </span>
                <span className="relative h-4">
                  {cur.p25 != null && <span className="absolute top-0 bottom-0 bg-slate-100" style={{ left: x(cur.p25), width: `calc(${x(cur.p75)} - ${x(cur.p25)})` }} />}
                  <span className="absolute top-1 h-2 rounded" style={{ left: x(Math.min(0, p.rate)), width: `${(Math.abs(p.rate) / span) * 100}%`, background: lag ? '#e34948' : '#2a78d6' }} />
                  {cur.med != null && <span className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-slate-600" style={{ left: x(cur.med) }} />}
                </span>
                <span className={`font-mono text-right ${lag ? 'text-rose-600 font-bold' : ''}`}>{fmtPct(p.rate)}</span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-2">產業依代表事業的主要行業別歸類；共同申請計畫用計畫整體減量率。點列開啟計畫明細與逐年措施。落後不代表違規，只是相對同業承諾較保守。</p>
        </div>
      </div>
    </Section>
  );
}

// ---------- 2. 措施組合型態 ----------
function ComboPatterns({ plans }) {
  const [sortKey, setSortKey] = useState('n');
  const rows = useMemo(() => {
    const m = new Map();
    plans.forEach((p) => {
      const combo = measureCombo(p);
      const key = combo.join('+') || '未列措施';
      if (!m.has(key)) m.set(key, { key, combo, plans: [] });
      m.get(key).plans.push(p);
    });
    return [...m.values()].map((r) => ({
      ...r, n: r.plans.length, size: r.combo.length,
      med: median(r.plans.map((p) => p.rate)),
      base: r.plans.reduce((a, p) => a + (p.total_base_emission || 0), 0),
    }));
  }, [plans]);
  const sorted = [...rows].sort((a, b) => (sortKey === 'med' ? (b.med ?? -1) - (a.med ?? -1) : b.n - a.n));
  const maxN = Math.max(1, ...rows.map((r) => r.n));
  const bySize = [0, 1, 2, 3, 4].map((k) => {
    const ps = rows.filter((r) => r.size === k).flatMap((r) => r.plans);
    return { k, label: k === 0 ? '未列' : `${k} 類`, n: ps.length, med: median(ps.map((p) => p.rate)) };
  }).filter((x) => x.n);

  return (
    <Section title="③ 措施組合型態" subtitle="每件計畫在執行期間曾採用的四大類措施組合（● 有採用）。看哪些組合最常見、對應的計畫減量率中位數。"
      right={(
        <div className="seg">
          {[['n', '依計畫數'], ['med', '依減量率']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setSortKey(k)} className={`seg-btn ${sortKey === k ? 'seg-btn-on' : ''}`}>{l}</button>
          ))}
        </div>
      )}>
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div className="xl:col-span-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-500 border-b">
              <tr>
                {MEASURE_CATEGORIES.map((c) => (
                  <th key={c} className="py-1.5 px-1 font-medium text-center whitespace-nowrap">
                    <span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ background: CATEGORY_COLOR[c] }} />{c.replace('提升', '').replace('使用', '').replace('轉換', '')}
                  </th>
                ))}
                <th className="py-1.5 pl-3 text-left w-[32%]">計畫數</th>
                <th className="py-1.5 text-right">減量率中位數</th>
                <th className="py-1.5 text-right">基準排放(萬噸)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((r) => (
                <tr key={r.key} className="hover:bg-slate-50">
                  {MEASURE_CATEGORIES.map((c) => (
                    <td key={c} className="text-center py-1.5">
                      {r.combo.includes(c) ? <span className="inline-block w-3 h-3 rounded-full" style={{ background: CATEGORY_COLOR[c] }} /> : <span className="inline-block w-3 h-3 rounded-full border border-slate-200" />}
                    </td>
                  ))}
                  <td className="pl-3">
                    <div className="flex items-center gap-2"><span className="h-2.5 rounded bg-slate-500" style={{ width: `${(r.n / maxN) * 100}%` }} /><span className="font-mono">{r.n}</span></div>
                  </td>
                  <td className="text-right font-mono font-bold">{fmtPct(r.med)}</td>
                  <td className="text-right font-mono text-slate-500">{fmtWan(r.base)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div className="text-xs font-bold text-slate-600 mb-1">採用類別數 vs 減量率中位數</div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bySize} margin={{ top: 16, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={AXIS} />
                <YAxis tick={AXIS} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                <Tooltip formatter={(v, n, p) => [`${fmtPct(v)}（${p.payload.n} 件）`, '減量率中位數']} />
                <Bar dataKey="med" fill="#2a78d6" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 10, fill: '#475569', formatter: (v) => fmtPct(v, 1) }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">措施類別越多不一定減量率越高；可搭配「減量措施」分頁的產業熱力圖一起看。</p>
        </div>
      </div>
    </Section>
  );
}

// ---------- 3. 逐年減量路徑 ----------
function Trajectory({ plans }) {
  const ps = plans.map((p) => ({ p, s: frontShare({ ...p, total_first_year_target: p.total_first_year_target == null ? null : Number(p.total_first_year_target) }) }));
  const valid = ps.filter((x) => x.s != null);
  const dist = TRAJECTORY_BUCKETS.map((b) => {
    const xs = valid.filter((x) => trajectoryBucket(x.s) === b.key);
    return { ...b, n: xs.length, base: xs.reduce((a, x) => a + x.p.total_base_emission, 0), med: median(xs.map((x) => x.p.rate)) };
  });
  // 合計路徑：基準年 → 首年 → 目標年，對照線性
  const sum = (k) => valid.reduce((a, x) => a + Number(x.p[k] || 0), 0);
  const B = sum('total_base_emission');
  const F = sum('total_first_year_target');
  const T = sum('total_target_emission');
  const years = [113, 114, 115, 116, 117, 118, 119];
  const path = years.map((y, i) => ({
    year: `${y}年`,
    承諾路徑: y === 113 ? B / 1e4 : y === 114 ? F / 1e4 : (F + ((T - F) * (y - 114)) / 5) / 1e4,
    線性路徑: (B + ((T - B) * i) / 6) / 1e4,
  }));
  const medShare = median(valid.map((x) => x.s));
  const colors = { none: '#e34948', back: '#eb6834', linear: '#94a3b8', front: '#2a78d6', done: '#1baf7a' };

  return (
    <Section title="④ 逐年減量路徑：首年承諾占全程減量的比例"
      subtitle={`= (基準年 − 首年目標) ÷ (基準年 − 目標年目標)。首年 114、目標年 119，若線性遞減首年約占 ${fmtPct(LINEAR_FIRST_SHARE, 0)}；本篩選範圍中位數 ${fmtPct(medShare, 0)}（${valid.length} 件可計算）。`}>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dist} layout="vertical" margin={{ top: 4, right: 40, left: 10, bottom: 4 }}>
                <CartesianGrid stroke={GRID} horizontal={false} />
                <XAxis type="number" tick={AXIS} allowDecimals={false} />
                <YAxis type="category" dataKey="label" tick={AXIS} width={120} />
                <Tooltip formatter={(v, n, p) => [`${v} 件・減量率中位數 ${fmtPct(p.payload.med)}`, '計畫數']} />
                <Bar dataKey="n" radius={[0, 4, 4, 0]} barSize={18} label={{ position: 'right', fontSize: 11, fill: '#475569' }}>
                  {dist.map((d) => <Cell key={d.key} fill={colors[d.key] || OTHER_COLOR} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            分組：首年未減（≤2%）、後段集中（&lt;{fmtPct(LINEAR_FIRST_SHARE * 0.6, 0)}）、接近線性（≤{fmtPct(LINEAR_FIRST_SHARE * 1.6, 0)}）、前段集中（&lt;90%）、首年即達標（≥90%）。
            後段集中的計畫，減量多押在 116 年以後，是後續追蹤落實的重點。
          </p>
        </div>
        <div>
          <div className="text-xs font-bold text-slate-600 mb-1">合計排放路徑（萬公噸CO₂e）：承諾 vs 線性</div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={path} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="year" tick={AXIS} />
                <YAxis tick={AXIS} domain={['auto', 'auto']} width={56} tickFormatter={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })} />
                <Tooltip formatter={(v, n) => [`${Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })} 萬噸`, n]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line dataKey="承諾路徑" stroke="#2a78d6" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line dataKey="線性路徑" stroke="#94a3b8" strokeDasharray="5 4" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-slate-500">基準年以 113 年示意；115–118 年官網只公布首年與目標年，中間以直線連接。承諾路徑在線性路徑下方＝前段減得比線性多。</p>
        </div>
      </div>
    </Section>
  );
}

export default function CarbonFeeInsights({ plans, onSelectPlan }) {
  return (
    <div className="space-y-4">
      <RateVsScale plans={plans} onSelectPlan={onSelectPlan} />
      <IndustryRanking plans={plans} onSelectPlan={onSelectPlan} />
      <ComboPatterns plans={plans} />
      <Trajectory plans={plans} />
      <p className="text-[11px] text-slate-400">以上皆隨頁面上方的縣市／產業／規模／級別篩選變動；減量率定義見 src/lib/carbonfeeMetrics.js。</p>
    </div>
  );
}
