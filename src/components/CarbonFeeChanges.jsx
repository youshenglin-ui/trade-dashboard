// ==========================================
// 碳費自主減量計畫：異動追蹤（深入分析分頁）
// ==========================================
// 資料：每月爬蟲（.github/workflows/crawl-carbonfee.yml）把官網與資料庫比對，差異寫進 carbonfee_changes。
// 這裡依意義分類（新增、下架、目標下修／加嚴、級別調整…），並換算目標變動對減量率的影響。
// 分類規則在 carbonfeeMetrics.js 的 classifyChange()。
import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { CHANGE_KINDS, CHANGE_FIELD_LABEL, classifyChange, fmtTon } from '../lib/carbonfeeMetrics';

const TONE = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  sky: 'bg-sky-50 text-sky-700 border-sky-200',
  slate: 'bg-slate-50 text-slate-600 border-slate-200',
};
const BAR = { 新增: '#1baf7a', 下架: '#e34948', 目標放寬: '#eb6834', 目標加嚴: '#2a78d6', 其他變更: '#94a3b8' };
const isNum = (v) => v != null && v !== '' && Number.isFinite(Number(v));
const fmtVal = (field, v) => (v == null ? '—' : /emission|target/.test(field || '') && isNum(v) ? fmtTon(Number(v)) : String(v));

export default function CarbonFeeChanges({ runs = [], changes = [], plans = [], onSelectPlan }) {
  const [kind, setKind] = useState('ALL');
  const planByNo = useMemo(() => new Map(plans.map((p) => [p.control_no, p])), [plans]);
  const firstRun = runs.length ? runs.reduce((a, r) => (r.id < a.id ? r : a)) : null;
  const isBaseline = (r) => r && firstRun && r.id === firstRun.id && r.new_count === r.plan_count;

  const baselineRunId = isBaseline(firstRun) ? firstRun.id : null;
  // 異動通常只有數十筆，每次重算即可
  const rows = changes
    .filter((c) => c.run_id == null || c.run_id !== baselineRunId)
    .map((c) => {
      const k = classifyChange(c);
      const p = planByNo.get(c.control_no);
      let rateDelta = null;
      const base = p?.total_base_emission;
      if ((c.field === 'total_target_emission') && base && isNum(c.old_value) && isNum(c.new_value)) {
        rateDelta = (Number(c.old_value) - Number(c.new_value)) / base; // 目標排放增加 → 減量率下降（負值）
      }
      return { ...c, kind: k, plan: p, rateDelta };
    });

  const counts = Object.fromEntries(Object.keys(CHANGE_KINDS).map((k) => [k, rows.filter((r) => r.kind === k).length]));
  const shown = rows.filter((r) => kind === 'ALL' || r.kind === kind);

  // 每次爬取的異動數
  const perRun = [...runs].sort((a, b) => a.id - b.id).filter((r) => !isBaseline(r)).map((r) => {
    const rs = rows.filter((c) => c.run_id === r.id);
    const n = (ks) => rs.filter((c) => ks.includes(c.kind)).length;
    return {
      label: new Date(r.started_at).toLocaleDateString('zh-TW', { year: 'numeric', month: 'short', day: 'numeric' }),
      新增: n(['new', 'restored']), 下架: n(['removed']), 目標放寬: n(['target_loosen', 'first_loosen', 'tier_down']),
      目標加嚴: n(['target_tighten', 'first_tighten', 'tier_up']), 其他變更: n(['base_change', 'other']),
    };
  });

  const loosened = rows.filter((r) => r.kind === 'target_loosen');
  const lostAmount = loosened.reduce((a, r) => a + (Number(r.new_value) - Number(r.old_value)), 0);

  return (
    <div className="card p-3 md:p-4">
      <div className="mb-3">
        <h3 className="font-bold text-slate-800 text-base">⑤ 異動追蹤：新增、撤回、目標下修</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          每月爬蟲與官網比對的差異（不受上方篩選影響）。
          {firstRun && <>基準：{new Date(firstRun.started_at).toLocaleDateString('zh-TW')} 首次建檔 {firstRun.plan_count} 件；</>}
          「目標下修」＝目標年排放上限調高，等於承諾減量變少。
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
          <div className="font-bold text-slate-600 mb-1">目前只有首次建檔，尚無異動</div>
          下一次排程爬取（每月第一個週六 09:00，需在 GitHub 核准執行）後，新增、撤回、目標調整會自動出現在這裡。
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            {[
              ['新增計畫', counts.new + counts.restored, 'emerald'],
              ['下架／撤回', counts.removed, 'rose'],
              ['目標下修（放寬）', counts.target_loosen + counts.first_loosen, 'rose', lostAmount ? `目標年排放上限合計 +${fmtTon(lostAmount)}` : null],
              ['目標加嚴', counts.target_tighten + counts.first_tighten, 'emerald'],
            ].map(([l, n, tone, note]) => (
              <div key={l} className={`rounded-lg border px-3 py-2 ${TONE[tone]}`}>
                <div className="text-[11px] font-bold">{l}</div>
                <div className="text-xl font-black font-mono">{n}</div>
                {note && <div className="text-[10px]">{note}</div>}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            <div className="xl:col-span-2 h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perRun} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {Object.keys(BAR).map((k) => <Bar key={k} dataKey={k} stackId="a" fill={BAR[k]} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="xl:col-span-3">
              <div className="flex flex-wrap gap-1.5 mb-2">
                <button type="button" onClick={() => setKind('ALL')} className={`px-2.5 py-1 rounded-full border text-xs ${kind === 'ALL' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}>全部 {rows.length}</button>
                {Object.entries(CHANGE_KINDS).filter(([k]) => counts[k]).map(([k, v]) => (
                  <button key={k} type="button" onClick={() => setKind(k)} className={`px-2.5 py-1 rounded-full border text-xs ${kind === k ? 'bg-slate-800 text-white border-slate-800' : `${TONE[v.tone]}`}`}>{v.label} {counts[k]}</button>
                ))}
              </div>
              <div className="overflow-auto max-h-[300px] border border-slate-100 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0 text-slate-500">
                    <tr><th className="p-2 text-left">日期</th><th className="p-2 text-left">類型</th><th className="p-2 text-left">計畫</th><th className="p-2 text-left">內容</th><th className="p-2 text-right">減量率影響</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {shown.map((r) => {
                      const k = CHANGE_KINDS[r.kind] || CHANGE_KINDS.other;
                      return (
                        <tr key={r.id} className="hover:bg-slate-50 align-top">
                          <td className="p-2 font-mono text-slate-500 whitespace-nowrap">{String(r.detected_at).slice(0, 10)}</td>
                          <td className="p-2"><span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold whitespace-nowrap ${TONE[k.tone]}`}>{k.label}</span></td>
                          <td className="p-2">
                            <button type="button" className="text-left hover:underline text-slate-800" onClick={() => onSelectPlan?.(r.control_no)}>{r.plan_name}</button>
                            {r.plan?.industry && <div className="text-[10px] text-slate-400">{r.plan.industry}</div>}
                          </td>
                          <td className="p-2 text-slate-600">
                            {r.change_type === 'updated'
                              ? <>{CHANGE_FIELD_LABEL[r.field] || r.field}：<span className="line-through text-slate-400">{fmtVal(r.field, r.old_value)}</span> → <b>{fmtVal(r.field, r.new_value)}</b></>
                              : '—'}
                          </td>
                          <td className={`p-2 text-right font-mono whitespace-nowrap ${r.rateDelta < 0 ? 'text-rose-600 font-bold' : r.rateDelta > 0 ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                            {r.rateDelta == null ? '—' : `${r.rateDelta > 0 ? '+' : ''}${(r.rateDelta * 100).toFixed(1)} 個百分點`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">減量率影響以目前的基準年排放換算；下架的計畫仍保留在資料庫（status = removed），點名稱可查看計畫明細。</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
