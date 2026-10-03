// 減碳成本曲線（自繪 SVG，以實際像素繪製，手機字級不縮小）
//   每欄寬 = 年減碳量；拆分模式：向上實心 = 投資攤提成本、向下斜線 = 節能收益、黑橫線 = 淨成本，
//   細直線 = 典型範圍（加權 P25–P75）。淨成本模式：只畫淨成本柱。
import React, { useState } from 'react';
import { CATEGORIES, CATEGORY_COLOR, fmtNum, fmtTon } from '../../lib/lowcarbon/metrics';
import { fmtCost } from '../../lib/lowcarbon/lcoa';
import { useElementWidth } from '../../lib/lowcarbon/useElementWidth';
import { TipBox } from './ui';

const PAD = { l: 64, r: 12, t: 22, b: 52 };

export default function CostCurve({ items, mode = 'split', height = 420, onPick, refLines = [] }) {
  const [box, width] = useElementWidth();
  const [hover, setHover] = useState(null);
  const H = height;
  const total = items.reduce((s, d) => s + d.width, 0);
  const vals = items.flatMap((d) => (mode === 'split' ? [d.amort, -d.saving, d.net] : [d.net, d.p25, d.p75])).filter((v) => v != null);
  // 縱軸範圍取 |值| 的第 90 百分位（少數極端技術以 ▲▼ 標示超出），避免攤提柱被壓扁
  const absSorted = vals.map(Math.abs).sort((a, b) => a - b);
  const clip = Math.max(3000, (absSorted[Math.floor(absSorted.length * 0.9)] || 3000) * 1.15);
  const yMax = Math.min(clip, Math.max(500, ...vals, ...refLines.map((r) => r.value * 1.6)));
  const yMin = Math.max(-clip, Math.min(-500, ...vals));
  const innerW = width - PAD.l - PAD.r;
  // 欄寬：依減碳量，但至少 4px（小技術也看得到、點得到）
  const minW = 4;
  const gaps = items.length * 2;
  const flexW = Math.max(0, innerW - gaps - items.length * minW);
  const widths = items.map((d) => minW + (total ? (d.width / total) * flexW : 0));
  const cols = items.map((d, i) => ({ d, w: widths[i], x: PAD.l + widths.slice(0, i).reduce((s, w) => s + w + 2, 0) }));
  const sy = (v) => PAD.t + ((yMax - Math.max(yMin, Math.min(yMax, v))) / (yMax - yMin || 1)) * (H - PAD.t - PAD.b);
  const ticks = niceTicks(yMin, yMax);
  const y0 = sy(0);

  return (
    <div ref={box} className="relative w-full" onMouseLeave={() => setHover(null)}>
      <svg width={width} height={H} role="img" aria-label="減碳成本曲線" className="block">
        <defs>
          {CATEGORIES.map((c) => (
            <pattern key={c} id={`hatch-${c}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill={CATEGORY_COLOR[c]} opacity="0.18" />
              <line x1="0" y1="0" x2="0" y2="6" stroke={CATEGORY_COLOR[c]} strokeWidth="2" opacity="0.55" />
            </pattern>
          ))}
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={width - PAD.r} y1={sy(t)} y2={sy(t)} stroke={t === 0 ? '#64748b' : '#e2e8f0'} strokeDasharray={t === 0 ? '' : '3 3'} />
            <text x={PAD.l - 6} y={sy(t) + 4} textAnchor="end" fontSize="12" fill="#64748b">{fmtNum(t)}</text>
          </g>
        ))}
        <text x={12} y={(PAD.t + H - PAD.b) / 2} fontSize="12" fill="#475569" textAnchor="middle"
          transform={`rotate(-90 12 ${(PAD.t + H - PAD.b) / 2})`}>元／每年減 1 公噸CO2e</text>
        {mode === 'split' && (
          <>
            <text x={PAD.l + 6} y={PAD.t - 8} fontSize="12" fill="#92400e" fontWeight="bold">▲ 投資攤提成本（企業要先投入的門檻）</text>
            <text x={PAD.l + 6} y={H - PAD.b + 18} fontSize="12" fill="#475569">▼ 節能收益（省下的能源費）</text>
          </>
        )}
        {cols.map(({ d, x, w }) => {
          const on = hover?.d === d;
          const dim = hover && !on ? 0.4 : 1;
          const cx = x + w / 2;
          return (
            <g key={d.id} opacity={dim} style={{ cursor: onPick ? 'pointer' : 'default' }}
              onMouseMove={(e) => { const r = box.current.getBoundingClientRect(); setHover({ d, x: e.clientX - r.left, y: e.clientY - r.top }); }}
              onClick={() => onPick?.(d)}>
              {/* 擴大點擊範圍 */}
              <rect x={x} y={PAD.t} width={w + 2} height={H - PAD.t - PAD.b} fill="transparent" />
              {mode === 'split' ? (
                <>
                  {d.amort != null && <rect x={x} y={sy(d.amort)} width={w} height={Math.max(1, y0 - sy(d.amort))} fill={CATEGORY_COLOR[d.category]} rx={w > 8 ? 2 : 0} />}
                  {d.saving != null && <rect x={x} y={y0} width={w} height={Math.max(1, sy(-d.saving) - y0)} fill={`url(#hatch-${d.category})`} stroke={CATEGORY_COLOR[d.category]} strokeOpacity="0.5" strokeWidth="0.75" />}
                </>
              ) : (
                d.net != null && <rect x={x} y={Math.min(y0, sy(d.net))} width={w} height={Math.max(1, Math.abs(sy(d.net) - y0))} fill={CATEGORY_COLOR[d.category]} rx={w > 8 ? 2 : 0} />
              )}
              {d.p25 != null && d.p75 != null && w >= 6 && d.p25 !== d.p75 && (
                <line x1={cx} x2={cx} y1={sy(d.p25)} y2={sy(d.p75)} stroke="#0f172a" strokeWidth="1.25" opacity="0.7" />
              )}
              {d.net != null && <line x1={x} x2={x + w} y1={sy(d.net)} y2={sy(d.net)} stroke="#0f172a" strokeWidth={mode === 'split' ? 2.5 : 0} />}
              {(d.amort > yMax || d.net > yMax) && <text x={cx} y={PAD.t + 10} fontSize="11" textAnchor="middle" fill="#334155">▲</text>}
              {(d.net < yMin || -d.saving < yMin) && <text x={cx} y={H - PAD.b - 2} fontSize="11" textAnchor="middle" fill="#334155">▼</text>}
              {w >= 64 && (
                <text x={x + 3} y={Math.max(PAD.t + 12, (mode === 'split' ? sy(Math.min(d.amort ?? 0, yMax)) : Math.min(y0, sy(d.net ?? 0))) - 5)} fontSize="12" fill="#1e293b" fontWeight="600" stroke="#fff" strokeWidth="3" paintOrder="stroke">
                  {truncate(d.label, Math.floor(w / 12))}
                </text>
              )}
            </g>
          );
        })}
        {refLines.filter((r) => r.value <= yMax).map((r) => (
          <g key={r.label} pointerEvents="none">
            <line x1={PAD.l} x2={width - PAD.r} y1={sy(r.value)} y2={sy(r.value)} stroke="#c2410c" strokeDasharray="6 4" strokeWidth="1.5" />
            <text x={width - PAD.r - 4} y={sy(r.value) - 5} textAnchor="end" fontSize="12" fill="#9a3412" fontWeight="600"
              stroke="#fff" strokeWidth="4" paintOrder="stroke">{r.label}</text>
          </g>
        ))}
        <text x={PAD.l + 6} y={H - 8} fontSize="12" fill="#475569">
          {width < 560 ? `欄寬＝年減碳量（合計 ${fmtTon(total)}）` : `欄寬＝年減碳量（合計 ${fmtTon(total)}／年），由左到右依淨成本排序`}
        </text>
      </svg>
      {hover && (
        <div className="absolute pointer-events-none z-10" style={{ left: Math.max(0, Math.min(hover.x + 12, width - 280)), top: Math.max(0, hover.y - 170) }}>
          <TipBox title={hover.d.label} rows={[
            ['類別', hover.d.category, CATEGORY_COLOR[hover.d.category]],
            hover.d.sub ? ['說明', hover.d.sub] : null,
            ['投資攤提成本', fmtCost(hover.d.amort)],
            ['節能收益', hover.d.saving == null ? '—' : `−${fmtCost(hover.d.saving)}`],
            ['淨成本', fmtCost(hover.d.net)],
            hover.d.p25 != null ? ['典型範圍', `${fmtCost(hover.d.p25)} ～ ${fmtCost(hover.d.p75)}`] : null,
            ['年減碳', fmtTon(hover.d.width)],
            hover.d.n != null ? ['案例數', `${hover.d.n} 件`] : null,
          ]} footer={onPick ? '點擊查看組成案例' : undefined} />
        </div>
      )}
    </div>
  );
}

const truncate = (s, n) => (s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s);

function niceTicks(min, max) {
  const span = max - min || 1;
  const step = 10 ** Math.floor(Math.log10(span / 5));
  const nice = [1, 2, 5, 10].map((m) => m * step).find((s) => span / s <= 7) || step * 10;
  const out = [];
  for (let v = Math.ceil(min / nice) * nice; v <= max; v += nice) out.push(Math.round(v));
  return out;
}
