// ==========================================
// 貿易戰情室：變動與關聯（依產品類別比較）
// ==========================================
// 選一個產品類別（例：五大基礎化學品），同時看：
//   1. 類別內各產品的月度走勢（指數化，基期＝100），疊上重大事件線 → 看事件前後是否同步變動
//   2. 事件衝擊表：每個事件前 3 個月 vs 後 3 個月的平均變化（金額／單價）
//   3. 價格連動：類別內各產品與目前查詢產品的月度單價相關係數
// 類別定義在 src/lib/trade/productGroups.js。
import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { BookOpen, Layers } from 'lucide-react';
import { Segmented } from '../SharedComponents';
import { PRODUCT_GROUPS } from '../../lib/trade/productGroups';
import { isExportType, fmtUsdK } from '../../lib/trade/countryMetrics';
import { normalizeCode } from '../../utils/helpers';

const CAT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
const WINDOW = 3; // 事件前後各幾個月

const addMonths = (ym, k) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + k, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// 月度序列：{ 'YYYY-MM': { v, w } }
function monthly(dataset, code, flow) {
  const pre = normalizeCode(code);
  const out = new Map();
  dataset.forEach((d) => {
    if (!normalizeCode(d.hsCode).startsWith(pre)) return;
    if ((flow === '出口') !== isExportType(d.type)) return;
    const k = d.date.slice(0, 7);
    const cur = out.get(k) || { v: 0, w: 0 };
    cur.v += Number(d.value) || 0;
    cur.w += Number(d.weight) || 0;
    out.set(k, cur);
  });
  return out;
}

const pick = (cell, metric) => {
  if (!cell) return null;
  if (metric === 'price') return cell.w > 0 ? (cell.v * 1000) / cell.w : null;
  if (metric === 'weight') return cell.w;
  return cell.v;
};

function avgWindow(series, from, months, metric) {
  if (metric === 'price') {
    let v = 0; let w = 0;
    for (let i = 0; i < months; i++) { const c = series.get(addMonths(from, i)); if (c) { v += c.v; w += c.w; } }
    return w > 0 ? (v * 1000) / w : null;
  }
  let s = 0; let n = 0;
  for (let i = 0; i < months; i++) { const c = series.get(addMonths(from, i)); if (c) { s += pick(c, metric); n += 1; } }
  return n ? s / months : null;
}

function pearson(a, b) {
  const n = a.length;
  if (n < 6) return null;
  const ma = a.reduce((x, y) => x + y, 0) / n;
  const mb = b.reduce((x, y) => x + y, 0) / n;
  let num = 0; let da = 0; let db = 0;
  for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : null;
}

const heat = (x) => {
  if (x == null || !isFinite(x)) return {};
  const a = Math.min(1, Math.abs(x) / 0.5) * 0.55;
  return { background: x >= 0 ? `rgba(27,175,122,${a})` : `rgba(227,73,72,${a})` };
};

export default function ProductGroupAnalysis({ dataset, searchQuery, events, eventTitle }) {
  const [groupId, setGroupId] = useState(PRODUCT_GROUPS[0].id);
  const [flow, setFlow] = useState('進口');
  const [metric, setMetric] = useState('price');
  const [eventIdx, setEventIdx] = useState(null);
  const group = PRODUCT_GROUPS.find((g) => g.id === groupId);

  const series = useMemo(() => group.items.map((it) => ({ ...it, s: monthly(dataset, it.code, flow) })), [dataset, group, flow]);
  const current = useMemo(() => (searchQuery ? monthly(dataset, searchQuery, flow) : null), [dataset, searchQuery, flow]);

  // 指數化走勢：3 個月移動平均（單價用加權平均），基期＝前 12 個有效月份的中位數＝100。
  // 單價另排除重量不到該產品月中位數 10% 的月份（零星小量進出口的單價會暴衝，失真）。
  const chart = useMemo(() => {
    const months = [...new Set(series.flatMap((x) => [...x.s.keys()]))].sort();
    const smooth = {};
    series.forEach((x) => {
      const ws = [...x.s.values()].map((c) => c.w).filter((w) => w > 0).sort((a, b) => a - b);
      const minW = (ws[Math.floor(ws.length / 2)] || 0) * 0.1;
      const ok = (c) => c && (metric !== 'price' || c.w >= minW);
      const vals = months.map((m, i) => {
        const win = [months[i - 2], months[i - 1], m].map((k) => (k ? x.s.get(k) : null)).filter(ok);
        if (!ok(x.s.get(m)) || !win.length) return null;
        if (metric === 'price') { const v = win.reduce((a, c) => a + c.v, 0); const w = win.reduce((a, c) => a + c.w, 0); return w > 0 ? (v * 1000) / w : null; }
        return win.reduce((a, c) => a + pick(c, metric), 0) / win.length;
      });
      const firsts = vals.filter((v) => v != null && v > 0).slice(0, 12).sort((a, b) => a - b);
      const base = firsts[Math.floor(firsts.length / 2)];
      smooth[x.code] = vals.map((v) => (v != null && base ? +((v / base) * 100).toFixed(1) : null));
    });
    return months.map((m, i) => Object.fromEntries([['date', m], ...series.map((x) => [x.code, smooth[x.code][i]])]));
  }, [series, metric]);

  const visibleEvents = events.filter((e) => chart.length && e.date >= chart[0].date && e.date <= chart[chart.length - 1].date);

  // 事件衝擊：前 WINDOW 月 vs 後 WINDOW 月（含事件當月起算）
  const impact = useMemo(() => visibleEvents.map((e) => ({
    ...e,
    cells: series.map((x) => {
      const before = avgWindow(x.s, addMonths(e.date, -WINDOW), WINDOW, metric);
      const after = avgWindow(x.s, e.date, WINDOW, metric);
      return before && after != null ? after / before - 1 : null;
    }),
  })), [visibleEvents, series, metric]);

  // 與目前查詢產品的月度相關
  const corr = useMemo(() => {
    if (!current || !current.size) return [];
    return series.map((x) => {
      const ks = [...x.s.keys()].filter((k) => current.has(k));
      const a = []; const b = [];
      ks.forEach((k) => { const va = pick(x.s.get(k), metric); const vb = pick(current.get(k), metric); if (va != null && vb != null) { a.push(va); b.push(vb); } });
      return { ...x, r: pearson(a, b), n: a.length };
    });
  }, [series, current, metric]);

  const totals = series.map((x) => ({ ...x, total: [...x.s.values()].reduce((a, c) => a + c.v, 0), months: x.s.size }));
  const metricLabel = metric === 'price' ? '單價' : metric === 'weight' ? '重量' : '金額';

  return (
    <div className="space-y-5">
      <div className="card p-3 md:p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-brand-muted flex items-center gap-1"><Layers size={14} /> 產品類別</span>
          <div className="flex flex-wrap gap-1.5">
            {PRODUCT_GROUPS.map((g) => (
              <button key={g.id} type="button" onClick={() => setGroupId(g.id)}
                className={`h-9 px-3 text-sm rounded-full border ${g.id === groupId ? 'bg-brand-soft text-brand-dark border-brand/30 font-bold' : 'bg-white text-brand-muted border-brand-line hover:bg-slate-50'}`}>{g.label}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={flow} onChange={setFlow} options={[{ value: '進口', label: '進口' }, { value: '出口', label: '出口' }]} />
          <Segmented value={metric} onChange={setMetric} options={[{ value: 'price', label: '單價' }, { value: 'value', label: '金額' }, { value: 'weight', label: '重量' }]} />
          <span className="text-xs text-slate-500">{group.desc}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {totals.map((x, i) => (
            <span key={x.code} className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded border ${x.months ? 'border-slate-200 bg-white' : 'border-dashed border-slate-300 text-slate-400'}`}>
              <i className="w-2.5 h-2.5 rounded-sm" style={{ background: x.months ? CAT[i % CAT.length] : '#e2e8f0' }} />
              <b>{x.name}</b><span className="font-mono text-slate-400">{x.code}</span>
              {x.months ? <span className="font-mono text-slate-600">{fmtUsdK(x.total)}</span> : <span>資料庫未收錄</span>}
            </span>
          ))}
        </div>
      </div>

      <div className="card p-3 md:p-4">
        <h4 className="font-bold text-slate-800">{group.label}：{flow}{metricLabel}走勢（指數，基期＝各產品最初 12 個月中位數＝100）</h4>
        <p className="text-xs text-slate-500 mb-2">3 個月移動平均。紅色虛線編號對應下方事件表；點事件表的列可在圖上標出該事件。走勢一起轉折代表受共同因素影響，單一產品轉折則多半是個別供需。</p>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ left: 0, right: 8, top: 12 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={20} />
              <YAxis tick={{ fontSize: 10 }} width={40} domain={[0, (max) => Math.min(Math.ceil(max / 50) * 50, 600)]} allowDataOverflow />
              <ReferenceLine y={100} stroke="#94a3b8" />
              <Tooltip formatter={(v, code) => [v, group.items.find((it) => it.code === code)?.name || code]} />
              <Legend formatter={(code) => group.items.find((it) => it.code === code)?.name || code} wrapperStyle={{ fontSize: 12 }} />
              {visibleEvents.map((e, i) => (
                <ReferenceLine key={e.date + e.label} x={e.date} stroke={eventIdx === i ? '#b91c1c' : '#e34948'} strokeDasharray={eventIdx === i ? undefined : '3 3'} strokeWidth={eventIdx === i ? 2 : 1}
                  label={{ value: String(i + 1), position: 'insideTopRight', fontSize: 10, fontWeight: 700, fill: '#b91c1c' }} />
              ))}
              {series.filter((x) => x.s.size).map((x) => (
                <Line key={x.code} dataKey={x.code} type="monotone" dot={false} connectNulls strokeWidth={2} isAnimationActive={false}
                  stroke={CAT[group.items.findIndex((it) => it.code === x.code) % CAT.length]} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <div className="card p-3 md:p-4 xl:col-span-3 overflow-auto">
          <h4 className="font-bold text-slate-800">事件衝擊：事件前 {WINDOW} 個月 → 後 {WINDOW} 個月的{flow}{metricLabel}平均變化</h4>
          <p className="text-xs text-slate-500 mb-2">綠＝上升、紅＝下降，顏色越深變化越大（±50% 以上最深）。僅為事件前後的描述統計，不代表因果。</p>
          <table className="w-full text-xs whitespace-nowrap">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-2 text-left">#</th>
                <th className="p-2 text-left">時間</th>
                <th className="p-2 text-left">事件</th>
                {series.map((x) => <th key={x.code} className="p-2 text-right">{x.name}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {impact.map((e, i) => (
                <tr key={e.date + e.label} className={`cursor-pointer ${eventIdx === i ? 'ring-1 ring-rose-300 bg-rose-50/40' : 'hover:bg-slate-50'}`} onClick={() => setEventIdx((v) => (v === i ? null : i))}>
                  <td className="p-2 font-mono font-bold text-rose-700">{i + 1}</td>
                  <td className="p-2 font-mono text-slate-500">{e.date}</td>
                  <td className="p-2 font-bold text-slate-700" title={e.desc}>{e.label}</td>
                  {e.cells.map((c, j) => (
                    <td key={series[j].code} className="p-2 text-right font-mono" style={heat(c)}>{c == null ? '—' : `${c >= 0 ? '+' : ''}${(c * 100).toFixed(0)}%`}</td>
                  ))}
                </tr>
              ))}
              {impact.length === 0 && <tr><td colSpan={series.length + 3} className="p-6 text-center text-slate-400">資料期間內沒有事件</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card p-3 md:p-4 xl:col-span-2">
          <h4 className="font-bold text-slate-800">與目前查詢產品的{metricLabel}連動</h4>
          <p className="text-xs text-slate-500 mb-2">目前查詢：<b className="font-mono">{searchQuery || '（無）'}</b>。月度{flow}{metricLabel}的相關係數 r（+1 同步、0 無關、−1 反向）。</p>
          {corr.length ? (
            <ul className="space-y-1.5">
              {corr.map((x) => (
                <li key={x.code} className="flex items-center gap-2 text-xs">
                  <span className="w-24 truncate font-bold text-slate-700">{x.name}</span>
                  <span className="flex-1 h-2 bg-slate-100 rounded relative">
                    {x.r != null && <span className="absolute top-0 h-full rounded" style={{ background: x.r >= 0 ? '#1baf7a' : '#e34948', width: `${Math.abs(x.r) * 50}%`, left: x.r >= 0 ? '50%' : undefined, right: x.r < 0 ? '50%' : undefined }} />}
                    <span className="absolute left-1/2 top-[-2px] bottom-[-2px] w-px bg-slate-400" />
                  </span>
                  <span className="w-12 text-right font-mono">{x.r == null ? '—' : x.r.toFixed(2)}</span>
                  <span className="w-12 text-right text-slate-400">{x.n} 月</span>
                </li>
              ))}
            </ul>
          ) : <div className="text-sm text-slate-400 py-4">先在上方搜尋一個產品稅號</div>}
        </div>
      </div>

      <div className="card p-3 md:p-4">
        <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2"><BookOpen size={16} className="text-rose-600" />{eventTitle}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {events.map((ev) => (
            <div key={ev.date + ev.label} className="flex items-start gap-3 text-xs bg-white p-2.5 rounded border border-slate-200">
              <div className="font-mono text-slate-500 font-bold min-w-[60px]">{ev.date}</div>
              <div>
                <div className="flex items-center gap-2"><span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-600 font-bold">{ev.type || 'Event'}</span><b className="text-slate-800">{ev.label}</b></div>
                <div className="text-slate-600 mt-0.5">{ev.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
