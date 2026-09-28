// 台灣縣市底圖（g0v twgeojson 2010 版）載入、投影與縣市中心點。
// 地圖元件（components/maps/TaiwanLayerMap.jsx、CCUS 規劃地圖）共用同一份快取，只下載一次。
import { useEffect, useState } from 'react';

const GEO_URL = 'https://raw.githubusercontent.com/g0v/twgeojson/master/json/twCounty2010.geo.json';
const CENTER = { lon: 120.9, lat: 23.7 };
const SCALE = 400;

export const project = (lon, lat) => [(lon - CENTER.lon) * SCALE, -(lat - CENTER.lat) * SCALE * 1.1];

// 縣市名稱正規化：臺→台、桃園市/桃園縣 視為同一個（底圖是 2010 年版）
export const normalizeCounty = (name) => String(name || '').trim().replace(/臺/g, '台').replace(/^桃園[市縣]$/, '桃園');

let geoPromise = null;
export function loadTaiwanCounties() {
  if (!geoPromise) {
    geoPromise = fetch(GEO_URL)
      .then((r) => r.json())
      .then((geo) => geo.features.map((f) => {
        let d = '';
        let best = null;
        const ring = (coords) => {
          if (!coords?.length) return;
          coords.forEach(([lon, lat], i) => {
            const [x, y] = project(lon, lat);
            d += `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)} `;
          });
          d += 'Z ';
          if (!best || coords.length > best.length) best = coords;
        };
        const g = f.geometry;
        if (g.type === 'Polygon') g.coordinates.forEach(ring);
        else if (g.type === 'MultiPolygon') g.coordinates.forEach((poly) => poly.forEach(ring));
        const n = best?.length || 1;
        const centroid = best ? { lon: best.reduce((s, c) => s + c[0], 0) / n, lat: best.reduce((s, c) => s + c[1], 0) / n } : null;
        return { name: normalizeCounty(f.properties.COUNTYNAME), d, centroid };
      }))
      .catch((e) => { geoPromise = null; throw e; });
  }
  return geoPromise;
}

export function useTaiwanCounties() {
  const [counties, setCounties] = useState([]);
  useEffect(() => {
    let alive = true;
    loadTaiwanCounties().then((c) => alive && setCounties(c)).catch(() => {});
    return () => { alive = false; };
  }, []);
  return counties;
}

// 縣市中心點（找不到回傳 null）；名稱比對用前兩個字，容忍「高雄市/高雄」「桃園市/桃園縣」
export function countyCentroid(counties, name) {
  const n = normalizeCounty(name);
  if (!n) return null;
  const hit = counties.find((c) => c.name === n) || counties.find((c) => c.name.slice(0, 2) === n.slice(0, 2));
  return hit?.centroid || null;
}
