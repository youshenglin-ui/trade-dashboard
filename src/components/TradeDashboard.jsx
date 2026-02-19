import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, ComposedChart, ReferenceLine 
} from 'recharts';
import { 
  TrendingUp, AlertTriangle, Database, ArrowRightLeft, Download, Table as TableIcon, 
  Calendar, Copy, ListFilter, Globe, Search, RefreshCw, BookOpen, Layers, Map as MapIcon 
} from 'lucide-react';
import { 
  NAV_ITEMS, GLOBAL_EVENTS, TRADE_REGIONS, STRATEGIC_TOPICS, TOPIC_MILESTONES, COLORS 
} from '../utils/constants';
import { 
  normalizeCode, isHsCodeMatch, cleanNumber, sanitizeForChart, formatSmartWeight, 
  formatValueByUnit, getUnitLabel, formatCurrencyAxis, mapEventToDateKey, 
  exportToCSV, copyToClipboard, parseCSV_Safe 
} from '../utils/helpers';
import { ErrorBoundary, CustomTimeTooltip, renderCustomizedLabel, KPICard, MultiSelectDropdown } from './SharedComponents';

const TradeDashboard = ({ 
  dataSources, useRealData, dataset, setDataset, setDataHealth, 
  searchQuery, setSearchQuery, inputValue, setInputValue, 
  currentTopic, setCurrentTopic, detectedProductName, setDetectedProductName,
  setFetchError, setLoading, loading
}) => {
  const [activeTab, setActiveTab] = useState('overview'); 
  const [timeRange, setTimeRange] = useState(120); 
  const [granularity, setGranularity] = useState('month'); 
  const [countryViewType, setCountryViewType] = useState('出口'); 
  const [countryMetric, setCountryMetric] = useState('value'); 
  const [countryTopN, setCountryTopN] = useState('5'); 
  const [pivotMode, setPivotMode] = useState('time'); 
  const [topicMetric, setTopicMetric] = useState('value');
  const [selectedTopicCodes, setSelectedTopicCodes] = useState([]); 
  const [selectedRegion, setSelectedRegion] = useState('ALL'); 
  const [currencyUnit, setCurrencyUnit] = useState('thousand');
  const [topicChartLevel, setTopicChartLevel] = useState('hs2'); 
  const [trendViewMode, setTrendViewMode] = useState('summary');
  const [displayData, setDisplayData] = useState([]);
  const [relatedProducts, setRelatedProducts] = useState([]);

  // ** 1. Data Filtering Logic **
  useEffect(() => {
      // Re-trigger filter when dataset or query params change
      if (dataset.length > 0) {
          filterData(dataset, searchQuery);
      }
  }, [dataset, searchQuery, currentTopic, selectedTopicCodes]);

  const filterData = (allData, query) => {
      const aggMap = new Map();
      let targetCodes = [];
      let excludes = [];
      
      if (currentTopic) {
          if (selectedTopicCodes.length > 0) {
               targetCodes = selectedTopicCodes;
               selectedTopicCodes.forEach(code => {
                   const itemDef = STRATEGIC_TOPICS[currentTopic].items.find(i => i.code === code);
                   if(itemDef && itemDef.excludes) excludes.push(...itemDef.excludes);
               });
          } else {
               targetCodes = []; 
          }
      } else {
          targetCodes = [query];
      }

      const cleanQuery = normalizeCode(query).toLowerCase();

      allData.forEach(d => {
          let isMatch = false;
          const rawCleanCode = normalizeCode(d.hsCode);

          if (excludes.some(ex => rawCleanCode.startsWith(normalizeCode(ex)))) return;

          if (currentTopic) {
              isMatch = targetCodes.some(c => isHsCodeMatch(d.hsCode, c));
          } else {
              isMatch = isHsCodeMatch(d.hsCode, cleanQuery) || (d.productName && d.productName.toLowerCase().includes(cleanQuery));
          }

          if (isMatch) {
              const key = `${d.date}-${d.country}-${d.type}-${d.hsCode}`;
              if (!aggMap.has(key)) aggMap.set(key, { ...d });
              else {
                  const existing = aggMap.get(key);
                  existing.value += d.value;
                  existing.weight += d.weight;
              }
          }
      });

      const filtered = Array.from(aggMap.values());
      
      const relatedSet = new Set();
      if (!currentTopic) {
        filtered.forEach(d => relatedSet.add(d.hsCode));
      }
      const relatedList = Array.from(relatedSet).map(code => {
          const found = allData.find(d => d.hsCode === code);
          return { code, name: found ? found.productName : code };
      }).slice(0, 50); 
      setRelatedProducts(relatedList.sort((a, b) => a.code.localeCompare(b.code)));

      let displayTitle = '';
      if (currentTopic) {
          displayTitle = STRATEGIC_TOPICS[currentTopic].title;
          if (selectedTopicCodes.length > 0) {
              if (selectedTopicCodes.length === 1) {
                  const item = STRATEGIC_TOPICS[currentTopic].items.find(i => i.code === selectedTopicCodes[0]);
                  if (item) displayTitle += ` - ${item.name}`;
              } else {
                  displayTitle += ` (已選 ${selectedTopicCodes.length} 項)`;
              }
          }
      } else {
          const candidate = filtered.find(d => d.productName);
          displayTitle = candidate ? candidate.productName : '搜尋結果';
      }
      setDetectedProductName(displayTitle);
      setDisplayData(filtered);
  };

  // ** 2. Derived Data for Charts **
  const filteredData = useMemo(() => {
    if (displayData.length === 0) return [];
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - timeRange);
    const cutoffStr = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth()+1).padStart(2,'0')}`;
    
    return displayData.filter(d => {
        if (d.date < cutoffStr) return false;
        if (selectedRegion !== 'ALL') {
            const countries = TRADE_REGIONS[selectedRegion].countries;
            return countries.some(c => d.country.includes(c));
        }
        return true;
    });
  }, [displayData, timeRange, selectedRegion]);

  const aggregatedData = useMemo(() => {
    const map = {};
    filteredData.forEach(d => {
      let key = d.date;
      if (granularity === 'year') key = d.year;
      else if (granularity === 'quarter') {
          const month = parseInt(d.date.split('-')[1]);
          const q = Math.floor((month + 2) / 3);
          key = `${d.year}-Q${q}`;
      }
      if (!map[key]) map[key] = { date: key, exportValue: 0, importValue: 0, exportWeight: 0, importWeight: 0, count: 0 };
      const isExport = d.type.includes('出') || d.type === 'E';
      if (isExport) { map[key].exportValue += d.value; map[key].exportWeight += d.weight; }
      else { map[key].importValue += d.value; map[key].importWeight += d.weight; }
      map[key].count += 1;
    });
    const result = Object.values(map).map(d => {
      const avgExportPrice = d.exportWeight > 0 ? (d.exportValue * 1000) / d.exportWeight : 0;
      const avgImportPrice = d.importWeight > 0 ? (d.importValue * 1000) / d.importWeight : 0;
      return {
        ...d,
        totalValue: d.exportValue + d.importValue,
        totalWeight: d.exportWeight + d.importWeight,
        tradeBalance: d.exportValue - d.importValue,
        tradeBalanceWeight: d.exportWeight - d.importWeight, 
        avgExportPrice: isFinite(avgExportPrice) ? parseFloat(avgExportPrice.toFixed(2)) : 0,
        avgImportPrice: isFinite(avgImportPrice) ? parseFloat(avgImportPrice.toFixed(2)) : 0
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
    return sanitizeForChart(result); 
  }, [filteredData, granularity]);

  const pivotCountryData = useMemo(() => {
      const map = {};
      filteredData.forEach(d => {
          const key = d.country;
          if (!map[key]) map[key] = { country: key, exportValue: 0, importValue: 0, exportWeight: 0, importWeight: 0 };
          const isExport = d.type.includes('出') || d.type === 'E';
          if (isExport) { map[key].exportValue += d.value; map[key].exportWeight += d.weight; }
          else { map[key].importValue += d.value; map[key].importWeight += d.weight; }
      });
      return Object.values(map).map(d => {
          const avgExport = d.exportWeight > 0 ? (d.exportValue * 1000)/d.exportWeight : 0;
          const avgImport = d.importWeight > 0 ? (d.importValue * 1000)/d.importWeight : 0;
          return {
            ...d,
            totalValue: d.exportValue + d.importValue,
            tradeBalance: d.exportValue - d.importValue,
            tradeBalanceWeight: d.exportWeight - d.importWeight,
            avgExportPrice: isFinite(avgExport) ? parseFloat(avgExport.toFixed(2)) : 0,
            avgImportPrice: isFinite(avgImport) ? parseFloat(avgImport.toFixed(2)) : 0,
          };
      }).sort((a, b) => b.totalValue - a.totalValue);
  }, [filteredData]);

  const countryPieData = useMemo(() => {
    const map = {};
    const isExportView = countryViewType === '出口';
    const isBalanceView = countryViewType === 'balance';
    
    if (isBalanceView) {
         filteredData.forEach(d => {
             if (!map[d.country]) map[d.country] = { name: d.country, value: 0 };
             map[d.country].value += (countryMetric === 'value' ? d.value : d.weight);
         });
    } else {
        filteredData.forEach(d => {
            const isExport = d.type.includes('出') || d.type === 'E';
            if (isExport === isExportView) {
                 if (!map[d.country]) map[d.country] = { name: d.country, value: 0 };
                 map[d.country].value += (countryMetric === 'value' ? d.value : d.weight);
            }
        });
    }
    const sorted = Object.values(map).sort((a, b) => b.value - a.value);
    const sliceIndex = countryTopN === 'all' ? undefined : parseInt(countryTopN);
    return sorted.slice(0, sliceIndex);
  }, [filteredData, countryViewType, countryMetric, countryTopN]);

  const countryTrendData = useMemo(() => {
      const topCountries = pivotCountryData.slice(0, parseInt(countryTopN === 'all' ? 10 : countryTopN)).map(c => c.country);
      const map = {};
      aggregatedData.forEach(t => { map[t.date] = { date: t.date }; topCountries.forEach(c => map[t.date][c] = 0); });

      filteredData.forEach(d => {
          if (topCountries.includes(d.country)) {
              let key = d.date;
              if (granularity === 'year') key = d.year;
              else if (granularity === 'quarter') {
                  const m = parseInt(d.date.split('-')[1]);
                  key = `${d.year}-Q${Math.floor((m+2)/3)}`;
              }
              if (map[key]) {
                  const val = countryMetric === 'value' ? d.value : d.weight;
                  const isExport = d.type.includes('出') || d.type === 'E';
                  if (countryViewType === 'balance') map[key][d.country] += (isExport ? val : -val);
                  else {
                      const viewIsExport = countryViewType === '出口';
                      if (isExport === viewIsExport) map[key][d.country] += val;
                  }
              }
          }
      });
      return sanitizeForChart(Object.values(map).sort((a, b) => a.date.localeCompare(b.date)));
  }, [filteredData, pivotCountryData, countryViewType, countryMetric, granularity, aggregatedData, countryTopN]);

  const summary = useMemo(() => {
    if (filteredData.length === 0) return { totalValue: 0, totalWeight: 0, avgPrice: 0 };
    const totalValue = filteredData.reduce((acc, curr) => acc + curr.value, 0);
    const totalWeight = filteredData.reduce((acc, curr) => acc + curr.weight, 0);
    const avg = totalWeight > 0 ? (totalValue * 1000) / totalWeight : 0;
    
    let valDisplay = formatValueByUnit(totalValue, currencyUnit);
    if (currencyUnit === 'thousand') {
        if (totalValue > 100000) valDisplay = (totalValue / 100000).toFixed(2) + ' 億';
        else valDisplay = (totalValue / 10000).toFixed(0) + ' 萬';
    }

    return { 
        totalValue: valDisplay, 
        totalWeight: formatSmartWeight(totalWeight), 
        avgPrice: isFinite(avg) ? avg.toFixed(2) : 0 
    };
  }, [filteredData, currencyUnit]);

  const topicBreakdown = useMemo(() => {
      if (!currentTopic) return [];
      const map = {};
      filteredData.forEach(d => {
          const matchedItem = STRATEGIC_TOPICS[currentTopic].items.find(i => isHsCodeMatch(d.hsCode, i.code));
          if (matchedItem) {
              const key = matchedItem.code;
              if (!map[key]) map[key] = { code: key, name: matchedItem.name, value: 0, weight: 0 };
              map[key].value += d.value;
              map[key].weight += d.weight;
          }
      });
      const metric = topicMetric;
      return Object.values(map).sort((a, b) => b[metric] - a[metric]);
  }, [filteredData, currentTopic, topicMetric]);

  const topicTrendData = useMemo(() => {
      if (!currentTopic || !dataset.length) return { data: [], keys: [] };
      const map = {};
      const topicItemDefs = STRATEGIC_TOPICS[currentTopic].items;
      
      filteredData.forEach(d => {
          if (!topicItemDefs.some(i => isHsCodeMatch(d.hsCode, i.code, i.excludes))) return;
          let key = d.date; 
          if (granularity === 'year') key = d.year;
          else if (granularity === 'quarter') {
              const m = parseInt(d.date.split('-')[1]);
              key = `${d.year}-Q${Math.floor((m+2)/3)}`;
          }
          
          let category = 'Unknown';
          if (topicChartLevel === 'hs2') category = d.hsCode.substring(0, 2);
          else if (topicChartLevel === 'hs4') category = d.hsCode.substring(0, 4);
          else if (topicChartLevel === 'group') {
              const item = topicItemDefs.find(i => isHsCodeMatch(d.hsCode, i.code));
              category = item ? item.group : '其他';
          }
          if (!map[key]) map[key] = { date: key };
          if (!map[key][category]) map[key][category] = 0;
          map[key][category] += (topicMetric === 'value' ? d.value : d.weight);
      });
      
      const allKeys = new Set();
      Object.values(map).forEach(obj => Object.keys(obj).forEach(k => { if(k !== 'date') allKeys.add(k); }));
      return { 
          data: Object.values(map).sort((a, b) => a.date.localeCompare(b.date)),
          keys: Array.from(allKeys)
      };
  }, [filteredData, currentTopic, topicMetric, topicChartLevel, granularity, dataset]);

  const countryStackData = useMemo(() => {
      if (!filteredData.length) return { data: [], keys: [] };
      const topCountries = pivotCountryData.slice(0, 5).map(c => c.country);
      const map = {};
      
      filteredData.forEach(d => {
          let key = d.date; 
          if (granularity === 'year') key = d.year;
          else if (granularity === 'quarter') {
              const m = parseInt(d.date.split('-')[1]);
              key = `${d.year}-Q${Math.floor((m+2)/3)}`;
          }
          let countryName = topCountries.includes(d.country) ? d.country : '其他國家';
          if (!map[key]) map[key] = { date: key };
          if (!map[key][countryName]) map[key][countryName] = 0;
          
          const isExport = d.type.includes('出') || d.type === 'E';
          if (countryViewType === '出口' && isExport) {
              map[key][countryName] += (countryMetric === 'value' ? d.value : d.weight);
          } else if (countryViewType === '進口' && !isExport) {
              map[key][countryName] += (countryMetric === 'value' ? d.value : d.weight);
          }
      });
      
      const keys = [...topCountries, '其他國家'];
      return { 
          data: Object.values(map).sort((a, b) => a.date.localeCompare(b.date)),
          keys 
      };
  }, [filteredData, pivotCountryData, countryViewType, countryMetric, granularity]);

  const crossProductComparison = useMemo(() => {
      if (!useRealData) return [];
      const topCountries = pivotCountryData.slice(0, 5).map(c => c.country);
      const productMap = {};
      dataset.forEach(d => {
          if (topCountries.includes(d.country) && d.hsCode !== searchQuery) { 
              if (!productMap[d.hsCode]) {
                  productMap[d.hsCode] = { code: d.hsCode, name: d.productName || d.hsCode, totalValue: 0 };
              }
              productMap[d.hsCode].totalValue += d.value;
          }
      });
      return Object.values(productMap).sort((a, b) => b.totalValue - a.totalValue).slice(0, 5); 
  }, [dataset, pivotCountryData, useRealData, searchQuery]);

  // ** 3. Render Helpers **
  const renderOverviewTab = () => (
    <div className="space-y-6">
        <div className="bg-white p-4 rounded-lg shadow-sm h-96">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-700">趨勢圖 A: {trendViewMode === 'summary' ? '金額與單價' : '國家佔比堆疊'}</h3>
                <div className="flex bg-slate-100 p-1 rounded-md text-xs font-bold">
                    <button onClick={() => setTrendViewMode('summary')} className={`px-2 py-1 rounded ${trendViewMode === 'summary' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>總量趨勢</button>
                    <button onClick={() => setTrendViewMode('country_stack')} className={`px-2 py-1 rounded ${trendViewMode === 'country_stack' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>國家堆疊</button>
                </div>
            </div>
            
            <ResponsiveContainer width="100%" height="90%">
            {trendViewMode === 'summary' ? (
                <ComposedChart data={aggregatedData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{fontSize: 11}} />
                    <YAxis yAxisId="left" tickFormatter={(val) => formatCurrencyAxis(val, currencyUnit)} label={{ value: `金額 (${getUnitLabel(currencyUnit)})`, angle: -90, position: 'insideLeft', style: {fontSize: 11, fill: '#64748b'} }} tick={{fontSize: 11}} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(val) => val.toFixed(1)} tick={{fontSize: 11}} unit=" $"/>
                    <Tooltip content={<CustomTimeTooltip />} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="exportValue" name="出口金額" fill="#3b82f6" />
                    <Bar yAxisId="left" dataKey="importValue" name="進口金額" fill="#10b981" />
                    <Line yAxisId="right" type="monotone" dataKey="avgExportPrice" name="出口單價" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="avgImportPrice" name="進口單價" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                    {GLOBAL_EVENTS.map((event, i) => (
                    <ReferenceLine key={i} x={mapEventToDateKey(event.date, granularity)} yAxisId="left" stroke="red" strokeDasharray="3 3" label={{ position: 'top', value: '!', fill: 'red', fontSize: 10 }} />
                    ))}
                </ComposedChart>
            ) : (
                <BarChart data={countryStackData.data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{fontSize: 11}} />
                    <YAxis tickFormatter={(val) => countryMetric === 'value' ? formatCurrencyAxis(val, currencyUnit) : formatSmartWeight(val)} tick={{fontSize: 11}} />
                    <Tooltip formatter={(val) => countryMetric === 'value' ? formatCurrencyAxis(val, currencyUnit) : formatSmartWeight(val)} />
                    <Legend />
                    {countryStackData.keys.map((key, i) => (
                        <Bar key={key} dataKey={key} stackId="a" fill={COLORS[i % COLORS.length]} />
                    ))}
                </BarChart>
            )}
            </ResponsiveContainer>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm h-80">
            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                <Database size={16} className="text-emerald-500"/>
                趨勢圖 B: 進出口量體 (重量比較)
            </h3>
            <ResponsiveContainer width="100%" height="90%">
            <BarChart data={aggregatedData} barGap={0}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{fontSize: 11}} />
                <YAxis tickFormatter={formatSmartWeight} label={{ value: '重量(KG/MT)', angle: -90, position: 'insideLeft', style: {fontSize: 11, fill: '#64748b'} }} tick={{fontSize: 11}} />
                <Tooltip content={<CustomTimeTooltip />} />
                <Legend wrapperStyle={{fontSize: '12px'}}/>
                <Bar dataKey="exportWeight" name="出口重量" fill="#8884d8" fillOpacity={0.8} />
                <Bar dataKey="importWeight" name="進口重量" fill="#82ca9d" fillOpacity={0.8} />
            </BarChart>
            </ResponsiveContainer>
        </div>
    </div>
  );

  const renderCountryTab = () => (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-4">
                <div className="flex bg-slate-200 p-1 rounded-lg">
                    {['出口', '進口', 'balance'].map(mode => (
                        <button key={mode} onClick={() => setCountryViewType(mode)} className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${countryViewType === mode ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600'}`}>
                            {mode === 'balance' ? '順逆差' : mode}
                        </button>
                    ))}
                </div>
                <select value={countryTopN} onChange={(e) => setCountryTopN(e.target.value)} className="border rounded px-2 text-sm"><option value="5">Top 5</option><option value="10">Top 10</option><option value="all">All</option></select>
                <div className="flex items-center gap-2 text-sm text-slate-600 ml-2">
                    <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={countryMetric === 'value'} onChange={() => setCountryMetric('value')} className="text-blue-600"/> 金額</label>
                    <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={countryMetric === 'weight'} onChange={() => setCountryMetric('weight')} className="text-blue-600"/> 重量</label>
                </div>
            </div>
            <div className="flex gap-2">
                <button onClick={() => copyToClipboard(pivotCountryData)} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded text-sm hover:bg-slate-50 text-slate-700"><Copy size={14}/> 複製</button>
                <button onClick={() => exportToCSV(pivotCountryData, `Country_Data_${countryViewType}`)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"><Download size={14}/> 下載</button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm h-80">
                <h4 className="font-bold text-center mb-2">{countryViewType === 'balance' ? '貿易總額佔比 (依存度)' : '總量佔比'}</h4>
                <ResponsiveContainer width="100%" height="90%">
                    <PieChart>
                        <Pie data={countryPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" label={renderCustomizedLabel}>
                            {countryPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(val) => countryMetric === 'value' ? formatCurrencyAxis(val, currencyUnit) : formatSmartWeight(val)} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm h-80">
                <h4 className="font-bold text-center mb-2">{countryViewType === 'balance' ? '順逆差趨勢' : '各國趨勢競賽'}</h4>
                <ResponsiveContainer width="100%" height="90%">
                    <LineChart data={countryTrendData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{fontSize: 10}} />
                        <YAxis tickFormatter={countryMetric==='value'?formatCurrencyAxis:formatSmartWeight} tick={{fontSize: 10}} />
                        <Tooltip formatter={(value, name) => [(value || 0).toLocaleString(), name]} />
                        <Legend wrapperStyle={{fontSize: '10px'}}/>
                        {pivotCountryData.slice(0, parseInt(countryTopN === 'all' ? 10 : countryTopN)).map((c, i) => (
                            <Line key={c.country} type="monotone" dataKey={c.country} stroke={COLORS[i % COLORS.length]} dot={false} strokeWidth={2} />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
        
        {/* Country Table */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col h-96">
            <div className="overflow-auto flex-1">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0">
                        <tr>
                            <th className="px-4 py-3">國家</th>
                            <th className="px-4 py-3 text-right">出口額 ({getUnitLabel(currencyUnit)})</th>
                            <th className="px-4 py-3 text-right">進口額 ({getUnitLabel(currencyUnit)})</th>
                            <th className="px-4 py-3 text-right font-bold text-blue-600">順逆差 ({getUnitLabel(currencyUnit)})</th>
                            <th className="px-4 py-3 text-right">出口重量</th>
                            <th className="px-4 py-3 text-right">進口重量</th>
                            <th className="px-4 py-3 text-right text-amber-600">出口單價</th><th className="px-4 py-3 text-right text-amber-600">進口單價</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {pivotCountryData.slice(0, parseInt(countryTopN === 'all' ? 100 : countryTopN)).map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                                <td className="px-4 py-2 font-medium text-slate-800">{row.country}</td>
                                <td className="px-4 py-2 text-right font-mono">{formatValueByUnit(row.exportValue, currencyUnit)}</td>
                                <td className="px-4 py-2 text-right font-mono">{formatValueByUnit(row.importValue, currencyUnit)}</td>
                                <td className={`px-4 py-2 text-right font-mono font-bold ${row.tradeBalance >= 0 ? 'text-slate-800' : 'text-red-500'}`}>{row.tradeBalance >= 0 ? '+' : ''}{formatValueByUnit(row.tradeBalance, currencyUnit)}</td>
                                <td className="px-4 py-2 text-right font-mono">{formatSmartWeight(row.exportWeight)}</td>
                                <td className="px-4 py-2 text-right font-mono">{formatSmartWeight(row.importWeight)}</td>
                                <td className="px-4 py-2 text-right font-mono text-amber-700">{row.avgExportPrice}</td>
                                <td className="px-4 py-2 text-right font-mono text-amber-700">{row.avgImportPrice}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
  );

  const renderPivotTab = () => (
      <div className="space-y-4 h-full flex flex-col">
        <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200">
            <div className="flex items-center gap-4">
                <h3 className="font-bold text-slate-700 flex items-center gap-2"><TableIcon size={18} className="text-blue-600"/> 數據樞紐</h3>
                <div className="flex bg-slate-100 p-1 rounded-md text-xs font-bold">
                    <button onClick={() => setPivotMode('time')} className={`px-3 py-1 rounded ${pivotMode === 'time' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>依時間</button>
                    <button onClick={() => setPivotMode('country')} className={`px-3 py-1 rounded ${pivotMode === 'country' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>依國家</button>
                </div>
            </div>
            <div className="flex gap-2">
                <button onClick={() => copyToClipboard(pivotMode === 'time' ? aggregatedData : pivotCountryData)} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded text-sm hover:bg-slate-50 text-slate-700"><Copy size={14}/> 複製</button>
                <button onClick={() => exportToCSV(pivotMode === 'time' ? aggregatedData : pivotCountryData, 'Trade_Pivot_Data')} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"><Download size={14}/> 匯出</button>
            </div>
        </div>
        
        <div className="flex-1 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-auto flex-1">
                <table className="w-full text-sm text-left relative">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-100 border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-3 bg-slate-100">{pivotMode === 'time' ? `時間 (${granularity})` : '國家'}</th>
                            <th className="px-4 py-3 text-right bg-slate-100 text-blue-700">出口金額</th>
                            <th className="px-4 py-3 text-right bg-slate-100 text-emerald-700">進口金額</th>
                            <th className="px-4 py-3 text-right bg-slate-100 font-bold">金額順逆差</th>
                            <th className="px-4 py-3 text-right bg-slate-100 text-slate-500 border-l border-slate-200">出口重量</th>
                            <th className="px-4 py-3 text-right bg-slate-100 text-slate-500">進口重量</th>
                            <th className="px-4 py-3 text-right bg-slate-100 font-bold text-slate-700">重量順逆差</th>
                            <th className="px-4 py-3 text-right bg-slate-100 text-amber-600 border-l border-slate-200">出口單價</th>
                            <th className="px-4 py-3 text-right bg-slate-100 text-amber-600">進口單價</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {(pivotMode === 'time' ? aggregatedData : pivotCountryData).map((row, idx) => (
                                <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                                <td className="px-4 py-2 font-medium text-slate-800 whitespace-nowrap">{pivotMode === 'time' ? row.date : row.country}</td>
                                <td className="px-4 py-2 text-right font-mono text-blue-700">{formatValueByUnit(row.exportValue, currencyUnit)}</td>
                                <td className="px-4 py-2 text-right font-mono text-emerald-700">{formatValueByUnit(row.importValue, currencyUnit)}</td>
                                <td className={`px-4 py-2 text-right font-mono font-bold ${row.tradeBalance >= 0 ? 'text-slate-800' : 'text-red-500'}`}>{row.tradeBalance > 0 ? '+' : ''}{formatValueByUnit(row.tradeBalance, currencyUnit)}</td>
                                <td className="px-4 py-2 text-right font-mono text-slate-500 border-l border-slate-100">{formatSmartWeight(row.exportWeight)}</td>
                                <td className="px-4 py-2 text-right font-mono text-slate-500">{formatSmartWeight(row.importWeight)}</td>
                                <td className={`px-4 py-2 text-right font-mono font-bold ${row.tradeBalanceWeight >= 0 ? 'text-slate-600' : 'text-rose-500'}`}>{row.tradeBalanceWeight > 0 ? '+' : ''}{formatSmartWeight(row.tradeBalanceWeight)}</td>
                                <td className="px-4 py-2 text-right font-mono text-amber-700 border-l border-slate-100">{row.avgExportPrice}</td>
                                <td className="px-4 py-2 text-right font-mono text-amber-700">{row.avgImportPrice}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
  );

  const renderAnalysisTab = () => (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-lg">
                    <h4 className="font-bold text-rose-800 flex items-center gap-2 mb-2"><BookOpen size={18}/> 重大歷史事件簿</h4>
                    <p className="text-sm text-rose-700">{currentTopic ? '相關政策實施時間軸' : '影響國際貿易之重大事件一覽'}</p>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {(currentTopic && TOPIC_MILESTONES[currentTopic] ? TOPIC_MILESTONES[currentTopic] : GLOBAL_EVENTS).map((ev, i) => (
                        <div key={i} className="flex items-start gap-3 text-xs bg-white p-3 rounded border border-slate-200 hover:shadow-md transition-shadow">
                            <div className="font-mono text-slate-500 font-bold min-w-[60px] pt-0.5">{ev.date}</div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-600 font-bold`}>{ev.type || 'Event'}</span>
                                    <span className="text-slate-800 font-bold text-sm">{ev.label}</span>
                                </div>
                                <div className="text-slate-600 leading-relaxed">{ev.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                    <h4 className="font-bold text-blue-800 flex items-center gap-2 mb-2"><ArrowRightLeft size={18}/> 核心夥伴之關聯產品分析</h4>
                    <p className="text-sm text-blue-700">分析前 5 大貿易國在資料庫中其他產品 (稅號) 的交易情況。</p>
                </div>
                {crossProductComparison.length > 0 ? (
                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr><th className="px-3 py-2">關聯產品 (稅號)</th><th className="px-3 py-2 text-right">對應貿易額</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {crossProductComparison.map((prod, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50">
                                        <td className="px-3 py-2">
                                            <div className="font-medium text-slate-800">{prod.name}</div>
                                            <div className="text-slate-400 text-[10px]">{prod.code}</div>
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono text-blue-600">{(prod.totalValue || 0).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-8 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                        <p>尚無關聯數據。</p>
                        <p className="text-xs mt-1">(請確認 CSV 包含多種稅號資料)</p>
                    </div>
                )}
            </div>
        </div>
      </div>
  );

  const renderTopicOverview = () => (
      <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-slate-700">分類趨勢總覽</h4>
                  <div className="flex gap-4">
                     <div className="flex bg-slate-100 p-1 rounded-md text-xs font-bold">
                          <button onClick={() => setTopicChartLevel('hs2')} className={`px-2 py-1 rounded ${topicChartLevel === 'hs2' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>HS 2碼</button>
                          <button onClick={() => setTopicChartLevel('hs4')} className={`px-2 py-1 rounded ${topicChartLevel === 'hs4' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>HS 4碼</button>
                          <button onClick={() => setTopicChartLevel('group')} className={`px-2 py-1 rounded ${topicChartLevel === 'group' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>自訂分類</button>
                     </div>
                     <div className="w-px h-6 bg-slate-300"></div>
                     <div className="flex bg-slate-100 p-1 rounded-md text-xs font-bold">
                          <button onClick={() => setTopicMetric('value')} className={`px-2 py-1 rounded ${topicMetric === 'value' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>金額</button>
                          <button onClick={() => setTopicMetric('weight')} className={`px-2 py-1 rounded ${topicMetric === 'weight' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>重量</button>
                     </div>
                  </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topicTrendData.data}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tick={{fontSize: 10}} />
                      <YAxis tickFormatter={topicMetric==='value'?formatCurrencyAxis:formatSmartWeight} tick={{fontSize: 10}} />
                      <Tooltip formatter={(val) => topicMetric === 'value' ? formatCurrencyAxis(val, currencyUnit) : formatSmartWeight(val)} />
                      <Legend />
                      {topicTrendData.keys.map((key, i) => (
                          <Bar key={key} dataKey={key} stackId="a" fill={COLORS[i % COLORS.length]} />
                      ))}
                  </BarChart>
              </ResponsiveContainer>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                  <h4 className="font-bold text-slate-700 mb-4">細項產品佔比 (Top 10)</h4>
                  <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                          <Pie data={topicBreakdown.slice(0, 10)} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey={topicMetric} label={renderCustomizedLabel}>
                              {topicBreakdown.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                          </Pie>
                          <Tooltip formatter={(val) => topicMetric === 'value' ? formatCurrencyAxis(val, currencyUnit) : formatSmartWeight(val)} />
                          <Legend />
                      </PieChart>
                  </ResponsiveContainer>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 overflow-auto">
                  <h4 className="font-bold text-slate-700 mb-4">清單產品明細</h4>
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50"><tr><th className="p-2">代碼</th><th className="p-2">品名</th><th className="p-2 text-right">金額 ({getUnitLabel(currencyUnit)})</th><th className="p-2 text-right">重量</th></tr></thead>
                      <tbody>
                          {topicBreakdown.map((row, i) => (
                              <tr key={i} className="border-b">
                                  <td className="p-2 font-mono text-slate-500">{row.code}</td>
                                  <td className="p-2 font-medium">{row.name}</td>
                                  <td className="p-2 text-right text-blue-600">{formatValueByUnit(row.value, currencyUnit)}</td>
                                  <td className="p-2 text-right text-slate-600">{formatSmartWeight(row.weight)}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      </div>
  );

  const renderContent = () => {
      if (currentTopic && activeTab === 'topic_overview') return renderTopicOverview();

      switch(activeTab) {
          case 'overview': return renderOverviewTab();
          case 'country': return renderCountryTab();
          case 'pivot': return renderPivotTab();
          case 'analysis': return renderAnalysisTab();
          default: return renderOverviewTab();
      }
  };

  return (
    <div className="p-6 space-y-6 flex-1 overflow-auto">
          {/* Header Controls for Trade Dashboard */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 rounded-lg mb-4">
             <div className="flex items-center text-xs font-bold text-slate-500 uppercase"><Calendar size={14} className="mr-1"/> 範圍</div>
             <select value={timeRange} onChange={(e) => setTimeRange(Number(e.target.value))} className="bg-white border rounded px-2 py-1 text-sm"><option value={12}>近 1 年</option><option value={36}>近 3 年</option><option value={60}>近 5 年</option><option value={120}>近 10 年</option></select>
             <div className="w-px h-4 bg-slate-300 mx-1"></div>
             <div className="flex items-center text-xs font-bold text-slate-500 uppercase"><MapIcon size={14} className="mr-1"/> 區域</div>
             <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)} className="bg-white border rounded px-2 py-1 text-sm font-bold text-blue-700">
                 <option value="ALL">全部國家</option>
                 {Object.entries(TRADE_REGIONS).map(([key, val]) => (<option key={key} value={key}>{val.label}</option>))}
             </select>
             <div className="w-px h-4 bg-slate-300 mx-1"></div>
             <div className="flex items-center text-xs font-bold text-slate-500 uppercase"><ListFilter size={14} className="mr-1"/> 粒度</div>
             <select value={granularity} onChange={(e) => setGranularity(e.target.value)} className="bg-white border rounded px-2 py-1 text-sm"><option value="month">月</option><option value="quarter">季</option><option value="year">年</option></select>
             {currentTopic && (
                <div className="ml-auto flex flex-wrap gap-2 items-center">
                    <button onClick={() => setSelectedTopicCodes([])} className={`px-3 py-1 text-xs rounded-full border transition-colors ${selectedTopicCodes.length === 0 ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>全部 (All)</button>
                    <div className="relative">
                        <MultiSelectDropdown options={STRATEGIC_TOPICS[currentTopic].items} selected={selectedTopicCodes} onChange={setSelectedTopicCodes} label="細項" />
                    </div>
                </div>
            )}
          </div>

          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <KPICard title={`總貿易額 (${getUnitLabel(currencyUnit)})`} value={summary.totalValue} subtext="區間累計" trend="up" icon={TrendingUp} color="bg-blue-500"/>
              <KPICard title="總重量" value={summary.totalWeight} subtext="區間累計" trend="up" icon={Database} color="bg-emerald-500"/>
              <KPICard title="平均單價 (元/KG)" value={`$${summary.avgPrice}`} subtext="加權平均" trend="down" icon={AlertTriangle} color="bg-amber-500"/>
              <KPICard title="異常波動" value={0} subtext="待人工確認" trend="down" icon={AlertTriangle} color="bg-rose-500"/>
          </section>

          <ErrorBoundary>
            <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[500px]`}>
              <div className="border-b border-slate-200 flex overflow-x-auto">
                  {currentTopic && <button onClick={() => setActiveTab('topic_overview')} className={`px-5 py-3 text-sm font-bold flex items-center gap-2 ${activeTab === 'topic_overview' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600'}`}><Layers size={16}/> 專題總覽</button>}
                  {NAV_ITEMS.map(item => (
                      <button 
                          key={item.id} 
                          onClick={() => setActiveTab(item.id)} 
                          className={`px-5 py-3 text-sm font-bold flex items-center gap-2 ${activeTab === item.id ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600'}`}
                      >
                          <item.icon size={16}/> {item.label}
                      </button>
                  ))}
              </div>

              <div className={`flex-1 p-6 bg-slate-50/50`}>
                {loading ? <div className="h-full flex items-center justify-center">載入中...</div> : renderContent()}
              </div>
            </div>
          </ErrorBoundary>
    </div>
  );
};

export default TradeDashboard;