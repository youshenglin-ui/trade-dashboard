// 分頁 4：邊際減碳成本曲線（MACC）
//   每根柱：寬 = 年減碳量，高 = 年化減碳成本（元/公噸）=（投資 × 資本回收因子 − 年效益）÷ 年減碳量
//   由低到高排列；低於 0 = 減碳同時省錢；低於碳費線 = 比繳碳費划算。
import React, { useMemo, useRef, useState } from 'react';
import { CATEGORIES, CATEGORY_COLOR, abatementCost, co2Of, crf, fmtNum, fmtTon, fmtWan, fmtYears, paybackOf } from '../../lib/lowcarbon/metrics';
import { Card, Kpi, Note, TipBox } from './ui';
import { Slider } from './InvestTab';

const W = 1000;
const H = 400;
const PAD = { l: 64, r: 16, t: 16, b: 40 };
const CLIP = 20000; // y 軸截斷（元/公噸），超出者以箭頭標示

export default function MaccTab({ rows, normalizeEf }) {
  const [rate, setRate] = useState(5);
  const [life, setLife] = useState(10);
  const [price, setPrice] = useState(1500);
  const [hover, setHover] = useState(null);
  const box = useRef(null);
  const opts = useMemo(() => ({ normalizeEf, discountRate: rate / 100, lifetimeYears: life }), [normalizeEf, rate, life]);

  const bars = useMemo(() => {
    const list = rows.map((c) => ({ c, cost: abatementCost(c, opts), co2: co2Of(c, opts) }))
      .filter((b) => b.cost != null && b.co2 > 0).sort((a, b) => a.cost - b.cost);
    const x0 = list.reduce((acc, b, i) => { acc.push(i ? acc[i - 1] + list[i - 1].co2 : 0); return acc; }, []);
    return list.map((b, i) => ({ ...b, x0: x0[i] }));
  }, [rows, opts]);
  const total = bars.reduce((s, b) => s + b.co2, 0);
  const neg = bars.filter((b) => b.cost < 0).reduce((s, b) => s + b.co2, 0);
  const underFee = bars.filter((b) => b.cost < 300).reduce((s, b) => s + b.co2, 0);
  const underPrice = bars.filter((b) => b.cost < price).reduce((s, b) => s + b.co2, 0);

  const yMin = Math.max(-CLIP, Math.min(0, ...bars.map((b) => b.cost)));
  const yMax = Math.min(CLIP, Math.max(price * 1.2, ...bars.map((b) => b.cost)));
  const sx = (v) => PAD.l + (total ? (v / total) * (W - PAD.l - PAD.r) : 0);
  const sy = (v) => PAD.t + ((yMax - Math.max(yMin, Math.min(yMax, v))) / (yMax - yMin || 1)) * (H - PAD.t - PAD.b);
  const yTicks = niceTicks(yMin, yMax);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="可計算成本的案例" value={fmtNum(bars.length)} unit="件" note="需同時有投資、年效益、減碳量" />
        <Kpi label="年減碳量合計" value={fmtTon(total)} />
        <Kpi label="負成本（省錢又減碳）" value={total ? `${Math.round((neg / total) * 100)}%` : '—'} note={fmtTon(neg)} />
        <Kpi label={`成本低於 ${fmtNum(price)} 元/公噸`} value={total ? `${Math.round((underPrice / total) * 100)}%` : '—'} note={`低於碳費 300 元：${total ? Math.round((underFee / total) * 100) : 0}%`} />
      </div>

      <Card title="邊際減碳成本曲線" subtitle="由左到右依年化減碳成本排序；柱寬為年減碳量。滑過柱子看技術。y 軸超過 ±2 萬元/公噸者截斷。">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
          <Slider label="折現率" value={rate} min={0} max={12} step={1} onChange={setRate} fmt={(v) => `${v}%`} />
          <Slider label="設備壽命" value={life} min={5} max={25} step={1} onChange={setLife} fmt={(v) => `${v} 年（CRF ${fmtNum(crf(rate / 100, v), 3)}）`} />
          <Slider label="比較用碳價" value={price} min={300} max={5000} step={100} onChange={setPrice} fmt={(v) => `${fmtNum(v)} 元/公噸`} />
        </div>
        <div className="relative" ref={box} onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="邊際減碳成本曲線">
            {yTicks.map((t) => (
              <g key={t}>
                <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} stroke={t === 0 ? '#94a3b8' : '#e2e8f0'} strokeDasharray={t === 0 ? '' : '3 3'} />
                <text x={PAD.l - 6} y={sy(t) + 4} textAnchor="end" fontSize="11" fill="#64748b">{fmtNum(t)}</text>
              </g>
            ))}
            <text x={14} y={H / 2} fontSize="12" fill="#475569" transform={`rotate(-90 14 ${H / 2})`} textAnchor="middle">年化減碳成本（元/公噸CO2e）</text>
            {bars.map((b, i) => {
              const x = sx(b.x0);
              const w = Math.max(0.8, sx(b.x0 + b.co2) - x - 1);
              const y0 = sy(0);
              const y1 = sy(b.cost);
              const clipped = b.cost > yMax || b.cost < yMin;
              return (
                <g key={b.c.case_id} onMouseMove={(e) => {
                  const r = box.current.getBoundingClientRect();
                  setHover({ b, x: e.clientX - r.left, y: e.clientY - r.top, w: r.width });
                }}>
                  <rect x={x} y={Math.min(y0, y1)} width={w} height={Math.max(1, Math.abs(y1 - y0))}
                    fill={CATEGORY_COLOR[b.c.category]} opacity={hover && hover.b !== b ? 0.45 : 0.9} rx={1} />
                  {clipped && <text x={x + w / 2} y={b.cost > 0 ? PAD.t + 10 : H - PAD.b - 4} fontSize="10" textAnchor="middle" fill="#334155">{b.cost > 0 ? '▲' : '▼'}</text>}
                  {i < 3 && w > 60 && <text x={x + 4} y={y1 + (b.cost < 0 ? 14 : -4)} fontSize="10" fill="#334155">{b.c.tech_name.slice(0, 10)}</text>}
                </g>
              );
            })}
            {[{ v: 300, label: '碳費 300 元', below: true }, { v: price, label: `碳價 ${fmtNum(price)} 元` }].filter((r) => r.v <= yMax).map((r) => (
              <g key={r.label}>
                <line x1={PAD.l} x2={W - PAD.r} y1={sy(r.v)} y2={sy(r.v)} stroke="#eb6834" strokeDasharray="6 4" strokeWidth={1.5} />
                <text x={W - PAD.r - 4} y={r.below ? sy(r.v) + 13 : sy(r.v) - 5} textAnchor="end" fontSize="11" fill="#9a3412">{r.label}</text>
              </g>
            ))}
            <text x={(W + PAD.l) / 2} y={H - 8} fontSize="12" fill="#475569" textAnchor="middle">累計年減碳量（公噸CO2e/年）：0 → {fmtTon(total)}</text>
          </svg>
          {hover && (
            <div className="absolute pointer-events-none z-10" style={{ left: Math.min(hover.x + 12, hover.w - 260), top: Math.max(0, hover.y - 140) }}>
              <TipBox title={hover.b.c.tech_name} rows={[
                ['類別', `${hover.b.c.category}／${hover.b.c.subcategory || '—'}`, CATEGORY_COLOR[hover.b.c.category]],
                ['產業', hover.b.c.industry],
                ['年化減碳成本', `${fmtNum(hover.b.cost)} 元/公噸`],
                ['年減碳', fmtTon(hover.b.co2)],
                ['投資／年效益', `${fmtWan(hover.b.c.investment_wan)}／${fmtWan(hover.b.c.benefit_wan)}`],
                ['回收年限', fmtYears(paybackOf(hover.b.c))],
              ]} footer={hover.b.c.doc_title} />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-600">
          {CATEGORIES.map((c) => <span key={c} className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: CATEGORY_COLOR[c] }} />{c}</span>)}
        </div>
      </Card>
      <Note>
        年效益為原文所列能源與維護節省（多數未含碳費）。負成本措施（多為動力、冷卻、餘熱回收）代表「省下的錢在設備壽命內就超過投資」，推動障礙通常是資訊、資金與停機排程，而非經濟性；
        高於碳價線的措施則需要補助、低利融資或更高碳價才具誘因。
      </Note>
    </div>
  );
}

function niceTicks(min, max) {
  const span = max - min || 1;
  const step = 10 ** Math.floor(Math.log10(span / 5));
  const nice = [1, 2, 5, 10].map((m) => m * step).find((s) => span / s <= 6) || step * 10;
  const out = [];
  for (let v = Math.ceil(min / nice) * nice; v <= max; v += nice) out.push(Math.round(v));
  return out;
}
