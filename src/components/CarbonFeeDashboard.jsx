// ==========================================
// 碳費自主減量計畫分析（環境部公開資訊）
// ==========================================
// 資料：Supabase carbonfee_* 資料表，由 scripts/crawl-carbonfee.mjs 定期爬取更新。
// 互動：上方篩選列 + 點擊圖表（產業、縣市、規模、級別）交叉篩選；點散佈圖的點或表格列開啟計畫明細。
import React, { useEffect, useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts';
import {
  AlertTriangle, ArrowDown, ArrowUp, Building2, ExternalLink, Factory, Filter, Loader2, RefreshCw, Search,
  TrendingDown, Users, X,
} from 'lucide-react';
import { ErrorBoundary } from './SharedComponents';
import { fetchCarbonfeeData } from '../lib/fetchCarbonfee';
import {
  CATEGORY_COLOR, MEASURE_CATEGORIES, OTHER_COLOR, SCALE_BUCKETS, SEQ_BLUE, SERIES_COLORS, TIER_COLOR, TIER_LABEL,
  fmtPct, fmtTon, fmtWan, reductionAmount, reductionRate, scaleBucket,
} from '../lib/carbonfeeMetrics';

const SOURCE_URL = 'https://carbonfee.moenv.gov.tw/front/reductionpublic/list';
const AXIS_TICK = { fontSize: 11, fill: '#64748b' };
const GRID = '#e2e8f0';
const BAR_BLUE = SERIES_COLORS[0];
const BAR_DIM = '#bfd6f3';
const EMPTY_FILTERS = { city: '', industry: '', tier: '', scale: '', q: '' };

const truncate = (s, n) => (s && s.length > n ? `${s.slice(0, n)}…` : s);
const rocToAd = (y) => (y ? y + 1911 : y);

// ---------- 小元件 ----------
const Card = ({ title, subtitle, right, children, className = '' }) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col ${className}`}>
    <div className="flex items-start justify-between gap-2 mb-3">
      <div>
        <h3 className="font-bold text-slate-700 text-sm">{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
    <div className="flex-1 min-h-0">{children}</div>
  </div>
);

const Kpi = ({ label, value, unit, note, icon: Icon }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
      {Icon && <Icon size={14} className="text-slate-400" />}{label}
    </div>
    <div className="mt-2 flex items-baseline gap-1">
      <span className="text-2xl font-bold text-slate-800 tabular-nums">{value}</span>
      {unit && <span className="text-xs text-slate-500">{unit}</span>}
    </div>
    {note && <div className="text-[11px] text-slate-400 mt-1">{note}</div>}
  </div>
);

const Segmented = ({ value, onChange, options }) => (
  <div className="inline-flex bg-slate-100 rounded-lg p-0.5 text-[11px]">
    {options.map((o) => (
      <button
        key={o.value}
        onClick={() => onChange(o.value)}
        className={`px-2 py-1 rounded-md transition-colors ${value === o.value ? 'bg-white text-slate-800 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'}`}
      >{o.label}</button>
    ))}
  </div>
);

const TipBox = ({ title, rows }) => (
  <div className="bg-white/95 backdrop-blur-sm p-2.5 border border-slate-200 rounded-lg shadow-xl text-xs max-w-xs">
    <p className="font-bold text-slate-800 mb-1.5 border-b border-slate-100 pb-1">{title}</p>
    {rows.map(([k, v, color]) => (
      <div key={k} className="flex justify-between gap-4 py-0.5">
        <span className="flex items-center gap-1.5 text-slate-500">
          {color && <span className="w-2 h-2 rounded-sm" style={{ background: color }} />}{k}
        </span>
        <span className="font-mono font-bold text-slate-700">{v}</span>
      </div>
    ))}
  </div>
);

const TierBadge = ({ tier }) => (
  <span
    className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold text-white"
    style={{ background: TIER_COLOR[tier] || OTHER_COLOR }}
    title={TIER_LABEL[tier]}
  >{tier || '?'}</span>
);

// 水平長條（產業、縣市、公司共用）：點擊切換篩選，選中的保持深色、其他淡化
function RankBar({ data, metric, selected, onSelect, labelWidth = 150, valueFormatter }) {
  const height = Math.max(220, data.length * 26 + 30);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }} barCategoryGap={4}>
          <CartesianGrid horizontal={false} stroke={GRID} strokeDasharray="3 3" />
          <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={valueFormatter} />
          <YAxis
            type="category" dataKey="name" width={labelWidth} tick={{ ...AXIS_TICK, fill: '#334155' }}
            axisLine={false} tickLine={false} interval={0} tickFormatter={(v) => truncate(v, 11)}
          />
          <Tooltip
            cursor={{ fill: '#f1f5f9' }}
            content={({ active, payload }) => active && payload?.length ? (
              <TipBox title={payload[0].payload.name} rows={payload[0].payload.tip} />
            ) : null}
          />
          <Bar
            dataKey={metric} radius={[0, 4, 4, 0]} maxBarSize={18} cursor={onSelect ? 'pointer' : undefined}
            onClick={onSelect ? (d) => d?.payload?.selectable !== false && onSelect(d.payload.name) : undefined}
            label={{ position: 'right', fontSize: 10, fill: '#475569', formatter: valueFormatter }}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.isOther ? OTHER_COLOR : (!selected || selected === d.name ? BAR_BLUE : BAR_DIM)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------- 計畫明細側欄 ----------
function PlanDrawer({ plan, onClose }) {
  const [facIdx, setFacIdx] = useState(0);
  const facility = plan.facilities[facIdx] || plan.facilities[0];
  const byYear = useMemo(() => {
    const ms = plan.measures.filter((m) => !facility || m.facility_control_no === facility.control_no);
    const map = new Map();
    ms.forEach((m) => {
      if (!map.has(m.roc_year)) map.set(m.roc_year, []);
      map.get(m.roc_year).push(m);
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [plan, facility]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <aside className="relative w-full max-w-xl h-full bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-start gap-3 z-10">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
              <TierBadge tier={plan.tier} /> {plan.control_no}
              {plan.is_joint && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-sans">共同申請・{plan.participant_count} 家</span>}
            </div>
            <h3 className="text-lg font-bold text-slate-800 mt-1 leading-snug">{plan.plan_name}</h3>
            <p className="text-xs text-slate-500 mt-1">執行期間 {plan.period_text}・{TIER_LABEL[plan.tier] || '—'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500" aria-label="關閉"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              ['基準年排放', fmtWan(plan.total_base_emission), '萬公噸'],
              ['目標年指定目標', fmtWan(plan.total_target_emission), '萬公噸'],
              ['承諾減量率', fmtPct(plan.rate), `減 ${fmtWan(plan.amount)} 萬公噸`],
            ].map(([k, v, u]) => (
              <div key={k} className="bg-slate-50 rounded-lg p-3">
                <div className="text-[11px] text-slate-500">{k}</div>
                <div className="text-lg font-bold text-slate-800 tabular-nums">{v}</div>
                <div className="text-[10px] text-slate-400">{u}</div>
              </div>
            ))}
          </div>
          {plan.is_joint && plan.list_base_emission !== plan.total_base_emission && (
            <p className="text-[11px] text-slate-500 bg-amber-50 border border-amber-100 rounded p-2">
              官網列表頁只顯示代表事業本身的基準年排放（{fmtTon(plan.list_base_emission)}），上方數字為計畫所有參與事業的合計。
            </p>
          )}

          {plan.facilities.length > 1 && (
            <div>
              <h4 className="text-xs font-bold text-slate-500 mb-2">參與事業（點選查看各廠措施）</h4>
              <div className="flex flex-wrap gap-1.5">
                {plan.facilities.map((f, i) => (
                  <button
                    key={f.control_no}
                    onClick={() => setFacIdx(i)}
                    className={`text-left text-xs px-2.5 py-1.5 rounded-lg border ${i === facIdx ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    {f.is_representative && <span className="text-[10px] text-blue-600 font-bold mr-1">代表</span>}
                    {truncate(f.name, 22)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {facility && (
            <dl className="grid grid-cols-[88px_1fr] gap-y-1.5 text-xs">
              <dt className="text-slate-400">事業名稱</dt><dd className="text-slate-700">{facility.name}</dd>
              <dt className="text-slate-400">管制編號</dt><dd className="text-slate-700 font-mono">{facility.control_no}</dd>
              <dt className="text-slate-400">行業別</dt><dd className="text-slate-700">{(facility.industries || []).join('、') || '—'}</dd>
              <dt className="text-slate-400">登記地址</dt><dd className="text-slate-700">{facility.address || '—'}</dd>
              <dt className="text-slate-400">基準年排放</dt><dd className="text-slate-700">{fmtTon(facility.base_emission)}</dd>
            </dl>
          )}

          <div>
            <h4 className="text-xs font-bold text-slate-500 mb-2">核定之逐年減量措施</h4>
            {byYear.length === 0 && <p className="text-xs text-slate-400">無措施資料</p>}
            <ol className="relative border-l-2 border-slate-100 ml-2 space-y-4">
              {byYear.map(([year, ms]) => (
                <li key={year} className="pl-4">
                  <span className="absolute -left-[7px] mt-1 w-3 h-3 rounded-full bg-white border-2 border-blue-400" />
                  <div className="text-xs font-bold text-slate-700">{year} 年 <span className="text-slate-400 font-normal">（{rocToAd(year)}）</span></div>
                  <ul className="mt-1.5 space-y-1">
                    {ms.map((m) => (
                      <li key={m.id} className="text-xs text-slate-600 flex gap-2">
                        <span className="font-mono text-slate-400 w-4 flex-shrink-0">{m.code}</span>
                        <span className="flex-1">
                          {m.name}
                          <span className="ml-1.5 inline-flex flex-wrap gap-1 align-middle">
                            {(m.categories || []).map((c) => (
                              <span key={c} className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-1">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: CATEGORY_COLOR[c] || OTHER_COLOR }} />{c}
                              </span>
                            ))}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
          <a
            href={`${SOURCE_URL}/Detail?controlNo=${encodeURIComponent(plan.control_no)}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          ><ExternalLink size={12} /> 環境部官網明細頁</a>
        </div>
      </aside>
    </div>
  );
}

// ---------- 主元件 ----------
export default function CarbonFeeDashboard() {
  const [raw, setRaw] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [industryMetric, setIndustryMetric] = useState('count');
  const [cityMetric, setCityMetric] = useState('count');
  const [selectedId, setSelectedId] = useState(null);
  const [sort, setSort] = useState({ key: 'total_base_emission', dir: 'desc' });
  const [page, setPage] = useState(0);
  const [showTrendTable, setShowTrendTable] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchCarbonfeeData()
      .then(setRaw)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  // 組裝：plan ← facilities、measures，並算好衍生欄位
  const allPlans = useMemo(() => {
    if (!raw) return [];
    const facByPlan = new Map();
    raw.facilities.forEach((f) => {
      if (!facByPlan.has(f.plan_control_no)) facByPlan.set(f.plan_control_no, []);
      facByPlan.get(f.plan_control_no).push(f);
    });
    const msByPlan = new Map();
    raw.measures.forEach((m) => {
      if (!msByPlan.has(m.plan_control_no)) msByPlan.set(m.plan_control_no, []);
      msByPlan.get(m.plan_control_no).push(m);
    });
    return raw.plans
      .filter((p) => p.status === 'active')
      .map((p) => {
        const facilities = (facByPlan.get(p.control_no) || []).sort((a, b) => Number(b.is_representative) - Number(a.is_representative));
        const rep = facilities.find((f) => f.is_representative) || facilities[0];
        const measures = msByPlan.get(p.control_no) || [];
        const num = (v) => (v == null ? null : Number(v));
        const plan = {
          ...p,
          total_base_emission: num(p.total_base_emission),
          total_target_emission: num(p.total_target_emission),
          list_base_emission: num(p.list_base_emission),
          facilities: facilities.map((f) => ({ ...f, base_emission: num(f.base_emission) })),
          measures,
          city: rep?.city || null,
          industry: rep?.primary_industry || null,
          cities: new Set(facilities.map((f) => f.city).filter(Boolean)),
          industries: new Set(facilities.map((f) => f.primary_industry).filter(Boolean)),
          categoriesByYear: measures.reduce((acc, m) => {
            (acc[m.roc_year] ||= new Set());
            (m.categories || []).forEach((c) => acc[m.roc_year].add(c));
            return acc;
          }, {}),
        };
        plan.rate = reductionRate(plan);
        plan.amount = reductionAmount(plan);
        plan.scale = scaleBucket(plan.total_base_emission);
        plan.measureCount = measures.length;
        return plan;
      });
  }, [raw]);

  // 交叉篩選：每張圖套用「除了自己那個維度以外」的篩選，才能在圖上直接切換選項
  const matches = (p, skip) => {
    const f = filters;
    if (skip !== 'city' && f.city && !p.cities.has(f.city)) return false;
    if (skip !== 'industry' && f.industry && !p.industries.has(f.industry)) return false;
    if (skip !== 'tier' && f.tier && p.tier !== f.tier) return false;
    if (skip !== 'scale' && f.scale && p.scale !== f.scale) return false;
    if (f.q) {
      const q = f.q.trim().toLowerCase();
      const hay = `${p.plan_name} ${p.control_no} ${p.facilities.map((x) => `${x.name} ${x.control_no}`).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };
  const plans = useMemo(() => allPlans.filter((p) => matches(p)), [allPlans, filters]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (key, value) => { setFilters((f) => ({ ...f, [key]: f[key] === value ? '' : value })); setPage(0); };
  const activeFilterCount = ['city', 'industry', 'tier', 'scale', 'q'].filter((k) => filters[k]).length;

  const kpi = useMemo(() => {
    const sum = (fn) => plans.reduce((s, p) => s + (fn(p) || 0), 0);
    const base = sum((p) => p.total_base_emission);
    const target = sum((p) => p.total_target_emission);
    return {
      count: plans.length,
      joint: plans.filter((p) => p.is_joint).length,
      facilities: sum((p) => p.facilities.length || 1),
      base, target, amount: base - target, pct: base ? (base - target) / base : null,
      tierA: plans.filter((p) => p.tier === 'A').length,
    };
  }, [plans]);

  // 以「廠（參與事業）」為單位彙整：共同申請的各參與廠依自己的縣市/產業計入
  const facilityAgg = (skip, keyOf) => {
    const map = new Map();
    allPlans.filter((p) => matches(p, skip)).forEach((p) => {
      const facs = p.facilities.length ? p.facilities : [{ city: p.city, primary_industry: p.industry, base_emission: p.total_base_emission }];
      facs.forEach((f) => {
        const k = keyOf(f);
        if (!k) return;
        const cur = map.get(k) || { name: k, count: 0, base: 0 };
        cur.count += 1;
        cur.base += f.base_emission || 0;
        map.set(k, cur);
      });
    });
    return [...map.values()];
  };

  const industryData = useMemo(() => {
    const rows = facilityAgg('industry', (f) => f.primary_industry).sort((a, b) => b[industryMetric] - a[industryMetric]);
    const top = rows.slice(0, 12);
    const rest = rows.slice(12);
    if (rest.length) {
      top.push({ name: `其他 ${rest.length} 類`, count: rest.reduce((s, r) => s + r.count, 0), base: rest.reduce((s, r) => s + r.base, 0), isOther: true, selectable: false });
    }
    return top.map((r) => ({ ...r, tip: [['廠數', `${r.count} 廠`], ['基準年排放', fmtTon(r.base)]] }));
  }, [allPlans, filters, industryMetric]); // eslint-disable-line react-hooks/exhaustive-deps

  const cityData = useMemo(() => (
    facilityAgg('city', (f) => f.city)
      .sort((a, b) => b[cityMetric] - a[cityMetric])
      .map((r) => ({ ...r, tip: [['廠數', `${r.count} 廠`], ['基準年排放', fmtTon(r.base)]] }))
  ), [allPlans, filters, cityMetric]); // eslint-disable-line react-hooks/exhaustive-deps

  const scaleData = useMemo(() => {
    const pool = allPlans.filter((p) => matches(p, 'scale'));
    return SCALE_BUCKETS.map((b) => {
      const ps = pool.filter((p) => p.scale === b.key);
      return { key: b.key, name: b.label, short: b.short, count: ps.length, base: ps.reduce((s, p) => s + (p.total_base_emission || 0), 0) };
    });
  }, [allPlans, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const scatterData = useMemo(() => {
    const pts = (tier) => plans
      .filter((p) => p.tier === tier && p.total_base_emission > 0 && p.rate != null)
      .map((p) => ({ x: p.total_base_emission, y: +(p.rate * 100).toFixed(2), name: p.plan_name, id: p.control_no, tier }));
    return { A: pts('A'), B: pts('B') };
  }, [plans]);

  const rateStats = useMemo(() => {
    const rs = plans.map((p) => p.rate).filter((r) => r != null).sort((a, b) => a - b);
    return rs.length ? { median: rs[Math.floor(rs.length / 2)] } : null;
  }, [plans]);

  // 逐年：每類措施「有揭露該類措施的計畫比例」（筆數會因後續年度省略重複措施而遞減，比例較不易誤導）
  const trendData = useMemo(() => {
    const years = [...new Set(plans.flatMap((p) => Object.keys(p.categoriesByYear).map(Number)))].sort((a, b) => a - b);
    return years.map((y) => {
      const row = { year: `${y}年`, n: plans.length };
      MEASURE_CATEGORIES.forEach((c) => {
        const k = plans.filter((p) => p.categoriesByYear[y]?.has(c)).length;
        row[c] = plans.length ? +((k / plans.length) * 100).toFixed(1) : 0;
        row[`${c}_n`] = k;
      });
      return row;
    });
  }, [plans]);

  // 產業 × 措施類型：該產業有多少比例的計畫（全期間）採用該類措施
  const heatmap = useMemo(() => {
    const byInd = new Map();
    plans.forEach((p) => {
      if (!p.industry) return;
      if (!byInd.has(p.industry)) byInd.set(p.industry, []);
      byInd.get(p.industry).push(p);
    });
    return [...byInd.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10)
      .map(([name, ps]) => ({
        name,
        n: ps.length,
        cells: MEASURE_CATEGORIES.map((c) => {
          const k = ps.filter((p) => Object.values(p.categoriesByYear).some((s) => s.has(c))).length;
          return { c, k, share: k / ps.length };
        }),
      }));
  }, [plans]);

  const cumulative = useMemo(() => {
    const byMonth = new Map();
    plans.forEach((p) => {
      if (!p.period_start) return;
      const m = p.period_start.slice(0, 7);
      byMonth.set(m, (byMonth.get(m) || 0) + 1);
    });
    let acc = 0;
    return [...byMonth.entries()].sort().map(([m, n]) => { acc += n; return { month: m, added: n, total: acc }; });
  }, [plans]);

  const companyData = useMemo(() => {
    const map = new Map();
    plans.forEach((p) => {
      const k = p.company || p.plan_name;
      const cur = map.get(k) || { name: k, base: 0, plans: 0, amount: 0 };
      cur.base += p.total_base_emission || 0;
      cur.amount += p.amount || 0;
      cur.plans += 1;
      map.set(k, cur);
    });
    return [...map.values()].sort((a, b) => b.base - a.base).slice(0, 10)
      .map((r) => ({ ...r, tip: [['計畫數', `${r.plans} 件`], ['基準年排放', fmtTon(r.base)], ['承諾減量', fmtTon(r.amount)], ['減量率', fmtPct(r.base ? r.amount / r.base : null)]] }));
  }, [plans]);

  const sortedPlans = useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...plans].sort((a, b) => {
      const va = a[sort.key]; const vb = b[sort.key];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (typeof va === 'string' ? va.localeCompare(vb, 'zh-Hant') : va - vb) * dir;
    });
  }, [plans, sort]);
  const PAGE = 15;
  const pageCount = Math.max(1, Math.ceil(sortedPlans.length / PAGE));
  const pageRows = sortedPlans.slice(page * PAGE, page * PAGE + PAGE);

  const lastRun = raw?.runs?.[0];
  const runsWithChanges = useMemo(() => {
    if (!raw) return [];
    const firstRunId = raw.runs.length ? Math.min(...raw.runs.map((r) => r.id)) : null;
    return raw.runs.map((r) => ({
      ...r,
      initial: r.id === firstRunId && r.new_count === r.plan_count,
      changes: raw.changes.filter((c) => c.run_id === r.id),
    }));
  }, [raw]);

  const selectedPlan = selectedId ? allPlans.find((p) => p.control_no === selectedId) : null;
  const industryOptions = useMemo(() => [...new Set(allPlans.flatMap((p) => [...p.industries]))].sort((a, b) => a.localeCompare(b, 'zh-Hant')), [allPlans]);
  const cityOptions = useMemo(() => [...new Set(allPlans.flatMap((p) => [...p.cities]))].sort((a, b) => a.localeCompare(b, 'zh-Hant')), [allPlans]);

  if (loading && !raw) {
    return <div className="flex-1 flex items-center justify-center text-slate-500 gap-2 p-10"><Loader2 className="animate-spin" size={20} /> 載入碳費自主減量計畫資料…</div>;
  }
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-4 text-sm flex items-start gap-2">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">資料載入失敗</p><p className="mt-1">{error}</p>
            <button onClick={load} className="mt-2 inline-flex items-center gap-1 text-xs bg-white border border-rose-200 rounded px-2 py-1"><RefreshCw size={12} /> 重試</button>
          </div>
        </div>
      </div>
    );
  }

  if (raw && raw.plans.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 text-sm flex items-start gap-2">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">資料庫尚無碳費自主減量計畫資料</p>
            <p className="mt-1">請在 GitHub Actions 執行「碳費自主減量計畫爬蟲」並核准，或在本機執行 <code className="bg-white px-1 rounded">npm run crawl:carbonfee</code>。</p>
            <button onClick={load} className="mt-2 inline-flex items-center gap-1 text-xs bg-white border border-amber-200 rounded px-2 py-1"><RefreshCw size={12} /> 重新讀取</button>
          </div>
        </div>
      </div>
    );
  }

  const SortTh = ({ k, children, className = '' }) => (
    <th className={`px-3 py-2 font-medium cursor-pointer select-none hover:text-slate-800 ${className}`}
      onClick={() => setSort((s) => ({ key: k, dir: s.key === k && s.dir === 'desc' ? 'asc' : 'desc' }))}>
      <span className="inline-flex items-center gap-0.5">{children}{sort.key === k && (sort.dir === 'desc' ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}</span>
    </th>
  );

  const scaleLabel = SCALE_BUCKETS.find((b) => b.key === filters.scale)?.label;

  return (
    <div className="p-6 space-y-5">
      {/* 標題 */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="p-2 rounded-lg text-white bg-emerald-600"><TrendingDown size={24} /></div>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold text-slate-800">碳費自主減量計畫分析</h2>
          <p className="text-xs text-slate-500 mt-1">
            資料來源：環境部碳費申報及收費管理平台「自主減量計畫公開資訊」
            <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-blue-600 hover:underline"><ExternalLink size={11} />官網</a>
            {lastRun && <>・最近更新 {new Date(lastRun.started_at).toLocaleDateString('zh-TW')}</>}
          </p>
        </div>
      </div>

      {/* 篩選列 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-wrap items-center gap-2 text-sm sticky top-0 z-20">
        <Filter size={16} className="text-slate-400" />
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input value={filters.q} onChange={(e) => { setFilters((f) => ({ ...f, q: e.target.value })); setPage(0); }}
            placeholder="搜尋事業名稱 / 管制編號" className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg w-56 text-sm outline-none focus:border-blue-400" />
        </div>
        <select value={filters.city} onChange={(e) => { setFilters((f) => ({ ...f, city: e.target.value })); setPage(0); }} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white">
          <option value="">全部縣市</option>{cityOptions.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={filters.industry} onChange={(e) => { setFilters((f) => ({ ...f, industry: e.target.value })); setPage(0); }} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white max-w-[200px]">
          <option value="">全部產業</option>{industryOptions.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={filters.scale} onChange={(e) => { setFilters((f) => ({ ...f, scale: e.target.value })); setPage(0); }} className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white">
          <option value="">全部規模</option>{SCALE_BUCKETS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
        </select>
        <Segmented value={filters.tier} onChange={(v) => { setFilters((f) => ({ ...f, tier: v })); setPage(0); }}
          options={[{ value: '', label: '全部級別' }, { value: 'A', label: 'A級' }, { value: 'B', label: 'B級' }]} />
        {activeFilterCount > 0 && (
          <button onClick={() => { setFilters(EMPTY_FILTERS); setPage(0); }} className="ml-auto text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1">
            <X size={12} /> 清除篩選（{activeFilterCount}）
          </button>
        )}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi icon={Building2} label="核定計畫" value={kpi.count.toLocaleString()} unit="件" note={`含共同申請 ${kpi.joint} 件・參與事業 ${kpi.facilities} 家`} />
        <Kpi icon={Factory} label="基準年排放合計" value={fmtWan(kpi.base)} unit="萬公噸CO₂e" />
        <Kpi label="目標年指定目標合計" value={fmtWan(kpi.target)} unit="萬公噸CO₂e" note="目標年：119年（2030）" />
        <Kpi icon={TrendingDown} label="承諾減量" value={fmtWan(kpi.amount)} unit="萬公噸" note={`較基準年 −${fmtPct(kpi.pct)}；中位數計畫 −${fmtPct(rateStats?.median)}`} />
        <Kpi icon={Users} label="A級（技術標竿）" value={kpi.tierA} unit="件" note={`佔 ${fmtPct(kpi.count ? kpi.tierA / kpi.count : null)}，其餘為 B級（達成效益）`} />
      </div>

      {/* 產業 / 縣市 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="產業別分布" subtitle="依廠計（共同申請各參與廠分別計入）・點長條篩選"
          right={<Segmented value={industryMetric} onChange={setIndustryMetric} options={[{ value: 'count', label: '廠數' }, { value: 'base', label: '基準年排放' }]} />}>
          <ErrorBoundary>
            <RankBar data={industryData} metric={industryMetric} selected={filters.industry} onSelect={(v) => toggle('industry', v)}
              valueFormatter={industryMetric === 'base' ? fmtWan : undefined} />
          </ErrorBoundary>
          {industryMetric === 'base' && <p className="text-[10px] text-slate-400 mt-1 text-right">單位：萬公噸CO₂e</p>}
        </Card>
        <Card title="縣市分布" subtitle="依廠址・點長條篩選"
          right={<Segmented value={cityMetric} onChange={setCityMetric} options={[{ value: 'count', label: '廠數' }, { value: 'base', label: '基準年排放' }]} />}>
          <ErrorBoundary>
            <RankBar data={cityData} metric={cityMetric} selected={filters.city} onSelect={(v) => toggle('city', v)} labelWidth={70}
              valueFormatter={cityMetric === 'base' ? fmtWan : undefined} />
          </ErrorBoundary>
          {cityMetric === 'base' && <p className="text-[10px] text-slate-400 mt-1 text-right">單位：萬公噸CO₂e</p>}
        </Card>
      </div>

      {/* 散佈圖 / 規模 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2" title="排放規模 vs 承諾減量率" subtitle="每個點是一件計畫・橫軸為對數刻度・點擊看明細">
          <div className="h-[340px]">
            <ErrorBoundary>
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="x" scale="log" domain={['auto', 'auto']} tick={AXIS_TICK} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `${fmtWan(v)}萬`} name="基準年排放"
                    label={{ value: '基準年排放（公噸CO₂e，對數）', position: 'insideBottom', offset: -5, fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis type="number" dataKey="y" tick={AXIS_TICK} axisLine={false} tickLine={false} unit="%" name="減量率" width={48} />
                  <ZAxis range={[60, 60]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => active && payload?.length ? (
                    <TipBox title={payload[0].payload.name} rows={[
                      ['級別', TIER_LABEL[payload[0].payload.tier], TIER_COLOR[payload[0].payload.tier]],
                      ['基準年排放', fmtTon(payload[0].payload.x)],
                      ['承諾減量率', `${payload[0].payload.y}%`],
                    ]} />
                  ) : null} />
                  <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: 11 }} />
                  {['B', 'A'].map((t) => (
                    <Scatter key={t} name={TIER_LABEL[t]} data={scatterData[t]} fill={TIER_COLOR[t]} fillOpacity={0.8}
                      stroke="#fff" strokeWidth={1.5} cursor="pointer" onClick={(d) => setSelectedId(d?.payload?.id ?? d?.id)} />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </ErrorBoundary>
          </div>
        </Card>
        <Card title="排放規模分級" subtitle="依計畫整體基準年排放・點長條篩選">
          <div className="h-[340px]">
            <ErrorBoundary>
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <BarChart data={scaleData} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
                  <XAxis dataKey="short" tick={{ ...AXIS_TICK, fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} content={({ active, payload }) => active && payload?.length ? (
                    <TipBox title={payload[0].payload.name} rows={[['計畫數', `${payload[0].payload.count} 件`], ['基準年排放', fmtTon(payload[0].payload.base)]]} />
                  ) : null} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40} cursor="pointer" onClick={(d) => toggle('scale', d.payload.key)}
                    label={{ position: 'top', fontSize: 10, fill: '#475569' }}>
                    {scaleData.map((d) => <Cell key={d.key} fill={!filters.scale || filters.scale === d.key ? BAR_BLUE : BAR_DIM} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ErrorBoundary>
          </div>
        </Card>
      </div>

      {/* 措施趨勢 / 熱力圖 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="逐年減量措施類型" subtitle="各年度有列出該類措施的計畫比例（一筆措施可屬多類）"
          right={<button onClick={() => setShowTrendTable((v) => !v)} className="text-[11px] text-blue-600 hover:underline">{showTrendTable ? '看圖表' : '看表格'}</button>}>
          {showTrendTable ? (
            <table className="w-full text-xs">
              <thead><tr className="text-slate-500 border-b"><th className="text-left py-1.5">年度</th>{MEASURE_CATEGORIES.map((c) => <th key={c} className="text-right py-1.5">{c}</th>)}</tr></thead>
              <tbody>{trendData.map((r) => (
                <tr key={r.year} className="border-b border-slate-50"><td className="py-1.5">{r.year}</td>{MEASURE_CATEGORIES.map((c) => <td key={c} className="text-right tabular-nums">{r[c]}%（{r[`${c}_n`]}）</td>)}</tr>
              ))}</tbody>
            </table>
          ) : (
            <div className="h-[300px]">
              <ErrorBoundary>
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <LineChart data={trendData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
                    <XAxis dataKey="year" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
                    <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                      <TipBox title={`${label}（共 ${payload[0].payload.n} 件計畫）`} rows={payload.map((p) => [p.name, `${p.value}%・${p.payload[`${p.name}_n`]} 件`, p.color])} />
                    ) : null} />
                    <Legend wrapperStyle={{ fontSize: 11 }} itemSorter={null} />
                    {MEASURE_CATEGORIES.map((c) => (
                      <Line key={c} type="monotone" dataKey={c} name={c} stroke={CATEGORY_COLOR[c]} strokeWidth={2}
                        dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </ErrorBoundary>
            </div>
          )}
          <p className="text-[10px] text-slate-400 mt-2">註：首年（114年）多數計畫完整列出措施，後續年度常省略延續中的措施，數字下降不代表措施減少。</p>
        </Card>
        <Card title="產業 × 減量措施類型" subtitle="前 10 大產業（依計畫數）中，執行期間曾採用該類措施的計畫比例・點列篩選產業">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-separate" style={{ borderSpacing: 2 }}>
              <thead>
                <tr>
                  <th className="text-left font-medium text-slate-500 pb-1">產業（計畫數）</th>
                  {MEASURE_CATEGORIES.map((c) => <th key={c} className="font-medium text-slate-500 pb-1 px-1 whitespace-nowrap">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {heatmap.map((row) => (
                  <tr key={row.name} className="cursor-pointer group" onClick={() => toggle('industry', row.name)}>
                    <td className={`pr-2 py-0.5 whitespace-nowrap group-hover:text-blue-700 ${filters.industry === row.name ? 'font-bold text-blue-700' : 'text-slate-700'}`} title={row.name}>
                      {truncate(row.name, 12)} <span className="text-slate-400">({row.n})</span>
                    </td>
                    {row.cells.map((cell) => {
                      const idx = Math.min(SEQ_BLUE.length - 1, Math.floor(cell.share * SEQ_BLUE.length));
                      const bg = cell.k === 0 ? '#f8fafc' : SEQ_BLUE[idx];
                      return (
                        <td key={cell.c} className="text-center rounded h-8 min-w-[64px] tabular-nums"
                          style={{ background: bg, color: idx >= 4 ? '#fff' : '#1e293b' }}
                          title={`${row.name}・${cell.c}：${cell.k}/${row.n} 件（${fmtPct(cell.share, 0)}）`}>
                          {fmtPct(cell.share, 0)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-1 mt-3 text-[10px] text-slate-400">
            0%{SEQ_BLUE.map((c) => <span key={c} className="w-5 h-2.5 rounded-sm" style={{ background: c }} />)}100%
          </div>
        </Card>
      </div>

      {/* 核定進度 / 公司 / 異動 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card title="核定計畫累積件數" subtitle="依計畫生效日（執行期間起日）">
          <div className="h-[260px]">
            <ErrorBoundary>
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <AreaChart data={cumulative} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                    <TipBox title={label} rows={[['當月新增', `${payload[0].payload.added} 件`], ['累積', `${payload[0].payload.total} 件`, BAR_BLUE]]} />
                  ) : null} />
                  <Area type="stepAfter" dataKey="total" stroke={BAR_BLUE} strokeWidth={2} fill={BAR_BLUE} fillOpacity={0.12} />
                </AreaChart>
              </ResponsiveContainer>
            </ErrorBoundary>
          </div>
        </Card>
        <Card title="公司別基準年排放 Top 10" subtitle="同公司多廠/多件計畫合併">
          <ErrorBoundary>
            <RankBar data={companyData} metric="base" labelWidth={130} valueFormatter={fmtWan} />
          </ErrorBoundary>
          <p className="text-[10px] text-slate-400 mt-1 text-right">單位：萬公噸CO₂e</p>
        </Card>
        <Card title="資料更新紀錄" subtitle="每次爬蟲與官網比對出的異動">
          <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1 text-xs">
            {runsWithChanges.length === 0 && <p className="text-slate-400">尚無紀錄</p>}
            {runsWithChanges.map((r) => (
              <div key={r.id} className="border-l-2 border-slate-200 pl-3">
                <div className="font-bold text-slate-700">{new Date(r.started_at).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                {r.initial ? (
                  <p className="text-slate-500">首次建檔：{r.plan_count} 件計畫、{r.facility_count} 家事業、{r.measure_count} 筆措施</p>
                ) : (
                  <>
                    <p className="text-slate-500">新增 {r.new_count}・下架 {r.removed_count}・內容變更 {r.updated_count}（共 {r.plan_count} 件）</p>
                    <ul className="mt-1 space-y-0.5">
                      {r.changes.slice(0, 8).map((c) => (
                        <li key={c.id} className="text-slate-600 truncate" title={`${c.plan_name} ${c.field || ''}`}>
                          <span className={`inline-block w-10 text-[10px] font-bold ${c.change_type === 'new' ? 'text-emerald-600' : c.change_type === 'removed' ? 'text-rose-600' : 'text-amber-600'}`}>
                            {{ new: '新增', removed: '下架', restored: '恢復', updated: '變更' }[c.change_type]}
                          </span>
                          <button className="hover:underline" onClick={() => setSelectedId(c.control_no)}>{truncate(c.plan_name, 18)}</button>
                        </li>
                      ))}
                      {r.changes.length > 8 && <li className="text-slate-400">…另 {r.changes.length - 8} 筆</li>}
                    </ul>
                  </>
                )}
                {r.note && <p className="text-amber-600 mt-0.5">{r.note}</p>}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 明細表 */}
      <Card title={`計畫明細（${plans.length} 件）`}
        subtitle={[filters.city, filters.industry, filters.tier && `${filters.tier}級`, scaleLabel, filters.q && `「${filters.q}」`].filter(Boolean).join('・') || '點欄位標題排序・點列查看逐年措施'}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <SortTh k="control_no">管制編號</SortTh>
                <SortTh k="plan_name">計畫（代表事業）</SortTh>
                <SortTh k="city">縣市</SortTh>
                <SortTh k="industry">產業別</SortTh>
                <SortTh k="tier" className="text-center">級別</SortTh>
                <SortTh k="total_base_emission" className="text-right">基準年排放</SortTh>
                <SortTh k="total_target_emission" className="text-right">目標年目標</SortTh>
                <SortTh k="rate" className="text-right">減量率</SortTh>
                <SortTh k="measureCount" className="text-right">措施數</SortTh>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((p) => (
                <tr key={p.control_no} onClick={() => setSelectedId(p.control_no)} className="border-b border-slate-100 hover:bg-blue-50/50 cursor-pointer">
                  <td className="px-3 py-2 font-mono text-slate-500">{p.control_no}</td>
                  <td className="px-3 py-2 text-slate-800">
                    {p.plan_name}
                    {p.is_joint && <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-slate-100 text-slate-500">共同 {p.participant_count}</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{p.city || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{truncate(p.industry, 14) || '—'}</td>
                  <td className="px-3 py-2 text-center"><TierBadge tier={p.tier} /></td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.total_base_emission?.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.total_target_emission?.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-700">{fmtPct(p.rate)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.measureCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
          <span>單位：公噸CO₂e</span>
          <div className="flex items-center gap-2">
            <button disabled={page === 0} onClick={() => setPage((x) => x - 1)} className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40">上一頁</button>
            <span>{page + 1} / {pageCount}</span>
            <button disabled={page >= pageCount - 1} onClick={() => setPage((x) => x + 1)} className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40">下一頁</button>
          </div>
        </div>
      </Card>

      <p className="text-[11px] text-slate-400 leading-relaxed">
        說明：減量率 =（基準年排放 − 目標年指定目標）÷ 基準年排放，以計畫整體（共同申請為各參與事業合計）計算。
        產業別取各廠第一個登記行業；減量方式依官網原文歸入四大類。措施代號由各計畫自編，跨公司不可比較。
      </p>

      {selectedPlan && <PlanDrawer key={selectedPlan.control_no} plan={selectedPlan} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
