// ==========================================
// 台灣疊圖地圖（共用元件，MapLibre GL 版）
// ==========================================
// 用途：CCUS 捕捉/封存/再利用整合地圖、碳費自主減量分布地圖…任何「多圖層點位 + 可勾選疊圖」。
// 底圖用共用的 components/map/MapLibreBase（向量底圖、備援樣式、本地字型），這裡只負責資料圖層。
// 只吃 props，不自己抓業務資料：
//
// layers: [{ id, label, color, shape: 'circle'|'square'|'diamond'|'triangle'|'hexagon', fixedRadius, points: [
//   { id, lat, lon, value, valueLabel, title, subtitle, details: [[標籤, 值], ...], actions: [{ label, onClick }] }
// ] }]
// lines:  [{ layerId, from: {lat, lon}, to: {lat, lon}, color, dashed, width, title }]
// countyFill: (縣市名稱) => 顏色 | null   縣市面量圖（例如依家數上色）
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Layers, X } from 'lucide-react';
import MapLibreBase from '../map/MapLibreBase';
import { fc, pt, line } from '../map/mapUtils';
import { useTaiwanCounties } from '../../lib/geo/taiwanCounties';

// ---------- 點位圖示：依形狀＋顏色畫成 canvas 圖示 ----------
function drawShape(ctx, shape, c, r) {
  ctx.beginPath();
  if (shape === 'square') ctx.rect(c - r * 0.88, c - r * 0.88, r * 1.76, r * 1.76);
  else if (shape === 'diamond') { ctx.moveTo(c, c - r * 1.2); ctx.lineTo(c + r * 1.2, c); ctx.lineTo(c, c + r * 1.2); ctx.lineTo(c - r * 1.2, c); ctx.closePath(); }
  else if (shape === 'triangle') { ctx.moveTo(c, c - r * 1.25); ctx.lineTo(c + r * 1.1, c + r * 0.75); ctx.lineTo(c - r * 1.1, c + r * 0.75); ctx.closePath(); }
  else if (shape === 'hexagon') { for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i; const x = c + r * 1.1 * Math.cos(a); const y = c + r * 1.1 * Math.sin(a); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.closePath(); }
  else ctx.arc(c, c, r, 0, Math.PI * 2);
}
const ICON_R = 20; // 圖示基準半徑（px，pixelRatio 2 → 畫面上 10px），實際大小由 icon-size 縮放
const iconId = (shape, color) => `lm-${shape}-${color.replace('#', '')}`;
function ensureIcon(map, shape, color) {
  const id = iconId(shape, color);
  if (map.hasImage(id)) return id;
  const size = ICON_R * 2 + 12; const c = size / 2;
  const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  drawShape(ctx, shape, c, ICON_R);
  ctx.fillStyle = color; ctx.globalAlpha = 0.88; ctx.fill();
  ctx.globalAlpha = 1; ctx.lineWidth = 4; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  map.addImage(id, ctx.getImageData(0, 0, size, size), { pixelRatio: 2 });
  return id;
}

// 圖例用的小圖示（SVG，跟地圖上的形狀一致）
export function LegendSwatch({ shape = 'circle', color, size = 12 }) {
  const r = 5;
  let el;
  if (shape === 'square') el = <rect x={-r * 0.88} y={-r * 0.88} width={r * 1.76} height={r * 1.76} fill={color} />;
  else if (shape === 'diamond') el = <polygon points={`0,${-r * 1.2} ${r * 1.2},0 0,${r * 1.2} ${-r * 1.2},0`} fill={color} />;
  else if (shape === 'triangle') el = <polygon points={`0,${-r * 1.25} ${r * 1.1},${r * 0.75} ${-r * 1.1},${r * 0.75}`} fill={color} />;
  else if (shape === 'hexagon') el = <polygon points={Array.from({ length: 6 }, (_, i) => `${r * 1.1 * Math.cos((Math.PI / 3) * i)},${r * 1.1 * Math.sin((Math.PI / 3) * i)}`).join(' ')} fill={color} />;
  else el = <circle r={r} fill={color} />;
  return <svg width={size} height={size} viewBox="-7 -7 14 14" aria-hidden="true" className="flex-shrink-0">{el}</svg>;
}

// 圖層資料 → GeoJSON：同一座標的點以螺旋錯開（數值不變），點大小依同圖層量體比例
function buildFeatures(layers, active) {
  const groups = new Map();
  const points = [];
  const index = [];
  layers.forEach((layer) => {
    if (!active.has(layer.id)) return;
    const max = Math.max(...layer.points.map((p) => Math.abs(Number(p.value) || 0)), 0);
    layer.points.forEach((p) => {
      if (p.lat == null || p.lon == null) return;
      const key = `${Number(p.lat).toFixed(3)}_${Number(p.lon).toFixed(3)}`;
      const k = groups.get(key) || 0;
      groups.set(key, k + 1);
      const ang = k * 2.4; const dist = k ? 0.012 * Math.sqrt(k) : 0;
      const v = Math.abs(Number(p.value) || 0);
      const radiusPx = layer.fixedRadius ?? (max > 0 && v > 0 ? 5 + 13 * Math.sqrt(v / max) : 5);
      const idx = index.push({ layer, point: p }) - 1;
      points.push(pt(Number(p.lon) + dist * Math.cos(ang), Number(p.lat) + dist * Math.sin(ang), {
        idx, icon: iconId(layer.shape || 'circle', layer.color), scale: radiusPx / (ICON_R / 2),
        label: p.title || '', rank: -v,
      }));
    });
  });
  return { points: fc(points), index };
}

export default function TaiwanLayerMap({ layers = [], lines = [], defaultActive, height = 620, title, footnote, countyFill }) {
  const [active, setActive] = useState(() => new Set(defaultActive || layers.map((l) => l.id)));
  const [selected, setSelected] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef(null);
  const indexRef = useRef([]);
  const latest = useRef({});
  const counties = useTaiwanCounties();

  // 之後才出現的新圖層（例如資料載入後）預設打開；使用者關掉的圖層不會被重新打開
  const knownIds = useRef(new Set(layers.map((l) => l.id)));
  const layerKey = layers.map((l) => l.id).join('|');
  useEffect(() => {
    const fresh = layers.map((l) => l.id).filter((id) => !knownIds.current.has(id));
    if (!fresh.length) return;
    fresh.forEach((id) => knownIds.current.add(id));
    if (!defaultActive) setActive((prev) => new Set([...prev, ...fresh]));
  }, [layerKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = useMemo(() => buildFeatures(layers, active), [layers, active]);
  const lineData = useMemo(() => fc(lines.filter((l) => active.has(l.layerId) && l.from && l.to).map((l) => line(
    [[Number(l.from.lon), Number(l.from.lat)], [Number(l.to.lon), Number(l.to.lat)]],
    { color: l.color || '#64748b', width: l.width || 2, dashed: l.dashed ? 1 : 0, title: l.title || '' },
  ))), [lines, active]);

  // 地圖樣式就緒：建立資料來源、圖層與事件（只註冊一次，透過 ref 取最新資料）
  const onStyleReady = (map, maplibregl) => {
    mapRef.current = map;
    if (!map.getSource('lm-lines')) map.addSource('lm-lines', { type: 'geojson', data: fc([]) });
    if (!map.getSource('lm-points')) map.addSource('lm-points', { type: 'geojson', data: fc([]) });
    if (!map.getLayer('lm-county-choropleth')) {
      map.addLayer({ id: 'lm-county-choropleth', type: 'fill', source: 'tw-county', paint: { 'fill-color': 'rgba(0,0,0,0)', 'fill-opacity': 0.6 } }, 'tw-county-line');
    }
    if (!map.getLayer('lm-lines')) {
      map.addLayer({ id: 'lm-lines', type: 'line', source: 'lm-lines', filter: ['==', ['get', 'dashed'], 0], paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'width'], 'line-opacity': 0.75 } });
      map.addLayer({ id: 'lm-lines-dashed', type: 'line', source: 'lm-lines', filter: ['==', ['get', 'dashed'], 1], paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'width'], 'line-opacity': 0.75, 'line-dasharray': [3, 2] } });
    }
    if (!map.getLayer('lm-points')) {
      map.addLayer({
        id: 'lm-points', type: 'symbol', source: 'lm-points',
        layout: {
          'icon-image': ['get', 'icon'], 'icon-size': ['get', 'scale'],
          'icon-allow-overlap': true, 'icon-ignore-placement': true, 'symbol-sort-key': ['get', 'rank'],
        },
      });
    }
    if (!map._lmNav) { map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right'); map._lmNav = true; }
    // 備援樣式切換時 onStyleReady 會再被呼叫：資料來源要重新灌入，事件只註冊一次
    latest.current.apply?.(map);
    if (map._lmEvents) return;
    map._lmEvents = true;
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
    map.on('mouseenter', 'lm-points', (e) => {
      map.getCanvas().style.cursor = 'pointer';
      const f = e.features?.[0]; const item = f && indexRef.current[f.properties.idx];
      if (item) popup.setLngLat(f.geometry.coordinates).setHTML(`<b>${item.point.title || ''}</b>${item.point.valueLabel ? `<br/>${item.point.valueLabel}` : ''}`).addTo(map);
    });
    map.on('mouseleave', 'lm-points', () => { map.getCanvas().style.cursor = ''; popup.remove(); });
    map.on('click', 'lm-points', (e) => {
      const f = e.features?.[0]; const item = f && indexRef.current[f.properties.idx];
      if (item) setSelected({ ...item.point, layer: item.layer });
    });
    setMapReady(true);
  };

  // 資料或勾選變動 → 更新圖示與資料
  useEffect(() => {
    latest.current.apply = (map) => {
      layers.forEach((l) => ensureIcon(map, l.shape || 'circle', l.color));
      indexRef.current = data.index;
      map.getSource('lm-points')?.setData(data.points);
      map.getSource('lm-lines')?.setData(lineData);
    };
    if (mapReady && mapRef.current) latest.current.apply(mapRef.current);
  }, [mapReady, data, lineData, layers]);

  // 縣市面量圖
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !map.getLayer('lm-county-choropleth')) return;
    if (!countyFill || !counties.length) { map.setPaintProperty('lm-county-choropleth', 'fill-color', 'rgba(0,0,0,0)'); return; }
    const pairs = counties.flatMap((c) => { const col = countyFill(c.name); return col ? [c.rawName, col] : []; });
    map.setPaintProperty('lm-county-choropleth', 'fill-color', pairs.length ? ['match', ['get', 'COUNTYNAME'], ...pairs, 'rgba(0,0,0,0)'] : 'rgba(0,0,0,0)');
  }, [mapReady, countyFill, counties]);

  const toggle = (id) => setActive((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="flex flex-col gap-2 w-full">
      {(title || layers.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {title && <div className="font-bold text-slate-700 text-sm flex items-center gap-2 mr-2"><Layers size={16} className="text-slate-500" />{title}</div>}
          {layers.map((l) => {
            const on = active.has(l.id);
            return (
              <button key={l.id} type="button" onClick={() => toggle(l.id)} aria-pressed={on}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ${on ? 'bg-white border-slate-300 text-slate-700 shadow-sm' : 'bg-slate-100 border-transparent text-slate-400'}`}>
                <span style={{ opacity: on ? 1 : 0.35 }}><LegendSwatch shape={l.shape} color={l.color} /></span>
                {l.label}
                <span className="font-mono text-[10px] text-slate-400">{l.points.filter((p) => p.lat != null).length}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="relative w-full rounded-xl border border-slate-200 overflow-hidden" style={{ height }}>
        <MapLibreBase onStyleReady={onStyleReady}>
          {selected && (
            <div className="absolute top-3 left-3 z-20 w-72 max-w-[calc(100%-1.5rem)] max-h-[85%] overflow-y-auto bg-white/95 backdrop-blur rounded-xl shadow-xl border border-slate-200 p-3 text-xs">
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
          {footnote && <div className="absolute bottom-2 left-2 right-24 z-10 text-[10px] text-slate-500 bg-white/85 rounded px-2 py-1 pointer-events-none">{footnote}</div>}
        </MapLibreBase>
      </div>
    </div>
  );
}
