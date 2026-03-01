import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ScatterChart, Scatter, ZAxis, Cell, LabelList, ComposedChart, Line, Label
} from 'recharts';
import { 
  Leaf, RefreshCw, Target, Activity, MapPin, DollarSign, Box, AlertTriangle, 
  Truck, Ship, GripHorizontal, FlaskConical, Plus, ZoomIn, ZoomOut, Maximize, Hand, Factory, CheckCircle2, List, Rocket
} from 'lucide-react';

const CCUS_DATA_SOURCES = {
  CAPTURE: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ8aZTek-9SoTaK7Z_Wu9InU2c_vu4cUpD0Nn4fCs-w0IM3XoWeNXK5ZldWoEs6M3G6mJTS6QoF4Mo/pub?gid=388581449&single=true&output=csv',
  UTILIZATION: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ8aZTek-9SoTaK7Z_Wu9InU2c_vu4cUpD0Nn4fCs-w0IM3XoWeNXK5ZldWoEs6M3G6mJTS6QoF4Mo/pub?gid=1496771601&single=true&output=csv',
  STORAGE: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ8aZTek-9SoTaK7Z_Wu9InU2c_vu4cUpD0Nn4fCs-w0IM3XoWeNXK5ZldWoEs6M3G6mJTS6QoF4Mo/pub?gid=1902888591&single=true&output=csv'
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

const parseHydrogenCSV = (text) => {
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

class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { hasError: false }; }
    static getDerivedStateFromError(error) { return { hasError: true }; }
    render() {
      if (this.state.hasError) return <div className="h-full flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded text-slate-400"><AlertTriangle size={32} className="mb-2 text-amber-400" /><p className="text-sm">圖表資料異常，請檢查資料來源格式</p></div>;
      return this.props.children;
    }
}

const TaiwanCcusMap = ({ mode = 'capture', captureData = [], utilData = [], storageData = [] }) => {
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

    return (
        <div className="w-full h-full relative bg-slate-50/80 rounded-lg overflow-hidden border border-slate-200">
            {/* 動態懸浮資訊卡 */}
            <div className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur shadow-2xl rounded-xl border border-slate-200 p-4 transition-all duration-300 w-80 pointer-events-none" style={{ opacity: hoveredNode ? 1 : 0, transform: hoveredNode ? 'translateY(0)' : 'translateY(-10px)' }}>
                {hoveredNode && mode === 'capture' && (
                    <div>
                        <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                            <Factory size={16} className="text-blue-600"/>
                            <h3 className="font-bold text-slate-800 text-sm truncate">{hoveredNode.Company} <span className="text-slate-500 font-medium">{hoveredNode.Plant}</span></h3>
                        </div>
                        <div className="space-y-1.5 text-xs text-slate-600">
                            <div className="flex justify-between items-center"><span className="text-slate-400">來源製程</span> <span className="font-bold text-slate-700">{hoveredNode.Capture_Source || '-'}</span></div>
                            <div className="flex justify-between items-center"><span className="text-slate-400">捕捉技術</span> <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{hoveredNode.Capture_Tech || '-'} (TRL {hoveredNode.TRL})</span></div>
                            <div className="flex justify-between items-center"><span className="text-slate-400">分離技術</span> <span>{hoveredNode.Separation_Tech || '-'}</span></div>
                            
                            <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-100 text-center">
                                <div className="bg-slate-50 rounded py-1"><div className="text-[9px] text-slate-400">溫度</div><div className="font-mono font-bold text-slate-700">{hoveredNode.Temperature || '-'}</div></div>
                                <div className="bg-slate-50 rounded py-1"><div className="text-[9px] text-slate-400">壓力</div><div className="font-mono font-bold text-slate-700">{hoveredNode.Pressure || '-'}</div></div>
                                <div className="bg-slate-50 rounded py-1"><div className="text-[9px] text-slate-400">濃度</div><div className="font-mono font-bold text-slate-700">{hoveredNode.Concentration || '-'}</div></div>
                            </div>
                            
                            <div className="mt-2 bg-blue-50 p-2 rounded-lg border border-blue-100 space-y-1 text-xs">
                                <div className="flex justify-between"><span className="text-slate-500">總捕捉量(A):</span><span className="font-mono font-bold text-slate-700">{hoveredNode.Capture_Volume.toFixed(2)} 萬噸</span></div>
                                <div className="flex justify-between"><span className="text-rose-500">設備耗能(B):</span><span className="font-mono font-bold text-rose-600">-{hoveredNode.Captur_energy.toFixed(2)} 萬噸</span></div>
                                <div className="flex justify-between pt-1 border-t border-blue-200 mt-1"><span className="text-blue-800 font-bold">淨捕捉量(=A-B)</span><span className="font-mono font-black text-blue-700">{hoveredNode.Net_Capture_Volume.toFixed(2)} 萬噸</span></div>
                            </div>
                        </div>

                        {hoveredNode.Potential_Source && (
                            <div className="mt-3 pt-3 border-t border-dashed border-slate-200">
                                <div className="text-[10px] font-bold text-amber-600 mb-2 flex items-center gap-1"><Rocket size={12}/> 未來擴展潛力</div>
                                <div className="space-y-1.5 text-xs text-slate-600">
                                    <div className="flex justify-between items-center"><span className="text-slate-400">潛在來源</span> <span className="font-medium">{hoveredNode.Potential_Source}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-slate-400">排放量能</span> <span className="font-mono font-bold text-amber-700">{hoveredNode.Future_Emission_Volume} 萬噸</span></div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {hoveredNode && mode === 'future' && (
                     <div>
                        <div className="flex items-center gap-2 mb-3 border-b border-amber-100 pb-2">
                            <Rocket size={16} className="text-amber-600"/>
                            <h3 className="font-bold text-slate-800 text-sm truncate">{hoveredNode.Company} <span className="text-slate-500 font-medium">{hoveredNode.Plant}</span></h3>
                        </div>
                        <div className="space-y-1.5 text-xs text-slate-600">
                            <div className="flex justify-between items-center"><span className="text-slate-400">潛在安裝來源</span> <span className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{hoveredNode.Potential_Source || '-'}</span></div>
                            <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-100 text-center">
                                <div className="bg-slate-50 rounded py-1"><div className="text-[9px] text-slate-400">未來溫度</div><div className="font-mono font-bold text-slate-700">{hoveredNode.Future_Temperature || '-'}</div></div>
                                <div className="bg-slate-50 rounded py-1"><div className="text-[9px] text-slate-400">未來壓力</div><div className="font-mono font-bold text-slate-700">{hoveredNode.Future_Pressure || '-'}</div></div>
                                <div className="bg-slate-50 rounded py-1"><div className="text-[9px] text-slate-400">未來濃度</div><div className="font-mono font-bold text-slate-700">{hoveredNode.Future_Concentration || '-'}</div></div>
                            </div>
                            <div className="mt-2 flex justify-between items-center bg-amber-50 p-2 rounded-lg border border-amber-200">
                                <span className="text-amber-800 font-bold">未來總排放潛力</span>
                                <span className="font-mono font-black text-amber-600 text-sm">{hoveredNode.Future_Emission_Volume.toFixed(1)} <span className="text-[10px] font-normal">萬噸</span></span>
                            </div>
                        </div>
                     </div>
                )}

                {hoveredNode && mode === 'utilization' && (
                    <div>
                        <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                            <FlaskConical size={16} className="text-emerald-600"/>
                            <h3 className="font-bold text-slate-800 text-sm truncate">{hoveredNode.Target_Company} <span className="text-slate-500 font-medium">{hoveredNode.Target_Plant}</span></h3>
                        </div>
                        <div className="space-y-1.5 text-xs text-slate-600">
                            <div className="flex justify-between items-center"><span className="text-slate-400">再利用技術</span> <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">{hoveredNode.Conversion_Tech || '-'}</span></div>
                            <div className="flex justify-between items-center"><span className="text-slate-400">成熟度</span> <span className="font-mono bg-slate-100 px-1.5 rounded">TRL {hoveredNode.TRL || '-'}</span></div>
                            
                            <div className="mt-2 flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                                <span className="text-slate-600 font-bold">當前驗證量</span>
                                <span className="font-mono font-black text-slate-700">{hoveredNode.Current_Demand} <span className="text-[10px] font-normal">萬噸</span></span>
                            </div>
                            <div className="mt-1 flex justify-between items-center bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                                <span className="text-emerald-800 font-bold">預期總需求</span>
                                <span className="font-mono font-black text-emerald-600 text-sm">{hoveredNode.Expected_Demand} <span className="text-[10px] font-normal">萬噸</span></span>
                            </div>
                        </div>
                    </div>
                )}

                {hoveredNode && mode === 'storage' && (
                    <div>
                        <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                            <Box size={16} className="text-rose-600"/>
                            <h3 className="font-bold text-slate-800 text-sm truncate">{hoveredNode.Storage_Site}</h3>
                        </div>
                        <div className="space-y-1.5 text-xs text-slate-600">
                            <div className="flex justify-between items-center"><span className="text-slate-400">碳源公司</span> <span className="font-bold text-slate-700">{hoveredNode.Source_Company}</span></div>
                            <div className="flex justify-between items-center"><span className="text-slate-400">製程類別</span> <span>{hoveredNode.Process_Type || '-'}</span></div>
                            <div className="flex justify-between items-center"><span className="text-slate-400">純度濃度</span> <span className="font-mono">{hoveredNode.Concentration || '-'}</span></div>
                            
                            <div className="mt-2 flex justify-between items-center bg-rose-50 p-2 rounded-lg border border-rose-100">
                                <span className="text-rose-800 font-bold">可封存總量</span>
                                <span className="font-mono font-black text-rose-600 text-sm">{hoveredNode.Capturable_Volume} <span className="text-[10px] font-normal">萬噸</span></span>
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

                    {mode === 'future' && captureData.map((d, i) => {
                        const [cx, cy] = projectBase(d.Longitude, d.Latitude);
                        if (cx === -9999) return null;
                        const r = Math.max(6, Math.min(25, Math.sqrt(d.Future_Emission_Volume || 0) * 1.5)) / zoom; 
                        const isHovered = hoveredNode === d;
                        return (
                            <g key={`fut-${i}`} className="cursor-pointer transition-all" onMouseEnter={() => setHoveredNode(d)} onMouseLeave={() => setHoveredNode(null)}>
                                <circle cx={cx} cy={cy} r={Math.max(r, 20/zoom)} fill="transparent" />
                                <circle cx={cx} cy={cy} r={r} fill="#d97706" fillOpacity={isHovered ? 1 : 0.75} stroke="white" strokeWidth={1.5 / zoom} strokeDasharray={`${3/zoom} ${3/zoom}`} />
                                <text x={cx + r + (4/zoom)} y={cy + (3/zoom)} fontSize={11 / textScale} fill="#78350f" fontWeight="900" paintOrder="stroke" stroke="white" strokeWidth={3/textScale} strokeLinejoin="round" className="pointer-events-none">
                                    {d.Company} {zoom > 1.2 && <tspan className="text-slate-500">{d.Plant}</tspan>}
                                </text>
                            </g>
                        );
                    })}

                    {mode === 'utilization' && utilData.map((d, i) => {
                        const findCoords = (c, p) => captureData.find(x => x.Company === c && x.Plant === p) || { Latitude: 23.6, Longitude: 120.9 };
                        const coords = findCoords(d.Target_Company, d.Target_Plant);
                        const [cx, cy] = projectBase(coords.Longitude, coords.Latitude);
                        if (cx === -9999) return null;
                        const r = Math.max(8, Math.min(20, Math.sqrt(d.Expected_Demand || 0) * 2)) / zoom;
                        const isHovered = hoveredNode === d;
                        return (
                            <g key={`util-${i}`} className="cursor-pointer transition-all" onMouseEnter={() => setHoveredNode(d)} onMouseLeave={() => setHoveredNode(null)}>
                                <circle cx={cx} cy={cy} r={Math.max(r, 20/zoom)} fill="transparent" />
                                <circle cx={cx} cy={cy} r={r} fill="#10b981" fillOpacity={isHovered ? 1 : 0.9} stroke="white" strokeWidth={2 / zoom} style={{ filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.3))' }}/>
                                <text x={cx + r + (4/zoom)} y={cy + (3/zoom)} fontSize={11 / textScale} fill="#064e3b" fontWeight="900" paintOrder="stroke" stroke="white" strokeWidth={3/textScale} strokeLinejoin="round" className="pointer-events-none">
                                    {d.Target_Company} {zoom > 1.2 && <tspan>{d.Target_Plant}</tspan>}
                                </text>
                            </g>
                        );
                    })}

                    {mode === 'storage' && storageData.map((d, i) => {
                        const findCoords = (c) => captureData.find(x => x.Company === c) || { Latitude: 23.6, Longitude: 120.9 };
                        const srcCoords = findCoords(d.Source_Company);
                        const [x1, y1] = projectBase(srcCoords.Longitude, srcCoords.Latitude);
                        if (x1 === -9999) return null;
                        const [x2, y2] = projectBase(srcCoords.Longitude - 0.5, srcCoords.Latitude - 0.2); 
                        
                        let strokeDash = "0"; let lineColor = "#3b82f6";
                        if (String(d.Transport_Method).includes('陸運')) { strokeDash = `${6/zoom} ${6/zoom}`; lineColor = "#f59e0b"; } 
                        if (String(d.Transport_Method).includes('海運')) { strokeDash = `${3/zoom} ${6/zoom}`; lineColor = "#14b8a6"; } 
                        
                        const isHovered = hoveredNode === d;

                        return (
                            <g key={`sto-${i}`} className="cursor-pointer transition-all" onMouseEnter={() => setHoveredNode(d)} onMouseLeave={() => setHoveredNode(null)}>
                                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={lineColor} strokeWidth={3 / zoom} strokeDasharray={strokeDash} opacity={isHovered ? 1 : 0.6}/>
                                <circle cx={x1} cy={y1} r={4 / zoom} fill="#64748b" />
                                <circle cx={x2} cy={y2} r={10 / zoom} fill="#ef4444" fillOpacity={isHovered ? 1 : 0.9} stroke="white" strokeWidth={2 / zoom} style={{ filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.3))' }}/>
                                <text x={x2 + (12/zoom)} y={y2 + (4/zoom)} fontSize={12 / textScale} fill="#991b1b" fontWeight="900" paintOrder="stroke" stroke="white" strokeWidth={3/textScale} strokeLinejoin="round" className="pointer-events-none">{d.Storage_Site}</text>
                            </g>
                        );
                    })}
                </g>
            </svg>
            
            <div className="absolute bottom-4 left-4 bg-white/95 p-3 rounded-lg shadow-sm border border-slate-200 text-xs text-slate-700 pointer-events-none backdrop-blur">
                {mode === 'capture' && <div><span className="font-bold text-slate-800">彩色實心圓點:</span> 現有捕捉源 (半徑正比於捕捉量)</div>}
                {mode === 'future' && <div><span className="font-bold text-amber-600">橘色虛線圓點:</span> 未來潛力點源 (半徑正比於潛在排放)</div>}
                {mode === 'utilization' && <div><span className="font-bold text-emerald-700">綠色圓點:</span> 需求廠區 (半徑正比於預期需求)</div>}
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

// 捕捉專用 Tooltip (公式清楚化)
const CaptureTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white/95 backdrop-blur border border-slate-200 p-3 rounded-lg shadow-xl text-xs w-64 pointer-events-auto">
                <p className="font-bold text-slate-800 mb-2 border-b pb-1 flex items-center gap-1"><Factory size={14} className="text-blue-600"/> {data.Label}</p>
                <p className="mb-1 font-bold" style={{color: stringToColor(data.Capture_Tech)}}>技術: {data.Capture_Tech} (TRL {data.TRL})</p>
                <div className="text-slate-600 mb-2 grid grid-cols-2 gap-x-2 gap-y-1 bg-slate-50 p-1.5 rounded">
                   <div>溫度: <span className="font-mono font-bold">{data.Temperature || '-'}</span></div>
                   <div>壓力: <span className="font-mono font-bold">{data.Pressure || '-'}</span></div>
                   <div className="col-span-2">濃度: <span className="font-mono font-bold">{data.Concentration || '-'}</span></div>
                </div>
                
                <div className="bg-blue-50/50 p-2 border border-blue-100 rounded space-y-1">
                    <div className="flex justify-between text-slate-600"><span className="text-slate-500">總捕捉量 (A):</span> <span className="font-mono font-bold">{data.Capture_Volume.toFixed(2)} 萬噸</span></div>
                    <div className="flex justify-between text-rose-600"><span className="text-rose-500">設備耗能 (B):</span> <span className="font-mono font-bold">-{data.Captur_energy.toFixed(2)} 萬噸</span></div>
                    <div className="flex justify-between pt-1 border-t border-blue-200 text-blue-700 font-bold"><span className="text-blue-800">淨捕捉量 (=A-B):</span> <span className="font-mono font-black">{data.Net_Capture_Volume.toFixed(2)} 萬噸</span></div>
                </div>
            </div>
        );
    }
    return null;
};

const CcusDashboard = () => {
    const [activeTab, setActiveTab] = useState('capture');
    const [captureViewMode, setCaptureViewMode] = useState('map'); 
    const [captureData, setCaptureData] = useState([]);
    const [utilizationData, setUtilizationData] = useState([]);
    const [storageData, setStorageData] = useState([]);
    const [loading, setLoading] = useState(true);
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

                const txtCap = await resCap.text();
                const txtUtil = await resUtil.text();
                const txtStore = await resStore.text();

                const rawCap = parseHydrogenCSV(txtCap);
                const rawUtil = parseHydrogenCSV(txtUtil);
                const rawStore = parseHydrogenCSV(txtStore);

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
                        Future_Temperature: d.Future_Temperature || '',
                        Future_Pressure: d.Future_Pressure || '',
                        Future_Concentration: d.Future_Concentration || ''
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
                        Concentration: d.Concentration || '',
                        Process_Type: d.Process_Type || ''
                    };
                }));

            } catch (err) { console.error(err); } finally { setLoading(false); }
        };
        fetchAllData();
    }, []);

    const availableYears = useMemo(() => Array.from(new Set([...captureData.map(d=>d.Year), ...utilizationData.map(d=>d.Year), ...storageData.map(d=>d.Year)])).filter(Boolean).sort(), [captureData, utilizationData, storageData]);
    useEffect(() => { if (availableYears.length > 0 && selectedYear === 'ALL') setSelectedYear(availableYears[availableYears.length - 1]); }, [availableYears]);

    const fCapture = useMemo(() => captureData.filter(d => selectedYear === 'ALL' || d.Year === selectedYear), [captureData, selectedYear]);
    const fUtil = useMemo(() => utilizationData.filter(d => selectedYear === 'ALL' || d.Year === selectedYear), [utilizationData, selectedYear]);
    const fStorage = useMemo(() => storageData.filter(d => selectedYear === 'ALL' || d.Year === selectedYear), [storageData, selectedYear]);

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
                    <button onClick={() => setActiveTab('capture')} className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${activeTab === 'capture' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}><Activity size={16}/> 碳捕捉 (Capture)</button>
                    <button onClick={() => setActiveTab('utilization')} className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${activeTab === 'utilization' ? 'bg-white shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}><FlaskConical size={16}/> 碳再利用 (Utilization)</button>
                    <button onClick={() => setActiveTab('storage')} className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${activeTab === 'storage' ? 'bg-white shadow text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}><Box size={16}/> 碳封存 (Storage)</button>
                </div>
            </div>

            {activeTab === 'capture' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                            <div><p className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider">現行淨捕捉量總和</p><h3 className="text-3xl font-black text-blue-800">{totalCapture.toFixed(1)} <span className="text-sm font-medium text-slate-500">萬噸/年</span></h3></div>
                            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><Leaf size={28}/></div>
                        </div>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                            <div><p className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider">未來擴充潛力總和</p><h3 className="text-3xl font-black text-amber-700">{totalFuturePotential.toFixed(1)} <span className="text-sm font-medium text-slate-500">萬噸/年</span></h3></div>
                            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-amber-600"><Rocket size={28}/></div>
                        </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><MapPin size={16} className="text-blue-500"/> 碳捕捉地圖分佈與工程清單</h3>
                            <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-bold shadow-inner">
                                <button onClick={() => setCaptureViewMode('map')} className={`px-3 py-1.5 rounded-md flex items-center gap-1 ${captureViewMode === 'map' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><MapPin size={14}/> 地圖分佈</button>
                                <button onClick={() => setCaptureViewMode('table_current')} className={`px-3 py-1.5 rounded-md flex items-center gap-1 ${captureViewMode === 'table_current' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><List size={14}/> 🟢 現有捕捉設施</button>
                                <button onClick={() => setCaptureViewMode('table_future')} className={`px-3 py-1.5 rounded-md flex items-center gap-1 ${captureViewMode === 'table_future' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><Rocket size={14}/> 🔮 未來展望潛力</button>
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
                                                <BarChart data={fCapture.filter(r => r.Capture_Volume > 0).sort((a,b) => b.Capture_Volume - a.Capture_Volume)} layout="vertical" margin={{ top: 5, right: 40, left: 40, bottom: 5 }} barGap={2} barSize={26}>
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false}/>
                                                    <XAxis type="number" fontSize={10} unit=" 萬噸"/>
                                                    <YAxis dataKey="Label" type="category" width={140} tick={{fontSize: 11, fill: '#475569', fontWeight: 'bold'}} interval={0}/>
                                                    <Tooltip content={<CaptureTooltip />}/>
                                                    <Legend wrapperStyle={{fontSize:'11px'}} verticalAlign="top"/>
                                                    <Bar dataKey="Net_Capture_Volume" name="淨捕捉量" stackId="capture">
                                                        {fCapture.filter(r => r.Capture_Volume > 0).map((entry, index) => <Cell key={`cell-${index}`} fill={stringToColor(entry.Capture_Tech)} />)}
                                                        <LabelList dataKey="TRL" position="insideLeft" fill="white" fontSize={10} fontWeight="bold" formatter={(v) => `TRL ${v}`} style={{textShadow: '0px 0px 2px rgba(0,0,0,0.5)'}} />
                                                    </Bar>
                                                    <Bar dataKey="Captur_energy" name="設備耗能碳排" stackId="capture" fill="#ef4444" fillOpacity={0.8} radius={[0, 4, 4, 0]}>
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

                        {captureViewMode === 'table_future' && (
                            <div className="flex flex-col lg:flex-row gap-6 h-[650px]">
                                <div className="lg:w-1/3 relative border border-amber-200 rounded-xl overflow-hidden"><TaiwanCcusMap mode="future" captureData={fCapture.filter(r => r.Future_Emission_Volume > 0)} /></div>
                                <div className="lg:w-2/3 overflow-x-auto custom-scrollbar border border-amber-100 rounded-xl">
                                    <table className="w-full text-xs text-left whitespace-nowrap">
                                        <thead className="bg-amber-50 text-amber-800 sticky top-0 shadow-sm z-10 border-b border-amber-200">
                                            <tr>
                                                <th className="p-3">公司廠區</th><th className="p-3">潛在安裝來源</th>
                                                <th className="p-3 text-right">潛在排放量 (萬噸/年)</th><th className="p-3">溫度(℃)</th><th className="p-3">壓力(bar)</th><th className="p-3">濃度(vol%)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-amber-100">
                                            {fCapture.filter(r => r.Potential_Source || r.Future_Emission_Volume > 0).map((row, i) => (
                                                <tr key={i} className="hover:bg-amber-50/50 transition-colors">
                                                    <td className="p-3 font-bold text-slate-700">{row.Label}</td>
                                                    <td className="p-3 font-medium text-amber-700">{row.Potential_Source}</td>
                                                    <td className="p-3 text-right font-mono font-black text-rose-600 text-sm">{row.Future_Emission_Volume.toFixed(1)}</td>
                                                    <td className="p-3 font-mono text-slate-600">{row.Future_Temperature}</td>
                                                    <td className="p-3 font-mono text-slate-600">{row.Future_Pressure}</td>
                                                    <td className="p-3 font-mono text-slate-600">{row.Future_Concentration}</td>
                                                </tr>
                                            ))}
                                            {fCapture.filter(r => r.Potential_Source || r.Future_Emission_Volume > 0).length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">目前尚無未來展望數據</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'utilization' && (
                <div className="space-y-6 animate-fade-in">
                    {/* 地圖優先顯示 */}
                    <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-[500px] flex flex-col">
                            <h3 className="font-bold text-slate-700 text-sm mb-4 border-b pb-2 flex items-center gap-2"><MapPin size={16} className="text-emerald-500"/> 碳再利用需求廠區分佈</h3>
                            <TaiwanCcusMap mode="utilization" utilData={fUtil} captureData={fCapture} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                            <div><p className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider">預期再利用 CO₂ 總需求</p><h3 className="text-2xl font-black text-slate-800">{totalExpectedDemand.toFixed(1)} <span className="text-sm font-medium text-slate-500">萬噸/年</span></h3></div>
                            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><Leaf size={24}/></div>
                        </div>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between border-l-4 border-l-blue-500">
                            <div><p className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider">配對氫氣 (H₂) 總需求估算</p><h3 className="text-2xl font-black text-blue-600">自動推算中... <span className="text-sm font-medium text-blue-400">萬噸</span></h3></div>
                            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-500"><AlertTriangle size={24}/></div>
                        </div>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between border-l-4 border-l-purple-500">
                            <div><p className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider">預估化學品產出總量</p><h3 className="text-2xl font-black text-purple-700">{fUtil.reduce((s, r)=>s+r.Product_Generated, 0).toFixed(1)} <span className="text-sm font-medium text-purple-400">萬噸 產品/年</span></h3></div>
                            <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600"><FlaskConical size={24}/></div>
                        </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                        <h3 className="font-bold text-slate-700 text-sm mb-4 border-b pb-2 flex items-center gap-2"><FlaskConical size={16} className="text-purple-500"/> 碳再利用製程清單與需求明細</h3>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {fUtil.map((item, idx) => {
                                // 判斷是否為開發中技術
                                const trlNum = parseInt(String(item.TRL).split('-')[0]) || 0;
                                const isDeveloping = trlNum < 6 || item.Current_Demand === 0;

                                return (
                                    <div key={idx} className={`flex flex-col sm:flex-row items-stretch w-full rounded-xl border shadow-sm overflow-hidden relative ${isDeveloping ? 'bg-slate-100 border-dashed border-slate-300 opacity-80' : 'bg-slate-50/80 border-slate-200'}`}>
                                        <div className="flex-1 p-4 bg-white flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-dashed border-slate-200 relative">
                                            {isDeveloping && <div className="absolute top-0 right-0 bg-amber-500 text-white text-[9px] font-bold px-2 py-1 rounded-bl-lg shadow-sm">🧪 開發中技術</div>}
                                            <div className="absolute top-2 left-2 text-[9px] text-slate-400 font-bold">需求端</div>
                                            <div className="font-bold text-slate-700 mb-2 text-center text-sm mt-3">{item.Target_Company} <br/> {item.Target_Plant}</div>
                                            <div className="flex gap-2">
                                                <div className="bg-emerald-50 border border-emerald-100 rounded-lg py-1 px-3 text-center">
                                                    <div className="text-lg font-mono font-black text-emerald-600">{item.Expected_Demand.toFixed(1)}</div>
                                                    <div className="text-[9px] text-emerald-500 font-bold">預期 CO₂ 萬噸</div>
                                                </div>
                                                <div className="bg-slate-50 border border-slate-100 rounded-lg py-1 px-3 text-center">
                                                    <div className={`text-lg font-mono font-black ${item.Current_Demand > 0 ? 'text-slate-600' : 'text-slate-300'}`}>{item.Current_Demand.toFixed(1)}</div>
                                                    <div className="text-[9px] text-slate-500 font-bold">當前 CO₂ 萬噸</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`w-full sm:w-36 text-white flex flex-col items-center justify-center p-3 relative shadow-inner ${isDeveloping ? 'bg-slate-600' : 'bg-slate-800'}`}>
                                            <div className="text-[10px] text-slate-300 font-bold mb-1">轉化技術</div>
                                            <div className="text-sm font-bold text-center leading-tight text-amber-300 mb-1">{item.Conversion_Tech}</div>
                                            <div className={`text-[10px] px-2 py-0.5 rounded border ${isDeveloping ? 'bg-rose-900 border-rose-700 text-rose-200' : 'bg-slate-700 border-slate-600 text-amber-100'}`}>TRL {item.TRL}</div>
                                        </div>
                                        <div className="flex-1 p-4 bg-white flex flex-col items-center justify-center relative">
                                            <div className="absolute top-2 left-2 text-[9px] text-slate-400 font-bold">產出估算</div>
                                            <div className="font-bold text-slate-700 mb-2 text-center text-sm">{String(item.Conversion_Tech).split('轉')[1] || '高階化學品'}</div>
                                            <div className="bg-purple-50 border border-purple-100 rounded-lg py-2 px-4 text-center shadow-sm">
                                                <div className="text-xl font-mono font-black text-purple-600">{item.Product_Generated.toFixed(1)}</div>
                                                <div className="text-[10px] text-purple-500 font-bold">萬噸 產品/年</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {fUtil.length === 0 && <div className="text-slate-400 text-sm py-10 text-center col-span-2">無再利用轉化數據</div>}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'storage' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                            <div><p className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider">目前封存均價 (過濾後)</p><h3 className="text-3xl font-black text-slate-800">${avgCost.toFixed(1)} <span className="text-sm font-medium text-slate-500">USD/噸</span></h3></div>
                            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-amber-600"><DollarSign size={28}/></div>
                        </div>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                            <div><p className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider">總規劃封存量</p><h3 className="text-3xl font-black text-slate-800">{fStorage.filter(r => transportMode === 'ALL' || r.Transport_Method.includes(transportMode)).reduce((s, r)=>s+r.Capturable_Volume, 0).toFixed(1)} <span className="text-sm font-medium text-slate-500">萬噸/年</span></h3></div>
                            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><Box size={28}/></div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-[650px] flex flex-col">
                            <div className="flex justify-between items-center mb-4 border-b pb-2">
                                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><MapPin size={16} className="text-amber-500"/> 封存運輸路線圖</h3>
                                <div className="flex bg-slate-100 p-1 rounded-lg text-[10px] font-bold shadow-inner">
                                    <button onClick={() => setTransportMode('ALL')} className={`px-2 py-1 rounded-md ${transportMode === 'ALL' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>全部</button>
                                    <button onClick={() => setTransportMode('管線')} className={`px-2 py-1 rounded-md ${transportMode === '管線' ? 'bg-blue-500 text-white shadow' : 'text-slate-500'}`}>管線</button>
                                    <button onClick={() => setTransportMode('陸運')} className={`px-2 py-1 rounded-md ${transportMode === '陸運' ? 'bg-amber-500 text-white shadow' : 'text-slate-500'}`}>陸運</button>
                                    <button onClick={() => setTransportMode('海運')} className={`px-2 py-1 rounded-md ${transportMode === '海運' ? 'bg-teal-500 text-white shadow' : 'text-slate-500'}`}>海運</button>
                                </div>
                            </div>
                            <TaiwanCcusMap mode="storage" storageData={fStorage.filter(r => transportMode === 'ALL' || r.Transport_Method.includes(transportMode))} captureData={fCapture} />
                        </div>
                        <div className="lg:col-span-7 bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-[650px] flex flex-col">
                            <h3 className="font-bold text-slate-700 text-sm mb-4 border-b pb-2 flex items-center gap-2"><Box size={16} className="text-amber-500"/> 全價值鏈成本矩陣 (系統智能估算距離)</h3>
                            <div className="flex-1 w-full min-h-0 relative flex flex-col gap-4">
                                <div className="flex-1 bg-slate-50/50 border border-slate-100 rounded-lg p-2 relative min-h-0">
                                    <div className="absolute top-2 right-4 text-[10px] text-slate-400 bg-white/80 px-2 rounded z-10 border border-slate-100 shadow-sm">圓點大小 = 封存量能</div>
                                    <ErrorBoundary>
                                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
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
                                <div className="h-2/5 border border-slate-200 rounded-lg overflow-hidden flex flex-col shadow-sm">
                                    <div className="bg-slate-100 p-2 text-xs font-bold text-slate-600 text-center border-b border-slate-200 flex justify-between px-4">
                                        <span>專案路線明細</span><span className="text-[10px] text-slate-400 font-normal">依總成本排序</span>
                                    </div>
                                    <div className="flex-1 overflow-auto custom-scrollbar">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-white sticky top-0 shadow-sm z-10">
                                                <tr className="text-slate-500">
                                                    <th className="p-2 pl-4">碳源 ➔ 封存場</th><th className="p-2 text-center">路線方式</th><th className="p-2 text-right">距離估算</th><th className="p-2 text-right">封存量能</th><th className="p-2 text-right pr-4">總成本(USD)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {[...fStorage].filter(r => transportMode === 'ALL' || r.Transport_Method.includes(transportMode)).sort((a,b) => a.Cost_USD_Per_Ton - b.Cost_USD_Per_Ton).map((row, i) => (
                                                    <tr key={i} className="hover:bg-amber-50/50 transition-colors">
                                                        <td className="p-2 pl-4 font-bold text-slate-700">{row.Source_Company} ➔ {row.Storage_Site}</td>
                                                        <td className="p-2 text-center">
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-200 bg-white font-bold">
                                                                {String(row.Transport_Method).includes('管線') ? <GripHorizontal size={10} className="text-blue-500"/> : String(row.Transport_Method).includes('陸運') ? <Truck size={10} className="text-amber-500"/> : <Ship size={10} className="text-teal-500"/>}
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