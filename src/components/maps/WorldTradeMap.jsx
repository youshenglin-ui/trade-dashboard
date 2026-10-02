// ==========================================
// 世界貿易地圖：以台灣為中心，顯示各貿易夥伴的相對位置與往來規模
// ==========================================
// - 底圖：world-atlas 110m（打包在前端，不依賴外部圖磚），d3-geo 投影畫成 SVG。
// - 國家底色＝目前檢視的數值（出口/進口/總額：藍色深淺；順逆差：藍＝順差、紅＝逆差）。
// - 台灣到前 N 大夥伴畫大圓航線，線寬＝數值；滑過國家或航線看數值與佔比，點選可通知父元件。
// - 只吃 props：rows = [{ country, value, share }]，介面改版時可直接搬。
import React, { useMemo, useState } from 'react';
import { geoNaturalEarth1, geoPath, geoGraticule10 } from 'd3-geo';
import { feature } from 'topojson-client';
import worldTopo from 'world-atlas/countries-110m.json';
import { countryMeta, TAIWAN_LL } from '../../lib/geo/countries';
import CountryFlag from '../trade/CountryFlag';

const W = 960;
const H = 440;
const SEQ = ['#e8f0fb', '#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];
const POS = '#2a78d6';
const NEG = '#e34948';

const COUNTRIES = feature(worldTopo, worldTopo.objects.countries).features;
// 以東經 150 度為中心：台灣在畫面中間偏左，美洲在右側、歐洲在左側
// 不畫南極洲，地圖範圍貼齊有人居住的陸地，避免下方一大片空白海洋
const LAND = { type: 'FeatureCollection', features: COUNTRIES.filter((f) => f.id !== '010') };
const projection = geoNaturalEarth1().rotate([-150, 0]).fitExtent([[4, 4], [W - 4, H - 4]], LAND);
const path = geoPath(projection);
const SPHERE = path({ type: 'Sphere' });
const GRATICULE = path(geoGraticule10());

export default function WorldTradeMap({ rows, topN = 10, mode = 'positive', formatValue = (v) => v, valueLabel = '數值', onSelect, selected }) {
  const [hover, setHover] = useState(null);

  const { byNum, maxAbs, top } = useMemo(() => {
    const m = new Map();
    let mx = 0;
    rows.forEach((r) => {
      const meta = countryMeta(r.country);
      if (!meta || meta.iso2 === 'TW') return;
      mx = Math.max(mx, Math.abs(r.value));
      if (meta.isoNum != null) m.set(meta.isoNum, { ...r, meta });
    });
    const withMeta = rows.map((r) => ({ ...r, meta: countryMeta(r.country) })).filter((r) => r.meta && r.meta.iso2 !== 'TW' && r.meta.lon != null);
    return { byNum: m, maxAbs: mx, top: withMeta.slice(0, topN) };
  }, [rows, topN]);

  const fillOf = (num) => {
    const r = byNum.get(Number(num));
    if (!r || !r.value || !maxAbs) return '#f1f5f9';
    // 對數尺度：小國也看得出有往來
    const t = Math.log10(1 + Math.abs(r.value)) / Math.log10(1 + maxAbs);
    if (mode === 'diverging') {
      const op = 0.18 + 0.8 * t;
      return r.value >= 0 ? `rgba(42,120,214,${op})` : `rgba(227,73,72,${op})`;
    }
    return SEQ[Math.min(SEQ.length - 1, Math.floor(t * SEQ.length))];
  };

  const maxTop = Math.max(1, ...top.map((r) => Math.abs(r.value)));
  const arcs = top.map((r, i) => ({
    r, i,
    d: path({ type: 'LineString', coordinates: [TAIWAN_LL, [r.meta.lon, r.meta.lat]] }),
    w: 1.2 + 6 * Math.sqrt(Math.abs(r.value) / maxTop),
    end: projection([r.meta.lon, r.meta.lat]),
  }));
  const tw = projection(TAIWAN_LL);

  const show = (e, r) => {
    const box = e.currentTarget.ownerSVGElement.getBoundingClientRect();
    setHover({ r, x: e.clientX - box.left, y: e.clientY - box.top, w: box.width });
  };

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block select-none" role="img" aria-label="台灣與各貿易夥伴的世界地圖" onMouseLeave={() => setHover(null)}>
        <rect width={W} height={H} fill="#f8fbff" />
        <path d={SPHERE} fill="#f8fbff" stroke="#cbd5e1" />
        <path d={GRATICULE} fill="none" stroke="#e2e8f0" strokeWidth={0.5} />
        {LAND.features.map((f, fi) => {
          const r = byNum.get(Number(f.id));
          const isTw = Number(f.id) === 158;
          const isSel = r && selected === r.country;
          return (
            <path key={f.id ?? `x${fi}`} d={path(f)}
              fill={isTw ? '#eda100' : fillOf(f.id)}
              stroke={isSel ? '#0f172a' : '#ffffff'} strokeWidth={isSel ? 1.4 : 0.5}
              className={r ? 'cursor-pointer' : ''}
              onMouseMove={r ? (e) => show(e, r) : undefined}
              onMouseLeave={() => setHover(null)}
              onClick={r && onSelect ? () => onSelect(r.country) : undefined} />
          );
        })}
        {arcs.map(({ r, d, w, i }) => (
          <path key={`arc-${r.country}`} d={d} fill="none"
            stroke={mode === 'diverging' ? (r.value >= 0 ? POS : NEG) : '#0d366b'}
            strokeOpacity={hover && hover.r.country !== r.country ? 0.25 : 0.75}
            strokeWidth={w} strokeLinecap="round"
            className="cursor-pointer"
            onMouseMove={(e) => show(e, r)} onMouseLeave={() => setHover(null)}
            onClick={onSelect ? () => onSelect(r.country) : undefined}>
            <title>{`${i + 1}. ${r.country}`}</title>
          </path>
        ))}
        {arcs.map(({ r, end, i }) => end && (
          <g key={`pt-${r.country}`} transform={`translate(${end[0]},${end[1]})`} pointerEvents="none">
            <circle r={4} fill="#ffffff" stroke="#0d366b" strokeWidth={1.5} />
            <text x={6} y={-5} fontSize={11} fontWeight={700} fill="#0f172a" stroke="#ffffff" strokeWidth={3} paintOrder="stroke">{i + 1}. {r.country}</text>
          </g>
        ))}
        {tw && (
          <g transform={`translate(${tw[0]},${tw[1]})`} pointerEvents="none">
            <circle r={6} fill="#eda100" stroke="#ffffff" strokeWidth={2} />
            <text x={8} y={14} fontSize={12} fontWeight={800} fill="#7a5200" stroke="#ffffff" strokeWidth={3} paintOrder="stroke">台灣</text>
          </g>
        )}
      </svg>
      {hover && (
        <div className="absolute z-10 pointer-events-none bg-white/95 border border-slate-200 shadow-lg rounded-lg px-3 py-2 text-xs"
          style={{ left: Math.min(hover.x + 12, hover.w - 200), top: hover.y + 12 }}>
          <div className="font-bold text-slate-800 flex items-center gap-1.5"><CountryFlag country={hover.r.country} />{hover.r.country}</div>
          <div className="mt-1 text-slate-600">{valueLabel}：<b className="font-mono text-slate-900">{formatValue(hover.r.value)}</b></div>
          {hover.r.share != null && <div className="text-slate-600">佔比：<b className="font-mono">{(hover.r.share * 100).toFixed(1)}%</b></div>}
          {hover.r.rank != null && <div className="text-slate-400">排名第 {hover.r.rank}</div>}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-500">
        {mode === 'diverging' ? (
          <>
            <span className="flex items-center gap-1"><i className="inline-block w-3 h-3 rounded-sm" style={{ background: POS }} />順差（出口 &gt; 進口）</span>
            <span className="flex items-center gap-1"><i className="inline-block w-3 h-3 rounded-sm" style={{ background: NEG }} />逆差（進口 &gt; 出口）</span>
          </>
        ) : (
          <span className="flex items-center gap-1">少<span className="flex">{SEQ.map((c) => <i key={c} className="inline-block w-4 h-3" style={{ background: c }} />)}</span>多（對數尺度）</span>
        )}
        <span>線寬＝前 {topN} 大夥伴的{valueLabel}；<span className="inline-block w-2.5 h-2.5 rounded-full align-middle" style={{ background: '#eda100' }} /> 台灣</span>
      </div>
    </div>
  );
}
