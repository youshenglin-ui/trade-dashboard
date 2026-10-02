// ==========================================
// 氫能：各公司廠區歷年填報一覽（供需總覽分頁下方）
// ==========================================
// 列＝公司廠區、欄＝資料年度，每格顯示產氫量 / 用氫量；點列展開看該廠各年的製程、用途、外售與購入明細。
// 吃 toLegacyHydrogen() 組好的 supplyData / demandData（Output_Tons、Demand_Tons 單位為萬公噸）。
import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search, Table2 } from 'lucide-react';
import { Segmented } from '../SharedComponents';

const fmtT = (wt) => {
  const t = (Number(wt) || 0) * 10000;
  if (!t) return null;
  return t >= 100 ? Math.round(t).toLocaleString() : t.toFixed(1);
};

export default function H2PlantYearTable({ supplyData, demandData }) {
  const [mode, setMode] = useState('both');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(() => new Set());

  const { years, plants } = useMemo(() => {
    const ys = [...new Set([...supplyData, ...demandData].map((d) => String(d.Year)).filter(Boolean))].sort();
    const map = new Map();
    const get = (d) => {
      const key = d.PlantId || d.label;
      if (!map.has(key)) map.set(key, { key, name: d.label, company: d.Company, region: d.Region, county: d.County, zone: d.zone, years: {} });
      return map.get(key);
    };
    const cell = (p, y) => (p.years[y] ||= { out: 0, cap: 0, use: 0, sold: 0, bought: 0, processes: [], usages: [] });
    supplyData.forEach((d) => {
      const c = cell(get(d), String(d.Year));
      c.out += d.Output_Tons || 0;
      c.cap += d.Capacity_Tons || 0;
      c.sold += d.Trade_Vol || 0;
      c.processes.push({ name: d.Process_Raw || d.Process, type: d.Production_Type, out: d.Output_Tons, cap: d.Capacity_Tons, intensity: d.Carbon_Intensity, target: d.Trade_Target });
    });
    demandData.forEach((d) => {
      const c = cell(get(d), String(d.Year));
      c.use += d.Demand_Tons || 0;
      c.bought += d.Trade_Vol || 0;
      c.usages.push({ name: d.Usage_Type, cat: d.Usage_Category, use: d.Demand_Tons, source: d.Source_Company });
    });
    const latest = ys[ys.length - 1];
    const list = [...map.values()].sort((a, b) => {
      const va = (a.years[latest]?.out || 0) + (a.years[latest]?.use || 0);
      const vb = (b.years[latest]?.out || 0) + (b.years[latest]?.use || 0);
      return vb - va || String(a.name).localeCompare(String(b.name), 'zh-Hant');
    });
    return { years: ys, plants: list };
  }, [supplyData, demandData]);

  const shown = plants.filter((p) => !q || `${p.name}${p.company}${p.county}${p.zone}`.includes(q.trim()));
  const toggle = (k) => setOpen((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const showOut = mode !== 'use';
  const showUse = mode !== 'out';
  const colsPerYear = (showOut ? 1 : 0) + (showUse ? 1 : 0);
  const totals = years.map((y) => plants.reduce((a, p) => ({ out: a.out + (p.years[y]?.out || 0), use: a.use + (p.years[y]?.use || 0) }), { out: 0, use: 0 }));

  return (
    <div className="card p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2"><Table2 size={16} className="text-blue-500" />各公司廠區歷年填報一覽</h3>
          <p className="text-xs text-slate-500 mt-0.5">單位：公噸／年（資料年度）。點公司列可展開該廠各年的製程、用途與外售／購入明細；空白＝該年未填報。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={mode} onChange={setMode} options={[{ value: 'both', label: '產量＋用量' }, { value: 'out', label: '產量' }, { value: 'use', label: '用量' }]} />
          <label className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋公司／縣市" className="h-10 pl-8 pr-3 w-40 border border-brand-line rounded-lg text-sm" />
          </label>
        </div>
      </div>
      <div className="overflow-auto max-h-[620px] border border-slate-100 rounded-lg">
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th rowSpan={colsPerYear > 1 ? 2 : 1} className="p-2 text-left sticky left-0 bg-slate-50 z-20">公司廠區</th>
              <th rowSpan={colsPerYear > 1 ? 2 : 1} className="p-2 text-left">區域</th>
              {years.map((y) => <th key={y} colSpan={colsPerYear} className="p-2 text-center border-l border-slate-200">{y} 年</th>)}
            </tr>
            {colsPerYear > 1 && (
              <tr>
                {years.map((y) => (
                  <React.Fragment key={y}>
                    <th className="px-2 pb-1.5 text-right text-blue-700 font-bold border-l border-slate-200">產量</th>
                    <th className="px-2 pb-1.5 text-right text-amber-700 font-bold">用量</th>
                  </React.Fragment>
                ))}
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((p) => (
              <React.Fragment key={p.key}>
                <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => toggle(p.key)}>
                  <td className="p-2 font-bold text-slate-800 sticky left-0 bg-white">
                    <span className="inline-flex items-center gap-1">{open.has(p.key) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}{p.name}</span>
                  </td>
                  <td className="p-2 text-slate-500">{p.region}{p.county ? `・${p.county}` : ''}</td>
                  {years.map((y) => {
                    const c = p.years[y];
                    return (
                      <React.Fragment key={y}>
                        {showOut && <td className="p-2 text-right font-mono text-blue-800 border-l border-slate-100">{fmtT(c?.out) ?? <span className="text-slate-300">—</span>}</td>}
                        {showUse && <td className={`p-2 text-right font-mono text-amber-800 ${showOut ? '' : 'border-l border-slate-100'}`}>{fmtT(c?.use) ?? <span className="text-slate-300">—</span>}</td>}
                      </React.Fragment>
                    );
                  })}
                </tr>
                {open.has(p.key) && (
                  <tr className="bg-slate-50/70">
                    <td colSpan={2 + years.length * colsPerYear} className="p-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                        {years.filter((y) => p.years[y]).map((y) => {
                          const c = p.years[y];
                          return (
                            <div key={y} className="bg-white border border-slate-200 rounded-lg p-2.5 whitespace-normal">
                              <div className="font-bold text-slate-700 mb-1">{y} 年</div>
                              {c.processes.length > 0 && (
                                <div className="mb-1.5">
                                  <div className="text-[10px] font-bold text-blue-700">產氫製程</div>
                                  {c.processes.map((pr, i) => (
                                    <div key={i} className="flex justify-between gap-2"><span className="text-slate-600">{pr.name}{pr.type ? `（${pr.type}）` : ''}</span><span className="font-mono">{fmtT(pr.out) ?? '—'}</span></div>
                                  ))}
                                  {c.cap > 0 && <div className="text-[10px] text-slate-400">最大產能 {fmtT(c.cap)} 噸・利用率 {c.out && c.cap ? `${((c.out / c.cap) * 100).toFixed(0)}%` : '—'}</div>}
                                  {c.sold > 0 && <div className="text-[10px] text-slate-500">外售 {fmtT(c.sold)} 噸{c.processes[0]?.target ? `（${c.processes[0].target}）` : ''}</div>}
                                </div>
                              )}
                              {c.usages.length > 0 && (
                                <div>
                                  <div className="text-[10px] font-bold text-amber-700">用氫用途</div>
                                  {c.usages.map((u, i) => (
                                    <div key={i} className="flex justify-between gap-2"><span className="text-slate-600">{u.name}{u.cat ? `（${u.cat}）` : ''}</span><span className="font-mono">{fmtT(u.use) ?? '—'}</span></div>
                                  ))}
                                  {c.bought > 0 && <div className="text-[10px] text-slate-500">外購 {fmtT(c.bought)} 噸{c.usages.find((u) => u.source)?.source ? `（${c.usages.find((u) => u.source).source}）` : ''}</div>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot className="bg-slate-100 font-bold sticky bottom-0">
            <tr>
              <td className="p-2 sticky left-0 bg-slate-100" colSpan={2}>合計（{plants.length} 廠區）</td>
              {totals.map((t, i) => (
                <React.Fragment key={years[i]}>
                  {showOut && <td className="p-2 text-right font-mono text-blue-800 border-l border-slate-200">{fmtT(t.out) ?? '—'}</td>}
                  {showUse && <td className="p-2 text-right font-mono text-amber-800">{fmtT(t.use) ?? '—'}</td>}
                </React.Fragment>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
