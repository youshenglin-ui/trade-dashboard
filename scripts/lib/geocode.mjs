// 共用的 OpenStreetMap Nominatim 地址轉座標工具（每秒 1 次、免金鑰）。
// 給 geocode-energy-plants.mjs（問卷廠區）與 geocode-carbonfee.mjs（碳費事業）共用。

export const UA = 'trade-dashboard-geocoder/1.0 (https://github.com/youshenglin-ui/trade-dashboard)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function nominatim(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=tw&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'zh-TW' } });
  await sleep(1100);
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const [hit] = await res.json();
  return hit ? { lat: Number(hit.lat), lon: Number(hit.lon), label: hit.display_name } : null;
}

// 地址清洗：取第一段地址（去掉括號補充、頓號後的第二地址），再產生逐步放寬的候選
//   完整門牌 → 路名 → 行政區，對應 coord_source：geocode_address / geocode_road / geocode_area
export function candidates(address) {
  if (!address) return [];
  let a = String(address).replace(/[（(][^）)]*[）)]/g, '').split(/[、；;]/)[0].trim();
  a = a.replace(/^.*工廠登記\(總公司\)：/, '');
  const out = [['geocode_address', a]];
  // 門牌後面的樓層、「及地下…」等補充會讓 Nominatim 找不到
  const house = a.match(/^(.+?\d+(?:之\d+)?號)/);
  if (house && house[1] !== a) out.push(['geocode_address', house[1]]);
  const road = a.match(/^(.+?[縣市].+?[區鄉鎮市])(?:.+?[村里])?(?:\d+鄰)?(.+?(?:路|街|大道)(?:[一二三四五六七八九十]+段)?)/);
  if (road) out.push(['geocode_road', `${road[1]}${road[2]}`]);
  const area = a.match(/^(.+?[縣市].+?[區鄉鎮市])/);
  if (area) out.push(['geocode_area', area[1]]);
  return out;
}

export async function geocodeAddress(address) {
  for (const [source, q] of candidates(address)) {
    const hit = await nominatim(q);
    if (hit) return { lat: hit.lat, lon: hit.lon, coord_source: source, query: q, matched: hit.label };
  }
  return null;
}

export function parseCsv(text) {
  const [head, ...lines] = text.trim().split('\n');
  const cols = head.split(',');
  return lines.map((l) => {
    const vals = l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((v) => v.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"'));
    return Object.fromEntries(cols.map((c, i) => [c, vals[i] ?? '']));
  });
}

export const csvCell = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
