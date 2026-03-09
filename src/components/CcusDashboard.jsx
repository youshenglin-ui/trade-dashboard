import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ScatterChart, Scatter, ZAxis, Cell, LabelList, ComposedChart, Line, Label, PieChart, Pie
} from 'recharts';
import { 
  Leaf, RefreshCw, Target, Activity, MapPin, DollarSign, Box, AlertTriangle, 
  Truck, Ship, GripHorizontal, FlaskConical, Plus, ZoomIn, ZoomOut, Maximize, Hand, Factory, List, Rocket, Map, Route, Anchor, Layers, Filter, PieChart as PieChartIcon, DownloadCloud
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
      '大連化學工業': '大連化學',
      '李長榮化學工業': '李長榮',
      '國喬石油化學': '國喬',
      '南亞塑膠工業': '南亞塑膠',
      '臺鹽實業': '台鹽', '台鹽實業': '台鹽'
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
    
    const result = [];
    let row = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                current += '"';
                i++; 
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            row.push(current.trim());
            current = '';
        } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
            if (char === '\r') i++; 
            row.push(current.trim());
            result.push(row);
            row = [];
            current = '';
        } else {
            current += char;
        }
    }
    if (current || row.length > 0) {
        row.push(current.trim());
        result.push(row);
    }
    
    if (result.length < 2) return [];
    
    const headers = result[0].map(h => h.replace(/^[\uFEFF\s]+|[\s]+$/g, ''));
    return result.slice(1).map(rowArray => {
        const obj = {};
        headers.forEach((h, i) => {
            obj[h] = rowArray[i] !== undefined ? rowArray[i] : '';
        });
        return obj;
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
    const factor = isSeaRoute ? 1.1 : 1.4;
    return straightDistance * factor;
};

const getRefinedRegion = (plantName, companyName, county) => {
    const p = String(plantName || '').trim();
    const c = String(companyName || '').trim();
    const cty = String(county || '').trim();
    const full = `${c} ${p} ${cty}`;
    
    if (full.match(/(台北|臺北|新北|桃園|新竹|基隆)/)) return '北區';
    if (full.match(/(苗栗|台中|臺中|彰化|雲林|南投|嘉義)/)) return '中區';
    if (full.match(/(台南|臺南|高雄|屏東|台東|臺東)/)) return '南區';
    if (full.match(/(宜蘭|花蓮)/)) return '東區';
    
    if (c.includes('台鹽') || c.includes('臺鹽') || p.includes('通霄')) return '中區';

    return '其他';
};

const getIndustrialZone = (plant, company, county) => {
    const p = String(plant || '').trim();
    const c = String(company || '').trim();
    const cty = String(county || '').trim();
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
    
    // 強制區域歸戶，徹底消滅跨縣市錯誤
    if (cty && cty !== '未知') return `${cty}工業聚落`;
    return `${c}_${p}_獨立廠區`;
};

const getApproximateCoordinates = (plant, company, county) => {
    const n = `${String(company || '')} ${String(plant || '')}`;
    const cty = String(county || '');

    const pseudoRandom = (seed) => {
        let h = 0;
        for(let i=0; i<seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
        return ((Math.abs(h) % 1000) / 1000 - 0.5) * 0.05; 
    };
    
    const offsetLat = pseudoRandom(n + "lat");
    const offsetLon = pseudoRandom(n + "lon");

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
    
    // 基礎縣市定位
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
    'NORTH_HUB': { id: 'NORTH_HUB', name: '台北港/林口 (陸地灌注至海域)', type: '🛢️ 本土外海封存', lat: 25.14, lon: 121.32, region: '北區' },
    'CENTRAL_HUB_1': { id: 'CENTRAL_HUB_1', name: '台中港接收站 (陸地灌注至海域)', type: '🛢️ 本土外海封存', lat: 24.25, lon: 120.45, region: '中區' },
    'CENTRAL_HUB_2': { id: 'CENTRAL_HUB_2', name: '麥寮外海 (陸地灌注至海域)', type: '🛢️ 本土外海封存', lat: 23.80, lon: 120.10, region: '中區' },
    'CENTRAL_HUB_LAND': { id: 'CENTRAL_HUB_LAND', name: '苗栗鐵砧山 (陸地封存)', type: '⛰️ 陸地封存場域', lat: 24.45, lon: 120.68, region: '中區' }, 
    'SOUTH_HUB': { id: 'SOUTH_HUB', name: '高雄港接收站 (輸出轉運)', type: '🚢 港口接收轉運', lat: 22.55, lon: 120.25, region: '南區' },
    'EAST_HUB': { id: 'EAST_HUB', name: '花蓮港接收站 (輸出北送)', type: '🚢 港口接收轉運', lat: 23.98, lon: 121.62, region: '東區' },
    'SOUTHEAST_HUB': { id: 'SOUTHEAST_HUB', name: '台東接收站 (南迴轉運)', type: '🚢 港口接收轉運', lat: 22.75, lon: 121.15, region: '南區' } 
};

class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { hasError: false }; }
    static getDerivedStateFromError(error) { return { hasError: true }; }
    render() {
      if (this.state.hasError) return <div className="h-full flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded text-slate-400"><AlertTriangle size={32} className="mb-2 text-amber-400" /><p className="text-sm">圖表資料異常，請檢查資料來源格式</p></div>;
      return this.props.children;
    }
}

const MAP_CONSTANTS = {
    baseWidth: 800,
    baseHeight: 900,
    centerLon: 120.9,
    centerLat: 23.7,
    baseScale: 400
};

export const projectBase = (lon, lat) => {
    if (lon == null || lat == null || isNaN(lon) || isNaN(lat)) return [-9999, -9999]; 
    return [
        (lon - MAP_CONSTANTS.centerLon) * MAP_CONSTANTS.baseScale, 
        -(lat - MAP_CONSTANTS.centerLat) * MAP_CONSTANTS.baseScale * 1.1
    ];
};

// SVG 繪圖：加入避障與向內陸微彎視覺
const generateTreePath = (x1, y1, x2, y2, isBranch, inlandCurve = false) => {
    if (isBranch) {
        // 支線：向內陸(東側)的微彎，避免直線連線切過海灣
        let cx = (x1 + x2) / 2;
        if (inlandCurve) cx += 15; 
        const cy = (y1 + y2) / 2;
        return `M ${x1} ${y1} Q ${cx} ${cy}, ${x2} ${y2}`;
    } else {
        // 主幹：長途平滑曲線
        let cx1 = x1, cy1 = (y1 + y2) / 2;
        let cx2 = x2, cy2 = (y1 + y2) / 2;
        if (inlandCurve) {
            cx1 += 30; cx2 += 30; // 模擬國道路廊往內陸靠攏
        }
        return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
    }
};

// ==========================================
// 台灣地圖核心模組
// ==========================================
const TaiwanCcusMap = ({ mode = 'capture', captureData = [], utilData = [], storageData = [], scope1Data = [], mapPaths = [], ccsTopology = null, hubs, setHubs }) => {
    const mapRef = useRef(null);
    const containerRef = useRef(null); 
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragState, setDragState] = useState(null); 
    const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
    const [hoveredNode, setHoveredNode] = useState(null);

    const { baseWidth, baseHeight } = MAP_CONSTANTS;

    const handleMouseDown = (e) => { 
        setIsDragging(true); 
        setLastPos({ x: e.clientX, y: e.clientY }); 
    };

    const handleHubMouseDown = (e, hubId) => {
        e.stopPropagation();
        setDragState({
            id: hubId,
            startX: e.clientX,
            startY: e.clientY,
            startLat: hubs[hubId].lat,
            startLon: hubs[hubId].lon
        });
    };

    const handleMouseMove = (e) => {
        if (dragState) {
            const dx = e.clientX - dragState.startX;
            const dy = e.clientY - dragState.startY;
            const dLon = dx / (MAP_CONSTANTS.baseScale * zoom);
            const dLat = -dy / (MAP_CONSTANTS.baseScale * 1.1 * zoom);
            
            if (setHubs) {
                setHubs(prev => ({
                    ...prev,
                    [dragState.id]: {
                        ...prev[dragState.id],
                        lat: dragState.startLat + dLat,
                        lon: dragState.startLon + dLon
                    }
                }));
            }
        } else if (isDragging) {
            setPan(prev => ({ x: prev.x + (e.clientX - lastPos.x), y: prev.y + (e.clientY - lastPos.y) }));
            setLastPos({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseUp = () => { setIsDragging(false); setDragState(null); };
    const handleMouseLeave = () => { setIsDragging(false); setDragState(null); };

    const exportMapAsImage = () => {
        const svgElement = containerRef.current?.querySelector('svg');
        if (!svgElement) return;
        const serializer = new XMLSerializer();
        let svgString = serializer.serializeToString(svgElement);
        svgString = svgString.replace(/<svg /, `<svg style="background-color:#f8fafc;" `);
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        
        img.onload = () => {
            canvas.width = svgElement.clientWidth * 2; 
            canvas.height = svgElement.clientHeight * 2;
            ctx.scale(2, 2);
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            const a = document.createElement('a');
            a.download = 'CCS_Pipeline_Map.png';
            a.href = canvas.toDataURL('image/png');
            a.click();
        };
        img.src = url;
    };

    const textScale = Math.pow(zoom, 0.7);

    return (
        <div className="w-full h-full relative bg-slate-50/80 rounded-lg overflow-hidden border border-slate-200" ref={containerRef}>
            <div className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur shadow-2xl rounded-xl border border-slate-200 p-4 transition-all duration-300 w-80 pointer-events-none" style={{ opacity: hoveredNode ? 1 : 0, transform: hoveredNode ? 'translateY(0)' : 'translateY(-10px)' }}>
                {hoveredNode && mode === 'planning' && hoveredNode.type === 'hub' && (
                    <div>
                        <div className="flex items-center gap-2 mb-3 border-b border-blue-100 pb-2">
                            {hoveredNode.name.includes('接收站') ? <Ship size={18} className="text-blue-600"/> : hoveredNode.name.includes('鐵砧山') ? <MapPin size={18} className="text-amber-700"/> : <Anchor size={18} className="text-blue-600"/>}
                            <h3 className="font-bold text-slate-800 text-sm">{hoveredNode.name}</h3>
                        </div>
                        <div className="bg-blue-50 p-2 rounded border border-blue-100 mb-2">
                            <div className="text-xs font-bold text-blue-800 mb-1">樞紐定位 (可拖曳移動)</div>
                            <div className="text-xs text-blue-700">{hoveredNode.hubType}</div>
                        </div>
                        {ccsTopology && ccsTopology.hubEmissions[hoveredNode.id] > 0 && (
                             <div className="bg-slate-50 p-2 rounded border border-slate-200 flex justify-between items-center">
                                 <span className="text-slate-600 text-xs font-bold">預估接收總量</span>
                                 <span className="font-mono font-black text-blue-600 text-sm">{(Number(ccsTopology.hubEmissions[hoveredNode.id] || 0) / 10000).toFixed(1)} 萬噸</span>
                             </div>
                        )}
                    </div>
                )}
                {hoveredNode && mode === 'planning' && hoveredNode.type === 'source' && (
                    <div>
                        <div className="flex items-center gap-2 mb-3 border-b border-rose-100 pb-2">
                            <Factory size={16} className={hoveredNode.isPriority ? "text-rose-600" : "text-rose-400"}/>
                            <h3 className="font-bold text-slate-800 text-sm truncate">{hoveredNode.Company} <span className="text-slate-500 font-medium">{hoveredNode.Plant}</span></h3>
                        </div>
                        <div className="space-y-1.5 text-xs text-slate-600">
                            <div className="flex justify-between items-center"><span className="text-slate-400">隸屬聚落</span> <span className="font-bold text-slate-700">{hoveredNode.zone}</span></div>
                            <div className="flex justify-between items-center"><span className="text-slate-400">產業類別</span> <span>{hoveredNode.Industry}</span></div>
                            <div className="flex justify-between items-center"><span className="text-slate-400">管線狀態</span> <span className={`font-bold ${hoveredNode.distanceToHub < 0 ? 'text-slate-400' : 'text-emerald-600'}`}>{hoveredNode.distanceToHub < 0 ? '距離過遠，未納入管網' : `已連線 (總長 ${(Number(hoveredNode.distanceToHub)||0).toFixed(1)}km)`}</span></div>
                            
                            <div className="mt-2 bg-rose-50 p-2 rounded-lg border border-rose-100 flex flex-col gap-1">
                                <div className="flex justify-between items-center">
                                    <span className="text-rose-800 font-bold">總排放量 (範疇 1+2)</span>
                                    <span className="font-mono font-black text-rose-600 text-sm">{(Number(hoveredNode.TotalScope || 0) / 10000).toFixed(1)} <span className="text-[10px] font-normal">萬噸</span></span>
                                </div>
                                <div className="flex justify-between items-center text-xs mt-1 pt-1 border-t border-rose-200/50">
                                    <span className="text-rose-600 font-bold">範疇一 (可CCS捕捉)</span>
                                    <span className="font-mono text-rose-600 font-bold">{(Number(hoveredNode.Scope1 || 0) / 10000).toFixed(1)} 萬噸</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-500">範疇二 (間接)</span>
                                    <span className="font-mono text-slate-500">{(Number(hoveredNode.Scope2 || 0) / 10000).toFixed(1)} 萬噸</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-white/95 p-1.5 rounded-lg shadow-sm border border-slate-200 backdrop-blur">
                <button onClick={() => setZoom(prev => Math.min(prev * 1.3, 10))} className="p-2 bg-slate-50 hover:bg-slate-200 rounded-md text-slate-600 transition-colors" title="放大"><ZoomIn size={18}/></button>
                <button onClick={() => setZoom(prev => Math.max(prev / 1.3, 0.5))} className="p-2 bg-slate-50 hover:bg-slate-200 rounded-md text-slate-600 transition-colors" title="縮小"><ZoomOut size={18}/></button>
                <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-2 bg-slate-50 hover:bg-slate-200 rounded-md text-slate-600 transition-colors" title="重置畫面"><Maximize size={18}/></button>
                <div className="w-full h-px bg-slate-200 my-1"></div>
                <button onClick={exportMapAsImage} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md transition-colors" title="輸出圖片"><DownloadCloud size={18}/></button>
            </div>

            <svg viewBox={`0 0 ${baseWidth} ${baseHeight}`} className={`w-full h-full select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${dragState ? 'cursor-move' : ''}`} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseLeave} ref={mapRef}>
                <g transform={`translate(${baseWidth/2 + pan.x}, ${baseHeight/2 + pan.y}) scale(${zoom})`}>
                    
                    {mapPaths.map((p, i) => p.d && <path key={`map-${i}`} d={p.d} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={1.5 / zoom} />)}

                    {mode === 'planning' && ccsTopology && (
                        <>
                            {/* 0. 畫海運航線 (完美避開陸地，向外海大繞行) */}
                            {ccsTopology.seaRoutes.map((route, i) => {
                                const [x1, y1] = projectBase(route.from.lon, route.from.lat);
                                const [x2, y2] = projectBase(route.to.lon, route.to.lat);
                                const [cx1, cy1] = projectBase(route.c1.lon, route.c1.lat);
                                const [cx2, cy2] = projectBase(route.c2.lon, route.c2.lat);
                                if (x1 === -9999 || x2 === -9999 || cx1 === -9999) return null;
                                
                                const midX = 0.125*x1 + 0.375*cx1 + 0.375*cx2 + 0.125*x2;
                                const midY = 0.125*y1 + 0.375*cy1 + 0.375*cy2 + 0.125*y2;

                                return (
                                    <g key={`sea-route-${i}`}>
                                        <path d={`M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`} stroke="#0284c7" strokeWidth={Math.max(2, Math.log10(Math.max(10000, route.weight))/zoom)} strokeDasharray={`${6/zoom} ${6/zoom}`} fill="none" opacity={0.6}/>
                                        <text x={midX} y={midY} fontSize={11/zoom} fill="#0369a1" textAnchor="middle" fontWeight="bold" style={{textShadow: '0 0 3px white', pointerEvents: 'none'}}>
                                            {route.label}
                                        </text>
                                    </g>
                                );
                            })}

                            {/* 1. 畫管線拓樸 (支線：樹枝狀貝茲曲線) */}
                            {ccsTopology.branchRoutes.map((route, i) => {
                                const [x1, y1] = projectBase(route.from.lon, route.from.lat);
                                const [x2, y2] = projectBase(route.to.lon, route.to.lat);
                                if (x1 === -9999 || x2 === -9999) return null;
                                
                                const strokeColor = route.isPriority ? "#94a3b8" : "#cbd5e1";
                                const strokeW = (route.isPriority ? 1.5 : 1) / zoom;
                                const opac = route.isPriority ? 0.6 : 0.4;
                                const dash = route.isPriority ? "none" : `${3/zoom} ${3/zoom}`;
                                
                                return (
                                    <path key={`branch-${i}`} d={generateTreePath(x1, y1, x2, y2, true, route.inlandCurve)} stroke={strokeColor} strokeWidth={strokeW} strokeDasharray={dash} fill="none" opacity={opac} />
                                );
                            })}

                            {/* 2. 畫管線拓樸 (多節點主幹網路，超過60km標示紅字警告) */}
                            {ccsTopology.mainRoutes.map((route, i) => {
                                const [x1, y1] = projectBase(route.from.lon, route.from.lat);
                                const [x2, y2] = projectBase(route.to.lon, route.to.lat);
                                if (x1 === -9999 || x2 === -9999) return null;
                                
                                let pathD = '';
                                let midX = (x1 + x2) / 2;
                                let midY = (y1 + y2) / 2;

                                if (route.customCurve) {
                                    const [cx, cy] = projectBase(route.customCurve.lon, route.customCurve.lat);
                                    pathD = `M ${x1} ${y1} Q ${cx} ${cy}, ${x2} ${y2}`;
                                    midX = 0.25*x1 + 0.5*cx + 0.25*x2;
                                    midY = 0.25*y1 + 0.5*cy + 0.25*y2;
                                } else {
                                    pathD = generateTreePath(x1, y1, x2, y2, false, route.inlandCurve);
                                    if (route.inlandCurve) midX += 30/zoom; 
                                }
                                
                                const strokeColor = route.isUnrealistic ? "#f97316" : "#3b82f6";
                                const textColor = route.isUnrealistic ? "#c2410c" : "#1e40af";

                                return (
                                    <g key={`main-route-${i}`}>
                                        <path d={pathD} stroke={strokeColor} strokeWidth={Math.max(2, Math.log10(Math.max(10000, route.weight)))/zoom} strokeDasharray={`${6/zoom} ${4/zoom}`} fill="none" opacity={route.isUnrealistic ? 0.7 : 0.85}/>
                                        <circle cx={x1} cy={y1} r={4/zoom} fill={strokeColor}/>
                                        <text x={midX} y={midY - (4/zoom)} fontSize={10/zoom} fill={textColor} textAnchor="middle" fontWeight="bold" style={{textShadow: '0 0 3px white', pointerEvents: 'none'}}>
                                            {Number(route.distance||0).toFixed(0)} km
                                        </text>
                                    </g>
                                );
                            })}
                            
                            {/* 3. 畫各縣市中繼聚落 (Junction Nodes) */}
                            {ccsTopology.activeClusterNodes.map((cluster, i) => {
                                const [cx, cy] = projectBase(cluster.lon, cluster.lat);
                                if (cx === -9999) return null;
                                return (
                                    <circle key={`cluster-${i}`} cx={cx} cy={cy} r={3/zoom} fill="#64748b" stroke="white" strokeWidth={1/zoom} style={{ pointerEvents: 'none' }}/>
                                );
                            })}

                            {/* 4. 畫樞紐接收站 (可拖曳) */}
                            {hubs && Object.values(hubs).map((hub, i) => {
                                const [cx, cy] = projectBase(hub.lon, hub.lat);
                                if (cx === -9999) return null;
                                const isLandHub = hub.id === 'CENTRAL_HUB_LAND';
                                const isDragged = dragState && dragState.id === hub.id;
                                
                                return (
                                    <g 
                                        key={`hub-${i}`} 
                                        className={isDragged ? "cursor-grabbing" : "cursor-grab hover:scale-110 transition-transform"} 
                                        onMouseEnter={() => setHoveredNode({...hub, type: 'hub', hubType: hub.type})} 
                                        onMouseLeave={() => setHoveredNode(null)}
                                        onMouseDown={(e) => handleHubMouseDown(e, hub.id)}
                                    >
                                        <rect x={cx - 10/zoom} y={cy - 10/zoom} width={20/zoom} height={20/zoom} fill={isLandHub ? "#b45309" : "#0ea5e9"} stroke={isDragged ? "#fbbf24" : "white"} strokeWidth={isDragged ? 3/zoom : 2/zoom} style={{ filter: 'drop-shadow(0px 3px 4px rgba(0,0,0,0.4))' }} />
                                        <text x={cx + 14/zoom} y={cy + 4/zoom} fontSize={12/textScale} fill={isLandHub ? "#78350f" : "#0369a1"} fontWeight="900" paintOrder="stroke" stroke="white" strokeWidth={3/textScale} className="pointer-events-none">{hub.name}</text>
                                    </g>
                                );
                            })}

                            {/* 5. 畫排放源頭 (區分優先級別，未連線的以低透明度顯示) */}
                            {ccsTopology.validSources.map((d, i) => {
                                const [cx, cy] = projectBase(d.lon, d.lat);
                                if (cx === -9999) return null;
                                const r = Math.max(d.isPriority ? 4 : 2, Math.min(d.isPriority ? 20 : 10, Math.sqrt(Math.max(0, d.Scope1 || 0) / 50000))) / zoom;
                                const isHovered = hoveredNode === d;
                                const isConnected = d.distanceToHub >= 0;
                                const fillCol = d.isPriority ? "#e11d48" : "#fb7185";
                                const opac = isHovered ? 1 : (isConnected ? (d.isPriority ? 0.85 : 0.6) : 0.2);
                                return (
                                    <g key={`s1-${i}`} className="cursor-pointer transition-all" onMouseEnter={() => setHoveredNode({...d, type: 'source'})} onMouseLeave={() => setHoveredNode(null)}>
                                        <circle cx={cx} cy={cy} r={Math.max(r, 15/zoom)} fill="transparent" />
                                        <circle cx={cx} cy={cy} r={r} fill={fillCol} fillOpacity={opac} stroke="white" strokeWidth={(d.isPriority ? 1.5 : 1) / zoom} style={d.isPriority && isConnected ? { filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.3))' } : {}} />
                                    </g>
                                );
                            })}
                        </>
                    )}
                </g>
            </svg>
            
            <div className="absolute bottom-4 left-4 bg-white/95 p-3 rounded-lg shadow-sm border border-slate-200 text-xs text-slate-700 pointer-events-none backdrop-blur">
                {mode === 'planning' && (
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-sky-500 border border-white"></div> 海洋接收站 / 本土封存樞紐</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-600 border border-white"></div> 陸地封存場域</div>
                        <div className="flex items-center gap-2 mt-2 pt-1 border-t border-slate-200"><div className="w-3 h-3 rounded-full bg-rose-600 border border-white shadow"></div> 優先碳源 (&ge; 2.5萬噸)</div>
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-400 opacity-60"></div> 次要碳源 (&lt; 2.5萬噸)</div>
                        <div className="flex items-center gap-2 mt-2 pt-1 border-t border-slate-200"><div className="w-6 h-0 border-t-2 border-blue-500 border-dashed"></div> 擬真 GoogleMap 節點主幹管線</div>
                        <div className="flex items-center gap-2"><div className="w-6 h-0 border-t-2 border-orange-500 border-dashed opacity-80"></div> 超過 60km (主幹可行性極低)</div>
                        <div className="flex items-center gap-2">
                            <svg width="24" height="6" className="overflow-visible"><path d="M 0 3 Q 12 3, 24 -3" stroke="#94a3b8" strokeWidth="2" fill="none"/></svg> 有效廠區支線 (優先&le;60km,次要&le;20km)
                        </div>
                        <div className="flex items-center gap-2"><div className="w-6 h-0 border-t-2 border-sky-500 border-dashed opacity-60"></div> 樞紐海運外繞航線</div>
                    </div>
                )}
            </div>
        </div>
    );
};

const CcusDashboard = () => {
    const [activeTab, setActiveTab] = useState('planning'); 
    const [captureData, setCaptureData] = useState([]);
    const [utilizationData, setUtilizationData] = useState([]);
    const [storageData, setStorageData] = useState([]);
    const [scope1Data, setScope1Data] = useState([]); 
    const [mapPaths, setMapPaths] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState('ALL');
    const [transportMode, setTransportMode] = useState('ALL'); 

    // 將 Hub 狀態拉至頂層，供地圖拖曳與下拉選單共同使用
    const [hubs, setHubs] = useState(INITIAL_CCS_HUBS);

    const [listRegion, setListRegion] = useState('ALL');
    const [listIndustry, setListIndustry] = useState('ALL');

    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);
            try {
                const [resCap, resUtil, resStore, resScope1, resGeo] = await Promise.all([
                    fetch(CCUS_DATA_SOURCES.CAPTURE),
                    fetch(CCUS_DATA_SOURCES.UTILIZATION),
                    fetch(CCUS_DATA_SOURCES.STORAGE),
                    fetch(CCUS_DATA_SOURCES.SCOPE1_URL).catch(() => null),
                    fetch('https://raw.githubusercontent.com/g0v/twgeojson/master/json/twCounty2010.geo.json').catch(() => null)
                ]);

                const txtCap = await resCap.text();
                const txtUtil = await resUtil.text();
                const txtStore = await resStore.text();
                const txtScope1 = resScope1 ? await resScope1.text() : '';

                if (resGeo) {
                    const geoData = await resGeo.json();
                    const paths = geoData.features.map(f => {
                        let d = '';
                        const pr = (ring) => { 
                            if(!ring || ring.length === 0) return; 
                            const [x,y] = projectBase(ring[0][0], ring[0][1]); 
                            if (x === -9999) return; 
                            d += `M${x},${y} `; 
                            for(let i=1; i<ring.length; i++){
                                const [lx,ly] = projectBase(ring[i][0], ring[i][1]); 
                                if(lx !== -9999) d += `L${lx},${ly} `;
                            } 
                            d += 'Z '; 
                        };
                        if(f.geometry.type === 'Polygon') f.geometry.coordinates.forEach(pr); 
                        else if(f.geometry.type === 'MultiPolygon') f.geometry.coordinates.forEach(p => p.forEach(pr));
                        return { d };
                    });
                    setMapPaths(paths);
                }

                const rawCap = parseCSV(txtCap);
                const rawUtil = parseCSV(txtUtil);
                const rawStore = parseCSV(txtStore);
                const rawScope1 = parseCSV(txtScope1);

                setScope1Data(rawScope1.map(d => {
                    const keys = Object.keys(d);
                    const nameKey = keys.find(k => k.includes('事業名稱') || k.includes('公司名稱') || k.includes('廠區')) || '事業名稱';
                    const emit1Key = keys.find(k => k.includes('直接排放') || k.includes('範疇一') || k.includes('Scope 1') || k === '直接排放量(公噸CO2e)') || '直接排放量(公噸CO2e)';
                    const emit2Key = keys.find(k => k.includes('間接排放') || k.includes('範疇二') || k.includes('Scope 2') || k === '能源間接排放量(公噸CO2e)') || '能源間接排放量(公噸CO2e)';
                    const emitTotalKey = keys.find(k => k.includes('合計排放') || k.includes('總排') || k === '合計排放量(公噸CO2e)') || '合計排放量(公噸CO2e)';
                    
                    const indKey = keys.find(k => k.includes('七大製造業') || k.includes('行業分類')) || '行業分類';
                    const countyKey = keys.find(k => k.includes('縣市別') || k.includes('地址') || k.includes('所在')) || '縣市別';

                    const rawName = String(d[nameKey] || '').trim();
                    if (!rawName) return null;

                    const comp = simplifyCompanyName(rawName);
                    const plantRaw = rawName.replace(d['公司'] || '', '').replace(comp, '').replace(/股份有限公司|工業|企業|分公司/g, '').trim(); 
                    
                    let countyStr = String(d[countyKey] || '').trim();
                    const countyMatch = countyStr.match(/(基隆|台北|臺北|新北|桃園|新竹|苗栗|台中|臺中|彰化|南投|雲林|嘉義|台南|臺南|高雄|屏東|宜蘭|花蓮|台東|臺東)/);
                    if (countyMatch) {
                        countyStr = countyMatch[0].replace('臺', '台');
                    } else {
                        countyStr = '未知';
                    }

                    const coords = getApproximateCoordinates(plantRaw, comp, countyStr);
                    const zone = getIndustrialZone(plantRaw, comp, countyStr);
                    const region = getRefinedRegion(plantRaw, comp, countyStr);

                    const scope1Val = cleanNumber(d[emit1Key]);
                    const scope2Val = cleanNumber(d[emit2Key]);
                    const totalVal = cleanNumber(d[emitTotalKey]) || (scope1Val + scope2Val);

                    return {
                        Company: comp,
                        Plant: rawName,
                        Scope1: scope1Val,
                        Scope2: scope2Val,
                        TotalScope: totalVal,
                        Industry: d[indKey] || '',
                        County: countyStr,
                        zone: zone,
                        Region: region,
                        lat: coords.lat,
                        lon: coords.lon
                    };
                }).filter(d => {
                    if (!d || d.TotalScope <= 0) return false;
                    const scope2Ratio = d.Scope2 / d.TotalScope;
                    if (scope2Ratio > 0.7) return false; 
                    // 全數保留，交由演算法依 2.5萬噸 判定 isPriority 並給予不同管線距離上限
                    return true; 
                }).sort((a,b) => b.Scope1 - a.Scope1)); 

                setCaptureData(rawCap.map(d => {
                    const capVol = cleanNumber(d.Capture_Volume);
                    const capEng = cleanNumber(d.Captur_energy || d.Emission_Per_Ton); 
                    return {
                        ...d,
                        Year: String(d.Year || '2025'),
                        Label: `${simplifyCompanyName(d.Company)} ${d.Plant}`,
                        Latitude: cleanNumber(d.Latitude),
                        Longitude: cleanNumber(d.Longitude),
                        Capture_Tech: d.Capture_Tech || '未知技術',
                        Capture_Volume: capVol,
                        Captur_energy: capEng,
                        Net_Capture_Volume: cleanNumber(d.Net_Capture_Volume) || Math.max(0, capVol - capEng)
                    };
                }));

                setUtilizationData(rawUtil.map(d => {
                    const expDemand = cleanNumber(d.Expected_Demand);
                    return {
                        ...d,
                        Year: String(d.Year || '2025'),
                        Expected_Demand: expDemand,
                        Current_Demand: cleanNumber(d.Current_Demand),
                        Product_Generated: expDemand * (String(d.Conversion_Tech).includes('甲醇') ? 0.7 : 1.5)
                    };
                }));

                setStorageData(rawStore.map(d => {
                    let mode = String(d.Transport_Method || '');
                    let dist = cleanNumber(d.Distance_km) || (mode.includes('海') ? 150 : 30); 
                    return {
                        ...d,
                        Year: String(d.Year || '2025'),
                        Capturable_Volume: cleanNumber(d.Capturable_Volume),
                        Distance_km: dist,
                        Cost_USD_Per_Ton: cleanNumber(d.Cost_USD_Per_Ton),
                        Transport_Method: mode
                    };
                }));

            } catch (err) { console.error(err); } finally { setLoading(false); }
        };
        fetchAllData();
    }, []);

    const availableYears = useMemo(() => Array.from(new Set([...captureData.map(d=>d.Year), ...utilizationData.map(d=>d.Year), ...storageData.map(d=>d.Year)])).filter(Boolean).sort(), [captureData, utilizationData, storageData]);
    
    const fCapture = useMemo(() => captureData.filter(d => selectedYear === 'ALL' || d.Year === selectedYear), [captureData, selectedYear]);
    const fUtil = useMemo(() => utilizationData.filter(d => selectedYear === 'ALL' || d.Year === selectedYear), [utilizationData, selectedYear]);
    const fStorage = useMemo(() => storageData.filter(d => selectedYear === 'ALL' || d.Year === selectedYear), [storageData, selectedYear]);

    // 拓樸演算法重構：多層級中繼節點網路 (Hierarchical Routing)
    const ccsTopology = useMemo(() => {
        if (!scope1Data || scope1Data.length === 0) return null;

        // 預先定義各大縣市的實體聚落中心點與預設的下層節點 (樹狀結構)
        const PREDEFINED_CLUSTERS = {
            'C_KEE_PORT': { name: '基隆港轉運站', lat: 25.15, lon: 121.74, next: 'NORTH_HUB', type: 'sea' },
            'C_TPE': { name: '北北基聚落', lat: 25.05, lon: 121.45, next: 'NORTH_HUB', type: 'land' },
            'C_TYN_IN': { name: '桃園內陸聚落', lat: 24.95, lon: 121.25, next: 'C_TYN_COAST', type: 'land' },
            'C_TYN_COAST': { name: '桃園沿海聚落', lat: 25.05, lon: 121.10, next: 'NORTH_HUB', type: 'land' },
            'C_HSZ': { name: '新竹聚落', lat: 24.80, lon: 121.00, next: 'C_TYN_IN', type: 'land' },
            
            'C_MIA': { name: '苗栗聚落', lat: 24.55, lon: 120.80, next: 'CENTRAL_HUB_LAND', type: 'land' },
            'C_TXG': { name: '台中聚落', lat: 24.20, lon: 120.60, next: 'CENTRAL_HUB_1', type: 'land' },
            'C_CHW_N': { name: '彰北聚落', lat: 24.10, lon: 120.45, next: 'CENTRAL_HUB_1', type: 'land' },
            'C_CHW_S': { name: '彰南聚落', lat: 23.95, lon: 120.35, next: 'CENTRAL_HUB_2', type: 'land' }, 
            'C_YUN_IN': { name: '雲林內陸聚落', lat: 23.75, lon: 120.45, next: 'CENTRAL_HUB_2', type: 'land' },
            'C_CYI': { name: '嘉義聚落', lat: 23.45, lon: 120.30, next: 'C_YUN_IN', type: 'land' },

            'C_TNN': { name: '台南聚落', lat: 23.10, lon: 120.25, next: 'C_KHH_N', type: 'land' },
            'C_KHH_IN': { name: '高雄內陸(大樹等)', lat: 22.70, lon: 120.40, next: 'C_KHH_N', type: 'land' },
            'C_KHH_N': { name: '北高雄(仁武大社)', lat: 22.72, lon: 120.35, next: 'SOUTH_HUB', type: 'land' },
            'C_KHH_S': { name: '南高雄(林園小港)', lat: 22.53, lon: 120.38, next: 'SOUTH_HUB', type: 'land' },
            'C_PTG': { name: '屏東聚落', lat: 22.50, lon: 120.45, next: 'C_KHH_S', type: 'land' },

            'C_YIL': { name: '宜蘭聚落', lat: 24.70, lon: 121.75, next: 'NORTH_HUB', type: 'sea' }, 
            'C_HUA': { name: '花蓮聚落', lat: 23.98, lon: 121.60, next: 'C_KEE_PORT', type: 'sea' }, 
            'C_TTT': { name: '台東聚落', lat: 22.75, lon: 121.14, next: 'SOUTH_HUB', type: 'sea' } 
        };

        const countyMap = {
            '基隆': 'C_TPE', '台北': 'C_TPE', '臺北': 'C_TPE', '新北': 'C_TPE', 
            '桃園': 'C_TYN_COAST', '新竹': 'C_HSZ', '苗栗': 'C_MIA', 
            '台中': 'C_TXG', '臺中': 'C_TXG', '南投': 'C_TXG', 
            '雲林': 'C_YUN_IN', '嘉義': 'C_CYI', 
            '台南': 'C_TNN', '臺南': 'C_TNN', '高雄': 'C_KHH_N', 
            '屏東': 'C_PTG', 
            '宜蘭': 'C_YIL', '花蓮': 'C_HUA', '台東': 'C_TTT', '臺東': 'C_TTT' 
        };

        const activeClusters = JSON.parse(JSON.stringify(PREDEFINED_CLUSTERS));
        Object.keys(activeClusters).forEach(k => {
            activeClusters[k].id = k;
            activeClusters[k].emissions = 0;
            activeClusters[k].sources = [];
        });

        const hubSources = {}; 
        Object.keys(hubs).forEach(k => hubSources[k] = []);
        const validSources = []; 
        const branchRoutes = [];
        const hubEmissions = { NORTH_HUB: 0, CENTRAL_HUB_1: 0, CENTRAL_HUB_2: 0, CENTRAL_HUB_LAND: 0, SOUTH_HUB: 0, EAST_HUB: 0, SOUTHEAST_HUB: 0 };

        // 1. 第一階段：過濾與中心點距離限制內的廠區 (2.5萬噸 = 60km, 其餘 20km)
        scope1Data.forEach(d => {
            d.isPriority = d.Scope1 >= 25000;

            let cId = countyMap[d.County];
            if (!cId) return; 

            // 細分區域邏輯
            if (d.County.includes('桃園')) {
                cId = d.lon < 121.15 ? 'C_TYN_COAST' : 'C_TYN_IN';
            } else if (d.County.includes('高雄')) {
                if (d.lon > 120.38) cId = 'C_KHH_IN';
                else cId = d.lat < 22.6 ? 'C_KHH_S' : 'C_KHH_N';
            } else if (d.County.includes('彰化')) {
                const dist1 = calcDistanceKm(d.lat, d.lon, hubs['CENTRAL_HUB_1'].lat, hubs['CENTRAL_HUB_1'].lon);
                const dist2 = calcDistanceKm(d.lat, d.lon, hubs['CENTRAL_HUB_2'].lat, hubs['CENTRAL_HUB_2'].lon);
                cId = dist1 < dist2 ? 'C_CHW_N' : 'C_CHW_S';
            }

            const cluster = activeClusters[cId];
            const distToCenter = calcDistanceKm(d.lat, d.lon, cluster.lat, cluster.lon);
            const maxDist = d.isPriority ? 60 : 20;

            if (distToCenter <= maxDist) {
                cluster.emissions += d.Scope1;
                cluster.sources.push({...d, distToCenter}); 
                validSources.push({...d, distToCenter, initialClusterId: cId}); 
                
                if (distToCenter > 0.002) {
                    branchRoutes.push({
                        from: d, to: cluster, isPriority: d.isPriority, 
                        inlandCurve: d.lon < 121.5 // 西海岸往內陸微彎
                    });
                }
            } else {
                validSources.push({...d, distanceToHub: -1}); // 放棄連線，但保留在地圖上
            }
        });

        // 計算聚落到樞紐的預估距離 (多層級累加)
        const getClusterDistToHub = (clusterId) => {
            let dist = 0; let curr = clusterId;
            while(curr && activeClusters[curr]) {
                let next = activeClusters[curr].next;
                if (!next) break;
                let fromNode = activeClusters[curr];
                let toNode = activeClusters[next] || hubs[next];
                dist += estimateRoutingDistance(fromNode.lat, fromNode.lon, toNode.lat, toNode.lon, fromNode.type === 'sea');
                curr = next;
            }
            return dist;
        };

        // 2. 第二階段：建立多節點有向邊網路，並計算每段管線的承載量
        const edges = {}; // key: "fromId_toId"
        const addEdge = (fromNode, toNode, flow, type) => {
            const key = `${fromNode.id}_${toNode.id}`;
            if (!edges[key]) edges[key] = { from: fromNode, to: toNode, flow: 0, type };
            edges[key].flow += flow;
        };

        Object.values(activeClusters).forEach(cluster => {
            if (cluster.emissions <= 0) return;
            
            let flow = cluster.emissions;
            let curr = cluster;
            
            while(curr && curr.next) {
                let nextNode = activeClusters[curr.next] || hubs[curr.next];
                if (!nextNode) break;

                addEdge(curr, nextNode, flow, curr.type);
                
                if (hubs[nextNode.id]) {
                    hubEmissions[nextNode.id] += flow;
                    // 將源頭歸戶並寫入最終距離
                    cluster.sources.forEach(src => {
                        hubSources[nextNode.id].push({
                            ...src,
                            distanceToHub: src.distToCenter + getClusterDistToHub(cluster.id)
                        });
                    });
                    break;
                }
                curr = activeClusters[nextNode.id];
            }
        });

        const mainRoutes = [];
        const seaRoutes = [];

        Object.values(edges).forEach(edge => {
            if (edge.flow <= 0) return;
            const dist = estimateRoutingDistance(edge.from.lat, edge.from.lon, edge.to.lat, edge.to.lon, edge.type === 'sea');
            
            if (edge.type === 'sea') {
                // 特製海運控制點避障
                let c1 = edge.from, c2 = edge.to;
                if (edge.from.id === 'C_HUA' && edge.to.id === 'C_KEE_PORT') { c1 = {lat: 24.3, lon: 122.2}; c2 = {lat: 24.8, lon: 122.1}; }
                if (edge.from.id === 'C_KEE_PORT' && edge.to.id === 'NORTH_HUB') { c1 = {lat: 25.4, lon: 121.7}; c2 = {lat: 25.4, lon: 121.4}; }
                if (edge.from.id === 'C_YIL' && edge.to.id === 'NORTH_HUB') { c1 = {lat: 25.2, lon: 122.1}; c2 = {lat: 25.4, lon: 121.8}; }
                if (edge.from.id === 'C_TTT' && edge.to.id === 'SOUTH_HUB') { c1 = {lat: 21.8, lon: 121.2}; c2 = {lat: 21.8, lon: 120.5}; }
                
                seaRoutes.push({ ...edge, distance: dist, label: `海運 (${dist.toFixed(0)}km)`, c1, c2 });
            } else {
                mainRoutes.push({ 
                    ...edge, distance: dist, 
                    isUnrealistic: dist > 60, // 主幹單段 > 60km 極低可行性
                    inlandCurve: edge.from.lat > 23.5 && edge.from.lon < 121.5 
                });
            }
        });

        const activeClusterNodes = Object.values(activeClusters).filter(c => c.emissions > 0);

        return { mainRoutes, branchRoutes, seaRoutes, activeClusterNodes, hubSources, hubEmissions, validSources };
    }, [scope1Data, hubs]);

    const scope1Stats = useMemo(() => {
        let totalS1 = 0, totalS2 = 0, total = 0;
        const zones = {};
        
        scope1Data.forEach(d => {
            totalS1 += d.Scope1;
            totalS2 += d.Scope2;
            total += d.TotalScope;
            
            if(!zones[d.zone]) zones[d.zone] = { name: d.zone, Scope1: 0, Scope2: 0, Total: 0, region: d.Region };
            zones[d.zone].Scope1 += d.Scope1;
            zones[d.zone].Scope2 += d.Scope2;
            zones[d.zone].Total += d.TotalScope;
        });

        return {
            total, totalS1, totalS2,
            topZones: Object.values(zones).sort((a,b)=>b.Total - a.Total)
        };
    }, [scope1Data]);

    const regionalIndustryStats = useMemo(() => {
        const industryMap = {};
        const dataToUse = ccsTopology ? ccsTopology.validSources : scope1Data;
        
        dataToUse.forEach(d => {
            if (listRegion !== 'ALL' && d.Region !== listRegion) return;
            const ind = d.Industry || '其他產業';
            if(!industryMap[ind]) industryMap[ind] = 0;
            industryMap[ind] += d.Scope1;
        });
        
        return Object.keys(industryMap)
            .map(k => ({ name: k, value: industryMap[k] }))
            .sort((a,b) => b.value - a.value);
    }, [ccsTopology, scope1Data, listRegion]);

    const { totalCapture, totalFuturePotential, totalExpectedDemand, avgCost } = useMemo(() => {
        const tCap = fCapture.reduce((sum, row) => sum + row.Net_Capture_Volume, 0);
        const tFuture = fCapture.reduce((sum, row) => sum + row.Future_Emission_Volume, 0);
        const tDemand = fUtil.reduce((sum, row) => sum + row.Expected_Demand, 0);
        let costSum = 0, volSum = 0;
        fStorage.filter(row => transportMode === 'ALL' || row.Transport_Method.includes(transportMode)).forEach(row => {
            if (row.Cost_USD_Per_Ton > 0 && row.Capturable_Volume > 0) { costSum += row.Cost_USD_Per_Ton * row.Capturable_Volume; volSum += row.Capturable_Volume; }
        });
        return { totalCapture: tCap, totalFuturePotential: tFuture, totalExpectedDemand: tDemand, avgCost: volSum > 0 ? (costSum / volSum) : 0 };
    }, [fCapture, fUtil, fStorage, transportMode]);

    const availableIndustries = useMemo(() => ['ALL', ...Array.from(new Set(scope1Data.map(d => d.Industry))).filter(Boolean)], [scope1Data]);
    const filteredScope1Data = useMemo(() => {
        return scope1Data.filter(d => 
            (listRegion === 'ALL' || d.Region === listRegion) &&
            (listIndustry === 'ALL' || d.Industry === listIndustry)
        );
    }, [scope1Data, listRegion, listIndustry]);

    const [listMode, setListMode] = useState('all'); 
    const [selectedHubId, setSelectedHubId] = useState('NORTH_HUB');
    
    const selectedHubSources = useMemo(() => {
        if (!ccsTopology || !ccsTopology.hubSources[selectedHubId]) return [];
        return [...ccsTopology.hubSources[selectedHubId]].sort((a,b) => b.Scope1 - a.Scope1);
    }, [ccsTopology, selectedHubId]);

    const selectedHubTotalEmissions = useMemo(() => {
        if (!ccsTopology || !ccsTopology.hubEmissions[selectedHubId]) return 0;
        return ccsTopology.hubEmissions[selectedHubId];
    }, [ccsTopology, selectedHubId]);

    if (loading) return <div className="p-10 text-center animate-pulse text-teal-600 flex flex-col items-center"><RefreshCw className="animate-spin mb-2"/> CCUS 地理資料建構中...</div>;

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
                    <button onClick={() => setActiveTab('capture')} className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${activeTab === 'capture' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}><Activity size={16}/> 碳捕捉 (Capture)</button>
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
                            <div><p className="text-xs text-slate-500 font-bold mb-1 uppercase">自動推演管線距離評估</p><h3 className="text-2xl font-black text-sky-700">啟用 <span className="text-sm font-medium text-slate-500">智能距離棄保限制</span></h3></div>
                            <div className="w-12 h-12 rounded-full bg-sky-50 flex items-center justify-center text-sky-600"><Route size={24}/></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                        <div className="lg:col-span-7 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[750px]">
                            <h3 className="font-bold text-slate-700 text-sm mb-4 border-b pb-2 flex items-center gap-2"><Map size={16} className="text-indigo-500"/> CCS 案場與共通管線拓樸分析</h3>
                            <div className="flex-1 w-full h-full relative min-h-0">
                                <ErrorBoundary>
                                    <TaiwanCcusMap mode="planning" scope1Data={scope1Data} mapPaths={mapPaths} ccsTopology={ccsTopology} hubs={hubs} setHubs={setHubs} />
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
                                        <div className="text-xs text-slate-600 leading-relaxed">排放源相對分散。新竹先往北牽至桃園內陸，再與桃園沿海會合，集中至林口沿岸，轉由海管輸送至林口外海封存。大於60km之主幹管線(橘色虛線)可行性極低。</div>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded border border-slate-200">
                                        <div className="text-xs font-bold text-slate-500 mb-1">【東區】花蓮港接收 ➔ 海運北送封存</div>
                                        <div className="text-xs text-slate-600 leading-relaxed">花蓮地區主要排放源集中，建議於花蓮港建置 CO₂ 接收轉運站，透過海運(避開東北角陸地)與基隆會合，將捕捉之碳排送往北部的林口封存樞紐。</div>
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
                                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><Anchor size={16} className="text-blue-500"/> 封存點位可能碳源分析</h3>
                                <select value={selectedHubId} onChange={e => setSelectedHubId(e.target.value)} className="bg-slate-50 border border-slate-200 text-slate-700 font-bold px-3 py-1 rounded-lg outline-none cursor-pointer hover:bg-slate-100 text-xs">
                                    {Object.values(hubs).map(hub => (<option key={hub.id} value={hub.id}>{hub.name}</option>))}
                                </select>
                            </div>
                            
                            <div className="flex justify-between items-center bg-blue-50 p-3 rounded-lg border border-blue-100 mb-3">
                                <div>
                                    <div className="text-[10px] text-blue-600 font-bold uppercase mb-0.5">涵蓋有效排放點數量</div>
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
                                                <td className={`p-3 text-right font-mono ${row.distanceToHub > 60 ? 'text-orange-500 font-bold' : 'text-slate-500'}`}>{Number(row.distanceToHub||0).toFixed(1)}</td>
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
                                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><List size={16} className="text-rose-500"/> 排放點源總表</h3>
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
                                                    {row.isPriority && <span className="mr-1 text-[10px] text-rose-500 font-black" title="優先碳源">●</span>}
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

            {/* 原有 Capture Tab 略 */}
        </div>
    );
};

export default CcusDashboard;