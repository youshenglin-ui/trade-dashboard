import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, ComposedChart, ScatterChart, Scatter, ZAxis, LabelList, Sector, ReferenceLine, Label
} from 'recharts';
import { 
  Database, Calendar, RefreshCw, AlertCircle, Activity, Factory, Leaf, Zap, Info, CheckCircle, MapPin, 
  TrendingUp, TrendingDown, LayoutDashboard, FileText
} from 'lucide-react';
import { 
  normalizeHydrogenData, parseHydrogenCSV, getLocation, getRegion as getBasicRegion, 
  simplifyCompanyName, getSimplePlantName, getProcessType, identifyProcess, 
  identifyUsage, getUsageCategory, stringToColor
} from '../utils/helpers';
import { 
  H2_DATA_SOURCES, MOCK_SUPPLY_MATRIX, MOCK_DEMAND_MATRIX, COLORS_PROCESS, COLORS_USAGE 
} from '../utils/constants';
import { CustomXAxisTick, ErrorBoundary, renderCustomizedLabel } from './SharedComponents';

// --- Constants & Data ---

const REGION_COLORS = {
    '北區': '#3b82f6', // Blue
    '中區': '#10b981', // Emerald
    '南區': '#f59e0b', // Amber
    '東區': '#8b5cf6', // Violet
    '其他': '#94a3b8'  // Slate
};

// --- Helper Logic (Refined for Dashboard) ---

const getRefinedRegion = (plantName, companyName) => {
    const p = String(plantName || '').trim();
    const c = String(companyName || '').trim();
    
    // 4. 區域定義修正 (Region Overrides)
    if (c.includes('大連') && p.includes('大發')) return '南區'; 
    if (c.includes('中油')) {
        if (p.includes('大林')) return '南區'; 
        if (p.includes('石化')) return '南區'; 
        if (p.includes('桃園')) return '北區';
        if (p.includes('林園')) return '南區';
    }
    if (c.includes('台灣化纖') && (p.includes('台北') || p.includes('麥寮'))) return '中區'; 
    if (c.includes('台灣石化') || c.includes('台苯')) return '南區';
    if (c.includes('台塑科騰')) return '中區';
    if (c.includes('台塑') && p.includes('麥寮')) return '中區';
    
    return getBasicRegion(plantName);
};

// --- Custom Components ---

// NEW: Regional Deep Dive Component (Replaces GeoMap)
const RegionalDeepDive = ({ supplyData, demandData }) => {
    const [activeRegion, setActiveRegion] = useState('南區'); // Default to South as it's usually busiest

    // Merge and Process Data for the active region
    const { chartData, summary } = useMemo(() => {
        const mergedMap = {};
        let totalSupply = 0;
        let totalDemand = 0;

        // Process Supply
        supplyData.forEach(d => {
            const region = d.Region || '其他';
            if (region !== activeRegion) return;
            
            // Generate a readable name: Company + Plant (shortened)
            const name = getSimplePlantName(d.Company, d.Plant);
            
            if (!mergedMap[name]) mergedMap[name] = { name, supply: 0, demand: 0 };
            mergedMap[name].supply += (d.Output_Tons || 0);
            totalSupply += (d.Output_Tons || 0);
        });

        // Process Demand
        demandData.forEach(d => {
            const region = d.Region || '其他';
            if (region !== activeRegion) return;
            
            const name = getSimplePlantName(d.Company, d.Plant);
            
            if (!mergedMap[name]) mergedMap[name] = { name, supply: 0, demand: 0 };
            mergedMap[name].demand += (d.Demand_Tons || 0);
            totalDemand += (d.Demand_Tons || 0);
        });

        const data = Object.values(mergedMap).sort((a,b) => (b.supply + b.demand) - (a.supply + a.demand));
        
        // Generate Conclusion Text
        const gap = totalSupply - totalDemand;
        let conclusion = "";
        if (totalSupply === 0 && totalDemand === 0) {
            conclusion = "此區域目前無顯著氫氣供需數據。";
        } else if (gap > 1) {
            conclusion = `供給充裕 (餘裕 ${(gap).toFixed(1)} 萬噸)。產能足以支撐目前需求，可考慮支援鄰近區域或發展氫能載具應用。`;
        } else if (gap < -1) {
            conclusion = `需求大於供給 (缺口 ${Math.abs(gap).toFixed(1)} 萬噸)。需依賴其他區域調度或擴增產能，建議關注主要需求大戶的用氫來源。`;
        } else {
            conclusion = "供需大致平衡。產能與使用量相當，需注意歲修或突發狀況時的調度彈性。";
        }

        return { chartData: data, summary: { totalSupply, totalDemand, conclusion } };
    }, [supplyData, demandData, activeRegion]);

    const regions = ['北區', '中區', '南區', '東區'];

    return (
        <div className="flex flex-col h-full w-full">
            {/* Region Tabs */}
            <div className="flex gap-2 mb-3 border-b border-slate-100 pb-2">
                {regions.map(r => (
                    <button
                        key={r}
                        onClick={() => setActiveRegion(r)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all ${
                            activeRegion === r 
                            ? 'bg-slate-800 text-white shadow-md' 
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                    >
                        {r}
                    </button>
                ))}
            </div>

            {/* Conclusion Box */}
            <div className={`p-3 rounded-lg border mb-3 text-xs flex items-start gap-2 ${
                summary.totalSupply >= summary.totalDemand ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'
            }`}>
                <FileText size={16} className="mt-0.5 flex-shrink-0"/>
                <div>
                    <div className="font-bold mb-1">區域現況總結：{activeRegion}</div>
                    <p className="leading-relaxed opacity-90">{summary.conclusion}</p>
                    <div className="mt-2 flex gap-4 font-mono text-[10px] opacity-75">
                        <span>總供給: {summary.totalSupply.toFixed(1)} 萬噸</span>
                        <span>總需求: {summary.totalDemand.toFixed(1)} 萬噸</span>
                    </div>
                </div>
            </div>

            {/* Bar Chart */}
            <div className="flex-1 min-h-0 w-full">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={chartData}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} />
                            <XAxis type="number" fontSize={10} unit="萬噸"/>
                            <YAxis 
                                dataKey="name" 
                                type="category" 
                                fontSize={10} 
                                width={100}
                                interval={0}
                            />
                            <Tooltip 
                                formatter={(value, name) => [value.toFixed(2), name === 'supply' ? '供給' : '需求']}
                                contentStyle={{fontSize: '12px'}}
                            />
                            <Legend wrapperStyle={{fontSize: '10px'}} />
                            <Bar dataKey="supply" name="供給" fill="#3b82f6" barSize={12} radius={[0, 4, 4, 0]} />
                            <Bar dataKey="demand" name="需求" fill="#f59e0b" barSize={12} radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                        此區域無相關數據
                    </div>
                )}
            </div>
        </div>
    );
};

// 4. Tech Style Semicircle Balance Chart
const TechBalanceChart = ({ supplyData, demandData }) => {
    // Group by Region
    const groupByRegion = (data, valueKey) => {
        const map = { '北區': 0, '中區': 0, '南區': 0, '東區': 0, '其他': 0 };
        data.forEach(d => {
            const r = d.Region || '其他';
            if (map[r] !== undefined) map[r] += (d[valueKey] || 0);
            else map['其他'] += (d[valueKey] || 0);
        });
        return Object.entries(map).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
    };

    const sData = groupByRegion(supplyData, 'Output_Tons');
    const dData = groupByRegion(demandData, 'Demand_Tons');

    const totalS = sData.reduce((a,b)=>a+b.value, 0);
    const totalD = dData.reduce((a,b)=>a+b.value, 0);
    const gap = totalS - totalD;

    return (
        <div className="relative w-full h-full flex flex-col items-center justify-center p-2">
            {/* Top Semicircle (Supply) */}
            <div className="relative w-full h-[120px] mb-2 z-10 flex items-end justify-center">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={sData}
                            cx="50%" cy="100%"
                            startAngle={180} endAngle={0}
                            innerRadius={60} outerRadius={90}
                            dataKey="value" stroke="none"
                        >
                            {sData.map((entry, index) => <Cell key={`cell-${index}`} fill={REGION_COLORS[entry.name]} fillOpacity={0.8}/>)}
                            {/* Adjusted position to 'outside' to avoid overlap */}
                            <LabelList dataKey="name" position="outside" offset={10} fill="#475569" fontSize={10} stroke="none" />
                        </Pie>
                        <Tooltip formatter={(val) => val.toFixed(1)} />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute bottom-2 left-0 w-full text-center text-blue-600 font-bold text-sm pointer-events-none">
                    總供給: {totalS.toFixed(1)}
                </div>
            </div>

            {/* Gap Indicator Center */}
            <div className="z-20 my-1 bg-white/80 px-4 py-2 rounded-full shadow-md border border-slate-200 text-center backdrop-blur relative">
                <div className="text-[10px] text-slate-400">供需平衡</div>
                <div className={`text-xl font-bold font-mono ${gap >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {gap > 0 ? '+' : ''}{gap.toFixed(1)}
                </div>
            </div>

            {/* Bottom Semicircle (Demand) */}
            <div className="relative w-full h-[120px] mt-2 flex items-start justify-center">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={dData}
                            cx="50%" cy="0%"
                            startAngle={180} endAngle={360}
                            innerRadius={60} outerRadius={90}
                            dataKey="value" stroke="none"
                        >
                            {dData.map((entry, index) => <Cell key={`cell-${index}`} fill={REGION_COLORS[entry.name]} fillOpacity={0.4}/>)}
                            <LabelList dataKey="name" position="outside" offset={10} fill="#475569" fontSize={10} stroke="none" />
                        </Pie>
                        <Tooltip formatter={(val) => val.toFixed(1)} />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-2 left-0 w-full text-center text-amber-600 font-bold text-sm pointer-events-none">
                    總需求: {totalD.toFixed(1)}
                </div>
            </div>
        </div>
    );
};

// 1. Structure Analysis Component (Pie + List)
const StructureAnalysis = ({ data, typeField, valueField, categoryFn, colorMap }) => {
    // Process Data
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

        // Calculate Percentages (Max 1 decimal place, sum should be roughly 100)
        const l1Arr = Object.entries(l1Map).map(([name, value]) => ({
            name, value, 
            percent: totalVal > 0 ? ((value/totalVal)*100).toFixed(1) : 0
        })).sort((a,b)=>b.value-a.value);

        const l2Arr = Object.values(l2Map).map(item => ({
            ...item,
            percent: totalVal > 0 ? ((item.value/totalVal)*100).toFixed(1) : 0,
            // Calculate share within parent category
            parentShare: l1Map[item.category] > 0 ? ((item.value/l1Map[item.category])*100).toFixed(1) : 0
        })).sort((a,b)=>b.value-a.value);

        return { l1: l1Arr, l2: l2Arr, total: totalVal };
    }, [data, typeField, valueField]);

    return (
        <div className="flex h-full gap-4">
            {/* Chart */}
            <div className="w-5/12 h-full relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        {/* Inner Ring (L1) */}
                        <Pie data={l1} dataKey="value" cx="50%" cy="50%" outerRadius={50} stroke="white" strokeWidth={2}>
                            {l1.map((e, i) => <Cell key={i} fill={colorMap[e.name] || '#94a3b8'} />)}
                            <LabelList dataKey="percent" position="inside" fill="white" fontSize={10} formatter={v => v > 5 ? `${v}%` : ''} />
                        </Pie>
                        {/* Outer Ring (L2) */}
                        <Pie data={l2} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={90} stroke="none">
                            {l2.map((e, i) => <Cell key={i} fill={colorMap[e.name] || '#94a3b8'} fillOpacity={0.8} />)}
                            <LabelList dataKey="percent" position="outside" offset={15} fill="#64748b" fontSize={10} formatter={v => v > 3 ? `${v}%` : ''} />
                        </Pie>
                        <Tooltip formatter={(v) => `${Number(v).toFixed(2)} 萬噸`} />
                    </PieChart>
                </ResponsiveContainer>
                {/* Center Total */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                    <div className="text-[10px] text-slate-400">Total</div>
                    <div className="text-xs font-bold text-slate-700">{total.toFixed(1)}</div>
                </div>
            </div>

            {/* Detailed List */}
            <div className="w-7/12 h-full overflow-y-auto custom-scrollbar pr-2">
                <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-white z-10 shadow-sm">
                        <tr className="text-slate-400 border-b">
                            <th className="py-2 pl-2">類別項目</th>
                            <th className="py-2 text-right">總佔比</th>
                            <th className="py-2 text-right pr-2">萬噸</th>
                        </tr>
                    </thead>
                    <tbody>
                        {l1.map(cat => (
                            <React.Fragment key={cat.name}>
                                <tr className="bg-slate-50 font-bold text-slate-700 border-b border-slate-100">
                                    <td className="py-2 pl-2 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full" style={{backgroundColor: colorMap[cat.name] || '#94a3b8'}}></span>
                                        {cat.name}
                                    </td>
                                    <td className="py-2 text-right font-mono">{cat.percent}%</td>
                                    <td className="py-2 pr-2 text-right text-slate-400">{cat.value.toFixed(2)}</td>
                                </tr>
                                {l2.filter(sub => sub.category === cat.name).map(sub => (
                                    <tr key={sub.name} className="border-b border-slate-50 hover:bg-blue-50/50">
                                        <td className="py-1.5 pl-6 text-slate-500 truncate max-w-[120px]" title={sub.name}>{sub.name}</td>
                                        <td className="py-1.5 text-right text-slate-400 text-[10px]">{sub.percent}%</td>
                                        <td className="py-1.5 pr-2 text-right font-mono text-slate-600">{sub.value.toFixed(2)}</td>
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
  const [selectedLocation, setSelectedLocation] = useState(null);
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

  const filteredSupply = useMemo(() => supplyData.filter(d => (selectedYear === 'ALL' || d.Year === selectedYear) && (!selectedLocation || d.Region === selectedLocation)), [supplyData, selectedYear, selectedLocation]);
  const filteredDemand = useMemo(() => demandData.filter(d => (selectedYear === 'ALL' || d.Year === selectedYear) && (!selectedLocation || d.Region === selectedLocation)), [demandData, selectedYear, selectedLocation]);

  // 3. 歷年供給/需求來源 (堆疊) - 拉長與細節優化
  const { supplyTrendChart, supplyKeys, demandTrendChart, demandKeys } = useMemo(() => {
      const processStackData = (data, valueKey, labelKeyFn) => {
          const map = {};
          const totals = {}; 
          
          data.forEach(d => {
              const y = d.Year;
              let key = labelKeyFn(d);
              
              // Custom Breakdown for CPC (中油)
              if (d.Company.includes('中油')) {
                  const p = d.Plant || '';
                  if (p.includes('大林')) key = '中油-大林';
                  else if (p.includes('桃園')) key = '中油-桃煉';
                  else if (p.includes('林園') || p.includes('石化')) key = '中油-石化部';
                  else key = '中油-其他';
              } else {
                  key = simplifyCompanyName(d.Company);
              }

              const val = (d[valueKey] || 0);

              if(!map[y]) map[y] = { year: y };
              map[y][key] = (map[y][key] || 0) + val;
              totals[key] = (totals[key] || 0) + val;
          });

          // Sort keys by total volume
          const sortedKeys = Object.entries(totals).sort((a,b)=>b[1]-a[1]).map(k=>k[0]);
          const top5Keys = sortedKeys.slice(0, 5); // Identify top 5 for explicit labels
          
          return { 
              chartData: Object.values(map).sort((a,b)=>a.year-b.year), 
              finalKeys: sortedKeys,
              top5Keys: top5Keys
          };
      };

      const sData = processStackData(supplyData, 'Output_Tons', d => d.Company);
      const dData = processStackData(demandData, 'Demand_Tons', d => simplifyCompanyName(d.Company));
      
      return {
          supplyTrendChart: sData,
          demandTrendChart: dData
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

  if (loading) return <div className="p-10 text-center animate-pulse text-slate-500">氫能數據載入中...</div>;

  return (
    <div className="space-y-8 p-4 bg-slate-50 rounded-lg animate-fade-in relative">
       <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Factory className="text-blue-600"/> 氫能供需戰情室</h2>
              <div className="flex items-center gap-2 text-sm bg-slate-100 px-3 py-1 rounded-full">
                  <Calendar size={14}/>
                  <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="bg-transparent font-bold text-blue-700 outline-none">
                      {availableYears.map(y => <option key={y} value={y}>{y}年</option>)}
                  </select>
              </div>
              {selectedLocation && <button onClick={()=>setSelectedLocation(null)} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">清除地點: {selectedLocation}</button>}
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
                 {/* 1. Supply Trend Stacked Chart */}
                 <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-[400px] flex flex-col">
                     <h3 className="font-bold text-slate-700 text-sm mb-2 flex items-center gap-2"><Database size={16}/> 歷年供給來源 (堆疊) - 含中油細項</h3>
                     <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={supplyTrendChart.chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                                <XAxis dataKey="year" tick={{fontSize:12}}/>
                                <YAxis label={{ value: '萬噸', angle: -90, position: 'insideLeft' }} />
                                <Tooltip formatter={val=>Number(val).toFixed(2)+' 萬噸'}/>
                                <Legend wrapperStyle={{fontSize:'10px'}}/>
                                {supplyTrendChart.finalKeys.map((k,i) => (
                                    <Bar key={k} dataKey={k} stackId="a" fill={stringToColor(k)} name={k}>
                                        {/* Top 5 labels for better visibility */}
                                        {supplyTrendChart.top5Keys.includes(k) && (
                                            <LabelList dataKey={k} position="center" fill="white" fontSize={9} formatter={(v) => v > 1 ? v.toFixed(1) : ''} />
                                        )}
                                    </Bar>
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                     </div>
                 </div>
                 
                 {/* 2. Balance Gauge (2025) */}
                 <div className="lg:col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center h-[400px]">
                     <h3 className="font-bold text-slate-700 text-sm mb-4">區域供需平衡 ({selectedYear})</h3>
                     <div className="flex-1 w-full min-h-0">
                         <TechBalanceChart supplyData={filteredSupply} demandData={filteredDemand} />
                     </div>
                 </div>

                 {/* 3. Demand Trend Stacked Chart */}
                 <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-[400px] flex flex-col">
                     <h3 className="font-bold text-slate-700 text-sm mb-2 flex items-center gap-2"><Activity size={16} className="text-emerald-500"/> 歷年需求流向 (堆疊)</h3>
                     <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={demandTrendChart.chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                                <XAxis dataKey="year" tick={{fontSize:12}}/>
                                <YAxis orientation="right" />
                                <Tooltip formatter={val=>(val).toFixed(1)+' 萬噸'}/>
                                <Legend wrapperStyle={{fontSize:'10px'}}/>
                                {demandTrendChart.finalKeys.map((k,i) => (
                                    <Bar key={k} dataKey={k} stackId="a" fill={stringToColor(k)} name={k}>
                                         {demandTrendChart.top5Keys.includes(k) && (
                                            <LabelList dataKey={k} position="center" fill="white" fontSize={9} formatter={(v) => v > 1 ? v.toFixed(1) : ''} />
                                        )}
                                    </Bar>
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                     </div>
                 </div>
             </div>

             {/* Row 2: Structure Analysis (Pies) */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[450px]">
                     <h3 className="font-bold text-slate-700 text-sm mb-2 border-b pb-2">供給結構詳細分析</h3>
                     <div className="flex-1 min-h-0">
                        <StructureAnalysis 
                            data={filteredSupply} 
                            typeField="Process" 
                            valueField="Output_Tons" 
                            categoryFn={getProcessType}
                            colorMap={COLORS_PROCESS} 
                        />
                     </div>
                 </div>

                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[450px]">
                     <h3 className="font-bold text-slate-700 text-sm mb-2 border-b pb-2">需求結構詳細分析</h3>
                     <div className="flex-1 min-h-0">
                        <StructureAnalysis 
                            data={filteredDemand} 
                            typeField="Usage_Type" 
                            valueField="Demand_Tons" 
                            categoryFn={getUsageCategory}
                            colorMap={COLORS_USAGE} 
                        />
                     </div>
                 </div>
             </div>

             {/* Row 3: Map */}
             <div className="grid grid-cols-1 gap-6">
                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[600px]">
                     <h3 className="font-bold text-slate-700 text-sm mb-4 border-b pb-2 flex items-center gap-2"><MapPin size={14}/> 區域重心 & 供需概況</h3>
                     <div className="flex-1 min-h-0">
                         {/* Replace SVG map with the new RegionalDeepDive component */}
                         <RegionalDeepDive supplyData={supplyData} demandData={demandData} />
                     </div>
                 </div>
             </div>

             {/* Row 4: Scatter */}
             <div className="grid grid-cols-1 gap-6">
                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[500px]">
                     <h3 className="font-bold text-slate-700 text-sm mb-4 border-b pb-2 flex items-center gap-2"><Leaf size={14}/> 碳排強度矩陣 (Log Scale) & 產能對照</h3>
                     <div className="flex-1 min-h-0 flex gap-2">
                         {/* Scatter Chart: X=Output(Log), Y=Intensity */}
                         <div className="flex-1 h-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart margin={{top:20, right:20, bottom:20, left:20}}>
                                    <CartesianGrid />
                                    <XAxis type="number" dataKey="output" name="產量" unit="萬噸" tick={{fontSize:10}} scale="log" domain={['auto', 'auto']}>
                                        <Label value="產量 (萬噸) - Log" offset={-10} position="insideBottom" />
                                    </XAxis>
                                    <YAxis type="number" dataKey="intensity" name="強度" unit="kg/kg" tick={{fontSize:10}} domain={['auto', 'auto']}>
                                        <Label value="碳排強度 (kg CO2e/kg H2)" angle={-90} position="insideLeft" />
                                    </YAxis>
                                    <ZAxis type="number" dataKey="total_emission" range={[50, 400]} />
                                    <Tooltip cursor={{strokeDasharray:'3 3'}} formatter={(v, n) => [v.toLocaleString(), n]} />
                                    <Scatter name="廠區" data={efficiencyChartData} fill="#10b981">
                                        <LabelList dataKey="name" position="top" style={{fontSize:10, fill:'#475569'}} />
                                        {efficiencyChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={
                                                entry.intensity > 15 ? '#ef4444' : 
                                                entry.intensity > 8 ? '#f59e0b' : 
                                                '#10b981'
                                            } />
                                        ))}
                                    </Scatter>
                                </ScatterChart>
                            </ResponsiveContainer>
                         </div>
                         
                         {/* Composed Chart: Bar(Output) + Line(Intensity) */}
                         <div className="flex-1 h-full border-l border-slate-100 pl-2">
                            <ResponsiveContainer width="100%" height="100%">
                                 <ComposedChart data={efficiencyChartData} margin={{top:20, right:20, bottom:20, left:20}}>
                                     <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                     <XAxis dataKey="name" angle={-30} textAnchor="end" height={60} tick={{fontSize:9}} interval={0}/>
                                     <YAxis yAxisId="left" label={{ value: '產量', angle: -90, position: 'insideLeft', fontSize:10 }} tick={{fontSize:10}}/>
                                     <YAxis yAxisId="right" orientation="right" label={{ value: '強度', angle: 90, position: 'insideRight', fontSize:10 }} tick={{fontSize:10}}/>
                                     <Tooltip />
                                     <Legend wrapperStyle={{fontSize:'10px'}}/>
                                     <Bar yAxisId="left" dataKey="output" name="產量" fill="#3b82f6" barSize={15} />
                                     <Line yAxisId="right" type="monotone" dataKey="intensity" name="強度" stroke="#ef4444" strokeWidth={2} dot={false}/>
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
                   {renderRawTable(rawData.supply, "供給端原始資料")}
                   {renderRawTable(rawData.demand, "需求端原始資料")}
               </div>
           </div>
       )}
    </div>
  );
};

export default HydrogenDashboard;