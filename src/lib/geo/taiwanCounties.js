// 台灣縣市界（本地簡化版 public/data/tw-county.geo.json，與 MapLibre 底圖共用同一份檔案）與縣市中心點。
// 用途：只有縣市、沒有座標的資料（例如碳費參與事業）放在縣市中心示意，以及縣市面量圖的名稱比對。
import { useEffect, useState } from 'react';
import { COUNTY_GEOJSON_URL } from '../../components/map/mapUtils';

// 縣市名稱正規化：臺→台、桃園市/桃園縣 視為同一個（縣市界是 2010 年版）
export const normalizeCounty = (name) => String(name || '').trim().replace(/臺/g, '台').replace(/^桃園[市縣]$/, '桃園');

let countiesPromise = null;
export function loadTaiwanCounties() {
  if (!countiesPromise) {
    countiesPromise = fetch(COUNTY_GEOJSON_URL)
      .then((r) => r.json())
      .then((geo) => geo.features.map((f) => {
        // 以最大的一塊多邊形頂點平均當中心點（離島不影響本島縣市）
        let best = null;
        const g = f.geometry;
        const rings = g.type === 'Polygon' ? [g.coordinates[0]] : g.coordinates.map((poly) => poly[0]);
        rings.forEach((ring) => { if (!best || ring.length > best.length) best = ring; });
        const n = best?.length || 1;
        return {
          rawName: f.properties.COUNTYNAME,
          name: normalizeCounty(f.properties.COUNTYNAME),
          centroid: best ? { lon: best.reduce((s, c) => s + c[0], 0) / n, lat: best.reduce((s, c) => s + c[1], 0) / n } : null,
        };
      }))
      .catch((e) => { countiesPromise = null; throw e; });
  }
  return countiesPromise;
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

// 縣市中心點（找不到回傳 null）；名稱比對容忍「高雄市/高雄」「桃園市/桃園縣」「臺/台」
export function countyCentroid(counties, name) {
  const n = normalizeCounty(name);
  if (!n) return null;
  const hit = counties.find((c) => c.name === n) || counties.find((c) => c.name.slice(0, 2) === n.slice(0, 2));
  return hit?.centroid || null;
}
