import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ScatterChart, Scatter, ZAxis, Cell, LabelList, ComposedChart, Line, PieChart, Pie, Label
} from 'recharts';
import {
  Leaf, RefreshCw, Target, Activity, MapPin, DollarSign, Box, AlertTriangle,
  Truck, Ship, GripHorizontal, FlaskConical, Plus, ZoomIn, ZoomOut, Maximize, Factory, List, Rocket, Map, Route, Anchor, Layers, Filter, PieChart as PieChartIcon, DownloadCloud, Copy, Trash2, X
} from 'lucide-react';
import { cleanNumber } from '../utils/helpers';
import { fetchCcusSurvey, fetchScope1Rows, fetchVerifiedEmitterCoords } from '../lib/energy/fetchEnergySurvey';
import { paramsByKey } from '../lib/energy/energyMetrics';
import CcusSurveyPanel from './energy/CcusSurveyViews';
import { CCUS_SURVEY_TABS } from './energy/ccusTabs';
import MapLibreBase from './map/MapLibreBase';
import { TAIWAN_BOUNDS, REGION_BOUNDS, LABEL_FONT, fc, pt, line, validLL, cubicBezier, quadBezier, addSquareIcon } from './map/mapUtils';

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

// 封存樞紐（ccus_storage_sites, kind='hub'）與聚落節點（ccus_network_nodes）改由資料庫讀取，見 supabase/energy_survey_seed.sql

class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { hasError: false }; }
    static getDerivedStateFromError(error) { return { hasError: true }; }
    render() {
      if (this.state.hasError) return <div className="h-full flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded text-slate-400 min-h-[250px]"><AlertTriangle size={32} className="mb-2 text-amber-400" /><p className="text-sm">圖表資料異常，請檢查資料來源格式</p></div>;
      return this.props.children;
    }
}

const distToSegment = (px, py, x1, y1, x2, y2) => {
    const l2 = (x1 - x2) ** 2 + (y1 - y2) ** 2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
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
            <div className="bg-white/95 backdrop-blur border border-slate-200 p-3 rounded-lg shadow-xl text-xs w-64 pointer-events-auto z-50 relative">
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
// 台灣 CCUS 地圖（MapLibre GL）
// 案場／樞紐／管線拓樸（樞紐、聚落、管線節點、海運與陸運控制點皆可拖曳；點主管線新增節點、
// 點節點開選單、右鍵刪除）＋ 捕捉／再利用／封存設施圖層。標籤交給 MapLibre 自動避讓重疊。
// ==========================================
const CCUS_INTERACTIVE = ['ccus-hub', 'ccus-node-hit', 'ccus-cluster-hit', 'ccus-sea-ctrl-hit', 'ccus-land-ctrl-hit', 'ccus-storage-site', 'ccus-util', 'ccus-capture', 'ccus-future', 'ccus-source-hit'];
const CCUS_DRAGGABLE = ['ccus-hub', 'ccus-node-hit', 'ccus-cluster-hit', 'ccus-sea-ctrl-hit', 'ccus-land-ctrl-hit'];
const CCUS_SOURCES = ['sea', 'seaLabel', 'seaCtrl', 'land', 'landLabel', 'landCtrl', 'branch', 'main', 'mainLabel', 'nodes', 'clusters', 'hubs', 'sources', 'capture', 'future', 'util', 'storageLine', 'storageSrc', 'storageSite'];
const flowWidth = (route) => Math.max(2, Math.log10(Math.max(10000, Number(route.weight ?? route.flow) || 0)));

const getStorageCoords = (siteName, hubs) => {
    const safeSite = siteName || '';
    const hub = Object.values(hubs || {}).find(h => safeSite.includes(h.name.split(' ')[0]) || h.name.includes(safeSite.split(' ')[0]));
    if (hub) return { lat: hub.lat, lon: hub.lon };
    if (safeSite.includes('鐵砧山')) return { lat: 24.45, lon: 120.68 };
    if (safeSite.includes('麥寮')) return { lat: 23.80, lon: 120.10 };
    if (safeSite.includes('台中')) return { lat: 24.25, lon: 120.45 };
    if (safeSite.includes('林口') || safeSite.includes('台北')) return { lat: 25.14, lon: 121.32 };
    if (safeSite.includes('高雄')) return { lat: 22.55, lon: 120.32 };
    if (safeSite.includes('花蓮')) return { lat: 23.98, lon: 121.62 };
    return { lat: 23.6, lon: 120.9 };
};

const addCcusLayers = (map) => {
    addSquareIcon(map, 'hub-sea', '#0ea5e9'); addSquareIcon(map, 'hub-land', '#b45309');
    CCUS_SOURCES.forEach(k => { if (!map.getSource(`ccus-${k}`)) map.addSource(`ccus-${k}`, { type: 'geojson', data: fc([]) }); });
    const L = (layer) => { if (!map.getLayer(layer.id)) map.addLayer(layer); };
    const halo = { 'text-halo-color': '#ffffff', 'text-halo-width': 1.8 };
    const label = (id, source, color, size, extra = {}) => L({
        id, type: 'symbol', source,
        layout: { 'text-field': ['get', 'label'], 'text-font': LABEL_FONT, 'text-size': size, ...extra },
        paint: { 'text-color': color, ...halo },
    });
    const hit = (id, source, r = 14) => L({ id, type: 'circle', source, paint: { 'circle-radius': r, 'circle-color': '#000', 'circle-opacity': 0 } });
    const isOne = (k) => ['==', ['get', k], 1];

    // 線
    L({ id: 'ccus-branch', type: 'line', source: 'ccus-branch', paint: { 'line-color': ['case', isOne('p'), '#94a3b8', '#cbd5e1'], 'line-width': ['case', isOne('p'), 1.5, 1], 'line-opacity': ['case', isOne('p'), 0.75, 0.55] } });
    L({ id: 'ccus-storage-pipe', type: 'line', source: 'ccus-storageLine', filter: isOne('pipe'), paint: { 'line-color': '#3b82f6', 'line-width': 3, 'line-opacity': 0.7 } });
    L({ id: 'ccus-storage-ship', type: 'line', source: 'ccus-storageLine', filter: ['!=', ['get', 'pipe'], 1], paint: { 'line-color': '#f59e0b', 'line-width': 3, 'line-opacity': 0.7, 'line-dasharray': [2, 2] } });
    L({ id: 'ccus-sea', type: 'line', source: 'ccus-sea', paint: { 'line-color': '#0284c7', 'line-width': 2.5, 'line-opacity': 0.75, 'line-dasharray': [2, 2] } });
    L({ id: 'ccus-land', type: 'line', source: 'ccus-land', paint: { 'line-color': '#f59e0b', 'line-width': 2, 'line-opacity': 0.85, 'line-dasharray': [2, 2] } });
    L({ id: 'ccus-main', type: 'line', source: 'ccus-main', filter: ['!=', ['get', 'unreal'], 1], layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#3b82f6', 'line-width': ['get', 'w'], 'line-opacity': 0.9 } });
    L({ id: 'ccus-main-warn', type: 'line', source: 'ccus-main', filter: isOne('unreal'), layout: { 'line-join': 'round' }, paint: { 'line-color': '#f97316', 'line-width': ['get', 'w'], 'line-opacity': 0.8, 'line-dasharray': [1.5, 1] } });
    L({ id: 'ccus-main-hit', type: 'line', source: 'ccus-main', paint: { 'line-color': '#000', 'line-width': 18, 'line-opacity': 0 } });

    // 點
    L({ id: 'ccus-source-halo', type: 'circle', source: 'ccus-sources', filter: isOne('halo'), paint: { 'circle-radius': ['*', ['get', 'r'], 1.6], 'circle-color': ['get', 'color'], 'circle-opacity': 0.22 } });
    L({ id: 'ccus-source', type: 'circle', source: 'ccus-sources', layout: { 'circle-sort-key': ['get', 'r'] }, paint: { 'circle-radius': ['get', 'r'], 'circle-color': ['get', 'color'], 'circle-opacity': ['get', 'op'], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': ['get', 'sw'] } });
    hit('ccus-source-hit', 'ccus-sources', ['max', ['get', 'r'], 9]);
    L({ id: 'ccus-future', type: 'circle', source: 'ccus-future', layout: { 'circle-sort-key': ['-', 0, ['get', 'r']] }, paint: { 'circle-radius': ['get', 'r'], 'circle-color': '#d97706', 'circle-opacity': 0.7, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 } });
    L({ id: 'ccus-capture', type: 'circle', source: 'ccus-capture', layout: { 'circle-sort-key': ['-', 0, ['get', 'r']] }, paint: { 'circle-radius': ['get', 'r'], 'circle-color': ['get', 'color'], 'circle-opacity': 0.85, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 } });
    L({ id: 'ccus-util', type: 'circle', source: 'ccus-util', layout: { 'circle-sort-key': ['-', 0, ['get', 'r']] }, paint: { 'circle-radius': ['get', 'r'], 'circle-color': '#10b981', 'circle-opacity': 0.9, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });
    L({ id: 'ccus-storage-src', type: 'circle', source: 'ccus-storageSrc', paint: { 'circle-radius': 4, 'circle-color': '#64748b' } });
    L({ id: 'ccus-storage-site', type: 'circle', source: 'ccus-storageSite', paint: { 'circle-radius': 10, 'circle-color': '#ef4444', 'circle-opacity': 0.9, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });

    // 可拖曳控制點（實心小圓 + 透明大感應區）
    L({ id: 'ccus-sea-ctrl', type: 'circle', source: 'ccus-seaCtrl', paint: { 'circle-radius': 5, 'circle-color': 'rgba(2,132,199,0.25)', 'circle-stroke-color': '#0284c7', 'circle-stroke-width': 1.5 } });
    hit('ccus-sea-ctrl-hit', 'ccus-seaCtrl');
    L({ id: 'ccus-land-ctrl', type: 'circle', source: 'ccus-landCtrl', paint: { 'circle-radius': 5, 'circle-color': 'rgba(245,158,11,0.25)', 'circle-stroke-color': '#f59e0b', 'circle-stroke-width': 1.5 } });
    hit('ccus-land-ctrl-hit', 'ccus-landCtrl');
    L({ id: 'ccus-cluster', type: 'circle', source: 'ccus-clusters', paint: { 'circle-radius': 5, 'circle-color': '#ffffff', 'circle-stroke-color': '#3b82f6', 'circle-stroke-width': 2.5 } });
    hit('ccus-cluster-hit', 'ccus-clusters');
    L({ id: 'ccus-node', type: 'circle', source: 'ccus-nodes', paint: { 'circle-radius': 5, 'circle-color': '#ffffff', 'circle-stroke-color': ['case', isOne('unreal'), '#f97316', '#3b82f6'], 'circle-stroke-width': 2.5 } });
    hit('ccus-node-hit', 'ccus-nodes');

    // 標籤（越後面加入的圖層越優先擺放；互相重疊時由 MapLibre 自動隱藏次要者）
    label('ccus-land-label', 'ccus-landLabel', '#b45309', 10, { 'text-offset': [0, -0.9] });
    label('ccus-sea-label', 'ccus-seaLabel', '#0369a1', 11);
    label('ccus-main-label', 'ccus-mainLabel', ['case', isOne('unreal'), '#c2410c', '#1e40af'], 11, { 'text-offset': [0, -1] });
    const sideLabel = { 'text-variable-anchor': ['left', 'right', 'top', 'bottom'], 'text-radial-offset': ['/', ['+', ['get', 'r'], 4], 12], 'symbol-sort-key': ['get', 'sort'] };
    label('ccus-capture-label', 'ccus-capture', '#1e293b', 12, sideLabel);
    label('ccus-util-label', 'ccus-util', '#064e3b', 12, sideLabel);
    label('ccus-storage-label', 'ccus-storageSite', '#991b1b', 12, { 'text-variable-anchor': ['left', 'right', 'top'], 'text-radial-offset': 1.2 });
    L({
        id: 'ccus-hub', type: 'symbol', source: 'ccus-hubs',
        layout: {
            'icon-image': ['case', isOne('land'), 'hub-land', 'hub-sea'], 'icon-allow-overlap': true, 'icon-ignore-placement': true,
            'text-field': ['get', 'name'], 'text-font': LABEL_FONT, 'text-size': 12, 'text-optional': true,
            'text-variable-anchor': ['left', 'right', 'top', 'bottom'], 'text-radial-offset': 1.1,
        },
        paint: { 'text-color': ['case', isOne('land'), '#78350f', '#0369a1'], ...halo },
    });
};

const TaiwanCcusMap = ({ activeLayers = [], captureData = [], utilData = [], storageData = [], ccsTopology = null, hubs, setHubs, setClusters, routeNodes = {}, setRouteNodes, seaControlPoints = {}, setSeaControlPoints, landControlPoints = {}, setLandControlPoints }) => {
    const mapRef = useRef(null);
    const stateRef = useRef({});
    const dragRef = useRef(null);
    const hoverKeyRef = useRef(null);
    const [styleRev, setStyleRev] = useState(0);
    const [hoveredNode, setHoveredNode] = useState(null);
    const [nodeMenu, setNodeMenu] = useState(null);
    const [legendOpen, setLegendOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 768);
    const layersKey = activeLayers.join(',');
    const isPlanning = activeLayers.includes('planning');

    // ---- 轉成 GeoJSON ----
    const geo = useMemo(() => {
        const layers = layersKey.split(',');
        const F = Object.fromEntries(CCUS_SOURCES.map(k => [k, []]));
        const lk = { sources: [], capture: [], future: [], util: [], storage: [], clusters: [] };
        const getFallbackCoords = (company, plant) => {
            const cStr = String(company || ''); const pStr = String(plant || '');
            const found = captureData.find(x => x.Company === cStr && (x.Plant === pStr || !pStr));
            if (found && found.Latitude && found.Longitude) return { lat: found.Latitude, lon: found.Longitude };
            return getApproximateCoordinates(pStr, cStr, '');
        };
        const ll = (o) => [Number(o.lon), Number(o.lat)];

        if (layers.includes('planning') && ccsTopology) {
            ccsTopology.seaRoutes.forEach(route => {
                const c1 = seaControlPoints[route.id]?.c1 || route.c1; const c2 = seaControlPoints[route.id]?.c2 || route.c2;
                if (!validLL(route.from.lon, route.from.lat) || !validLL(route.to.lon, route.to.lat) || !c1 || !c2) return;
                const coords = cubicBezier(ll(route.from), ll(c1), ll(c2), ll(route.to));
                F.sea.push(line(coords));
                F.seaLabel.push(pt(...coords[16], { label: route.label }));
                F.seaCtrl.push(pt(c1.lon, c1.lat, { routeId: route.id, cid: 'c1' }), pt(c2.lon, c2.lat, { routeId: route.id, cid: 'c2' }));
            });
            ccsTopology.landRoutes.forEach(route => {
                if (!validLL(route.from.lon, route.from.lat) || !validLL(route.to.lon, route.to.lat)) return;
                const routeId = `land_${route.from.Company}_${route.to.id}`;
                const ctrl = landControlPoints[routeId] || { lon: Math.min(Number(route.from.lon), Number(route.to.lon)) - 0.08, lat: (Number(route.from.lat) + Number(route.to.lat)) / 2 };
                const coords = quadBezier(ll(route.from), ll(ctrl), ll(route.to));
                F.land.push(line(coords));
                F.landLabel.push(pt(...coords[12], { label: `陸運 ${Number(route.distance || 0).toFixed(0)}km` }));
                F.landCtrl.push(pt(ctrl.lon, ctrl.lat, { routeId }));
            });
            ccsTopology.branchRoutes.forEach(route => {
                if (!validLL(route.from.lon, route.from.lat) || !validLL(route.to.lon, route.to.lat)) return;
                F.branch.push(line([ll(route.from), ll(route.to)], { p: route.isPriority ? 1 : 0 }));
            });
            ccsTopology.mainRoutes.forEach(route => {
                const nodes = routeNodes[route.id] || route.nodes;
                if (!nodes || nodes.length < 2 || nodes.some(n => !validLL(n.lon, n.lat))) return;
                const dist = route.recalcDist ? route.recalcDist(nodes) : route.distance;
                const unreal = dist > 50 ? 1 : 0;
                F.main.push(line(nodes.map(ll), { routeId: route.id, unreal, w: flowWidth(route) }));
                const mid = nodes[Math.floor(nodes.length / 2)];
                F.mainLabel.push(pt(mid.lon, mid.lat, { label: `${Number(dist || 0).toFixed(0)} km`, unreal }));
                nodes.slice(1, -1).forEach((n, k) => F.nodes.push(pt(n.lon, n.lat, { routeId: route.id, idx: k + 1, unreal, flow: Number(route.weight ?? route.flow) || 0 })));
            });
            (ccsTopology.activeClusterNodes || []).forEach((c, i) => {
                if (!validLL(c.lon, c.lat)) return;
                lk.clusters[i] = c; F.clusters.push(pt(c.lon, c.lat, { id: c.id, i }));
            });
            Object.values(hubs || {}).forEach(h => {
                if (validLL(h.lon, h.lat)) F.hubs.push(pt(h.lon, h.lat, { id: h.id, name: h.name, land: h.id === 'CENTRAL_HUB_LAND' ? 1 : 0 }));
            });
            ccsTopology.validSources.forEach((d, i) => {
                if (!validLL(d.lon, d.lat)) return;
                const r = Math.max(3, Math.min(14, 3 + Math.sqrt(Math.max(0, d.Scope1 || 0) / 100000)));
                const connected = d.distanceToHub >= 0 || d.landDist > 0;
                lk.sources[i] = d;
                F.sources.push(pt(d.lon, d.lat, {
                    i, r, color: d.isPowerPlant ? '#a855f7' : (d.isPriority ? '#e11d48' : '#f97316'),
                    op: connected ? 0.9 : 0.3, sw: connected ? (d.isPriority ? 1.5 : 1) : 0, halo: d.isPriority && connected ? 1 : 0,
                }));
            });
        }
        if (layers.includes('capture') || layers.includes('future')) {
            captureData.forEach((d, i) => {
                const fb = getFallbackCoords(d.Company, d.Plant);
                const lat = cleanNumber(d.Latitude) || fb.lat; const lon = cleanNumber(d.Longitude) || fb.lon;
                if (!validLL(lon, lat)) return;
                if (layers.includes('capture')) {
                    const r = Math.max(6, Math.min(25, Math.sqrt(Math.max(0, d.Capture_Volume || 0)) * 1.5));
                    lk.capture[i] = d; F.capture.push(pt(lon, lat, { i, r, color: stringToColor(d.Capture_Tech), label: d.Company, sort: -r }));
                }
                if (layers.includes('future')) {
                    const r = Math.max(6, Math.min(25, Math.sqrt(Math.max(0, d.Future_Emission_Volume || 0)) * 1.5));
                    lk.future[i] = d; F.future.push(pt(lon, lat, { i, r }));
                }
            });
        }
        if (layers.includes('util')) {
            utilData.forEach((d, i) => {
                const c = getFallbackCoords(d.Target_Company, d.Target_Plant);
                if (!validLL(c.lon, c.lat)) return;
                const r = Math.max(8, Math.min(20, Math.sqrt(Math.max(0, d.Expected_Demand || 0)) * 2));
                lk.util[i] = d; F.util.push(pt(c.lon, c.lat, { i, r, label: d.Target_Company, sort: -r }));
            });
        }
        if (layers.includes('storage')) {
            storageData.forEach((d, i) => {
                const src = getFallbackCoords(d.Source_Company, ''); const tgt = getStorageCoords(d.Storage_Site, hubs);
                if (!validLL(src.lon, src.lat)) return;
                lk.storage[i] = d;
                F.storageLine.push(line([ll(src), ll(tgt)], { pipe: String(d.Transport_Method).includes('管線') ? 1 : 0 }));
                F.storageSrc.push(pt(src.lon, src.lat));
                F.storageSite.push(pt(tgt.lon, tgt.lat, { i, label: d.Storage_Site }));
            });
        }
        return { F, lk };
    }, [layersKey, ccsTopology, hubs, routeNodes, seaControlPoints, landControlPoints, captureData, utilData, storageData]);

    // 事件處理器只註冊一次，透過 ref 取得最新資料與 setter
    useEffect(() => {
        stateRef.current = { lk: geo.lk, hubs, ccsTopology, routeNodes, isPlanning, setHubs, setClusters, setRouteNodes, setSeaControlPoints, setLandControlPoints };
    });

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !styleRev) return;
        Object.entries(geo.F).forEach(([k, feats]) => map.getSource(`ccus-${k}`)?.setData(fc(feats)));
    }, [geo, styleRev]);

    const baseNodes = (routeId) => stateRef.current.ccsTopology?.mainRoutes.find(r => r.id === routeId)?.nodes;

    const onStyleReady = useCallback((map) => {
        addCcusLayers(map);
        const firstInit = !mapRef.current;
        mapRef.current = map;
        setStyleRev(r => r + 1);
        if (!firstInit) return;

        const canvas = map.getCanvasContainer();
        const existing = (ids) => ids.filter(id => map.getLayer(id));
        const query = (point, ids) => map.queryRenderedFeatures(point, { layers: existing(ids) });

        const hoverFromFeature = (f) => {
            const s = stateRef.current; const p = f.properties;
            switch (f.layer.id) {
                case 'ccus-hub': { const h = s.hubs?.[p.id]; return h && [`hub-${p.id}`, { ...h, nodeType: 'hub', hubType: h.type }]; }
                case 'ccus-cluster-hit': { const c = s.lk.clusters[p.i]; return c && [`cl-${p.i}`, { ...c, nodeType: 'cluster' }]; }
                case 'ccus-source-hit': { const d = s.lk.sources[p.i]; return d && [`src-${p.i}`, { ...d, nodeType: 'planning_source' }]; }
                case 'ccus-capture': { const d = s.lk.capture[p.i]; return d && [`cap-${p.i}`, { ...d, nodeType: 'capture' }]; }
                case 'ccus-future': { const d = s.lk.future[p.i]; return d && [`fut-${p.i}`, { ...d, nodeType: 'future' }]; }
                case 'ccus-util': { const d = s.lk.util[p.i]; return d && [`util-${p.i}`, { ...d, nodeType: 'util' }]; }
                case 'ccus-storage-site': { const d = s.lk.storage[p.i]; return d && [`sto-${p.i}`, { ...d, nodeType: 'storage' }]; }
                default: return null;
            }
        };
        const setHover = (h) => {
            const key = h ? h[0] : null;
            if (key === hoverKeyRef.current) return;
            hoverKeyRef.current = key; setHoveredNode(h ? h[1] : null);
        };

        const moveDrag = (lngLat) => {
            const d = dragRef.current; const s = stateRef.current;
            d.moved = true;
            const pos = { lat: lngLat.lat, lon: lngLat.lng };
            if (d.layer === 'ccus-hub') s.setHubs?.(prev => ({ ...prev, [d.id]: { ...prev[d.id], ...pos } }));
            else if (d.layer === 'ccus-cluster-hit') s.setClusters?.(prev => ({ ...prev, [d.id]: { ...prev[d.id], ...pos } }));
            else if (d.layer === 'ccus-node-hit') s.setRouteNodes?.(prev => {
                const nodes = [...(prev[d.routeId] || baseNodes(d.routeId) || [])];
                if (!nodes[d.idx]) return prev;
                nodes[d.idx] = { ...nodes[d.idx], ...pos };
                return { ...prev, [d.routeId]: nodes };
            });
            else if (d.layer === 'ccus-sea-ctrl-hit') s.setSeaControlPoints?.(prev => {
                const route = s.ccsTopology?.seaRoutes.find(r => r.id === d.routeId);
                const cur = prev[d.routeId] || { c1: route?.c1, c2: route?.c2 };
                return { ...prev, [d.routeId]: { ...cur, [d.cid]: pos } };
            });
            else if (d.layer === 'ccus-land-ctrl-hit') s.setLandControlPoints?.(prev => ({ ...prev, [d.routeId]: pos }));
        };

        const startDrag = (e) => {
            if (!stateRef.current.isPlanning || e.originalEvent?.button === 2) return;
            const f = query(e.point, CCUS_DRAGGABLE)[0];
            if (!f) return;
            e.preventDefault();
            const p = f.properties;
            dragRef.current = { layer: f.layer.id, id: p.id, routeId: p.routeId, idx: p.idx, cid: p.cid, moved: false };
            canvas.style.cursor = 'grabbing';
            setNodeMenu(null);
        };
        const endDrag = () => { if (dragRef.current) { dragRef.current = null; canvas.style.cursor = ''; } };

        map.on('mousedown', startDrag);
        map.on('touchstart', (e) => { if (e.points?.length === 1) startDrag(e); });
        map.on('mouseup', endDrag);
        map.on('touchend', endDrag);
        map.on('touchmove', (e) => { if (dragRef.current) { e.preventDefault(); moveDrag(e.lngLat); } });
        map.on('mousemove', (e) => {
            if (dragRef.current) { moveDrag(e.lngLat); return; }
            const s = stateRef.current;
            const f = query(e.point, CCUS_INTERACTIVE)[0];
            if (f) canvas.style.cursor = s.isPlanning && CCUS_DRAGGABLE.includes(f.layer.id) ? 'grab' : 'pointer';
            else canvas.style.cursor = s.isPlanning && query(e.point, ['ccus-main-hit']).length ? 'crosshair' : '';
            setHover(f ? hoverFromFeature(f) : null);
        });
        map.on('mouseout', () => { endDrag(); setHover(null); });

        map.on('click', (e) => {
            const s = stateRef.current;
            if (s.isPlanning) {
                const node = query(e.point, ['ccus-node-hit'])[0];
                if (node) {
                    setHover(null);
                    setNodeMenu({ routeId: node.properties.routeId, nodeIdx: node.properties.idx, weight: node.properties.flow, x: e.point.x, y: e.point.y });
                    return;
                }
            }
            const f = query(e.point, CCUS_INTERACTIVE)[0];
            const h = f && hoverFromFeature(f);
            if (h) { setNodeMenu(null); setHover(h); return; }
            const lineF = s.isPlanning && !f && query(e.point, ['ccus-main-hit'])[0];
            if (lineF && s.setRouteNodes) {
                // 點主管線：在最近的線段插入新節點
                const routeId = lineF.properties.routeId;
                s.setRouteNodes(prev => {
                    const nodes = [...(prev[routeId] || baseNodes(routeId) || [])];
                    if (nodes.length < 2) return prev;
                    let best = Infinity; let insertIdx = 1;
                    for (let i = 0; i < nodes.length - 1; i++) {
                        const a = map.project([nodes[i].lon, nodes[i].lat]); const b = map.project([nodes[i + 1].lon, nodes[i + 1].lat]);
                        const dd = distToSegment(e.point.x, e.point.y, a.x, a.y, b.x, b.y);
                        if (dd < best) { best = dd; insertIdx = i + 1; }
                    }
                    nodes.splice(insertIdx, 0, { lat: e.lngLat.lat, lon: e.lngLat.lng });
                    return { ...prev, [routeId]: nodes };
                });
                return;
            }
            setNodeMenu(null); setHover(null);
        });

        // 右鍵刪除管線節點（至少保留 3 點）
        map.on('contextmenu', (e) => {
            const s = stateRef.current;
            if (!s.isPlanning || !s.setRouteNodes) return;
            const node = query(e.point, ['ccus-node-hit'])[0];
            if (!node) return;
            e.preventDefault();
            const { routeId, idx } = node.properties;
            s.setRouteNodes(prev => {
                const nodes = [...(prev[routeId] || baseNodes(routeId) || [])];
                if (nodes.length <= 3) return prev;
                nodes.splice(idx, 1);
                return { ...prev, [routeId]: nodes };
            });
        });
    }, []);

    const handleDuplicateNode = () => {
        if (!nodeMenu || !setRouteNodes) return;
        const { routeId, nodeIdx } = nodeMenu;
        setRouteNodes(prev => {
            const nodes = [...(prev[routeId] || baseNodes(routeId) || [])];
            const curr = nodes[nodeIdx];
            if (!curr) return prev;
            nodes.splice(nodeIdx + 1, 0, { lat: curr.lat - 0.05, lon: curr.lon + 0.05 });
            return { ...prev, [routeId]: nodes };
        });
        setNodeMenu(null);
    };

    const handleDeleteNode = () => {
        if (!nodeMenu || !setRouteNodes) return;
        const { routeId, nodeIdx } = nodeMenu;
        setRouteNodes(prev => {
            const nodes = [...(prev[routeId] || baseNodes(routeId) || [])];
            if (nodes.length <= 3) return prev;
            nodes.splice(nodeIdx, 1);
            return { ...prev, [routeId]: nodes };
        });
        setNodeMenu(null);
    };

    const fitTo = (bounds) => mapRef.current?.fitBounds(bounds, { padding: 24, duration: 700 });

    const exportMapAsImage = () => {
        const map = mapRef.current;
        if (!map) return;
        const a = document.createElement('a');
        a.download = 'CCUS_Pipeline_Map.png';
        a.href = map.getCanvas().toDataURL('image/png');
        a.click();
    };

    const regionBtn = 'px-3 py-1.5 hover:bg-blue-50 hover:text-blue-600 rounded transition-colors';

    return (
        <div className="w-full h-full relative bg-slate-50/80 rounded-lg overflow-hidden border border-slate-200 min-h-[400px]" onContextMenu={(e) => e.preventDefault()}>
            <MapLibreBase onStyleReady={onStyleReady} />

            {/* 左上：快速導航 */}
            <div className="absolute top-3 left-3 md:top-4 md:left-4 z-20 pointer-events-auto max-w-[calc(100%-4.5rem)] overflow-x-auto no-scrollbar">
                <div className="flex bg-white/95 p-1 rounded-lg shadow-sm border border-slate-200 backdrop-blur text-sm font-bold text-slate-600 whitespace-nowrap">
                    <button onClick={() => fitTo(TAIWAN_BOUNDS)} className={regionBtn}>全視角</button>
                    {Object.entries(REGION_BOUNDS).map(([name, b]) => (
                        <button key={name} onClick={() => fitTo(b)} className={`${regionBtn} border-l border-slate-200`}>{name}</button>
                    ))}
                </div>
            </div>
            <div className="absolute top-16 left-4 z-20 bg-white/95 backdrop-blur shadow-2xl rounded-xl border border-slate-200 p-3 transition-all duration-300 w-64 pointer-events-none" style={{ opacity: hoveredNode && !nodeMenu ? 1 : 0, transform: hoveredNode && !nodeMenu ? 'translateY(0)' : 'translateY(-10px)' }}>
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

            {/* 右上：縮放與輸出 */}
            <div className="absolute top-3 right-3 md:top-4 md:right-4 z-10 flex flex-col gap-1.5 md:gap-2 bg-white/95 p-1 md:p-1.5 rounded-lg shadow-sm border border-slate-200 backdrop-blur">
                <button onClick={() => mapRef.current?.zoomIn()} className="hidden md:block p-2 bg-slate-50 hover:bg-slate-200 rounded-md text-slate-600 transition-colors" title="放大" aria-label="放大"><ZoomIn size={18}/></button>
                <button onClick={() => mapRef.current?.zoomOut()} className="hidden md:block p-2 bg-slate-50 hover:bg-slate-200 rounded-md text-slate-600 transition-colors" title="縮小" aria-label="縮小"><ZoomOut size={18}/></button>
                <button onClick={() => fitTo(TAIWAN_BOUNDS)} className="p-2 bg-slate-50 hover:bg-slate-200 rounded-md text-slate-600 transition-colors" title="重置畫面" aria-label="重置畫面"><Maximize size={18}/></button>
                <div className="w-full h-px bg-slate-200 md:my-1"></div>
                <button onClick={exportMapAsImage} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md transition-colors font-bold flex items-center justify-center" title="輸出地圖圖片" aria-label="輸出地圖圖片"><DownloadCloud size={18}/></button>
            </div>

            {/* 左下：圖例（手機預設收合） */}
            <div className="absolute left-3 bottom-8 md:left-4 z-10 max-w-[calc(100%-1.5rem)]">
                {legendOpen ? (
                    <div className="bg-white/95 backdrop-blur rounded-xl border border-slate-200 shadow-sm p-3 text-[11px] text-slate-700 font-bold w-[272px] max-w-full space-y-1.5">
                        <div className="flex items-center justify-between -mt-0.5 mb-1">
                            <span className="text-xs text-slate-500 tracking-wider">圖例</span>
                            <button onClick={() => setLegendOpen(false)} className="w-7 h-7 -mr-1 rounded-md hover:bg-slate-100 text-slate-400 flex items-center justify-center" aria-label="收合圖例"><X size={14}/></button>
                        </div>
                        {isPlanning ? (
                            <>
                                <LegendRow sym={<span className="w-3 h-3 bg-[#0ea5e9] border border-white shadow-sm" />}>海洋接收站／本土封存樞紐（可拖曳）</LegendRow>
                                <LegendRow sym={<span className="w-3 h-3 bg-[#b45309] border border-white shadow-sm" />}>陸地封存場域（可拖曳）</LegendRow>
                                <div className="h-px bg-slate-200 !my-2" />
                                <LegendRow sym={<span className="w-3 h-3 rounded-full bg-[#a855f7]" />}>大型發電廠（依碳排大小）</LegendRow>
                                <LegendRow sym={<span className="w-3 h-3 rounded-full bg-[#e11d48]" />}>一般優先碳源（≥ 2.5萬噸）</LegendRow>
                                <LegendRow sym={<span className="w-2 h-2 rounded-full bg-[#f97316]" />}>次要碳源（&lt; 2.5萬噸）</LegendRow>
                                <div className="h-px bg-slate-200 !my-2" />
                                <LegendRow sym={<span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-[#3b82f6]" />}>管線節點（可拖曳）</LegendRow>
                                <div className="pl-6 -mt-1 text-[10px] font-medium text-slate-500">點藍線新增節點・點節點開選單・右鍵刪除</div>
                                <LegendRow sym={<span className="w-5 h-[3px] bg-[#3b82f6]" />}>主幹管線（&gt;50km 以橘色虛線警示）</LegendRow>
                                <LegendRow sym={<span className="w-5 h-[2px] bg-[#94a3b8]" />}>直線就近上管（優先≤50km，次要≤20km）</LegendRow>
                                <LegendRow sym={<span className="w-5 border-t-2 border-dashed border-[#f59e0b]" />}>孤立廠區陸運接駁（控制點可拖曳）</LegendRow>
                                <LegendRow sym={<span className="w-5 border-t-2 border-dashed border-[#0284c7]" />}>樞紐海運外繞（控制點可拖曳）</LegendRow>
                            </>
                        ) : (
                            <>
                                {activeLayers.includes('capture') && <LegendRow sym={<span className="w-3 h-3 rounded-full bg-[#3b82f6]" />}>捕捉端（依捕捉量，顏色為技術別）</LegendRow>}
                                {activeLayers.includes('future') && <LegendRow sym={<span className="w-3 h-3 rounded-full bg-[#d97706]/70" />}>潛力擴充點源</LegendRow>}
                                {activeLayers.includes('util') && <LegendRow sym={<span className="w-3 h-3 rounded-full bg-[#10b981]" />}>再利用端（依需求量）</LegendRow>}
                                {activeLayers.includes('storage') && <LegendRow sym={<span className="w-3 h-3 rounded-full bg-[#ef4444]" />}>封存場域（實線管線／虛線船運）</LegendRow>}
                            </>
                        )}
                    </div>
                ) : (
                    <button onClick={() => setLegendOpen(true)} className="h-9 px-3 rounded-lg bg-white/95 border border-slate-200 shadow-sm text-xs font-bold text-slate-600 flex items-center gap-1.5"><Layers size={14}/> 圖例</button>
                )}
            </div>
        </div>
    );
};

const LegendRow = ({ sym, children }) => (
    <div className="flex items-center gap-2 leading-tight"><span className="w-4 flex items-center justify-center flex-shrink-0">{sym}</span><span>{children}</span></div>
);

// 案場與管線規劃、排放源清單用範疇一登錄資料；整合地圖/碳捕捉/碳封存/碳再利用用問卷整併資料庫
const CCUS_TABS = [
    { id: 'planning', label: '案場與管線規劃', icon: Map },
    ...CCUS_SURVEY_TABS.map(t => ({ id: t.value, label: t.label, icon: t.icon })),
    { id: 'sources', label: '排放源清單', icon: List },
];

const CcusDashboard = ({ onOpenTrade }) => {
    const [activeTab, setActiveTab] = useState('planning'); 
    const [scope1Data, setScope1Data] = useState([]); 
    const [loading, setLoading] = useState(true);
    
    const [showPowerPlants, setShowPowerPlants] = useState(true); // 新增：電廠顯示開關

    const [hubs, setHubs] = useState({});
    const [clusters, setClusters] = useState({});
    const [refParams, setRefParams] = useState({});
    const [loadError, setLoadError] = useState(null);
    const [routeNodes, setRouteNodes] = useState({});
    const [seaControlPoints, setSeaControlPoints] = useState({});
    const [landControlPoints, setLandControlPoints] = useState({});

    const [listRegion, setListRegion] = useState('ALL');
    const [listIndustry, setListIndustry] = useState('ALL');
    const [selectedHubId, setSelectedHubId] = useState('NORTH_HUB');

    useEffect(() => {
        // 全部改讀資料庫：範疇一排放源（energy_facility_records / ccus_scope1）、已查證座標
        // （ccus_emission_records）、封存樞紐與聚落節點（ccus_storage_sites / ccus_network_nodes）。
        const fetchAllData = async () => {
            setLoading(true);
            try {
                const [rawScope1, verified, survey] = await Promise.all([
                    fetchScope1Rows(),
                    fetchVerifiedEmitterCoords().catch(() => []),
                    fetchCcusSurvey(),
                ]);
                setHubs(Object.fromEntries(survey.sites.filter(s => s.kind === 'hub').map(s => [s.site_id, {
                    id: s.site_id, name: s.name, type: s.site_type, lat: Number(s.lat), lon: Number(s.lon), region: s.region,
                }])));
                setClusters(Object.fromEntries(survey.nodes.map(n => [n.node_id, {
                    id: n.node_id, name: n.name, lat: Number(n.lat), lon: Number(n.lon), next: n.next_node_id, type: n.transport,
                }])));
                setRefParams(paramsByKey(survey.params));
                const coordByControlNo = new globalThis.Map(verified.map(v => [v.control_no, v]));

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

                    // 有查證過的地址座標就用（ccus_emission_records.coord_source = verified*），否則沿用公司名推估
                    const v = coordByControlNo.get(String(d['管制編號'] || '').trim());
                    const coords = v ? { lat: Number(v.latitude), lon: Number(v.longitude) } : getApproximateCoordinates(plantRaw, comp, countyStr);
                    const zone = getIndustrialZone(plantRaw, comp, countyStr);
                    const region = getRefinedRegion(plantRaw, comp, countyStr);
                    const scope1Val = cleanNumber(d[emit1Key]); const scope2Val = cleanNumber(d[emit2Key]); const totalVal = cleanNumber(d[emitTotalKey]) || (scope1Val + scope2Val);

                    const isPowerPlant = comp.includes('台電') || rawName.includes('發電廠');

                    return { Company: comp, Plant: rawName, Scope1: scope1Val, Scope2: scope2Val, TotalScope: totalVal, Industry: d[indKey] || '', County: countyStr, zone, Region: region, lat: coords.lat, lon: coords.lon, coordSource: v ? v.coord_source : 'estimated', isPowerPlant };
                }).filter(d => {
                    if (!d || d.TotalScope <= 0) return false;
                    const scope2Ratio = d.Scope2 / d.TotalScope;
                    if (scope2Ratio > 0.7 && d.Scope1 < 50000) return false; 
                    return true; 
                }).sort((a,b) => b.Scope1 - a.Scope1)); 
            } catch (err) { console.error(err); setLoadError(err.message); } finally { setLoading(false); }
        };
        fetchAllData();
    }, []);

    const ccsTopology = useMemo(() => {
        if (!scope1Data || scope1Data.length === 0 || Object.keys(clusters).length === 0 || Object.keys(hubs).length === 0) return null;

        const activeClusters = JSON.parse(JSON.stringify(clusters));
        Object.keys(activeClusters).forEach(k => { activeClusters[k].id = k; activeClusters[k].emissions = 0; activeClusters[k].sources = []; });

        const hubSources = {}; Object.keys(hubs).forEach(k => hubSources[k] = []);
        const validSources = []; const branchRoutes = []; const landRoutes = [];
        const hubEmissions = Object.fromEntries(Object.keys(hubs).map(k => [k, 0]));

        const allMainNodes = [];
        Object.values(activeClusters).forEach(c => allMainNodes.push({id: c.id, lat: c.lat, lon: c.lon, name: c.name}));
        Object.values(hubs).forEach(h => allMainNodes.push({id: h.id, lat: h.lat, lon: h.lon, name: h.name}));
        
        const currentRouteNodes = { ...routeNodes };
        Object.values(currentRouteNodes).forEach(nodesArray => {
            nodesArray.slice(1, -1).forEach((node, idx) => {
                 allMainNodes.push({id: `route_node_${idx}`, lat: node.lat, lon: node.lon, name: '管線節點'});
            });
        });

        const countyMap = { '基隆': 'C_TPE', '台北': 'C_TPE', '臺北': 'C_TPE', '新北': 'C_TPE', '桃園': 'C_TYN_COAST', '新竹': 'C_HSZ', '苗栗': 'C_MIA', '台中': 'C_TXG', '臺中': 'C_TXG', '南投': 'C_TXG', '雲林': 'C_YUN_IN', '嘉義': 'C_CYI', '台南': 'C_TNN', '臺南': 'C_TNN', '高雄': 'C_KHH_N', '屏東': 'C_PTG', '宜蘭': 'C_YIL', '花蓮': 'C_HUA', '台東': 'C_TTT', '臺東': 'C_TTT' };

        scope1Data.forEach(d => {
            if (!showPowerPlants && d.isPowerPlant) return; // 新增：電廠過濾機制

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
                validSources.push({...d, distToCenter: minDist, initialClusterId: cId, distanceToCenter: minDist, distanceToHub: minDist}); 
                if (minDist > 0.002) branchRoutes.push({ from: d, to: bestNode, isPriority: d.isPriority });
            } else {
                let closestHub = null; let hubDist = Infinity;
                Object.values(hubs).forEach(h => {
                    const hd = calcDistanceKm(d.lat, d.lon, h.lat, h.lon);
                    if(hd < hubDist) { hubDist = hd; closestHub = h; }
                });
                if (closestHub) {
                    const landDist = hubDist * 1.4;
                    landRoutes.push({ from: d, to: closestHub, distance: landDist, weight: d.Scope1 });
                    validSources.push({...d, distanceToHub: -1, landDist, landTarget: closestHub.name});
                    hubEmissions[closestHub.id] += d.Scope1;
                    hubSources[closestHub.id].push({...d, distanceToHub: landDist});
                } else {
                    validSources.push({...d, distanceToHub: -1});
                }
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
        const addEdge = (fromNode, toNode, flow, type) => { const key = `${fromNode.id}_${toNode.id}`; if (!edges[key]) edges[key] = { id: key, from: fromNode, to: toNode, flow: 0, type, nodes: [fromNode, toNode] }; edges[key].flow += flow; };

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
                
                const activeC1 = seaControlPoints[edge.id]?.c1 || c1;
                const activeC2 = seaControlPoints[edge.id]?.c2 || c2;
                
                const d1 = calcDistanceKm(edge.from.lat, edge.from.lon, activeC1.lat, activeC1.lon);
                const d2 = calcDistanceKm(activeC1.lat, activeC1.lon, activeC2.lat, activeC2.lon);
                const d3 = calcDistanceKm(activeC2.lat, activeC2.lon, edge.to.lat, edge.to.lon);
                const totalSeaDist = d1 + d2 + d3;
                
                seaRoutes.push({ ...edge, distance: totalSeaDist, label: `海運 (${Number(totalSeaDist||0).toFixed(0)}km)`, c1: activeC1, c2: activeC2 });
            } else {
                let nodesForRoute = currentRouteNodes[edge.id];
                if (!nodesForRoute) {
                    const dx = edge.to.lon - edge.from.lon; const dy = edge.to.lat - edge.from.lat;
                    const midNode = { lon: edge.from.lon + dx * 0.5 + (dx > 0 ? 0.05 : -0.05), lat: edge.from.lat + dy * 0.5 };
                    nodesForRoute = [edge.from, midNode, edge.to];
                } else {
                    nodesForRoute[0] = edge.from; 
                    nodesForRoute[nodesForRoute.length - 1] = edge.to;
                }
                
                const recalcDist = (nodesArr) => {
                    let total = 0;
                    for (let i = 0; i < nodesArr.length - 1; i++) {
                        total += calcDistanceKm(nodesArr[i].lat, nodesArr[i].lon, nodesArr[i+1].lat, nodesArr[i+1].lon);
                    }
                    return total * 1.3; 
                };

                mainRoutes.push({ ...edge, nodes: nodesForRoute, recalcDist });
            }
        });

        const activeClusterNodes = Object.values(activeClusters).filter(c => c.emissions > 0);
        return { mainRoutes, branchRoutes, landRoutes, seaRoutes, activeClusterNodes, hubSources, hubEmissions, validSources };
    }, [scope1Data, hubs, clusters, routeNodes, seaControlPoints, landControlPoints, showPowerPlants]);

    const scope1Stats = useMemo(() => {
        let totalS1 = 0, totalS2 = 0, total = 0; const zones = {};
        scope1Data.forEach(d => {
            if (!showPowerPlants && d.isPowerPlant) return;
            totalS1 += (Number(d.Scope1) || 0); totalS2 += (Number(d.Scope2) || 0); total += (Number(d.TotalScope) || 0);
            if(!zones[d.zone]) zones[d.zone] = { name: d.zone, Scope1: 0, Scope2: 0, Total: 0, region: d.Region };
            zones[d.zone].Scope1 += (Number(d.Scope1) || 0); zones[d.zone].Scope2 += (Number(d.Scope2) || 0); zones[d.zone].Total += (Number(d.TotalScope) || 0);
        });
        return { total, totalS1, totalS2, topZones: Object.values(zones).sort((a,b)=>b.Total - a.Total) };
    }, [scope1Data, showPowerPlants]);

    const regionStats = useMemo(() => {
        const map = { '北區': 0, '中區': 0, '南區': 0, '東區': 0, '其他': 0 };
        scope1Data.forEach(d => {
            if (!showPowerPlants && d.isPowerPlant) return;
            const reg = d.Region || '其他';
            if (map[reg] !== undefined) map[reg] += (Number(d.Scope1) || 0);
            else map['其他'] += (Number(d.Scope1) || 0);
        });
        return map;
    }, [scope1Data, showPowerPlants]);

    const countyStats = useMemo(() => {
        const map = {};
        const dataToUse = ccsTopology ? ccsTopology.validSources : scope1Data.filter(d => showPowerPlants || !d.isPowerPlant);
        dataToUse.forEach(d => {
            if (listRegion !== 'ALL' && d.Region !== listRegion) return;
            const c = d.County || '未知';
            if (!map[c]) map[c] = { name: c, scope1: 0, scope2: 0, total: 0 };
            map[c].scope1 += (Number(d.Scope1) || 0);
            map[c].scope2 += (Number(d.Scope2) || 0);
            map[c].total += (Number(d.TotalScope) || 0);
        });
        return Object.values(map).sort((a,b) => b.total - a.total);
    }, [ccsTopology, scope1Data, listRegion, showPowerPlants]);


    const availableIndustries = useMemo(() => ['ALL', ...Array.from(new Set(scope1Data.filter(d => showPowerPlants || !d.isPowerPlant).map(d => d.Industry))).filter(Boolean)], [scope1Data, showPowerPlants]);
    const filteredScope1Data = useMemo(() => {
        return scope1Data.filter(d => (showPowerPlants || !d.isPowerPlant) && (listRegion === 'ALL' || d.Region === listRegion) && (listIndustry === 'ALL' || d.Industry === listIndustry));
    }, [scope1Data, listRegion, listIndustry, showPowerPlants]);

    const selectedHubSources = useMemo(() => {
        if (!ccsTopology || !ccsTopology.hubSources[selectedHubId]) return [];
        return [...ccsTopology.hubSources[selectedHubId]].sort((a,b) => (Number(b.Scope1)||0) - (Number(a.Scope1)||0));
    }, [ccsTopology, selectedHubId]);

    const selectedHubTotalEmissions = useMemo(() => {
        if (!ccsTopology || !ccsTopology.hubEmissions[selectedHubId]) return 0;
        return ccsTopology.hubEmissions[selectedHubId];
    }, [ccsTopology, selectedHubId]);

    if (loading) return <div className="p-10 text-center animate-pulse text-teal-600 flex flex-col items-center"><RefreshCw className="animate-spin mb-2"/> CCUS 地理資料建構中...</div>;
    if (loadError && (activeTab === 'planning' || activeTab === 'sources') && scope1Data.length === 0) return <div className="m-4 p-6 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm"><div className="font-bold mb-1">資料庫讀取失敗</div>{loadError}</div>;


    return (
        <div className="space-y-5 md:space-y-6 animate-fade-in pb-10 min-h-screen px-3 py-4 md:p-6">
            <div className="card overflow-hidden">
                <div className="flex items-center gap-3 px-3 md:px-5 pt-3">
                    <div className="hidden md:flex items-center gap-2 text-lg text-brand-ink font-bold whitespace-nowrap"><Leaf className="text-brand"/> CCUS 碳捕捉與封存戰情室</div>
                </div>
                <div role="tablist" aria-label="CCUS 分頁" className="flex overflow-x-auto no-scrollbar px-2 md:px-4 mt-1 border-t border-brand-line">
                    {CCUS_TABS.map(({ id, label, icon }) => { const TabIcon = icon; return (
                        <button key={id} role="tab" aria-selected={activeTab === id} onClick={() => setActiveTab(id)} className={`tab-btn ${activeTab === id ? 'tab-btn-on' : ''}`}>
                            <TabIcon size={17}/> {label}
                        </button>
                    ); })}
                </div>
            </div>

            {(activeTab === 'planning' || activeTab === 'sources') && (
                <div className="space-y-5 md:space-y-6 animate-fade-in">
                    <div className="flex md:grid md:grid-cols-3 gap-3 md:gap-6 overflow-x-auto no-scrollbar snap-x -mx-3 px-3 md:mx-0 md:px-0 [&>*]:min-w-[80%] [&>*]:snap-start md:[&>*]:min-w-0 [&>*]:flex-shrink-0 md:[&>*]:flex-shrink">
                        <div className="card p-5 flex items-center justify-between">
                            <div><p className="text-xs text-slate-500 font-bold mb-1 uppercase">符合門檻之廠區總排放量 (範疇 1+2)</p><h3 className="text-2xl font-black text-rose-700">{(Number(scope1Stats.total || 0) / 10000).toFixed(1)} <span className="text-sm font-medium text-slate-500">萬噸</span></h3></div>
                            <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600"><AlertTriangle size={24}/></div>
                        </div>
                        <div className="card p-5 flex items-center justify-between border-l-4 border-l-indigo-500">
                            <div><p className="text-xs text-slate-500 font-bold mb-1 uppercase">高潛力工業區集群數</p><h3 className="text-2xl font-black text-indigo-700">{scope1Stats.topZones.filter(z=>z.Total>1000000).length} <span className="text-sm font-medium text-slate-500">個 (&gt;百萬噸)</span></h3></div>
                            <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600"><Layers size={24}/></div>
                        </div>
                        <div className="card p-5 flex items-center justify-between border-l-4 border-l-sky-500">
                            <div><p className="text-xs text-slate-500 font-bold mb-1 uppercase">自動推演管線距離評估</p><h3 className="text-2xl font-black text-sky-700">啟用 <span className="text-sm font-medium text-slate-500">可自由規劃多節點</span></h3></div>
                            <div className="w-12 h-12 rounded-full bg-sky-50 flex items-center justify-center text-sky-600"><Route size={24}/></div>
                        </div>
                    </div>

                    {activeTab === 'planning' && (
                    <>
                    <div className="grid grid-cols-1 gap-6">
                        <div className="card p-3 flex flex-col h-[65vh] min-h-[500px] max-h-[800px]">
                            <div className="flex justify-between items-center mb-3 border-b pb-2">
                                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2"><Map size={16} className="text-indigo-500"/> CCS 案場與共通管線拓樸分析</h3>
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer bg-slate-100 px-3 py-1.5 rounded-lg shadow-inner">
                                    <input type="checkbox" checked={showPowerPlants} onChange={e => setShowPowerPlants(e.target.checked)} className="rounded text-purple-600 focus:ring-purple-500" />
                                    顯示大型發電廠 (紫標)
                                </label>
                            </div>
                            <div className="flex-1 w-full h-full relative min-h-0">
                                <ErrorBoundary>
                                    <TaiwanCcusMap activeLayers={['planning']} ccsTopology={ccsTopology} hubs={hubs} setHubs={setHubs} setClusters={setClusters} routeNodes={routeNodes} setRouteNodes={setRouteNodes} seaControlPoints={seaControlPoints} setSeaControlPoints={setSeaControlPoints} landControlPoints={landControlPoints} setLandControlPoints={setLandControlPoints} />
                                </ErrorBoundary>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                        <div className="card p-4 flex flex-col h-[400px]">
                            <h3 className="font-bold text-slate-800 text-base mb-3 border-b pb-2 flex items-center gap-2"><MapPin size={16} className="text-indigo-500"/> 區域與樞紐碳排分佈</h3>
                            <div className="overflow-y-auto custom-scrollbar pr-2 space-y-4 flex-1">
                                <div>
                                    <h4 className="text-xs font-bold text-slate-500 mb-2">地理分區原生排放量 (範疇一)</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['北區', '中區', '南區', '東區'].map((reg) => (
                                            <div key={reg} className="bg-slate-50 p-2 rounded border border-slate-100 flex justify-between items-center">
                                                <span className="text-xs text-slate-600 font-bold">{reg}</span>
                                                <span className="text-xs font-mono font-black text-rose-600">{(regionStats[reg]/10000).toFixed(1)} <span className="font-normal text-[9px] text-slate-400">萬噸</span></span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-slate-500 mb-2">封存樞紐管網預估接收量</h4>
                                    <div className="space-y-2">
                                        {Object.values(hubs).map(hub => {
                                            const val = ccsTopology?.hubEmissions?.[hub.id] || 0;
                                            return (
                                                <div key={hub.id} className="bg-blue-50 p-2 rounded border border-blue-100 flex justify-between items-center">
                                                    <span className="text-xs text-blue-800 font-bold truncate pr-2" title={hub.name}>{hub.name}</span>
                                                    <span className="text-xs font-mono font-black text-blue-700">{(val/10000).toFixed(1)} <span className="font-normal text-[9px] text-blue-400">萬噸</span></span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="card p-4 flex flex-col h-[400px]">
                            <h3 className="font-bold text-slate-800 text-base mb-3 border-b pb-2 flex items-center gap-2"><Route size={16} className="text-sky-500"/> 區域管線佈建可行性分析</h3>
                            <div className="flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar">
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
                                    <div className="text-xs text-slate-600 leading-relaxed">排放源相對分散。新竹先往北牽至桃園內陸，再與桃園沿海會合，集中至林口沿岸，轉由海管輸送至林口外海封存。大於50km之主幹管線(橘色虛線)需依賴陸運車隊。</div>
                                </div>
                                <div className="bg-emerald-50 p-3 rounded border border-emerald-200">
                                    <div className="text-xs font-bold text-emerald-700 mb-1">💡 運輸成本基準參考（資料表 energy_ref_parameters）</div>
                                    <ul className="text-xs text-emerald-700 leading-relaxed space-y-0.5">
                                        {Object.values(refParams).filter(p => p.category === 'cost_benchmark').map(p => (
                                            <li key={p.key}>{p.label}：<b>{Number(p.value).toLocaleString()}</b> {p.unit}{p.note ? `（${p.note}）` : ''}</li>
                                        ))}
                                    </ul>
                                    <div className="text-[10px] text-emerald-600 mt-1">海運起步成本高但距離邊際成本低；短距孤立廠區(&lt;50km)建議採陸運槽車。</div>
                                </div>
                            </div>
                        </div>

                        <div className="card p-4 flex flex-col h-[450px]">
                            <div className="flex justify-between items-center mb-3 border-b pb-2">
                                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                                    <Anchor size={16} className="text-blue-500"/> 封存點位管網接收碳源分析
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

                            <div className="overflow-y-auto custom-scrollbar flex-1 border border-slate-100 rounded-lg">
                                <table className="w-full text-sm text-left relative whitespace-nowrap">
                                    <thead className="bg-blue-50/50 sticky top-0 shadow-sm z-10">
                                        <tr>
                                            <th className="p-3 text-blue-800">事業名稱</th>
                                            <th className="p-3 text-blue-800">縣市</th>
                                            <th className="p-3 text-right text-blue-800">管線/陸運預估</th>
                                            <th className="p-3 text-right text-blue-800">範疇一(噸)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-blue-50">
                                        {selectedHubSources.map((row, i) => (
                                            <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                                                <td className="p-3 font-bold text-slate-700 truncate max-w-[180px] md:max-w-[220px]" title={row.Plant}>
                                                    {row.isPowerPlant ? <span className="mr-1 text-[10px] text-purple-600 font-black" title="大型電廠">●</span> : (row.isPriority ? <span className="mr-1 text-[10px] text-rose-500 font-black" title="優先碳源">●</span> : <span className="mr-1 text-[10px] text-orange-400 font-black" title="次要碳源">●</span>)}
                                                    {row.Plant}
                                                </td>
                                                <td className="p-3 text-slate-500">{row.County}</td>
                                                <td className={`p-3 text-right font-mono ${row.distanceToHub < 0 ? 'text-amber-600 font-bold' : (row.distanceToHub > 50 ? 'text-orange-500 font-bold' : 'text-slate-500')}`}>
                                                    {row.distanceToHub < 0 ? `陸運 ${Number(row.landDist||0).toFixed(0)}km` : `${Number(row.distanceToHub||0).toFixed(0)}km`}
                                                </td>
                                                <td className="p-3 text-right font-mono font-bold text-rose-600">{Number(row.Scope1||0).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                        {selectedHubSources.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400">此樞紐目前未分配到任何有效碳源廠區。</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    </>
                    )}

                    {activeTab === 'sources' && (
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6">
                        <div className="lg:col-span-2 min-w-0">
                        <div className="card p-4 flex flex-col h-[640px]">
                            <div className="flex justify-between items-center mb-3 border-b pb-2">
                                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2"><MapPin size={16} className="text-indigo-500"/> 縣市排放量總表 (萬噸)</h3>
                                <select value={listRegion} onChange={e => setListRegion(e.target.value)} className="bg-slate-50 border border-slate-200 text-slate-600 font-bold px-2 py-1 rounded outline-none text-xs">
                                    <option value="ALL">全區域</option><option value="北區">北區</option><option value="中區">中區</option><option value="南區">南區</option><option value="東區">東區</option>
                                </select>
                            </div>
                            <div className="flex-1 overflow-auto custom-scrollbar border border-slate-100 rounded-lg">
                                <table className="w-full text-sm text-left whitespace-nowrap">
                                    <thead className="bg-slate-50 sticky top-0 shadow-sm z-10">
                                        <tr>
                                            <th className="p-3">縣市</th>
                                            <th className="p-3 text-right text-rose-600">範疇一(可CCS)</th>
                                            <th className="p-3 text-right text-slate-500">範疇二</th>
                                            <th className="p-3 text-right font-bold text-slate-700">總和</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {countyStats.map(row => (
                                            <tr key={row.name} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-3 font-bold text-slate-700">{row.name}</td>
                                                <td className="p-3 text-right font-mono text-rose-600">{(row.scope1/10000).toFixed(1)}</td>
                                                <td className="p-3 text-right font-mono text-slate-500">{(row.scope2/10000).toFixed(1)}</td>
                                                <td className="p-3 text-right font-mono font-bold text-slate-800">{(row.total/10000).toFixed(1)}</td>
                                            </tr>
                                        ))}
                                        {countyStats.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400">無區域資料</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        </div>
                        <div className="lg:col-span-3 min-w-0">
                        <div className="card p-4 flex flex-col h-[640px]">
                            <div className="flex flex-wrap justify-between items-center mb-3 border-b pb-2 gap-2">
                                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2"><List size={16} className="text-rose-500"/> 排放點源總表 (含孤立點)</h3>
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
                            
                            <div className="overflow-y-auto custom-scrollbar flex-1 border border-slate-100 rounded-lg">
                                <table className="w-full text-sm text-left relative whitespace-nowrap">
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
                                                <td className="p-3 font-bold text-slate-700 truncate max-w-[180px] md:max-w-[220px]" title={row.Plant}>
                                                    {row.isPowerPlant ? <span className="mr-1 text-[10px] text-purple-600 font-black" title="大型電廠">●</span> : (row.isPriority ? <span className="mr-1 text-[10px] text-rose-500 font-black" title="優先碳源">●</span> : <span className="mr-1 text-[10px] text-orange-400 font-black" title="次要碳源">●</span>)}
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
                </div>
            )}

            {/* CCUS 問卷資料：整合地圖 / 碳捕捉 / 碳封存 / 碳再利用（資料來源：Supabase 問卷整併表） */}
            {CCUS_SURVEY_TABS.some(t => t.value === activeTab) && (
                <div className="animate-fade-in">
                    <CcusSurveyPanel view={activeTab} onOpenTrade={onOpenTrade} />
                </div>
            )}
        </div>
    );
};

export default CcusDashboard;