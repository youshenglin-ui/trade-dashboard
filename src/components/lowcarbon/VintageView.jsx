// 技術研究：資料年代與不確定性
//   各年版彙編案例的投資攤提成本（或回收年限）分佈：點＝案例、方框＝P25–P75、橫線＝中位數、細線＝P10–P90。
//   用來檢視「越舊的資料誤差越大」與「技術進步帶動案例極端化」，並說明目前的年代權重設定。
import React, { useMemo, useState } from 'react';
import { CATEGORY_COLOR, fmtNum, fmtYears, quantile, rocToAd } from '../../lib/lowcarbon/metrics';
import { ageSigma, ageWeight, caseEcon, fmtCost } from '../../lib/lowcarbon/lcoa';
import { useElementWidth } from '../../lib/lowcarbon/useElementWidth';
import { Card, CategoryChip, Note, Segmented, TipBox } from './ui';

const METRICS = [
  { value: 'amort', label: '投資攤提成本', unit: '元/公噸', fmt: fmtCost },
  { value: 'payback', label: '回收年限', unit: '年', fmt: fmtYears },
];

export default function VintageView({ rows, ctx }) {
  const [metric, setMetric] = useState('amort');
  const m = METRICS.find((x) => x.value === metric);
  const pts = useMemo(() => rows.filter((c) => c.pub_year_roc).map((c, i) => {
    const e = caseEcon(c, ctx.opts);
    return { c, i, year: c.pub_year_roc, v: e[metric] };
  }).filter((p) => p.v != null && p.v > 0), [rows, ctx, metric]);
  const years = [...new Set(pts.map((p) => p.year))].sort((a, b) => a - b);
  const stats = years.map((y) => {
    const v = pts.filter((p) => p.year === y).map((p) => p.v);
    const age = ctx.refRoc - y;
    return {
      year: y, n: v.length, p10: quantile(v, 0.1), p25: quantile(v, 0.25), p50: quantile(v, 0.5), p75: quantile(v, 0.75), p90: quantile(v, 0.9),
      age, w: ageWeight(age, ctx.A), sigma: ageSigma(age, ctx.A),
    };
  });
  const recent = stats.filter((s) => s.age <= 2 && s.n >= 3);
  const older = stats.filter((s) => s.age > 2 && s.n >= 3);
  const spread = (list) => {
    const r = list.map((s) => s.p90 / s.p10).filter((x) => Number.isFinite(x));
    return r.length ? r.reduce((a, b) => a + b, 0) / r.length : null;
  };
  const sRecent = spread(recent);
  const sOlder = spread(older);

  return (
    <div className="space-y-4">
      <Card title={`各年版案例的${m.label}分佈`} subtitle="對數座標。點＝案例（顏色＝類別），方框＝P25–P75，粗橫線＝中位數，細線＝P10–P90。下方數字為該年版在加權平均中的權重。"
        right={<Segmented value={metric} onChange={setMetric} options={METRICS} />}>
        {pts.length ? <YearStrip pts={pts} stats={stats} m={m} /> : <p className="text-sm text-slate-500 py-8 text-center">沒有可用的案例</p>}
        <div className="flex flex-wrap gap-3 mt-2">{[...new Set(pts.map((p) => p.c.category))].map((c) => <CategoryChip key={c} cat={c} />)}</div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2" title="各年版統計" subtitle={`離散倍數 = P90 ÷ P10，越大代表案例差異越大。資料年代以最新版（${ctx.refRoc} 年）為基準。`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-brand-line">
                  <th className="text-left font-medium py-2">年版</th>
                  <th className="text-right font-medium py-2 px-2">案例</th>
                  <th className="text-right font-medium py-2 px-2">P10</th>
                  <th className="text-right font-medium py-2 px-2">中位數</th>
                  <th className="text-right font-medium py-2 px-2">P90</th>
                  <th className="text-right font-medium py-2 px-2">離散倍數</th>
                  <th className="text-right font-medium py-2 px-2">誤差倍數</th>
                  <th className="text-right font-medium py-2 pl-2">權重</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.year} className="border-b border-slate-100">
                    <td className="py-1.5">{s.year} 年（{rocToAd(s.year)}）</td>
                    <td className="py-1.5 px-2 text-right num">{s.n}</td>
                    <td className="py-1.5 px-2 text-right num">{m.fmt(s.p10)}</td>
                    <td className="py-1.5 px-2 text-right num font-semibold">{m.fmt(s.p50)}</td>
                    <td className="py-1.5 px-2 text-right num">{m.fmt(s.p90)}</td>
                    <td className="py-1.5 px-2 text-right num">{s.n >= 3 ? `${fmtNum(s.p90 / s.p10, 1)} 倍` : '—'}</td>
                    <td className="py-1.5 px-2 text-right num">×{fmtNum(s.sigma, 2)}</td>
                    <td className="py-1.5 pl-2 text-right num font-semibold">{fmtNum(s.w, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="年代權重怎麼算" subtitle="假設案例的標準誤差隨資料年代線性放大，加權平均採反變異數權重。">
          <div className="space-y-2 text-[13px] text-slate-700 leading-relaxed">
            <p className="bg-slate-900 text-slate-100 rounded-lg px-3 py-2 font-mono text-xs leading-relaxed">
              誤差倍數 = 1 + 年代 ÷ A<br />權重 = 1 ÷ 誤差倍數²
            </p>
            <p>目前設定：{ctx.A ? <b>每 {ctx.A} 年誤差倍增（A = {ctx.A}）</b> : <b>不調整（每筆權重 1）</b>}。可在頁面上方「資料年代誤差」切換。</p>
            <div className="flex flex-wrap gap-1.5">
              {[0, 2, 4, 6, 8].map((a) => (
                <span key={a} className="text-xs bg-brand-ground border border-brand-line rounded-lg px-2 py-1">{a} 年前 <b className="num">{fmtNum(ageWeight(a, ctx.A), 2)}</b></span>
              ))}
            </div>
            {sRecent != null && sOlder != null && (
              <p className="text-xs text-slate-600">
                近 3 年版的平均離散倍數 <b>{fmtNum(sRecent, 1)}</b> 倍，較早年版 <b>{fmtNum(sOlder, 1)}</b> 倍
                {sRecent > sOlder ? '：新案例的差異更大（同時出現極低與極高成本的案例），單看平均容易失真，請搭配典型範圍判讀。' : '。'}
              </p>
            )}
          </div>
        </Card>
      </div>

      <Note>
        各年版的案例組成（產業、技術類型）不同，年版間的差異不完全是技術進步造成；早期彙編以系統節能為主、近年納入較多製程與燃料轉換的大型案例。
        回收年限與投資攤提使用原文數值，金額未經物價調整。
      </Note>
    </div>
  );
}

function YearStrip({ pts, stats, m }) {
  const [box, width] = useElementWidth();
  const [hover, setHover] = useState(null);
  const H = 380;
  const PAD = { l: 70, r: 12, t: 12, b: 48 };
  const vs = pts.map((p) => p.v);
  const lo = 10 ** Math.floor(Math.log10(Math.min(...vs)));
  const hi = 10 ** Math.ceil(Math.log10(Math.max(...vs)));
  const sy = (v) => PAD.t + (1 - (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * (H - PAD.t - PAD.b);
  const bw = (width - PAD.l - PAD.r) / stats.length;
  const xOf = (y) => PAD.l + stats.findIndex((s) => s.year === y) * bw + bw / 2;
  const ticks = [];
  for (let v = lo; v <= hi; v *= 10) ticks.push(v);
  // 固定抖動（依案例序號），避免每次重繪跳動
  const jitter = (i) => (((i * 9301 + 49297) % 233280) / 233280 - 0.5) * Math.min(bw * 0.5, 44);
  return (
    <div ref={box} className="relative" onMouseLeave={() => setHover(null)}>
      <svg width={width} height={H} className="block" role="img" aria-label="各年版分佈">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={width - PAD.r} y1={sy(t)} y2={sy(t)} stroke="#e2e8f0" strokeDasharray="3 3" />
            <text x={PAD.l - 6} y={sy(t) + 4} textAnchor="end" fontSize="12" fill="#64748b">{t >= 1e4 ? `${fmtNum(t / 1e4)}萬` : fmtNum(t, 2)}</text>
          </g>
        ))}
        <text x={12} y={H / 2} fontSize="12" fill="#475569" textAnchor="middle" transform={`rotate(-90 12 ${H / 2})`}>{m.label}（{m.unit}，對數）</text>
        {stats.map((s) => {
          const x = xOf(s.year);
          const w = Math.min(bw * 0.6, 56);
          return (
            <g key={s.year}>
              {s.n >= 3 && (
                <>
                  <line x1={x} x2={x} y1={sy(s.p90)} y2={sy(s.p10)} stroke="#334155" strokeWidth="1.25" />
                  <rect x={x - w / 2} y={sy(s.p75)} width={w} height={Math.max(1, sy(s.p25) - sy(s.p75))} fill="#f1f5f9" fillOpacity="0.6" stroke="#334155" strokeWidth="1.25" rx="3" />
                  <line x1={x - w / 2} x2={x + w / 2} y1={sy(s.p50)} y2={sy(s.p50)} stroke="#0f172a" strokeWidth="3" />
                </>
              )}
              <text x={x} y={H - PAD.b + 18} fontSize="12" textAnchor="middle" fill="#334155">{s.year}年</text>
              <text x={x} y={H - PAD.b + 34} fontSize="12" textAnchor="middle" fill="#64748b">權重 {fmtNum(s.w, 2)}</text>
            </g>
          );
        })}
        {pts.map((p) => (
          <circle key={p.c.case_id} cx={xOf(p.year) + jitter(p.i)} cy={sy(p.v)} r={hover?.p === p ? 6 : 4}
            fill={CATEGORY_COLOR[p.c.category]} fillOpacity="0.75" stroke="#fff" strokeWidth="1"
            onMouseMove={(e) => { const r = box.current.getBoundingClientRect(); setHover({ p, x: e.clientX - r.left, y: e.clientY - r.top }); }} />
        ))}
      </svg>
      {hover && (
        <div className="absolute pointer-events-none z-10" style={{ left: Math.max(0, Math.min(hover.x + 12, width - 280)), top: Math.max(0, hover.y - 120) }}>
          <TipBox title={hover.p.c.tech_name} rows={[
            ['類別', `${hover.p.c.category}／${hover.p.c.subcategory}`, CATEGORY_COLOR[hover.p.c.category]],
            ['公司', hover.p.c.company || hover.p.c.industry],
            [m.label, m.fmt(hover.p.v)],
          ]} footer={hover.p.c.doc_title} />
        </div>
      )}
    </div>
  );
}
