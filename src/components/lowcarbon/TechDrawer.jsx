// 技術類型明細：加權成本拆解、資料可信度、組成案例（哪家公司、哪項技術、哪一版彙編）、相關廠商技術
import React, { useEffect, useMemo } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { CATEGORY_COLOR, CATEGORY_DESC, TECHDB_PROCESS_MAP, fmtTon, fmtWan, fmtYears } from '../../lib/lowcarbon/metrics';
import { aggregate, fmtCost } from '../../lib/lowcarbon/lcoa';
import { CategoryChip, ReliabilityBadge } from './ui';

export default function TechDrawer({ techKey, cases, ctx, data, onClose }) {
  const [category, subcategory] = techKey.split('|');
  const list = useMemo(() => cases.filter((c) => c.category === category && (c.subcategory || '未分類') === subcategory), [cases, category, subcategory]);
  const agg = useMemo(() => aggregate(list, ctx), [list, ctx]);
  const fileUrl = useMemo(() => Object.fromEntries(data.documents.map((d) => [d.doc_id, d.file_url])), [data]);
  const vendors = useMemo(() => data.techs.filter((t) => t.status !== 'removed' && TECHDB_PROCESS_MAP[t.process_type]?.[1] === subcategory), [data, subcategory]);
  const rows = [...agg.rows].sort((a, b) => (a.net ?? Infinity) - (b.net ?? Infinity) || (b.co2 || 0) - (a.co2 || 0));
  const inds = Object.entries(list.reduce((m, c) => ({ ...m, [c.industry]: (m[c.industry] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end items-end md:items-stretch" role="dialog" aria-modal="true" aria-label={`${subcategory} 明細`}>
      <button className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-label="關閉" />
      <div className="relative bg-white w-full md:w-[640px] h-[90vh] md:h-full rounded-t-2xl md:rounded-none shadow-2xl flex flex-col">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-brand-line">
          <div className="min-w-0">
            <CategoryChip cat={category} />
            <h2 className="text-lg md:text-xl font-black text-brand-ink mt-0.5">{subcategory}</h2>
            <p className="text-xs md:text-[13px] text-slate-500 mt-1 leading-relaxed">{CATEGORY_DESC[category]}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl border border-brand-line flex items-center justify-center flex-shrink-0" aria-label="關閉"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="投資攤提成本" value={fmtCost(agg.amortAll)} unit="/公噸" note="不扣節能收益；推動門檻" accent />
            <Stat label="節能收益" value={agg.saving == null ? '—' : `−${fmtCost(agg.saving)}`} unit="/公噸" note="年效益 ÷ 年減碳量" />
            <Stat label="均化減碳成本（淨）" value={fmtCost(agg.net)} unit="/公噸"
              note={agg.netP25 != null ? `典型範圍 ${fmtCost(agg.netP25)} ～ ${fmtCost(agg.netP75)}` : '案例不足'} />
            <Stat label="回收年限（加權）" value={fmtYears(agg.payback)} note={`中位數 ${fmtYears(agg.paybackMedian)}`} />
            <Stat label="案例數" value={`${agg.n} 件`} note={`可算成本 ${agg.nComplete} 件・年減碳合計 ${fmtTon(agg.co2Sum)}`} />
            <div className="rounded-xl border border-brand-line p-3">
              <div className="text-xs text-slate-500">資料可信度</div>
              <div className="mt-1"><ReliabilityBadge r={agg.reliability} /></div>
              <div className="text-xs text-slate-500 mt-1 leading-snug">{agg.reliability.note}{agg.se != null ? `；標準誤 ±${fmtCost(agg.se)}` : ''}</div>
            </div>
          </div>

          <CostSplit agg={agg} color={CATEGORY_COLOR[category]} />

          <section>
            <h3 className="text-sm font-bold text-slate-700 mb-1.5">應用產業</h3>
            <div className="flex flex-wrap gap-1.5">
              {inds.map(([i, n]) => <span key={i} className="text-xs bg-brand-ground border border-brand-line rounded-lg px-2 py-1">{i} <b className="num">{n}</b></span>)}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-bold text-slate-700 mb-1">組成案例（{rows.length} 件，依淨成本由低到高）</h3>
            <p className="text-xs text-slate-500 mb-2">權重 = 資料年代權重（越舊越低）；成本單位為元／每年減 1 公噸。</p>
            <ul className="divide-y divide-slate-100">
              {rows.map((r) => {
                const c = r.c;
                const href = c.url || (fileUrl[c.doc_id] ? `${fileUrl[c.doc_id]}${c.page ? `#page=${c.page}` : ''}` : null);
                return (
                  <li key={c.case_id} className="py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800 leading-snug">{c.tech_name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {[c.company || c.supplier, c.industry, c.pub_year_roc ? `${c.pub_year_roc} 年版` : '廠商案例'].filter(Boolean).join('・')}
                        </div>
                      </div>
                      {href && (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs text-brand inline-flex items-center gap-0.5 whitespace-nowrap flex-shrink-0">
                          {c.page ? `p.${c.page}` : '來源'} <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                    <div className="mt-1.5 grid grid-cols-3 sm:grid-cols-6 gap-x-2 gap-y-1 text-xs">
                      <Mini k="投資" v={fmtWan(r.inv)} />
                      <Mini k="年減碳" v={fmtTon(r.co2)} />
                      <Mini k="回收" v={fmtYears(r.payback)} />
                      <Mini k="攤提" v={fmtCost(r.amort)} strong />
                      <Mini k="淨成本" v={fmtCost(r.net)} />
                      <Mini k="權重" v={r.w.toFixed(2)} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {vendors.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-slate-700 mb-1.5">低碳製程技術資料庫：相關廠商技術（{vendors.length}）</h3>
              <ul className="divide-y divide-slate-100">
                {vendors.slice(0, 12).map((t) => (
                  <li key={t.tech_id} className="py-2 flex items-start justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800">{t.tech_name}</div>
                      <div className="text-xs text-slate-500">{t.vendor}{t.case_co2_t ? `・典型案例年減碳 ${fmtTon(t.case_co2_t)}` : ''}</div>
                    </div>
                    {t.detail_url && <a href={t.detail_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand inline-flex items-center gap-0.5 flex-shrink-0">詳情 <ExternalLink size={12} /></a>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

const Stat = ({ label, value, unit, note, accent }) => (
  <div className={`rounded-xl border p-3 ${accent ? 'border-amber-300 bg-amber-50' : 'border-brand-line'}`}>
    <div className={`text-xs ${accent ? 'text-amber-900 font-semibold' : 'text-slate-500'}`}>{label}</div>
    <div className="num text-lg font-extrabold text-brand-ink leading-tight mt-0.5">{value}{unit && <span className="text-xs font-normal text-slate-500 ml-0.5">{unit}</span>}</div>
    {note && <div className="text-xs text-slate-500 mt-0.5 leading-snug">{note}</div>}
  </div>
);

const Mini = ({ k, v, strong }) => (
  <div className="min-w-0">
    <div className="text-slate-400">{k}</div>
    <div className={`num truncate ${strong ? 'font-bold text-amber-800' : 'text-slate-700'}`}>{v}</div>
  </div>
);

// 成本拆解條：投資攤提（正）− 節能收益（負）＝ 淨成本
function CostSplit({ agg, color }) {
  if (agg.amort == null || agg.saving == null) return null;
  const max = Math.max(agg.amort, agg.saving, Math.abs(agg.net));
  const pct = (v) => `${(Math.abs(v) / max) * 50}%`;
  return (
    <section className="rounded-xl border border-brand-line p-3">
      <h3 className="text-sm font-bold text-slate-700">成本拆解（可算成本的 {agg.nComplete} 件，減碳量加權）</h3>
      <div className="mt-3 space-y-2 text-xs">
        {[
          ['投資攤提', agg.amort, color, false],
          ['節能收益', -agg.saving, '#94a3b8', true],
          ['淨成本', agg.net, '#0f172a', false],
        ].map(([k, v, c, hatch]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-16 text-slate-600 flex-shrink-0">{k}</span>
            <div className="relative flex-1 h-5 bg-slate-50 rounded">
              <div className="absolute top-0 bottom-0 w-px bg-slate-400" style={{ left: '50%' }} />
              <div className="absolute top-0.5 bottom-0.5 rounded-sm" style={{
                left: v >= 0 ? '50%' : `calc(50% - ${pct(v)})`, width: pct(v), background: c,
                backgroundImage: hatch ? 'repeating-linear-gradient(45deg, rgba(255,255,255,.55) 0 3px, transparent 3px 6px)' : undefined,
              }} />
            </div>
            <span className="num w-24 text-right font-semibold text-slate-700">{fmtCost(v)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
