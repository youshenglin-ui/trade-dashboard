// ==========================================
// MapLibre GL 共用底圖（CCUS / 氫能地圖共用）
// - 底圖：OpenFreeMap positron 向量圖磚（免金鑰）。樣式 JSON 由我們自己抓（有逾時），
//   抓不到就改用「純色底 + 縣市界」備援樣式，地圖資料照常顯示。
// - 字型：中文由瀏覽器本機字型繪製（localIdeographFontFamily）；拉丁字元的 glyph 檔放在
//   public/fonts（只放 0-255、標點、全形區段），不依賴外部字型伺服器——外部請求若卡住，
//   MapLibre 會一直等 glyph 而整層標籤／圖層畫不出來。
// - maplibre-gl 以動態 import 載入，不影響其他模組的首屏大小
// ==========================================
import React, { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { TAIWAN_BOUNDS, COUNTY_GEOJSON_URL } from './mapUtils';

const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
const STYLE_TIMEOUT = 6000;   // 樣式 JSON 逾時（毫秒）
const TILE_TIMEOUT = 8000;    // 圖磚遲遲載不完時，改用縣市面當陸地
const LOAD_TIMEOUT = 10000;   // 樣式建立後仍未載入完成，改用備援樣式
const localGlyphs = () => `${window.location.origin}/fonts/{fontstack}/{range}.pbf`;

const fallbackStyle = () => ({
  version: 8,
  glyphs: localGlyphs(),
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e8eef3' } }],
});

// 底圖在地化：地名只顯示中文，並隱藏道路名、路牌、機場等與戰情無關的標籤
const tuneBasemapStyle = (style) => {
  const zhName = ['coalesce', ['get', 'name:zh-Hant'], ['get', 'name:zh'], ['get', 'name']];
  style.glyphs = localGlyphs();
  // 不載入圖示集（sprite）：只有路牌、機場與城市旁的小圓點用到，而 sprite 卡住會讓整份樣式無法完成載入
  delete style.sprite;
  style.layers.forEach((layer) => {
    if (layer.type !== 'symbol') return;
    layer.layout = layer.layout || {};
    delete layer.layout['icon-image'];
    if (/^(highway|road|airport|label_other|label_village)/.test(layer.id)) layer.layout.visibility = 'none';
    else if (/^(label_|water_name|place)/.test(layer.id)) layer.layout['text-field'] = zhName;
  });
  return style;
};

const loadBasemapStyle = async () => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), STYLE_TIMEOUT);
  try {
    const res = await fetch(BASEMAP_STYLE, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return tuneBasemapStyle(await res.json());
  } catch (err) {
    console.warn('底圖樣式載入失敗，改用備援樣式：', err?.message || err);
    return null;
  } finally {
    clearTimeout(timer);
  }
};

// 縣市界線（備援樣式時當作陸地，正常樣式時只畫細界線；countyFill 可傳入 MapLibre 顏色運算式）
const addCountyLayers = (map, { countyFill, fallback }) => {
  if (!map.getSource('tw-county')) map.addSource('tw-county', { type: 'geojson', data: COUNTY_GEOJSON_URL });
  // 放在底圖第一個文字圖層之下，才不會蓋住地名
  const beforeId = map.getStyle().layers.find(l => l.type === 'symbol')?.id;
  if (!map.getLayer('tw-county-fill')) {
    map.addLayer({
      id: 'tw-county-fill', type: 'fill', source: 'tw-county',
      paint: { 'fill-color': countyFill || '#f8fafc', 'fill-opacity': countyFill ? 0.55 : (fallback ? 1 : 0) },
    }, beforeId);
  }
  if (!map.getLayer('tw-county-line')) {
    map.addLayer({ id: 'tw-county-line', type: 'line', source: 'tw-county', paint: { 'line-color': '#94a3b8', 'line-width': 0.8, 'line-opacity': fallback ? 0.9 : 0.5 } }, beforeId);
  }
};

// 圖磚抓不到（或一直沒回應）時，把縣市面改成不透明當陸地，確保仍看得到台灣輪廓
const showCountyAsLand = (map, countyFill) => {
  if (!map.getLayer('tw-county-fill')) return;
  if (!countyFill) map.setPaintProperty('tw-county-fill', 'fill-opacity', 1);
  map.setPaintProperty('tw-county-line', 'line-opacity', 0.9);
};

/**
 * @param {(map, maplibregl) => void} onStyleReady 樣式載入完成時呼叫，在此加入資料圖層與事件
 * @param countyFill 縣市底色運算式（氫能地圖用來顯示北中南東分區）；只在建立地圖時套用
 */
export default function MapLibreBase({ onStyleReady, countyFill, className = '', children }) {
  const containerRef = useRef(null);
  const onReadyRef = useRef(onStyleReady);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => { onReadyRef.current = onStyleReady; }, [onStyleReady]);

  useEffect(() => {
    let cancelled = false; let map; const cleanupTimers = [];
    Promise.all([import('maplibre-gl'), loadBasemapStyle()]).then(([{ default: maplibregl }, basemap]) => {
      if (cancelled || !containerRef.current) return;
      const fallback = !basemap;
      try {
        map = new maplibregl.Map({
          container: containerRef.current,
          style: basemap || fallbackStyle(),
          bounds: TAIWAN_BOUNDS,
          fitBoundsOptions: { padding: 16 },
          minZoom: 5, maxZoom: 14,
          dragRotate: false, pitchWithRotate: false, touchPitch: false,
          attributionControl: { compact: true },
          localIdeographFontFamily: "'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif",
          canvasContextAttributes: { preserveDrawingBuffer: true },
        });
      } catch (err) {
        console.error(err); setFailed(true); return;
      }
      map.touchZoomRotate.disableRotation();
      map.keyboard.disableRotation();

      let fellBack = fallback;
      const loadTimer = setTimeout(() => {
        if (cancelled || fellBack || map.isStyleLoaded()) return;
        console.warn('底圖樣式逾時，改用備援樣式');
        fellBack = true; map.setStyle(fallbackStyle(), { diff: false });
      }, LOAD_TIMEOUT);
      cleanupTimers.push(loadTimer);

      map.on('error', (e) => {
        const id = e?.sourceId || '';
        if (id && id !== 'tw-county' && !id.startsWith('ccus-') && !id.startsWith('h2-')) showCountyAsLand(map, countyFill);
        else console.warn('地圖錯誤：', e?.error?.message || e);
      });
      map.on('style.load', () => {
        addCountyLayers(map, { countyFill, fallback: fellBack });
        onReadyRef.current?.(map, maplibregl);
        setReady(true);
        if (!fellBack) {
          cleanupTimers.push(setTimeout(() => {
            const src = Object.keys(map.getStyle().sources).find(id => map.getSource(id)?.type === 'vector');
            if (src && !map.isSourceLoaded(src)) showCountyAsLand(map, countyFill);
          }, TILE_TIMEOUT));
        }
      });
    }).catch((err) => { console.error(err); setFailed(true); });

    return () => { cancelled = true; cleanupTimers.forEach(clearTimeout); if (map) map.remove(); };
  // countyFill 只在建立地圖時套用
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* maplibre-gl.css 會把容器設為 position: relative，這裡用行內樣式確保撐滿 */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {!ready && !failed && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400 pointer-events-none">地圖載入中…</div>
      )}
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500 bg-slate-50">
          此瀏覽器無法顯示互動地圖（需要 WebGL）
        </div>
      )}
      {children}
    </div>
  );
}
