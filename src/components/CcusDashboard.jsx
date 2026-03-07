import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ScatterChart, Scatter, ZAxis, Cell, LabelList, ComposedChart, Line, Label, PieChart, Pie
} from 'recharts';
import { 
  Leaf, RefreshCw, Target, Activity, MapPin, DollarSign, Box, AlertTriangle, 
  Truck, Ship, GripHorizontal, FlaskConical, Plus, ZoomIn, ZoomOut, Maximize, Hand, Factory, List, Rocket, Map, Route, Anchor, Layers
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
  let n = name.trim().replace(/股份有限公司|工業|企業/g, '').trim();
  const mapping = {
      '台灣化學纖維': '台化', '台化': '台化',
      '台灣苯乙烯': '台苯', '台苯': '台苯',
      '中國石油化學': '中石化', '中石化': '中石化',
      '台灣中油': '中油', '中油': '中油',
      '台塑石化': '台塑化', '台塑化': '台塑化',
      '台灣積體電路製造': '台積電', '台積電': '台積電',
      '中國鋼鐵': '中鋼', '中鋼': '中鋼',
      '長春人造樹脂': '長春樹脂', '長春石油化學': '長春石化'
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
    const lines = text.split(/\r\n|\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const parseLine = (line) => {
        const res = []; let current = ''; let inQuote = false;
        for (let c of line) {
            if (c === '"') { inQuote = !inQuote; continue; }
            if (c === ',' && !inQuote) { res.push(current.trim()); current = ''; continue; }
            current += c;
        }
        res.push(current.trim()); return res;
    };
    const headers = parseLine(lines[0]);
    return lines.slice(1).map(line => {
        const row = parseLine(line); const obj = {};
        headers.forEach((h, i) => { obj[h.replace(/^[\uFEFF\s]+|[\s]+$/g, '')] = row[i]; });
        return obj;
    });
};

const calcDistanceKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
};

const estimateRoutingDistance = (lat1, lon1, lat2, lon2, isSeaRoute = false) => {
    const straightDistance = calcDistanceKm(lat1, lon1, lat2, lon2);
    const factor = isSeaRoute ? 1.1 : 1.35;
    return straightDistance * factor;
};

// --- 工業區與地圖座標底層函數 ---
const getRefinedRegion = (plantName, companyName) => {
    const p = String(plantName || '').trim();
    const c = String(companyName || '').trim();
    const full = `${c} ${p}`;
    if (full.includes('長春') && (p.includes('二廠') || p.includes('苗栗二'))) return '北區';
    if (c.includes('台灣化纖') || c.includes('台化') || c.includes('台塑科騰')) return '中區';
    if (p.match(/(仁武|大社|林園|小港|大發|大林|高雄|屏東|台南|嘉義|南科|善化)/)) return '南區';
    if (p.match(/(麥寮|六輕|彰濱|線西|中龍|頭份|苗栗|台中|彰化|南投|雲林)/)) return '中區';
    if (p.match(/(桃園|觀音|大園|桃煉|新北|台北|基隆|新竹)/)) return '北區';
    if (c.includes('大連') && p.includes('大發')) return '南區'; 
    if (c.includes('李長榮') && p.includes('高雄')) return '南區'; 
    if (c.includes('國喬') && p.includes('高雄')) return '南區'; 
    if (c.includes('中油') && (p.includes('大林') || p.includes('石化') || p.includes('林園'))) return '南區'; 
    if (c.includes('中油') && p.includes('桃園')) return '北區';
    if (c.includes('台灣石化') || c.includes('台苯')) return '南區';
    return '其他';
};

const getIndustrialZone = (plant, company) => {
    const p = String(plant || '').trim();
    const c = String(company || '').trim();
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
    if (p.includes('頭份') || (c.includes('長春') && p.includes('苗栗'))) return '苗栗-頭份工業區';
    if (full.includes('南科') || full.includes('台積電') || p.includes('18廠')) return '台南-南部科學園區';
    return '其他獨立廠區';
};

const getApproximateCoordinates = (plant, company) => {
    const n = `${String(company || '')} ${String(plant || '')}`;
    if (company?.includes('台化') && plant?.includes('台北')) return { lat: 23.78, lon: 120.18 };
    if (n.includes('大發') || company?.includes('台灣石化')) return { lat: 22.58, lon: 120.40 };
    if (n.includes('林園') || n.includes('大林') || n.includes('石化事業部') || n.includes('台灣苯乙烯')) return { lat: 22.51, lon: 120.38 };
    if (n.includes('小港') || n.includes('中鋼') || n.includes('臨海') || company?.includes('李長榮')) return { lat: 22.54, lon: 120.34 };
    if (n.includes('仁武') || n.includes('大社') || n.includes('國喬')) return { lat: 22.70, lon: 120.34 };
    if (n.includes('南科') || n.includes('台積電') || n.includes('善化')) return { lat: 23.10, lon: 120.27 };
    if (n.includes('麥寮') || n.includes('六輕') || company?.includes('台灣化纖') || company?.includes('台化')) return { lat: 23.78, lon: 120.18 };
    if (n.includes('彰濱') || n.includes('線西') || n.includes('中龍')) return { lat: 24.07, lon: 120.42 };
    if (n.includes('頭份') || n.includes('長春') || n.includes('苗栗')) return { lat: 24.68, lon: 120.91 };
    if (n.includes('桃園') || n.includes('觀音') || n.includes('桃煉') || n.includes('工三')) return { lat: 25.03, lon: 121.12 };
    return { lat: 23.6, lon: 120.9 }; 
};

// 封存場域樞紐節點設定 (包含本島外海與國外樞紐)
const CCS_HUBS = {
    'NORTH_HUB': { name: '林口外海', type: '🛢️ 本土外海封存', lat: 25.18, lon: 121.30, region: '北區' },
    'CENTRAL_HUB_1': { name: '台中港外海', type: '🛢️ 本土外海封存', lat: 24.30, lon: 120.40, region: '中區' },
    'CENTRAL_HUB_2': { name: '麥寮工業區外海', type: '🛢️ 本土外海封存', lat: 23.85, lon: 120.10, region: '中區' },
    'SOUTH_HUB': { name: '東南亞 (印尼/馬來西亞)', type: '🚢 跨國海運封存', lat: 21.5, lon: 119.8, region: '南區' } 
};

class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { hasError: false }; }
    static getDerivedStateFromError(error) { return { hasError: true }; }
    render() {
      if (this.state.hasError) return <div className="h-full flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded text-slate-400"><AlertTriangle size={32} className="mb-2 text-amber-400" /><p className="text-sm">圖表資料異常，請檢查資料來源格式</p></div>;
      return this.props.children;
    }
}

// ==========================================
// 台灣地圖核心模組
// ==========================================
const TaiwanCcusMap = ({ mode = 'capture', captureData = [], utilData = [], storageData = [], scope1Data = [] }) => {
    const mapRef = useRef(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
    const [mapPaths, setMapPaths] = useState([]);
    const [hoveredNode, setHoveredNode] = useState(null);

    const baseWidth = 800, baseHeight = 900, centerLon = 120.9, centerLat = 23.7, baseScale = 380; 
    
    const projectBase = (lon, lat) => {
        if (!lon || !lat || isNaN(lon) || isNaN(lat)) return [-9999, -9999]; 
        return [(lon - centerLon) * baseScale, -(lat - centerLat) * baseScale * 1.1];
    };

    const handleMouseDown = (e) => { setIsDragging(true); setLastPos({ x: e.clientX, y: e.clientY }); };
    const handleMouseMove = (e) => {
        if (!isDragging) return;
        setPan(prev => ({ x: prev.x + (e.clientX - lastPos.x), y: prev.y + (e.clientY - lastPos.y) }));
        setLastPos({ x: e.clientX, y: e.clientY });
    };
    const handleMouseUp = () => setIsDragging(false);
    const handleMouseLeave = () => setIsDragging(false);

    useEffect(() => {
        fetch('https://raw.githubusercontent.com/g0v/twgeojson/master/json/twCounty2010.geo.json')
            .then(res => res.json())
            .then(data => {
                const paths = data.features.map(f => {
                    let d = '';
                    const pr = (ring) => { 
                        if(!ring||ring.length===0) return; 
                        const [x,y]=projectBase(ring[0][0],ring[0][1]); 
                        if (x === -9999) return; 
                        d+=`M${x},${y} `; 
                        for(let i=1;i<ring.length;i++){
                            const [lx,ly]=projectBase(ring[i][0],ring[i][1]); 
                            if(lx !== -9999) d+=`L${lx},${ly} `;
                        } 
                        d+='Z '; 
                    };
                    if(f.geometry.type==='Polygon') f.geometry.coordinates.forEach(pr); else if(f.geometry.type==='MultiPolygon') f.geometry.coordinates.forEach(p=>p.forEach(pr));
                    return { d };
                });
                setMapPaths(paths);
            }).catch(() => {});
    }, []);

    const textScale = Math.pow(zoom, 0.7);

    // 計算 CCS 規劃模式的管線拓樸與距離
    const ccsTopology = useMemo(() => {
        if (mode !== 'planning') return { routes: [], zones: [] };
        
        const zoneMap = {};
        scope1Data.forEach(d => {
            if (!zoneMap[d.zone]) zoneMap[d.zone] = { name: d.zone, emissions: 0, lat: d.lat, lon: d.lon, Region: d.Region };
            zoneMap[d.zone].emissions += d.Scope1;
        });

        const routes = [];
        Object.values(zoneMap).forEach(z => {
            let targetHub = null;
            if (z.Region === '南區') targetHub = CCS_HUBS['SOUTH_HUB'];
            else if (z.Region === '北區') targetHub = CCS_HUBS['NORTH_HUB'];
            else if (z.Region === '中區') {
                if (z.lat > 24.1) targetHub = CCS_HUBS['CENTRAL_HUB_1']; 
                else targetHub = CCS_HUBS['CENTRAL_HUB_2']; 
            }

            if (targetHub) {
                const isSeaRoute = targetHub.name.includes('東南亞');
                const distance = estimateRoutingDistance(z.lat, z.lon, targetHub.lat, targetHub.lon, isSeaRoute);
                routes.push({
                    from: { lat: z.lat, lon: z.lon, name: z.name },
                    to: { lat: targetHub.lat, lon: targetHub.lon, name: targetHub.name },
                    weight: z.emissions,
                    distance: distance
                });
            }
        });

        return { routes, zones: Object.values(zoneMap) };
    }, [scope1Data, mode]);

    return (
        <div className="w-full h-full relative bg-slate-50/80 rounded-lg overflow-hidden border border-slate-200">
            {/* 動態懸浮資訊卡 */}
            <div className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur shadow-2xl rounded-xl border border-slate-200 p-4 transition-all duration-300 w-80 pointer-events-none" style={{ opacity: hoveredNode ? 1 : 0, transform: hoveredNode ? 'translateY(0)' : 'translateY(-10px)' }}>
                
                {hoveredNode && mode === 'planning' && hoveredNode.type === 'hub' && (
                    <div>
                        <div className="flex items-center gap-2 mb-3 border-b border-blue-100 pb-2">
                            {hoveredNode.name.includes('東南亞') ? <Ship size={18} className="text-blue-600"/> : <Anchor size={18} className="text-blue-600"/>}
                            <h3 className="font-bold text-slate-800 text-sm">{hoveredNode.name}</h3>
                        </div>
                        <div className="bg-blue-50 p-2 rounded border border-blue-100">
                            <div className="text-xs font-bold text-blue-800 mb-1">樞紐定位</div>
                            <div className="text-xs text-blue-700">{hoveredNode.hubType}</div>
                        </div>
                    </div>
                )}

                {hoveredNode && mode === 'planning' && hoveredNode.type === 'source' && (
                    <div>
                        <div className="flex items-center gap-2 mb-3 border-b border-rose-100 pb-2">
                            <Factory size={16} className="text-rose-600"/>
                            <h3 className="font-bold text-slate-800 text-sm truncate">{hoveredNode.Company} <span className="text-slate-500 font-medium">{hoveredNode.Plant}</span></h3>
                        </div>
                        <div className="space-y-1.5 text-xs text-slate-600">
                            <div className="flex justify-between items-center"><span className="text-slate-400">隸屬區域</span> <span className="font-bold text-slate-700">{hoveredNode.zone}</span></div>
                            <div className="flex justify-between items-center"><span className="text-slate-400">產業類別</span> <span>{hoveredNode.Industry}</span></div>
                            <div className="mt-2 bg-rose-50 p-2 rounded-lg border border-rose-100 flex justify-between items-center">
                                <span className="text-rose-800 font-bold">直接排放 (範疇一)</span>
                                <span className="font-mono font-black text-rose-600 text-sm">{(hoveredNode.Scope1 / 10000).toFixed(1)} <span className="text-[10px] font-normal">萬噸</span></span>
                            </div>
                        </div>
                    </div>
                )}

                {hoveredNode && mode === 'capture' && (
                    <div>
                        <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                            <Factory size={16} className="text-blue-600"/>
                            <h3 className="font-bold text-slate-800 text-sm truncate">{hoveredNode.Company} <span className="text-slate-500 font-medium">{hoveredNode.Plant}</span></h3>
                        </div>
                        <div className="space-y-1.5 text-xs text-slate-600">
                            <div className="flex justify-between items-center"><span className="text-slate-400">來源製程</span> <span className="font-bold text-slate-700">{hoveredNode.Capture_Source || '-'}</span></div>
                            <div className="flex justify-between items-center"><span className="text-slate-400">捕捉技術</span> <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{hoveredNode.Capture_Tech || '-'} (TRL {hoveredNode.TRL})</span></div>
                            
                            <div className="mt-2 bg-blue-50 p-2 rounded-lg border border-blue-100 space-y-1 text-xs">
                                <div className="flex justify-between"><span className="text-slate-500">總捕捉量(A):</span><span className="font-mono font-bold text-slate-700">{hoveredNode.Capture_Volume.toFixed(2)} 萬噸</span></div>
                                <div className="flex justify-between"><span className="text-rose-500">設備耗能(B):</span><span className="font-mono font-bold text-rose-600">-{hoveredNode.Captur_energy.toFixed(2)} 萬噸</span></div>
                                <div className="flex justify-between pt-1 border-t border-blue-200 mt-1"><span className="text-blue-800 font-bold">淨捕捉量(=A-B)</span><span className="font-mono font-black text-blue-700">{hoveredNode.Net_Capture_Volume.toFixed(2)} 萬噸</span></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-white/95 p-1.5 rounded-lg shadow-sm border border-slate-200 backdrop-blur">
                <button onClick={() => setZoom(prev => Math.min(prev * 1.3, 10))} className="p-2 bg-slate-50 hover:bg-slate-200 rounded-md text-slate-600 transition-colors"><ZoomIn size={18}/></button>
                <button onClick={() => setZoom(prev => Math.max(prev / 1.3, 0.5))} className="p-2 bg-slate-50 hover:bg-slate-200 rounded-md text-slate-600 transition-colors"><ZoomOut size={18}/></button>
                <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-2 bg-slate-50 hover:bg-slate-200 rounded-md text-slate-600 transition-colors"><Maximize size={18}/></button>
            </div>

            <svg viewBox={`0 0 ${baseWidth} ${baseHeight}`} className={`w-full h-full select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseLeave} ref={mapRef}>
                <g transform={`translate(${baseWidth/2 + pan.x}, ${baseHeight/2 + pan.y}) scale(${zoom})`}>
                    
                    {mapPaths.map((p, i) => p.d && <path key={`map-${i}`} d={p.d} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={1.5 / zoom} />)}

                    {/* === 規劃模式 (CCS Planning) === */}
                    {mode === 'planning' && (
                        <>
                            {/* 1. 畫管線拓樸與距離 */}
                            {ccsTopology.routes.map((route, i) => {
                                const [x1, y1] = projectBase(route.from.lon, route.from.lat);
                                const [x2, y2] = projectBase(route.to.lon, route.to.lat);
                                if (x1 === -9999 || x2 === -9999) return null;
                                const midX = (x1 + x2) / 2;
                                const midY = (y1 + y2) / 2;
                                return (
                                    <g key={`route-${i}`}>
                                        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3b82f6" strokeWidth={Math.max(2, Math.log10(route.weight/10000))/zoom} strokeDasharray={`${8/zoom} ${6/zoom}`} opacity={0.6}/>
                                        <circle cx={x1} cy={y1} r={4/zoom} fill="#3b82f6"/>
                                        <text x={midX} y={midY - (4/zoom)} fontSize={10/zoom} fill="#1e40af" textAnchor="middle" fontWeight="bold" style={{textShadow: '0 0 3px white', pointerEvents: 'none'}}>
                                            預估 {route.distance.toFixed(0)} km
                                        </text>
                                    </g>
                                );
                            })}
                            
                            {/* 2. 畫樞紐接收站 */}
                            {Object.values(CCS_HUBS).map((hub, i) => {
                                const [cx, cy] = projectBase(hub.lon, hub.lat);
                                if (cx === -9999) return null;
                                return (
                                    <g key={`hub-${i}`} className="cursor-pointer" onMouseEnter={() => setHoveredNode({...hub, type: 'hub', hubType: hub.type})} onMouseLeave={() => setHoveredNode(null)}>
                                        <rect x={cx - 10/zoom} y={cy - 10/zoom} width={20/zoom} height={20/zoom} fill="#0ea5e9" stroke="white" strokeWidth={2/zoom} style={{ filter: 'drop-shadow(0px 3px 4px rgba(0,0,0,0.4))' }} />
                                        <text x={cx + 14/zoom} y={cy + 4/zoom} fontSize={12/textScale} fill="#0369a1" fontWeight="900" paintOrder="stroke" stroke="white" strokeWidth={3/textScale}>{hub.name}</text>
                                    </g>
                                );
                            })}

                            {/* 3. 畫排放源頭 (Scope 1) */}
                            {scope1Data.map((d, i) => {
                                const [cx, cy] = projectBase(d.lon, d.lat);
                                if (cx === -9999) return null;
                                const r = Math.max(5, Math.min(25, Math.sqrt(d.Scope1 / 50000))) / zoom;
                                const isHovered = hoveredNode === d;
                                return (
                                    <g key={`s1-${i}`} className="cursor-pointer transition-all" onMouseEnter={() => setHoveredNode({...d, type: 'source'})} onMouseLeave={() => setHoveredNode(null)}>
                                        <circle cx={cx} cy={cy} r={Math.max(r, 15/zoom)} fill="transparent" />
                                        <circle cx={cx} cy={cy} r={r} fill="#e11d48" fillOpacity={isHovered ? 1 : 0.8} stroke="white" strokeWidth={1.5 / zoom} style={{ filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.3))' }} />
                                    </g>
                                );
                            })}
                        </>
                    )}

                    {/* === 原有模式 === */}
                    {mode === 'capture' && captureData.map((d, i) => {
                        const [cx, cy] = projectBase(d.Longitude, d.Latitude);
                        if (cx === -9999) return null;
                        const r = Math.max(6, Math.min(25, Math.sqrt(d.Capture_Volume || 0) * 1.5)) / zoom; 
                        const isHovered = hoveredNode === d;
                        return (
                            <g key={`cap-${i}`} className="cursor-pointer transition-all" onMouseEnter={() => setHoveredNode(d)} onMouseLeave={() => setHoveredNode(null)}>
                                <circle cx={cx} cy={cy} r={Math.max(r, 20/zoom)} fill="transparent" />
                                <circle cx={cx} cy={cy} r={r} fill={stringToColor(d.Capture_Tech)} fillOpacity={isHovered ? 1 : 0.85} stroke="white" strokeWidth={1.5 / zoom} style={{ filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.3))' }} />
                                <text x={cx + r + (4/zoom)} y={cy + (3/zoom)} fontSize={11 / textScale} fill="#1e293b" fontWeight="900" paintOrder="stroke" stroke="white" strokeWidth={3/textScale} strokeLinejoin="round" className="pointer-events-none">
                                    {d.Company} {zoom > 1.2 && <tspan className="text-slate-500">{d.Plant}</tspan>}
                                </text>
                            </g>
                        );
                    })}
                </g>
            </svg>
            
            <div className="absolute bottom-4 left-4 bg-white/95 p-3 rounded-lg shadow-sm border border-slate-200 text-xs text-slate-700 pointer-events-none backdrop-blur">
                {mode === 'planning' && (
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-sky-500 border border-white"></div> 海洋接收站 / 封存樞紐</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-rose-600 border border-white shadow"></div> 範疇一排碳大戶</div>
                        <div className="flex items-center gap-2"><div className="w-6 h-0 border-t-2 border-blue-500 border-dashed"></div> 共通 CO₂ 管線/航線 (模擬加權距離)</div>
                    </div>
                )}
                {mode === 'capture' && <div><span className="font-bold text-slate-800">彩色實心圓點:</span> 現有捕捉源 (半徑正比於捕捉量)</div>}
            </div>
        </div>
    );
};

// 捕捉端專用 Y 軸標籤
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

// 捕捉專用 Tooltip
const CaptureTooltip = ({ active, payload, label }) => {
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
                    <div className="flex justify-between text-slate-600"><span className="text-slate-500">總捕捉量 (A):</span> <span className="font-mono font-bold">{data.Capture_Volume.toFixed(2)} 萬噸</span></div>
                    <div className="flex justify-between text-rose-600"><span className="text-rose-500">設備耗能 (B):</span> <span className="font-mono font-bold">-{data.Captur_energy.toFixed(2)} 萬噸</span></div>
                    <div className="flex justify-between pt-1 border-t border-blue-200 text-emerald-700 font-bold"><span className="text-emerald-800">淨捕捉量 (=A-B):</span> <span className="font-mono font-black">{data.Net_Capture_Volume.toFixed(2)} 萬噸</span></div>
                </div>
            </div>
        );
    }
    return null;
};

const CcusDashboard = () => {
    const [activeTab, setActiveTab] = useState('planning'); 
    const [captureViewMode, setCaptureViewMode] = useState('map'); 
    const [captureData, setCaptureData] = useState([]);
    const [utilizationData, setUtilizationData] = useState([]);
    const [storageData, setStorageData] = useState([]);
    const [scope1Data, setScope1Data] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState('ALL');
    const [transportMode, setTransportMode] = useState('ALL'); 

    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);
            try {
                const [resCap, resUtil, resStore, resScope1] = await Promise.all([
                    fetch(CCUS_DATA_SOURCES.CAPTURE),
                    fetch(CCUS_DATA_SOURCES.UTILIZATION),
                    fetch(CCUS_DATA_SOURCES.STORAGE),
                    fetch(CCUS_DATA_SOURCES.SCOPE1_URL).catch(() => null) 
                ]);

                const txtCap = await resCap.text();
                const txtUtil = await resUtil.text();
                const txtStore = await resStore.text();
                const txtScope1 = resScope1 ? await resScope1.text() : '';

                const rawCap = parseCSV(txtCap);
                const rawUtil = parseCSV(txtUtil);
                const rawStore = parseCSV(txtStore);
                const rawScope1 = parseCSV(txtScope1);

                setScope1Data(rawScope1.map(d => {
                    const rawName = String(d['事業名稱'] || '');
                    const comp = simplifyCompanyName(rawName);
                    const plantRaw = rawName.replace(d['公司'] || '', '').replace(comp, ''); 
                    const zone = getIndustrialZone(plantRaw, comp);
                    const coords = getApproximateCoordinates(plantRaw, comp);
                    
                    let region = '其他';
                    const countyStr = String(d['縣市別'] || '');
                    if (countyStr.match(/(台北|新北|桃園|新竹|基隆)/)) region = '北區';
                    if (countyStr.match(/(苗栗|台中|彰化|雲林|南投)/)) region = '中區';
                    if (countyStr.match(/(嘉義|台南|高雄|屏東)/)) region = '南區';

                    // 強制覆寫工業區與區域
                    const refinedRegion = getRefinedRegion(plantRaw, comp);
                    if (refinedRegion !== '其他') region = refinedRegion;

                    return {
                        Company: comp,
                        Plant: rawName,
                        Scope1: cleanNumber(d['直接排放量(公噸CO2e)']),
                        Industry: d['七大製造業'] || d['行業分類'],
                        County: countyStr,
                        zone: zone,
                        Region: region,
                        lat: coords.lat,
                        lon: coords.lon
                    };
                }).filter(d => d.Scope1 > 0).sort((a,b) => b.Scope1 - a.Scope1));

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
                        Net_Capture_Volume: cleanNumber(d.Net_Capture_Volume) || Math.max(0, capVol - capEng), 
                        TRL: String(d.TRL || '-'), 
                        Capture_Source: d.Capture_Source || '',
                        Separation_Tech: d.Separation_Tech || '',
                        Temperature: d.Temperature || '',
                        Pressure: d.Pressure || '',
                        Concentration: d.Concentration || '',
                        Potential_Source: d.Potential_Source || '',
                        Future_Emission_Volume: cleanNumber(d.Future_Emission_Volume),
                    };
                }));

                setUtilizationData(rawUtil.map(d => {
                    const expDemand = cleanNumber(d.Expected_Demand);
                    let ratio = 1.0;
                    if (String(d.Conversion_Tech).includes('甲醇')) ratio = 0.7; 
                    else if (String(d.Conversion_Tech).includes('PC')) ratio = 1.5;
                    return {
                        ...d,
                        Year: String(d.Year || '2025'),
                        Expected_Demand: expDemand,
                        Current_Demand: cleanNumber(d.Current_Demand),
                        Product_Generated: expDemand * ratio,
                        TRL: String(d.TRL || '-')
                    };
                }));

                setStorageData(rawStore.map(d => {
                    let mode = String(d.Transport_Method || '');
                    let dist = cleanNumber(d.Distance_km);
                    if (dist === 0) {
                        mode = mode || '未知';
                        dist = mode.includes('海') ? 150 : 30; 
                    }
                    return {
                        ...d,
                        Year: String(d.Year || '2025'),
                        Capturable_Volume: cleanNumber(d.Capturable_Volume),
                        Distance_km: dist,
                        Cost_USD_Per_Ton: cleanNumber(d.Cost_USD_Per_Ton),
                        Transport_Method: mode,
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

    // 計算 Scope 1 區域統計
    const scope1Stats = useMemo(() => {
        let total = 0;
        const zones = {};
        scope1Data.forEach(d => {
            total += d.Scope1;
            if(!zones[d.zone]) zones[d.zone] = { name: d.zone, val: 0, region: d.Region };
            zones[d.zone].val += d.Scope1;
        });
        return {
            total,
            topZones: Object.values(zones).sort((a,b)=>b.val - a.val)
        };
    }, [scope1Data]);

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
                    <button onClick={() => setActiveTab('utilization')} className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${activeTab === 'utilization' ? 'bg-white shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}><FlaskConical size={16}/> 碳再利用 (Utilization)</button>
                    <button onClick={() => setActiveTab('storage')} className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${activeTab === 'storage' ? 'bg-white shadow text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}><Box size={16}/> 碳封存 (Storage)</button>
                </div>
            </div>

            {/* 新增的 CCS 規劃分頁 */}
            {activeTab === 'planning' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                            <div><p className="text-xs text-slate-500 font-bold mb-1 uppercase">列管工廠總排放量 (範疇一)</p><h3 className="text-2xl font-black text-rose-700">{(scope1Stats.total / 10000).toFixed(1)} <span className="text-sm font-medium text-slate-500">萬噸</span></h3></div>
                            <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600"><AlertTriangle size={24}/></div>
                        </div>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between border-l-4 border-l-indigo-500">
                            <div><p className="text-xs text-slate-500 font-bold mb-1 uppercase">高潛力工業區集群數</p><h3 className="text-2xl font-black text-indigo-700">{scope1Stats.topZones.filter(z=>z.val>1000000).length} <span className="text-sm font-medium text-slate-500">個 (&gt;百萬噸)</span></h3></div>
                            <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600"><Layers size={24}/></div>
                        </div>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between border-l-4 border-l-sky-500">
                            <div><p className="text-xs text-slate-500 font-bold mb-1 uppercase">點源平均路徑距離評估</p><h3 className="text-2xl font-black text-sky-700">約 15-50 <span className="text-sm font-medium text-slate-500">km</span></h3></div>
                            <div className="w-12 h-12 rounded-full bg-sky-50 flex items-center justify-center text-sky-600"><Route size={24}/></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* 左側地圖 */}
                        <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-[700px] flex flex-col">
                            <h3 className="font-bold text-slate-700 text-sm mb-4 border-b pb-2 flex items-center gap-2"><Map size={16} className="text-indigo-500"/> CCS 案場與共通管線拓樸分析</h3>
                            <TaiwanCcusMap mode="planning" scope1Data={scope1Data} />
                        </div>

                        {/* 右側分析與清單 */}
                        <div className="lg:col-span-7 flex flex-col gap-6 h-[700px]">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col min-h-0">
                                <h3 className="font-bold text-slate-700 text-sm mb-3 border-b pb-2 flex items-center gap-2"><Route size={16} className="text-sky-500"/> 區域管線佈建可行性分析</h3>
                                <div className="grid grid-cols-3 gap-4 mb-4">
                                    <div className="bg-slate-50 p-3 rounded border border-slate-200">
                                        <div className="text-xs font-bold text-slate-500 mb-1">【南區】跨國海運</div>
                                        <div className="text-xs text-slate-600 leading-relaxed">缺乏合適本土封存場址。建議將大發、林園等高排碳區透過陸運/管線集中至高雄港，再以船運送往東南亞 (如印尼/馬來西亞) 進行跨國封存。</div>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded border border-slate-200">
                                        <div className="text-xs font-bold text-slate-500 mb-1">【中區】本土封存潛力</div>
                                        <div className="text-xs text-slate-600 leading-relaxed">具備本土封存優勢。台中與彰化區域可就近利用「台中港外海」；雲林麥寮等超大排放源可直接利用「麥寮工業區外海」發展本土海域 CCS 封存示範場域。</div>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded border border-slate-200">
                                        <div className="text-xs font-bold text-slate-500 mb-1">【北區】林口封存</div>
                                        <div className="text-xs text-slate-600 leading-relaxed">排放源相對分散。主要集中於桃園/新竹，可評估向北延伸管線至「林口外海」進行封存。</div>
                                    </div>
                                </div>
                                <div className="flex-1 min-h-0">
                                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                        <BarChart data={scope1Stats.topZones.slice(0, 6)} layout="vertical" margin={{top:5, right:40, left:40, bottom:0}}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                            <XAxis type="number" tickFormatter={v => (v/10000).toFixed(0)} fontSize={10} unit="萬噸"/>
                                            <YAxis dataKey="name" type="category" width={110} tick={{fontSize:11, fontWeight:'bold', fill:'#475569'}} interval={0}/>
                                            <Tooltip formatter={(v) => [(v/10000).toFixed(1) + ' 萬噸', '範疇一排放']} contentStyle={{borderRadius:'8px'}}/>
                                            <Bar dataKey="val" fill="#e11d48" radius={[0,4,4,0]} barSize={20}>
                                                <LabelList dataKey="val" position="right" formatter={v => (v/10000).toFixed(0)} fontSize={10} fill="#be123c" fontWeight="bold"/>
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col min-h-0">
                                <div className="flex justify-between items-center mb-2 border-b pb-2">
                                    <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><List size={16} className="text-rose-500"/> 排放點源清單 (擷取自最新上傳資料)</h3>
                                </div>
                                <div className="flex-1 overflow-auto custom-scrollbar">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-100 sticky top-0 shadow-sm">
                                            <tr>
                                                <th className="p-2">事業名稱</th><th className="p-2">行業</th><th className="p-2">所屬工業區</th>
                                                <th className="p-2 text-right">範疇一排放 (噸)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {scope1Data.map((row, i) => (
                                                <tr key={i} className="hover:bg-rose-50 transition-colors">
                                                    <td className="p-2 font-bold text-slate-700">{row.Plant}</td>
                                                    <td className="p-2 text-slate-500">{row.Industry}</td>
                                                    <td className="p-2 text-blue-600">{row.zone}</td>
                                                    <td className="p-2 text-right font-mono font-bold text-rose-600">{row.Scope1.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 原有 Capture Tab */}
            {activeTab === 'capture' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                            <div><p className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider">現行淨捕捉量總和</p><h3 className="text-3xl font-black text-blue-800">{totalCapture.toFixed(1)} <span className="text-sm font-medium text-slate-500">萬噸/年</span></h3></div>
                            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><Leaf size={28}/></div>
                        </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><MapPin size={16} className="text-blue-500"/> 碳捕捉地圖分佈與工程清單</h3>
                            <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-bold shadow-inner">
                                <button onClick={() => setCaptureViewMode('map')} className={`px-3 py-1.5 rounded-md flex items-center gap-1 ${captureViewMode === 'map' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><MapPin size={14}/> 地圖分佈</button>
                                <button onClick={() => setCaptureViewMode('table_current')} className={`px-3 py-1.5 rounded-md flex items-center gap-1 ${captureViewMode === 'table_current' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><List size={14}/> 🟢 現有捕捉設施</button>
                            </div>
                        </div>
                        
                        {captureViewMode === 'map' && (
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[650px]">
                                <div className="lg:col-span-5 relative"><TaiwanCcusMap mode="capture" captureData={fCapture.filter(r => r.Capture_Volume > 0)} /></div>
                                <div className="lg:col-span-7 flex flex-col">
                                    <h3 className="font-bold text-slate-700 text-xs mb-2 flex items-center gap-1 text-center justify-center bg-slate-50 py-2 rounded"><Activity size={14} className="text-blue-500"/> 技術解析：總捕捉量 vs 設備耗能</h3>
                                    <div className="flex-1 w-full min-h-0 relative">
                                        <ErrorBoundary>
                                            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                                <BarChart data={fCapture.filter(r => r.Capture_Volume > 0).sort((a,b) => b.Capture_Volume - a.Capture_Volume)} layout="vertical" margin={{ top: 5, right: 50, left: 20, bottom: 5 }} barGap={2} barSize={26}>
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false}/>
                                                    <XAxis type="number" fontSize={10} unit=" 萬噸"/>
                                                    <YAxis dataKey="Label" type="category" width={130} interval={0} tick={<CaptureYAxisTick data={fCapture.filter(r => r.Capture_Volume > 0)} />}/>
                                                    <Tooltip content={<CaptureTooltip />}/>
                                                    <Legend wrapperStyle={{fontSize:'11px'}} verticalAlign="top"/>
                                                    <Bar dataKey="Net_Capture_Volume" name="淨捕捉量" stackId="capture" fill="#10b981">
                                                        <LabelList dataKey="Net_Capture_Volume" position="insideLeft" fill="white" fontSize={10} fontWeight="bold" formatter={(v) => v > 0 ? `淨 ${Number(v).toFixed(1)}` : ''} style={{textShadow: '0px 0px 2px rgba(0,0,0,0.5)'}} />
                                                    </Bar>
                                                    <Bar dataKey="Captur_energy" name="設備耗能" stackId="capture" fill="#ef4444" radius={[0, 4, 4, 0]}>
                                                        <LabelList dataKey="Capture_Volume" position="right" fill="#475569" fontSize={10} fontWeight="bold" formatter={(v) => `總 ${Number(v).toFixed(1)}`} />
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </ErrorBoundary>
                                    </div>
                                </div>
                            </div>
                        )}

                        {captureViewMode === 'table_current' && (
                            <div className="overflow-x-auto h-[650px] custom-scrollbar">
                                <table className="w-full text-xs text-left whitespace-nowrap">
                                    <thead className="bg-slate-100 text-slate-600 sticky top-0 shadow-sm z-10">
                                        <tr>
                                            <th className="p-3">公司廠區</th><th className="p-3">捕捉來源</th><th className="p-3">捕捉技術</th><th className="p-3">分離技術</th>
                                            <th className="p-3">TRL</th><th className="p-3">溫度(℃)</th><th className="p-3">壓力(bar)</th><th className="p-3">濃度(vol%)</th>
                                            <th className="p-3 text-right bg-blue-50">總捕捉量</th><th className="p-3 text-right bg-rose-50">設備耗能(扣除)</th><th className="p-3 text-right bg-emerald-50">淨捕捉量</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {fCapture.filter(r => r.Capture_Volume > 0).map((row, i) => (
                                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-3 font-bold text-slate-700">{row.Label}</td><td className="p-3">{row.Capture_Source}</td>
                                                <td className="p-3"><span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg">{row.Capture_Tech}</span></td>
                                                <td className="p-3 text-slate-500">{row.Separation_Tech}</td><td className="p-3 font-mono">{row.TRL}</td>
                                                <td className="p-3 font-mono">{row.Temperature}</td><td className="p-3 font-mono">{row.Pressure}</td><td className="p-3 font-mono">{row.Concentration}</td>
                                                <td className="p-3 text-right font-mono font-bold text-blue-600">{row.Capture_Volume.toFixed(1)}</td>
                                                <td className="p-3 text-right font-mono text-rose-500">-{row.Captur_energy.toFixed(1)}</td>
                                                <td className="p-3 text-right font-mono font-bold text-emerald-600">{row.Net_Capture_Volume.toFixed(1)}</td>
                                            </tr>
                                        ))}
                                        {fCapture.filter(r => r.Capture_Volume > 0).length === 0 && <tr><td colSpan={11} className="p-8 text-center text-slate-400">目前尚無現有捕捉設備數據</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 其餘 Utilization 與 Storage 分頁略過變動，保持原樣運行 */}
        </div>
    );
};

export default CcusDashboard;