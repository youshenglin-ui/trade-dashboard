// ==========================================
// 貿易戰情室：國家分析分頁
// ==========================================
// 上方切換（出口／進口／總額／順逆差 × 金額／重量 × 前 N 名）會同步套用到：世界地圖、佔比圖、趨勢圖與明細表。
import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine } from 'recharts';
import { Copy, Download, ArrowDown, ArrowUp } from 'lucide-react';
import { Segmented } from '../SharedComponents';
import WorldTradeMap from '../maps/WorldTradeMap';
import CountryFlag from './CountryFlag';
import { copyToClipboard, exportToCSV, formatSmartWeight, sanitizeForChart } from '../../utils/helpers';
import {
  VIEW_OPTIONS, viewLabel, buildCountryRows, viewValue, viewShare, sortByView,
  fmtMetric, fmtPct, fmtUsdK, isExportType,
} from '../../lib/trade/countryMetrics';

// 經 CVD 驗證的類別色（同碳費 / 能源模組），超過 8 國時後面的國家以灰階區分
const CAT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948', '#64748b', '#94a3b8'];
const OTHER = '#cbd5e1';

const periodKey = (d, granularity) => {
  if (granularity === 'year') return String(d.year ?? d.date.slice(0, 4));
  if (granularity === 'quarter') {
    const m = parseInt(d.date.split('-')[1], 10);
    return `${d.date.slice(0, 4)}-Q${Math.floor((m + 2) / 3)}`;
  }
  return d.date;
};

const axisFmt = (metric) => (v) => {
  const n = Number(v) || 0;
  if (metric === 'weight') return formatSmartWeight(n);
  const a = Math.abs(n);
  if (a >= 1e5) return `${(n / 1e5).toFixed(1)}億`;
  if (a >= 10) return `${(n / 10).toFixed(0)}萬`;
  return n.toFixed(0);
};

export default function CountryAnalysis({ filteredData, granularity }) {
  const [view, setView] = useState('進口');
  const [metric, setMetric] = useState('value');
  const [topN, setTopN] = useState('10');
  const [selected, setSelected] = useState(null);
  const [sort, setSort] = useState(null); // { key, dir }

  const { rows: allRows, totals } = useMemo(() => buildCountryRows(filteredData), [filteredData]);
  const n = topN === 'all' ? Infinity : parseInt(topN, 10);
  const ranked = useMemo(() => sortByView(allRows, view, metric).filter((r) => viewValue(r, view, metric) !== 0), [allRows, view, metric]);
  const shown = ranked.slice(0, n);
  const lineN = Math.min(shown.length, 8);

  // 世界地圖資料
  const mapRows = ranked.map((r, i) => ({ country: r.country, value: viewValue(r, view, metric), share: view === 'balance' ? null : viewShare(r, view, metric), rank: i + 1 }));

  // 佔比（環圈）：前 N 名 + 其他
  const pieData = useMemo(() => {
    if (view === 'balance') return [];
    const top = ranked.slice(0, Math.min(n, 8)).map((r) => ({ name: r.country, value: viewValue(r, view, metric), share: viewShare(r, view, metric) }));
    const rest = ranked.slice(top.length).reduce((a, r) => a + viewValue(r, view, metric), 0);
    const restShare = ranked.slice(top.length).reduce((a, r) => a + viewShare(r, view, metric), 0);
    return rest > 0 ? [...top, { name: '其他國家', value: rest, share: restShare, other: true }] : top;
  }, [ranked, view, metric, n]);

  // 各國趨勢（前 8 名）
  const trend = useMemo(() => {
    const names = ranked.slice(0, lineN).map((r) => r.country);
    const map = new Map();
    filteredData.forEach((d) => {
      const k = periodKey(d, granularity);
      if (!map.has(k)) map.set(k, Object.fromEntries([['date', k], ...names.map((c) => [c, 0])]));
      if (!names.includes(d.country)) return;
      const v = metric === 'weight' ? d.weight : d.value;
      const ex = isExportType(d.type);
      const row = map.get(k);
      if (view === 'balance') row[d.country] += ex ? v : -v;
      else if (view === 'total' || (view === '出口') === ex) row[d.country] += v;
    });
    return { names, data: sanitizeForChart([...map.values()].sort((a, b) => a.date.localeCompare(b.date))) };
  }, [filteredData, ranked, lineN, view, metric, granularity]);

  // 明細表
  const w = metric === 'weight';
  const cols = [
    { key: 'export', label: w ? '出口重量' : '出口額', get: (r) => (w ? r.exportWeight : r.exportValue), fmt: (v) => fmtMetric(v, metric), view: '出口' },
    { key: 'exportShare', label: '出口佔比', get: (r) => (w ? r.exportShareW : r.exportShare), fmt: fmtPct, view: '出口', bar: true },
    { key: 'import', label: w ? '進口重量' : '進口額', get: (r) => (w ? r.importWeight : r.importValue), fmt: (v) => fmtMetric(v, metric), view: '進口' },
    { key: 'importShare', label: '進口佔比', get: (r) => (w ? r.importShareW : r.importShare), fmt: fmtPct, view: '進口', bar: true },
    { key: 'total', label: w ? '總重量' : '進出口總額', get: (r) => (w ? r.totalWeight : r.totalValue), fmt: (v) => fmtMetric(v, metric), view: 'total' },
    { key: 'totalShare', label: '總額佔比', get: (r) => (w ? r.totalShareW : r.totalShare), fmt: fmtPct, view: 'total', bar: true },
    { key: 'balance', label: '順逆差', get: (r) => (w ? r.tradeBalanceWeight : r.tradeBalance), fmt: (v) => `${v > 0 ? '+' : ''}${fmtMetric(v, metric)}`, view: 'balance', signed: true },
    { key: 'pe', label: '出口單價 USD/kg', get: (r) => r.avgExportPrice, fmt: (v) => (v == null ? '—' : v.toFixed(2)) },
    { key: 'pi', label: '進口單價 USD/kg', get: (r) => r.avgImportPrice, fmt: (v) => (v == null ? '—' : v.toFixed(2)) },
  ];
  const tableRows = (() => {
    if (!sort) return shown;
    const c = cols.find((x) => x.key === sort.key);
    return [...shown].sort((a, b) => ((c.get(a) ?? -Infinity) - (c.get(b) ?? -Infinity)) * (sort.dir === 'asc' ? 1 : -1));
  })();
  const shownSum = (get) => shown.reduce((a, r) => a + (get(r) || 0), 0);

  const exportRows = shown.map((r) => ({
    國家: r.country, 出口額_千美元: r.exportValue, 出口佔比: +(r.exportShare * 100).toFixed(2), 進口額_千美元: r.importValue,
    進口佔比: +(r.importShare * 100).toFixed(2), 總額_千美元: r.totalValue, 總額佔比: +(r.totalShare * 100).toFixed(2),
    順逆差_千美元: r.tradeBalance, 出口重量_kg: r.exportWeight, 進口重量_kg: r.importWeight,
    出口單價_USDkg: r.avgExportPrice?.toFixed(2), 進口單價_USDkg: r.avgImportPrice?.toFixed(2),
  }));

  const vLabel = `${viewLabel(view)}${w ? '重量' : '金額'}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 md:gap-3">
          <Segmented value={view} onChange={(v) => { setView(v); setSort(null); }} options={VIEW_OPTIONS} />
          <Segmented value={metric} onChange={setMetric} options={[{ value: 'value', label: '金額' }, { value: 'weight', label: '重量' }]} />
          <Segmented value={topN} onChange={setTopN} options={[{ value: '5', label: 'Top 5' }, { value: '10', label: 'Top 10' }, { value: '20', label: 'Top 20' }, { value: 'all', label: '全部' }]} />
        </div>
        <div className="flex gap-2">
          <button onClick={() => copyToClipboard(exportRows)} className="flex items-center gap-1 h-10 px-3.5 bg-white border border-brand-line rounded-lg text-sm hover:bg-slate-50"><Copy size={14} /> 複製</button>
          <button onClick={() => exportToCSV(exportRows, `Country_${view}_${metric}`)} className="flex items-center gap-1 h-10 px-3.5 bg-brand text-white rounded-lg text-sm font-bold hover:bg-brand-dark"><Download size={14} /> 下載</button>
        </div>
      </div>

      {/* 世界地圖 */}
      <div className="card p-3 md:p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
          <h4 className="font-bold text-slate-800">貿易夥伴分布：{vLabel}</h4>
          <span className="text-xs text-slate-500">
            區間合計：出口 {fmtMetric(w ? totals.exportWeight : totals.exportValue, metric)}・進口 {fmtMetric(w ? totals.importWeight : totals.importValue, metric)}
          </span>
        </div>
        <WorldTradeMap rows={mapRows} topN={Math.min(n, 15)} mode={view === 'balance' ? 'diverging' : 'positive'}
          formatValue={(v) => `${view === 'balance' && v > 0 ? '+' : ''}${fmtMetric(v, metric)}`} valueLabel={vLabel}
          selected={selected} onSelect={(c) => setSelected((s) => (s === c ? null : c))} />
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* 佔比：環圈 + 排名清單（文字放清單，不畫在圖上，避免重疊） */}
        <div className="card p-3 md:p-4 lg:col-span-2 flex flex-col">
          <h4 className="font-bold text-slate-800 mb-2">{view === 'balance' ? '各國順逆差排名' : `${vLabel}佔比`}</h4>
          {view !== 'balance' && (
            <div className="h-44 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="92%" paddingAngle={1} isAnimationActive={false}
                    onClick={(e) => e?.name && !e.other && setSelected((s) => (s === e.name ? null : e.name))}>
                    {pieData.map((d, i) => <Cell key={d.name} fill={d.other ? OTHER : CAT[i % CAT.length]} stroke="#fff" opacity={selected && selected !== d.name ? 0.35 : 1} />)}
                  </Pie>
                  <Tooltip formatter={(v, name, p) => [`${fmtMetric(v, metric)}（${fmtPct(p.payload.share)}）`, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] text-slate-500">前 {Math.min(n, 8, ranked.length)} 名合計</span>
                <span className="text-lg font-black text-slate-800 font-mono">{fmtPct(pieData.filter((d) => !d.other).reduce((a, d) => a + d.share, 0), 0)}</span>
              </div>
            </div>
          )}
          <ol className="mt-2 space-y-1 overflow-auto max-h-80 pr-1">
            {(view === 'balance' ? shown : pieData).map((d, i) => {
              const name = d.name ?? d.country;
              const val = view === 'balance' ? viewValue(d, view, metric) : d.value;
              const share = view === 'balance' ? null : d.share;
              const maxBal = Math.max(1, ...shown.map((r) => Math.abs(viewValue(r, view, metric))));
              return (
                <li key={name} className={`flex items-center gap-2 text-xs rounded px-1.5 py-1 cursor-pointer ${selected === name ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'}`}
                  onClick={() => !d.other && setSelected((s) => (s === name ? null : name))}>
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: view === 'balance' ? (val >= 0 ? '#2a78d6' : '#e34948') : d.other ? OTHER : CAT[i % CAT.length] }} />
                  {d.other ? <span className="w-6" /> : <CountryFlag country={name} size={12} />}
                  <span className="font-bold text-slate-700 truncate flex-1">{name}</span>
                  {share != null ? (
                    <>
                      <span className="w-20 h-1.5 bg-slate-100 rounded hidden sm:block"><span className="block h-full rounded bg-slate-400" style={{ width: `${Math.min(100, share * 100)}%` }} /></span>
                      <span className="font-mono w-12 text-right text-slate-800 font-bold">{fmtPct(share)}</span>
                    </>
                  ) : (
                    <span className="w-24 h-1.5 bg-slate-100 rounded relative hidden sm:block">
                      <span className="absolute top-0 h-full rounded" style={{ background: val >= 0 ? '#2a78d6' : '#e34948', width: `${(Math.abs(val) / maxBal) * 50}%`, left: val >= 0 ? '50%' : undefined, right: val < 0 ? '50%' : undefined }} />
                    </span>
                  )}
                  <span className={`font-mono w-28 text-right ${val < 0 ? 'text-rose-600' : 'text-slate-600'}`}>{view === 'balance' && val > 0 ? '+' : ''}{fmtMetric(val, metric)}</span>
                </li>
              );
            })}
          </ol>
        </div>


        {/* 各國趨勢 */}
        <div className="card p-3 md:p-4 lg:col-span-3 flex flex-col min-h-[340px]">
          <h4 className="font-bold text-slate-800 mb-2">{view === 'balance' ? '主要國家順逆差趨勢' : `主要國家${vLabel}趨勢`}<span className="ml-2 text-xs font-normal text-slate-500">前 {lineN} 名</span></h4>
          <div className="flex-1 min-h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend.data} margin={{ left: 4, right: 8, top: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={16} />
                <YAxis tickFormatter={axisFmt(metric)} tick={{ fontSize: 10 }} width={52} />
                {view === 'balance' && <ReferenceLine y={0} stroke="#94a3b8" />}
                <Tooltip formatter={(v, name) => [fmtMetric(v, metric), name]} itemSorter={(it) => -Math.abs(it.value)} />
                {trend.names.map((c, i) => (
                  <Line key={c} type="monotone" dataKey={c} stroke={CAT[i % CAT.length]} dot={false} isAnimationActive={false}
                    strokeWidth={selected === c ? 3.5 : 2} strokeOpacity={selected && selected !== c ? 0.25 : 1} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {trend.names.map((c, i) => (
              <button key={c} type="button" onClick={() => setSelected((s) => (s === c ? null : c))}
                className={`flex items-center gap-1 text-[11px] ${selected && selected !== c ? 'opacity-40' : ''}`}>
                <span className="w-3 h-0.5" style={{ background: CAT[i % CAT.length] }} /><CountryFlag country={c} size={10} />{c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 明細表：佔比與上方切換同步 */}
      <div className="card overflow-hidden flex flex-col max-h-[560px]">
        <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100">
          依「{vLabel}」排序，顯示前 {Number.isFinite(n) ? n : '全部'} 名（共 {ranked.length} 國）；佔比為佔該流向全體的比例；藍底欄位為目前檢視。點欄位標題可改排序。
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2.5">#</th>
                <th className="px-3 py-2.5">國家</th>
                {cols.map((c) => (
                  <th key={c.key} className={`px-3 py-2.5 text-right ${c.view === view ? 'bg-blue-50 text-blue-700' : ''}`}>
                    <button type="button" className="inline-flex items-center gap-0.5 font-bold"
                      onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: 'desc' }))}>
                      {c.label}{sort?.key === c.key && (sort.dir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableRows.map((r) => (
                <tr key={r.country} onClick={() => setSelected((s) => (s === r.country ? null : r.country))}
                  className={`cursor-pointer ${selected === r.country ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                  <td className="px-3 py-2 text-slate-400 font-mono text-xs">{ranked.indexOf(r) + 1}</td>
                  <td className="px-3 py-2 font-bold text-slate-800"><span className="inline-flex items-center gap-1.5"><CountryFlag country={r.country} size={12} />{r.country}</span></td>
                  {cols.map((c) => {
                    const v = c.get(r);
                    return (
                      <td key={c.key} className={`px-3 py-2 text-right font-mono ${c.view === view ? 'bg-blue-50/60 font-bold' : ''} ${c.signed && v < 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                        {c.bar ? (
                          <span className="inline-flex items-center gap-1.5 justify-end">
                            <span className="w-12 h-1.5 bg-slate-100 rounded"><span className="block h-full rounded bg-blue-400" style={{ width: `${Math.min(100, (v || 0) * 100)}%` }} /></span>
                            {c.fmt(v)}
                          </span>
                        ) : c.fmt(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {shown.length > 0 && (
              <tfoot className="bg-slate-50 text-xs font-bold text-slate-600 sticky bottom-0">
                <tr>
                  <td className="px-3 py-2" colSpan={2}>表列合計</td>
                  {cols.map((c) => {
                    if (c.key === 'pe' || c.key === 'pi') return <td key={c.key} />;
                    const v = shownSum(c.get);
                    return <td key={c.key} className="px-3 py-2 text-right font-mono">{c.fmt(v)}</td>;
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      <p className="text-[11px] text-slate-400">金額單位為美元（資料庫原始值為千美元）；「中華民國」為復運進出口等以台灣為對方國的紀錄，不畫在地圖上。總額參考：{fmtUsdK(totals.exportValue + totals.importValue)}。</p>
    </div>
  );
}
