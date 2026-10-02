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
  exportToCSV, copyToClipboard
} from '../utils/helpers';
import CountryAnalysis from './trade/CountryAnalysis';
import TradeKpis from './trade/TradeKpis';
import ProductGroupAnalysis from './trade/ProductGroupAnalysis';
import { ErrorBoundary, CustomTimeTooltip, renderCustomizedLabel, KPICard, MultiSelectDropdown, Segmented, ScrollableChart } from './SharedComponents';

const TradeDashboard = ({
  useRealData, dataset, setDataset, setDataHealth,
  searchQuery, setSearchQuery, inputValue, setInputValue, 
  currentTopic, setCurrentTopic, detectedProductName, setDetectedProductName,
  setFetchError, setLoading, loading
}) => {
  const [activeTab, setActiveTab] = useState('overview'); 
  const [timeRange, setTimeRange] = useState(120); 
  const [granularity, setGranularity] = useState('month'); 
  // 時間趨勢「國家堆疊」沿用的檢視設定（國家分析分頁有自己的切換）
  const countryViewType = '出口';
  const countryMetric = 'value';
  const [pivotMode, setPivotMode] = useState('time'); 
  const [topicMetric, setTopicMetric] = useState('value');
  const [selectedTopicCodes, setSelectedTopicCodes] = useState([]); 
  const [selectedRegion, setSelectedRegion] = useState('ALL'); 
  const currencyUnit = 'thousand';
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

  // 只套區域、不套時間範圍（給 KPI 年增率用）
  const regionData = useMemo(() => {
    if (selectedRegion === 'ALL') return displayData;
    const countries = TRADE_REGIONS[selectedRegion].countries;
    return displayData.filter(d => countries.some(c => d.country.includes(c)));
  }, [displayData, selectedRegion]);

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

  // ** 3. Render Helpers **
  const renderOverviewTab = () => (
    <div className="space-y-6">
        <div className="card p-4  h-96 flex flex-col">
            <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                <h3 className="text-base md:text-lg font-bold">趨勢圖 A：{trendViewMode === 'summary' ? '金額與單價' : '國家佔比堆疊'}</h3>
                <Segmented value={trendViewMode} onChange={setTrendViewMode} options={[{ value: 'summary', label: '總量趨勢' }, { value: 'country_stack', label: '國家堆疊' }]} />
            </div>
            <p className="md:hidden text-xs text-brand-muted -mt-1 mb-2">期數多時可左右滑動圖表 · 點圖看當期數值</p>
            <ScrollableChart points={aggregatedData.length} className="flex-1 min-h-0 relative w-full">
                <ResponsiveContainer width="100%" height="100%">
                {trendViewMode === 'summary' ? (
                    <ComposedChart data={aggregatedData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{fontSize: 11}} />
                        <YAxis yAxisId="left" tickFormatter={(val) => formatCurrencyAxis(val, currencyUnit)} label={{ value: `金額 (${getUnitLabel(currencyUnit)})`, angle: -90, position: 'insideLeft', style: {fontSize: 11, fill: '#64748b'} }} tick={{fontSize: 11}} />
                        <YAxis yAxisId="right" orientation="right" tickFormatter={(val) => val.toFixed(1)} tick={{fontSize: 11}} unit=" $"/>
                        <Tooltip content={<CustomTimeTooltip />} />
                        <Legend />
                        <Bar yAxisId="left" dataKey="exportValue" name="出口金額" fill="#2a5ee8" />
                        <Bar yAxisId="left" dataKey="importValue" name="進口金額" fill="#0fb3d1" />
                        <Line yAxisId="right" type="monotone" dataKey="avgExportPrice" name="出口單價" stroke="#f2994a" strokeWidth={2} dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="avgImportPrice" name="進口單價" stroke="#7b61ff" strokeWidth={2} dot={false} />
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
            </ScrollableChart>
        </div>

        <div className="card p-3 md:p-4 h-80 flex flex-col">
            <h3 className="text-base md:text-lg font-bold mb-3 flex items-center gap-2">
                <Database size={17} className="text-brand-cyan"/>
                趨勢圖 B：進出口量體（重量比較）
            </h3>
            <ScrollableChart points={aggregatedData.length} className="flex-1 min-h-0 relative w-full">
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aggregatedData} barGap={0}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{fontSize: 11}} />
                    <YAxis tickFormatter={formatSmartWeight} label={{ value: '重量(KG/MT)', angle: -90, position: 'insideLeft', style: {fontSize: 11, fill: '#64748b'} }} tick={{fontSize: 11}} />
                    <Tooltip content={<CustomTimeTooltip />} />
                    <Legend wrapperStyle={{fontSize: '12px'}}/>
                    <Bar dataKey="exportWeight" name="出口重量" fill="#2a5ee8" fillOpacity={0.8} />
                    <Bar dataKey="importWeight" name="進口重量" fill="#0fb3d1" fillOpacity={0.8} />
                </BarChart>
                </ResponsiveContainer>
            </ScrollableChart>
        </div>
    </div>
  );

  const renderCountryTab = () => <CountryAnalysis filteredData={filteredData} granularity={granularity} />;

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
                <button onClick={() => copyToClipboard(pivotMode === 'time' ? aggregatedData : pivotCountryData)} className="flex items-center gap-1 h-10 px-3.5 bg-white border border-brand-line rounded-lg text-sm hover:bg-slate-50"><Copy size={14}/> 複製</button>
                <button onClick={() => exportToCSV(pivotMode === 'time' ? aggregatedData : pivotCountryData, 'Trade_Pivot_Data')} className="flex items-center gap-1 h-10 px-3.5 bg-brand text-white rounded-lg text-sm font-bold hover:bg-brand-dark"><Download size={14}/> 匯出</button>
            </div>
        </div>
        
        <div className="flex-1 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-auto flex-1">
                <table className="w-full text-sm text-left relative whitespace-nowrap">
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
      <ProductGroupAnalysis dataset={dataset} searchQuery={currentTopic ? '' : searchQuery}
        events={[...(currentTopic && TOPIC_MILESTONES[currentTopic] ? TOPIC_MILESTONES[currentTopic] : []), ...GLOBAL_EVENTS].sort((x, y) => x.date.localeCompare(y.date))}
        eventTitle={currentTopic ? '重大事件與專題政策時間軸' : '重大歷史事件簿'} />
  );

  const renderTopicOverview = () => (
      <div className="space-y-6">
          <div className="card p-4 ">
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
              <div className="card p-4 ">
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
              <div className="card p-4  overflow-auto">
                  <h4 className="font-bold text-slate-700 mb-4">清單產品明細</h4>
                  <table className="w-full text-sm text-left whitespace-nowrap">
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
    <div className="px-4 md:px-7 py-4 md:py-5 space-y-4 md:space-y-5 flex-1 min-w-0">
          {/* 全域篩選列：範圍 / 區域 / 粒度 */}
          <div className="card px-3 md:px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-3">
             <div className="flex items-center gap-2 max-w-full">
               <span className="text-xs font-bold text-brand-muted flex items-center gap-1 flex-shrink-0"><Calendar size={14}/> 範圍</span>
               <div className="overflow-x-auto no-scrollbar"><Segmented value={timeRange} onChange={setTimeRange} options={[{ value: 12, label: '近 1 年' }, { value: 36, label: '近 3 年' }, { value: 60, label: '近 5 年' }, { value: 120, label: '近 10 年' }]} /></div>
             </div>
             <div className="flex items-center gap-2">
               <span className="text-xs font-bold text-brand-muted flex items-center gap-1 flex-shrink-0"><MapIcon size={14}/> 區域</span>
               <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)} aria-label="區域" className="h-10 px-3 border border-brand-line rounded-lg text-sm font-bold text-brand bg-white">
                 <option value="ALL">全部國家</option>
                 {Object.entries(TRADE_REGIONS).map(([key, val]) => (<option key={key} value={key}>{val.label}</option>))}
               </select>
             </div>
             <div className="flex items-center gap-2">
               <span className="text-xs font-bold text-brand-muted flex items-center gap-1 flex-shrink-0"><ListFilter size={14}/> 粒度</span>
               <Segmented value={granularity} onChange={setGranularity} options={[{ value: 'month', label: '月' }, { value: 'quarter', label: '季' }, { value: 'year', label: '年' }]} />
             </div>
             {currentTopic && (
                <div className="md:ml-auto flex flex-wrap gap-2 items-center">
                    <button onClick={() => setSelectedTopicCodes([])} className={`h-9 px-3 text-sm rounded-full border transition-colors ${selectedTopicCodes.length === 0 ? 'bg-brand-soft text-brand-dark border-brand/30 font-bold' : 'bg-white text-brand-muted border-brand-line hover:bg-slate-50'}`}>全部 (All)</button>
                    <MultiSelectDropdown options={STRATEGIC_TOPICS[currentTopic].items} selected={selectedTopicCodes} onChange={setSelectedTopicCodes} label="細項" />
                </div>
            )}
          </div>

          <TradeKpis filteredData={filteredData} regionData={regionData} loading={loading} />

          <ErrorBoundary>
            <div className="card overflow-hidden flex flex-col min-h-[500px]">
              <div role="tablist" aria-label="資訊分頁" className="border-b border-brand-line flex overflow-x-auto no-scrollbar px-2 md:px-4">
                  {currentTopic && <button role="tab" onClick={() => setActiveTab('topic_overview')} className={`tab-btn ${activeTab === 'topic_overview' ? 'tab-btn-on' : ''}`}><Layers size={17}/> 專題總覽</button>}
                  {NAV_ITEMS.map(item => (
                      <button key={item.id} role="tab" onClick={() => setActiveTab(item.id)} className={`tab-btn ${activeTab === item.id ? 'tab-btn-on' : ''}`}>
                          <item.icon size={17}/> {item.label}
                      </button>
                  ))}
              </div>

              <div className="flex-1 p-3 md:p-6 bg-brand-ground/60">
                {loading ? <div className="h-64 flex items-center justify-center text-brand-muted">資料載入中…（首次約需 40–50 秒）</div> : renderContent()}
              </div>
            </div>
          </ErrorBoundary>
    </div>
  );
};

export default TradeDashboard;
