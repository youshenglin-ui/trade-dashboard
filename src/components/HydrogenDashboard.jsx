import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, ComposedChart, ScatterChart, Scatter, ZAxis, LabelList, Label
} from 'recharts';
import { 
  Database, Calendar, AlertCircle, Activity, Factory, Leaf, Zap, MapPin, 
  FileText, ZoomIn, ZoomOut, List, Maximize, Hand, Truck, GripHorizontal, RefreshCw, Layers, X
} from 'lucide-react';

const REGION_COLORS = { '北區': '#e0f2fe', '中區': '#d1fae5', '南區': '#fffbeb', '東區': '#f5f3ff', '其他': '#f1f5f9' };
const SOLID_REGION_COLORS = { '北區': '#2563eb', '中區': '#059669', '南區': '#ea580c', '東區': '#7c3aed', '其他': '#475569' };
const REGION_COUNTIES = {
    '北區': ['基隆市', '臺北市', '新北市', '桃園市', '新竹縣', '新竹市', '宜蘭縣', '苗栗二廠'],
    '中區': ['苗栗縣(主)', '臺中市', '彰化縣', '南投縣', '雲林縣'],
    '南區': ['嘉義縣', '嘉義市', '臺南市', '高雄市', '屏東縣'],
    '東區': ['花蓮縣', '臺東縣']
};

export const simplifyCompanyName = (name) => {
  if (!name) return '未知廠商';
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

const getRegionByCounty = (countyName) => {
    const n = String(countyName || '');
    if (n.match(/(基隆|臺北|台北|新北|桃園|新竹|宜蘭)/)) return '北區';
    if (n.match(/(苗栗|臺中|台中|彰化|南投|雲林)/)) return '中區';
    if (n.match(/(嘉義|臺南|台南|高雄|屏東)/)) return '南區';
    if (n.match(/(花蓮|臺東|台東)/)) return '東區';
    return '其他';
};

const getDashboardPlantName = (company, plant) => {
    const c = simplifyCompanyName(company);
    let p = String(plant || '').replace(/股份有限公司|工業區|工業|廠$/g, '') + '廠';
    if (p === '廠') p = '廠區';
    if (c === '中油' && p.includes('石化事業部')) return '中油 石化事業部';
    return `${c} ${p}`;
};

const getIndustrialZone = (plant, company) => {
    const p = String(plant || '').trim();
    const c = String(company || '').trim();
    const full = `${c} ${p}`;
    if (c.includes('台灣化纖') || c.includes('台化') || c.includes('台塑科騰')) return '雲林-麥寮工業區';
    if (full.includes('長春') && (p.includes('二廠') || p.includes('苗栗二'))) return '北部-其他工業區';
    if (c.includes('台灣石化')) return '高雄-大發工業區';
    if ((c.includes('台苯') || c.includes('台灣苯乙烯')) && p.includes('高雄')) return '高雄-林園工業區';
    if (c.includes('李長榮') && p.includes('高雄')) return '高雄-小港工業區';
    if (c.includes('國喬') && p.includes('高雄')) return '高雄-仁武工業區';
    if (full.includes('大發')) return '高雄-大發工業區';
    if (full.includes('林園') || full.includes('大林') || (c.includes('中油') && p.includes('石化事業部'))) return '高雄-林園工業區';
    if (full.includes('小港') || full.includes('臨海') || full.includes('中鋼')) return '高雄-小港工業區';
    if (full.includes('仁武') || full.includes('大社')) return '高雄-仁武工業區';
    if (full.includes('麥寮') || full.includes('六輕') || (c.includes('台塑') && p.includes('麥寮'))) return '雲林-麥寮工業區';
    if (full.includes('彰濱') || full.includes('線西') || full.includes('中龍')) return '彰化-彰濱工業區';
    if (full.includes('桃園') || p.includes('桃煉') || full.includes('觀音') || full.includes('大園')) return '桃園工業區(含桃煉)';
    if (p.includes('頭份') || (c.includes('長春') && p.includes('苗栗'))) return '苗栗-頭份工業區';
    if (full.includes('南科') || full.includes('台積電') || p.includes('18廠')) return '台南-南部科學園區';
    return '其他獨立廠區';
};

const getApproximateCoordinates = (plant, company) => {
    const n = `${String(company || '')} ${String(plant || '')}`;
    if (company.includes('台塑科騰')) return { lat: 23.783, lon: 120.179 };
    if (company.includes('李長榮') && plant.includes('高雄')) return { lat: 22.538, lon: 120.343 }; 
    if ((company.includes('台苯') || company.includes('台灣苯乙烯')) && plant.includes('高雄')) return { lat: 22.493, lon: 120.382 }; 
    if (n.includes('大發') || company.includes('台灣石化')) return { lat: 22.58, lon: 120.40 };
    if (n.includes('林園') || n.includes('大林') || n.includes('石化事業部')) return { lat: 22.51, lon: 120.38 };
    if (n.includes('小港') || n.includes('中鋼') || n.includes('臨海')) return { lat: 22.54, lon: 120.34 };
    if (n.includes('仁武') || n.includes('大社') || n.includes('國喬')) return { lat: 22.70, lon: 120.34 };
    if (n.includes('南科') || n.includes('台積電') || n.includes('善化')) return { lat: 23.10, lon: 120.27 };
    if (n.includes('麥寮') || n.includes('六輕') || company.includes('台灣化纖') || company.includes('台化')) return { lat: 23.78, lon: 120.18 };
    if (n.includes('彰濱') || n.includes('線西') || n.includes('中龍')) return { lat: 24.07, lon: 120.42 };
    if (n.includes('苗栗二') || n.includes('二廠')) return { lat: 24.58, lon: 120.82 }; 
    if (n.includes('頭份') || n.includes('長春') || n.includes('苗栗')) return { lat: 24.68, lon: 120.91 };
    if (n.includes('桃園') || n.includes('觀音') || n.includes('桃煉')) return { lat: 25.03, lon: 121.12 };
    return { lat: 23.6, lon: 120.9 }; 
};

const stringToColor = (str) => {
    const COLORS_POOL = ['#2563eb', '#3b82f6', '#60a5fa', '#059669', '#10b981', '#34d399', '#d97706', '#f59e0b', '#7c3aed', '#8b5cf6', '#dc2626', '#ef4444'];
    if (!str) return COLORS_POOL[0];
    let hash = 0; for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
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

const cleanNumber = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isFinite(val) ? val : 0;
  const num = parseFloat(String(val).replace(/[,%\s]/g, ''));
  return isFinite(num) ? num : 0;
};

// ==========================================
// 地理地圖模組 (Crash Proof)
// ==========================================
const TaiwanH2Map = ({ supplyData = [], demandData = [] }) => {
    const mapRef = useRef(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
    const [mapPaths, setMapPaths] = useState([]);
    
    const [activeSelection, setActiveSelection] = useState(null);
    const [hoveredNode, setHoveredNode] = useState(null);

    const baseWidth = 800, baseHeight = 900, centerLon = 120.9, centerLat = 23.7, baseScale = 380; 
    
    const projectBase = (lon, lat) => {
        if (!lon || !lat || isNaN(lon) || isNaN(lat)) return [-9999, -9999];
        return [(lon - centerLon) * baseScale, -(lat - centerLat) * baseScale * 1.1];
    };

    useEffect(() => {
        fetch('https://raw.githubusercontent.com/g0v/twgeojson/master/json/twCounty2010.geo.json')
            .then(res => res.json())
            .then(data => {
                const paths = data.features.map(f => {
                    let d = '';
                    const pr = (ring) => { if(!ring||ring.length===0)return; const [x,y]=projectBase(ring[0][0],ring[0][1]); if (x === -9999) return; d+=`M${x},${y} `; for(let i=1;i<ring.length;i++){const [lx,ly]=projectBase(ring[i][0],ring[i][1]); d+=`L${lx},${ly} `;} d+='Z '; };
                    if(f.geometry.type==='Polygon') f.geometry.coordinates.forEach(pr); else if(f.geometry.type==='MultiPolygon') f.geometry.coordinates.forEach(p=>p.forEach(pr));
                    return { d, region: getRegionByCounty(f.properties.COUNTYNAME) };
                });
                setMapPaths(paths);
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

    const { finalNodes, flows } = useMemo(() => {
        const plantMap = {};
        const addToMap = (d, isSupply) => {
            const label = d.label || '未知廠區';
            if (!plantMap[label]) {
                const coords = (d.Longitude && d.Latitude) ? { lat: d.Latitude, lon: d.Longitude } : getApproximateCoordinates(d.Plant, d.Company);
                plantMap[label] = {
                    label, Company: d.Company || '', Plant: d.Plant || '', Region: d.Region, 
                    zone: getIndustrialZone(d.Plant, d.Company),
                    baseLat: coords.lat, baseLon: coords.lon,
                    supply: 0, demand: 0, supply_sold: 0, demand_purchased: 0,
                    processes: new Set(), usages: new Set(), intensities: new Set(), sources: new Set(), targets: new Set()
                };
            }
            if (isSupply) {
                plantMap[label].supply += cleanNumber(d.Output_Tons);
                plantMap[label].supply_sold += cleanNumber(d.Trade_Vol);
                if (d.Process) plantMap[label].processes.add(d.Process);
                if (d.Carbon_Intensity) plantMap[label].intensities.add(d.Carbon_Intensity);
                if (d.Trade_Target) plantMap[label].targets.add(d.Trade_Target);
            } else {
                plantMap[label].demand += cleanNumber(d.Demand_Tons);
                plantMap[label].demand_purchased += cleanNumber(d.Trade_Vol);
                if (d.Usage_Type) plantMap[label].usages.add(d.Usage_Type);
                if (d.Source_Company) plantMap[label].sources.add(`${d.Source_Company} ${d.Source_Plant || ''}`.trim());
            }
        };

        supplyData.forEach(d => addToMap(d, true));
        demandData.forEach(d => addToMap(d, false));

        const coordGroups = {};
        Object.values(plantMap).forEach(p => {
            const key = `${p.baseLat.toFixed(3)}_${p.baseLon.toFixed(3)}`;
            if (!coordGroups[key]) coordGroups[key] = [];
            coordGroups[key].push(p);
        });

        const nodesList = [];
        Object.values(coordGroups).forEach(group => {
            if (group.length === 1) {
                group[0].lat = group[0].baseLat; group[0].lon = group[0].baseLon;
                nodesList.push(group[0]);
            } else {
                group.forEach((p, i) => {
                    const layer = Math.floor(i / 6) + 1; const radius = layer * 0.035; 
                    const angle = (i % 6) * (Math.PI / 3) + (layer * 0.2);
                    p.lat = p.baseLat + radius * Math.sin(angle); p.lon = p.baseLon + radius * Math.cos(angle);
                    nodesList.push(p);
                });
            }
        });

        const flowList = [];
        demandData.forEach(d => {
            if (d.Source_Company && d.Trade_Vol > 0) {
                const targetNode = nodesList.find(n => n.label === d.label);
                let sourceNode = nodesList.find(n => n.Company.includes(d.Source_Company) || d.Source_Company.includes(n.Company));
                if (!sourceNode) {
                    const fallbackCoords = getApproximateCoordinates(d.Source_Plant, d.Source_Company);
                    sourceNode = { lat: fallbackCoords.lat, lon: fallbackCoords.lon, label: d.Source_Company };
                }
                if (sourceNode && targetNode) {
                    flowList.push({ source: sourceNode, target: targetNode, value: d.Trade_Vol, method: d.Transport_Method || '槽車' });
                }
            }
        });

        return { finalNodes: nodesList, flows: flowList };
    }, [supplyData, demandData]);

    const handlePlantClick = (node) => setActiveSelection({ type: 'plant', data: node });
    const handleZoneClick = (zoneName) => {
        const zoneNodes = finalNodes.filter(n => n.zone === zoneName);
        if (zoneNodes.length > 0) setActiveSelection({ type: 'zone', name: zoneName, nodes: zoneNodes });
    };

    const textScale = Math.pow(zoom, 0.7); 
    const zoneOpacity = zoom > 1.5 ? 0.7 : (zoom < 1 ? 0.2 : 0.4); 

    const INDUSTRIAL_ZONES_COORDS = [
        { name: '雲林-麥寮工業區', lat: 23.78, lon: 120.18, radius: 24 },
        { name: '高雄-林園工業區', lat: 22.50, lon: 120.38, radius: 18 },
        { name: '高雄-小港工業區', lat: 22.54, lon: 120.34, radius: 18 },
        { name: '高雄-大發工業區', lat: 22.58, lon: 120.40, radius: 16 },
        { name: '高雄-仁武工業區', lat: 22.70, lon: 120.34, radius: 18 },
        { name: '彰化-彰濱工業區', lat: 24.07, lon: 120.42, radius: 20 },
        { name: '苗栗-頭份工業區', lat: 24.68, lon: 120.91, radius: 16 },
        { name: '桃園工業區(含桃煉)', lat: 25.03, lon: 121.12, radius: 26 },
        { name: '台南-南部科學園區', lat: 23.10, lon: 120.27, radius: 16 }
    ];

    return (
        <div className="w-full h-full relative bg-slate-100/80 rounded-xl overflow-hidden border border-slate-200">
            {activeSelection && (
                <div className={`absolute top-4 left-4 z-20 bg-white/95 backdrop-blur shadow-2xl rounded-xl border border-slate-200 p-4 transition-all duration-300 ${activeSelection.type === 'zone' ? 'w-[420px]' : 'w-[320px]'}`}>
                    <button onClick={() => setActiveSelection(null)} className="absolute top-3 right-3 text-slate-400 hover:text-rose-500 bg-slate-100 rounded-full p-1"><X size={14}/></button>
                    {activeSelection.type === 'plant' && (
                        <div>
                            <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2 pr-6">
                                <div className={`w-3 h-3 rounded-full shadow-sm ${activeSelection.data.supply >= activeSelection.data.demand ? 'bg-blue-500' : 'bg-amber-500'}`}></div>
                                <h3 className="font-bold text-slate-800 text-sm truncate">{activeSelection.data.Company} <span className="text-slate-500 font-medium">{activeSelection.data.Plant}</span></h3>
                            </div>
                            <div className="space-y-1.5 text-xs text-slate-600 mb-3">
                                <div className="flex justify-between items-center"><span className="text-slate-400">所屬工業區</span> <span className="font-bold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded truncate max-w-[150px]">{activeSelection.data.zone}</span></div>
                                <div className="flex justify-between items-center"><span className="text-slate-400">製程名稱</span> <span className="font-medium truncate max-w-[150px]">{Array.from(activeSelection.data.processes).join(', ') || '-'}</span></div>
                                <div className="flex justify-between items-center"><span className="text-slate-400">化學用途</span> <span className="font-medium truncate max-w-[150px]">{Array.from(activeSelection.data.usages).join(', ') || '-'}</span></div>
                                <div className="flex justify-between items-center"><span className="text-slate-400">單位碳排</span> <span className="font-mono bg-slate-100 px-1.5 rounded">{Array.from(activeSelection.data.intensities).join(', ') || '-'} kg</span></div>
                            </div>
                            
                            {(activeSelection.data.supply_sold > 0 || activeSelection.data.demand_purchased > 0) && (
                                <div className="mb-3 pt-2 border-t border-dashed border-slate-200 text-[11px] space-y-1 bg-slate-50 p-2 rounded">
                                    {activeSelection.data.supply_sold > 0 && <div className="flex justify-between"><span className="text-blue-600 font-bold">對外銷售: {activeSelection.data.supply_sold.toFixed(1)} 萬噸</span> <span className="truncate max-w-[120px] text-slate-500" title={Array.from(activeSelection.data.targets).join(', ')}>{Array.from(activeSelection.data.targets).join(', ') || '公用網路'}</span></div>}
                                    {activeSelection.data.demand_purchased > 0 && <div className="flex justify-between"><span className="text-amber-600 font-bold">向外採購: {activeSelection.data.demand_purchased.toFixed(1)} 萬噸</span> <span className="truncate max-w-[120px] text-slate-500" title={Array.from(activeSelection.data.sources).join(', ')}>{Array.from(activeSelection.data.sources).join(', ') || '公用網路'}</span></div>}
                                </div>
                            )}

                            <div className="text-[10px] text-slate-500 font-bold mb-1 flex items-center gap-1"><Activity size={12}/> 該廠總量獨立供需 (萬噸)</div>
                            <ResponsiveContainer width="100%" height={160} minWidth={1} minHeight={1}>
                                <BarChart data={[{name: '總產能/量', value: activeSelection.data.supply, fill: '#3b82f6'}, {name: '總氫氣用量', value: activeSelection.data.demand, fill: '#f59e0b'}]} margin={{top: 20, right: 10, bottom: 0, left: -20}}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.5}/>
                                    <XAxis dataKey="name" tick={{fontSize: 11, fontWeight: 'bold'}} axisLine={false} tickLine={false}/>
                                    <YAxis tick={{fontSize: 10}} axisLine={false} tickLine={false}/>
                                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{fontSize: '12px', borderRadius: '8px'}} formatter={(val) => val.toFixed(2)}/>
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                                        {[{name: '總產能/量', value: activeSelection.data.supply, fill: '#3b82f6'}, {name: '總氫氣用量', value: activeSelection.data.demand, fill: '#f59e0b'}].map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                                        <LabelList dataKey="value" position="top" fontSize={11} fontWeight="bold" fill="#475569" formatter={v => v > 0 ? v.toFixed(1) : ''} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                    {activeSelection.type === 'zone' && (
                        <div>
                            <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2 pr-6">
                                <MapPin size={16} className="text-rose-500"/>
                                <h3 className="font-bold text-slate-800 text-sm truncate">{activeSelection.name}</h3>
                                <span className="ml-auto text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold">共 {activeSelection.nodes.length} 廠</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-bold mb-2 flex items-center gap-1"><List size={12}/> 區內廠區總量比較 (萬噸)</div>
                            <ResponsiveContainer width="100%" height={250} minWidth={1} minHeight={1}>
                                <BarChart data={activeSelection.nodes.map(n => ({ name: n.Company, supply: n.supply, demand: n.demand }))} margin={{top: 10, right: 10, bottom: 20, left: -20}}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.5}/>
                                    <XAxis dataKey="name" tick={{fontSize: 10}} interval={0} angle={-30} textAnchor="end" axisLine={false} tickLine={false}/>
                                    <YAxis tick={{fontSize: 10}} axisLine={false} tickLine={false}/>
                                    <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{fontSize: '12px', borderRadius: '8px'}} formatter={(val) => val.toFixed(2)}/>
                                    <Legend wrapperStyle={{fontSize: '10px'}}/>
                                    <Bar dataKey="supply" name="總產量" fill="#3b82f6" radius={[2, 2, 0, 0]} barSize={16}>
                                        <LabelList dataKey="supply" position="top" fontSize={9} fill="#3b82f6" formatter={v => v > 0 ? v.toFixed(1) : ''} />
                                    </Bar>
                                    <Bar dataKey="demand" name="總用量" fill="#f59e0b" radius={[2, 2, 0, 0]} barSize={16}>
                                        <LabelList dataKey="demand" position="top" fontSize={9} fill="#f59e0b" formatter={v => v > 0 ? v.toFixed(1) : ''} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            )}

            {!activeSelection && (
                <div className="absolute top-4 left-4 z-10 bg-white/80 backdrop-blur border border-blue-200 text-blue-800 text-xs px-4 py-2 rounded-lg shadow-sm flex items-center gap-2 animate-pulse">
                    <Hand size={14}/> 點選地圖上的「工業區」或「各廠區圓點」檢視獨立直式柱狀圖
                </div>
            )}

            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-white/95 p-1.5 rounded-lg shadow-sm border border-slate-200 backdrop-blur">
                <button onClick={handleZoomIn} className="p-2 bg-slate-50 hover:bg-slate-200 rounded-md text-slate-600 transition-colors"><ZoomIn size={18}/></button>
                <button onClick={handleZoomOut} className="p-2 bg-slate-50 hover:bg-slate-200 rounded-md text-slate-600 transition-colors"><ZoomOut size={18}/></button>
                <button onClick={handleReset} className="p-2 bg-slate-50 hover:bg-slate-200 rounded-md text-slate-600 transition-colors"><Maximize size={18}/></button>
            </div>

            <svg viewBox={`0 0 ${baseWidth} ${baseHeight}`} className={`w-full h-full select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseLeave} ref={mapRef}>
                <g transform={`translate(${baseWidth/2 + pan.x}, ${baseHeight/2 + pan.y}) scale(${zoom})`}>
                    {mapPaths.map((p, i) => <path key={`map-${i}`} d={p.d} fill={REGION_COLORS[p.region] || '#f8fafc'} stroke="#cbd5e1" strokeWidth={1.5 / zoom} className="transition-colors hover:fill-slate-200" />)}
                    {INDUSTRIAL_ZONES_COORDS.map((zone, idx) => {
                        const [cx, cy] = projectBase(zone.lon, zone.lat);
                        if (cx === -9999) return null;
                        const isSelected = activeSelection?.type === 'zone' && activeSelection?.name === zone.name;
                        return (
                            <g key={`zone-${idx}`} className="cursor-pointer group" onClick={() => handleZoneClick(zone.name)}>
                                <circle cx={cx} cy={cy} r={zone.radius} fill={isSelected ? "#bfdbfe" : "#cbd5e1"} fillOpacity={isSelected ? 0.6 : zoneOpacity * 0.7} stroke={isSelected ? "#3b82f6" : "#94a3b8"} strokeWidth={isSelected ? 2.5 / zoom : 1.5 / zoom} strokeDasharray={isSelected ? "0" : `${4/zoom} ${4/zoom}`} className="transition-all group-hover:stroke-blue-500 group-hover:fill-blue-100" />
                                <text x={cx} y={cy - zone.radius - (4/zoom)} fontSize={11 / textScale} fill={isSelected ? "#1e3a8a" : "#64748b"} fillOpacity={zoom > 1.2 || isSelected ? 1 : 0.6} textAnchor="middle" fontWeight="bold" style={{textShadow: '0 0 4px white'}} className="pointer-events-none transition-colors group-hover:fill-blue-700">{zone.name}</text>
                            </g>
                        );
                    })}
                    {flows.map((f, i) => {
                        const [x1, y1] = projectBase(f.source.lon, f.source.lat);
                        const [x2, y2] = projectBase(f.target.lon, f.target.lat);
                        if (x1 === -9999 || x2 === -9999) return null;
                        const isPipe = f.method.includes('管線');
                        let opacity = 0.35;
                        if (activeSelection?.type === 'plant' && (activeSelection.data.label === f.source.label || activeSelection.data.label === f.target.label)) opacity = 1;
                        else if (activeSelection?.type === 'zone' && activeSelection.nodes.some(n => n.label === f.source.label || n.label === f.target.label)) opacity = 0.9;
                        else opacity = 0.55;

                        return (
                            <g key={`flow-${i}`} className="transition-opacity" style={{ opacity }}>
                                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={isPipe ? "#3b82f6" : "#f59e0b"} strokeWidth={isPipe ? 4/zoom : 3.5/zoom} strokeDasharray={isPipe ? "0" : `${10/zoom} ${8/zoom}`} />
                                <circle cx={x1} cy={y1} r={4 / zoom} fill={isPipe ? "#3b82f6" : "#f59e0b"} />
                            </g>
                        );
                    })}
                    {finalNodes.map((n, i) => {
                        const [cx, cy] = projectBase(n.lon, n.lat);
                        if (cx === -9999) return null;
                        const maxVal = Math.max(n.supply, n.demand, 0.1);
                        const r = Math.max(6, Math.min(22, Math.sqrt(maxVal) * 1.5)) / zoom;
                        const isSupplyDominant = n.supply >= n.demand;
                        const fillColor = isSupplyDominant ? "#3b82f6" : "#f59e0b";
                        const strokeColor = isSupplyDominant ? "#1d4ed8" : "#d97706";
                        const isSelected = activeSelection?.type === 'plant' && activeSelection.data.label === n.label;
                        const isHovered = hoveredNode === n.label;
                        
                        return (
                            <g key={`node-${i}`} className="cursor-pointer transition-all" onClick={() => handlePlantClick(n)} onMouseEnter={() => setHoveredNode(n.label)} onMouseLeave={() => setHoveredNode(null)}>
                                <circle cx={cx} cy={cy} r={Math.max(r, 24 / zoom)} fill="transparent" /> 
                                <circle cx={cx} cy={cy} r={r} fill={isSelected || isHovered ? strokeColor : fillColor} fillOpacity={isSelected || isHovered ? 1 : 0.85} stroke="white" strokeWidth={1.5 / zoom} />
                                <text x={cx + (isSupplyDominant ? -r - (6/zoom) : r + (6/zoom))} y={cy - (2/zoom)} fontSize={11 / textScale} fill={isSelected || isHovered ? "#0f172a" : "#334155"} fontWeight="900" textAnchor={isSupplyDominant ? "end" : "start"} className="pointer-events-none transition-all">
                                    <tspan x={cx + (isSupplyDominant ? -r - (6/zoom) : r + (6/zoom))} dy={0} paintOrder="stroke" stroke="white" strokeWidth={3.5/textScale} strokeLinejoin="round">{n.Company}</tspan>
                                    <tspan x={cx + (isSupplyDominant ? -r - (6/zoom) : r + (6/zoom))} dy={14/textScale} paintOrder="stroke" stroke="white" strokeWidth={3.5/textScale} strokeLinejoin="round" fill="#64748b">{n.Plant}</tspan>
                                </text>
                            </g>
                        );
                    })}
                </g>
            </svg>
            <div className="absolute bottom-4 right-4 bg-white/95 p-3 rounded-lg shadow-sm border border-slate-200 text-[10px] text-slate-700 pointer-events-none backdrop-blur">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500 border border-white shadow"></div> 淨產出廠區 (產量≥用量)</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500 border border-white shadow"></div> 淨消耗廠區 (用量&gt;產量)</div>
                    <div className="flex items-center gap-2"><div className="w-6 h-1.5 bg-blue-500"></div> 外購流向 (管線)</div>
                    <div className="flex items-center gap-2"><div className="w-6 h-0 border-t-4 border-amber-500 border-dashed"></div> 外購流向 (槽車)</div>
                </div>
            </div>
        </div>
    );
};

const StackedTrendChart = ({ data, keys, title, icon: Icon, unit = '萬噸' }) => {
    const [zoomOthers, setZoomOthers] = useState(false);
    const [activeBar, setActiveBar] = useState(null); 
    
    const sortedAllKeys = useMemo(() => {
        const sums = {};
        keys.forEach(k => sums[k] = 0);
        data.forEach(row => keys.forEach(k => sums[k] += (row[k] || 0)));
        return Object.entries(sums).sort((a,b) => b[1] - a[1]).map(i => i[0]);
    }, [data, keys]);

    const top3KeysToHide = sortedAllKeys.slice(0, 3);
    const displayKeys = zoomOthers ? sortedAllKeys.filter(k => !top3KeysToHide.includes(k)) : sortedAllKeys;

    const CustomStackTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            let valid = payload.filter(p => p.value > 0).sort((a, b) => b.value - a.value);
            if (activeBar) {
                const activeItem = valid.find(p => p.dataKey === activeBar);
                if (activeItem) valid = [activeItem, ...valid.filter(p => p.dataKey !== activeBar)];
            }
            return (
                <div className="bg-white/95 backdrop-blur-sm p-3 border border-slate-200 rounded-lg shadow-xl text-xs max-h-64 overflow-y-auto custom-scrollbar w-56 pointer-events-auto">
                    <p className="font-bold text-slate-800 mb-2 border-b border-slate-200 pb-1 sticky top-0 bg-white/95 z-10">{label} 年</p>
                    {valid.map((p, i) => {
                        const isHovered = activeBar === p.dataKey;
                        return (
                            <div key={i} className={`flex justify-between gap-2 mb-1 items-center p-1.5 rounded-md transition-colors ${isHovered ? 'bg-blue-100 ring-1 ring-blue-300' : ''}`}>
                                <span className="flex items-center gap-1.5 flex-1 min-w-0">
                                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{backgroundColor: p.color}}></span>
                                    <span className={`truncate ${isHovered ? 'font-bold text-blue-900' : 'font-medium text-slate-700'}`} title={p.name}>{p.name}</span>
                                </span>
                                <span className={`font-mono ${isHovered ? 'font-black text-blue-700' : 'font-bold text-slate-600'}`}>{p.value.toFixed(2)}</span>
                            </div>
                        );
                    })}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><Icon size={16} className={title.includes('需求') ? 'text-amber-500' : 'text-blue-500'}/> {title}</h3>
                <button onClick={() => setZoomOthers(!zoomOthers)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${zoomOthers ? 'bg-amber-100 text-amber-700 border border-amber-200 shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {zoomOthers ? <ZoomOut size={14}/> : <ZoomIn size={14}/>}
                    {zoomOthers ? '恢復全景' : '放大微小量 (隱藏 Top 3)'}
                </button>
            </div>
            <div className="flex-1 min-h-0 w-full h-full relative">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
                        <XAxis dataKey="year" tick={{fontSize:12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                        <YAxis label={{ value: unit, angle: -90, position: 'insideLeft', offset: 15, fontSize: 11, fill: '#94a3b8' }} tick={{fontSize:11, fill: '#64748b'}} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomStackTooltip />} cursor={{fill: '#f8fafc'}} wrapperStyle={{ zIndex: 50, pointerEvents: 'auto' }}/>
                        <Legend wrapperStyle={{fontSize:'10px', paddingTop: '10px'}} />
                        {displayKeys.map((k) => (
                            <Bar key={k} dataKey={k} stackId="a" fill={stringToColor(k)} name={k} radius={[0, 0, 0, 0]} onMouseEnter={() => setActiveBar(k)} onMouseLeave={() => setActiveBar(null)}>
                                <LabelList dataKey={k} position="center" fill="white" fontSize={11} fontWeight="bold" formatter={(v) => v >= 1 ? v.toFixed(1) : ''} style={{ textShadow: '0 0 3px rgba(0,0,0,0.8)' }} />
                            </Bar>
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const PlantYAxisTick = ({ x, y, payload, data }) => {
    const item = data.find(d => d.name === payload.value);
    const zone = item ? item.zone : '';
    return (
        <g transform={`translate(${x},${y})`}>
            <text x={-5} y={-6} textAnchor="end" fill="#334155" fontSize={11} fontWeight="bold">{payload.value}</text>
            <text x={-5} y={8} textAnchor="end" fill="#64748b" fontSize={9}>{zone}</text>
        </g>
    );
};

const renderTrendLegend = (props) => {
    const { payload } = props;
    const uniqueZones = new Map();
    payload.forEach(entry => {
        const match = entry.value.match(/(.+) \((供給|需求)\)/);
        const zoneName = match ? match[1] : entry.value;
        if (!uniqueZones.has(zoneName)) uniqueZones.set(zoneName, stringToColor(zoneName));
    });
    
    return (
        <div className="flex flex-col items-center gap-1 text-[10px] pt-3">
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mb-1.5 max-w-full">
                {Array.from(uniqueZones.entries()).map(([name, color]) => (
                    <span key={name} className="flex items-center gap-1 text-slate-600 font-medium"><span className="w-2.5 h-2.5 rounded-sm" style={{backgroundColor: color}}></span>{name}</span>
                ))}
            </div>
            <div className="flex justify-center gap-6 text-slate-500 border-t border-slate-200 pt-2 w-full mt-1">
                <span className="flex items-center gap-1.5 font-bold"><div className="w-3 h-3 bg-slate-500 rounded-sm"></div>深色：原產量/原用量</span>
                <span className="flex items-center gap-1.5 font-bold"><div className="w-3 h-3 bg-slate-500/30 border border-slate-500 rounded-sm"></div>淺色：可外售/需外購</span>
            </div>
        </div>
    );
};

const RegionalDeepDive = ({ supplyData, demandData, globalYear }) => {
    const [activeRegion, setActiveRegion] = useState('南區');
    const [activeTab, setActiveTab] = useState('charts'); 
    const regions = ['北區', '中區', '南區', '東區'];

    const { plantDetails, summary, yearlyTrend, activeSupplyZones, activeDemandZones } = useMemo(() => {
        let totalSupply = 0;
        let totalDemand = 0;
        const plantMap = {};
        const trendMap = {};
        const supplyZonesSet = new Set();
        const demandZonesSet = new Set();

        const processRow = (d, isSupply) => {
            const r = d.Region || '其他';
            if (r !== activeRegion) return;
            
            const name = d.label || getDashboardPlantName(d.Company, d.Plant);
            const zone = getIndustrialZone(d.Plant, d.Company);
            // 只加原本的產能與需求
            const val = isSupply ? (d.Output_Tons || 0) : (d.Demand_Tons || 0);

            const y = d.Year;
            if (!trendMap[y]) trendMap[y] = { year: y };
            const trendKey = isSupply ? `${zone}_supply` : `${zone}_demand`;
            trendMap[y][trendKey] = (trendMap[y][trendKey] || 0) + val;
            
            if (isSupply) supplyZonesSet.add(zone);
            else demandZonesSet.add(zone);

            if (globalYear === 'ALL' || d.Year === globalYear) {
                if (!plantMap[name]) {
                    plantMap[name] = { 
                        name, company: simplifyCompanyName(d.Company), zone, 
                        supply: 0, demand: 0, total: 0,
                        supply_sold: 0, demand_purchased: 0
                    };
                }
                if (isSupply) { 
                    plantMap[name].supply += val; 
                    plantMap[name].supply_sold += (d.Trade_Vol || 0);
                    totalSupply += val; 
                } else { 
                    plantMap[name].demand += val; 
                    plantMap[name].demand_purchased += (d.Trade_Vol || 0);
                    totalDemand += val; 
                }
                plantMap[name].total += val;
            }
        };

        supplyData.forEach(d => processRow(d, true));
        demandData.forEach(d => processRow(d, false));

        Object.values(plantMap).forEach(p => {
            p.supply_self = Math.max(0, p.supply - p.supply_sold);
            p.demand_self = Math.max(0, p.demand - p.demand_purchased);
            if (p.supply_sold === 0 && p.supply > p.demand && p.demand > 0) p.supply_sold = p.supply - p.demand;
            if (p.demand_purchased === 0 && p.demand > p.supply && p.supply > 0) p.demand_purchased = p.demand - p.supply;
        });

        const trendData = Object.values(trendMap).sort((a,b) => a.year.localeCompare(b.year));
        let filteredPlants = Object.values(plantMap).filter(p => p.supply > 0.1 || p.demand > 0.1);
        if (filteredPlants.length === 0) filteredPlants = Object.values(plantMap);
        filteredPlants = filteredPlants.sort((a,b) => b.total - a.total).slice(0, 10);
        
        const gap = totalSupply - totalDemand;
        let conclusion = "";
        if (totalSupply === 0 && totalDemand === 0) conclusion = "此區間無顯著數據。";
        else if (gap > 2) conclusion = `供給充裕 (餘裕 ${gap.toFixed(1)} 萬噸)。產能足以支撐需求，可調度支援他區。`;
        else if (gap < -2) conclusion = `需求大於供給 (缺口 ${Math.abs(gap).toFixed(1)} 萬噸)。高度依賴跨區調度或外部氫源。`;
        else conclusion = "供需大致平衡。產能與使用量緊密咬合，需確保產線穩定。";

        return { 
            plantDetails: filteredPlants, 
            summary: { totalSupply, totalDemand, gap, conclusion },
            yearlyTrend: trendData,
            activeSupplyZones: Array.from(supplyZonesSet),
            activeDemandZones: Array.from(demandZonesSet)
        };
    }, [supplyData, demandData, activeRegion, globalYear]);

    const DeepDiveTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white/95 backdrop-blur-sm p-3 border border-slate-200 rounded-lg shadow-xl text-xs">
                    <p className="font-bold text-slate-800 mb-2 border-b pb-1">{label}</p>
                    {payload.map((entry, index) => {
                        let nameLabel = ''; let isDashed = false;
                        if (entry.dataKey === 'supply_self') nameLabel = '廠內保留/自用產量';
                        if (entry.dataKey === 'supply_sold') { nameLabel = '對外銷售產量'; isDashed = true; }
                        if (entry.dataKey === 'demand_self') nameLabel = '廠內自產自用消耗';
                        if (entry.dataKey === 'demand_purchased') { nameLabel = '外部採購需求'; isDashed = true; }
                        if (entry.value === 0) return null;
                        return (
                            <div key={index} className="flex justify-between gap-4 mb-1">
                                <span className="flex items-center gap-1.5" style={{ color: entry.fill !== 'transparent' ? entry.fill : entry.stroke }}>
                                    <span className={`w-2 h-2 ${isDashed ? 'border border-dashed' : ''}`} style={{ backgroundColor: entry.fill !== 'transparent' ? entry.fill : 'transparent', borderColor: entry.stroke }}></span>
                                    {nameLabel}
                                </span>
                                <span className="font-mono font-bold text-slate-700">{entry.value.toFixed(2)} 萬噸</span>
                            </div>
                        );
                    })}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="flex flex-col h-full w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><Layers size={16} className="text-rose-500"/> 區域深度解析 (含工業區與外購售評估)</h3>
                    <div className="flex bg-slate-200/60 p-1 rounded-lg text-xs font-bold shadow-inner">
                        <button onClick={() => setActiveTab('charts')} className={`px-3 py-1.5 rounded-md flex items-center gap-1 transition-all ${activeTab === 'charts' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}><Activity size={14}/> 數據圖表</button>
                        <button onClick={() => setActiveTab('map')} className={`px-3 py-1.5 rounded-md flex items-center gap-1 transition-all ${activeTab === 'map' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}><MapPin size={14}/> 基礎設施地圖</button>
                    </div>
                </div>
                {activeTab === 'charts' && (
                    <div className="flex gap-1 bg-slate-200/50 p-1 rounded-lg">
                        {regions.map(r => (
                            <button key={r} onClick={() => setActiveRegion(r)} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeRegion === r ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{r}</button>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto">
                {activeTab === 'charts' && (
                    <div className="flex gap-4">
                        <div className="flex-1 bg-blue-50 border border-blue-100 p-3 rounded-lg flex flex-col justify-center">
                            <div className="text-[10px] text-blue-600 font-bold uppercase mb-1">涵蓋縣市與區域</div>
                            <div className="text-xs text-slate-700 font-medium leading-relaxed">{REGION_COUNTIES[activeRegion].join('、')}</div>
                        </div>
                        <div className={`flex-1 p-3 rounded-lg border flex flex-col justify-center ${summary.gap >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                            <div className={`text-[10px] font-bold uppercase mb-1 ${summary.gap >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>區域供需現況總結 ({globalYear})</div>
                            <div className="text-xs text-slate-700 font-medium leading-relaxed">{summary.conclusion}</div>
                        </div>
                    </div>
                )}

                {activeTab === 'charts' ? (
                    <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-[400px]">
                        <div className="lg:w-5/12 flex flex-col border border-slate-100 rounded-lg p-2 relative min-h-[300px] bg-slate-50/50">
                            <div className="text-xs font-bold text-slate-500 mb-2 text-center">該區歷年供需趨勢 (依工業區分佈)</div>
                            <div className="flex-1 min-h-0 w-full h-full relative">
                                {yearlyTrend.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                        <BarChart data={yearlyTrend} margin={{top: 10, right: 10, left: -20, bottom: 20}} barGap={4}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="year" tick={{fontSize: 10}} axisLine={false} tickLine={false}/>
                                            <YAxis tick={{fontSize: 10}} axisLine={false} tickLine={false}/>
                                            <Tooltip wrapperStyle={{fontSize: '11px'}} cursor={{fill: '#e2e8f0', opacity: 0.4}} formatter={(val, name) => [val.toFixed(2), name]}/>
                                            <Legend content={renderTrendLegend}/>
                                            
                                            {activeSupplyZones.map(zone => (
                                                <Bar key={`${zone}_supply`} dataKey={`${zone}_supply`} name={`${zone} (供給)`} stackId="supply" fill={stringToColor(zone)} barSize={22}>
                                                    <LabelList dataKey={`${zone}_supply`} position="center" fill="white" fontSize={9} formatter={v => v >= 0.5 ? v.toFixed(1) : ''} style={{ textShadow: '0px 0px 2px rgba(0,0,0,0.5)' }} />
                                                </Bar>
                                            ))}
                                            
                                            {activeDemandZones.map(zone => (
                                                <Bar key={`${zone}_demand`} dataKey={`${zone}_demand`} name={`${zone} (需求)`} stackId="demand" fill={stringToColor(zone)} fillOpacity={0.35} stroke={stringToColor(zone)} strokeWidth={1} barSize={22}>
                                                    <LabelList dataKey={`${zone}_demand`} position="center" fill="#1e293b" fontSize={9} fontWeight="bold" formatter={v => v >= 0.5 ? v.toFixed(1) : ''} />
                                                </Bar>
                                            ))}
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (<div className="h-full flex items-center justify-center text-xs text-slate-400">無歷年數據</div>)}
                            </div>
                        </div>

                        <div className="lg:w-7/12 flex flex-col border border-slate-100 rounded-lg p-2 min-h-[300px]">
                            <div className="text-xs font-bold text-slate-500 mb-2 text-center flex items-center justify-center gap-1">
                                <List size={12}/> {globalYear} 重點廠區：保留產量、外購(透明虛線)、外售(淺藍虛線) 評估
                            </div>
                            <div className="flex-1 min-h-0 w-full h-full relative">
                                {plantDetails.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                        <BarChart data={plantDetails} layout="vertical" margin={{top: 5, right: 40, left: 20, bottom: 20}} barGap={4}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                            <XAxis type="number" fontSize={10} unit="萬噸"/>
                                            <YAxis dataKey="name" type="category" width={130} interval={0} tick={<PlantYAxisTick data={plantDetails} />} />
                                            <Tooltip cursor={{fill: '#f8fafc'}} content={<DeepDiveTooltip />} />
                                            <Legend wrapperStyle={{fontSize: '10px'}} verticalAlign="top" formatter={(value) => {
                                                if (value === 'supply_self') return '保留產量 (自用)';
                                                if (value === 'supply_sold') return '外售產量';
                                                if (value === 'demand_self') return '廠內消耗需求';
                                                if (value === 'demand_purchased') return '外購氫氣需求';
                                                return value;
                                            }}/>
                                            
                                            <Bar dataKey="supply_self" name="supply_self" stackId="supply" fill="#3b82f6" barSize={12} />
                                            <Bar dataKey="supply_sold" name="supply_sold" stackId="supply" fill="#bfdbfe" stroke="#3b82f6" strokeDasharray="2 2" barSize={12} radius={[0, 4, 4, 0]}>
                                                <LabelList position="right" fill="#2563eb" fontSize={9} fontWeight="bold" formatter={v => v > 0 ? `售 ${v.toFixed(1)}` : ''} />
                                            </Bar>

                                            <Bar dataKey="demand_self" name="demand_self" stackId="demand" fill="#f59e0b" barSize={12} />
                                            <Bar dataKey="demand_purchased" name="demand_purchased" stackId="demand" fill="transparent" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 4" barSize={12} radius={[0, 4, 4, 0]}>
                                                <LabelList position="right" fill="#d97706" fontSize={9} fontWeight="bold" formatter={v => v > 0 ? `購 ${v.toFixed(1)}` : ''} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (<div className="h-full flex items-center justify-center text-xs text-slate-400">無廠區數據</div>)}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 min-h-[600px] -mx-4 -mb-4">
                        <TaiwanH2Map supplyData={supplyData.filter(d => (globalYear === 'ALL' || d.Year === globalYear))} demandData={demandData.filter(d => (globalYear === 'ALL' || d.Year === globalYear))} />
                    </div>
                )}
            </div>
        </div>
    );
};

const TechBalanceChart = ({ supplyData, demandData }) => {
    const groupByRegion = (data, valueKey) => {
        const map = { '北區': 0, '中區': 0, '南區': 0, '東區': 0 };
        data.forEach(d => {
            const r = d.Region || '其他';
            if (map[r] !== undefined) map[r] += (cleanNumber(d[valueKey]) || 0);
        });
        return Object.entries(map).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
    };

    const sData = groupByRegion(supplyData, 'Output_Tons');
    const dData = groupByRegion(demandData, 'Demand_Tons');

    const totalS = sData.reduce((a,b)=>a+b.value, 0);
    const totalD = dData.reduce((a,b)=>a+b.value, 0);
    const gap = totalS - totalD;

    return (
        <div className="relative w-full h-full flex flex-col items-center justify-center py-2">
            <div className="relative w-full flex-1 min-h-[140px] z-10 flex items-end justify-center -mb-2">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <PieChart margin={{top: 20, bottom: 0}}>
                        <Pie data={sData.length > 0 ? sData : [{name: '無資料', value: 1}]} cx="50%" cy="100%" startAngle={180} endAngle={0} innerRadius="55%" outerRadius="90%" dataKey="value" stroke="white" strokeWidth={2}>
                            {(sData.length > 0 ? sData : [{name: '無資料', value: 1}]).map((entry, index) => <Cell key={`cell-${index}`} fill={sData.length > 0 ? (SOLID_REGION_COLORS[entry.name] || '#3b82f6') : '#cbd5e1'} />)}
                            {sData.length > 0 && <LabelList dataKey="name" position="outside" offset={10} fill="#475569" fontSize={11} fontWeight="bold" stroke="none" />}
                        </Pie>
                        <Tooltip formatter={(val) => val.toFixed(1) + ' 萬噸'} />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute bottom-1 left-0 w-full text-center pointer-events-none">
                    <span className="bg-white/90 backdrop-blur px-2 py-0.5 rounded text-blue-700 font-bold text-xs shadow-sm">總產量 {totalS.toFixed(1)}</span>
                </div>
            </div>
            <div className="z-20 bg-white/95 backdrop-blur-md px-6 py-2 rounded-2xl shadow-lg border border-slate-100 text-center relative mx-auto my-1">
                <div className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-0.5">供需平衡</div>
                <div className={`text-2xl font-black font-mono leading-none ${gap >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {gap > 0 ? '+' : ''}{gap.toFixed(1)}
                </div>
            </div>
            <div className="relative w-full flex-1 min-h-[140px] mt-2">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <PieChart margin={{top: 0, bottom: 20}}>
                        <Pie data={dData.length > 0 ? dData : [{name: '無資料', value: 1}]} cx="50%" cy="0%" startAngle={180} endAngle={360} innerRadius="55%" outerRadius="90%" dataKey="value" stroke="white" strokeWidth={2}>
                            {(dData.length > 0 ? dData : [{name: '無資料', value: 1}]).map((entry, index) => <Cell key={`cell-${index}`} fill={dData.length > 0 ? (SOLID_REGION_COLORS[entry.name] || '#f59e0b') : '#cbd5e1'} />)}
                            {dData.length > 0 && <LabelList dataKey="name" position="outside" offset={10} fill="#475569" fontSize={11} fontWeight="bold" stroke="none" />}
                        </Pie>
                        <Tooltip formatter={(val) => val.toFixed(1) + ' 萬噸'} />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1 left-0 w-full text-center pointer-events-none">
                    <span className="bg-white/90 backdrop-blur px-2 py-0.5 rounded text-amber-700 font-bold text-xs shadow-sm">總需求 {totalD.toFixed(1)}</span>
                </div>
            </div>
        </div>
    );
};

const StructureAnalysis = ({ data, typeField, valueField, categoryFn, colorMap }) => {
    const { l1, l2, total } = useMemo(() => {
        const totalVal = data.reduce((acc, curr) => acc + (cleanNumber(curr[valueField]) || 0), 0);
        const l1Map = {};
        const l2Map = {};

        data.forEach(d => {
            const name = d[typeField] || 'Unknown';
            const identifiedName = typeField === 'Process' ? identifyProcess(name) : identifyUsage(name);
            const category = categoryFn(identifiedName);
            const val = cleanNumber(d[valueField]) || 0;
            if(!l1Map[category]) l1Map[category] = 0;
            l1Map[category] += val;
            if(!l2Map[identifiedName]) l2Map[identifiedName] = { name: identifiedName, value: 0, category };
            l2Map[identifiedName].value += val;
        });

        const safePercent = (val, tot) => tot > 0 ? Number(((val / tot) * 100).toFixed(1)) : 0;
        const l1Arr = Object.entries(l1Map).map(([name, value]) => ({ name, value, percent: safePercent(value, totalVal) })).sort((a,b)=>b.value-a.value);
        const l2Arr = Object.values(l2Map).map(item => ({ ...item, percent: safePercent(item.value, totalVal), parentShare: safePercent(item.value, l1Map[item.category]) })).sort((a,b)=>b.value-a.value);

        return { l1: l1Arr, l2: l2Arr, total: totalVal };
    }, [data, typeField, valueField]);

    const renderOuterLabel = ({ cx, cy, midAngle, outerRadius, name, percent, value }) => {
        if (value <= 0) return null;
        const RADIAN = Math.PI / 180;
        const radius = outerRadius * 1.15;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);
        return (
            <text x={x} y={y} fill="#475569" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={10} fontWeight="bold">
                {name} {percent}%
            </text>
        );
    };

    if (total === 0) return <div className="h-full flex items-center justify-center text-slate-400 text-sm">無足夠數據進行結構分析</div>;

    return (
        <div className="flex h-full gap-4 pb-2">
            <div className="w-1/2 h-full relative min-h-[250px] flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <PieChart>
                        <Pie data={l1} dataKey="value" cx="50%" cy="50%" outerRadius="45%" stroke="white" strokeWidth={2}>
                            {l1.map((e, i) => <Cell key={i} fill={colorMap[e.name] || '#94a3b8'} />)}
                            <LabelList dataKey="percent" position="inside" fill="white" fontSize={11} fontWeight="bold" formatter={v => v > 5 ? `${v}%` : ''} />
                        </Pie>
                        <Pie data={l2} dataKey="value" cx="50%" cy="50%" innerRadius="55%" outerRadius="80%" stroke="none" label={renderOuterLabel} labelLine={{stroke: '#cbd5e1'}}>
                            {l2.map((e, i) => <Cell key={i} fill={colorMap[e.name] || '#94a3b8'} fillOpacity={0.8} />)}
                        </Pie>
                        <Tooltip formatter={(v) => `${Number(v).toFixed(2)} 萬噸`} />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none bg-white/80 backdrop-blur rounded-full w-14 h-14 flex flex-col items-center justify-center shadow-inner">
                    <div className="text-[10px] text-slate-500 font-bold leading-none">Total</div>
                    <div className="text-sm font-black text-slate-800 leading-tight mt-0.5">{total.toFixed(0)}</div>
                </div>
            </div>

            <div className="w-1/2 h-full overflow-y-auto custom-scrollbar border border-slate-100 rounded-lg min-h-0">
                <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-slate-100 z-10 shadow-sm">
                        <tr className="text-slate-500">
                            <th className="py-2 pl-3 font-bold">類別 / 細項</th>
                            <th className="py-2 text-right font-bold">佔比</th>
                            <th className="py-2 text-right pr-3 font-bold">萬噸</th>
                        </tr>
                    </thead>
                    <tbody>
                        {l1.map(cat => (
                            <React.Fragment key={cat.name}>
                                <tr className="bg-white font-bold text-slate-700 border-b border-slate-100">
                                    <td className="py-2.5 pl-3 flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded shadow-sm flex-shrink-0" style={{backgroundColor: colorMap[cat.name] || '#94a3b8'}}></span>
                                        <span className="truncate">{cat.name}</span>
                                    </td>
                                    <td className="py-2.5 text-right font-mono text-blue-600">{cat.percent}%</td>
                                    <td className="py-2.5 pr-3 text-right font-mono">{cat.value.toFixed(1)}</td>
                                </tr>
                                {l2.filter(sub => sub.category === cat.name).map(sub => (
                                    <tr key={sub.name} className="bg-slate-50/50 border-b border-slate-50 hover:bg-blue-50/50 transition-colors">
                                        <td className="py-2 pl-8 text-slate-600 flex items-center gap-1.5 truncate max-w-[120px]" title={sub.name}>
                                            <div className="w-1 h-1 rounded-full bg-slate-400 flex-shrink-0"></div>
                                            <span className="truncate">{sub.name}</span>
                                        </td>
                                        <td className="py-2 text-right font-mono text-[10px] text-slate-500">{sub.percent}%</td>
                                        <td className="py-2 pr-3 text-right font-mono text-slate-600">{sub.value.toFixed(1)}</td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const HydrogenDashboard = () => {
  const [supplyData, setSupplyData] = useState([]);
  const [demandData, setDemandData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [viewMode, setViewMode] = useState('dashboard');
  const [statusMsg, setStatusMsg] = useState('');
  const [rawData, setRawData] = useState({ supply: [], demand: [] }); 

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [resP, resU] = await Promise.all([
          fetch(H2_DATA_SOURCES.PRODUCTION),
          fetch(H2_DATA_SOURCES.USAGE)
        ]);

        if (!resP.ok || !resU.ok) throw new Error("Network Error");

        const txtP = await resP.text();
        const txtU = await resU.text();
        
        const fixTaihua = (r) => {
            if (r['公司']?.includes('化纖') && r['廠區']?.includes('台北')) {
                r['廠區'] = '麥寮廠'; r['區域'] = '中區';
            }
            return r;
        };

        const parsedP = parseHydrogenCSV(txtP).map(fixTaihua);
        const parsedU = parseHydrogenCSV(txtU).map(fixTaihua);
        
        setRawData({ supply: parsedP, demand: parsedU });

        const normP = normalizeHydrogenData(parsedP, 'supply');
        const normU = normalizeHydrogenData(parsedU, 'demand');

        if (normP.length === 0 && normU.length === 0) throw new Error("Normalization Empty");

        const extractExtraFields = (normalizedArr, rawArr, type) => {
            return normalizedArr.map(n => {
                const match = rawArr.find(r => simplifyCompanyName(r['Company'] || r['公司'] || r['廠商']) === simplifyCompanyName(n.Company) && 
                                              (r['Plant'] || r['廠區'] || r['工廠'] || '').includes(n.Plant.replace(/廠$/, '')));
                
                const volKey = type === 'supply' ? `${n.Year}_外售量` : `${n.Year}_外購量`;
                const targetKey = type === 'supply' ? `${n.Year}_外售對象` : `${n.Year}_外購對象`;
                const baseKey = type === 'supply' ? `${n.Year}_產量` : `${n.Year}_用量`;
                
                const baseVol = match ? cleanNumber(match[baseKey]) : cleanNumber(type === 'supply' ? n.Output_Tons : n.Demand_Tons);
                const tradeVol = match ? cleanNumber(match[volKey]) : 0;
                let tradeTarget = match ? (match[targetKey] || '') : '';
                
                if (type === 'supply') {
                    n.Output_Tons = baseVol; 
                    n.Trade_Vol = tradeVol;
                    n.Trade_Target = tradeTarget;
                } else {
                    n.Demand_Tons = baseVol; 
                    n.Trade_Vol = tradeVol;
                    n.Trade_Target = tradeTarget;
                }

                return {
                    ...n,
                    label: `${simplifyCompanyName(n.Company)} ${n.Plant}`,
                    Region: getRefinedRegion(n.Plant, n.Company),
                    Latitude: match ? cleanNumber(match.Latitude || match['緯度']) : 0,
                    Longitude: match ? cleanNumber(match.Longitude || match['經度']) : 0,
                    ...(type === 'demand' ? {
                        Source_Company: match ? (match['外購來源公司'] || match['外購來源'] || match.Source_Company || '') : '',
                        Source_Plant: match ? (match['外購來源廠區'] || match.Source_Plant || '') : '',
                        Transport_Method: match ? (match['運輸方式'] || match.Transport_Method || '') : ''
                    } : {})
                };
            }).map(n => {
                if (type === 'demand' && n.Trade_Vol > 0 && !n.Source_Company) {
                    n.Source_Company = '公用網路';
                }
                return n;
            });
        };

        setSupplyData(extractExtraFields(normP, parsedP, 'supply'));
        setDemandData(extractExtraFields(normU, parsedU, 'demand'));
        setIsFallback(false);
        setStatusMsg(`成功載入: 供給 ${normP.length} 筆, 需求 ${normU.length} 筆`);

      } catch (e) {
        console.error("Using Mock Data", e);
        setSupplyData(normalizeHydrogenData(MOCK_SUPPLY_MATRIX, 'supply').map(d => ({...d, Region: getRefinedRegion(d.Plant, d.Company), label: getDashboardPlantName(d.Company, d.Plant)})));
        setDemandData(normalizeHydrogenData(MOCK_DEMAND_MATRIX, 'demand').map(d => ({...d, Region: getRefinedRegion(d.Plant, d.Company), label: getDashboardPlantName(d.Company, d.Plant)})));
        setIsFallback(true);
        setStatusMsg(`使用備用資料 (原因: ${e.message})`);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const availableYears = useMemo(() => {
      const years = new Set([...supplyData.map(d => d.Year), ...demandData.map(d => d.Year)]);
      return Array.from(years).sort();
  }, [supplyData, demandData]);

  useEffect(() => {
      if (availableYears.length > 0 && selectedYear === 'ALL') {
          setSelectedYear(availableYears[availableYears.length - 1]);
      }
  }, [availableYears]);

  const filteredSupply = useMemo(() => supplyData.filter(d => (selectedYear === 'ALL' || d.Year === selectedYear)), [supplyData, selectedYear]);
  const filteredDemand = useMemo(() => demandData.filter(d => (selectedYear === 'ALL' || d.Year === selectedYear)), [demandData, selectedYear]);

  const { supplyTrend, demandTrend } = useMemo(() => {
      const processStack = (data, valueKey, labelFn) => {
          const map = {};
          const keysSet = new Set();
          data.forEach(d => {
              const y = d.Year;
              let k = labelFn(d) || '未知';
              if(!map[y]) map[y] = { year: y };
              map[y][k] = (map[y][k] || 0) + (cleanNumber(d[valueKey]) || 0);
              keysSet.add(k);
          });
          return { data: Object.values(map).sort((a,b)=>a.year-b.year), keys: Array.from(keysSet) };
      };

      return {
          supplyTrend: processStack(supplyData, 'Output_Tons', d => d.label),
          demandTrend: processStack(demandData, 'Demand_Tons', d => d.label)
      };
  }, [supplyData, demandData]);

  const efficiencyChartData = useMemo(() => {
      const plantMap = {};
      filteredSupply.forEach(d => {
          const key = d.label;
          if(!plantMap[key]) plantMap[key] = { name: key, output: 0, total_emission: 0, intensity: 0 };
          plantMap[key].output += (cleanNumber(d.Output_Tons) || 0);
          const currentIntensity = cleanNumber(d.Carbon_Intensity) || 0;
          if (currentIntensity > 0) plantMap[key].intensity = currentIntensity; 
          plantMap[key].total_emission += (cleanNumber(d.Output_Tons) || 0) * currentIntensity;
      });
      return Object.values(plantMap).filter(d => d.output > 0 && d.intensity > 0);
  }, [filteredSupply]);

  if (loading) return <div className="p-10 text-center animate-pulse text-blue-600 flex flex-col items-center"><RefreshCw className="animate-spin mb-2"/> 氫能資料載入中...</div>;

  return (
    <div className="space-y-8 p-4 bg-slate-50 rounded-lg animate-fade-in relative min-h-screen">
       <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Factory className="text-blue-600"/> 氫能供需戰情室</h2>
              <div className="flex items-center gap-2 text-sm bg-slate-100 px-3 py-1 rounded-full">
                  <Calendar size={14}/>
                  <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="bg-transparent font-bold text-blue-700 outline-none">
                      {availableYears.map(y => <option key={y} value={y}>{y}年</option>)}
                      <option value="ALL">全年度彙總</option>
                  </select>
              </div>
           </div>
           <div className="flex items-center gap-3">
             <span className="text-xs text-slate-400">{statusMsg}</span>
             <div className="flex bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setViewMode('dashboard')} className={`px-3 py-1.5 text-xs font-bold rounded-md ${viewMode==='dashboard'?'bg-white shadow text-blue-600':'text-slate-500'}`}>儀表板</button>
                <button onClick={() => setViewMode('data')} className={`px-3 py-1.5 text-xs font-bold rounded-md ${viewMode==='data'?'bg-white shadow text-blue-600':'text-slate-500'}`}>原始資料</button>
             </div>
           </div>
       </div>

       {viewMode === 'dashboard' ? (
           <>
             {/* Row 1: Supply/Demand Trends & Balance */}
             <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                 <div className="lg:col-span-2 min-h-[400px] w-full relative">
                     <StackedTrendChart data={supplyTrend.data} keys={supplyTrend.keys} title="歷年產量來源 (公司廠區)" icon={Database} />
                 </div>
                 
                 <div className="lg:col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center h-[400px]">
                     <h3 className="font-bold text-slate-700 text-sm mb-2 flex items-center gap-2">區域供需平衡 ({selectedYear})</h3>
                     <div className="flex-1 w-full min-h-0 relative">
                         <TechBalanceChart supplyData={filteredSupply} demandData={filteredDemand} />
                     </div>
                 </div>

                 <div className="lg:col-span-2 min-h-[400px] w-full relative">
                     <StackedTrendChart data={demandTrend.data} keys={demandTrend.keys} title="歷年用量流向 (公司廠區)" icon={Activity} />
                 </div>
             </div>

             {/* Row 2: Structure Analysis (Pies) */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
                     <h3 className="font-bold text-slate-700 text-sm mb-4 border-b pb-2 flex items-center gap-2"><Database size={16} className="text-blue-500"/> 供給結構詳細分析 ({selectedYear})</h3>
                     <div className="flex-1 min-h-0 w-full relative">
                        <StructureAnalysis data={filteredSupply} typeField="Process" valueField="Output_Tons" categoryFn={getProcessType} colorMap={COLORS_PROCESS} />
                     </div>
                 </div>

                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
                     <h3 className="font-bold text-slate-700 text-sm mb-4 border-b pb-2 flex items-center gap-2"><Activity size={16} className="text-amber-500"/> 需求結構詳細分析 ({selectedYear})</h3>
                     <div className="flex-1 min-h-0 w-full relative">
                        <StructureAnalysis data={filteredDemand} typeField="Usage_Type" valueField="Demand_Tons" categoryFn={getUsageCategory} colorMap={COLORS_USAGE} />
                     </div>
                 </div>
             </div>

             {/* Row 3: Scatter Matrix */}
             <div className="grid grid-cols-1 gap-6">
                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[450px]">
                     <h3 className="font-bold text-slate-700 text-sm mb-4 border-b pb-2 flex items-center gap-2"><Leaf size={14}/> 碳排強度矩陣 (產量 Log Scale) & 產能對照 ({selectedYear})</h3>
                     <div className="flex-1 min-h-0 flex gap-4 w-full relative">
                         
                         <div className="flex-1 h-full relative border border-slate-100 rounded-lg p-2 bg-slate-50/50 min-h-0">
                            <div className="absolute top-2 right-4 text-[10px] text-slate-400 bg-white/80 px-2 rounded z-10">圓點大小 = 總碳排量</div>
                            <ErrorBoundary>
                                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                    <ScatterChart margin={{top:20, right:20, bottom:30, left:20}}>
                                        <CartesianGrid strokeDasharray="3 3"/>
                                        <XAxis type="number" dataKey="output" name="產量" unit="萬噸" scale="log" domain={['auto', 'auto']} tick={{fontSize:10, fill:'#64748b'}}>
                                            <Label value="產量 (萬噸) - 指數級距" offset={-20} position="insideBottom" fontSize={11} fill="#475569" fontWeight="bold"/>
                                        </XAxis>
                                        <YAxis type="number" dataKey="intensity" name="強度" unit="kg/kg" domain={[0, 'auto']} tick={{fontSize:10, fill:'#64748b'}}>
                                            <Label value="碳排強度 (kg CO2e / kg H2)" angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} offset={10} fontSize={11} fill="#475569" fontWeight="bold"/>
                                        </YAxis>
                                        <ZAxis type="number" dataKey="total_emission" range={[50, 600]} />
                                        <Tooltip cursor={{strokeDasharray:'3 3'}} formatter={(v, n) => [v.toLocaleString(), n === 'output' ? '產量(萬噸)' : n === 'intensity' ? '強度' : '總碳排']} contentStyle={{fontSize:'12px', borderRadius:'8px'}}/>
                                        <Scatter name="廠區" data={efficiencyChartData}>
                                            <LabelList dataKey="name" position="top" style={{fontSize:10, fill:'#475569', fontWeight: 'bold'}} />
                                            {efficiencyChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.intensity > 15 ? '#ef4444' : entry.intensity > 8 ? '#f59e0b' : '#10b981'} fillOpacity={0.7} stroke="white" strokeWidth={1}/>
                                            ))}
                                        </Scatter>
                                    </ScatterChart>
                                </ResponsiveContainer>
                            </ErrorBoundary>
                         </div>
                         
                         <div className="flex-1 h-full border border-slate-100 rounded-lg p-2 min-h-0 relative">
                            <ErrorBoundary>
                                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                     <ComposedChart data={efficiencyChartData} margin={{top:20, right:20, bottom:40, left:0}}>
                                         <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                         <XAxis dataKey="name" angle={-35} textAnchor="end" height={60} tick={{fontSize:10, fill:'#64748b'}} interval={0}/>
                                         <YAxis yAxisId="left" tick={{fontSize:10, fill:'#64748b'}}/>
                                         <YAxis yAxisId="right" orientation="right" tick={{fontSize:10, fill:'#64748b'}}/>
                                         <Tooltip contentStyle={{fontSize:'12px', borderRadius:'8px'}}/>
                                         <Legend wrapperStyle={{fontSize:'11px'}} verticalAlign="top"/>
                                         <Bar yAxisId="left" dataKey="output" name="產量 (萬噸)" fill="#3b82f6" barSize={20} radius={[2,2,0,0]}/>
                                         <Line yAxisId="right" type="monotone" dataKey="intensity" name="碳排強度" stroke="#ef4444" strokeWidth={3} dot={{r:4, fill:'#ef4444', stroke:'white'}}/>
                                     </ComposedChart>
                                </ResponsiveContainer>
                            </ErrorBoundary>
                         </div>

                     </div>
                 </div>
             </div>

             {/* Row 4: 區域深度解析 (移至最下方並加上分頁 Tab) */}
             <div className="grid grid-cols-1 gap-6">
                 <div className="h-[750px]">
                     <RegionalDeepDive supplyData={supplyData} demandData={demandData} globalYear={selectedYear} />
                 </div>
             </div>
           </>
       ) : (
           <div className="p-6 bg-white rounded-xl shadow overflow-auto h-[600px]">
               <h3 className="font-bold mb-4">原始數據檢視與診斷</h3>
               <div className="grid grid-cols-2 gap-6">
                   <ErrorBoundary>
                       <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col h-[500px]">
                           <div className="p-3 bg-slate-50 border-b font-bold text-slate-700">供給端原始資料</div>
                           <div className="overflow-auto flex-1">
                               <table className="w-full text-xs text-left whitespace-nowrap">
                                   <thead className="bg-slate-100 sticky top-0"><tr>{rawData.supply.length > 0 && Object.keys(rawData.supply[0]).map(h=><th key={h} className="p-2 border-b">{h}</th>)}</tr></thead>
                                   <tbody className="divide-y divide-slate-50">{rawData.supply.map((row, i) => <tr key={i} className="hover:bg-blue-50">{Object.values(row).map((v,j)=><td key={j} className="p-2">{v}</td>)}</tr>)}</tbody>
                               </table>
                           </div>
                       </div>
                   </ErrorBoundary>
                   <ErrorBoundary>
                       <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col h-[500px]">
                           <div className="p-3 bg-slate-50 border-b font-bold text-slate-700">需求端原始資料</div>
                           <div className="overflow-auto flex-1">
                               <table className="w-full text-xs text-left whitespace-nowrap">
                                   <thead className="bg-slate-100 sticky top-0"><tr>{rawData.demand.length > 0 && Object.keys(rawData.demand[0]).map(h=><th key={h} className="p-2 border-b">{h}</th>)}</tr></thead>
                                   <tbody className="divide-y divide-slate-50">{rawData.demand.map((row, i) => <tr key={i} className="hover:bg-blue-50">{Object.values(row).map((v,j)=><td key={j} className="p-2">{v}</td>)}</tr>)}</tbody>
                               </table>
                           </div>
                       </div>
                   </ErrorBoundary>
               </div>
           </div>
       )}
    </div>
  );
};

export default HydrogenDashboard;