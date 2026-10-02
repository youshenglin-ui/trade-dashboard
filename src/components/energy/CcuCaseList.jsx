// CCUS 碳再利用頁：國內 CCU／碳捕捉示範案例（含已停止、規劃中），資料表 ccus_ccu_cases。
import React, { useState } from 'react';
import { History, ExternalLink } from 'lucide-react';
import { Card } from './ui';

const STATUS = {
  運轉中: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  停止中: 'bg-slate-100 text-slate-600 border-slate-300',
  規劃中: 'bg-amber-50 text-amber-700 border-amber-200',
};
const ORDER = ['運轉中', '規劃中', '停止中'];

export default function CcuCaseList({ cases = [], onOpenTrade }) {
  const [filter, setFilter] = useState('ALL');
  if (!cases.length) {
    return (
      <Card title="國內 CCU 示範案例" icon={History}>
        <div className="text-sm text-slate-400 py-4">案例名錄尚未建立（請在 Supabase 執行 supabase/ccus_ccu_cases.sql）。</div>
      </Card>
    );
  }
  const counts = Object.fromEntries(ORDER.map((s) => [s, cases.filter((c) => c.status === s).length]));
  const shown = cases.filter((c) => filter === 'ALL' || c.status === filter);
  return (
    <Card title="國內 CCU／碳捕捉示範案例（含已停止與規劃中）" icon={History}
      subtitle="問卷之外的公開案場：產發署談參（IDA）、氣候署會議資料（CCA）、國科會（NSTC）與 115 旗艦問卷；近年無運轉資訊者標示「停止中」。"
      right={(
        <div className="flex flex-wrap gap-1.5 text-xs">
          {['ALL', ...ORDER].map((s) => (
            <button key={s} type="button" onClick={() => setFilter(s)}
              className={`px-2.5 py-1 rounded-full border ${filter === s ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              {s === 'ALL' ? `全部 ${cases.length}` : `${s} ${counts[s]}`}
            </button>
          ))}
        </div>
      )}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {shown.map((c) => (
          <div key={c.case_id} className={`rounded-lg border p-3 flex flex-col gap-1.5 ${c.status === '停止中' ? 'bg-slate-50/60 border-slate-200' : 'bg-white border-slate-200'}`}>
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className={`font-bold text-sm ${c.status === '停止中' ? 'text-slate-500' : 'text-slate-800'}`}>{c.name}</div>
                <div className="text-[11px] text-slate-400">{[c.company, c.location].filter(Boolean).join('・')}</div>
              </div>
              <span className={`flex-shrink-0 px-2 py-0.5 rounded border text-[11px] font-bold ${STATUS[c.status] || STATUS.停止中}`}>{c.status}</span>
            </div>
            <dl className="text-xs grid grid-cols-[56px_1fr] gap-x-2 gap-y-0.5">
              <dt className="text-slate-400">CO₂ 來源</dt><dd className="text-slate-700">{c.co2_source || '—'}</dd>
              <dt className="text-slate-400">產品</dt><dd className="text-slate-700">{c.product || '—'}</dd>
              <dt className="text-slate-400">規模</dt><dd className="text-slate-700">{c.scale_raw || '—'}</dd>
              <dt className="text-slate-400">時點</dt><dd className="text-slate-700">{c.period || '—'}</dd>
            </dl>
            {c.status_note && <div className="text-[11px] text-slate-500 bg-slate-50 rounded px-2 py-1">{c.status_note}</div>}
            <div className="flex items-center justify-between mt-auto pt-1">
              <span className="text-[10px] text-slate-400">來源：{c.sources}</span>
              {c.hs_code && onOpenTrade && (
                <button type="button" onClick={() => onOpenTrade(c.hs_code, c.product)} className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline">
                  貿易資訊 <ExternalLink size={11} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
