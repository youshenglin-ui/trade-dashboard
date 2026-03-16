import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ScatterChart, Scatter, ZAxis, Cell, LabelList, ComposedChart, Line, PieChart, Pie
} from 'recharts';
import { 
  Leaf, RefreshCw, Target, Activity, MapPin, DollarSign, Box, AlertTriangle, 
  Truck, Ship, GripHorizontal, FlaskConical, Plus, ZoomIn, ZoomOut, Maximize, Factory, List, Rocket, Map, Route, Anchor, Layers, Filter, PieChart as PieChartIcon, DownloadCloud, Copy, Trash2
} from 'lucide-react';

const CCUS_DATA_SOURCES = {
  CAPTURE: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ8aZTek-9SoTaK7Z_Wu9InU2c_vu4cUpD0Nn4fCs-w0IM3XoWeNXK5ZldWoEs6M3G6mJTS6QoF4Mo/pub?gid=388581449&single=true&output=csv',
  UTILIZATION: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ8aZTek-9SoTaK7Z_Wu9InU2c_vu4cUpD0Nn4fCs-w0IM3XoWeNXK5ZldWoEs6M3G6mJTS6QoF4Mo/pub?gid=1496771601&single=true&output=csv',
  STORAGE: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ8aZTek-9SoTaK7Z_Wu9InU2c_vu4cUpD0Nn4fCs-w0IM3XoWeNXK5ZldWoEs6M3G6mJTS6QoF4Mo/pub?gid=1902888591&single=true&output=csv',
  SCOPE1_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ8aZTek-9SoTaK7Z_Wu9InU2c_vu4cUpD0Nn4fCs-w0IM3XoWeNXK5ZldWoEs6M3G6mJTS6QoF4Mo/pub?gid=2122803569&single=true&output=csv'
};

const cleanNumber = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isFinite(val) ? val : 0;
  const str = String(val).trim();
  if (str === '-' || str === '－') return 0; 
  const num = parseFloat(str.replace(/[,%\s]/g, ''));
  return isFinite(num) ? num : 0;
};

export const simplifyCompanyName = (name) => {
  if (!name) return '';
  let n = name.trim().replace(/股份有限公司|工業|企業|分公司/g, '').trim();
  const mapping = {
      '臺灣化學纖維': '台化', '台灣化學纖維': '台化', '台化': '台化',
      '臺灣苯乙烯': '台苯', '台灣苯乙烯': '台苯', '台苯': '台苯',
      '中國石油化學': '中石化', '中石化': '中石化',
      '臺灣中油': '中油', '台灣中油': '中油', '中油': '中油',
      '臺塑石化': '台塑化', '台塑石化': '台塑化', '台塑化': '台塑化',
      '臺灣積體電路製造': '台積電', '台灣積體電路製造': '台積電', '台積電': '台積電',
      '中國鋼鐵': '中鋼', '中鋼': '中鋼',
      '長春人造樹脂': '長春樹脂', '長春石油化學': '長春石化',
      '大連化學工業': '大連化學', '李長榮化學工業': '李長榮', '國喬石油化學': '國喬',
      '南亞塑膠工業': '南亞塑膠', '臺鹽實業': '台鹽', '台鹽實業': '台鹽',
      '台灣電力': '台電', '臺灣電力': '台電'
  };
  for (const [full, short] of Object.entries(mapping)) {
      if (n.includes(full)) return short;
  }
  return n;
};

const stringToColor = (str) => {
    const COLORS_POOL = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#0284c7', '#0d9488', '#ea580c', '#9333ea', '#e11d48'];
    if (!str) return COLORS_POOL[0];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = String(str).charCodeAt(i) + ((hash << 5) - hash);
    return COLORS_POOL[Math.abs(hash) % COLORS_POOL.length];
};

const parseCSV = (text) => {
    if (!text || text.includes('<!DOCTYPE html>')) return [];
    const result = []; let row = []; let current = ''; let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i], nextChar = text[i + 1];
        if (char === '"') {
            if (inQuotes && nextChar === '"') { current += '"'; i++; } 
            else { inQuotes = !inQuotes; }
        } else if (char === ',' && !inQuotes) { row.push(current.trim()); current = '';
        } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
            if (char === '\r') i++; 
            row.push(current.trim()); result.push(row); row = []; current = '';
        } else { current += char; }
    }
    if (current || row.length > 0) { row.push(current.trim()); result.push(row); }
    if (result.length < 2) return [];
    const headers = result[0].map(h => h.replace(/^[\uFEFF\s]+|[\s]+$/g, ''));
    return result.slice(1).map(rowArray => {
        const obj = {}; headers.forEach((h, i) => { obj[h] = rowArray[i] !== undefined ? rowArray[i] : ''; }); return obj;
    });
};

const calcDistanceKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; 
    const dLat = (Number(lat2) - Number(lat1)) * Math.PI / 180; 
    const dLon = (Number(lon2) - Number(lon1)) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(Number(lat1) * Math.PI / 180) * Math.cos(Number(lat2) * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
};

const estimateRoutingDistance = (lat1, lon1, lat2, lon2, isSeaRoute = false) => {
    const straightDistance = calcDistanceKm(lat1, lon1, lat2, lon2);
    return straightDistance * (isSeaRoute ? 1.1 : 1.3);
};

const getRefinedRegion = (plantName, companyName, county) => {
    const p = String(plantName || '').trim(); const c = String(companyName || '').trim(); const cty = String(county || '').trim();
    const full = `${c} ${p} ${cty}`;
    if (c.includes('奇美')) return '南區';
    if (full.includes('聚酯')) return '南區';
    if (full.match(/(台北|臺北|新北|桃園|新竹|基隆)/)) return '北區';
    if (full.match(/(苗栗|台中|臺中|彰化|雲林|南投|嘉義)/)) return '中區';
    if (full.match(/(台南|臺南|高雄|屏東|台東|臺東)/)) return '南區';
    if (full.match(/(宜蘭|花蓮)/)) return '東區';
    if (c.includes('台鹽') || c.includes('臺鹽') || p.includes('通霄')) return '中區';
    return '其他';
};

const getIndustrialZone = (plant, company, county) => {
    const p = String(plant || '').trim(); const c = String(company || '').trim(); const cty = String(county || '').trim();
    const full = `${c} ${p}`;
    if (c.includes('台化') && p.includes('台北')) return '雲林-麥寮工業區';
    if (c.includes('台灣化纖') || c.includes('台化') || c.includes('台塑科騰') || full.includes('麥寮') || full.includes('六輕')) return '雲林-麥寮工業區';
    if (c.includes('台灣石化') || full.includes('大發')) return '高雄-大發工業區';
    if ((c.includes('台苯') || c.includes('台灣苯乙烯')) && p.includes('高雄')) return '高雄-林園工業區';
    if (c.includes('李長榮') && p.includes('高雄')) return '高雄-小港工業區';
    if (c.includes('國喬') && p.includes('高雄')) return '高雄-仁武工業區';
    if (full.includes('林園') || full.includes('大林') || (c.includes('中油') && p.includes('石化'))) return '高雄-林園工業區';
    if (full.includes('小港') || full.includes('臨海') || full.includes('中鋼')) return '高雄-小港工業區';
    if (full.includes('仁武') || full.includes('大社')) return '高雄-仁武工業區';
    if (full.includes('彰濱') || full.includes('線西') || full.includes('中龍')) return '彰化-彰濱工業區';
    if (full.includes('桃園') || p.includes('桃煉') || full.includes('觀音') || full.includes('工三')) return '桃園工業區';
    if (c.includes('台鹽') || c.includes('臺鹽') || p.includes('通霄')) return '苗栗-通霄工業聚落';
    if (p.includes('頭份') || (c.includes('長春') && p.includes('苗栗'))) return '苗栗-頭份工業區';
    if (full.includes('南科') || full.includes('台積電') || p.includes('18廠')) return '台南-南部科學園區';
    if (cty && cty !== '未知') return `${cty}工業聚落`;
    return `${c}_${p}_獨立廠區`;
};

const getApproximateCoordinates = (plant, company, county) => {
    const n = `${String(company || '')} ${String(plant || '')}`; const cty = String(county || '');
    const pseudoRandom = (seed) => {
        let h = 0; for(let i=0; i<seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
        return ((Math.abs(h) % 1000) / 1000 - 0.5) * 0.05; 
    };
    const offsetLat = pseudoRandom(n + "lat"); const offsetLon = pseudoRandom(n + "lon");

    // 精準定位大型企業與電廠
    if (n.includes('奇美')) return { lat: 22.934 + offsetLat, lon: 120.254 + offsetLon };
    if (n.includes('聚酯')) return { lat: 22.62 + offsetLat, lon: 120.31 + offsetLon };

    if (company?.includes('台電') || n.includes('發電廠')) {
        if (n.includes('台中') || n.includes('臺中')) return { lat: 24.21 + offsetLat, lon: 120.48 + offsetLon };
        if (n.includes('興達')) return { lat: 22.85 + offsetLat, lon: 120.19 + offsetLon };
        if (n.includes('大林')) return { lat: 22.53 + offsetLat, lon: 120.33 + offsetLon };
        if (n.includes('林口')) return { lat: 25.12 + offsetLat, lon: 121.29 + offsetLon };
        if (n.includes('大潭')) return { lat: 25.03 + offsetLat, lon: 121.04 + offsetLon };
        if (n.includes('通霄')) return { lat: 24.49 + offsetLat, lon: 120.66 + offsetLon };
        if (n.includes('南部')) return { lat: 22.54 + offsetLat, lon: 120.30 + offsetLon };
        if (n.includes('協和')) return { lat: 25.15 + offsetLat, lon: 121.74 + offsetLon };
        if (n.includes('和平')) return { lat: 24.30 + offsetLat, lon: 121.75 + offsetLon };
    }

    if (company?.includes('台鹽') || company?.includes('臺鹽') || plant?.includes('通霄')) {
        if (cty.includes('台南')) return { lat: 23.14 + offsetLat, lon: 120.10 + offsetLon };
        return { lat: 24.54 + offsetLat, lon: 120.67 + offsetLon }; 
    }
    if (company?.includes('台化') && plant?.includes('台北')) return { lat: 23.78 + offsetLat, lon: 120.18 + offsetLon };
    if (company?.includes('台塑科騰')) return { lat: 23.783 + offsetLat, lon: 120.179 + offsetLon };
    if (company?.includes('李長榮') && plant?.includes('高雄')) return { lat: 22.538 + offsetLat, lon: 120.343 + offsetLon }; 
    if ((company?.includes('台苯') || company?.includes('台灣苯乙烯')) && plant?.includes('高雄')) return { lat: 22.493 + offsetLat, lon: 120.382 + offsetLon }; 
    if (n.includes('大發') || company?.includes('台灣石化')) return { lat: 22.58 + offsetLat, lon: 120.40 + offsetLon };
    if (n.includes('林園') || n.includes('大林') || n.includes('石化事業部') || n.includes('台灣苯乙烯')) return { lat: 22.51 + offsetLat, lon: 120.38 + offsetLon };
    if (n.includes('小港') || n.includes('中鋼') || n.includes('臨海') || company?.includes('李長榮')) return { lat: 22.54 + offsetLat, lon: 120.34 + offsetLon };
    if (n.includes('仁武') || n.includes('大社') || n.includes('國喬')) return { lat: 22.70 + offsetLat, lon: 120.34 + offsetLon };
    if (n.includes('南科') || n.includes('台積電') || n.includes('善化')) return { lat: 23.10 + offsetLat, lon: 120.27 + offsetLon };
    if (n.includes('麥寮') || n.includes('六輕') || company?.includes('台灣化纖') || company?.includes('台化')) return { lat: 23.78 + offsetLat, lon: 120.18 + offsetLon };
    if (n.includes('彰濱') || n.includes('線西') || n.includes('中龍')) return { lat: 24.07 + offsetLat, lon: 120.42 + offsetLon };
    if (n.includes('苗栗二') || n.includes('二廠')) return { lat: 24.58 + offsetLat, lon: 120.82 + offsetLon }; 
    if (n.includes('頭份') || n.includes('長春') || n.includes('苗栗')) return { lat: 24.68 + offsetLat, lon: 120.91 + offsetLon };
    if (n.includes('桃園') || n.includes('觀音') || n.includes('桃煉') || n.includes('工三')) return { lat: 25.03 + offsetLat, lon: 121.12 + offsetLon };
    
    if (cty.includes('基隆')) return { lat: 25.13 + offsetLat, lon: 121.74 + offsetLon };
    if (cty.includes('台北') || cty.includes('新北')) return { lat: 25.03 + offsetLat, lon: 121.45 + offsetLon };
    if (cty.includes('桃園')) return { lat: 24.95 + offsetLat, lon: 121.20 + offsetLon };
    if (cty.includes('新竹')) return { lat: 24.82 + offsetLat, lon: 121.01 + offsetLon };
    if (cty.includes('苗栗')) return { lat: 24.56 + offsetLat, lon: 120.82 + offsetLon };
    if (cty.includes('台中')) return { lat: 24.14 + offsetLat, lon: 120.67 + offsetLon };
    if (cty.includes('彰化')) return { lat: 24.05 + offsetLat, lon: 120.54 + offsetLon };
    if (cty.includes('南投')) return { lat: 23.90 + offsetLat, lon: 120.99 + offsetLon };
    if (cty.includes('雲林')) return { lat: 23.70 + offsetLat, lon: 120.43 + offsetLon };
    if (cty.includes('嘉義')) return { lat: 23.48 + offsetLat, lon: 120.45 + offsetLon };
    if (cty.includes('台南')) return { lat: 23.11 + offsetLat, lon: 120.28 + offsetLon };
    if (cty.includes('高雄')) return { lat: 22.62 + offsetLat, lon: 120.31 + offsetLon };
    if (cty.includes('屏東')) return { lat: 22.67 + offsetLat, lon: 120.48 + offsetLon };
    if (cty.includes('宜蘭')) return { lat: 24.70 + offsetLat, lon: 121.75 + offsetLon };
    if (cty.includes('花蓮')) return { lat: 23.98 + offsetLat, lon: 121.60 + offsetLon };
    if (cty.includes('台東')) return { lat: 22.75 + offsetLat, lon: 121.14 + offsetLon };
    
    return { lat: 23.6 + offsetLat, lon: 119.9 + offsetLon }; 
};

// 封存與接收樞紐預設設定
const INITIAL_CCS_HUBS = {
    'NORTH_HUB': { id: 'NORTH_HUB', name: '台北港/林口 (陸地轉海域)', type: '🛢️ 本土外海封存', lat: 25.14, lon: 121.32, region: '北區' },
    'CENTRAL_HUB_1': { id: 'CENTRAL_HUB_1', name: '台中港接收站 (陸地轉海域)', type: '🛢️ 本土外海封存', lat: 24.25, lon: 120.45, region: '中區' },
    'CENTRAL_HUB_2': { id: 'CENTRAL_HUB_2', name: '麥寮外海 (陸地轉海域)', type: '🛢️ 本土外海封存', lat: 23.80, lon: 120.10, region: '中區' },
    'CENTRAL_HUB_LAND': { id: 'CENTRAL_HUB_LAND', name: '苗栗鐵砧山 (陸地封存)', type: '⛰️ 陸地封存場域', lat: 24.45, lon: 120.68, region: '中區' }, 
    'SOUTH_HUB': { id: 'SOUTH_HUB', name: '高雄港接收站 (輸出轉運)', type: '🚢 港口接收轉運', lat: 22.55, lon: 120.32, region: '南區' },
    'EAST_HUB': { id: 'EAST_HUB', name: '花蓮港接收站 (輸出北送)', type: '🚢 港口接收轉運', lat: 23.98, lon: 121.62, region: '東區' },
    'SOUTHEAST_HUB': { id: 'SOUTHEAST_HUB', name: '台東接收站 (南迴轉運)', type: '🚢 港口接收轉運', lat: 22.75, lon: 121.15, region: '南區' } 
};

// 所有中繼站統一視為管線節點 (自由編輯與增刪)
const INITIAL_CLUSTERS = {
    'C_KEE_PORT': { id: 'C_KEE_PORT', name: '基隆港轉運站', lat: 25.15, lon: 121.74, next: 'NORTH_HUB', type: 'sea' },
    'C_TPE': { id: 'C_TPE', name: '北北基聚落', lat: 25.05, lon: 121.45, next: 'NORTH_HUB', type: 'land' },
    'C_TYN_IN': { id: 'C_TYN_IN', name: '桃園內陸聚落', lat: 24.95, lon: 121.25, next: 'C_TYN_COAST', type: 'land' },
    'C_TYN_COAST': { id: 'C_TYN_COAST', name: '桃園沿海聚落', lat: 25.05, lon: 121.10, next: 'NORTH_HUB', type: 'land' },
    'C_HSZ': { id: 'C_HSZ', name: '新竹聚落', lat: 24.80, lon: 121.00, next: 'C_TYN_IN', type: 'land' },
    'C_MIA': { id: 'C_MIA', name: '苗栗聚落', lat: 24.55, lon: 120.80, next: 'CENTRAL_HUB_LAND', type: 'land' },
    'C_TXG': { id: 'C_TXG', name: '台中聚落', lat: 24.20, lon: 120.60, next: 'CENTRAL_HUB_1', type: 'land' },
    'C_CHW_N': { id: 'C_CHW_N', name: '彰北聚落', lat: 24.10, lon: 120.45, next: 'CENTRAL_HUB_1', type: 'land' },
    'C_CHW_S': { id: 'C_CHW_S', name: '彰南聚落', lat: 23.95, lon: 120.35, next: 'CENTRAL_HUB_2', type: 'land' }, 
    'C_YUN_IN': { id: 'C_YUN_IN', name: '雲林內陸聚落', lat: 23.75, lon: 120.45, next: 'CENTRAL_HUB_2', type: 'land' },
    'C_CYI': { id: 'C_CYI', name: '嘉義聚落', lat: 23.45, lon: 120.30, next: 'C_YUN_IN', type: 'land' },
    'C_TNN': { id: 'C_TNN', name: '台南聚落', lat: 23.10, lon: 120.25, next: 'C_KHH_N', type: 'land' },
    'C_KHH_IN': { id: 'C_KHH_IN', name: '高雄內陸(大樹等)', lat: 22.70, lon: 120.40, next: 'C_KHH_N', type: 'land' },
    'C_KHH_N': { id: 'C_KHH_N', name: '北高雄(仁武大社)', lat: 22.72, lon: 120.35, next: 'SOUTH_HUB', type: 'land' },
    'C_KHH_S': { id: 'C_KHH_S', name: '南高雄(林園大發)', lat: 22.53, lon: 120.38, next: 'SOUTH_HUB', type: 'land' },
    'C_PTG': { id: 'C_PTG', name: '屏東聚落', lat: 22.50, lon: 120.45, next: 'C_KHH_S', type: 'land' },
    'C_YIL': { id: 'C_YIL', name: '宜蘭聚落', lat: 24.70, lon: 121.75, next: 'NORTH_HUB', type: 'sea' }, 
    'C_HUA': { id: 'C_HUA', name: '花蓮聚落', lat: 23.98, lon: 121.60, next: 'C_KEE_PORT', type: 'sea' }, 
    'C_TTT': { id: 'C_TTT', name: '台東聚落', lat: 22.75, lon: 121.14, next: 'SOUTH_HUB', type: 'sea' } 
};

class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { hasError: false }; }
    static getDerivedStateFromError(error) { return { hasError: true }; }
    render() {
      if (this.state.hasError) return <div className="h-full flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded text-slate-400 min-h-[250px]"><AlertTriangle size={32} className="mb-2 text-amber-400" /><p className="text-sm">圖表資料異常，請檢查資料來源格式</p></div>;
      return this.props.children;
    }
}

const MAP_CONSTANTS = { baseWidth: 800, baseHeight: 900, centerLon: 120.9, centerLat: 23.7, baseScale: 400 };
export const projectBase = (lon, lat) => {
    if (lon == null || lat == null || isNaN(lon) || isNaN(lat)) return [-9999, -9999]; 
    return [(lon - MAP_CONSTANTS.centerLon) * MAP_CONSTANTS.baseScale, -(lat - MAP_CONSTANTS.centerLat) * MAP_CONSTANTS.baseScale * 1.1];
};

const distToSegment = (px, py, x1, y1, x2, y2) => {
    const l2 = (x1 - x2) ** 2 + (y1 - y2) ** 2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
};

// ==========================================
// 台灣地圖核心模組 (優化視覺尺度與操作靈敏度)
// ==========================================
const TaiwanCcusMap = ({ activeLayers = [], captureData = [], utilData = [], storageData = [], scope1Data = [], mapPaths = [], ccsTopology = null, hubs, setHubs, clusters, setClusters, routeNodes, setRouteNodes, seaControlPoints, setSeaControlPoints }) => {
    const mapRef = useRef(null); const containerRef = useRef(null); 
    const [zoom, setZoom] = useState(1); const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false); const [dragState, setDragState] = useState(null); 
    const [lastPos, setLastPos] = useState({ x: 0, y: 0 }); const [hoveredNode, setHoveredNode] = useState(null);
    
    // 專屬節點操作選單 (優化尺寸與視覺)
    const [nodeMenu, setNodeMenu] = useState(null);

    const { baseWidth, baseHeight } = MAP_CONSTANTS;

    const getLonLatFromEvent = (e) => {
        const svg = mapRef.current;
        if (!svg) return null;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        const g = svg.querySelector('g.map-content-group');
        if (!g) return null;
        const globalPoint = pt.matrixTransform(g.getScreenCTM().inverse());
        const lon = globalPoint.x / MAP_CONSTANTS.baseScale + MAP_CONSTANTS.centerLon;
        const lat = -(globalPoint.y / (MAP_CONSTANTS.baseScale * 1.1)) + MAP_CONSTANTS.centerLat;
        return { lon, lat, x: globalPoint.x, y: globalPoint.y };
    };

    const handleMouseDown = (e) => { 
        if (nodeMenu) setNodeMenu(null); 
        setIsDragging(true); setLastPos({ x: e.clientX, y: e.clientY }); 
    };
    
    const handlePathClick = (e, routeId, currentNodes) => {
        if (!activeLayers.includes('planning') || !setRouteNodes) return;
        e.stopPropagation();
        
        const coords = getLonLatFromEvent(e);
        if (!coords) return;
        
        let minDist = Infinity;
        let insertIdx = 1;
        for (let i = 0; i < currentNodes.length - 1; i++) {
            const [x1, y1] = projectBase(currentNodes[i].lon, currentNodes[i].lat);
            const [x2, y2] = projectBase(currentNodes[i+1].lon, currentNodes[i+1].lat);
            const dist = distToSegment(coords.x, coords.y, x1, y1, x2, y2);
            if (dist < minDist) {
                minDist = dist;
                insertIdx = i + 1;
            }
        }
        
        setRouteNodes(prev => {
            const newRoutes = { ...prev };
            const nodes = [...(newRoutes[routeId] || currentNodes)];
            nodes.splice(insertIdx, 0, { lat: coords.lat, lon: coords.lon });
            return { ...prev, [routeId]: nodes };
        });
    };

    const handleNodeContextMenu = (e, routeId, nodeIndex) => {
        if (!activeLayers.includes('planning') || !setRouteNodes) return;
        e.preventDefault(); e.stopPropagation();
        setRouteNodes(prev => {
            const currentNodes = prev[routeId];
            if (!currentNodes || currentNodes.length <= 3) return prev; 
            const newNodes = [...currentNodes];
            newNodes.splice(nodeIndex, 1);
            return { ...prev, [routeId]: newNodes };
        });
    };

    const handleNodeMouseDown = (e, id, type, extraId) => {
        if (!activeLayers.includes('planning')) return;
        e.stopPropagation();
        if (e.button === 2) return; 

        if (type === 'hub') {
            setDragState({ id, type, startX: e.clientX, startY: e.clientY, startLat: hubs[id].lat, startLon: hubs[id].lon });
        } else if (type === 'cluster') {
            setDragState({ id, type, startX: e.clientX, startY: e.clientY, startLat: clusters[id].lat, startLon: clusters[id].lon });
        } else if (type === 'routeNode') {
            setDragState({ id, routeId: extraId, type, startX: e.clientX, startY: e.clientY, startLat: routeNodes[extraId][id].lat, startLon: routeNodes[extraId][id].lon });
        } else if (type === 'seaControl') {
            setDragState({ id, routeId: extraId, type, startX: e.clientX, startY: e.clientY, startLat: seaControlPoints[extraId][id].lat, startLon: seaControlPoints[extraId][id].lon });
        }
    };

    const handleNodeClick = (e, id, type, extraId, weight) => {
        if (!activeLayers.includes('planning')) return;
        e.stopPropagation();
        if (type === 'routeNode') {
            const rect = mapRef.current.getBoundingClientRect();
            setNodeMenu({
                routeId: extraId, nodeIdx: id, weight,
                x: e.clientX - rect.left, y: e.clientY - rect.top
            });
        }
    };

    const handleDuplicateNode = () => {
        if (!nodeMenu || !setRouteNodes) return;
        setRouteNodes(prev => {
            const { routeId, nodeIdx } = nodeMenu;
            const currentNodes = prev[routeId];
            if (!currentNodes) return prev;
            
            const currNode = currentNodes[nodeIdx];
            const newNode = { lat: currNode.lat - 0.05, lon: currNode.lon + 0.05 };
            const newNodes = [...currentNodes];
            newNodes.splice(nodeIdx + 1, 0, newNode);
            return { ...prev, [routeId]: newNodes };
        });
        setNodeMenu(null);
    };

    const handleDeleteNode = () => {
        if (!nodeMenu || !setRouteNodes) return;
        setRouteNodes(prev => {
            const { routeId, nodeIdx } = nodeMenu;
            const currentNodes = prev[routeId];
            if (!currentNodes || currentNodes.length <= 3) return prev; 
            const newNodes = [...currentNodes];
            newNodes.splice(nodeIdx, 1);
            return { ...prev, [routeId]: newNodes };
        });
        setNodeMenu(null);
    };

    const handleMouseMove = (e) => {
        if (dragState) {
            const dx = e.clientX - dragState.startX; const dy = e.clientY - dragState.startY;
            const dLon = dx / (MAP_CONSTANTS.baseScale * zoom); const dLat = -dy / (MAP_CONSTANTS.baseScale * 1.1 * zoom);
            if (dragState.type === 'hub' && setHubs) {
                setHubs(prev => ({...prev, [dragState.id]: { ...prev[dragState.id], lat: dragState.startLat + dLat, lon: dragState.startLon + dLon }}));
            } else if (dragState.type === 'cluster' && setClusters) {
                setClusters(prev => ({...prev, [dragState.id]: { ...prev[dragState.id], lat: dragState.startLat + dLat, lon: dragState.startLon + dLon }}));
            } else if (dragState.type === 'routeNode' && setRouteNodes) {
                setRouteNodes(prev => {
                    const newRoutes = { ...prev };
                    newRoutes[dragState.routeId] = [...newRoutes[dragState.routeId]];
                    newRoutes[dragState.routeId][dragState.id] = { 
                        ...newRoutes[dragState.routeId][dragState.id], 
                        lat: dragState.startLat + dLat, 
                        lon: dragState.startLon + dLon 
                    };
                    return newRoutes;
                });
            } else if (dragState.type === 'seaControl' && setSeaControlPoints) {
                setSeaControlPoints(prev => {
                    const newPoints = { ...prev };
                    newPoints[dragState.routeId] = { ...newPoints[dragState.routeId] };
                    newPoints[dragState.routeId][dragState.id] = {
                        ...newPoints[dragState.routeId][dragState.id],
                        lat: dragState.startLat + dLat,
                        lon: dragState.startLon + dLon
                    };
                    return newPoints;
                });
            }
        } else if (isDragging) {
            setPan(prev => ({ x: prev.x + (e.clientX - lastPos.x), y: prev.y + (e.clientY - lastPos.y) }));
            setLastPos({ x: e.clientX, y: e.clientY });
        }
    };
    
    const handleMouseUp = () => { setIsDragging(false); setDragState(null); };
    const handleMouseLeave = () => { setIsDragging(false); setDragState(null); };

    const exportMapAsImage = () => {
        const svgElement = document.getElementById('ccus-main-map');
        if (!svgElement) return;

        const clonedSvg = svgElement.cloneNode(true);
        if (!clonedSvg.getAttribute('xmlns')) clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clonedSvg.setAttribute('width', '800');
        clonedSvg.setAttribute('height', '900');
        clonedSvg.style.backgroundColor = '#f8fafc';
        clonedSvg.style.fontFamily = 'sans-serif';

        const serializer = new XMLSerializer(); 
        const svgString = serializer.serializeToString(clonedSvg);
        
        const canvas = document.createElement('canvas'); 
        const ctx = canvas.getContext('2d');
        const scale = 2; 
        canvas.width = 800 * scale; 
        canvas.height = 900 * scale;
        ctx.scale(scale, scale);
        
        const img = new Image(); 
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
        
        img.onload = () => {
            ctx.drawImage(img, 0, 0, 800, 900); 
            const a = document.createElement('a'); 
            a.download = 'CCUS_Pipeline_Map_HighRes.png'; 
            a.href = canvas.toDataURL('image/png'); 
            a.click();
        }; 
    };

    const textScale = Math.pow(zoom, 0.7);

    const getFallbackCoords = (company, plant) => {
        const cStr = String(company || ''); const pStr = String(plant || '');
        const found = captureData.find(x => x.Company === cStr && (x.Plant === pStr || !pStr));
        if (found && found.Latitude && found.Longitude) return { lat: found.Latitude, lon: found.Longitude };
        return getApproximateCoordinates(pStr, cStr, '');
    };

    return (
        <div className="w-full h-full relative bg-slate-50/80 rounded-lg overflow-hidden border border-slate-200 min-h-[400px]" ref={containerRef} onContextMenu={(e)=>e.preventDefault()}>
            <div className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur shadow-2xl rounded-xl border border-slate-200 p-3 transition-all duration-300 w-64 pointer-events-none" style={{ opacity: hoveredNode && !nodeMenu ? 1 : 0, transform: hoveredNode && !nodeMenu ? 'translateY(0)' : 'translateY(-10px)' }}>
                {hoveredNode && hoveredNode.nodeType === 'hub' && (
                    <div>
                        <div className="flex items-center gap-2 mb-2 border-b border-blue-100 pb-1.5">
                            {hoveredNode.name.includes('接收站') ? <Ship size={16} className="text-blue-600"/> : hoveredNode.name.includes('鐵砧山') ? <MapPin size={16} className="text-amber-700"/> : <Anchor size={16} className="text-blue-600"/>}
                            <h3 className="font-bold text-slate-800 text-sm truncate">{hoveredNode.name}</h3>
                        </div>
                        <div className="bg-blue-50 p-2 rounded border border-blue-100 mb-2">
                            <div className="text-[10px] font-bold text-blue-800 mb-0.5">樞紐定位 (可拖曳)</div>
                            <div className="text-xs text-blue-700">{hoveredNode.hubType}</div>
                        </div>
                        {ccsTopology && ccsTopology.hubEmissions && ccsTopology.hubEmissions[hoveredNode.id] > 0 && (
                             <div className="bg-slate-50 p-2 rounded border border-slate-200 flex justify-between items-center">
                                 <span className="text-slate-600 text-[10px] font-bold">預估接收總量</span><span className="font-mono font-black text-blue-600 text-xs">{(Number(ccsTopology.hubEmissions[hoveredNode.id] || 0) / 10000).toFixed(1)} 萬噸</span>
                             </div>
                        )}
                    </div>
                )}
                {hoveredNode && hoveredNode.nodeType === 'cluster' && (
                    <div>
                        <div className="flex items-center gap-2 mb-2 border-b border-indigo-100 pb-1.5">
                            <Layers size={16} className="text-indigo-600"/>
                            <h3 className="font-bold text-slate-800 text-sm truncate">{hoveredNode.name}</h3>
                        </div>
                        <div className="bg-indigo-50 p-2 rounded border border-indigo-100 mb-2">
                            <div className="text-[10px] font-bold text-indigo-800 mb-0.5">中繼管線節點 (可拖曳)</div>
                            <div className="text-xs text-indigo-700">區域管線匯集與轉折</div>
                        </div>
                        <div className="bg-slate-50 p-2 rounded border border-slate-200 flex justify-between items-center">
                            <span className="text-slate-600 text-[10px] font-bold">區域匯集碳排</span><span className="font-mono font-black text-indigo-600 text-xs">{(Number(hoveredNode.emissions || 0) / 10000).toFixed(1)} 萬噸</span>
                        </div>
                    </div>
                )}
                {hoveredNode && hoveredNode.nodeType === 'planning_source' && (
                    <div>
                        <div className="flex items-center gap-2 mb-2 border-b border-rose-100 pb-1.5">
                            <Factory size={16} className={hoveredNode.isPowerPlant ? "text-purple-600" : (hoveredNode.isPriority ? "text-rose-600" : "text-orange-500")}/>
                            <h3 className="font-bold text-slate-800 text-sm truncate">{hoveredNode.Company} <span className="text-slate-500 font-medium">{hoveredNode.Plant}</span></h3>
                        </div>
                        <div className="space-y-1 text-xs text-slate-600">
                            <div className="flex justify-between items-center"><span className="text-slate-400">隸屬聚落</span> <span className="font-bold text-slate-700 truncate max-w-[100px]">{hoveredNode.zone}</span></div>
                            <div className="flex justify-between items-center"><span className="text-slate-400">管線狀態</span> <span className={`font-bold ${hoveredNode.distanceToHub < 0 ? (hoveredNode.landDist > 0 ? 'text-amber-600' : 'text-slate-400') : 'text-emerald-600'}`}>
                                {hoveredNode.distanceToHub < 0 ? (hoveredNode.landDist > 0 ? `陸運接駁 (${(Number(hoveredNode.landDist)||0).toFixed(1)}km)` : '距離過遠無法納入') : `直線接入 (${(Number(hoveredNode.distanceToCenter)||0).toFixed(1)}km)`}
                            </span></div>
                            <div className="mt-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200 flex flex-col gap-1">
                                <div className="flex justify-between items-center"><span className="text-slate-600 font-bold">總排 (範1+2)</span><span className="font-mono font-black text-slate-600 text-xs">{(Number(hoveredNode.TotalScope || 0) / 10000).toFixed(1)} <span className="text-[9px] font-normal">萬噸</span></span></div>
                                <div className="flex justify-between items-center text-[10px] mt-1 pt-1 border-t border-slate-200"><span className="text-rose-600 font-bold">範疇一 (可CCS)</span><span className="font-mono text-rose-600 font-bold">{(Number(hoveredNode.Scope1 || 0) / 10000).toFixed(1)} 萬噸</span></div>
                            </div>
                        </div>
                    </div>
                )}
                {hoveredNode && hoveredNode.nodeType === 'capture' && (
                    <div>
                        <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-1.5">
                            <Factory size={16} className="text-blue-600"/>
                            <h3 className="font-bold text-slate-800 text-sm truncate">{hoveredNode.Company} <span className="text-slate-500 font-medium">{hoveredNode.Plant}</span></h3>
                        </div>
                        <div className="space-y-1 text-xs text-slate-600">
                            <div className="flex justify-between items-center"><span className="text-slate-400">來源製程</span> <span className="font-bold text-slate-700 truncate max-w-[100px]">{hoveredNode.Capture_Source || '-'}</span></div>
                            <div className="flex justify-between items-center"><span className="text-slate-400">捕捉技術</span> <span className="font-bold text-blue-700 bg-blue-50 px-1 py-0.5 rounded truncate max-w-[100px]">{hoveredNode.Capture_Tech || '-'} (TRL {hoveredNode.TRL})</span></div>
                            <div className="mt-1.5 bg-blue-50 p-2 rounded-lg border border-blue-100 space-y-1 text-[10px]">
                                <div className="flex justify-between"><span className="text-slate-500">總捕捉量(A):</span><span className="font-mono font-bold text-slate-700">{Number(hoveredNode.Capture_Volume||0).toFixed(2)} 萬噸</span></div>
                                <div className="flex justify-between"><span className="text-rose-500">設備耗能(B):</span><span className="font-mono font-bold text-rose-600">-{Number(hoveredNode.Captur_energy||0).toFixed(2)} 萬噸</span></div>
                                <div className="flex justify-between pt-1 border-t border-blue-200 mt-1"><span className="text-blue-800 font-bold">淨捕捉量(=A-B)</span><span className="font-mono font-black text-blue-700">{Number(hoveredNode.Net_Capture_Volume||0).toFixed(2)} 萬噸</span></div>
                            </div>
                        </div>
                    </div>
                )}
                {hoveredNode && hoveredNode.nodeType === 'future' && (
                     <div>
                        <div className="flex items-center gap-2 mb-2 border-b border-amber-100 pb-1.5">
                            <Rocket size={16} className="text-amber-600"/><h3 className="font-bold text-slate-800 text-sm truncate">{hoveredNode.Company} <span className="text-slate-500 font-medium">{hoveredNode.Plant}</span></h3>
                        </div>
                        <div className="space-y-1 text-xs text-slate-600">
                            <div className="flex justify-between items-center"><span className="text-slate-400">潛在安裝來源</span> <span className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded truncate max-w-[120px]">{hoveredNode.Potential_Source || '-'}</span></div>
                            <div className="mt-1.5 flex justify-between items-center bg-amber-50 p-2 rounded-lg border border-amber-200">
                                <span className="text-amber-800 font-bold">未來總排放潛力</span><span className="font-mono font-black text-amber-600 text-xs">{Number(hoveredNode.Future_Emission_Volume||0).toFixed(1)} <span className="text-[9px] font-normal">萬噸</span></span>
                            </div>
                        </div>
                     </div>
                )}
                {hoveredNode && hoveredNode.nodeType === 'util' && (
                    <div>
                        <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-1.5">
                            <FlaskConical size={16} className="text-emerald-600"/><h3 className="font-bold text-slate-800 text-sm truncate">{hoveredNode.Target_Company} <span className="text-slate-500 font-medium">{hoveredNode.Target_Plant}</span></h3>
                        </div>
                        <div className="space-y-1 text-xs text-slate-600">
                            <div className="flex justify-between items-center"><span className="text-slate-400">再利用技術</span> <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded truncate max-w-[120px]">{hoveredNode.Conversion_Tech || '-'}</span></div>
                            <div className="mt-1.5 flex justify-between items-center bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                                <span className="text-emerald-800 font-bold">預期總需求</span><span className="font-mono font-black text-emerald-600 text-xs">{Number(hoveredNode.Expected_Demand||0).toFixed(1)} <span className="text-[9px] font-normal">萬噸</span></span>
                            </div>
                        </div>
                    </div>
                )}
                {hoveredNode && hoveredNode.nodeType === 'storage' && (
                    <div>
                        <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-1.5">
                            <Box size={16} className="text-rose-600"/><h3 className="font-bold text-slate-800 text-sm truncate">{hoveredNode.Storage_Site}</h3>
                        </div>
                        <div className="space-y-1 text-xs text-slate-600">
                            <div className="flex justify-between items-center"><span className="text-slate-400">碳源公司</span> <span className="font-bold text-slate-700 truncate max-w-[120px]">{hoveredNode.Source_Company}</span></div>
                            <div className="mt-1.5 flex justify-between items-center bg-rose-50 p-2 rounded-lg border border-rose-100">
                                <span className="text-rose-800 font-bold">可封存總量</span><span className="font-mono font-black text-rose-600 text-xs">{Number(hoveredNode.Capturable_Volume||0).toFixed(1)} <span className="text-[9px] font-normal">萬噸</span></span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 專屬節點操作選單 (輕量化) */}
            {nodeMenu && (
                <div className="absolute z-50 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden text-xs w-36 pointer-events-auto" style={{ left: nodeMenu.x + 10, top: nodeMenu.y + 10 }}>
                    <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200">
                        <span className="font-bold text-slate-700">節點操作</span>
                        <div className="text-[10px] text-blue-600 font-mono">流量: {(Number(nodeMenu.weight||0)/10000).toFixed(1)}萬噸</div>
                    </div>
                    <button onClick={handleDuplicateNode} className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-blue-700 font-bold flex items-center gap-2 border-b border-slate-100"><Copy size={12}/> 新增 (複製)</button>
                    <button onClick={handleDeleteNode} className="w-full text-left px-3 py-1.5 hover:bg-rose-50 text-rose-600 font-bold flex items-center gap-2"><Trash2 size={12}/> 刪除此點</button>
                </div>
            )}

            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-white/95 p-1.5 rounded-lg shadow-sm border border-slate-200 backdrop-blur">
                <button onClick={() => setZoom(prev => Math.min(prev * 1.3, 10))} className="p-2 bg-slate-50 hover:bg-slate-200 rounded-md text-slate-600 transition-colors" title="放大"><ZoomIn size={18}/></button>
                <button onClick={() => setZoom(prev => Math.max(prev / 1.3, 0.5))} className="p-2 bg-slate-50 hover:bg-slate-200 rounded-md text-slate-600 transition-colors" title="縮小"><ZoomOut size={18}/></button>
                <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-2 bg-slate-50 hover:bg-slate-200 rounded-md text-slate-600 transition-colors" title="重置畫面"><Maximize size={18}/></button>
                <div className="w-full h-px bg-slate-200 my-1"></div>
                <button onClick={exportMapAsImage} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md transition-colors font-bold flex items-center justify-center" title="輸出高品質圖片"><DownloadCloud size={18}/></button>
            </div>

            <svg id="ccus-main-map" viewBox={`0 0 ${baseWidth} ${baseHeight}`} className={`w-full h-full select-none ${isDragging ? 'cursor-grabbing' : 'cursor-default'} ${dragState ? 'cursor-move' : ''}`} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseLeave} ref={mapRef}>
                <g className="map-content-group" transform={`translate(${baseWidth/2 + pan.x}, ${baseHeight/2 + pan.y}) scale(${zoom})`}>
                    {mapPaths.map((p, i) => p.d && <path key={`map-${i}`} d={p.d} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={1.5 / zoom} />)}

                    {activeLayers.includes('planning') && ccsTopology && (
                        <>
                            {/* 海運航線 */}
                            {ccsTopology.seaRoutes.map((route, i) => {
                                const [x1, y1] = projectBase(route.from.lon, route.from.lat); const [x2, y2] = projectBase(route.to.lon, route.to.lat);
                                const currentC1 = seaControlPoints[route.id]?.c1 || route.c1;
                                const currentC2 = seaControlPoints[route.id]?.c2 || route.c2;
                                const [cx1, cy1] = projectBase(currentC1.lon, currentC1.lat); 
                                const [cx2, cy2] = projectBase(currentC2.lon, currentC2.lat);
                                if (x1 === -9999 || x2 === -9999 || cx1 === -9999) return null;
                                
                                const midX = 0.125*x1 + 0.375*cx1 + 0.375*cx2 + 0.125*x2; const midY = 0.125*y1 + 0.375*cy1 + 0.375*cy2 + 0.125*y2;
                                
                                const isC1Dragged = dragState && dragState.id === 'c1' && dragState.routeId === route.id;
                                const isC2Dragged = dragState && dragState.id === 'c2' && dragState.routeId === route.id;

                                return (
                                    <g key={`sea-route-${i}`}>
                                        <path d={`M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`} stroke="#0284c7" strokeWidth={Math.max(2, Math.log10(Math.max(10000, route.weight))/zoom)} strokeDasharray={`${6/zoom} ${6/zoom}`} fill="none" opacity={0.6}/>
                                        <text x={midX} y={midY} fontSize={11/zoom} fill="#0369a1" textAnchor="middle" fontWeight="bold" style={{textShadow: '0 0 3px white', pointerEvents: 'none'}}>{route.label}</text>
                                        
                                        <circle cx={cx1} cy={cy1} r={16/zoom} fill="transparent" className={isC1Dragged ? "cursor-grabbing" : "cursor-grab hover:scale-125"} onMouseDown={(e) => handleNodeMouseDown(e, 'c1', 'seaControl', route.id)}/>
                                        <circle cx={cx1} cy={cy1} r={4/zoom} fill="rgba(2,132,199,0.2)" stroke="#0284c7" strokeWidth={isC1Dragged ? 2/zoom : 1/zoom} strokeDasharray={`${2/zoom} ${2/zoom}`} pointerEvents="none"/>
                                        
                                        <circle cx={cx2} cy={cy2} r={16/zoom} fill="transparent" className={isC2Dragged ? "cursor-grabbing" : "cursor-grab hover:scale-125"} onMouseDown={(e) => handleNodeMouseDown(e, 'c2', 'seaControl', route.id)}/>
                                        <circle cx={cx2} cy={cy2} r={4/zoom} fill="rgba(2,132,199,0.2)" stroke="#0284c7" strokeWidth={isC2Dragged ? 2/zoom : 1/zoom} strokeDasharray={`${2/zoom} ${2/zoom}`} pointerEvents="none"/>
                                    </g>
                                );
                            })}
                            
                            {/* 陸運路線 (針對孤立廠區的琥珀色虛線) */}
                            {ccsTopology.landRoutes.map((route, i) => {
                                const [x1, y1] = projectBase(route.from.lon, route.from.lat); const [x2, y2] = projectBase(route.to.lon, route.to.lat);
                                if (x1 === -9999 || x2 === -9999) return null;
                                const bowX = Math.min(x1, x2) - 30/zoom; 
                                const bowY = (y1 + y2) / 2;
                                const midX = 0.25*x1 + 0.5*bowX + 0.25*x2; const midY = 0.25*y1 + 0.5*bowY + 0.25*y2;
                                return (
                                    <g key={`land-route-${i}`}>
                                        <path d={`M ${x1} ${y1} Q ${bowX} ${bowY}, ${x2} ${y2}`} stroke="#f59e0b" strokeWidth={1.5/zoom} strokeDasharray={`${4/zoom} ${4/zoom}`} fill="none" opacity={0.7} />
                                        <text x={midX} y={midY - (4/zoom)} fontSize={9/zoom} fill="#b45309" textAnchor="middle" fontWeight="bold" style={{textShadow: '0 0 3px white', pointerEvents: 'none'}}>陸運 {Number(route.distance||0).toFixed(0)}km</text>
                                    </g>
                                );
                            })}
                            
                            {/* 廠區支線 (最短直線) */}
                            {ccsTopology.branchRoutes.map((route, i) => {
                                const [x1, y1] = projectBase(route.from.lon, route.from.lat); const [x2, y2] = projectBase(route.to.lon, route.to.lat);
                                if (x1 === -9999 || x2 === -9999) return null;
                                const strokeColor = route.isPriority ? "#94a3b8" : "#cbd5e1"; const strokeW = (route.isPriority ? 1.5 : 1) / zoom;
                                const opac = route.isPriority ? 0.6 : 0.4;
                                return (<path key={`branch-${i}`} d={`M ${x1} ${y1} L ${x2} ${y2}`} stroke={strokeColor} strokeWidth={strokeW} fill="none" opacity={opac} />);
                            })}
                            
                            {/* 多節點主管線路徑 (不含節點圓點) */}
                            {ccsTopology.mainRoutes.map((route, i) => {
                                const currentNodes = routeNodes[route.id] || route.nodes;
                                const pathNodes = currentNodes.map(n => projectBase(n.lon, n.lat));
                                if (pathNodes.some(n => n[0] === -9999)) return null;
                                
                                let pathD = `M ${pathNodes[0][0]} ${pathNodes[0][1]} `;
                                for (let j = 1; j < pathNodes.length; j++) pathD += `L ${pathNodes[j][0]} ${pathNodes[j][1]} `;
                                
                                const dist = route.recalcDist ? route.recalcDist(currentNodes) : route.distance;
                                const isUnrealistic = dist > 50;
                                const strokeColor = isUnrealistic ? "#f97316" : "#3b82f6"; const textColor = isUnrealistic ? "#c2410c" : "#1e40af";
                                const midIdx = Math.floor(pathNodes.length / 2); const midX = pathNodes[midIdx][0]; const midY = pathNodes[midIdx][1];
                                
                                return (
                                    <g key={`main-route-path-${i}`}>
                                        <path d={pathD} stroke={strokeColor} strokeWidth={Math.max(2, Math.log10(Math.max(10000, route.weight)))/zoom} strokeDasharray={isUnrealistic ? `${6/zoom} ${4/zoom}` : "none"} fill="none" strokeLinejoin="round" opacity={isUnrealistic ? 0.7 : 0.85}/>
                                        <path d={pathD} stroke="transparent" strokeWidth={20/zoom} fill="none" className="cursor-crosshair" onClick={(e) => handlePathClick(e, route.id, currentNodes)} />
                                        <text x={midX} y={midY - (8/zoom)} fontSize={10/zoom} fill={textColor} textAnchor="middle" fontWeight="bold" style={{textShadow: '0 0 3px white', pointerEvents: 'none'}}>{Number(dist||0).toFixed(0)} km</text>
                                    </g>
                                );
                            })}
                            
                            {/* 將所有可互動元素集中在最後繪製，確保位於最上層，並放大隱形感應區 */}
                            {/* 中繼聚落點 (可拖曳) */}
                            {clusters && Object.values(clusters).map((cluster, i) => {
                                if (cluster.emissions <= 0) return null;
                                const [cx, cy] = projectBase(cluster.lon, cluster.lat);
                                if (cx === -9999) return null;
                                const isDragged = dragState && dragState.id === cluster.id;
                                return (
                                    <g key={`cluster-${i}`} className={isDragged ? "cursor-grabbing" : "cursor-grab hover:scale-125 transition-transform"} onMouseEnter={() => setHoveredNode({...cluster, nodeType: 'cluster'})} onMouseLeave={() => setHoveredNode(null)} onMouseDown={(e) => handleNodeMouseDown(e, cluster.id, 'cluster')}>
                                        <circle cx={cx} cy={cy} r={16/zoom} fill="transparent" />
                                        <circle cx={cx} cy={cy} r={isDragged ? 5/zoom : 4/zoom} fill="#fff" stroke={isDragged ? "#fcd34d" : "#3b82f6"} strokeWidth={isDragged ? 2.5/zoom : 2/zoom} style={{ filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.4))' }} pointerEvents="none"/>
                                    </g>
                                );
                            })}
                            
                            {/* 主管線節點 (隱形大感應區、點擊出選單) */}
                            {ccsTopology.mainRoutes.map(route => {
                                const currentNodes = routeNodes[route.id] || route.nodes;
                                const dist = route.recalcDist ? route.recalcDist(currentNodes) : route.distance;
                                const strokeColor = dist > 50 ? "#f97316" : "#3b82f6";
                                
                                return currentNodes.slice(1, -1).map((n, idx) => {
                                    const [cx, cy] = projectBase(n.lon, n.lat);
                                    const actualIdx = idx + 1;
                                    const isDragged = dragState && dragState.id === actualIdx && dragState.routeId === route.id;
                                    return (
                                        <g key={`node-${route.id}-${idx}`} 
                                           className={isDragged ? "cursor-grabbing" : "cursor-pointer hover:scale-125 transition-transform"} 
                                           onMouseDown={(e) => handleNodeMouseDown(e, actualIdx, 'routeNode', route.id)} 
                                           onContextMenu={(e) => handleNodeContextMenu(e, route.id, actualIdx)}
                                           onClick={(e) => handleNodeClick(e, actualIdx, 'routeNode', route.id, route.weight)}
                                        >
                                            <circle cx={cx} cy={cy} r={16/zoom} fill="transparent" />
                                            <circle cx={cx} cy={cy} r={isDragged ? 5/zoom : 4/zoom} fill="#fff" stroke={isDragged ? "#fcd34d" : strokeColor} strokeWidth={isDragged ? 2.5/zoom : 2/zoom} style={{ filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.4))' }} pointerEvents="none"/>
                                        </g>
                                    );
                                });
                            })}
                            
                            {/* 樞紐站 (隱形大感應區) */}
                            {hubs && Object.values(hubs).map((hub, i) => {
                                const [cx, cy] = projectBase(hub.lon, hub.lat);
                                if (cx === -9999) return null;
                                const isLandHub = hub.id === 'CENTRAL_HUB_LAND'; const isDragged = dragState && dragState.id === hub.id;
                                return (
                                    <g key={`hub-${i}`} className={isDragged ? "cursor-grabbing" : "cursor-grab hover:scale-110 transition-transform"} onMouseEnter={() => setHoveredNode({...hub, nodeType: 'hub', hubType: hub.type})} onMouseLeave={() => setHoveredNode(null)} onMouseDown={(e) => handleNodeMouseDown(e, hub.id, 'hub')}>
                                        <rect x={cx - 16/zoom} y={cy - 16/zoom} width={32/zoom} height={32/zoom} fill="transparent" />
                                        <rect x={cx - 10/zoom} y={cy - 10/zoom} width={20/zoom} height={20/zoom} fill={isLandHub ? "#b45309" : "#0ea5e9"} stroke={isDragged ? "#fbbf24" : "white"} strokeWidth={isDragged ? 3/zoom : 2/zoom} style={{ filter: 'drop-shadow(0px 3px 4px rgba(0,0,0,0.4))' }} pointerEvents="none" />
                                        <text x={cx + 14/zoom} y={cy + 4/zoom} fontSize={12/textScale} fill={isLandHub ? "#78350f" : "#0369a1"} fontWeight="900" paintOrder="stroke" stroke="white" strokeWidth={3/textScale} className="pointer-events-none">{hub.name}</text>
                                    </g>
                                );
                            })}
                            
                            {/* 廠區排放點源 (按比例縮放與電廠獨立顯色) */}
                            {ccsTopology.validSources.map((d, i) => {
                                const [cx, cy] = projectBase(d.lon, d.lat);
                                if (cx === -9999) return null;
                                const r = Math.max(3, Math.min(14, (3 + Math.sqrt(Math.max(0, d.Scope1 || 0) / 100000)))) / zoom;
                                const isHovered = hoveredNode?.Company === d.Company && hoveredNode?.Plant === d.Plant;
                                const isConnected = d.distanceToHub >= 0 || d.landDist > 0;
                                const fillCol = d.isPowerPlant ? "#a855f7" : (d.isPriority ? "#e11d48" : "#f97316"); 
                                const opac = isHovered ? 1 : (isConnected ? 0.9 : 0.3);
                                return (
                                    <g key={`s1-${i}`} className="cursor-pointer transition-all" onMouseEnter={() => setHoveredNode({...d, nodeType: 'planning_source'})} onMouseLeave={() => setHoveredNode(null)}>
                                        <circle cx={cx} cy={cy} r={Math.max(r, 16/zoom)} fill="transparent" />
                                        {d.isPriority && isConnected && <circle cx={cx} cy={cy} r={r * 1.6} fill={fillCol} opacity={0.25} pointerEvents="none"/>}
                                        <circle cx={cx} cy={cy} r={r} fill={fillCol} fillOpacity={opac} stroke={isConnected ? "white" : "transparent"} strokeWidth={(d.isPriority ? 1.5 : 1) / zoom} style={d.isPriority && isConnected ? { filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.4))' } : {}} pointerEvents="none"/>
                                    </g>
                                );
                            })}
                        </>
                    )}

                    {activeLayers.includes('capture') && captureData.map((d, i) => {
                        const lat = cleanNumber(d.Latitude) || getFallbackCoords(d.Company, d.Plant).lat;
                        const lon = cleanNumber(d.Longitude) || getFallbackCoords(d.Company, d.Plant).lon;
                        const [cx, cy] = projectBase(lon, lat); if (cx === -9999) return null;
                        const r = Math.max(6, Math.min(25, Math.sqrt(Math.max(0, d.Capture_Volume || 0)) * 1.5)) / zoom; 
                        const isHovered = hoveredNode?.Company === d.Company;
                        return (
                            <g key={`cap-${i}`} className="cursor-pointer transition-all" onMouseEnter={() => setHoveredNode({...d, nodeType:'capture'})} onMouseLeave={() => setHoveredNode(null)}>
                                <circle cx={cx} cy={cy} r={Math.max(r, 20/zoom)} fill="transparent" />
                                <circle cx={cx} cy={cy} r={r} fill={stringToColor(d.Capture_Tech)} fillOpacity={isHovered ? 1 : 0.85} stroke="white" strokeWidth={1.5 / zoom} style={{ filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.3))' }} pointerEvents="none"/>
                                <text x={cx + r + (4/zoom)} y={cy + (3/zoom)} fontSize={11 / textScale} fill="#1e293b" fontWeight="900" paintOrder="stroke" stroke="white" strokeWidth={3/textScale} strokeLinejoin="round" className="pointer-events-none">{d.Company}</text>
                            </g>
                        );
                    })}

                    {activeLayers.includes('future') && captureData.map((d, i) => {
                        const lat = cleanNumber(d.Latitude) || getFallbackCoords(d.Company, d.Plant).lat;
                        const lon = cleanNumber(d.Longitude) || getFallbackCoords(d.Company, d.Plant).lon;
                        const [cx, cy] = projectBase(lon, lat); if (cx === -9999) return null;
                        const r = Math.max(6, Math.min(25, Math.sqrt(Math.max(0, d.Future_Emission_Volume || 0)) * 1.5)) / zoom; 
                        const isHovered = hoveredNode?.Company === d.Company;
                        return (
                            <g key={`fut-${i}`} className="cursor-pointer transition-all" onMouseEnter={() => setHoveredNode({...d, nodeType:'future'})} onMouseLeave={() => setHoveredNode(null)}>
                                <circle cx={cx} cy={cy} r={Math.max(r, 20/zoom)} fill="transparent" />
                                <circle cx={cx} cy={cy} r={r} fill="#d97706" fillOpacity={isHovered ? 1 : 0.75} stroke="white" strokeWidth={1.5 / zoom} strokeDasharray={`${3/zoom} ${3/zoom}`} pointerEvents="none"/>
                            </g>
                        );
                    })}

                    {activeLayers.includes('util') && utilData.map((d, i) => {
                        const coords = getFallbackCoords(d.Target_Company, d.Target_Plant);
                        const [cx, cy] = projectBase(coords.lon, coords.lat); if (cx === -9999) return null;
                        const r = Math.max(8, Math.min(20, Math.sqrt(Math.max(0, d.Expected_Demand || 0)) * 2)) / zoom;
                        const isHovered = hoveredNode?.Target_Company === d.Target_Company;
                        return (
                            <g key={`util-${i}`} className="cursor-pointer transition-all" onMouseEnter={() => setHoveredNode({...d, nodeType:'util'})} onMouseLeave={() => setHoveredNode(null)}>
                                <circle cx={cx} cy={cy} r={Math.max(r, 20/zoom)} fill="transparent" />
                                <circle cx={cx} cy={cy} r={r} fill="#10b981" fillOpacity={isHovered ? 1 : 0.9} stroke="white" strokeWidth={2 / zoom} style={{ filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.3))' }} pointerEvents="none"/>
                                <text x={cx + r + (4/zoom)} y={cy + (3/zoom)} fontSize={11 / textScale} fill="#064e3b" fontWeight="900" paintOrder="stroke" stroke="white" strokeWidth={3/textScale} strokeLinejoin="round" className="pointer-events-none">{d.Target_Company}</text>
                            </g>
                        );
                    })}

                    {activeLayers.includes('storage') && storageData.map((d, i) => {
                        const srcCoords = getFallbackCoords(d.Source_Company, '');
                        const [x1, y1] = projectBase(srcCoords.lon, srcCoords.lat); if (x1 === -9999) return null;
                        
                        const getStorageCoords = (siteName) => {
                             const safeSite = siteName || '';
                             const hub = Object.values(hubs || INITIAL_CCS_HUBS).find(h => safeSite.includes(h.name.split(' ')[0]) || h.name.includes(safeSite.split(' ')[0]));
                             if (hub) return { lat: hub.lat, lon: hub.lon };
                             if (safeSite.includes('鐵砧山')) return { lat: 24.45, lon: 120.68 };
                             if (safeSite.includes('麥寮')) return { lat: 23.80, lon: 120.10 };
                             if (safeSite.includes('台中')) return { lat: 24.25, lon: 120.45 };
                             if (safeSite.includes('林口') || safeSite.includes('台北')) return { lat: 25.14, lon: 121.32 };
                             if (safeSite.includes('高雄')) return { lat: 22.55, lon: 120.32 };
                             if (safeSite.includes('花蓮')) return { lat: 23.98, lon: 121.62 };
                             return { lat: 23.6, lon: 120.9 };
                        };
                        const tgt = getStorageCoords(d.Storage_Site);
                        const [x2, y2] = projectBase(tgt.lon, tgt.lat); 

                        const isPipe = String(d.Transport_Method).includes('管線');
                        const isHovered = hoveredNode?.Storage_Site === d.Storage_Site;
                        return (
                            <g key={`sto-${i}`} className="cursor-pointer transition-all" onMouseEnter={() => setHoveredNode({...d, nodeType:'storage'})} onMouseLeave={() => setHoveredNode(null)}>
                                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={isPipe ? "#3b82f6" : "#f59e0b"} strokeWidth={3 / zoom} strokeDasharray={isPipe ? "0" : `${6/zoom} ${6/zoom}`} opacity={isHovered ? 1 : 0.6}/>
                                <circle cx={x1} cy={y1} r={16 / zoom} fill="transparent" />
                                <circle cx={x1} cy={y1} r={4 / zoom} fill="#64748b" pointerEvents="none"/>
                                <circle cx={x2} cy={y2} r={10 / zoom} fill="#ef4444" fillOpacity={isHovered ? 1 : 0.9} stroke="white" strokeWidth={2 / zoom} style={{ filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.3))' }} pointerEvents="none"/>
                                <text x={x2 + (12/zoom)} y={y2 + (4/zoom)} fontSize={12 / textScale} fill="#991b1b" fontWeight="900" paintOrder="stroke" stroke="white" strokeWidth={3/textScale} strokeLinejoin="round" className="pointer-events-none">{d.Storage_Site}</text>
                            </g>
                        );
                    })}
                </g>

                {/* 寫入原生的 SVG 圖例 */}
                {activeLayers.includes('planning') && (
                    <g transform={`translate(20, ${baseHeight - 310})`}>
                        <rect x="0" y="0" width="280" height="260" fill="rgba(255,255,255,0.95)" rx="8" stroke="#e2e8f0" strokeWidth="1" />
                        
                        <rect x="12" y="15" width="10" height="10" fill="#0ea5e9" stroke="white" strokeWidth="1" />
                        <text x="30" y="24" fontSize="11" fill="#334155" fontWeight="bold">海洋接收站 / 本土封存樞紐 (可拖曳)</text>
                        
                        <rect x="12" y="35" width="10" height="10" fill="#b45309" stroke="white" strokeWidth="1" />
                        <text x="30" y="44" fontSize="11" fill="#334155" fontWeight="bold">陸地封存場域 (可拖曳)</text>
                        
                        <line x1="12" y1="55" x2="268" y2="55" stroke="#e2e8f0" strokeWidth="1" />
                        
                        <circle cx="17" cy="70" r="5" fill="#a855f7" stroke="white" strokeWidth="1" />
                        <text x="30" y="74" fontSize="11" fill="#334155" fontWeight="bold">大型發電廠 (按比例顯示碳排)</text>

                        <circle cx="17" cy="90" r="5" fill="#e11d48" stroke="white" strokeWidth="1" />
                        <text x="30" y="94" fontSize="11" fill="#334155" fontWeight="bold">一般優先碳源 (≥ 2.5萬噸)</text>
                        
                        <circle cx="17" cy="110" r="3" fill="#f97316" opacity="0.8" />
                        <text x="30" y="114" fontSize="11" fill="#334155" fontWeight="bold">次要碳源 (&lt; 2.5萬噸)</text>

                        <line x1="12" y1="125" x2="268" y2="125" stroke="#e2e8f0" strokeWidth="1" />
                        
                        <circle cx="17" cy="140" r="4" fill="#fff" stroke="#3b82f6" strokeWidth="2" />
                        <text x="30" y="144" fontSize="11" fill="#334155" fontWeight="bold">統一管線節點 (可拖曳)</text>
                        <text x="30" y="156" fontSize="9" fill="#64748b">操作: 點藍線新增 / 左點菜單 / 右鍵刪除</text>

                        <line x1="12" y1="175" x2="35" y2="175" stroke="#3b82f6" strokeWidth="3" />
                        <text x="40" y="179" fontSize="11" fill="#334155" fontWeight="bold">自訂主幹管線 (&gt;50km以橘色警告)</text>
                        
                        <path d="M 12 195 L 35 195" stroke="#94a3b8" strokeWidth="2" fill="none" />
                        <text x="40" y="199" fontSize="11" fill="#334155" fontWeight="bold">直線就近上管 (優先≤50km,次要≤20km)</text>
                        
                        <path d="M 12 215 Q 23.5 215, 35 210" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
                        <text x="40" y="219" fontSize="11" fill="#334155" fontWeight="bold">孤立廠區之陸運接駁路線</text>
                        
                        <line x1="12" y1="235" x2="35" y2="235" stroke="#0284c7" strokeWidth="2" strokeDasharray="6 6" opacity="0.6" />
                        <circle cx="23" cy="235" r="3" fill="transparent" stroke="#0284c7" strokeWidth="1" />
                        <text x="40" y="239" fontSize="11" fill="#334155" fontWeight="bold">樞紐海運外繞 (空心點可拖曳)</text>
                    </g>
                )}

                {!activeLayers.includes('planning') && (
                    <g transform={`translate(20, ${baseHeight - (20 + activeLayers.length * 25)})`}>
                        <rect x="0" y="0" width="180" height={15 + activeLayers.length * 25} fill="rgba(255,255,255,0.95)" rx="8" stroke="#e2e8f0" strokeWidth="1" />
                        {activeLayers.map((layer, idx) => {
                            const yOffset = 20 + idx * 25;
                            if (layer === 'capture') return (
                                <g key={layer} transform={`translate(15, ${yOffset})`}>
                                    <circle cx="4" cy="-4" r="4" fill="#3b82f6" stroke="white" strokeWidth="1" />
                                    <text x="15" y="0" fontSize="11" fill="#334155" fontWeight="bold">捕捉端 (依捕捉量)</text>
                                </g>
                            );
                            if (layer === 'future') return (
                                <g key={layer} transform={`translate(15, ${yOffset})`}>
                                    <circle cx="4" cy="-4" r="4" fill="transparent" stroke="#d97706" strokeWidth="2" strokeDasharray="3 3" />
                                    <text x="15" y="0" fontSize="11" fill="#334155" fontWeight="bold">潛力擴充點源</text>
                                </g>
                            );
                            if (layer === 'util') return (
                                <g key={layer} transform={`translate(15, ${yOffset})`}>
                                    <circle cx="4" cy="-4" r="4" fill="#10b981" stroke="white" strokeWidth="1" />
                                    <text x="15" y="0" fontSize="11" fill="#334155" fontWeight="bold">再利用端 (依需求量)</text>
                                </g>
                            );
                            if (layer === 'storage') return (
                                <g key={layer} transform={`translate(15, ${yOffset})`}>
                                    <circle cx="4" cy="-4" r="5" fill="#ef4444" stroke="white" strokeWidth="1" />
                                    <text x="15" y="0" fontSize="11" fill="#334155" fontWeight="bold">封存場域與專案管線</text>
                                </g>
                            );
                            return null;
                        })}
                    </g>
                )}
            </svg>
        </div>
    );
};

export default CcusDashboard;