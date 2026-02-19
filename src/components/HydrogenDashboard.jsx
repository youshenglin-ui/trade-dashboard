import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, ComposedChart, ScatterChart, Scatter, ZAxis, LabelList, Label
} from 'recharts';
import { 
  Database, Calendar, AlertCircle, Activity, Factory, Leaf, Zap, MapPin, 
  FileText, ZoomIn, ZoomOut, List
} from 'lucide-react';
import { 
  normalizeHydrogenData, parseHydrogenCSV, getRegion as getBasicRegion, 
  simplifyCompanyName, getSimplePlantName, getProcessType, identifyProcess, 
  identifyUsage, getUsageCategory, stringToColor
} from '../utils/helpers';
import { H2_DATA_SOURCES, MOCK_SUPPLY_MATRIX, MOCK_DEMAND_MATRIX, COLORS_PROCESS, COLORS_USAGE } from '../utils/constants';
import { CustomXAxisTick, ErrorBoundary } from './SharedComponents';

// --- Region Constants ---
const REGION_COLORS = {
    '北區': '#3b82f6', // Blue
    '中區': '#10b981', // Emerald
    '南區': '#f59e0b', // Amber
    '東區': '#8b5cf6', // Violet
    '其他': '#94a3b8'  // Slate
};

const REGION_COUNTIES = {
    '北區': ['基隆市', '臺北市', '新北市', '桃園市', '新竹縣', '新竹市', '宜蘭縣'],
    '中區': ['苗栗縣', '臺中市', '彰化縣', '南投縣', '雲林縣'],
    '南區': ['嘉義縣', '嘉義市', '臺南市', '高雄市', '屏東縣'],
    '東區': ['花蓮縣', '臺東縣']
};

// --- Refined Logic ---
const getRefinedRegion = (plantName, companyName) => {
    const p = String(plantName || '').trim();
    const c = String(companyName || '').trim();
    if (c.includes('大連') && p.includes('大發')) return '南區'; 
    if (c.includes('中油')) {
        if (p.includes('大林') || p.includes('石化') || p.includes('林園')) return '南區'; 
        if (p.includes('桃園')) return '北區';
    }
    if (c.includes('台灣化纖') && (p.includes('台北') || p.includes('麥寮'))) return '中區'; 
    if (c.includes('台灣石化') || c.includes('台苯')) return '南區';
    if (c.includes('台塑科騰') || (c.includes('台塑') && p.includes('麥寮'))) return '中區';
    return getBasicRegion(plantName);
};

// --- Custom Components ---

// 1. Interactive Stacked Trend Chart with Zoom functionality
const StackedTrendChart = ({ data, keys, title, icon: Icon, unit = '萬噸' }) => {
    const [zoomOthers, setZoomOthers] = useState(false);
    
    // 按總量由大到小排序 keys
    const sortedAllKeys = useMemo(() => {
        const sums = {};
        keys.forEach(k => sums[k] = 0);
        data.forEach(row => keys.forEach(k => sums[k] += (row[k] || 0)));
        return Object.entries(sums).sort((a,b) => b[1] - a[1]).map(i => i[0]);
    }, [data, keys]);

    const top3KeysToHide = sortedAllKeys.slice(0, 3);
    const displayKeys = zoomOthers ? sortedAllKeys.filter(k => !top3KeysToHide.includes(k)) : sortedAllKeys;
    const currentTop5Keys = displayKeys.slice(0, 5); // 永遠抓取當前顯示清單的前 5 大

    // Clean Tooltip: Removes 0 values, sorts by value
    const CustomStackTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const valid = payload.filter(p => p.value > 0).sort((a, b) => b.value - a.value);
            return (
                <div className="bg-white/95 backdrop-blur-sm p-3 border border-slate-200 rounded-lg shadow-xl text-xs max-h-64 overflow-y-auto custom-scrollbar min-w-[150px]">
                    <p className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-2">{label} 年</p>
                    {valid.map((p, i) => (
                        <div key={i} className="flex justify-between gap-4 mb-1.5 items-center">
                            <span className="flex items-center gap-1.5 truncate max-w-[120px]">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor: p.color}}></span>
                                <span className="truncate" title={p.name}>{p.name}</span>
                            </span>
                            <span className="font-mono font-bold text-slate-700">{p.value.toFixed(2)}</span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                    <Icon size={16} className={title.includes('需求') ? 'text-emerald-500' : 'text-blue-500'}/> 
                    {title}
                </h3>
                <button 
                    onClick={() => setZoomOthers(!zoomOthers)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        zoomOthers ? 'bg-amber-100 text-amber-700 border border-amber-200 shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                    {zoomOthers ? <ZoomOut size={14}/> : <ZoomIn size={14}/>}
                    {zoomOthers ? '恢復全景' : '放大微小量 (隱藏 Top 3)'}
                </button>
            </div>
            <div className="flex-1 min-h-0 w-full h-full relative">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
                        <XAxis dataKey="year" tick={{fontSize:12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                        <YAxis label={{ value: unit, angle: -90, position: 'insideLeft', offset: 15, fontSize: 11, fill: '#94a3b8' }} tick={{fontSize:11, fill: '#64748b'}} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomStackTooltip />} cursor={{fill: '#f8fafc'}}/>
                        <Legend wrapperStyle={{fontSize:'10px', paddingTop: '10px'}} />
                        {displayKeys.map((k) => (
                            <Bar key={k} dataKey={k} stackId="a" fill={stringToColor(k)} name={k} radius={[0, 0, 0, 0]}>
                                {/* 只顯示當前情境下的前 5 大量能數字 */}
                                {currentTop5Keys.includes(k) && (
                                    <LabelList dataKey={k} position="center" fill="white" fontSize={10} formatter={(v) => v > 2 ? v.toFixed(0) : ''} />
                                )}
                            </Bar>
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

// 2. Regional Deep Dive Component (Replaces GeoMap)
const RegionalDeepDive = ({ supplyData, demandData, globalYear }) => {
    const [activeRegion, setActiveRegion] = useState('南區');
    const regions = ['北區', '中區', '南區', '東區'];

    // Filter and Process Data for the active region
    const { yearlyTrend, plantDetails, summary } = useMemo(() => {
        let totalSupply = 0;
        let totalDemand = 0;
        const trendMap = {};
        const plantMap = {};

        // Helper to process rows
        const processRow = (d, isSupply) => {
            const r = d.Region || '其他';
            if (r !== activeRegion) return;
            
            const y = d.Year;
            const name = getSimplePlantName(d.Company, d.Plant);
            const val = isSupply ? (d.Output_Tons || 0) : (d.Demand_Tons || 0);

            // Trend Data (Always aggregate all years to show trend)
            if (!trendMap[y]) trendMap[y] = { year: y, supply: 0, demand: 0 };
            if (isSupply) trendMap[y].supply += val; else trendMap[y].demand += val;

            // Plant Data (Respect global year filter)
            if (globalYear === 'ALL' || d.Year === globalYear) {
                if (!plantMap[name]) plantMap[name] = { name, company: simplifyCompanyName(d.Company), supply: 0, demand: 0 };
                if (isSupply) { plantMap[name].supply += val; totalSupply += val; }
                else { plantMap[name].demand += val; totalDemand += val; }
            }
        };

        supplyData.forEach(d => processRow(d, true));
        demandData.forEach(d => processRow(d, false));

        const trendData = Object.values(trendMap).sort((a,b) => a.year.localeCompare(b.year));
        // Sort plants by total volume and take Top 5
        const plantData = Object.values(plantMap).sort((a,b) => (b.supply + b.demand) - (a.supply + a.demand)).slice(0, 5);
        
        // Auto Conclusion
        const gap = totalSupply - totalDemand;
        let conclusion = "";
        if (totalSupply === 0 && totalDemand === 0) conclusion = "此區間無顯著數據。";
        else if (gap > 2) conclusion = `供給充裕 (餘裕 ${gap.toFixed(1)} 萬噸)。產能足以支撐需求，可調度支援他區。`;
        else if (gap < -2) conclusion = `需求大於供給 (缺口 ${Math.abs(gap).toFixed(1)} 萬噸)。高度依賴跨區調度或未來擴產。`;
        else conclusion = "供需大致平衡。產能與使用量緊密咬合，需確保產線穩定。";

        return { yearlyTrend: trendData, plantDetails: plantData, summary: { totalSupply, totalDemand, gap, conclusion } };
    }, [supplyData, demandData, activeRegion, globalYear]);

    return (
        <div className="flex flex-col h-full w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Header & Tabs */}
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><MapPin size={16} className="text-rose-500"/> 區域深度解析</h3>
                <div className="flex gap-1 bg-slate-200/50 p-1 rounded-lg">
                    {regions.map(r => (
                        <button key={r} onClick={() => setActiveRegion(r)} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeRegion === r ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            {r}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto">
                {/* Info Cards */}
                <div className="flex gap-4">
                    <div className="flex-1 bg-blue-50 border border-blue-100 p-3 rounded-lg flex flex-col justify-center">
                        <div className="text-[10px] text-blue-600 font-bold uppercase mb-1">涵蓋縣市</div>
                        <div className="text-xs text-slate-700 font-medium leading-relaxed">{REGION_COUNTIES[activeRegion].join('、')}</div>
                    </div>
                    <div className={`flex-1 p-3 rounded-lg border flex flex-col justify-center ${summary.gap >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                        <div className={`text-[10px] font-bold uppercase mb-1 ${summary.gap >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>現況總結 ({globalYear})</div>
                        <div className="text-xs text-slate-700 font-medium leading-relaxed">{summary.conclusion}</div>
                    </div>
                </div>

                <div className="flex gap-4 flex-1 min-h-[250px]">
                    {/* Left: Yearly Trend Chart */}
                    <div className="w-5/12 flex flex-col border border-slate-100 rounded-lg p-2 relative min-h-0 bg-slate-50/50">
                        <div className="text-xs font-bold text-slate-500 mb-2 text-center">該區歷年供需趨勢</div>
                        <div className="flex-1 min-h-0 w-full h-full relative">
                            {yearlyTrend.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={yearlyTrend} margin={{top: 10, right: 10, left: -20, bottom: 0}}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="year" tick={{fontSize: 10}} axisLine={false}/>
                                        <YAxis tick={{fontSize: 10}} axisLine={false} tickLine={false}/>
                                        <Tooltip wrapperStyle={{fontSize: '11px'}} cursor={{fill: '#e2e8f0', opacity: 0.4}}/>
                                        <Legend wrapperStyle={{fontSize: '10px'}}/>
                                        <Bar dataKey="supply" name="供給量" fill="#3b82f6" barSize={12} radius={[2,2,0,0]}/>
                                        <Bar dataKey="demand" name="需求量" fill="#f59e0b" barSize={12} radius={[2,2,0,0]}/>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (<div className="h-full flex items-center justify-center text-xs text-slate-400">無歷年數據</div>)}
                        </div>
                    </div>

                    {/* Right: Plant Details Chart */}
                    <div className="w-7/12 flex flex-col border border-slate-100 rounded-lg p-2 min-h-0">
                        <div className="text-xs font-bold text-slate-500 mb-2 text-center flex items-center justify-center gap-1">
                            <List size={12}/> 前 5 大廠區供需明細 ({globalYear})
                        </div>
                        <div className="flex-1 min-h-0 w-full h-full relative">
                            {plantDetails.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={plantDetails} layout="vertical" margin={{top: 5, right: 30, left: 40, bottom: 5}} barGap={2}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                        <XAxis type="number" fontSize={10} unit="萬噸"/>
                                        <YAxis dataKey="name" type="category" fontSize={10} width={80} interval={0} tick={{fill: '#475569'}}/>
                                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{fontSize: '12px'}} formatter={(val) => val.toFixed(2)}/>
                                        <Legend wrapperStyle={{fontSize: '10px'}} verticalAlign="top"/>
                                        <Bar dataKey="supply" name="供給量" fill="#3b82f6" barSize={10} radius={[0, 4, 4, 0]}>
                                            <LabelList position="right" fill="#3b82f6" fontSize={9} formatter={v => v > 0 ? v.toFixed(1) : ''} />
                                        </Bar>
                                        <Bar dataKey="demand" name="需求量" fill="#f59e0b" barSize={10} radius={[0, 4, 4, 0]}>
                                            <LabelList position="right" fill="#f59e0b" fontSize={9} formatter={v => v > 0 ? v.toFixed(1) : ''} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (<div className="h-full flex items-center justify-center text-xs text-slate-400">無廠區數據</div>)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// 3. Tech Style Semicircle Balance Chart
const TechBalanceChart = ({ supplyData, demandData }) => {
    const groupByRegion = (data, valueKey) => {
        const map = { '北區': 0, '中區': 0, '南區': 0, '東區': 0 };
        data.forEach(d => {
            const r = d.Region || '其他';
            if (map[r] !== undefined) map[r] += (d[valueKey] || 0);
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
            {/* Top Semicircle (Supply) */}
            <div className="relative w-full flex-1 min-h-[140px] z-10">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{top: 20, bottom: 0}}>
                        <Pie data={sData} cx="50%" cy="90%" startAngle={180} endAngle={0} innerRadius="55%" outerRadius="90%" dataKey="value" stroke="white" strokeWidth={2}>
                            {sData.map((entry, index) => <Cell key={`cell-${index}`} fill={REGION_COLORS[entry.name]} fillOpacity={0.85}/>)}
                            <LabelList dataKey="name" position="outside" offset={10} fill="#475569" fontSize={11} fontWeight="bold" stroke="none" />
                        </Pie>
                        <Tooltip formatter={(val) => val.toFixed(1) + ' 萬噸'} />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute bottom-1 left-0 w-full text-center pointer-events-none">
                    <span className="bg-white/90 backdrop-blur px-2 py-0.5 rounded text-blue-700 font-bold text-xs shadow-sm">總供給 {totalS.toFixed(1)}</span>
                </div>
            </div>

            {/* Gap Indicator Center */}
            <div className="z-20 bg-white/95 backdrop-blur-md px-6 py-2 rounded-2xl shadow-lg border border-slate-100 text-center relative mx-auto my-2">
                <div className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-0.5">供需平衡</div>
                <div className={`text-2xl font-black font-mono leading-none ${gap >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {gap > 0 ? '+' : ''}{gap.toFixed(1)}
                </div>
            </div>

            {/* Bottom Semicircle (Demand) */}
            <div className="relative w-full flex-1 min-h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{top: 0, bottom: 20}}>
                        <Pie data={dData} cx="50%" cy="10%" startAngle={180} endAngle={360} innerRadius="55%" outerRadius="90%" dataKey="value" stroke="white" strokeWidth={2}>
                            {dData.map((entry, index) => <Cell key={`cell-${index}`} fill={REGION_COLORS[entry.name]} fillOpacity={0.4}/>)}
                            <LabelList dataKey="name" position="outside" offset={10} fill="#475569" fontSize={11} fontWeight="bold" stroke="none" />
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

// 4. Structure Analysis Component (Pie + List)
const StructureAnalysis = ({ data, typeField, valueField, categoryFn, colorMap }) => {
    const { l1, l2, total } = useMemo(() => {
        const totalVal = data.reduce((acc, curr) => acc + (curr[valueField] || 0), 0);
        const l1Map = {};
        const l2Map = {};

        data.forEach(d => {
            const name = d[typeField] || 'Unknown';
            const identifiedName = typeField === 'Process' ? identifyProcess(name) : identifyUsage(name);
            const category = categoryFn(identifiedName);
            const val = d[valueField] || 0;
            if(!l1Map[category]) l1Map[category] = 0;
            l1Map[category] += val;
            if(!l2Map[identifiedName]) l2Map[identifiedName] = { name: identifiedName, value: 0, category };
            l2Map[identifiedName].value += val;
        });

        const safePercent = (val, tot) => tot > 0 ? Number(((val / tot) * 100).toFixed(1)) : 0;

        const l1Arr = Object.entries(l1Map).map(([name, value]) => ({
            name, value, percent: safePercent(value, totalVal)
        })).sort((a,b)=>b.value-a.value);

        const l2Arr = Object.values(l2Map).map(item => ({
            ...item,
            percent: safePercent(item.value, totalVal),
            parentShare: safePercent(item.value, l1Map[item.category])
        })).sort((a,b)=>b.value-a.value);

        return { l1: l1Arr, l2: l2Arr, total: totalVal };
    }, [data, typeField, valueField]);

    // 自訂外圈標籤，確保百分比與名稱正確顯示
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

    return (
        <div className="flex h-full gap-4 pb-2">
            <div className="w-1/2 h-full relative min-h-[250px] flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        {/* Inner Ring (L1) */}
                        <Pie data={l1} dataKey="value" cx="50%" cy="50%" outerRadius="45%" stroke="white" strokeWidth={2}>
                            {l1.map((e, i) => <Cell key={i} fill={colorMap[e.name] || '#94a3b8'} />)}
                            <LabelList dataKey="percent" position="inside" fill="white" fontSize={11} fontWeight="bold" formatter={v => v > 5 ? `${v}%` : ''} />
                        </Pie>
                        {/* Outer Ring (L2) */}
                        <Pie data={l2} dataKey="value" cx="50%" cy="50%" innerRadius="55%" outerRadius="80%" stroke="none" label={renderOuterLabel} labelLine={{stroke: '#cbd5e1'}}>
                            {l2.map((e, i) => <Cell key={i} fill={colorMap[e.name] || '#94a3b8'} fillOpacity={0.8} />)}
                        </Pie>
                        <Tooltip formatter={(v) => `${Number(v).toFixed(2)} 萬噸`} />
                    </PieChart>
                </ResponsiveContainer>
                {/* Center Total */}
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
        const parsedP = parseHydrogenCSV(txtP);
        const parsedU = parseHydrogenCSV(txtU);
        
        setRawData({ supply: parsedP, demand: parsedU });

        const normP = normalizeHydrogenData(parsedP, 'supply');
        const normU = normalizeHydrogenData(parsedU, 'demand');

        if (normP.length === 0 && normU.length === 0) throw new Error("Normalization Empty");

        // Apply Region Refinement
        const refinedP = normP.map(d => ({ ...d, Region: getRefinedRegion(d.Plant, d.Company) }));
        const refinedU = normU.map(d => ({ ...d, Region: getRefinedRegion(d.Plant, d.Company) }));

        setSupplyData(refinedP);
        setDemandData(refinedU);
        setIsFallback(false);
        setStatusMsg(`成功載入: 供給 ${normP.length} 筆, 需求 ${normU.length} 筆`);

      } catch (e) {
        console.error("Using Mock Data", e);
        setSupplyData(normalizeHydrogenData(MOCK_SUPPLY_MATRIX, 'supply').map(d => ({...d, Region: getRefinedRegion(d.Plant, d.Company)})));
        setDemandData(normalizeHydrogenData(MOCK_DEMAND_MATRIX, 'demand').map(d => ({...d, Region: getRefinedRegion(d.Plant, d.Company)})));
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

  // 3. 歷年供給/需求來源 (堆疊)
  const { supplyTrend, demandTrend } = useMemo(() => {
      const processStack = (data, valueKey, labelFn) => {
          const map = {};
          const keysSet = new Set();
          data.forEach(d => {
              const y = d.Year;
              let k = labelFn(d);
              if (d.Company.includes('中油')) {
                  const p = d.Plant || '';
                  if (p.includes('大林')) k = '中油-大林';
                  else if (p.includes('桃園')) k = '中油-桃煉';
                  else if (p.includes('林園') || p.includes('石化')) k = '中油-石化部';
                  else k = '中油-其他';
              }
              if(!map[y]) map[y] = { year: y };
              map[y][k] = (map[y][k] || 0) + (d[valueKey] || 0);
              keysSet.add(k);
          });
          return { data: Object.values(map).sort((a,b)=>a.year-b.year), keys: Array.from(keysSet) };
      };

      return {
          supplyTrend: processStack(supplyData, 'Output_Tons', d => simplifyCompanyName(d.Company)),
          demandTrend: processStack(demandData, 'Demand_Tons', d => simplifyCompanyName(d.Company))
      };
  }, [supplyData, demandData]);

  // 2. Scatter Matrix - X=Output (Log), Y=Intensity
  const efficiencyChartData = useMemo(() => {
      const plantMap = {};
      filteredSupply.forEach(d => {
          const key = getSimplePlantName(d.Company, d.Plant);
          if(!plantMap[key]) plantMap[key] = { name: key, output: 0, total_emission: 0, intensity: 0 };
          plantMap[key].output += d.Output_Tons || 0;
          const currentIntensity = d.Carbon_Intensity || 0;
          if (currentIntensity > 0) plantMap[key].intensity = currentIntensity; 
          plantMap[key].total_emission += (d.Output_Tons || 0) * (d.Carbon_Intensity || 0);
      });
      // Filter out invalid log values (output <= 0)
      return Object.values(plantMap).filter(d => d.output > 0 && d.intensity > 0);
  }, [filteredSupply]);

  // Raw Table Render
  const renderRawTable = (data, title) => {
      if(!data || data.length === 0) return <div className="text-slate-400 p-2">無數據</div>;
      const headers = Object.keys(data[0]);
      return (
          <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col h-[500px]">
              <div className="p-3 bg-slate-50 border-b font-bold text-slate-700 flex justify-between items-center">
                  <span>{title} ({data.length}筆)</span>
              </div>
              <div className="overflow-auto flex-1">
                  <table className="w-full text-xs text-left whitespace-nowrap">
                      <thead className="bg-slate-100 sticky top-0">
                          <tr>{headers.map(h=><th key={h} className="p-2 border-b">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                          {data.map((row, i) => (
                              <tr key={i} className="hover:bg-blue-50 border-b">
                                  {headers.map(h=><td key={h} className="p-2 border-r last:border-r-0">{row[h]}</td>)}
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      );
  };

  if (loading) return <div className="p-10 text-center animate-pulse text-slate-500">氫能數據載入中...</div>;

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
                     <StackedTrendChart data={supplyTrend.data} keys={supplyTrend.keys} title="歷年供給來源 (堆疊)" icon={Database} />
                 </div>
                 
                 <div className="lg:col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center h-[400px]">
                     <h3 className="font-bold text-slate-700 text-sm mb-2 flex items-center gap-2">區域供需平衡 ({selectedYear})</h3>
                     <div className="flex-1 w-full min-h-0 relative">
                         <TechBalanceChart supplyData={filteredSupply} demandData={filteredDemand} />
                     </div>
                 </div>

                 <div className="lg:col-span-2 min-h-[400px] w-full relative">
                     <StackedTrendChart data={demandTrend.data} keys={demandTrend.keys} title="歷年需求流向 (堆疊)" icon={Activity} />
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

             {/* Row 3: Regional Deep Dive (Replaces Map) */}
             <div className="grid grid-cols-1 gap-6">
                 <div className="h-[450px]">
                     <RegionalDeepDive supplyData={supplyData} demandData={demandData} globalYear={selectedYear} />
                 </div>
             </div>

             {/* Row 4: Scatter Matrix */}
             <div className="grid grid-cols-1 gap-6">
                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[450px]">
                     <h3 className="font-bold text-slate-700 text-sm mb-4 border-b pb-2 flex items-center gap-2"><Leaf size={14}/> 碳排強度矩陣 (產量 Log Scale) & 產能對照 ({selectedYear})</h3>
                     <div className="flex-1 min-h-0 flex gap-4 w-full relative">
                         
                         {/* Scatter Chart: X=Output(Log), Y=Intensity */}
                         <div className="flex-1 h-full relative border border-slate-100 rounded-lg p-2 bg-slate-50/50 min-h-0">
                            <div className="absolute top-2 right-4 text-[10px] text-slate-400 bg-white/80 px-2 rounded z-10">圓點大小 = 總碳排量</div>
                            <ResponsiveContainer width="100%" height="100%">
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
                         </div>
                         
                         {/* Composed Chart: Bar(Output) + Line(Intensity) */}
                         <div className="flex-1 h-full border border-slate-100 rounded-lg p-2 min-h-0 relative">
                            <ResponsiveContainer width="100%" height="100%">
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
                         </div>

                     </div>
                 </div>
             </div>
           </>
       ) : (
           <div className="p-6 bg-white rounded-xl shadow overflow-auto h-[600px]">
               <h3 className="font-bold mb-4">原始數據檢視與診斷</h3>
               <div className="grid grid-cols-2 gap-6">
                   <ErrorBoundary>
                       <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col h-[500px]">
                           <div className="p-3 bg-slate-50 border-b font-bold text-slate-700">供給端原始資料 ({rawData.supply.length}筆)</div>
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
                           <div className="p-3 bg-slate-50 border-b font-bold text-slate-700">需求端原始資料 ({rawData.demand.length}筆)</div>
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