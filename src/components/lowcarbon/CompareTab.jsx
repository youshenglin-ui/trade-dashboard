// 分頁 2：技術與產業比較
//   - 四大類並排比較（小倍數：件數、年減碳、投資強度、回收年限）
//   - 子類排行（可切換指標）
//   - 產業 × 子類 熱力圖（點格子看案例）
//   - 產業選技術建議：本產業已驗證 + 其他產業可借鏡
import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  CATEGORIES, CATEGORY_COLOR, co2Of, fmtNum, fmtTon, fmtWan, fmtYears, investPerTon, median, paybackOf,
} from '../../lib/lowcarbon/metrics';
import { SEQ_BLUE } from '../../lib/carbonfeeMetrics';
import { AXIS_TICK, Card, GRID, Note, Segmented, Select, TipBox } from './ui';

const SUB_METRICS = [
  { value: 'intensity', label: '投資強度', desc: '中位數，萬元 /（公噸/年），越低越划算', fmt: (v) => fmtNum(v, 2), asc: true },
  { value: 'payback', label: '回收年限', desc: '中位數（年），越短越好', fmt: (v) => fmtYears(v), asc: true },
  { value: 'co2', label: '年減碳合計', desc: '公噸 CO2e/年', fmt: fmtTon, asc: false },
  { value: 'n', label: '案例數', desc: '件', fmt: (v) => `${v} 件`, asc: false },
];

function summarize(list, opts) {
  return {
    n: list.length,
    co2: list.reduce((s, c) => s + (co2Of(c, opts) || 0), 0),
    intensity: median(list.map((c) => investPerTon(c, opts))),
    payback: median(list.map(paybackOf)),
    inv: median(list.map((c) => (c.investment_wan > 0 ? c.investment_wan : null))),
    industries: new Set(list.map((c) => c.industry)).size,
  };
}

export default function CompareTab({ rows, allRows, normalizeEf, industry }) {
  const opts = useMemo(() => ({ normalizeEf }), [normalizeEf]);
  const [subMetric, setSubMetric] = useState('intensity');
  const [heatMetric, setHeatMetric] = useState('n');
  const [cell, setCell] = useState(null);
  const [target, setTarget] = useState(industry || '造紙業');

  const byCat = useMemo(() => CATEGORIES.map((cat) => ({ cat, ...summarize(rows.filter((c) => c.category === cat), opts) })), [rows, opts]);

  const subs = useMemo(() => {
    const m = new Map();
    for (const c of rows) {
      const k = `${c.category}|${c.subcategory || '其他'}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(c);
    }
    const metric = SUB_METRICS.find((x) => x.value === subMetric);
    return [...m.entries()].map(([k, list]) => {
      const [cat, sub] = k.split('|');
      return { name: sub, cat, ...summarize(list, opts) };
    }).filter((r) => r[subMetric] != null && (subMetric !== 'intensity' && subMetric !== 'payback' ? true : r.n >= 2))
      .sort((a, b) => (metric.asc ? a[subMetric] - b[subMetric] : b[subMetric] - a[subMetric]));
  }, [rows, subMetric, opts]);
  const subMeta = SUB_METRICS.find((x) => x.value === subMetric);

  // 熱力圖：列 = 產業（不受上方產業篩選，否則只剩一列），欄 = 子類
  // 有極端值時座標上限取第二大值的 1.3 倍，避免單一子類把其他柱子壓扁
  const subCap = useMemo(() => {
    const v = subs.map((d) => d[subMetric]).filter((x) => x != null).sort((a, b) => b - a);
    return v.length > 2 && v[0] > v[1] * 3 ? v[1] * 1.3 : null;
  }, [subs, subMetric]);
  const heat = useMemo(() => {
    const src = allRows.filter((c) => rows.includes(c) || !industry);
    const inds = [...new Set(src.map((c) => c.industry))].sort((a, b) => (a === '跨產業') - (b === '跨產業') || a.localeCompare(b, 'zh-Hant'));
    const subsAll = [...new Set(src.map((c) => `${c.category}|${c.subcategory || '其他'}`))]
      .sort((a, b) => CATEGORIES.indexOf(a.split('|')[0]) - CATEGORIES.indexOf(b.split('|')[0]) || a.localeCompare(b, 'zh-Hant'));
    const val = (list) => (heatMetric === 'n' ? list.length : list.reduce((s, c) => s + (co2Of(c, opts) || 0), 0));
    const cells = {};
    let max = 0;
    for (const i of inds) for (const s of subsAll) {
      const list = src.filter((c) => c.industry === i && `${c.category}|${c.subcategory || '其他'}` === s);
      const v = val(list);
      cells[`${i}|${s}`] = { v, list };
      max = Math.max(max, v);
    }
    return { inds, subs: subsAll, cells, max };
  }, [rows, allRows, industry, heatMetric, opts]);

  return (
    <div className="space-y-4">
      <Card title="四大類技術比較" subtitle="同一列為同一類技術；各欄長條在欄內互相比較。投資強度＝每多減 1 公噸/年所需的初始投資（萬元）。">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-brand-line">
                <th className="text-left font-medium py-2 pr-2">類別</th>
                <th className="text-left font-medium py-2 px-2">案例數</th>
                <th className="text-left font-medium py-2 px-2">年減碳量合計</th>
                <th className="text-left font-medium py-2 px-2">投資強度（中位數）</th>
                <th className="text-left font-medium py-2 px-2">回收年限（中位數）</th>
              </tr>
            </thead>
            <tbody>
              {byCat.map((r) => (
                <tr key={r.cat} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-2 font-bold whitespace-nowrap">
                    <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle" style={{ background: CATEGORY_COLOR[r.cat] }} />{r.cat}
                  </td>
                  <InlineBar value={r.n} max={Math.max(...byCat.map((x) => x.n))} color={CATEGORY_COLOR[r.cat]} label={`${r.n} 件`} />
                  <InlineBar value={r.co2} max={Math.max(...byCat.map((x) => x.co2))} color={CATEGORY_COLOR[r.cat]} label={fmtTon(r.co2)} />
                  <InlineBar value={r.intensity} max={Math.max(...byCat.map((x) => x.intensity || 0))} color={CATEGORY_COLOR[r.cat]} label={r.intensity == null ? '—' : `${fmtNum(r.intensity, 2)} 萬元`} />
                  <InlineBar value={r.payback} max={Math.max(...byCat.map((x) => x.payback || 0))} color={CATEGORY_COLOR[r.cat]} label={fmtYears(r.payback)} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3"><Note>
          節能類（動力、冷卻、餘熱回收）件數最多、回收快，是最容易複製的技術；燃料轉換與製程改造單件減碳量大，但投資門檻與回收年限較高，屬於需要政策資源支持的深度減碳。
        </Note></div>
      </Card>

      <Card title="技術子類排行" subtitle={`${subMeta.desc}${subMetric === 'intensity' || subMetric === 'payback' ? '；僅列 2 件以上的子類' : ''}${subCap != null ? '。極端值超出座標範圍者柱尾截斷，實際值標在名稱後' : ''}`}
        right={<Segmented value={subMetric} onChange={setSubMetric} options={SUB_METRICS} />}>
        <div style={{ height: Math.max(240, subs.length * 26 + 30) }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <BarChart data={subs} layout="vertical" margin={{ top: 0, right: 80, left: 0, bottom: 0 }} barCategoryGap={4}>
              <CartesianGrid horizontal={false} stroke={GRID} strokeDasharray="3 3" />
              <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} domain={[0, subCap ?? 'auto']} allowDataOverflow
                tickFormatter={(v) => (subMetric === 'co2' ? `${Math.round(v / 1e4)}萬` : fmtNum(v, v < 10 ? 1 : 0))} />
              <YAxis type="category" dataKey="name" width={subCap != null ? 176 : 110} interval={0} tick={{ ...AXIS_TICK, fill: '#334155' }} axisLine={false} tickLine={false}
                tickFormatter={(name) => { const d = subs.find((x) => x.name === name); return d && subCap != null && d[subMetric] > subCap ? `${name}（${subMeta.fmt(d[subMetric])}▶）` : name; }} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} content={({ active, payload }) => (active && payload?.length ? (
                <TipBox title={`${payload[0].payload.cat}／${payload[0].payload.name}`} rows={[
                  ['案例數', `${payload[0].payload.n} 件（${payload[0].payload.industries} 個產業）`, CATEGORY_COLOR[payload[0].payload.cat]],
                  ['年減碳合計', fmtTon(payload[0].payload.co2)],
                  ['投資中位數', fmtWan(payload[0].payload.inv)],
                  ['投資強度中位數', payload[0].payload.intensity == null ? '—' : `${fmtNum(payload[0].payload.intensity, 2)} 萬元`],
                  ['回收年限中位數', fmtYears(payload[0].payload.payback)],
                ]} />
              ) : null)} />
              <Bar dataKey={subMetric} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
                {subs.map((s) => <Cell key={`${s.cat}${s.name}`} fill={CATEGORY_COLOR[s.cat]} />)}
                <LabelList dataKey={subMetric} position="right" fontSize={10} fill="#475569" formatter={(v) => (subCap != null && v > subCap ? '' : subMeta.fmt(v))} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="產業 × 技術子類" subtitle="格子越深代表該產業在該類技術累積的案例越多（或減碳量越大）；空白代表尚無案例，可能是其他產業可借鏡的方向。點格子看案例。"
        right={<Segmented value={heatMetric} onChange={setHeatMetric} options={[{ value: 'n', label: '案例數' }, { value: 'co2', label: '年減碳量' }]} />}>
        <div className="overflow-x-auto">
          <table className="text-xs border-separate" style={{ borderSpacing: 2 }}>
            <thead>
              <tr>
                <th />
                {heat.subs.map((s) => {
                  const [cat, sub] = s.split('|');
                  return (
                    <th key={s} className="font-medium text-slate-600 align-bottom h-28 w-9">
                      <div className="flex flex-col items-center gap-1">
                        <span className="flex flex-col items-center leading-[1.1]">
                          {/^[ -~]+$/.test(sub) ? <span>{sub}</span> : [...sub].map((ch, k) => <span key={k}>{ch}</span>)}
                        </span>
                        <span className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLOR[cat] }} title={cat} />
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {heat.inds.map((i) => (
                <tr key={i}>
                  <th className="text-right pr-2 font-medium text-slate-700 whitespace-nowrap">{i}</th>
                  {heat.subs.map((s) => {
                    const { v, list } = heat.cells[`${i}|${s}`];
                    const level = v ? Math.min(SEQ_BLUE.length - 1, Math.floor((Math.log1p(v) / Math.log1p(heat.max)) * (SEQ_BLUE.length - 1))) : -1;
                    const on = cell?.key === `${i}|${s}`;
                    return (
                      <td key={s} onClick={() => list.length && setCell(on ? null : { key: `${i}|${s}`, i, s, list })}
                        title={`${i}／${s.split('|')[1]}：${heatMetric === 'n' ? `${v} 件` : fmtTon(v)}`}
                        className={`w-9 h-8 rounded text-center num ${list.length ? 'cursor-pointer' : ''} ${on ? 'ring-2 ring-brand-orange' : ''}`}
                        style={{ background: level < 0 ? '#f8fafc' : SEQ_BLUE[level], color: level >= 4 ? '#fff' : '#334155' }}>
                        {heatMetric === 'n' && v ? v : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {cell && (
          <div className="mt-3 border-t border-brand-line pt-3">
            <div className="text-sm font-bold mb-2">{cell.i}／{cell.s.split('|')[1]}（{cell.list.length} 件）</div>
            <CaseMiniList list={cell.list} opts={opts} />
          </div>
        )}
      </Card>

      <Recommender rows={allRows} target={target} setTarget={setTarget} opts={opts} />
    </div>
  );
}

function InlineBar({ value, max, color, label }) {
  const w = value != null && max ? Math.max(2, (value / max) * 100) : 0;
  return (
    <td className="py-2.5 px-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden min-w-[60px]">
          <div className="h-full rounded-full" style={{ width: `${w}%`, background: color }} />
        </div>
        <span className="num text-xs text-slate-700 whitespace-nowrap w-24">{label}</span>
      </div>
    </td>
  );
}

export function CaseMiniList({ list, opts, limit = 12 }) {
  return (
    <ul className="divide-y divide-slate-100 text-sm">
      {list.slice(0, limit).map((c) => (
        <li key={c.case_id} className="py-1.5 flex flex-wrap gap-x-3 gap-y-0.5 items-baseline">
          <span className="font-medium text-slate-800">{c.tech_name}</span>
          {c.company && <span className="text-xs text-slate-500">{c.company}</span>}
          <span className="text-xs text-slate-500 num">投資 {fmtWan(c.investment_wan)}・減碳 {fmtTon(co2Of(c, opts))}/年・回收 {fmtYears(paybackOf(c))}</span>
          <span className="text-[11px] text-slate-400">{c.doc_title}{c.page ? ` p.${c.page}` : ''}</span>
        </li>
      ))}
      {list.length > limit && <li className="py-1.5 text-xs text-slate-400">…另有 {list.length - limit} 件，請至「案例與資料來源」查詢</li>}
    </ul>
  );
}

// 產業選技術：本產業已驗證的技術 + 其他產業已驗證、但本產業尚無案例的同類技術（可借鏡）
function Recommender({ rows, target, setTarget, opts }) {
  const industries = [...new Set(rows.map((c) => c.industry))].filter((i) => i && i !== '跨產業').sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  const score = (c) => {
    const p = paybackOf(c);
    const co2 = co2Of(c, opts) || 0;
    return (p == null ? 5 : Math.min(p, 15)) - Math.log10(1 + co2) * 0.8; // 回收快、減碳大者在前
  };
  const own = rows.filter((c) => c.industry === target).sort((a, b) => score(a) - score(b));
  const borrow = useMemo(() => {
    const ownSubs = new Set(rows.filter((c) => c.industry === target).map((c) => c.subcategory));
    const m = new Map();
    for (const c of rows) {
      if (c.industry === target || ownSubs.has(c.subcategory)) continue;
      if (!m.has(c.subcategory)) m.set(c.subcategory, []);
      m.get(c.subcategory).push(c);
    }
    return [...m.entries()].map(([sub, list]) => ({
      sub, cat: list[0].category, list, inds: [...new Set(list.map((c) => c.industry))],
      payback: median(list.map(paybackOf)), co2: median(list.map((c) => co2Of(c, opts))),
    })).sort((a, b) => (a.payback ?? 99) - (b.payback ?? 99));
  }, [rows, target, opts]);

  return (
    <Card title="產業減碳技術選擇建議" subtitle="依「回收快、減碳量大」排序本產業已驗證的技術，並列出其他產業已驗證、本產業尚無案例的技術類型供借鏡。"
      right={<Select label="目標產業" value={target} onChange={setTarget} options={industries} />}>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div>
          <div className="text-sm font-bold mb-2 text-slate-700">本產業已驗證技術（前 10 項，共 {own.length} 項）</div>
          <CaseMiniList list={own} opts={opts} limit={10} />
        </div>
        <div>
          <div className="text-sm font-bold mb-2 text-slate-700">其他產業可借鏡的技術類型</div>
          <ul className="divide-y divide-slate-100 text-sm">
            {borrow.slice(0, 10).map((b) => (
              <li key={b.sub} className="py-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLOR[b.cat] }} />
                  <span className="font-medium">{b.sub}</span>
                  <span className="text-xs text-slate-500 num">{b.list.length} 件・回收中位 {fmtYears(b.payback)}・減碳中位 {fmtTon(b.co2)}/年</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">已用於：{b.inds.join('、')}；例：{b.list.slice(0, 2).map((c) => c.tech_name).join('、')}</div>
              </li>
            ))}
            {!borrow.length && <li className="py-1.5 text-xs text-slate-400">此產業已涵蓋所有技術子類</li>}
          </ul>
        </div>
      </div>
    </Card>
  );
}
