// ==========================================
// 台灣疊圖地圖（共用元件）
// ==========================================
// 用途：CCUS 捕捉/封存/再利用整合地圖、碳費自主減量分布地圖…任何「多圖層點位 + 可勾選疊圖」。
// 只吃 props（layers / lines），不自己抓業務資料 → 介面改版時可直接搬過去用，
// 之後若換 MapLibre GL，只要維持同樣的 props 介面即可替換內部實作。
//
// layers: [{ id, label, color, shape: 'circle'|'square'|'diamond'|'triangle'|'hexagon', fixedRadius, points: [
//   { id, lat, lon, value, title, subtitle, details: [[標籤, 值], ...], actions: [{ label, onClick }] }
// ] }]
// lines:  [{ layerId, from: {lat, lon}, to: {lat, lon}, color, dashed, width, title }]
import React, { useEffect, useRef, useState } from 'react';
import { Layers, Maximize, ZoomIn, ZoomOut, X } from 'lucide-react';
import { project, useTaiwanCounties } from '../../lib/geo/taiwanCounties';

// 可視範圍：台灣本島＋澎湖（經度 119.3–122.1、緯度 21.85–25.35），整島一次放得下
const VB = { x: -660, y: -740, w: 1160, h: 1570 };
const VB_CX = VB.x + VB.w / 2;
const VB_CY = VB.y + VB.h / 2;
// 點位/線寬/字級的基準單位（viewBox 單位；畫面上約 1px × 顯示比例）
const U = 2;

function Marker({ shape, cx, cy, r, color, strokeWidth, opacity }) {
  const common = { fill: color, fillOpacity: opacity, stroke: '#ffffff', strokeWidth };
  if (shape === 'square') return <rect x={cx - r * 0.88} y={cy - r * 0.88} width={r * 1.76} height={r * 1.76} rx={r * 0.2} {...common} />;
  if (shape === 'diamond') return <polygon points={`${cx},${cy - r * 1.2} ${cx + r * 1.2},${cy} ${cx},${cy + r * 1.2} ${cx - r * 1.2},${cy}`} {...common} />;
  if (shape === 'hexagon') {
    const pts = Array.from({ length: 6 }, (_, i) => `${cx + r * 1.1 * Math.cos((Math.PI / 3) * i)},${cy + r * 1.1 * Math.sin((Math.PI / 3) * i)}`).join(' ');
    return <polygon points={pts} {...common} />;
  }
  if (shape === 'triangle') return <polygon points={`${cx},${cy - r * 1.25} ${cx + r * 1.1},${cy + r * 0.75} ${cx - r * 1.1},${cy + r * 0.75}`} {...common} />;
  return <circle cx={cx} cy={cy} r={r} {...common} />;
}

export function LegendSwatch({ shape = 'circle', color, size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="-7 -7 14 14" aria-hidden="true" className="flex-shrink-0">
      <Marker shape={shape} cx={0} cy={0} r={5} color={color} strokeWidth={0} opacity={1} />
    </svg>
  );
}

export default function TaiwanLayerMap({ layers = [], lines = [], defaultActive, height = 620, title, footnote, countyFill }) {
  const counties = useTaiwanCounties();
  const [active, setActive] = useState(() => new Set(defaultActive || layers.map((l) => l.id)));
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState(null);
  const [hover, setHover] = useState(null);
  const [selected, setSelected] = useState(null);
  const svgRef = useRef(null);

  // 之後才出現的新圖層（例如資料載入後）預設打開；使用者關掉的圖層不會被重新打開
  const knownIds = useRef(new Set(layers.map((l) => l.id)));
  const layerKey = layers.map((l) => l.id).join('|');
  useEffect(() => {
    const fresh = layers.map((l) => l.id).filter((id) => !knownIds.current.has(id));
    if (!fresh.length) return;
    fresh.forEach((id) => knownIds.current.add(id));
    if (!defaultActive) setActive((prev) => new Set([...prev, ...fresh]));
  }, [layerKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // 同一座標的多個點（例如麥寮六輕多家）在畫面上以螺旋錯開，數值不變
  const placed = (() => {
    const groups = new Map();
    const out = [];
    layers.forEach((layer) => {
      if (!active.has(layer.id)) return;
      const max = Math.max(...layer.points.map((p) => Math.abs(Number(p.value) || 0)), 0);
      layer.points.forEach((p) => {
        if (p.lat == null || p.lon == null) return;
        const [x, y] = project(Number(p.lon), Number(p.lat));
        const key = `${x.toFixed(0)}_${y.toFixed(0)}`;
        const idx = groups.get(key) || 0;
        groups.set(key, idx + 1);
        const v = Math.abs(Number(p.value) || 0);
        const r = U * (layer.fixedRadius ?? (max > 0 && v > 0 ? 5 + 13 * Math.sqrt(v / max) : 5));
        out.push({ ...p, layer, x, y, r, idx });
      });
    });
    return out.map((p) => {
      if (!p.idx) return p;
      const ang = p.idx * 2.4;
      const dist = 9 * U * Math.sqrt(p.idx);
      return { ...p, x: p.x + (dist * Math.cos(ang)) / zoom, y: p.y + (dist * Math.sin(ang)) / zoom };
    });
  })();

  const toggle = (id) => setActive((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const onWheel = (e) => {
    e.preventDefault();
    setZoom((z) => Math.min(12, Math.max(0.6, z * (e.deltaY < 0 ? 1.15 : 1 / 1.15))));
  };
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return undefined;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onDown = (e) => setDrag({ x: e.clientX, y: e.clientY, pan });
  const onMove = (e) => {
    if (!drag) return;
    const rect = svgRef.current.getBoundingClientRect();
    const k = Math.max(VB.w / rect.width, VB.h / rect.height); // preserveAspectRatio=meet 的縮放比
    setPan({ x: drag.pan.x + (e.clientX - drag.x) * k, y: drag.pan.y + (e.clientY - drag.y) * k });
  };
  const onUp = () => setDrag(null);

  const visibleLines = lines.filter((l) => active.has(l.layerId));
  const fontScale = 1 / Math.pow(zoom, 0.8);

  return (
    <div className="flex flex-col gap-2 w-full">
      {(title || layers.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {title && <div className="font-bold text-slate-700 text-sm flex items-center gap-2 mr-2"><Layers size={16} className="text-slate-500" />{title}</div>}
          {layers.map((l) => {
            const on = active.has(l.id);
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => toggle(l.id)}
                aria-pressed={on}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ${on ? 'bg-white border-slate-300 text-slate-700 shadow-sm' : 'bg-slate-100 border-transparent text-slate-400'}`}
              >
                <span style={{ opacity: on ? 1 : 0.35 }}><LegendSwatch shape={l.shape} color={l.color} /></span>
                {l.label}
                <span className="font-mono text-[10px] text-slate-400">{l.points.filter((p) => p.lat != null).length}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="relative w-full rounded-xl border border-slate-200 bg-slate-50 overflow-hidden" style={{ height }}>
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1 bg-white/95 p-1 rounded-lg shadow-sm border border-slate-200">
          <button type="button" title="放大" onClick={() => setZoom((z) => Math.min(12, z * 1.3))} className="p-1.5 hover:bg-slate-100 rounded text-slate-600"><ZoomIn size={16} /></button>
          <button type="button" title="縮小" onClick={() => setZoom((z) => Math.max(0.6, z / 1.3))} className="p-1.5 hover:bg-slate-100 rounded text-slate-600"><ZoomOut size={16} /></button>
          <button type="button" title="重置" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-600"><Maximize size={16} /></button>
        </div>

        {selected && (
          <div className="absolute top-3 left-3 z-20 w-72 max-h-[85%] overflow-y-auto bg-white/95 backdrop-blur rounded-xl shadow-xl border border-slate-200 p-3 text-xs">
            <button type="button" onClick={() => setSelected(null)} className="absolute top-2 right-2 p-1 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700" aria-label="關閉"><X size={12} /></button>
            <div className="flex items-center gap-2 pr-6 mb-1">
              <LegendSwatch shape={selected.layer.shape} color={selected.layer.color} />
              <span className="text-[10px] font-bold text-slate-500">{selected.layer.label}</span>
            </div>
            <div className="font-bold text-slate-800 text-sm leading-snug">{selected.title}</div>
            {selected.subtitle && <div className="text-slate-500 mb-2">{selected.subtitle}</div>}
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 mt-2">
              {(selected.details || []).filter(([, v]) => v != null && v !== '').map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt className="text-slate-400 whitespace-nowrap">{k}</dt>
                  <dd className="text-slate-700 font-medium break-words">{v}</dd>
                </React.Fragment>
              ))}
            </dl>
            {(selected.actions || []).map((a) => (
              <button key={a.label} type="button" onClick={a.onClick} className="mt-2 w-full text-center px-2 py-1.5 rounded-md bg-blue-50 text-blue-700 font-bold hover:bg-blue-100">{a.label}</button>
            ))}
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
          className={`w-full h-full select-none ${drag ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
          role="img"
          aria-label={title || '台灣地圖'}
        >
          {/* 以畫面中心為基準縮放 */}
          <g transform={`translate(${pan.x + VB_CX * (1 - zoom)}, ${pan.y + VB_CY * (1 - zoom)}) scale(${zoom})`}>
            {counties.map((c) => (
              <path key={c.name} d={c.d} fill={countyFill?.(c.name) || '#ffffff'} stroke="#cbd5e1" strokeWidth={(1.2 * U) / zoom} />
            ))}
            {visibleLines.map((l, i) => {
              const [x1, y1] = project(l.from.lon, l.from.lat);
              const [x2, y2] = project(l.to.lon, l.to.lat);
              return (
                <line key={`l${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={l.color || '#64748b'} strokeOpacity={0.7}
                  strokeWidth={((l.width || 2) * U) / zoom} strokeDasharray={l.dashed ? `${(6 * U) / zoom} ${(5 * U) / zoom}` : undefined} strokeLinecap="round">
                  {l.title && <title>{l.title}</title>}
                </line>
              );
            })}
            {placed.map((p) => {
              const isSel = selected && selected.id === p.id && selected.layer.id === p.layer.id;
              const isHover = hover && hover.id === p.id && hover.layer.id === p.layer.id;
              return (
                <g key={`${p.layer.id}-${p.id}`} className="cursor-pointer"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => setSelected(p)}
                  onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover(null)}>
                  <circle cx={p.x} cy={p.y} r={Math.max(p.r, 10 * U) / zoom} fill="transparent" />
                  <Marker shape={p.layer.shape} cx={p.x} cy={p.y} r={p.r / zoom} color={p.layer.color}
                    strokeWidth={((isSel || isHover ? 2.5 : 1.5) * U) / zoom} opacity={isSel || isHover ? 1 : 0.85} />
                </g>
              );
            })}
            {hover && (
              <text x={hover.x + (hover.r + 6 * U) / zoom} y={hover.y + (4 * U) / zoom} fontSize={12 * U * fontScale} fontWeight="700" fill="#0f172a"
                paintOrder="stroke" stroke="#ffffff" strokeWidth={4 * U * fontScale} strokeLinejoin="round" pointerEvents="none">
                {hover.title}{hover.valueLabel ? `｜${hover.valueLabel}` : ''}
              </text>
            )}
          </g>
        </svg>

        {footnote && <div className="absolute bottom-2 left-3 right-3 text-[10px] text-slate-500 bg-white/85 rounded px-2 py-1 pointer-events-none">{footnote}</div>}
      </div>
    </div>
  );
}
