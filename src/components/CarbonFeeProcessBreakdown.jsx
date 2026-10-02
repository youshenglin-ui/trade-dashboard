// ==========================================
// 碳費：製程改善細分（減量措施分頁）
// ==========================================
// 把「製程改善」依措施名稱再分成 9 類（定義在 carbonfeeMetrics.js 的 PROCESS_SUBTYPES），
// 並以「採用該類措施的計畫，其計畫減量率中位數」與整體比較，分成高效／低效兩組。
// 注意：自主減量計畫沒有逐項措施的減量量，這裡是「採用該類措施的計畫」整體表現，屬關聯而非因果。
import React, { useMemo, useState } from 'react';
import { PROCESS_SUBTYPES, PROCESS_SUBTYPE_LABEL, processSubtype, fmtPct } from '../lib/carbonfeeMetrics';

const median = (xs) => {
  const v = xs.filter((x) => x != null && isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const HIGH = '#1baf7a';
const LOW = '#eb6834';
const CAPEX_TONE = { 低: 'bg-emerald-50 text-emerald-700', 中: 'bg-amber-50 text-amber-700', 高: 'bg-rose-50 text-rose-700' };

export default function CarbonFeeProcessBreakdown({ plans }) {
  const [open, setOpen] = useState(null);
  const stats = useMemo(() => {
    const groups = new Map();
    const usingPlans = new Set();
    plans.forEach((p) => {
      p.measures.forEach((m) => {
        if (!(m.categories || []).includes('製程改善')) return;
        const k = processSubtype(m.name || m.type_raw);
        if (!groups.has(k)) groups.set(k, { key: k, measures: [], plans: new Map() });
        const g = groups.get(k);
        g.measures.push({ ...m, plan: p });
        g.plans.set(p.control_no, p);
        usingPlans.add(p);
      });
    });
    const overall = median([...usingPlans].map((p) => p.rate));
    const meta = Object.fromEntries(PROCESS_SUBTYPES.map((s) => [s.key, s]));
    const rows = [...groups.values()].map((g) => {
      const ps = [...g.plans.values()];
      const med = median(ps.map((p) => p.rate));
      return {
        ...g, label: PROCESS_SUBTYPE_LABEL[g.key], desc: meta[g.key]?.desc || '名稱無法歸類的製程改善', capex: meta[g.key]?.capex,
        n: g.measures.length, planCount: ps.length, med, tier: med == null || overall == null ? null : med >= overall ? 'high' : 'low',
        examples: [...new Map(g.measures.map((m) => [m.name, m])).values()].slice(0, 14),
      };
    }).sort((a, b) => (b.med ?? -1) - (a.med ?? -1));
    return { rows, overall, planTotal: usingPlans.size, measureTotal: rows.reduce((a, r) => a + r.n, 0) };
  }, [plans]);

  const maxPlans = Math.max(1, ...stats.rows.map((r) => r.planCount));
  const maxRate = Math.max(0.05, ...stats.rows.map((r) => r.med || 0));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 mb-3">
        <span>製程改善措施 <b className="font-mono">{stats.measureTotal}</b> 項・採用計畫 <b className="font-mono">{stats.planTotal}</b> 件</span>
        <span>整體計畫減量率中位數 <b className="font-mono">{fmtPct(stats.overall)}</b></span>
        <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-sm" style={{ background: HIGH }} />高效率組（中位數 ≥ 整體）</span>
        <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-sm" style={{ background: LOW }} />低效率組（中位數 &lt; 整體）</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-slate-500 border-b">
            <tr>
              <th className="text-left py-2">細分類別</th>
              <th className="text-left py-2">投資門檻</th>
              <th className="text-right py-2">措施數</th>
              <th className="text-left py-2 pl-3 w-[22%]">採用計畫數</th>
              <th className="text-left py-2 pl-3 w-[26%]">採用計畫的減量率中位數</th>
              <th className="text-left py-2">分組</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stats.rows.map((r) => (
              <React.Fragment key={r.key}>
                <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setOpen((o) => (o === r.key ? null : r.key))}>
                  <td className="py-2 pr-2">
                    <div className="font-bold text-slate-800">{r.label}</div>
                    <div className="text-[10px] text-slate-400">{r.desc}</div>
                  </td>
                  <td className="py-2">{r.capex && <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${CAPEX_TONE[r.capex]}`}>{r.capex}</span>}</td>
                  <td className="py-2 text-right font-mono">{r.n}</td>
                  <td className="py-2 pl-3">
                    <div className="flex items-center gap-2"><span className="h-2 rounded bg-slate-400" style={{ width: `${(r.planCount / maxPlans) * 100}%` }} /><span className="font-mono">{r.planCount}</span></div>
                  </td>
                  <td className="py-2 pl-3">
                    <div className="flex items-center gap-2 relative">
                      <span className="h-2.5 rounded" style={{ width: `${((r.med || 0) / maxRate) * 85}%`, background: r.tier === 'high' ? HIGH : LOW }} />
                      <span className="font-mono font-bold">{fmtPct(r.med)}</span>
                    </div>
                  </td>
                  <td className="py-2">{r.tier && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white" style={{ background: r.tier === 'high' ? HIGH : LOW }}>{r.tier === 'high' ? '高效率' : '低效率'}</span>}</td>
                </tr>
                {open === r.key && (
                  <tr className="bg-slate-50/70">
                    <td colSpan={6} className="p-3">
                      <div className="text-[11px] font-bold text-slate-500 mb-1">措施範例（共 {r.n} 項，列出前 {r.examples.length} 種）</div>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0.5 text-xs">
                        {r.examples.map((m) => (
                          <li key={m.name} className="flex gap-2"><span className="text-slate-700 flex-1">{m.name}</span><span className="text-slate-400 truncate max-w-[45%]">{m.plan.plan_name}</span></li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-slate-400 mt-2">
        分類依措施名稱關鍵字自動判斷（可在 src/lib/carbonfeeMetrics.js 調整）；計畫沒有逐項措施減量量，「效率」以採用該類措施之計畫的整體減量率代表，屬關聯分析，
        也會受產業別影響（例如含氟氣體削減集中在半導體／面板業）。投資門檻為一般經驗判斷（低：操作調整、原料配比；高：新製程、燃料轉換）。點列看措施範例。
      </p>
    </div>
  );
}
