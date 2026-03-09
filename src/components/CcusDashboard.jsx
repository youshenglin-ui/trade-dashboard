import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ScatterChart, Scatter, ZAxis, Cell, LabelList, ComposedChart, Line, PieChart, Pie
} from 'recharts';
import { 
  Leaf, RefreshCw, Target, Activity, MapPin, DollarSign, Box, AlertTriangle, 
  Truck, Ship, GripHorizontal, FlaskConical, Plus, ZoomIn, ZoomOut, Maximize, Factory, List, Rocket, Map, Route, Anchor, Layers, Filter, PieChart as PieChartIcon, DownloadCloud
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
    'SOUTH_HUB': { id: 'SOUTH_HUB', name: '高雄港接收站 (輸出轉運)', type: '🚢 港口接收轉運', lat: 22.55, lon: 120.25, region: '南區' },
    'EAST_HUB': { id: 'EAST_HUB', name: '花蓮港接收站 (輸出北送)', type: '🚢 港口接收轉運', lat: 23.98, lon: 121.62, region: '東區' },
    'SOUTHEAST_HUB': { id: 'SOUTHEAST_HUB', name: '台東接收站 (南迴轉運)', type: '🚢 港口接收轉運', lat: 22.75, lon: 121.15, region: '南區' } 
};

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
    'C_KHH_S': { id: 'C_KHH_S', name: '南高雄(林園小港)', lat: 22.53, lon: 120.38, next: 'SOUTH_HUB', type: 'land' },
    'C_PTG': { id: 'C_PTG', name: '屏東聚落', lat: 22.50, lon: 120.45, next: 'C_KHH_S', type: 'land' },
    'C_YIL': { id: 'C_YIL', name: '宜蘭聚落', lat: 24.70, lon: 121.75, next: 'NORTH_HUB', type: 'sea' }, 
    'C_HUA': { id: 'C_HUA', name: '花蓮聚落', lat: 23.98, lon: 121.60, next: 'C_KEE_PORT', type: 'sea' }, 
    'C_TTT': { id: 'C_TTT', name: '台東聚落', lat: 22.75, lon: 121.14, next: 'SOUTH_HUB', type: 'sea' } 
};

class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { hasError: false }; }
    static getDerivedStateFromError(error) { return { hasError: true }; }
    render() {
      if (this.state.hasError) return <div className="h-full flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded text-slate-400"><AlertTriangle size={32} className="mb-2 text-amber-400" /><p className="text-sm">圖表資料異常，請檢查資料來源格式</p></div>;
      return this.props.children;
    }
}

const MAP_CONSTANTS = { baseWidth: 800, baseHeight: 900, centerLon: 120.9, centerLat: 23.7, baseScale: 400 };
export const projectBase = (lon, lat) => {
    if (lon == null || lat == null || isNaN(lon) || isNaN(lat)) return [-9999, -9999]; 
    return [(lon - MAP_CONSTANTS.centerLon) * MAP_CONSTANTS.baseScale, -(lat - MAP_CONSTANTS.centerLat) * MAP_CONSTANTS.baseScale * 1.1];
};

const generateTreePath = (x1, y1, x2, y2, isBranch, inlandCurve = false) => {
    if (isBranch) {
        let cx = (x1 + x2) / 2; if (inlandCurve) cx += 15; const cy = (y1 + y2) / 2;
        return `M ${x1} ${y1} Q ${cx} ${cy}, ${x2} ${y2}`;
    } else {
        let cx1 = x1, cy1 = (y1 + y2) / 2; let cx2 = x2, cy2 = (y1 + y2) / 2;
        if (inlandCurve) { cx1 += 30; cx2 += 30; }
        return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
    }
};

const CaptureYAxisTick = ({ x, y, payload, data }) => {
    const item = data && data.find(d => d.Label === payload.value);
    const tech = item ? item.Capture_Tech : '';
    return (
        <g transform={`translate(${x},${y})`}>
            <text x={-5} y={-6} textAnchor="end" fill="#334155" fontSize={11} fontWeight="bold">{payload.value}</text>
            <text x={-5} y={8} textAnchor="end" fill="#0284c7" fontSize={9} fontWeight="bold">{tech ? `[${tech}]` : ''}</text>
        </g>
    );
};

const CaptureTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white/95 backdrop-blur border border-slate-200 p-3 rounded-lg shadow-xl text-xs w-64 pointer-events-auto">
                <p className="font-bold text-slate-800 mb-2 border-b pb-1 flex items-center gap-1"><Factory size={14} className="text-blue-600"/> {data.Label}</p>
                <p className="mb-1 font-bold text-blue-600">技術: {data.Capture_Tech} (TRL {data.TRL})</p>
                <div className="text-slate-600 mb-2 grid grid-cols-2 gap-x-2 gap-y-1 bg-slate-50 p-1.5 rounded">
                   <div>溫度: <span className="font-mono font-bold">{data.Temperature || '-'}</span></div>
                   <div>壓力: <span className="font-mono font-bold">{data.Pressure || '-'}</span></div>
                   <div className="col-span-2">濃度: <span className="font-mono font-bold">{data.Concentration || '-'}</span></div>
                </div>
                
                <div className="bg-blue-50/50 p-2 border border-blue-100 rounded space-y-1">
                    <div className="flex justify-between text-slate-600"><span className="text-slate-500">總捕捉量 (A):</span> <span className="font-mono font-bold">{Number(data.Capture_Volume||0).toFixed(2)} 萬噸</span></div>
                    <div className="flex justify-between text-rose-600"><span className="text-rose-500">設備耗能 (B):</span> <span className="font-mono font-bold">-{Number(data.Captur_energy||0).toFixed(2)} 萬噸</span></div>
                    <div className="flex justify-between pt-1 border-t border-blue-200 text-emerald-700 font-bold"><span className="text-emerald-800">淨捕捉量 (=A-B):</span> <span className="font-mono font-black">{Number(data.Net_Capture_Volume||0).toFixed(2)} 萬噸</span></div>
                </div>
            </div>
        );
    }
    return null;
};

// ==========================================
// 台灣地圖核心模組 (支援 activeLayers 與節點拖曳)
// ==========================================
const TaiwanCcusMap = ({ activeLayers = [], captureData = [], utilData = [], storageData = [], scope1Data = [], mapPaths = [], ccsTopology = null, hubs, setHubs, clusters, setClusters }) => {
    const mapRef = useRef(null); const containerRef = useRef(null); 
    const [zoom, setZoom] = useState(1); const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false); const [dragState, setDragState] = useState(null); 
    const [lastPos, setLastPos] = useState({ x: 0, y: 0 }); const [hoveredNode, setHoveredNode] = useState(null);
    const { baseWidth, baseHeight } = MAP_CONSTANTS;

    const handleMouseDown = (e) => { setIsDragging(true); setLastPos({ x: e.clientX, y: e.clientY }); };
    
    const handleNodeMouseDown = (e, id, type) => {
        if (!activeLayers.includes('planning')) return;
        e.stopPropagation();
        if (type === 'hub') {
            setDragState({ id, type, startX: e.clientX, startY: e.clientY, startLat: hubs[id].lat, startLon: hubs[id].lon });
        } else if (type === 'cluster') {
            setDragState({ id, type, startX: e.clientX, startY: e.clientY, startLat: clusters[id].lat, startLon: clusters[id].lon });
        }
    };

    const handleMouseMove = (e) => {
        if (dragState) {
            const dx = e.clientX - dragState.startX; const dy = e.clientY - dragState.startY;
            const dLon = dx / (MAP_CONSTANTS.baseScale * zoom); const dLat = -dy / (MAP_CONSTANTS.baseScale * 1.1 * zoom);
            if (dragState.type === 'hub' && setHubs) {
                setHubs(prev => ({...prev, [dragState.id]: { ...prev[dragState.id], lat: dragState.startLat + dLat, lon: dragState.startLon + dLon }}));
            } else if (dragState.type === 'cluster' && setClusters) {
                setClusters(prev => ({...prev, [dragState.id]: { ...prev[dragState.id], lat: dragState.startLat + dLat, lon: dragState.startLon + dLon }}));
            }
        } else if (isDragging) {
            setPan(prev => ({ x: prev.x + (e.clientX - lastPos.x), y: prev.y + (e.clientY - lastPos.y) }));
            setLastPos({ x: e.clientX, y: e.clientY });
        }
    };
    
    const handleMouseUp = () => { setIsDragging(false); setDragState(null); };
    const handleMouseLeave = () => { setIsDragging(false); setDragState(null); };

    const exportMapAsImage = () => {
        const svgElement = containerRef.current?.querySelector('svg#ccus-main-map');
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
            a.download = 'CCUS_Pipeline_Map.png'; 
            a.href = canvas.toDataURL('image/png'); 
            a.click();
        }; 
    };

    const textScale = Math.pow(zoom, 0.7);

    return (
        <div className="w-full h-full relative bg-slate-50/80 rounded-lg overflow-hidden border border-slate-200" ref={containerRef}>
            <div className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur shadow-2xl rounded-xl border border-slate-200 p-4 transition-all duration-300 w-80 pointer-events-none" style={{ opacity: hoveredNode ? 1 : 0, transform: hoveredNode ? 'translateY(0)' : 'translateY(-10px)' }}>
                {hoveredNode && hoveredNode.nodeType === 'hub' && (
                    <div>
                        <div className="flex items-center gap-2 mb-3 border-b border-blue-100 pb-2">
                            {hoveredNode.name.includes('接收站') ? <Ship size={18} className="text-blue-600"/> : hoveredNode.name.includes('鐵砧山') ? <MapPin size={18} className="text-amber-700"/> : <Anchor size={18} className="text-blue-600"/>}
                            <h3 className="font-bold text-slate-800 text-sm">{hoveredNode.name}</h3>
                        </div>
                        <div className="bg-blue-50 p-2 rounded border border-blue-100 mb-2">
                            <div className="text-xs font-bold text-blue-800 mb-1">樞紐定位 (可拖曳)</div>
                            <div className="text-xs text-blue-700">{hoveredNode.hubType}</div>
                        </div>
                        {ccsTopology && ccsTopology.hubEmissions && ccsTopology.hubEmissions[hoveredNode.id] > 0 && (
                             <div className="bg-slate-50 p-2 rounded border border-slate-200 flex justify-between items-center">
                                 <span className="text-slate-600 text-xs font-bold">預估接收總量</span><span className="font-mono font-black text-blue-600 text-sm">{(Number(ccsTopology.hubEmissions[hoveredNode.id] || 0) / 10000).toFixed(1)} 萬噸</span>
                             </div>
                        )}
                    </div>
                )}
                {hoveredNode && hoveredNode.nodeType === 'cluster' && (
                    <div>
                        <div className="flex items-center gap-2 mb-3 border-b border-indigo-100 pb-2">
                            <Layers size={18} className="text-indigo-600"/>
                            <h3 className="font-bold text-slate-800 text-sm">{hoveredNode.name}</h3>
                        </div>
                        <div className="bg-indigo-50 p-2 rounded border border-indigo-100 mb-2">
                            <div className="text-xs font-bold text-indigo-800 mb-1">中繼站定位 (可拖曳)</div>
                            <div className="text-xs text-indigo-700">區域管線匯集中心</div>
                        </div>
                        <div className="bg-slate-50 p-2 rounded border border-slate-200 flex justify-between items-center">
                            <span className="text-slate-600 text-xs font-bold">區域匯集碳排</span><span className="font-mono font-black text-indigo-600 text-sm">{(Number(hoveredNode.emissions || 0) / 10000).toFixed(1)} 萬噸</span>
                        </div>
                    </div>
                )}
                {hoveredNode && hoveredNode.nodeType === 'planning_source' && (
                    <div>
                        <div className="flex items-center gap-2 mb-3 border-b border-rose-100 pb-2">
                            <Factory size={16} className={hoveredNode.isPriority ? "text-rose-600" : "text-orange-500"}/>
                            <h3 className="font-bold text-slate-800 text-sm truncate">{hoveredNode.Company} <span className="text-slate-500 font-medium">{hoveredNode.Plant}</span></h3>
                        </div>
                        <div className="space-y-1.5 text-xs text-slate-600">
                            <div className="flex justify-between items-center"><span className="text-slate-400">隸屬聚落</span> <span className="font-bold text-slate-700">{hoveredNode.zone}</span></div>
                            <div className="flex justify-between items-center"><span className="text-slate-400">管線狀態</span> <span className={`font-bold ${hoveredNode.distanceToHub < 0 ? 'text-slate-400' : 'text-emerald-600'}`}>{hoveredNode.distanceToHub < 0 ? '距離過遠，未納入管網' : `已連線 (${(Number(hoveredNode.distanceToHub)||0).toFixed(1)}km)`}</span></div>
                            <div className="mt-2 bg-rose-50 p-2 rounded-lg border border-rose-100 flex flex-col gap-1">
                                <div className="flex justify-between items-center"><span className="text-rose-800 font-bold">總排 (範1+2)</span><span className="font-mono font-black text-rose-600 text-sm">{(Number(hoveredNode.TotalScope || 0) / 10000).toFixed(1)} <span className="text-[10px] font-normal">萬噸</span></span></div>
                                <div className="flex justify-between items-center text-xs mt-1 pt-1 border-t border-rose-200/50"><span className="text-rose-600 font-bold">範疇一 (可CCS)</span><span className="font-mono text-rose-600 font-bold">{(Number(hoveredNode.Scope1 || 0) / 10000).toFixed(1)} 萬噸</span></div>
                            </div>
                        </div>
                    </div>
                )}
                {hoveredNode && hoveredNode.nodeType === 'capture' && (
                    <div>
                        <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                            <Factory size={16} className="text-blue-600"/>
                            <h3 className="font-bold text-slate-800 text-sm truncate">{hoveredNode.Company} <span className="text-slate-500 font-medium">{hoveredNode.Plant}</span></h3>
                        </div>
                        <div className="space-y-1.5 text-xs text-slate-600">
                            <div className="flex justify-between items-center"><span className="text-slate-400">來源製程</span> <span className="font-bold text-slate-700">{hoveredNode.Capture_Source || '-'}</span></div>
                            <div className="flex justify-between items-center"><span className="text-slate-400">捕捉技術</span> <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{hoveredNode.Capture_Tech || '-'} (TRL {hoveredNode.TRL})</span></div>
                            <div className="mt-2 bg-blue-50 p-2 rounded-lg border border-blue-100 space-y-1 text-xs">
                                <div className="flex justify-between"><span className="text-slate-500">總捕捉量(A):</span><span className="font-mono font-bold text-slate-700">{Number(hoveredNode.Capture_Volume||0).toFixed(2)} 萬噸</span></div>
                                <div className="flex justify-between"><span className="text-rose-500">設備耗能(B):</span><span className="font-mono font-bold text-rose-600">-{Number(hoveredNode.Captur_energy||0).toFixed(2)} 萬噸</span></div>
                                <div className="flex justify-between pt-1 border-t border-blue-200 mt-1"><span className="text-blue-800 font-bold">淨捕捉量(=A-B)</span><span className="font-mono font-black text-blue-700">{Number(hoveredNode.Net_Capture_Volume||0).toFixed(2)} 萬噸</span></div>
                            </div>
                        </div>
                    </div>
                )}
                {hoveredNode && hoveredNode.nodeType === 'future' && (
                     <div>
                        <div className="flex items-center gap-2 mb-3 border-b border-amber-100 pb-2">
                            <Rocket size={16} className="text-amber-600"/><h3 className="font-bold text-slate-800 text-sm truncate">{hoveredNode.Company} <span className="text-slate-500 font-medium">{hoveredNode.Plant}</span></h3>
                        </div>
                        <div className="space-y-1.5 text-xs text-slate-600">
                            <div className="flex justify-between items-center"><span className="text-slate-400">潛在安裝來源</span> <span className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{hoveredNode.Potential_Source || '-'}</span></div>
                            <div className="mt-2 flex justify-between items-center bg-amber-50 p-2 rounded-lg border border-amber-200">
                                <span className="text-amber-800 font-bold">未來總排放潛力</span><span className="font-mono font-black text-amber-600 text-sm">{Number(hoveredNode.Future_Emission_Volume||0).toFixed(1)} <span className="text-[10px] font-normal">萬噸</span></span>
                            </div>
                        </div>
                     </div>
                )}
                {hoveredNode && hoveredNode.nodeType === 'util' && (
                    <div>
                        <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                            <FlaskConical size={16} className="text-emerald-600"/><h3 className="font-bold text-slate-800 text-sm truncate">{hoveredNode.Target_Company} <span className="text-slate-500 font-medium">{hoveredNode.Target_Plant}</span></h3>
                        </div>
                        <div className="space-y-1.5 text-xs text-slate-600">
                            <div className="flex justify-between items-center"><span className="text-slate-400">再利用技術</span> <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">{hoveredNode.Conversion_Tech || '-'}</span></div>
                            <div className="mt-2 flex justify-between items-center bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                                <span className="text-emerald-800 font-bold">預期總需求</span><span className="font-mono font-black text-emerald-600 text-sm">{Number(hoveredNode.Expected_Demand||0).toFixed(1)} <span className="text-[10px] font-normal">萬噸</span></span>
                            </div>
                        </div>
                    </div>
                )}
                {hoveredNode && hoveredNode.nodeType === 'storage' && (
                    <div>
                        <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                            <Box size={16} className="text-rose-600"/><h3 className="font-bold text-slate-800 text-sm truncate">{hoveredNode.Storage_Site}</h3>
                        </div>
                        <div className="space-y-1.5 text-xs text-slate-600">
                            <div className="flex justify-between items-center"><span className="text-slate-400">碳源公司</span> <span className="font-bold text-slate-700">{hoveredNode.Source_Company}</span></div>
                            <div className="mt-2 flex justify-between items-center bg-rose-50 p-2 rounded-lg border border-rose-100">
                                <span className="text-rose-800 font-bold">可封存總量</span><span className="font-mono font-black text-rose-600 text-sm">{Number(hoveredNode.Capturable_Volume||0).toFixed(1)} <span className="text-[10px] font-normal">萬噸</span></span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 控制面板：不參與匯出 */}
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-white/95 p-1.5 rounded-lg shadow-sm border border-slate-200 backdrop-blur">
                <button onClick={() => setZoom(prev => Math.min(prev * 1.3, 10))} className="p-2 bg-slate-50 hover:bg-slate-200 rounded-md text-slate-600 transition-colors" title="放大"><ZoomIn size={18}/></button>
                <button onClick={() => setZoom(prev => Math.max(prev / 1.3, 0.5))} className="p-2 bg-slate-50 hover:bg-slate-200 rounded-md text-slate-600 transition-colors" title="縮小"><ZoomOut size={18}/></button>
                <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-2 bg-slate-50 hover:bg-slate-200 rounded-md text-slate-600 transition-colors" title="重置畫面"><Maximize size={18}/></button>
                <div className="w-full h-px bg-slate-200 my-1"></div>
                <button onClick={exportMapAsImage} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md transition-colors" title="輸出高品質圖片"><DownloadCloud size={18}/></button>
            </div>

            <svg id="ccus-main-map" viewBox={`0 0 ${baseWidth} ${baseHeight}`} className={`w-full h-full select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${dragState ? 'cursor-move' : ''}`} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseLeave} ref={mapRef}>
                <g transform={`translate(${baseWidth/2 + pan.x}, ${baseHeight/2 + pan.y}) scale(${zoom})`}>
                    {mapPaths.map((p, i) => p.d && <path key={`map-${i}`} d={p.d} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={1.5 / zoom} />)}

                    {activeLayers.includes('planning') && ccsTopology && (
                        <>
                            {ccsTopology.seaRoutes.map((route, i) => {
                                const [x1, y1] = projectBase(route.from.lon, route.from.lat); const [x2, y2] = projectBase(route.to.lon, route.to.lat);
                                const [cx1, cy1] = projectBase(route.c1.lon, route.c1.lat); const [cx2, cy2] = projectBase(route.c2.lon, route.c2.lat);
                                if (x1 === -9999 || x2 === -9999 || cx1 === -9999) return null;
                                const midX = 0.125*x1 + 0.375*cx1 + 0.375*cx2 + 0.125*x2; const midY = 0.125*y1 + 0.375*cy1 + 0.375*cy2 + 0.125*y2;
                                return (
                                    <g key={`sea-route-${i}`}>
                                        <path d={`M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`} stroke="#0284c7" strokeWidth={Math.max(2, Math.log10(Math.max(10000, route.weight))/zoom)} strokeDasharray={`${6/zoom} ${6/zoom}`} fill="none" opacity={0.6}/>
                                        <text x={midX} y={midY} fontSize={11/zoom} fill="#0369a1" textAnchor="middle" fontWeight="bold" style={{textShadow: '0 0 3px white', pointerEvents: 'none'}}>{route.label}</text>
                                    </g>
                                );
                            })}
                            {ccsTopology.branchRoutes.map((route, i) => {
                                const [x1, y1] = projectBase(route.from.lon, route.from.lat); const [x2, y2] = projectBase(route.to.lon, route.to.lat);
                                if (x1 === -9999 || x2 === -9999) return null;
                                const strokeColor = route.isPriority ? "#94a3b8" : "#cbd5e1"; const strokeW = (route.isPriority ? 1.5 : 1) / zoom;
                                const opac = route.isPriority ? 0.6 : 0.4; const dash = route.isPriority ? "none" : `${3/zoom} ${3/zoom}`;
                                return (<path key={`branch-${i}`} d={generateTreePath(x1, y1, x2, y2, true, route.inlandCurve)} stroke={strokeColor} strokeWidth={strokeW} strokeDasharray={dash} fill="none" opacity={opac} />);
                            })}
                            {ccsTopology.mainRoutes.map((route, i) => {
                                const pathNodes = route.nodes.map(n => projectBase(n.lon, n.lat));
                                if (pathNodes.some(n => n[0] === -9999)) return null;
                                let pathD = `M ${pathNodes[0][0]} ${pathNodes[0][1]} `;
                                for (let j = 1; j < pathNodes.length; j++) pathD += `L ${pathNodes[j][0]} ${pathNodes[j][1]} `;
                                const strokeColor = route.isUnrealistic ? "#f97316" : "#3b82f6"; const textColor = route.isUnrealistic ? "#c2410c" : "#1e40af";
                                const midIdx = Math.floor(pathNodes.length / 2); const midX = pathNodes[midIdx][0]; const midY = pathNodes[midIdx][1];
                                return (
                                    <g key={`main-route-${i}`}>
                                        <path d={pathD} stroke={strokeColor} strokeWidth={Math.max(2, Math.log10(Math.max(10000, route.weight)))/zoom} strokeDasharray={`${6/zoom} ${4/zoom}`} fill="none" strokeLinejoin="round" opacity={route.isUnrealistic ? 0.7 : 0.85}/>
                                        {pathNodes.slice(1, -1).map((n, idx) => (<circle key={`node-${idx}`} cx={n[0]} cy={n[1]} r={2/zoom} fill="#fff" stroke={strokeColor} strokeWidth={1/zoom}/>))}
                                        <text x={midX} y={midY - (6/zoom)} fontSize={10/zoom} fill={textColor} textAnchor="middle" fontWeight="bold" style={{textShadow: '0 0 3px white', pointerEvents: 'none'}}>{Number(route.distance||0).toFixed(0)} km</text>
                                    </g>
                                );
                            })}
                            {clusters && Object.values(clusters).map((cluster, i) => {
                                if (cluster.emissions <= 0) return null;
                                const [cx, cy] = projectBase(cluster.lon, cluster.lat);
                                if (cx === -9999) return null;
                                const isDragged = dragState && dragState.id === cluster.id;
                                return (
                                    <g key={`cluster-${i}`} className={isDragged ? "cursor-grabbing" : "cursor-grab hover:scale-125 transition-transform"} onMouseEnter={() => setHoveredNode({...cluster, nodeType: 'cluster'})} onMouseLeave={() => setHoveredNode(null)} onMouseDown={(e) => handleNodeMouseDown(e, cluster.id, 'cluster')}>
                                        <polygon points={`${cx},${cy - 6/zoom} ${cx + 6/zoom},${cy} ${cx},${cy + 6/zoom} ${cx - 6/zoom},${cy}`} fill="#818cf8" stroke={isDragged ? "#fcd34d" : "white"} strokeWidth={isDragged ? 2/zoom : 1/zoom} style={{ filter: 'drop-shadow(0px 2px 2px rgba(0,0,0,0.3))' }} />
                                    </g>
                                );
                            })}
                            {hubs && Object.values(hubs).map((hub, i) => {
                                const [cx, cy] = projectBase(hub.lon, hub.lat);
                                if (cx === -9999) return null;
                                const isLandHub = hub.id === 'CENTRAL_HUB_LAND'; const isDragged = dragState && dragState.id === hub.id;
                                return (
                                    <g key={`hub-${i}`} className={isDragged ? "cursor-grabbing" : "cursor-grab hover:scale-110 transition-transform"} onMouseEnter={() => setHoveredNode({...hub, nodeType: 'hub', hubType: hub.type})} onMouseLeave={() => setHoveredNode(null)} onMouseDown={(e) => handleNodeMouseDown(e, hub.id, 'hub')}>
                                        <rect x={cx - 10/zoom} y={cy - 10/zoom} width={20/zoom} height={20/zoom} fill={isLandHub ? "#b45309" : "#0ea5e9"} stroke={isDragged ? "#fbbf24" : "white"} strokeWidth={isDragged ? 3/zoom : 2/zoom} style={{ filter: 'drop-shadow(0px 3px 4px rgba(0,0,0,0.4))' }} />
                                        <text x={cx + 14/zoom} y={cy + 4/zoom} fontSize={12/textScale} fill={isLandHub ? "#78350f" : "#0369a1"} fontWeight="900" paintOrder="stroke" stroke="white" strokeWidth={3/textScale} className="pointer-events-none">{hub.name}</text>
                                    </g>
                                );
                            })}
                            {ccsTopology.validSources.map((d, i) => {
                                const [cx, cy] = projectBase(d.lon, d.lat);
                                if (cx === -9999) return null;
                                const r = Math.max(d.isPriority ? 4 : 2, Math.min(d.isPriority ? 15 : 8, Math.sqrt(Math.max(0, d.Scope1 || 0) / 50000))) / zoom;
                                const isHovered = hoveredNode?.Company === d.Company && hoveredNode?.Plant === d.Plant;
                                const isConnected = d.distanceToHub >= 0;
                                const fillCol = d.isPriority ? "#e11d48" : "#f97316"; 
                                const opac = isHovered ? 1 : (isConnected ? 1 : 0.3);
                                return (
                                    <g key={`s1-${i}`} className="cursor-pointer transition-all" onMouseEnter={() => setHoveredNode({...d, nodeType: 'planning_source'})} onMouseLeave={() => setHoveredNode(null)}>
                                        <circle cx={cx} cy={cy} r={Math.max(r, 15/zoom)} fill="transparent" />
                                        {d.isPriority && isConnected && <circle cx={cx} cy={cy} r={r * 1.5} fill={fillCol} opacity={0.3} />}
                                        <circle cx={cx} cy={cy} r={r} fill={fillCol} fillOpacity={opac} stroke={isConnected ? "white" : "transparent"} strokeWidth={(d.isPriority ? 1.5 : 1) / zoom} style={d.isPriority && isConnected ? { filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.5))' } : {}} />
                                    </g>
                                );
                            })}
                        </>
                    )}

                    {activeLayers.includes('capture') && captureData.map((d, i) => {
                        const [cx, cy] = projectBase(d.Longitude, d.Latitude); if (cx === -9999) return null;
                        const r = Math.max(6, Math.min(25, Math.sqrt(Math.max(0, d.Capture_Volume || 0)) * 1.5)) / zoom; 
                        const isHovered = hoveredNode?.Company === d.Company;
                        return (
                            <g key={`cap-${i}`} className="cursor-pointer transition-all" onMouseEnter={() => setHoveredNode({...d, nodeType:'capture'})} onMouseLeave={() => setHoveredNode(null)}>
                                <circle cx={cx} cy={cy} r={Math.max(r, 20/zoom)} fill="transparent" />
                                <circle cx={cx} cy={cy} r={r} fill={stringToColor(d.Capture_Tech)} fillOpacity={isHovered ? 1 : 0.85} stroke="white" strokeWidth={1.5 / zoom} style={{ filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.3))' }} />
                                <text x={cx + r + (4/zoom)} y={cy + (3/zoom)} fontSize={11 / textScale} fill="#1e293b" fontWeight="900" paintOrder="stroke" stroke="white" strokeWidth={3/textScale} strokeLinejoin="round" className="pointer-events-none">{d.Company}</text>
                            </g>
                        );
                    })}

                    {activeLayers.includes('future') && captureData.map((d, i) => {
                        const [cx, cy] = projectBase(d.Longitude, d.Latitude); if (cx === -9999) return null;
                        const r = Math.max(6, Math.min(25, Math.sqrt(Math.max(0, d.Future_Emission_Volume || 0)) * 1.5)) / zoom; 
                        const isHovered = hoveredNode?.Company === d.Company;
                        return (
                            <g key={`fut-${i}`} className="cursor-pointer transition-all" onMouseEnter={() => setHoveredNode({...d, nodeType:'future'})} onMouseLeave={() => setHoveredNode(null)}>
                                <circle cx={cx} cy={cy} r={Math.max(r, 20/zoom)} fill="transparent" />
                                <circle cx={cx} cy={cy} r={r} fill="#d97706" fillOpacity={isHovered ? 1 : 0.75} stroke="white" strokeWidth={1.5 / zoom} strokeDasharray={`${3/zoom} ${3/zoom}`} />
                            </g>
                        );
                    })}

                    {activeLayers.includes('util') && utilData.map((d, i) => {
                        const findCoords = (c, p) => captureData.find(x => x.Company === c && x.Plant === p) || { Latitude: 23.6, Longitude: 120.9 };
                        const coords = findCoords(d.Target_Company, d.Target_Plant);
                        const [cx, cy] = projectBase(coords.Longitude, coords.Latitude); if (cx === -9999) return null;
                        const r = Math.max(8, Math.min(20, Math.sqrt(Math.max(0, d.Expected_Demand || 0)) * 2)) / zoom;
                        const isHovered = hoveredNode?.Target_Company === d.Target_Company;
                        return (
                            <g key={`util-${i}`} className="cursor-pointer transition-all" onMouseEnter={() => setHoveredNode({...d, nodeType:'util'})} onMouseLeave={() => setHoveredNode(null)}>
                                <circle cx={cx} cy={cy} r={Math.max(r, 20/zoom)} fill="transparent" />
                                <circle cx={cx} cy={cy} r={r} fill="#10b981" fillOpacity={isHovered ? 1 : 0.9} stroke="white" strokeWidth={2 / zoom} style={{ filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.3))' }}/>
                                <text x={cx + r + (4/zoom)} y={cy + (3/zoom)} fontSize={11 / textScale} fill="#064e3b" fontWeight="900" paintOrder="stroke" stroke="white" strokeWidth={3/textScale} strokeLinejoin="round" className="pointer-events-none">{d.Target_Company}</text>
                            </g>
                        );
                    })}

                    {activeLayers.includes('storage') && storageData.map((d, i) => {
                        const findCoords = (c) => captureData.find(x => x.Company === c) || { Latitude: 23.6, Longitude: 120.9 };
                        const srcCoords = findCoords(d.Source_Company);
                        const [x1, y1] = projectBase(srcCoords.Longitude, srcCoords.Latitude); if (x1 === -9999) return null;
                        const [x2, y2] = projectBase(srcCoords.Longitude - 0.5, srcCoords.Latitude - 0.2); 
                        const isPipe = String(d.Transport_Method).includes('管線');
                        const isHovered = hoveredNode?.Storage_Site === d.Storage_Site;
                        return (
                            <g key={`sto-${i}`} className="cursor-pointer transition-all" onMouseEnter={() => setHoveredNode({...d, nodeType:'storage'})} onMouseLeave={() => setHoveredNode(null)}>
                                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={isPipe ? "#3b82f6" : "#f59e0b"} strokeWidth={3 / zoom} strokeDasharray={isPipe ? "0" : `${6/zoom} ${6/zoom}`} opacity={isHovered ? 1 : 0.6}/>
                                <circle cx={x1} cy={y1} r={4 / zoom} fill="#64748b" />
                                <circle cx={x2} cy={y2} r={10 / zoom} fill="#ef4444" fillOpacity={isHovered ? 1 : 0.9} stroke="white" strokeWidth={2 / zoom} style={{ filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.3))' }}/>
                                <text x={x2 + (12/zoom)} y={y2 + (4/zoom)} fontSize={12 / textScale} fill="#991b1b" fontWeight="900" paintOrder="stroke" stroke="white" strokeWidth={3/textScale} strokeLinejoin="round" className="pointer-events-none">{d.Storage_Site}</text>
                            </g>
                        );
                    })}
                </g>

                {activeLayers.includes('planning') && (
                    <g transform={`translate(20, ${baseHeight - 270})`}>
                        <rect x="0" y="0" width="310" height="250" fill="rgba(255,255,255,0.95)" rx="10" stroke="#e2e8f0" strokeWidth="1.5" />
                        <rect x="15" y="20" width="12" height="12" fill="#0ea5e9" stroke="white" strokeWidth="1" />
                        <text x="35" y="30" fontSize="12" fill="#334155" fontWeight="bold">海洋接收站 / 本土封存樞紐 (可拖曳)</text>
                        <rect x="15" y="45" width="12" height="12" fill="#b45309" stroke="white" strokeWidth="1" />
                        <text x="35" y="55" fontSize="12" fill="#334155" fontWeight="bold">陸地封存場域 (可拖曳)</text>
                        <line x1="15" y1="70" x2="295" y2="70" stroke="#e2e8f0" strokeWidth="1" />
                        <circle cx="21" cy="85" r="6" fill="#e11d48" stroke="white" strokeWidth="1" />
                        <text x="35" y="90" fontSize="12" fill="#334155" fontWeight="bold">優先碳源 (≥ 2.5萬噸)</text>
                        <circle cx="21" cy="110" r="4" fill="#f97316" opacity="0.8" />
                        <text x="35" y="115" fontSize="12" fill="#334155" fontWeight="bold">次要碳源 (&lt; 2.5萬噸)</text>
                        <line x1="15" y1="130" x2="295" y2="130" stroke="#e2e8f0" strokeWidth="1" />
                        <polygon points="21,146 25,152 21,158 17,152" fill="#818cf8" stroke="white" strokeWidth="1" />
                        <text x="35" y="156" fontSize="12" fill="#334155" fontWeight="bold">內陸中繼節點 (可拖曳修改路徑)</text>
                        <line x1="15" y1="175" x2="40" y2="175" stroke="#3b82f6" strokeWidth="3" strokeDasharray="6 4" />
                        <text x="45" y="179" fontSize="12" fill="#334155" fontWeight="bold">擬真主幹預估 (&gt;50km以橘色警告)</text>
                        <path d="M 15 200 Q 27.5 200, 40 195" stroke="#94a3b8" strokeWidth="2" fill="none" />
                        <text x="45" y="204" fontSize="12" fill="#334155" fontWeight="bold">有效廠區支線 (優先≤50km,次要≤20km)</text>
                        <line x1="15" y1="225" x2="40" y2="225" stroke="#0284c7" strokeWidth="2" strokeDasharray="6 6" opacity="0.6" />
                        <text x="45" y="229" fontSize="12" fill="#334155" fontWeight="bold">樞紐海運外繞航線</text>
                    </g>
                )}

                {!activeLayers.includes('planning') && (
                    <g transform={`translate(20, ${baseHeight - (30 + activeLayers.length * 30)})`}>
                        <rect x="0" y="0" width="220" height={20 + activeLayers.length * 30} fill="rgba(255,255,255,0.95)" rx="10" stroke="#e2e8f0" strokeWidth="1.5" />
                        {activeLayers.map((layer, idx) => {
                            const yOffset = 25 + idx * 30;
                            if (layer === 'capture') return (
                                <g key={layer} transform={`translate(15, ${yOffset})`}>
                                    <circle cx="6" cy="-4" r="5" fill="#3b82f6" stroke="white" strokeWidth="1" />
                                    <text x="20" y="0" fontSize="12" fill="#334155" fontWeight="bold">捕捉端 (依捕捉量)</text>
                                </g>
                            );
                            if (layer === 'future') return (
                                <g key={layer} transform={`translate(15, ${yOffset})`}>
                                    <circle cx="6" cy="-4" r="5" fill="transparent" stroke="#d97706" strokeWidth="2" strokeDasharray="3 3" />
                                    <text x="20" y="0" fontSize="12" fill="#334155" fontWeight="bold">潛力擴充點源</text>
                                </g>
                            );
                            if (layer === 'util') return (
                                <g key={layer} transform={`translate(15, ${yOffset})`}>
                                    <circle cx="6" cy="-4" r="5" fill="#10b981" stroke="white" strokeWidth="1" />
                                    <text x="20" y="0" fontSize="12" fill="#334155" fontWeight="bold">再利用端 (依需求量)</text>
                                </g>
                            );
                            if (layer === 'storage') return (
                                <g key={layer} transform={`translate(15, ${yOffset})`}>
                                    <circle cx="6" cy="-4" r="6" fill="#ef4444" stroke="white" strokeWidth="1" />
                                    <text x="20" y="0" fontSize="12" fill="#334155" fontWeight="bold">封存場域與專案管線</text>
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

const CcusDashboard = () => {
    const [activeTab, setActiveTab] = useState('planning'); 
    const [facilitySubTab, setFacilitySubTab] = useState('all'); 
    const [captureData, setCaptureData] = useState([]);
    const [utilizationData, setUtilizationData] = useState([]);
    const [storageData, setStorageData] = useState([]);
    const [scope1Data, setScope1Data] = useState([]); 
    const [mapPaths, setMapPaths] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState('ALL');
    const [transportMode, setTransportMode] = useState('ALL');
    
    const [hubs, setHubs] = useState(INITIAL_CCS_HUBS);
    const [clusters, setClusters] = useState(INITIAL_CLUSTERS);

    const [listRegion, setListRegion] = useState('ALL');
    const [listIndustry, setListIndustry] = useState('ALL');
    const [selectedHubId, setSelectedHubId] = useState('NORTH_HUB');

    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);
            try {
                const [resCap, resUtil, resStore, resScope1, resGeo] = await Promise.all([
                    fetch(CCUS_DATA_SOURCES.CAPTURE), fetch(CCUS_DATA_SOURCES.UTILIZATION),
                    fetch(CCUS_DATA_SOURCES.STORAGE), fetch(CCUS_DATA_SOURCES.SCOPE1_URL).catch(() => null),
                    fetch('https://raw.githubusercontent.com/g0v/twgeojson/master/json/twCounty2010.geo.json').catch(() => null)
                ]);

                const txtCap = await resCap.text(); const txtUtil = await resUtil.text();
                const txtStore = await resStore.text(); const txtScope1 = resScope1 ? await resScope1.text() : '';

                if (resGeo) {
                    const geoData = await resGeo.json();
                    const paths = geoData.features.map(f => {
                        let d = '';
                        const pr = (ring) => { 
                            if(!ring || ring.length === 0) return; const [x,y] = projectBase(ring[0][0], ring[0][1]); if (x === -9999) return; 
                            d += `M${x},${y} `; for(let i=1; i<ring.length; i++){ const [lx,ly] = projectBase(ring[i][0], ring[i][1]); if(lx !== -9999) d += `L${lx},${ly} `; } d += 'Z '; 
                        };
                        if(f.geometry.type === 'Polygon') f.geometry.coordinates.forEach(pr); else if(f.geometry.type === 'MultiPolygon') f.geometry.coordinates.forEach(p => p.forEach(pr));
                        return { d };
                    });
                    setMapPaths(paths);
                }

                const rawCap = parseCSV(txtCap); const rawUtil = parseCSV(txtUtil);
                const rawStore = parseCSV(txtStore); const rawScope1 = parseCSV(txtScope1);

                setScope1Data(rawScope1.map(d => {
                    const keys = Object.keys(d);
                    const nameKey = keys.find(k => k.includes('事業名稱') || k.includes('公司名稱') || k.includes('廠區')) || '事業名稱';
                    const emit1Key = keys.find(k => k.includes('直接排放') || k.includes('範疇一') || k.includes('Scope 1') || k === '直接排放量(公噸CO2e)') || '直接排放量(公噸CO2e)';
                    const emit2Key = keys.find(k => k.includes('間接排放') || k.includes('範疇二') || k.includes('Scope 2') || k === '能源間接排放量(公噸CO2e)') || '能源間接排放量(公噸CO2e)';
                    const emitTotalKey = keys.find(k => k.includes('合計排放') || k.includes('總排') || k === '合計排放量(公噸CO2e)') || '合計排放量(公噸CO2e)';
                    const indKey = keys.find(k => k.includes('七大製造業') || k.includes('行業分類')) || '行業分類';
                    const countyKey = keys.find(k => k.includes('縣市別') || k.includes('地址') || k.includes('所在')) || '縣市別';

                    const rawName = String(d[nameKey] || '').trim(); if (!rawName) return null;
                    const comp = simplifyCompanyName(rawName);
                    const plantRaw = rawName.replace(d['公司'] || '', '').replace(comp, '').replace(/股份有限公司|工業|企業|分公司/g, '').trim(); 
                    
                    let countyStr = String(d[countyKey] || '').trim();
                    const countyMatch = countyStr.match(/(基隆|台北|臺北|新北|桃園|新竹|苗栗|台中|臺中|彰化|南投|雲林|嘉義|台南|臺南|高雄|屏東|宜蘭|花蓮|台東|臺東)/);
                    if (countyMatch) countyStr = countyMatch[0].replace('臺', '台'); else countyStr = '未知';

                    const coords = getApproximateCoordinates(plantRaw, comp, countyStr);
                    const zone = getIndustrialZone(plantRaw, comp, countyStr);
                    const region = getRefinedRegion(plantRaw, comp, countyStr);
                    const scope1Val = cleanNumber(d[emit1Key]); const scope2Val = cleanNumber(d[emit2Key]); const totalVal = cleanNumber(d[emitTotalKey]) || (scope1Val + scope2Val);

                    return { Company: comp, Plant: rawName, Scope1: scope1Val, Scope2: scope2Val, TotalScope: totalVal, Industry: d[indKey] || '', County: countyStr, zone, Region: region, lat: coords.lat, lon: coords.lon };
                }).filter(d => {
                    if (!d || d.TotalScope <= 0) return false;
                    const scope2Ratio = d.Scope2 / d.TotalScope;
                    if (scope2Ratio > 0.7 && d.Scope1 < 50000) return false; 
                    return true; 
                }).sort((a,b) => b.Scope1 - a.Scope1)); 

                setCaptureData(rawCap.map(d => {
                    const capVol = cleanNumber(d.Capture_Volume); const capEng = cleanNumber(d.Captur_energy || d.Emission_Per_Ton); 
                    return {
                        ...d, Year: String(d.Year || '2025'), Label: `${simplifyCompanyName(d.Company)} ${d.Plant}`,
                        Latitude: cleanNumber(d.Latitude), Longitude: cleanNumber(d.Longitude), Capture_Tech: d.Capture_Tech || '未知技術',
                        Capture_Volume: capVol, Captur_energy: capEng, Net_Capture_Volume: cleanNumber(d.Net_Capture_Volume) || Math.max(0, capVol - capEng),
                        TRL: String(d.TRL || '-'), Capture_Source: d.Capture_Source || '', Separation_Tech: d.Separation_Tech || '',
                        Temperature: d.Temperature || '', Pressure: d.Pressure || '', Concentration: d.Concentration || '', Potential_Source: d.Potential_Source || '',
                        Future_Emission_Volume: cleanNumber(d.Future_Emission_Volume), Future_Temperature: d.Future_Temperature || '', Future_Pressure: d.Future_Pressure || '', Future_Concentration: d.Future_Concentration || ''
                    };
                }));

                setUtilizationData(rawUtil.map(d => {
                    const expDemand = cleanNumber(d.Expected_Demand);
                    return { ...d, Year: String(d.Year || '2025'), Expected_Demand: expDemand, Current_Demand: cleanNumber(d.Current_Demand), Product_Generated: expDemand * (String(d.Conversion_Tech).includes('甲醇') ? 0.7 : 1.5), TRL: String(d.TRL || '-'), Target_Company: d.Target_Company || '', Target_Plant: d.Target_Plant || '', Conversion_Tech: d.Conversion_Tech || '' };
                }));

                setStorageData(rawStore.map(d => {
                    let mode = String(d.Transport_Method || ''); let dist = cleanNumber(d.Distance_km) || (mode.includes('海') ? 150 : 30); 
                    return { ...d, Year: String(d.Year || '2025'), Capturable_Volume: cleanNumber(d.Capturable_Volume), Distance_km: dist, Cost_USD_Per_Ton: cleanNumber(d.Cost_USD_Per_Ton), Transport_Method: mode, Concentration: d.Concentration || '', Process_Type: d.Process_Type || '', Source_Company: d.Source_Company || '', Storage_Site: d.Storage_Site || '' };
                }));

            } catch (err) { console.error(err); } finally { setLoading(false); }
        };
        fetchAllData();
    }, []);

    const availableYears = useMemo(() => Array.from(new Set([...captureData.map(d=>d.Year), ...utilizationData.map(d=>d.Year), ...storageData.map(d=>d.Year)])).filter(Boolean).sort(), [captureData, utilizationData, storageData]);
    const fCapture = useMemo(() => captureData.filter(d => selectedYear === 'ALL' || d.Year === selectedYear), [captureData, selectedYear]);
    const fUtil = useMemo(() => utilizationData.filter(d => selectedYear === 'ALL' || d.Year === selectedYear), [utilizationData, selectedYear]);
    const fStorage = useMemo(() => storageData.filter(d => selectedYear === 'ALL' || d.Year === selectedYear), [storageData, selectedYear]);

    const valueChainData = useMemo(() => {
        const map = {};
        const add = (comp, key, val) => {
            const c = simplifyCompanyName(comp);
            if (!map[c]) map[c] = { Company: c, Capture: 0, Future: 0, Util: 0, Storage: 0 };
            map[c][key] += (Number(val) || 0);
        };
        fCapture.forEach(d => { add(d.Company, 'Capture', d.Net_Capture_Volume); add(d.Company, 'Future', d.Future_Emission_Volume); });
        fUtil.forEach(d => { add(d.Target_Company, 'Util', d.Expected_Demand); });
        fStorage.forEach(d => { add(d.Source_Company, 'Storage', d.Capturable_Volume); });
        return Object.values(map).filter(d => d.Capture > 0 || d.Util > 0 || d.Storage > 0 || d.Future > 0).sort((a,b) => (b.Capture+b.Util+b.Storage) - (a.Capture+a.Util+a.Storage));
    }, [fCapture, fUtil, fStorage]);

    const ccsTopology = useMemo(() => {
        if (!scope1Data || scope1Data.length === 0) return null;
        const countyMap = { '基隆': 'C_TPE', '台北': 'C_TPE', '臺北': 'C_TPE', '新北': 'C_TPE', '桃園': 'C_TYN_COAST', '新竹': 'C_HSZ', '苗栗': 'C_MIA', '台中': 'C_TXG', '臺中': 'C_TXG', '南投': 'C_TXG', '雲林': 'C_YUN_IN', '嘉義': 'C_CYI', '台南': 'C_TNN', '臺南': 'C_TNN', '高雄': 'C_KHH_N', '屏東': 'C_PTG', '宜蘭': 'C_YIL', '花蓮': 'C_HUA', '台東': 'C_TTT', '臺東': 'C_TTT' };

        const activeClusters = JSON.parse(JSON.stringify(clusters));
        Object.keys(activeClusters).forEach(k => { activeClusters[k].id = k; activeClusters[k].emissions = 0; activeClusters[k].sources = []; });

        const hubSources = {}; Object.keys(hubs).forEach(k => hubSources[k] = []);
        const validSources = []; const branchRoutes = [];
        const hubEmissions = { NORTH_HUB: 0, CENTRAL_HUB_1: 0, CENTRAL_HUB_2: 0, CENTRAL_HUB_LAND: 0, SOUTH_HUB: 0, EAST_HUB: 0, SOUTHEAST_HUB: 0 };

        const allMainNodes = [];
        Object.values(activeClusters).forEach(c => allMainNodes.push({id: c.id, lat: c.lat, lon: c.lon, name: c.name}));
        Object.values(hubs).forEach(h => allMainNodes.push({id: h.id, lat: h.lat, lon: h.lon, name: h.name}));

        scope1Data.forEach(d => {
            d.isPriority = d.Scope1 >= 25000;
            let cId = countyMap[d.County]; if (!cId) return; 

            if (d.County.includes('桃園')) cId = d.lon < 121.15 ? 'C_TYN_COAST' : 'C_TYN_IN';
            else if (d.County.includes('高雄')) { if (d.lon > 120.38) cId = 'C_KHH_IN'; else cId = d.lat < 22.6 ? 'C_KHH_S' : 'C_KHH_N'; }
            else if (d.County.includes('彰化')) {
                const dist1 = calcDistanceKm(d.lat, d.lon, hubs['CENTRAL_HUB_1'].lat, hubs['CENTRAL_HUB_1'].lon);
                const dist2 = calcDistanceKm(d.lat, d.lon, hubs['CENTRAL_HUB_2'].lat, hubs['CENTRAL_HUB_2'].lon);
                cId = dist1 < dist2 ? 'C_CHW_N' : 'C_CHW_S';
            }

            const targetCluster = activeClusters[cId]; let bestNode = targetCluster; let minDist = calcDistanceKm(d.lat, d.lon, targetCluster.lat, targetCluster.lon);
            allMainNodes.forEach(node => { const nDist = calcDistanceKm(d.lat, d.lon, node.lat, node.lon); if (nDist < minDist && nDist < 30) { minDist = nDist; bestNode = node; } });

            const maxDist = d.isPriority ? 50 : 20; 
            if (minDist <= maxDist) {
                targetCluster.emissions += d.Scope1; targetCluster.sources.push({...d, distToCenter: minDist}); 
                validSources.push({...d, distToCenter: minDist, initialClusterId: cId}); 
                if (minDist > 0.002) branchRoutes.push({ from: d, to: bestNode, isPriority: d.isPriority, inlandCurve: d.lon < 121.5 });
            } else {
                validSources.push({...d, distanceToHub: -1});
            }
        });

        const getClusterDistToHub = (clusterId) => {
            let dist = 0; let curr = clusterId;
            while(curr && activeClusters[curr]) {
                let next = activeClusters[curr].next; if (!next) break;
                let fromNode = activeClusters[curr]; let toNode = activeClusters[next] || hubs[next];
                dist += estimateRoutingDistance(fromNode.lat, fromNode.lon, toNode.lat, toNode.lon, fromNode.type === 'sea'); curr = next;
            } return dist;
        };

        const edges = {}; 
        const addEdge = (fromNode, toNode, flow, type) => { const key = `${fromNode.id}_${toNode.id}`; if (!edges[key]) edges[key] = { from: fromNode, to: toNode, flow: 0, type, nodes: [fromNode, toNode] }; edges[key].flow += flow; };

        Object.values(activeClusters).forEach(cluster => {
            if (cluster.emissions <= 0) return;
            let flow = cluster.emissions; let curr = cluster;
            while(curr && curr.next) {
                let nextNode = activeClusters[curr.next] || hubs[curr.next]; if (!nextNode) break;
                addEdge(curr, nextNode, flow, curr.type);
                if (hubs[nextNode.id]) {
                    hubEmissions[nextNode.id] += flow;
                    cluster.sources.forEach(src => { hubSources[nextNode.id].push({ ...src, distanceToHub: src.distToCenter + getClusterDistToHub(cluster.id) }); });
                    break;
                }
                curr = activeClusters[nextNode.id];
            }
        });

        const mainRoutes = []; const seaRoutes = [];
        Object.values(edges).forEach(edge => {
            if (edge.flow <= 0) return;
            const dist = estimateRoutingDistance(edge.from.lat, edge.from.lon, edge.to.lat, edge.to.lon, edge.type === 'sea');
            if (edge.type === 'sea') {
                let c1 = edge.from, c2 = edge.to;
                if (edge.from.id === 'C_HUA' && edge.to.id === 'C_KEE_PORT') { c1 = {lat: 24.3, lon: 122.2}; c2 = {lat: 24.8, lon: 122.1}; }
                if (edge.from.id === 'C_KEE_PORT' && edge.to.id === 'NORTH_HUB') { c1 = {lat: 25.4, lon: 121.7}; c2 = {lat: 25.4, lon: 121.4}; }
                if (edge.from.id === 'C_YIL' && edge.to.id === 'NORTH_HUB') { c1 = {lat: 25.2, lon: 122.1}; c2 = {lat: 25.4, lon: 121.8}; }
                if (edge.from.id === 'C_TTT' && edge.to.id === 'SOUTH_HUB') { c1 = {lat: 21.8, lon: 121.2}; c2 = {lat: 21.8, lon: 120.5}; }
                seaRoutes.push({ ...edge, distance: dist, label: `海運 (${dist.toFixed(0)}km)`, c1, c2 });
            } else {
                const dx = edge.to.lon - edge.from.lon; const dy = edge.to.lat - edge.from.lat;
                const midNode = { lon: edge.from.lon + dx * 0.5 + (dx > 0 ? 0.05 : -0.05), lat: edge.from.lat + dy * 0.5 };
                mainRoutes.push({ ...edge, distance: dist, isUnrealistic: dist > 50, nodes: [edge.from, midNode, edge.to] });
            }
        });

        const activeClusterNodes = Object.values(activeClusters).filter(c => c.emissions > 0);
        return { mainRoutes, branchRoutes, seaRoutes, activeClusterNodes, hubSources, hubEmissions, validSources };
    }, [scope1Data, hubs, clusters]);

    const scope1Stats = useMemo(() => {
        let totalS1 = 0, totalS2 = 0, total = 0; const zones = {};
        scope1Data.forEach(d => {
            totalS1 += d.Scope1; totalS2 += d.Scope2; total += d.TotalScope;
            if(!zones[d.zone]) zones[d.zone] = { name: d.zone, Scope1: 0, Scope2: 0, Total: 0, region: d.Region };
            zones[d.zone].Scope1 += d.Scope1; zones[d.zone].Scope2 += d.Scope2; zones[d.zone].Total += d.TotalScope;
        });
        return { total, totalS1, totalS2, topZones: Object.values(zones).sort((a,b)=>b.Total - a.Total) };
    }, [scope1Data]);

    const regionalIndustryStats = useMemo(() => {
        const industryMap = {}; const dataToUse = ccsTopology ? ccsTopology.validSources : scope1Data;
        dataToUse.forEach(d => {
            if (listRegion !== 'ALL' && d.Region !== listRegion) return;
            const ind = d.Industry || '其他產業';
            if(!industryMap[ind]) industryMap[ind] = 0; industryMap[ind] += d.Scope1;
        });
        return Object.keys(industryMap).map(k => ({ name: k, value: industryMap[k] })).sort((a,b) => b.value - a.value);
    }, [ccsTopology, scope1Data, listRegion]);

    const availableIndustries = useMemo(() => ['ALL', ...Array.from(new Set(scope1Data.map(d => d.Industry))).filter(Boolean)], [scope1Data]);
    const filteredScope1Data = useMemo(() => {
        return scope1Data.filter(d => (listRegion === 'ALL' || d.Region === listRegion) && (listIndustry === 'ALL' || d.Industry === listIndustry));
    }, [scope1Data, listRegion, listIndustry]);

    const [listMode, setListMode] = useState('all'); 
    const [selectedHubId, setSelectedHubId] = useState('NORTH_HUB');
    
    // 修復了 ReferenceError：將變數正確指向 ccsTopology
    const selectedHubSources = useMemo(() => {
        if (!ccsTopology || !ccsTopology.hubSources[selectedHubId]) return [];
        return [...ccsTopology.hubSources[selectedHubId]].sort((a,b) => b.Scope1 - a.Scope1);
    }, [ccsTopology, selectedHubId]);

    const selectedHubTotalEmissions = useMemo(() => {
        if (!ccsTopology || !ccsTopology.hubEmissions[selectedHubId]) return 0;
        return ccsTopology.hubEmissions[selectedHubId];
    }, [ccsTopology, selectedHubId]);

    if (loading) return <div className="p-10 text-center animate-pulse text-teal-600 flex flex-col items-center"><RefreshCw className="animate-spin mb-2"/> CCUS 地理資料建構中...</div>;

    const activeLayersMap = {
        'all': ['capture', 'future', 'util', 'storage'],
        'capture': ['capture', 'future'],
        'utilization': ['util'],
        'storage': ['storage'],
        'planning': ['planning']
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10 min-h-screen p-4 bg-slate-50">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-lg text-teal-800 font-bold"><Leaf className="text-teal-500"/> CCUS 碳捕捉與封存戰情室</div>
                    <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="bg-slate-100 border border-slate-200 text-slate-700 font-bold px-3 py-1 rounded-lg outline-none cursor-pointer hover:bg-slate-200 transition-colors">
                        {availableYears.map(y => <option key={y} value={y}>{y}年</option>)}<option value="ALL">全年度</option>
                    </select>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl font-bold text-sm">
                    <button onClick={() => setActiveTab('planning')} className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${activeTab === 'planning' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}><Map size={16}/> 案場與管線規劃</button>
                    <button onClick={() => setActiveTab('facilities')} className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${activeTab === 'facilities' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}><Layers size={16}/> CCUS 設施與專案總覽</button>
                </div>
            </div>

            {activeTab === 'planning' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                            <div><p className="text-xs text-slate-500 font-bold mb-1 uppercase">符合門檻之廠區總排放量 (範疇 1+2)</p><h3 className="text-2xl font-black text-rose-700">{(Number(scope1Stats.total || 0) / 10000).toFixed(1)} <span className="text-sm font-medium text-slate-500">萬噸</span></h3></div>
                            <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600"><AlertTriangle size={24}/></div>
                        </div>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between border-l-4 border-l-indigo-500">
                            <div><p className="text-xs text-slate-500 font-bold mb-1 uppercase">高潛力工業區集群數</p><h3 className="text-2xl font-black text-indigo-700">{scope1Stats.topZones.filter(z=>z.Total>1000000).length} <span className="text-sm font-medium text-slate-500">個 (&gt;百萬噸)</span></h3></div>
                            <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600"><Layers size={24}/></div>
                        </div>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between border-l-4 border-l-sky-500">
                            <div><p className="text-xs text-slate-500 font-bold mb-1 uppercase">自動推演管線距離評估</p><h3 className="text-2xl font-black text-sky-700">啟用 <span className="text-sm font-medium text-slate-500">多層級節點樹</span></h3></div>
                            <div className="w-12 h-12 rounded-full bg-sky-50 flex items-center justify-center text-sky-600"><Route size={24}/></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                        <div className="lg:col-span-7 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[750px]">
                            <h3 className="font-bold text-slate-700 text-sm mb-4 border-b pb-2 flex items-center gap-2"><Map size={16} className="text-indigo-500"/> CCS 案場與共通管線拓樸分析</h3>
                            <div className="flex-1 w-full h-full relative min-h-0">
                                <ErrorBoundary>
                                    <TaiwanCcusMap mode="planning" activeLayers={['planning']} scope1Data={scope1Data} mapPaths={mapPaths} ccsTopology={ccsTopology} hubs={hubs} setHubs={setHubs} clusters={clusters} setClusters={setClusters} />
                                </ErrorBoundary>
                            </div>
                        </div>

                        <div className="lg:col-span-5 flex flex-col gap-6 h-[750px]">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                                <h3 className="font-bold text-slate-700 text-sm mb-3 border-b pb-2 flex items-center gap-2"><Route size={16} className="text-sky-500"/> 區域管線佈建可行性分析</h3>
                                <div className="flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar max-h-[300px]">
                                    <div className="bg-slate-50 p-3 rounded border border-slate-200">
                                        <div className="text-xs font-bold text-slate-500 mb-1">【南區】多節點集中 ➔ 港口接收外銷</div>
                                        <div className="text-xs text-slate-600 leading-relaxed">由於缺乏合適本土封存場址，系統已將高雄分為南北與內陸多節點，分別收集周邊高排碳區至高雄港接收站，轉由船運送往中部的麥寮/台中港或東南亞(印尼/馬來西亞)進行封存。台東則以南迴海運接駁至高雄。</div>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded border border-slate-200">
                                        <div className="text-xs font-bold text-slate-500 mb-1">【中區】多節點中繼 ➔ 本土海/陸封存</div>
                                        <div className="text-xs text-slate-600 leading-relaxed">具備本土封存優勢。苗栗區域以陸地管線連接鐵砧山；雲林與南彰化可直接利用麥寮外海；台中與北彰化則以陸地管線匯集至台中港。嘉義已設定往北接駁至雲林中繼點轉送麥寮。</div>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded border border-slate-200">
                                        <div className="text-xs font-bold text-slate-500 mb-1">【北區】陸路中繼串接 ➔ 林口外海封存</div>
                                        <div className="text-xs text-slate-600 leading-relaxed">排放源相對分散。新竹先往北牽至桃園內陸，再與桃園沿海會合，集中至林口沿岸，轉由海管輸送至林口外海封存。大於50km之主幹管線(橘色虛線)可行性極低。</div>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded border border-slate-200">
                                        <div className="text-xs font-bold text-slate-500 mb-1">【東區】花蓮港接收 ➔ 海運北送封存</div>
                                        <div className="text-xs text-slate-600 leading-relaxed">花蓮地區主要排放源(如大型電廠/水泥廠)集中，建議於花蓮港建置 CO₂ 接收轉運站，透過海運(避開東北角陸地)與基隆會合，將捕捉之碳排送往北部的林口封存樞紐。</div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col min-h-0">
                                <h3 className="font-bold text-slate-700 text-sm mb-3 border-b pb-2 flex items-center gap-2">
                                    <PieChartIcon size={16} className="text-rose-500"/> 各產業範疇一 (可CCS捕捉) 絕對量分析 - {listRegion === 'ALL' ? '全區域' : listRegion}
                                </h3>
                                <div className="flex-1 min-h-0 w-full relative">
                                    {regionalIndustryStats.length > 0 ? (
                                        <ErrorBoundary>
                                            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                                <BarChart data={regionalIndustryStats.slice(0, 8)} layout="vertical" margin={{top:5, right:40, left:40, bottom:0}}>
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                                    <XAxis type="number" tickFormatter={v => (Number(v||0)/10000).toFixed(0)} fontSize={10} unit="萬噸"/>
                                                    <YAxis dataKey="name" type="category" width={90} tick={{fontSize:11, fontWeight:'bold', fill:'#475569'}} interval={0}/>
                                                    <Tooltip formatter={(v) => [(Number(v||0)/10000).toFixed(1) + ' 萬噸', '範疇一 (直接排放)']} contentStyle={{borderRadius:'8px'}} />
                                                    <Bar dataKey="value" name="範疇一 (直接)" fill="#e11d48" radius={[0,4,4,0]} barSize={20}>
                                                        <LabelList dataKey="value" position="right" formatter={v => (Number(v||0)/10000).toFixed(0)} fontSize={10} fill="#be123c" fontWeight="bold"/>
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </ErrorBoundary>
                                    ) : (
                                        <div className="flex h-full items-center justify-center text-slate-400 text-sm">此區域無相關數據</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                            <div className="flex justify-between items-center mb-3 border-b pb-2">
                                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                    <Anchor size={16} className="text-blue-500"/> 封存點位可能碳源分析
                                </h3>
                                <select 
                                    value={selectedHubId} 
                                    onChange={e => setSelectedHubId(e.target.value)} 
                                    className="bg-slate-50 border border-slate-200 text-slate-700 font-bold px-3 py-1 rounded-lg outline-none cursor-pointer hover:bg-slate-100 text-xs"
                                >
                                    {Object.values(hubs).map(hub => (
                                        <option key={hub.id} value={hub.id}>{hub.name}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="flex justify-between items-center bg-blue-50 p-3 rounded-lg border border-blue-100 mb-3">
                                <div>
                                    <div className="text-[10px] text-blue-600 font-bold uppercase mb-0.5">涵蓋有效排放點數量 (符合距離門檻)</div>
                                    <div className="text-xl font-black text-blue-800">{selectedHubSources.length} <span className="text-xs font-normal">家</span></div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] text-blue-600 font-bold uppercase mb-0.5">總涵蓋排放量 (範疇一)</div>
                                    <div className="text-xl font-black text-blue-800">{(Number(selectedHubTotalEmissions||0) / 10000).toFixed(1)} <span className="text-xs font-normal">萬噸</span></div>
                                </div>
                            </div>

                            <div className="overflow-y-auto custom-scrollbar max-h-[350px] border border-slate-100 rounded-lg">
                                <table className="w-full text-xs text-left relative">
                                    <thead className="bg-blue-50/50 sticky top-0 shadow-sm z-10">
                                        <tr>
                                            <th className="p-3 text-blue-800">事業名稱</th>
                                            <th className="p-3 text-blue-800">縣市</th>
                                            <th className="p-3 text-right text-blue-800">總管線預估(km)</th>
                                            <th className="p-3 text-right text-blue-800">範疇一(噸)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-blue-50">
                                        {selectedHubSources.map((row, i) => (
                                            <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                                                <td className="p-3 font-bold text-slate-700 truncate max-w-[150px]" title={row.Plant}>
                                                    {row.isPriority && <span className="mr-1 text-[10px] text-rose-500 font-black" title="優先碳源">●</span>}
                                                    {row.Plant}
                                                </td>
                                                <td className="p-3 text-slate-500">{row.County}</td>
                                                <td className={`p-3 text-right font-mono ${row.distanceToHub > 50 ? 'text-orange-500 font-bold' : 'text-slate-500'}`}>{Number(row.distanceToHub||0).toFixed(1)}</td>
                                                <td className="p-3 text-right font-mono font-bold text-rose-600">{Number(row.Scope1||0).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                        {selectedHubSources.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400">此樞紐目前未分配到任何有效碳源廠區。</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                            <div className="flex flex-wrap justify-between items-center mb-3 border-b pb-2 gap-2">
                                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><List size={16} className="text-rose-500"/> 排放點源總表 (含孤立點)</h3>
                                <div className="flex gap-2">
                                    <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-200 text-xs">
                                        <Filter size={12} className="text-slate-400"/>
                                        <select value={listRegion} onChange={e => setListRegion(e.target.value)} className="bg-transparent font-bold text-slate-600 outline-none max-w-[70px]">
                                            <option value="ALL">全區域</option><option value="北區">北區</option><option value="中區">中區</option><option value="南區">南區</option><option value="東區">東區</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-200 text-xs">
                                        <Filter size={12} className="text-slate-400"/>
                                        <select value={listIndustry} onChange={e => setListIndustry(e.target.value)} className="bg-transparent font-bold text-slate-600 outline-none max-w-[80px]">
                                            {availableIndustries.map(ind => <option key={ind} value={ind}>{ind === 'ALL' ? '所有產業' : ind}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="overflow-y-auto custom-scrollbar max-h-[425px] border border-slate-100 rounded-lg">
                                <table className="w-full text-xs text-left relative">
                                    <thead className="bg-slate-50 sticky top-0 shadow-sm z-10">
                                        <tr>
                                            <th className="p-3">事業名稱</th>
                                            <th className="p-3">縣市</th>
                                            <th className="p-3">所屬聚落</th>
                                            <th className="p-3 text-right text-rose-600">範疇一(噸)</th>
                                            <th className="p-3 text-right font-bold">總計(噸)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredScope1Data.map((row, i) => (
                                            <tr key={i} className="hover:bg-rose-50 transition-colors">
                                                <td className="p-3 font-bold text-slate-700 truncate max-w-[150px]" title={row.Plant}>
                                                    {row.isPriority ? <span className="mr-1 text-[10px] text-rose-500 font-black" title="優先碳源">●</span> : <span className="mr-1 text-[10px] text-orange-400 font-black" title="次要碳源">●</span>}
                                                    {row.Plant}
                                                </td>
                                                <td className="p-3">{row.County}</td>
                                                <td className="p-3 text-blue-600 text-[10px]">{row.zone}</td>
                                                <td className="p-3 text-right font-mono text-rose-600">{Number(row.Scope1||0).toLocaleString()}</td>
                                                <td className="p-3 text-right font-mono font-bold text-slate-800">{Number(row.TotalScope||0).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                        {filteredScope1Data.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">找不到符合條件的點源資料。</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 合併版 CCUS 設施總覽 */}
            {activeTab === 'facilities' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                            <div><p className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider">現行淨捕捉量總和</p><h3 className="text-3xl font-black text-blue-800">{totalCapture.toFixed(1)} <span className="text-sm font-medium text-slate-500">萬噸/年</span></h3></div>
                            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><Leaf size={28}/></div>
                        </div>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                            <div><p className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider">預期再利用 CO₂ 總需求</p><h3 className="text-3xl font-black text-emerald-800">{totalExpectedDemand.toFixed(1)} <span className="text-sm font-medium text-slate-500">萬噸/年</span></h3></div>
                            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><FlaskConical size={28}/></div>
                        </div>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                            <div><p className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider">總規劃封存量</p><h3 className="text-3xl font-black text-rose-800">{fStorage.reduce((s, r)=>s+r.Capturable_Volume, 0).toFixed(1)} <span className="text-sm font-medium text-slate-500">萬噸/年</span></h3></div>
                            <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center text-rose-600"><Box size={28}/></div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[750px] items-stretch">
                        <div className="lg:col-span-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
                            <div className="flex justify-between items-center mb-4 border-b pb-2">
                                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><MapPin size={16} className="text-slate-500"/> CCUS 全價值鏈分佈</h3>
                                <div className="flex bg-slate-100 p-1 rounded-lg text-[10px] font-bold shadow-inner">
                                    <button onClick={() => setFacilitySubTab('all')} className={`px-3 py-1 rounded-md ${facilitySubTab === 'all' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>全視角</button>
                                    <button onClick={() => setFacilitySubTab('capture')} className={`px-3 py-1 rounded-md ${facilitySubTab === 'capture' ? 'bg-blue-500 text-white shadow' : 'text-slate-500'}`}>捕捉端</button>
                                    <button onClick={() => setFacilitySubTab('utilization')} className={`px-3 py-1 rounded-md ${facilitySubTab === 'utilization' ? 'bg-emerald-500 text-white shadow' : 'text-slate-500'}`}>再利用端</button>
                                    <button onClick={() => setFacilitySubTab('storage')} className={`px-3 py-1 rounded-md ${facilitySubTab === 'storage' ? 'bg-rose-500 text-white shadow' : 'text-slate-500'}`}>封存端</button>
                                </div>
                            </div>
                            <div className="flex-1 w-full h-full relative min-h-0">
                                <ErrorBoundary>
                                    <TaiwanCcusMap mode="facilities" activeLayers={activeLayersMap[facilitySubTab]} captureData={fCapture} utilData={fUtil} storageData={fStorage} mapPaths={mapPaths} hubs={hubs} setHubs={setHubs} />
                                </ErrorBoundary>
                            </div>
                        </div>

                        <div className="lg:col-span-6 flex flex-col gap-6 h-full">
                            {/* --- 動態渲染右側內容 --- */}
                            {facilitySubTab === 'all' && (
                                <>
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[350px]">
                                        <h3 className="font-bold text-slate-700 text-sm mb-3 border-b pb-2 flex items-center gap-2"><Activity size={16} className="text-blue-500"/> 企業價值鏈橫向對照 (捕捉 vs 去化)</h3>
                                        <div className="flex-1 min-h-0 w-full relative">
                                            <ErrorBoundary>
                                                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                                    <ComposedChart data={valueChainData.slice(0, 10)} margin={{top: 10, right: 10, bottom: 20, left: 0}}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                        <XAxis dataKey="Company" tick={{fontSize: 10}} interval={0} angle={-30} textAnchor="end" />
                                                        <YAxis yAxisId="left" tick={{fontSize: 10}} />
                                                        <Tooltip contentStyle={{fontSize: '12px', borderRadius: '8px'}} formatter={v => Number(v).toFixed(1)} />
                                                        <Legend wrapperStyle={{fontSize: '10px'}}/>
                                                        <Bar yAxisId="left" dataKey="Capture" name="淨捕捉量" fill="#3b82f6" radius={[2, 2, 0, 0]} barSize={15} />
                                                        <Bar yAxisId="left" dataKey="Future" name="未來擴充潛力" fill="#93c5fd" radius={[2, 2, 0, 0]} barSize={15} />
                                                        <Line yAxisId="left" type="monotone" dataKey="Util" name="再利用需求" stroke="#10b981" strokeWidth={2} dot={{r: 4}} />
                                                        <Line yAxisId="left" type="monotone" dataKey="Storage" name="可封存量" stroke="#f59e0b" strokeWidth={2} dot={{r: 4}} />
                                                    </ComposedChart>
                                                </ResponsiveContainer>
                                            </ErrorBoundary>
                                        </div>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col min-h-0">
                                        <h3 className="font-bold text-slate-700 text-sm mb-3 border-b pb-2 flex items-center gap-2"><List size={16} className="text-slate-500"/> CCUS 價值鏈總覽表</h3>
                                        <div className="flex-1 overflow-auto custom-scrollbar">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-slate-100 sticky top-0 shadow-sm">
                                                    <tr><th className="p-2">公司名稱</th><th className="p-2 text-right text-blue-600">淨捕捉量</th><th className="p-2 text-right text-blue-400">未來潛力</th><th className="p-2 text-right text-emerald-600">再利用需求</th><th className="p-2 text-right text-amber-600">可封存量</th></tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {valueChainData.map((row, i) => (
                                                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                            <td className="p-2 font-bold text-slate-700">{row.Company}</td>
                                                            <td className="p-2 text-right font-mono text-blue-600">{row.Capture > 0 ? row.Capture.toFixed(1) : '-'}</td>
                                                            <td className="p-2 text-right font-mono text-blue-400">{row.Future > 0 ? row.Future.toFixed(1) : '-'}</td>
                                                            <td className="p-2 text-right font-mono text-emerald-600">{row.Util > 0 ? row.Util.toFixed(1) : '-'}</td>
                                                            <td className="p-2 text-right font-mono text-amber-600">{row.Storage > 0 ? row.Storage.toFixed(1) : '-'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}

                            {facilitySubTab === 'capture' && (
                                <>
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[350px]">
                                        <h3 className="font-bold text-slate-700 text-sm mb-3 border-b pb-2 flex items-center gap-2"><Activity size={16} className="text-blue-500"/> 技術解析：總捕捉量 vs 設備耗能</h3>
                                        <div className="flex-1 min-h-0 w-full relative">
                                            <ErrorBoundary>
                                                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                                    <BarChart data={fCapture.filter(r => r.Capture_Volume > 0).sort((a,b) => b.Capture_Volume - a.Capture_Volume)} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }} barGap={2} barSize={20}>
                                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false}/>
                                                        <XAxis type="number" fontSize={10} unit=" 萬噸"/>
                                                        <YAxis dataKey="Label" type="category" width={120} interval={0} tick={<CaptureYAxisTick data={fCapture.filter(r => r.Capture_Volume > 0)} />}/>
                                                        <Tooltip content={<CaptureTooltip />}/>
                                                        <Legend wrapperStyle={{fontSize:'10px'}} verticalAlign="top"/>
                                                        <Bar dataKey="Net_Capture_Volume" name="淨捕捉量" stackId="capture" fill="#10b981"><LabelList dataKey="Net_Capture_Volume" position="insideLeft" fill="white" fontSize={10} fontWeight="bold" formatter={(v) => Number(v||0) > 0 ? `淨 ${Number(v||0).toFixed(1)}` : ''}/></Bar>
                                                        <Bar dataKey="Captur_energy" name="設備耗能" stackId="capture" fill="#ef4444" radius={[0, 4, 4, 0]}><LabelList dataKey="Capture_Volume" position="right" fill="#475569" fontSize={10} fontWeight="bold" formatter={(v) => `總 ${Number(v||0).toFixed(1)}`} /></Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </ErrorBoundary>
                                        </div>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col min-h-0">
                                        <h3 className="font-bold text-slate-700 text-sm mb-3 border-b pb-2 flex items-center gap-2"><List size={16} className="text-blue-500"/> 現有捕捉設施明細</h3>
                                        <div className="flex-1 overflow-auto custom-scrollbar">
                                            <table className="w-full text-xs text-left whitespace-nowrap">
                                                <thead className="bg-blue-50 sticky top-0 shadow-sm">
                                                    <tr><th className="p-2">公司廠區</th><th className="p-2">捕捉技術</th><th className="p-2">TRL</th><th className="p-2 text-right">總捕捉量</th><th className="p-2 text-right text-rose-500">耗能扣除</th><th className="p-2 text-right font-bold text-emerald-600">淨捕捉量</th></tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {fCapture.filter(r => r.Capture_Volume > 0).map((row, i) => (
                                                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                            <td className="p-2 font-bold text-slate-700">{row.Label}</td>
                                                            <td className="p-2"><span className="px-2 py-0.5 bg-white border border-blue-200 text-blue-700 rounded">{row.Capture_Tech}</span></td>
                                                            <td className="p-2 font-mono">{row.TRL}</td>
                                                            <td className="p-2 text-right font-mono font-bold text-blue-600">{Number(row.Capture_Volume||0).toFixed(1)}</td>
                                                            <td className="p-2 text-right font-mono text-rose-500">-{Number(row.Captur_energy||0).toFixed(1)}</td>
                                                            <td className="p-2 text-right font-mono font-bold text-emerald-600">{Number(row.Net_Capture_Volume||0).toFixed(1)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}

                            {facilitySubTab === 'utilization' && (
                                <>
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-0 h-full">
                                        <h3 className="font-bold text-slate-700 text-sm mb-4 border-b pb-2 flex items-center gap-2"><FlaskConical size={16} className="text-emerald-500"/> 再利用製程與需求清單</h3>
                                        <div className="flex-1 overflow-auto custom-scrollbar pr-2 space-y-3">
                                            {fUtil.map((item, idx) => {
                                                const trlNum = parseInt(String(item.TRL).split('-')[0]) || 0;
                                                const isDeveloping = trlNum < 6 || item.Current_Demand === 0;
                                                return (
                                                    <div key={idx} className={`flex flex-col sm:flex-row items-stretch w-full rounded-xl border shadow-sm overflow-hidden relative ${isDeveloping ? 'bg-slate-50 border-dashed border-slate-300 opacity-80' : 'bg-white border-slate-200'}`}>
                                                        <div className="flex-1 p-3 flex flex-col items-center justify-center border-r border-slate-100 relative">
                                                            {isDeveloping && <div className="absolute top-0 right-0 bg-amber-500 text-white text-[9px] font-bold px-2 rounded-bl shadow-sm">開發中</div>}
                                                            <div className="font-bold text-slate-700 mb-1 text-center text-sm">{item.Target_Company} {item.Target_Plant}</div>
                                                            <div className="flex gap-2">
                                                                <div className="bg-emerald-50 border border-emerald-100 rounded px-2 py-1 text-center"><div className="text-sm font-mono font-black text-emerald-600">{Number(item.Expected_Demand||0).toFixed(1)}</div><div className="text-[9px] text-emerald-500 font-bold">預期需求</div></div>
                                                                <div className="bg-slate-50 border border-slate-100 rounded px-2 py-1 text-center"><div className={`text-sm font-mono font-black ${item.Current_Demand > 0 ? 'text-slate-600' : 'text-slate-300'}`}>{Number(item.Current_Demand||0).toFixed(1)}</div><div className="text-[9px] text-slate-500 font-bold">當前需求</div></div>
                                                            </div>
                                                        </div>
                                                        <div className={`w-32 text-white flex flex-col items-center justify-center p-2 relative shadow-inner ${isDeveloping ? 'bg-slate-500' : 'bg-slate-800'}`}>
                                                            <div className="text-[10px] text-slate-300 font-bold mb-1">轉化技術</div>
                                                            <div className="text-xs font-bold text-center leading-tight text-amber-300 mb-1">{item.Conversion_Tech}</div>
                                                            <div className={`text-[9px] px-2 rounded border ${isDeveloping ? 'bg-rose-900 border-rose-700 text-rose-200' : 'bg-slate-700 border-slate-600 text-amber-100'}`}>TRL {item.TRL}</div>
                                                        </div>
                                                        <div className="flex-1 p-3 flex flex-col items-center justify-center relative">
                                                            <div className="font-bold text-slate-700 mb-1 text-center text-sm">{String(item.Conversion_Tech).split('轉')[1] || '高階產品'}</div>
                                                            <div className="bg-purple-50 border border-purple-100 rounded px-3 py-1 text-center shadow-sm">
                                                                <div className="text-xl font-mono font-black text-purple-600">{Number(item.Product_Generated||0).toFixed(1)}</div><div className="text-[10px] text-purple-500 font-bold">產出萬噸/年</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {fUtil.length === 0 && <div className="text-slate-400 text-sm py-10 text-center">無再利用轉化數據</div>}
                                        </div>
                                    </div>
                                </>
                            )}

                            {facilitySubTab === 'storage' && (
                                <>
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[350px]">
                                        <div className="flex justify-between items-center mb-3 border-b pb-2">
                                            <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><Box size={16} className="text-amber-500"/> 封存成本與距離矩陣</h3>
                                            <select value={transportMode} onChange={(e) => setTransportMode(e.target.value)} className="text-xs border rounded p-1 bg-slate-50 outline-none">
                                                <option value="ALL">全部方式</option><option value="管線">管線</option><option value="陸運">陸運</option><option value="海運">海運</option>
                                            </select>
                                        </div>
                                        <div className="flex-1 min-h-0 w-full relative">
                                            <div className="absolute top-0 right-2 text-[10px] text-slate-400 bg-white/80 px-2 rounded z-10 border border-slate-100 shadow-sm">圓點大小 = 封存量能</div>
                                            <ErrorBoundary>
                                                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                                    <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                                                        <CartesianGrid strokeDasharray="3 3"/>
                                                        <XAxis type="number" dataKey="Distance_km" name="運輸距離" unit=" km" tick={{fontSize: 10}}>
                                                            <Label value="運輸距離 (km)" position="insideBottom" offset={-10} fontSize={11} fill="#475569" fontWeight="bold"/>
                                                        </XAxis>
                                                        <YAxis type="number" dataKey="Cost_USD_Per_Ton" name="總成本" unit=" USD" tick={{fontSize: 10}}>
                                                            <Label value="全價值鏈成本 (USD/噸)" angle={-90} position="insideLeft" offset={10} fontSize={11} fill="#475569" fontWeight="bold"/>
                                                        </YAxis>
                                                        <ZAxis type="number" dataKey="Capturable_Volume" range={[100, 1000]} name="封存量" />
                                                        <Tooltip cursor={{strokeDasharray:'3 3'}} formatter={(v, n) => [Number(v).toFixed(1), n]} contentStyle={{borderRadius:'8px', fontSize:'12px'}}/>
                                                        <Scatter name="封存專案" data={fStorage.filter(r => transportMode === 'ALL' || r.Transport_Method.includes(transportMode))}>
                                                            <LabelList dataKey="Storage_Site" position="top" style={{fontSize:10, fill:'#334155', fontWeight:'bold'}} />
                                                            {fStorage.filter(r => transportMode === 'ALL' || r.Transport_Method.includes(transportMode)).map((entry, index) => {
                                                                let dotColor = '#94a3b8';
                                                                if (String(entry.Transport_Method).includes('管線')) dotColor = '#3b82f6';
                                                                if (String(entry.Transport_Method).includes('陸運')) dotColor = '#f59e0b';
                                                                if (String(entry.Transport_Method).includes('海運')) dotColor = '#14b8a6';
                                                                return <Cell key={`cell-${index}`} fill={dotColor} fillOpacity={0.8} stroke="white" strokeWidth={1} />;
                                                            })}
                                                        </Scatter>
                                                    </ScatterChart>
                                                </ResponsiveContainer>
                                            </ErrorBoundary>
                                        </div>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col min-h-0">
                                        <h3 className="font-bold text-slate-700 text-sm mb-3 border-b pb-2 flex items-center gap-2"><List size={16} className="text-amber-500"/> 封存專案明細</h3>
                                        <div className="flex-1 overflow-auto custom-scrollbar">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-amber-50 sticky top-0 shadow-sm">
                                                    <tr><th className="p-2">碳源 ➔ 封存場</th><th className="p-2 text-center">方式</th><th className="p-2 text-right">距離</th><th className="p-2 text-right">封存量</th><th className="p-2 text-right">成本(USD)</th></tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {[...fStorage].filter(r => transportMode === 'ALL' || r.Transport_Method.includes(transportMode)).sort((a,b) => a.Cost_USD_Per_Ton - b.Cost_USD_Per_Ton).map((row, i) => (
                                                        <tr key={i} className="hover:bg-amber-50/50 transition-colors">
                                                            <td className="p-2 font-bold text-slate-700 truncate max-w-[120px]">{row.Source_Company} ➔ {row.Storage_Site}</td>
                                                            <td className="p-2 text-center"><span className="px-1.5 py-0.5 rounded border border-slate-200 bg-white font-bold">{row.Transport_Method}</span></td>
                                                            <td className="p-2 text-right font-mono text-slate-600">{Number(row.Distance_km||0).toFixed(0)}</td>
                                                            <td className="p-2 text-right font-mono text-blue-600">{Number(row.Capturable_Volume||0).toFixed(1)}</td>
                                                            <td className="p-2 text-right font-mono font-bold text-rose-600">${Number(row.Cost_USD_Per_Ton||0).toFixed(1)}</td>
                                                        </tr>
                                                    ))}
                                                    {fStorage.filter(r => transportMode === 'ALL' || r.Transport_Method.includes(transportMode)).length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400">無符合條件之專案</td></tr>}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CcusDashboard;