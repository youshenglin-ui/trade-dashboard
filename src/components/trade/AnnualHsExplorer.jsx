// ==========================================
// 貿易戰情室：全貨品年度（海關 HS6 × 國家 × 年）
// ==========================================
// 資料表 trade_annual_hs6（supabase/trade_annual.sql），與月資料 trade_records 分開：
// 顆粒不同（年 vs 月、全部 HS6 vs 精選稅號），所以獨立成一個分頁、不受上方範圍/粒度篩選影響。
// 為避免 5,000 個細項灌爆畫面：只在資料庫端聚合，逐層下鑽 HS2 章 → HS4 節 → HS6 品項，
// 每層圖表只畫前 12 名 + 「其他」，表格分頁顯示，並可用國家、關鍵字向下篩選。
import React, { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { ChevronRight, Search, Download, Info } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { Segmented } from '../SharedComponents';
import CountryFlag from './CountryFlag';
import { exportToCSV, formatSmartWeight } from '../../utils/helpers';
import { fmtUsdK } from '../../lib/trade/countryMetrics';
import { chapterName } from '../../lib/trade/hsChapters';

const TOP_N = 12;
const PAGE = 20;
const LEVEL_LABEL = { 2: '章（HS2）', 4: '節（HS4）', 6: '品項（HS6）' };
const labelFor = (level, r) => (level === 2 ? chapterName(r.code) || r.name : r.name);

async function rpc(fn, params) {
  const { data, error } = await supabase.rpc(fn, params);
  if (error) throw new Error(error.message);
  return data || [];
}

const pct = (v) => `${(v * 100).toFixed(v < 0.01 ? 2 : 1)}%`;

export default function AnnualHsExplorer({ trackedCodes = [] }) {
  const [years, setYears] = useState([]);
  const [year, setYear] = useState(null);
  const [flow, setFlow] = useState('出口');
  const [path, setPath] = useState([]); // 已下鑽的代碼，例 ['28', '2804']
  const [country, setCountry] = useState('');
  const [keyword, setKeyword] = useState('');
  const [rows, setRows] = useState([]);
  const [countries, setCountries] = useState([]);
  const [selected, setSelected] = useState(null); // HS6 層點選的品項（右側國家排行用）
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const prefix = path[path.length - 1] || '';
  const level = path.length === 0 ? 2 : path.length === 1 ? 4 : 6;
  const countryPrefix = selected || prefix;

  useEffect(() => {
    rpc('trade_annual_years', {}).then((d) => {
      const ys = [...new Set(d.map((r) => r.year))].sort((a, b) => b - a);
      setYears(ys);
      setYear(ys[0] ?? null);
      if (!ys.length) setLoading(false);
    }).catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!year) return;
    let alive = true;
    setLoading(true); setError(''); // eslint-disable-line react-hooks/set-state-in-effect
    rpc('trade_annual_drill', { p_year: year, p_flow: flow, p_level: level, p_prefix: prefix, p_country: country || null })
      .then((d) => { if (alive) { setRows(d); setPage(1); } })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [year, flow, level, prefix, country]);

  useEffect(() => {
    if (!year) return;
    let alive = true;
    rpc('trade_annual_countries', { p_year: year, p_flow: flow, p_prefix: countryPrefix })
      .then((d) => alive && setCountries(d)).catch(() => {});
    return () => { alive = false; };
  }, [year, flow, countryPrefix]);

  // 國家選單：用目前層級（未套國家）的國家排行
  const [countryOptions, setCountryOptions] = useState([]);
  useEffect(() => {
    if (!year) return;
    rpc('trade_annual_countries', { p_year: year, p_flow: flow, p_prefix: '' }).then((d) => setCountryOptions(d.map((r) => r.country))).catch(() => {});
  }, [year, flow]);

  const isTracked = (code) => trackedCodes.some((t) => t.startsWith(code) || code.startsWith(t));

  const total = useMemo(() => rows.reduce((s, r) => s + Number(r.value_usd_thousand || 0), 0), [rows]);
  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    let cum = 0;
    const withShare = rows.map((r) => {
      const v = Number(r.value_usd_thousand || 0);
      cum += v;
      return { ...r, label: labelFor(level, r), share: total ? v / total : 0, cum: total ? cum / total : 0 };
    });
    return k ? withShare.filter((r) => r.code.includes(k) || (r.label || '').toLowerCase().includes(k)) : withShare;
  }, [rows, keyword, total, level]);

  const chartData = useMemo(() => {
    const top = filtered.slice(0, TOP_N).map((r) => ({ code: r.code, name: `${r.code} ${r.label || ''}`.slice(0, 18), v: Number(r.value_usd_thousand || 0) }));
    const rest = filtered.slice(TOP_N).reduce((s, r) => s + Number(r.value_usd_thousand || 0), 0);
    if (rest > 0) top.push({ code: '', name: `其他 ${filtered.length - TOP_N} 項`, v: rest });
    return top;
  }, [filtered]);

  const n80 = useMemo(() => filtered.findIndex((r) => r.cum >= 0.8) + 1, [filtered]);
  const countryTotal = countries.reduce((s, r) => s + Number(r.value_usd_thousand || 0), 0);

  const drill = (code) => {
    if (level === 6) { setSelected(selected === code ? null : code); return; }
    setPath([...path, code]); setKeyword(''); setSelected(null);
  };
  const goTo = (i) => { setPath(path.slice(0, i)); setSelected(null); setKeyword(''); };

  if (!loading && !error && years.length === 0) {
    return <div className="card p-6 text-brand-muted">資料庫尚無全貨品年度資料（執行 npm run db:import-trade-annual 匯入）。</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-sm text-brand-muted bg-white border border-brand-line rounded-xl px-3 py-2">
        <Info size={16} className="mt-0.5 flex-shrink-0 text-brand-cyan" />
        <span>海關全貨品<b>年度</b>統計（全部 HS6 稅號 × 國家），與其他分頁的精選稅號月資料分開計算，<b>不受上方範圍／粒度／區域篩選影響</b>。逐層點選向下鑽取：章 → 節 → 品項。已排除「實施資訊保護貨品」。</span>
      </div>

      <div className="card px-3 md:px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-3">
        {years.length > 1 && <Segmented value={year} onChange={setYear} options={years.map((y) => ({ value: y, label: `${y - 1911} 年` }))} />}
        {years.length === 1 && <span className="text-sm font-bold text-brand">{years[0] - 1911} 年（{years[0]}）</span>}
        <Segmented value={flow} onChange={(f) => { setFlow(f); setSelected(null); }} options={[{ value: '出口', label: '出口' }, { value: '進口', label: '進口' }]} />
        <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="國家" className="h-10 px-3 border border-brand-line rounded-lg text-sm font-bold text-brand bg-white max-w-[12rem]">
          <option value="">全部國家</option>
          {countryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-2 h-10 px-3 border border-brand-line rounded-lg bg-white flex-1 min-w-[10rem] max-w-xs">
          <Search size={15} className="text-brand-muted" />
          <input value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }} placeholder="在本層搜尋代碼或品名" className="w-full text-sm outline-none bg-transparent" />
        </label>
      </div>

      <nav className="flex flex-wrap items-center gap-1 text-sm font-bold">
        <button onClick={() => goTo(0)} className={`px-2 py-1 rounded ${path.length ? 'text-brand hover:bg-brand-soft' : 'text-brand-dark'}`}>全部貨品</button>
        {path.map((c, i) => (
          <React.Fragment key={c}>
            <ChevronRight size={14} className="text-brand-muted" />
            <button onClick={() => goTo(i + 1)} className={`px-2 py-1 rounded ${i < path.length - 1 ? 'text-brand hover:bg-brand-soft' : 'text-brand-dark'}`}>
              {c} {i === 0 ? chapterName(c) : ''}
            </button>
          </React.Fragment>
        ))}
        {country && <span className="ml-2 px-2 py-0.5 rounded-full bg-brand-soft text-brand-dark text-xs">國家：{country}</span>}
      </nav>

      {error && <div className="card p-4 text-red-600 text-sm">讀取失敗：{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label={`${flow}總額`} value={fmtUsdK(total)} />
        <Stat label={`本層${LEVEL_LABEL[level]}數`} value={`${rows.length.toLocaleString()} 項`} />
        <Stat label="前 80% 金額集中於" value={n80 > 0 ? `${n80} 項` : '—'} />
        <Stat label="最大項占比" value={filtered[0] ? pct(filtered[0].share) : '—'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card p-3 md:p-4 xl:col-span-2 min-w-0">
          <h3 className="font-bold text-brand-dark mb-2">前 {TOP_N} 大{LEVEL_LABEL[level]}（其餘合併為「其他」）</h3>
          <div style={{ height: Math.max(260, chartData.length * 30) }}>
            {loading ? <div className="h-full flex items-center justify-center text-brand-muted">載入中…</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} stroke="#eef2f6" />
                  <XAxis type="number" tickFormatter={(v) => `${(v / 1e5).toFixed(0)}億`} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} interval={0} />
                  <Tooltip formatter={(v) => [fmtUsdK(v), '金額']} />
                  <Bar dataKey="v" radius={[0, 4, 4, 0]} onClick={(d) => d?.code && drill(d.code)} cursor="pointer">
                    {chartData.map((d) => <Cell key={d.name} fill={!d.code ? '#cbd5e1' : d.code === selected ? '#eb6834' : '#2a78d6'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card p-3 md:p-4 min-w-0">
          <h3 className="font-bold text-brand-dark mb-1">主要{flow === '出口' ? '出口目的地' : '進口來源'}</h3>
          <p className="text-xs text-brand-muted mb-2">{countryPrefix ? `範圍：${countryPrefix} ${countryPrefix.length === 2 ? chapterName(countryPrefix) : ''}` : '範圍：全部貨品'}{level === 6 && !selected ? '（點選品項可看單一品項）' : ''}</p>
          <ul className="space-y-1.5">
            {countries.slice(0, 10).map((c) => {
              const s = countryTotal ? Number(c.value_usd_thousand) / countryTotal : 0;
              return (
                <li key={c.country} className="text-sm">
                  <div className="flex items-center gap-2">
                    <CountryFlag country={c.country} />
                    <button className="truncate flex-1 text-left hover:underline" onClick={() => setCountry(country === c.country ? '' : c.country)}>{c.country}</button>
                    <span className="tabular-nums text-brand-muted">{pct(s)}</span>
                  </div>
                  <div className="h-1.5 bg-[#eef2f6] rounded mt-0.5"><div className="h-full bg-brand-cyan rounded" style={{ width: `${s * 100}%` }} /></div>
                </li>
              );
            })}
            {countries.length > 10 && <li className="text-xs text-brand-muted">其他 {countries.length - 10} 國：{pct(1 - countries.slice(0, 10).reduce((a, c) => a + Number(c.value_usd_thousand), 0) / (countryTotal || 1))}</li>}
          </ul>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-3 md:px-4 py-2 border-b border-brand-line">
          <h3 className="font-bold text-brand-dark">{LEVEL_LABEL[level]}明細（{filtered.length.toLocaleString()} 項）</h3>
          <button className="flex items-center gap-1 text-sm text-brand hover:underline" onClick={() => exportToCSV(filtered.map((r) => ({ 代碼: r.code, 名稱: r.label, '金額(千美元)': r.value_usd_thousand, '重量(kg)': r.weight_kg, 占比: r.share, 國家數: r.n_countries, HS6項數: r.n_items })), `全貨品_${year - 1911}_${flow}_${prefix || 'all'}`)}>
            <Download size={14} /> 匯出
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-brand-muted text-xs">
              <tr>
                <th className="text-left px-3 py-2">代碼／名稱</th>
                <th className="text-right px-3 py-2">金額</th>
                <th className="text-right px-3 py-2">占比</th>
                <th className="text-right px-3 py-2">累計</th>
                <th className="text-right px-3 py-2">重量</th>
                <th className="text-right px-3 py-2">單價 USD/kg</th>
                <th className="text-right px-3 py-2">國家數</th>
                {level < 6 && <th className="text-right px-3 py-2">HS6 項數</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, page * PAGE).map((r) => (
                <tr key={r.code} onClick={() => drill(r.code)} className={`border-t border-brand-line cursor-pointer hover:bg-brand-soft/50 ${r.code === selected ? 'bg-orange-50' : ''}`}>
                  <td className="px-3 py-2 max-w-[22rem] truncate">
                    <span className="font-mono font-bold text-brand mr-2">{r.code}</span>{r.label}
                    {isTracked(r.code) && <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200" title="這個代碼有月資料，可在其他分頁看趨勢">有月資料</span>}
                    {level < 6 && <ChevronRight size={13} className="inline ml-1 text-brand-muted" />}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtUsdK(r.value_usd_thousand)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pct(r.share)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-brand-muted">{pct(r.cum)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatSmartWeight(Number(r.weight_kg) || 0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{Number(r.weight_kg) > 0 ? ((Number(r.value_usd_thousand) * 1000) / Number(r.weight_kg)).toFixed(2) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.n_countries}</td>
                  {level < 6 && <td className="px-3 py-2 text-right tabular-nums">{r.n_items}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > page * PAGE && (
          <button onClick={() => setPage(page + 1)} className="w-full py-2 text-sm font-bold text-brand hover:bg-brand-soft border-t border-brand-line">
            顯示更多（還有 {filtered.length - page * PAGE} 項）
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="card px-3 py-2.5">
      <div className="text-xs text-brand-muted">{label}</div>
      <div className="text-lg font-bold text-brand-dark tabular-nums">{value}</div>
    </div>
  );
}
