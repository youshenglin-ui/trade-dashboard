// MapLibre 地圖共用常數與 GeoJSON 小工具

export const TAIWAN_BOUNDS = [[119.3, 21.8], [122.3, 25.4]];
export const REGION_BOUNDS = {
  北區: [[120.9, 24.55], [122.05, 25.35]],
  中區: [[119.95, 23.5], [121.1, 24.75]],
  南區: [[119.95, 22.3], [120.95, 23.45]],
  東區: [[120.85, 22.55], [122.3, 25.0]],
};
export const LABEL_FONT = ['Noto Sans Bold'];
// g0v twgeojson 縣市界（2010），已簡化到小數 3 位（約 100m）並放在本地，避免依賴外部網址
export const COUNTY_GEOJSON_URL = '/data/tw-county.geo.json';

// 以取樣點近似貝茲曲線（經緯度空間）
export const cubicBezier = (p0, c1, c2, p1, n = 32) => Array.from({ length: n + 1 }, (_, k) => {
  const t = k / n, u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0],
    u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1],
  ];
});
export const quadBezier = (p0, c, p1, n = 24) => Array.from({ length: n + 1 }, (_, k) => {
  const t = k / n, u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]];
});

export const fc = (features) => ({ type: 'FeatureCollection', features });
export const pt = (lon, lat, properties = {}) => ({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: [Number(lon), Number(lat)] } });
export const line = (coordinates, properties = {}) => ({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates } });
export const validLL = (lon, lat) => lon != null && lat != null && !isNaN(lon) && !isNaN(lat) && Number(lon) !== 0 && Number(lat) !== 0;

// 產生方形圖示（樞紐站用）
export const addSquareIcon = (map, id, fill, size = 20, border = 2) => {
  if (map.hasImage(id)) return;
  const s = size * 2; const b = border * 2;
  const canvas = document.createElement('canvas'); canvas.width = s; canvas.height = s;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = fill; ctx.fillRect(b, b, s - 2 * b, s - 2 * b);
  map.addImage(id, ctx.getImageData(0, 0, s, s), { pixelRatio: 2 });
};
