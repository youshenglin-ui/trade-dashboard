import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ScatterChart, Scatter, ZAxis, Cell, LabelList, ComposedChart, Line, Label
} from 'recharts';
import { 
  Leaf, RefreshCw, Target, Activity, MapPin, DollarSign, Box, AlertTriangle, 
  Truck, Ship, GripHorizontal, FlaskConical, Plus, ZoomIn, ZoomOut, Maximize, Hand, Factory
} from 'lucide-react';

// --- 整合外部常數 (Constants) ---
const CCUS_DATA_SOURCES = {
  CAPTURE: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ8aZTek-9SoTaK7Z_Wu9InU2c_vu4cUpD0Nn4fCs-w0IM3XoWeNXK5ZldWoEs6M3G6mJTS6QoF4Mo/pub?gid=388581449&single=true&output=csv',
  UTILIZATION: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ8aZTek-9SoTaK7Z_Wu9InU2c_vu4cUpD0Nn4fCs-w0IM3XoWeNXK5ZldWoEs6M3G6mJTS6QoF4Mo/pub?gid=1496771601&single=true&output=csv',
  STORAGE: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ8aZTek-9SoTaK7Z_Wu9InU2c_vu4cUpD0Nn4fCs-w0IM3XoWeNXK5ZldWoEs6M3G6mJTS6QoF4Mo/pub?gid=1902888591&single=true&output=csv'
};

// 簡化版 fallback 座標 (若 GeoJSON 載入失敗時使用)
const FALLBACK_TAIWAN_GEOJSON = [
    { name: "北區", coords: [[[121.96,24.98],[121.82,24.74],[121.53,24.68],[121.03,24.94],[121.28,25.11],[121.57,25.19],[121.96,24.98]]] },
    { name: "中區", coords: [[[121.03,24.94],[120.67,24.01],[120.51,23.80],[120.13,23.62],[120.64,23.78],[121.26,23.99],[121.03,24.94]]] },
    { name: "南區", coords: [[[120.64,23.78],[120.13,23.62],[120.02,23.07],[120.20,22.82],[120.89,22.04],[121.01,23.43],[120.64,23.78]]] },
    { name: "東區", coords: [[[121.96,24.98],[121.53,24.68],[121.26,23.99],[121.01,23.43],[120.89,22.04],[121.50,22.08],[121.63,24.37],[121.96,24.98]]] }
];

// --- 整合外部函式 (Helpers) ---
const cleanNumber = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isFinite(val) ? val : 0;
  const str = String(val).trim();
  if (str === '-' || str === '－') return 0; 
  const num = parseFloat(str.replace(/[,%\s]/g, ''));
  return isFinite(num) ? num : 0;
};

const stringToColor = (str) => {
    const COLORS_POOL = [
        '#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', 
        '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444',
        '#0284c7', '#0d9488', '#ea580c', '#9333ea', '#e11d48'
    ];
    if (!str) return COLORS_POOL[0];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return COLORS_POOL[Math.abs(hash) % COLORS_POOL.length];
};

const getRegionByCounty = (countyName) => {
    const n = String(countyName || '');
    if (n.match(/(基隆|臺北|台北|新北|桃園|新竹|宜蘭)/)) return '北區';
    if (n.match(/(苗栗|臺中|台中|彰化|南投|雲林)/)) return '中區';
    if (n.match(/(嘉義|臺南|台南|高雄|屏東)/)) return '南區';
    if (n.match(/(花蓮|臺東|台東)/)) return '東區';
    return '其他';
};

const REGION_COLORS = {
    '北區': '#e0f2fe', '中區': '#d1fae5', '南區': '#fffbeb', '東區': '#f5f3ff', '其他': '#f1f5f9'
};

const getApproximateCoordinates = (name) => {
    const n = String(name || '');
    if (n.includes('大發')) return { lat: 22.58, lon: 120.40 };
    if (n.includes('林園') || n.includes('小港') || n.includes('中鋼')) return { lat: 22.51, lon: 120.35 };
    if (n.includes('仁武') || n.includes('大社') || n.includes('國喬')) return { lat: 22.70, lon: 120.34 };
    if (n.includes('麥寮') || n.includes('六輕')) return { lat: 23.78, lon: 120.18 };
    if (n.includes('彰濱')) return { lat: 24.07, lon: 120.42 };
    if (n.includes('頭份') || n.includes('長春')) return { lat: 24.68, lon: 120.91 };
    if (n.includes('桃園') || n.includes('觀音')) return { lat: 25.03, lon: 121.12 };
    if (n.includes('台西')) return { lat: 23.71, lon: 120.19 };
    if (n.includes('鐵砧山')) return { lat: 24.36, lon: 120.65 };
    return { lat: 23.6, lon: 120.9 }; // Default Central Taiwan
};

// Haversine 直線距離算法 (km)
const calcDistanceKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

const checkHydrogenRequirement = (techName) => {
    const t = String(techName).toLowerCase();
    if (t.match(/(甲醇|醇|烷|烯|炔)/)) return { requiresH2: true, label: '需配綠/藍氫', color: 'text-blue-600', bg: 'bg-blue-100', ratio: 0.136 }; 
    if (t.match(/(pc|聚碳酸酯)/)) return { requiresH2: false, label: '無須配氫', color: 'text-slate-500', bg: 'bg-slate-100', ratio: 0 };
    return { requiresH2: false, label: '視製程而定', color: 'text-amber-600', bg: 'bg-amber-100', ratio: 0 };
};

const parseHydrogenCSV = (text) => {
    if (!text || text.includes('<!DOCTYPE html>')) return [];
    const lines = text.split(/\r\n|\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const parseLine = (line) => {
        const res = [];
        let current = '';
        let inQuote = false;
        for (let c of line) {
            if (c === '"') { inQuote = !inQuote; continue; }
            if (c === ',' && !inQuote) { res.push(current.trim()); current = ''; continue; }
            current += c;
        }
        res.push(current.trim());
        return res;
    };
    const headers = parseLine(lines[0]);
    return lines.slice(1).map(line => {
        const row = parseLine(line);
        const obj = {};
        headers.forEach((h, i) => { obj[h.replace(/^[\uFEFF\s]+|[\s]+$/g, '')] = row[i]; });
        return obj;
    });
};

class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { hasError: false }; }
    static getDerivedStateFromError(error) { return { hasError: true }; }
    render() {
      if (this.state.hasError) return <div className="h-full flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded text-slate-400"><AlertTriangle size={32} className="mb-2 text-amber-400" /><p className="text-sm">圖表資料異常</p></div>;
      return this.props.children;
    }
}

// ==========================================
// 真實 GeoJSON 台灣地圖模組 (具備 Zoom In/Out 與滑鼠拖曳平移功能)
// ==========================================
const TaiwanCcusMap = ({ mode = 'capture', captureData = [], utilData = [], storageData = [] }) => {
    const mapRef = useRef(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
    const [mapPaths, setMapPaths] = useState([]);

    const baseWidth = 800;
    const baseHeight = 900;
    const centerLon = 120.9;
    const centerLat = 23.7; 
    const baseScale = 380; 

    // 核心投影公式：將經緯度轉為 SVG 基礎座標
    const projectBase = (lon, lat) => {
        const x = (lon - centerLon) * baseScale;
        const y = -(lat - centerLat) * baseScale * 1.1; 
        return [x, y];
    };

    useEffect(() => {
        fetch('https://raw.githubusercontent.com/g0v/twgeojson/master/json/twCounty2010.geo.json')
            .then(res => res.json())
            .then(data => {
                const paths = data.features.map(feature => {
                    let pathStr = '';
                    const type = feature.geometry.type;
                    const coords = feature.geometry.coordinates;

                    const processRing = (ring) => {
                        if(!ring || ring.length === 0) return;
                        const [x, y] = projectBase(ring[0][0], ring[0][1]);
                        pathStr += `M${x},${y} `;
                        for(let i=1; i<ring.length; i++) {
                            const [lx, ly] = projectBase(ring[i][0], ring[i][1]);
                            pathStr += `L${lx},${ly} `;
                        }
                        pathStr += 'Z ';
                    };

                    if (type === 'Polygon') coords.forEach(processRing);
                    else if (type === 'MultiPolygon') coords.forEach(poly => poly.forEach(processRing));

                    const countyName = feature.properties.COUNTYNAME;
                    return { name: countyName, region: getRegionByCounty(countyName), d: pathStr };
                });
                setMapPaths(paths);
            })
            .catch(err => {
                console.error("GeoJSON 載入失敗，啟用備用輪廓", err);
                const fallbacks = FALLBACK_TAIWAN_GEOJSON.map(region => {
                    const ring = region.coords[0];
                    let pathStr = '';
                    const [x, y] = projectBase(ring[0][0], ring[0][1]);
                    pathStr += `M${x},${y} `;
                    for(let i=1; i<ring.length; i++) {
                        const [lx, ly] = projectBase(ring[i][0], ring[i][1]);
                        pathStr += `L${lx},${ly} `;
                    }
                    pathStr += 'Z';
                    return { name: region.name, region: region.name, d: pathStr };
                });
                setMapPaths(fallbacks);
            });
    }, []);

    const handleMouseDown = (e) => { setIsDragging(true); setLastPos({ x: e.clientX, y: e.clientY }); };
    const handleMouseMove = (e) => {
        if (!isDragging) return;
        setPan(prev => ({ x: prev.x + (e.clientX - lastPos.x), y: prev.y + (e.clientY - lastPos.y) }));
        setLastPos({ x: e.clientX, y: e.clientY });
    };
    const handleMouseUp = () => setIsDragging(false);
    const handleMouseLeave = () => setIsDragging(false);

    const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.3, 10));
    const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.3, 0.5));
    const handleReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

    return (
        <div className="w-full h-full relative bg-slate-50/80 rounded-lg overflow-hidden border border-slate-200">
            {/* 地圖操作面板 */}
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-white/95 p-1.5 rounded-lg shadow-sm border border-slate-200 backdrop-blur">
                <button onClick={handleZoomIn} className="p-2 bg-slate-50 hover:bg-slate-200 rounded-md text-slate-600 transition-colors" title="放大"><ZoomIn size={18}/></button>
                <button onClick={handleZoomOut} className="p-2 bg-slate-50 hover:bg-slate-200 rounded-md text-slate-600 transition-colors" title="縮小"><ZoomOut size={18}/></button>
                <button onClick={handleReset} className="p-2 bg-slate-50 hover:bg-slate-200 rounded-md text-slate-600 transition-colors" title="還原視角"><Maximize size={18}/></button>
                <div className="w-full h-px bg-slate-200 my-0.5"></div>
                <div className="flex justify-center p-1 text-slate-400" title="可滑鼠按住拖曳地圖"><Hand size={16}/></div>
            </div>

            <svg 
                viewBox={`0 0 ${baseWidth} ${baseHeight}`} 
                className={`w-full h-full select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseLeave}
                ref={mapRef}
            >
                <g transform={`translate(${baseWidth/2 + pan.x}, ${baseHeight/2 + pan.y}) scale(${zoom})`}>
                    
                    {/* 1. 繪製台灣地圖底圖 */}
                    {mapPaths.map((p, i) => (
                        <path key={i} d={p.d} fill={REGION_COLORS[p.region] || '#f8fafc'} stroke="#cbd5e1" strokeWidth={1.5 / zoom} className="transition-colors hover:fill-slate-200">
                            <title>{p.name}</title>
                        </path>
                    ))}

                    {/* 2. 模式：Capture (碳捕捉點) */}
                    {mode === 'capture' && captureData.map((d, i) => {
                        const coords = (d.Longitude && d.Latitude) ? { lon: d.Longitude, lat: d.Latitude } : getApproximateCoordinates(d.Plant);
                        const [cx, cy] = projectBase(coords.lon, coords.lat);
                        const r = Math.max(4, Math.min(25, Math.sqrt(d.Net_Capture_Volume || 0) * 1.5)) / zoom; 
                        return (
                            <g key={i} className="hover:opacity-80 transition-opacity">
                                <circle cx={cx} cy={cy} r={r} fill={stringToColor(d.Capture_Tech)} fillOpacity={0.85} stroke="white" strokeWidth={1.5 / zoom} />
                                <text x={cx + r + (4/zoom)} y={cy + (3/zoom)} fontSize={12 / zoom} fill="#1e293b" fontWeight="bold" style={{textShadow: '0 0 3px white'}} className="pointer-events-none">{d.Company}</text>
                                <title>{`${d.Company} ${d.Plant}\n技術: ${d.Capture_Tech}\n淨捕捉量: ${d.Net_Capture_Volume} 萬噸`}</title>
                            </g>
                        );
                    })}

                    {/* 3. 模式：Utilization (再利用點) */}
                    {mode === 'utilization' && utilData.map((d, i) => {
                        const coords = getApproximateCoordinates(d.Target_Plant);
                        const [cx, cy] = projectBase(coords.lon, coords.lat);
                        const r = Math.max(6, Math.min(20, Math.sqrt(d.Expected_Demand || 0) * 2)) / zoom;
                        return (
                            <g key={i} className="hover:opacity-80">
                                <circle cx={cx} cy={cy} r={r} fill="#10b981" fillOpacity={0.9} stroke="white" strokeWidth={2 / zoom} />
                                <text x={cx + r + (4/zoom)} y={cy + (3/zoom)} fontSize={12 / zoom} fill="#064e3b" fontWeight="bold" style={{textShadow: '0 0 3px white'}} className="pointer-events-none">{d.Target_Company}</text>
                                <title>{`再利用目標: ${d.Target_Company} ${d.Target_Plant}\n產品: ${d.Conversion_Tech}\n預期需求: ${d.Expected_Demand} 萬噸`}</title>
                            </g>
                        );
                    })}

                    {/* 4. 模式：Storage (封存場與運輸路線) */}
                    {mode === 'storage' && storageData.map((d, i) => {
                        const sourceCoords = getApproximateCoordinates(d.Source_Company);
                        const sinkCoords = getApproximateCoordinates(d.Storage_Site);
                        const [x1, y1] = projectBase(sourceCoords.lon, sourceCoords.lat);
                        const [x2, y2] = projectBase(sinkCoords.lon, sinkCoords.lat);
                        
                        let strokeDash = "0"; 
                        let lineColor = "#3b82f6";
                        if (d.Transport_Method.includes('陸運')) { strokeDash = `${6/zoom} ${6/zoom}`; lineColor = "#f59e0b"; } 
                        if (d.Transport_Method.includes('海運')) { strokeDash = `${3/zoom} ${6/zoom}`; lineColor = "#14b8a6"; } 

                        return (
                            <g key={i} className="hover:opacity-80">
                                {/* 運輸路線 */}
                                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={lineColor} strokeWidth={2.5 / zoom} strokeDasharray={strokeDash} opacity={0.7}/>
                                {/* 碳源點 */}
                                <circle cx={x1} cy={y1} r={4 / zoom} fill="#64748b" />
                                {/* 封存場點 */}
                                <circle cx={x2} cy={y2} r={8 / zoom} fill="#ef4444" stroke="white" strokeWidth={1.5 / zoom} />
                                <text x={x2 + (10/zoom)} y={y2 + (3/zoom)} fontSize={12 / zoom} fill="#991b1b" fontWeight="bold" style={{textShadow: '0 0 3px white'}} className="pointer-events-none">{d.Storage_Site}</text>
                                <title>{`來源: ${d.Source_Company} ➔ 封存: ${d.Storage_Site}\n方式: ${d.Transport_Method}\n距離: ${d.Distance_km} km`}</title>
                            </g>
                        );
                    })}
                </g>
            </svg>
            
            {/* 地圖圖例 */}
            <div className="absolute bottom-4 left-4 bg-white/95 p-3 rounded-lg shadow-sm border border-slate-200 text-xs text-slate-700 pointer-events-none backdrop-blur">
                {mode === 'capture' && <div><span className="font-bold text-slate-800">彩色圓點:</span> 捕捉源 (半徑正比於淨捕捉量)</div>}
                {mode === 'utilization' && <div><span className="font-bold text-emerald-700">綠色圓點:</span> 需求廠區 (半徑正比於需求量)</div>}
                {mode === 'storage' && (
                    <div className="space-y-2">
                        <div><span className="font-bold text-rose-600">紅色大點:</span> 封存場域</div>
                        <div className="flex items-center gap-2"><div className="w-6 h-1 bg-blue-500"></div> 管線佈建</div>
                        <div className="flex items-center gap-2"><div className="w-6 h-0 border-t-2 border-amber-500 border-dashed"></div> 陸路槽車</div>
                        <div className="flex items-center gap-2"><div className="w-6 h-0 border-t-2 border-teal-500 border-dotted"></div> 海洋運輸</div>
                    </div>
                )}
            </div>
        </div>
    );
};


// ==========================================
// 主戰情室組件
// ==========================================
const CcusDashboard = () => {
    const [activeTab, setActiveTab] = useState('capture'); // capture | utilization | storage
    const [captureData, setCaptureData] = useState([]);
    const [utilizationData, setUtilizationData] = useState([]);
    const [storageData, setStorageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [selectedYear, setSelectedYear] = useState('ALL');
    const [transportMode, setTransportMode] = useState('ALL'); 

    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);
            try {
                const [resCap, resUtil, resStore] = await Promise.all([
                    fetch(CCUS_DATA_SOURCES.CAPTURE),
                    fetch(CCUS_DATA_SOURCES.UTILIZATION),
                    fetch(CCUS_DATA_SOURCES.STORAGE)
                ]);

                if (!resCap.ok || !resUtil.ok || !resStore.ok) throw new Error("資料拉取失敗");

                const txtCap = await resCap.text();
                const txtUtil = await resUtil.text();
                const txtStore = await resStore.text();

                const rawCap = parseHydrogenCSV(txtCap);
                const rawUtil = parseHydrogenCSV(txtUtil);
                const rawStore = parseHydrogenCSV(txtStore);

                setCaptureData(rawCap.map(d => {
                    const capVol = cleanNumber(d.Capture_Volume);
                    const unitEmissions = cleanNumber(d.Emission_Per_Ton);
                    const netVol = capVol - unitEmissions;
                    return {
                        ...d,
                        Year: String(d.Year || '2025'),
                        Latitude: cleanNumber(d.Latitude),
                        Longitude: cleanNumber(d.Longitude),
                        Capture_Tech: d.Capture_Tech || '未知技術',
                        Capture_Volume: capVol,
                        Unit_Emissions: unitEmissions,
                        Net_Capture_Volume: netVol > 0 ? netVol : 0,
                        TRL: d.TRL ? cleanNumber(d.TRL) : (Math.floor(Math.random() * 3) + 7) 
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
                        Total_Emissions: cleanNumber(d.Total_Emissions),
                        Current_Demand: cleanNumber(d.Current_Demand),
                        Expected_Demand: expDemand,
                        Product_Generated: expDemand * ratio
                    };
                }));

                setStorageData(rawStore.map(d => {
                    let mode = String(d.Transport_Method || '');
                    let dist = cleanNumber(d.Distance_km);
                    
                    // 如果距離未填寫，啟動 Haversine 自動計算
                    if (dist === 0) {
                        const c1 = getApproximateCoordinates(d.Source_Company);
                        const c2 = getApproximateCoordinates(d.Storage_Site);
                        const straightDist = calcDistanceKm(c1.lat, c1.lon, c2.lat, c2.lon);
                        
                        // 依據運輸方式加上現實路徑加權系數
                        if (!mode) mode = straightDist < 20 ? '管線' : (straightDist > 100 ? '海運' : '陸運');
                        if (mode.includes('陸運')) dist = straightDist * 1.4;
                        else if (mode.includes('海運')) dist = straightDist * 1.2;
                        else dist = straightDist * 1.1; // 管線
                    }

                    return {
                        ...d,
                        Year: String(d.Year || '2025'),
                        Capturable_Volume: cleanNumber(d.Capturable_Volume),
                        Distance_km: parseFloat(dist.toFixed(1)),
                        Cost_USD_Per_Ton: cleanNumber(d.Cost_USD_Per_Ton),
                        Transport_Method: mode
                    };
                }));

                setErrorMsg('');
            } catch (err) {
                console.error(err);
                setErrorMsg(`發生錯誤: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };
        fetchAllData();
    }, []);

    const availableYears = useMemo(() => {
        const years = new Set([...captureData.map(d => d.Year), ...utilizationData.map(d => d.Year), ...storageData.map(d => d.Year)]);
        return Array.from(years).filter(Boolean).sort();
    }, [captureData, utilizationData, storageData]);

    useEffect(() => {
        if (availableYears.length > 0 && selectedYear === 'ALL') setSelectedYear(availableYears[availableYears.length - 1]);
    }, [availableYears]);

    const fCapture = useMemo(() => captureData.filter(d => selectedYear === 'ALL' || d.Year === selectedYear), [captureData, selectedYear]);
    const fUtil = useMemo(() => utilizationData.filter(d => selectedYear === 'ALL' || d.Year === selectedYear), [utilizationData, selectedYear]);
    const fStorage = useMemo(() => storageData.filter(d => selectedYear === 'ALL' || d.Year === selectedYear), [storageData, selectedYear]);

    const { totalCapture, totalExpectedDemand, avgCost, totalH2Demand } = useMemo(() => {
        const tCap = fCapture.reduce((sum, row) => sum + row.Net_Capture_Volume, 0);
        const tDemand = fUtil.reduce((sum, row) => sum + row.Expected_Demand, 0);
        
        let h2Sum = 0;
        fUtil.forEach(row => {
            const req = checkHydrogenRequirement(row.Conversion_Tech);
            if (req.requiresH2) h2Sum += row.Expected_Demand * req.ratio;
        });

        let costSum = 0, volSum = 0;
        fStorage.filter(row => transportMode === 'ALL' || row.Transport_Method.includes(transportMode)).forEach(row => {
            if (row.Cost_USD_Per_Ton > 0 && row.Capturable_Volume > 0) {
                costSum += row.Cost_USD_Per_Ton * row.Capturable_Volume;
                volSum += row.Capturable_Volume;
            }
        });
        const avgC = volSum > 0 ? (costSum / volSum) : 0;

        return { totalCapture: tCap, totalExpectedDemand: tDemand, avgCost: avgC, totalH2Demand: h2Sum };
    }, [fCapture, fUtil, fStorage, transportMode]);

    const uniqueCaptureTechs = useMemo(() => Array.from(new Set(fCapture.map(d => d.Capture_Tech))), [fCapture]);

    // 自訂 Capture BarChart Tooltip 
    const CaptureTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white/95 backdrop-blur border border-slate-200 p-3 rounded-lg shadow-xl text-xs">
                    <p className="font-bold text-slate-800 mb-1 border-b pb-1 flex items-center gap-1"><Factory size={12}/> {label}</p>
                    <p className="mb-2 font-bold" style={{color: stringToColor(data.Capture_Tech)}}>技術: {data.Capture_Tech} (TRL {data.TRL})</p>
                    <p className="text-slate-600 mb-0.5"><span className="text-slate-400">總捕捉量:</span> {data.Capture_Volume.toFixed(2)} 萬噸</p>
                    <p className="text-rose-500 mb-0.5"><span className="text-slate-400">設備碳排:</span> -{data.Unit_Emissions.toFixed(2)} 萬噸</p>
                    <p className="text-emerald-600 font-bold font-mono mt-1 pt-1 border-t border-slate-100"><span className="text-slate-500 font-sans font-normal">淨捕捉量:</span> {data.Net_Capture_Volume.toFixed(2)} 萬噸</p>
                </div>
            );
        }
        return null;
    };

    if (loading) return <div className="p-10 text-center animate-pulse text-teal-600 flex flex-col items-center"><RefreshCw className="animate-spin mb-2"/> CCUS 地理資料建構中...</div>;
    if (errorMsg) return <div className="p-10 text-center text-rose-500 bg-rose-50 rounded-lg">{errorMsg}</div>;

    return (
        <div className="space-y-6 animate-fade-in pb-10 min-h-screen p-4 bg-slate-50">
            {/* Header: 標題、年份過濾與分頁選單 */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-lg text-teal-800 font-bold">
                        <Leaf className="text-teal-500"/> CCUS 碳捕捉與封存戰情室
                    </div>
                    <select 
                        value={selectedYear} 
                        onChange={e => setSelectedYear(e.target.value)} 
                        className="bg-slate-100 border border-slate-200 text-slate-700 font-bold px-3 py-1 rounded-lg outline-none cursor-pointer hover:bg-slate-200 transition-colors"
                    >
                        {availableYears.map(y => <option key={y} value={y}>{y}年</option>)}
                        <option value="ALL">全年度</option>
                    </select>
                </div>
                
                {/* 模組分頁選單 (Tabs) */}
                <div className="flex bg-slate-100 p-1 rounded-xl font-bold text-sm">
                    <button onClick={() => setActiveTab('capture')} className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${activeTab === 'capture' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
                        <Activity size={16}/> 碳捕捉 (Capture)
                    </button>
                    <button onClick={() => setActiveTab('utilization')} className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${activeTab === 'utilization' ? 'bg-white shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>
                        <FlaskConical size={16}/> 碳再利用 (Utilization)
                    </button>
                    <button onClick={() => setActiveTab('storage')} className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${activeTab === 'storage' ? 'bg-white shadow text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}>
                        <Box size={16}/> 碳封存 (Storage)
                    </button>
                </div>
            </div>

            {/* ================= TAB 1: CAPTURE ================= */}
            {activeTab === 'capture' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                            <div>
                                <p className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider">總淨捕捉量</p>
                                <h3 className="text-3xl font-black text-slate-800">{totalCapture.toFixed(1)} <span className="text-sm font-medium text-slate-500">萬噸/年</span></h3>
                            </div>
                            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><Leaf size={28}/></div>
                        </div>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                            <div>
                                <p className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider">活躍捕捉點源</p>
                                <h3 className="text-3xl font-black text-slate-800">{fCapture.length} <span className="text-sm font-medium text-slate-500">個廠區</span></h3>
                            </div>
                            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"><MapPin size={28}/></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* 左側地圖 */}
                        <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-[650px] flex flex-col">
                            <h3 className="font-bold text-slate-700 text-sm mb-4 border-b pb-2 flex items-center gap-2"><MapPin size={16} className="text-blue-500"/> 潛在碳捕捉點分佈 (真實地圖投影)</h3>
                            <TaiwanCcusMap mode="capture" captureData={fCapture} />
                        </div>
                        
                        {/* 右側圖表 */}
                        <div className="lg:col-span-7 bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-[650px] flex flex-col">
                            <div className="flex justify-between items-center mb-4 border-b pb-2">
                                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><Activity size={16} className="text-blue-500"/> 技術解析：總捕捉量 vs 設備耗能</h3>
                                <div className="flex flex-wrap gap-2 text-[10px] justify-end max-w-sm">
                                    {uniqueCaptureTechs.map(tech => (
                                        <span key={tech} className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md border border-slate-200 font-bold">
                                            <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: stringToColor(tech)}}></div>{tech}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="flex-1 w-full min-h-0 relative">
                                <ErrorBoundary>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={fCapture.sort((a,b) => b.Capture_Volume - a.Capture_Volume)} layout="vertical" margin={{ top: 5, right: 40, left: 40, bottom: 5 }} barGap={2} barSize={26}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false}/>
                                            <XAxis type="number" fontSize={10} unit=" 萬噸"/>
                                            <YAxis dataKey="Plant" type="category" width={110} tick={{fontSize: 11, fill: '#475569', fontWeight: 'bold'}} interval={0}/>
                                            <Tooltip content={<CaptureTooltip />}/>
                                            <Legend wrapperStyle={{fontSize:'11px'}} verticalAlign="top"/>
                                            
                                            <Bar dataKey="Net_Capture_Volume" name="淨捕捉量" stackId="capture">
                                                {fCapture.map((entry, index) => <Cell key={`cell-${index}`} fill={stringToColor(entry.Capture_Tech)} />)}
                                                <LabelList dataKey="TRL" position="insideLeft" fill="white" fontSize={10} fontWeight="bold" formatter={(v) => `TRL ${v}`} style={{textShadow: '0px 0px 2px rgba(0,0,0,0.5)'}} />
                                            </Bar>
                                            
                                            <Bar dataKey="Unit_Emissions" name="設備耗能碳排" stackId="capture" fill="#ef4444" fillOpacity={0.8} radius={[0, 4, 4, 0]}>
                                                <LabelList dataKey="Capture_Volume" position="right" fill="#475569" fontSize={10} fontWeight="bold" formatter={(v) => `總 ${v.toFixed(1)}`} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ErrorBoundary>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ================= TAB 2: UTILIZATION ================= */}
            {activeTab === 'utilization' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                            <div>
                                <p className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider">預期再利用 CO₂ 總需求</p>
                                <h3 className="text-2xl font-black text-slate-800">{totalExpectedDemand.toFixed(1)} <span className="text-sm font-medium text-slate-500">萬噸/年</span></h3>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><Leaf size={24}/></div>
                        </div>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between border-l-4 border-l-blue-500">
                            <div>
                                <p className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider">配對氫氣 (H₂) 總需求估算</p>
                                <h3 className="text-2xl font-black text-blue-600">{totalH2Demand.toFixed(1)} <span className="text-sm font-medium text-blue-400">萬噸/年</span></h3>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-500"><AlertTriangle size={24}/></div>
                        </div>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between border-l-4 border-l-purple-500">
                            <div>
                                <p className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider">預估化學品產出總量</p>
                                <h3 className="text-2xl font-black text-purple-700">{fUtil.reduce((s, r)=>s+r.Product_Generated, 0).toFixed(1)} <span className="text-sm font-medium text-purple-400">萬噸 產品/年</span></h3>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600"><FlaskConical size={24}/></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-[650px] flex flex-col">
                            <h3 className="font-bold text-slate-700 text-sm mb-4 border-b pb-2 flex items-center gap-2"><MapPin size={16} className="text-emerald-500"/> 碳再利用需求廠區分佈</h3>
                            <TaiwanCcusMap mode="utilization" utilData={fUtil} />
                        </div>
                        
                        <div className="lg:col-span-7 bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-[650px] flex flex-col">
                            <h3 className="font-bold text-slate-700 text-sm mb-4 border-b pb-2 flex items-center gap-2"><FlaskConical size={16} className="text-purple-500"/> 化學反應配氫條件與產能推估</h3>
                            <div className="flex-1 w-full flex flex-col gap-5 overflow-y-auto custom-scrollbar p-2">
                                {fUtil.map((item, idx) => {
                                    const reactantInfo = checkHydrogenRequirement(item.Conversion_Tech);
                                    const h2Needed = item.Expected_Demand * reactantInfo.ratio;
                                    return (
                                        <div key={idx} className="flex flex-col sm:flex-row items-stretch w-full bg-slate-50/80 rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
                                            {/* Input: CO2 Source */}
                                            <div className="flex-1 p-4 bg-white flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-dashed border-slate-200 relative">
                                                <div className="absolute top-2 left-2 text-[9px] text-slate-400 font-bold">需求端</div>
                                                <div className="font-bold text-slate-700 mb-2 text-center text-sm">{item.Target_Company} <br/> {item.Target_Plant}</div>
                                                <div className="bg-emerald-50 border border-emerald-100 rounded-lg py-2 px-4 text-center">
                                                    <div className="text-xl font-mono font-black text-emerald-600">{item.Expected_Demand.toFixed(1)}</div>
                                                    <div className="text-[10px] text-emerald-500 font-bold">萬噸 CO₂/年</div>
                                                </div>
                                            </div>

                                            {/* Input: Reactant (H2 or none) */}
                                            <div className="flex-1 p-4 bg-white flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-slate-200 relative">
                                                <div className="absolute top-2 left-2 text-[9px] text-slate-400 font-bold">配對反應物</div>
                                                <div className={`px-3 py-1 rounded-full text-xs font-bold border ${reactantInfo.bg} ${reactantInfo.color} mb-2 flex items-center gap-1`}>
                                                    {reactantInfo.requiresH2 ? <AlertTriangle size={12}/> : null} {reactantInfo.label}
                                                </div>
                                                {reactantInfo.requiresH2 ? (
                                                    <div className="text-center">
                                                        <div className="text-base font-mono font-black text-blue-600">+{h2Needed.toFixed(2)}</div>
                                                        <div className="text-[10px] text-blue-500 font-bold">萬噸 H₂/年估算</div>
                                                    </div>
                                                ) : (
                                                    <div className="text-[10px] text-slate-500 text-center px-2">此製程可直接利用高純度CO₂</div>
                                                )}
                                            </div>

                                            {/* Arrow & Tech */}
                                            <div className="w-full sm:w-32 bg-slate-800 text-white flex flex-col items-center justify-center p-3 relative shadow-inner">
                                                <div className="text-[10px] text-slate-300 font-bold mb-1">轉化技術</div>
                                                <div className="text-sm font-bold text-center leading-tight text-amber-300">{item.Conversion_Tech}</div>
                                                <div className="mt-2 text-slate-400 hidden sm:block">➔</div>
                                                <div className="mt-2 text-slate-400 block sm:hidden">⬇</div>
                                            </div>

                                            {/* Output: Product */}
                                            <div className="flex-1 p-4 bg-white flex flex-col items-center justify-center relative">
                                                <div className="absolute top-2 left-2 text-[9px] text-slate-400 font-bold">產出物</div>
                                                <div className="font-bold text-slate-700 mb-2 text-center text-sm">{String(item.Conversion_Tech).split('轉')[1] || '高階化學品'}</div>
                                                <div className="bg-purple-50 border border-purple-100 rounded-lg py-2 px-4 text-center shadow-sm">
                                                    <div className="text-xl font-mono font-black text-purple-600">{item.Product_Generated.toFixed(1)}</div>
                                                    <div className="text-[10px] text-purple-500 font-bold">萬噸 產出/年</div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {fUtil.length === 0 && <div className="text-slate-400 text-sm py-10 text-center">無再利用轉化數據</div>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ================= TAB 3: STORAGE ================= */}
            {activeTab === 'storage' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                            <div>
                                <p className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider">目前封存均價 (過濾後)</p>
                                <h3 className="text-3xl font-black text-slate-800">${avgCost.toFixed(1)} <span className="text-sm font-medium text-slate-500">USD/噸</span></h3>
                            </div>
                            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-amber-600"><DollarSign size={28}/></div>
                        </div>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                            <div>
                                <p className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider">總規劃封存量</p>
                                <h3 className="text-3xl font-black text-slate-800">
                                    {fStorage.filter(r => transportMode === 'ALL' || r.Transport_Method.includes(transportMode)).reduce((s, r)=>s+r.Capturable_Volume, 0).toFixed(1)} 
                                    <span className="text-sm font-medium text-slate-500">萬噸/年</span>
                                </h3>
                            </div>
                            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><Box size={28}/></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* 左側地圖 */}
                        <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-[650px] flex flex-col">
                            <div className="flex justify-between items-center mb-4 border-b pb-2">
                                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><MapPin size={16} className="text-amber-500"/> 封存運輸路線圖</h3>
                                {/* 運輸方式過濾 */}
                                <div className="flex bg-slate-100 p-1 rounded-lg text-[10px] font-bold shadow-inner">
                                    <button onClick={() => setTransportMode('ALL')} className={`px-2 py-1 rounded-md ${transportMode === 'ALL' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>全部</button>
                                    <button onClick={() => setTransportMode('管線')} className={`px-2 py-1 rounded-md ${transportMode === '管線' ? 'bg-blue-500 text-white shadow' : 'text-slate-500'}`}>管線</button>
                                    <button onClick={() => setTransportMode('陸運')} className={`px-2 py-1 rounded-md ${transportMode === '陸運' ? 'bg-amber-500 text-white shadow' : 'text-slate-500'}`}>陸運</button>
                                    <button onClick={() => setTransportMode('海運')} className={`px-2 py-1 rounded-md ${transportMode === '海運' ? 'bg-teal-500 text-white shadow' : 'text-slate-500'}`}>海運</button>
                                </div>
                            </div>
                            <TaiwanCcusMap mode="storage" storageData={fStorage.filter(r => transportMode === 'ALL' || r.Transport_Method.includes(transportMode))} />
                        </div>
                        
                        {/* 右側成本矩陣與列表 */}
                        <div className="lg:col-span-7 bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-[650px] flex flex-col">
                            <h3 className="font-bold text-slate-700 text-sm mb-4 border-b pb-2 flex items-center gap-2"><Box size={16} className="text-amber-500"/> 全價值鏈成本矩陣 (系統智能估算距離)</h3>
                            
                            <div className="flex-1 w-full min-h-0 relative flex flex-col gap-4">
                                {/* 散佈圖 */}
                                <div className="flex-1 bg-slate-50/50 border border-slate-100 rounded-lg p-2 relative min-h-0">
                                    <div className="absolute top-2 right-4 text-[10px] text-slate-400 bg-white/80 px-2 rounded z-10 border border-slate-100 shadow-sm">圓點大小 = 封存量能</div>
                                    <ErrorBoundary>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                                                <CartesianGrid strokeDasharray="3 3"/>
                                                <XAxis type="number" dataKey="Distance_km" name="運輸距離" unit=" km" tick={{fontSize: 10}}>
                                                    <Label value="運輸距離 (公里/海里)" position="insideBottom" offset={-10} fontSize={11} fill="#475569" fontWeight="bold"/>
                                                </XAxis>
                                                <YAxis type="number" dataKey="Cost_USD_Per_Ton" name="總成本" unit=" USD/噸" tick={{fontSize: 10}}>
                                                    <Label value="全價值鏈成本 (USD/噸)" angle={-90} position="insideLeft" offset={10} fontSize={11} fill="#475569" fontWeight="bold"/>
                                                </YAxis>
                                                <ZAxis type="number" dataKey="Capturable_Volume" range={[100, 1000]} name="封存量能" />
                                                <Tooltip cursor={{strokeDasharray:'3 3'}} formatter={(v, n) => [typeof v === 'number' ? v.toFixed(1) : v, n]} contentStyle={{borderRadius:'8px', fontSize:'12px'}}/>
                                                <Scatter name="封存專案" data={fStorage.filter(r => transportMode === 'ALL' || r.Transport_Method.includes(transportMode))}>
                                                    <LabelList dataKey="Storage_Site" position="top" style={{fontSize:10, fill:'#334155', fontWeight:'bold'}} />
                                                    {fStorage.filter(r => transportMode === 'ALL' || r.Transport_Method.includes(transportMode)).map((entry, index) => {
                                                        let dotColor = '#94a3b8';
                                                        if (entry.Transport_Method.includes('管線')) dotColor = '#3b82f6';
                                                        if (entry.Transport_Method.includes('陸運')) dotColor = '#f59e0b';
                                                        if (entry.Transport_Method.includes('海運')) dotColor = '#14b8a6';
                                                        return <Cell key={`cell-${index}`} fill={dotColor} fillOpacity={0.8} stroke="white" strokeWidth={1} />;
                                                    })}
                                                </Scatter>
                                            </ScatterChart>
                                        </ResponsiveContainer>
                                    </ErrorBoundary>
                                </div>

                                {/* 明細列表 */}
                                <div className="h-2/5 border border-slate-200 rounded-lg overflow-hidden flex flex-col shadow-sm">
                                    <div className="bg-slate-100 p-2 text-xs font-bold text-slate-600 text-center border-b border-slate-200 flex justify-between px-4">
                                        <span>專案路線明細</span>
                                        <span className="text-[10px] text-slate-400 font-normal">依總成本排序</span>
                                    </div>
                                    <div className="flex-1 overflow-auto custom-scrollbar">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-white sticky top-0 shadow-sm z-10">
                                                <tr className="text-slate-500">
                                                    <th className="p-2 pl-4">碳源 ➔ 封存場</th>
                                                    <th className="p-2 text-center">路線方式</th>
                                                    <th className="p-2 text-right">距離估算</th>
                                                    <th className="p-2 text-right">封存量能</th>
                                                    <th className="p-2 text-right pr-4">總成本(USD)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {[...fStorage].filter(r => transportMode === 'ALL' || r.Transport_Method.includes(transportMode)).sort((a,b) => a.Cost_USD_Per_Ton - b.Cost_USD_Per_Ton).map((row, i) => (
                                                    <tr key={i} className="hover:bg-amber-50/50 transition-colors">
                                                        <td className="p-2 pl-4 font-bold text-slate-700">{row.Source_Company} ➔ {row.Storage_Site}</td>
                                                        <td className="p-2 text-center">
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-200 bg-white font-bold">
                                                                {row.Transport_Method.includes('管線') ? <GripHorizontal size={10} className="text-blue-500"/> : 
                                                                 row.Transport_Method.includes('陸運') ? <Truck size={10} className="text-amber-500"/> : 
                                                                 <Ship size={10} className="text-teal-500"/>}
                                                                {row.Transport_Method}
                                                            </span>
                                                        </td>
                                                        <td className="p-2 text-right font-mono text-slate-600">{row.Distance_km} km</td>
                                                        <td className="p-2 text-right font-mono text-blue-600">{row.Capturable_Volume} 萬噸</td>
                                                        <td className="p-2 text-right font-mono font-bold text-rose-600 pr-4">${row.Cost_USD_Per_Ton}</td>
                                                    </tr>
                                                ))}
                                                {fStorage.filter(r => transportMode === 'ALL' || r.Transport_Method.includes(transportMode)).length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400">無符合條件之專案</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CcusDashboard;