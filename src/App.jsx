import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Area, AreaChart } from 'recharts';
import { Search, History, TrendingUp, AlertTriangle, Globe, Database, ArrowUpRight, ArrowDownRight, Filter, Download, Table as TableIcon, Calendar, FileText, Copy, UploadCloud, Settings, Link as LinkIcon, RefreshCw, CheckCircle, Bug, Info, Tag, X, Star, ChevronDown, ListFilter, ArrowRightLeft } from 'lucide-react';

// --- 防崩潰核心：數值清洗函數 ---
const cleanNumber = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isFinite(val) ? val : 0;
  
  // 處理字串：移除逗號，處理 "-" 代表 0 的情況
  const str = String(val).trim();
  if (str === '-' || str === '－') return 0; 
  
  const num = parseFloat(str.replace(/[,，]/g, ''));
  return isFinite(num) ? num : 0;
};

// --- 防崩潰核心：圖表資料消毒 ---
// 確保所有進圖表的數據都是絕對安全的數字
const sanitizeForChart = (data) => {
  if (!Array.isArray(data)) return [];
  return data.map(item => {
    const cleanItem = { ...item };
    Object.keys(cleanItem).forEach(key => {
      if (typeof cleanItem[key] === 'number') {
        if (!isFinite(cleanItem[key]) || isNaN(cleanItem[key])) {
          cleanItem[key] = 0;
        }
      }
    });
    return cleanItem;
  });
};

// --- 安全的錯誤邊界元件 (UI 防護網) ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Chart Render Error:", error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-lg p-4 text-slate-400">
          <AlertTriangle size={32} className="mb-2 text-amber-400" />
          <p className="text-sm font-medium">圖表資料異常</p>
          <button onClick={() => this.setState({ hasError: false })} className="mt-2 text-xs text-blue-600 underline">重試</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- 客製化 CSV 解析器 (針對您提供的 Google Sheet) ---
const parseCSV = (text) => {
  if (!text || typeof text !== 'string') return { data: [], debugInfo: {} };
  
  if (text.trim().startsWith('<!DOCTYPE html') || text.includes('<html')) {
    throw new Error("偵測到 HTML 內容。請確認連結格式為 .csv。");
  }

  const lines = text.split(/\r\n|\n/).filter(l => l.trim());
  if (lines.length < 2) return { data: [], debugInfo: { error: "資料行數不足" } };

  // 1. 智慧尋找標題列
  let headerRowIndex = 0;
  let maxScore = 0;
  let bestHeaders = [];
  let bestMapIndex = { date: -1, hsCode: -1, country: -1, type: -1, value: -1, weight: -1, productName: -1 };

  for(let i=0; i < Math.min(lines.length, 20); i++) {
     const row = parseCSVLine(lines[i]);
     let score = 0;
     const currentMapIndex = { date: -1, hsCode: -1, country: -1, type: -1, value: -1, weight: -1, productName: -1 };
     
     row.forEach((h, idx) => {
        const normalized = String(h || '').toLowerCase().replace(/[\s_"'.()]/g, '');
        if (['date', '日期', '年月', '資料年月', 'time'].some(k => normalized.includes(k))) { currentMapIndex.date = idx; score += 5; }
        if (['hscode', 'code', '稅號', '貨品號列', 'ccc', '貨品'].some(k => normalized.includes(k))) { currentMapIndex.hsCode = idx; score += 5; }
        if (['country', '國家', '產地', '國別'].some(k => normalized.includes(k))) { currentMapIndex.country = idx; score += 3; }
        if (['type', '進出口', '別', 'flow'].some(k => normalized.includes(k))) { currentMapIndex.type = idx; score += 3; }
        if (['value', '金額', '價值', 'usd', '美元', 'twd'].some(k => normalized.includes(k))) { currentMapIndex.value = idx; score += 3; }
        if (['weight', '重量', '量', 'kg', '公斤'].some(k => normalized.includes(k))) { currentMapIndex.weight = idx; score += 3; }
        if (['name', 'description', '貨名', '貨品名稱', '中文貨名'].some(k => normalized.includes(k))) { currentMapIndex.productName = idx; score += 3; }
     });

     if(score > maxScore) {
         maxScore = score;
         headerRowIndex = i;
         bestHeaders = row;
         bestMapIndex = currentMapIndex;
     }
  }

  // 2. 解析每一行
  const parsedData = lines.slice(headerRowIndex + 1).map((line, idx) => {
    const row = parseCSVLine(line);
    if (row.length < 2) return null; 

    // 安全提取 (Fallback to empty string)
    const rawDate = bestMapIndex.date > -1 ? (row[bestMapIndex.date] || '') : '';
    const rawCode = bestMapIndex.hsCode > -1 ? (row[bestMapIndex.hsCode] || '') : '';
    let rawCountry = bestMapIndex.country > -1 ? (row[bestMapIndex.country] || '未知') : '未知';
    const rawType = bestMapIndex.type > -1 ? (row[bestMapIndex.type] || '出口') : '出口'; 
    const rawValue = bestMapIndex.value > -1 ? (row[bestMapIndex.value] || '0') : '0';
    const rawWeight = bestMapIndex.weight > -1 ? (row[bestMapIndex.weight] || '0') : '0';
    const rawName = bestMapIndex.productName > -1 ? (row[bestMapIndex.productName] || '') : '';

    // 使用 cleanNumber 處理數值
    const cleanValue = cleanNumber(rawValue);
    const cleanWeight = cleanNumber(rawWeight);
    const cleanCode = String(rawCode).replace(/[\s.]/g, ''); 

    // 日期處理 (支援民國年)
    let cleanDate = rawDate ? rawDate.trim().replace(/\//g, '-').replace(/\./g, '-') : '';
    let yearPart = '2023'; // Default fallback
    
    try {
        if (cleanDate) {
            // 處理純數字日期 (ex: 11201)
            if (/^\d{5,6}$/.test(cleanDate)) {
                if (cleanDate.length === 5) { // 9901
                     const yr = parseInt(cleanDate.substring(0, 2)) + 1911;
                     cleanDate = `${yr}-${cleanDate.substring(2, 4)}`;
                } else { // 11201
                     const yr = parseInt(cleanDate.substring(0, 3)) + 1911;
                     cleanDate = `${yr}-${cleanDate.substring(3, 5)}`;
                }
            } 
            // 處理民國年分隔 (ex: 112/01)
            else {
                const rocRegex = /^(\d{2,3})[-/](\d{1,2})$/;
                const match = cleanDate.match(rocRegex);
                if (match) {
                    const yr = parseInt(match[1]) + 1911;
                    const mo = match[2].padStart(2, '0');
                    cleanDate = `${yr}-${mo}`;
                }
            }
            yearPart = cleanDate.substring(0, 4);
        }
    } catch (e) {
        cleanDate = '2023-01'; // 最後防線
    }

    // 國家名稱標準化
    const countryStr = String(rawCountry).trim();
    if (['CN', 'China', '大陸', '中國'].some(k => countryStr.includes(k))) rawCountry = '中國大陸';
    if (['US', 'USA', 'United States', '美國'].some(k => countryStr.includes(k))) rawCountry = '美國';
    if (['JP', 'Japan', '日本'].some(k => countryStr.includes(k))) rawCountry = '日本';
    if (['KR', 'Korea', '韓國', '南韓'].some(k => countryStr.includes(k))) rawCountry = '韓國';
    if (['VN', 'Vietnam', '越南'].some(k => countryStr.includes(k))) rawCountry = '越南';

    return {
        id: `row-${idx}`,
        date: cleanDate,
        year: yearPart,
        hsCode: cleanCode, 
        productName: rawName.trim(), 
        country: rawCountry,
        type: rawType.trim(),
        value: cleanValue,
        weight: cleanWeight,
        // 先不計算單價，留到聚合時再算，避免除以零
        isAnomaly: false
    };
  }).filter(item => {
      // 確保有代碼且有日期
      return item !== null && item.hsCode && item.date && item.date.length >= 7;
  });

  return { 
      data: parsedData, 
      debugInfo: { 
          headerRowIndex, 
          detectedHeaders: bestHeaders, 
          mappedColumns: bestMapIndex,
          totalRows: lines.length,
          parsedRows: parsedData.length
      } 
  };
};

const parseCSVLine = (text) => {
    const res = [];
    let current = '';
    let inQuote = false;
    for (let c of text) {
        if (c === '"') { inQuote = !inQuote; continue; }
        if (c === ',' && !inQuote) { res.push(current); current = ''; continue; }
        current += c;
    }
    res.push(current);
    return res.map(s => s.trim());
};

const formatCurrencyAxis = (value) => {
  if (!isFinite(value) || value === 0) return '0';
  if (value >= 100000) return (value / 100000).toFixed(1) + '億';
  if (value >= 10000) return (value / 10000).toFixed(0) + '千萬';
  return value.toLocaleString();
};

const formatWeightAxis = (value) => {
  if (!isFinite(value) || value === 0) return '0';
  if (value >= 1000) return (value / 1000).toFixed(0) + '噸';
  return value.toLocaleString();
};

const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(fieldName => {
      const val = row[fieldName];
      return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
    }).join(','))
  ].join('\n');
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const copyToClipboard = (data) => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]);
    const textContent = [
        headers.join('\t'),
        ...data.map(row => headers.map(fieldName => row[fieldName]).join('\t'))
    ].join('\n');
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(textContent).then(() => alert("已複製到剪貼簿"));
    } else {
        alert("請使用 Ctrl+C 複製 (模擬環境限制)");
    }
};

const generateMockData = (hsCode, years = 10) => {
  const data = [];
  const countries = ['中國大陸', '美國', '日本', '韓國', '越南', '德國'];
  const baseValue = 50000;
  const baseWeight = 2000;
  
  for (let i = 11; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    countries.forEach(country => {
      const value = Math.floor(baseValue * (Math.random() * 0.5 + 0.5));
      const weight = Math.floor(baseWeight * (Math.random() * 0.5 + 0.5));
      data.push({
        id: `${monthStr}-${country}`,
        date: monthStr,
        year: monthStr.substring(0, 4),
        hsCode: hsCode,
        country: country,
        productName: '模擬產品 (Mock)',
        type: Math.random() > 0.5 ? '出口' : '進口',
        value: value, 
        weight: weight, 
        unitPrice: weight > 0 ? parseFloat((value / weight).toFixed(2)) : 0,
        isAnomaly: false
      });
    });
  }
  return data;
};

const KPICard = ({ title, value, subtext, trend, icon: Icon, color }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between hover:shadow-md transition-shadow">
    <div>
      <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
      <div className={`flex items-center mt-2 text-sm ${trend === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}>
        {trend === 'up' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
        <span className="ml-1 font-medium">{subtext}</span>
      </div>
    </div>
    <div className={`p-3 rounded-lg ${color}`}>
      <Icon size={24} className="text-white" />
    </div>
  </div>
);

const TradeDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview'); 
  const [searchQuery, setSearchQuery] = useState('280300'); 
  const [inputValue, setInputValue] = useState('280300'); 
  const [dataset, setDataset] = useState([]); 
  const [displayData, setDisplayData] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef(null);
  
  // Data Source Config
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [dataSourceUrl, setDataSourceUrl] = useState('https://docs.google.com/spreadsheets/d/e/2PACX-1vQTBhte4P7bzMFSTlYDml3F25Wcr-sYfC7aOWQiePkfid7f2xBR-WUDMN7NAO3Z2e24Po14dqG7ZxnK/pub?gid=0&single=true&output=csv');
  const [useRealData, setUseRealData] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [debugData, setDebugData] = useState([]); 
  const [debugInfo, setDebugInfo] = useState({});
  const [detectedProductName, setDetectedProductName] = useState('');

  // 篩選與顯示設定
  const [timeRange, setTimeRange] = useState(120); 
  const [granularity, setGranularity] = useState('month'); 
  const [countryViewType, setCountryViewType] = useState('出口'); 
  const [countryMetric, setCountryMetric] = useState('value'); 
  const [countryTopN, setCountryTopN] = useState('10'); 
  const [pivotMode, setPivotMode] = useState('time'); 

  const [history, setHistory] = useState(['280300']);
  const [watchedProducts, setWatchedProducts] = useState([]);
  const [relatedProducts, setRelatedProducts] = useState([]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 取得唯一商品清單 (合併監控清單與真實數據)
  const uniqueProducts = useMemo(() => {
      const map = new Map();
      watchedProducts.forEach(p => map.set(p.code, p.name));
      if (useRealData && dataset.length > 0) {
          dataset.forEach(d => {
              if (d.hsCode && !map.has(d.hsCode)) {
                  map.set(d.hsCode, d.productName || `稅號 ${d.hsCode}`);
              } else if (d.hsCode && d.productName) {
                  if (map.get(d.hsCode).includes('稅號')) {
                      map.set(d.hsCode, d.productName);
                  }
              }
          });
      }
      return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [dataset, useRealData, watchedProducts]);

  const handleInputChange = (e) => {
      const val = e.target.value;
      setInputValue(val);
      if (!val) {
          setSuggestions([]);
          setShowSuggestions(false);
          return;
      }
      const normalizedInput = val.toLowerCase().trim();
      const matches = uniqueProducts.filter(p => 
          p.code.includes(normalizedInput) || 
          p.name.toLowerCase().includes(normalizedInput)
      );
      setSuggestions(matches.slice(0, 8)); 
      setShowSuggestions(true);
  };

  const selectProduct = (code, name) => {
      setInputValue(`${code} ${name}`); 
      setSearchQuery(code);
      setShowSuggestions(false);
      handleSearch(code);
  };

  const toggleWatchProduct = () => {
      const isWatched = watchedProducts.some(p => p.code === searchQuery);
      if (isWatched) {
          setWatchedProducts(prev => prev.filter(p => p.code !== searchQuery));
      } else {
          setWatchedProducts(prev => [
              { code: searchQuery, name: detectedProductName || `稅號 ${searchQuery}` },
              ...prev
          ]);
      }
  };

  const isCurrentProductWatched = useMemo(() => {
      return watchedProducts.some(p => p.code === searchQuery);
  }, [watchedProducts, searchQuery]);

  useEffect(() => {
    if (useRealData && dataSourceUrl) {
        fetchRealData();
    } else {
        handleSearch(searchQuery); 
    }
  }, [useRealData]);

  const fetchRealData = async () => {
      setLoading(true);
      setFetchError(null);
      try {
          const response = await fetch(dataSourceUrl);
          if (!response.ok) throw new Error(`HTTP 錯誤: ${response.status}`);
          const text = await response.text();
          const { data, debugInfo } = parseCSV(text);
          setDataset(data);
          setDebugData(data.slice(0, 5)); 
          setDebugInfo(debugInfo);
          setLastUpdated(new Date().toLocaleString());
          if (data.length === 0) {
              setFetchError("讀取成功但未解析出有效資料。");
              setUseRealData(false);
          } else {
              filterData(data, searchQuery);
          }
      } catch (error) {
          console.error("Fetch error:", error);
          setFetchError(error.message);
          setUseRealData(false); 
      }
      setLoading(false);
  };

  const filterData = (allData, query) => {
      const cleanQuery = String(query).replace(/[\s.]/g, '').toLowerCase(); 
      const filtered = allData.filter(d => {
          if(!d.hsCode) return false;
          const rawCleanCode = d.hsCode.replace(/[\s.]/g, '');
          const matchCode = rawCleanCode.includes(cleanQuery);
          const matchName = d.productName && d.productName.toLowerCase().includes(cleanQuery);
          return matchCode || matchName;
      });

      let foundName = '';
      const relatedSet = new Set(); 

      if (filtered.length > 0) {
          const candidate = filtered.find(d => d.productName && d.productName !== '');
          if (candidate) foundName = candidate.productName;
          filtered.forEach(d => { if (d.hsCode) relatedSet.add(d.hsCode); });
      } else {
          if (useRealData) {
              allData.forEach(d => {
                  const rawCleanCode = d.hsCode.replace(/[\s.]/g, '');
                  if (rawCleanCode.startsWith(cleanQuery)) {
                      relatedSet.add(d.hsCode);
                  }
              });
          }
      }

      const relatedList = Array.from(relatedSet).map(code => {
          const found = allData.find(d => d.hsCode === code && d.productName);
          const name = found ? found.productName : (watchedProducts.find(p=>p.code === code)?.name || code);
          return { code, name };
      }).slice(0, 50); 
      setRelatedProducts(relatedList.sort((a, b) => a.code.localeCompare(b.code)));

      if (!foundName) {
          const watchedProd = watchedProducts.find(p => p.code === query);
          if (watchedProd) foundName = watchedProd.name;
      }
      setDetectedProductName(foundName);

      // 如果找不到資料，回傳空陣列，但不要切換到 Mock 模式
      if (filtered.length === 0 && useRealData) {
          setDisplayData([]);
      } else {
          setDisplayData(useRealData ? filtered : generateMockData(query, 10));
      }
  };

  const handleSearch = (overrideQuery) => {
    const target = overrideQuery || inputValue;
    
    if (!history.includes(target) && target.length < 20) {
        setHistory(prev => [target, ...prev].slice(0, 5));
    }

    if (useRealData) {
        filterData(dataset, target);
    } else {
        setLoading(true);
        setTimeout(() => {
            const mockData = generateMockData(target, 10);
            setDisplayData(mockData);
            setLoading(false);
        }, 600);
    }
  };

  // --- 數據處理 ---
  const filteredData = useMemo(() => {
    if (displayData.length === 0) return [];
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - timeRange);
    const cutoffStr = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth()+1).padStart(2,'0')}`;
    return displayData.filter(d => d.date >= cutoffStr);
  }, [displayData, timeRange]);

  // Tab 1 Aggregation: Time
  const aggregatedData = useMemo(() => {
    const map = {};
    filteredData.forEach(d => {
      const key = granularity === 'year' ? d.year : d.date;
      if (!map[key]) {
        map[key] = { 
            date: key, 
            exportValue: 0, importValue: 0, 
            exportWeight: 0, importWeight: 0,
            count: 0 
        };
      }
      const typeStr = String(d.type).toUpperCase();
      const isExport = typeStr.includes('出') || typeStr === 'E' || typeStr === 'EXPORT';
      
      if (isExport) {
          map[key].exportValue += d.value;
          map[key].exportWeight += d.weight;
      } else {
          map[key].importValue += d.value;
          map[key].importWeight += d.weight;
      }
      map[key].count += 1;
    });

    const result = Object.values(map).map(d => {
      // 安全計算單價
      const avgExportPrice = d.exportWeight > 0 ? d.exportValue / d.exportWeight : 0;
      const avgImportPrice = d.importWeight > 0 ? d.importValue / d.importWeight : 0;

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
    
    return sanitizeForChart(result); // 最後一道消毒
  }, [filteredData, granularity]);

  // Tab 3 Aggregation: Country (Pivot)
  const pivotCountryData = useMemo(() => {
      const map = {};
      filteredData.forEach(d => {
          const key = d.country;
          if (!map[key]) {
              map[key] = {
                  country: key,
                  exportValue: 0, importValue: 0,
                  exportWeight: 0, importWeight: 0
              };
          }
          const typeStr = String(d.type).toUpperCase();
          const isExport = typeStr.includes('出') || typeStr === 'E' || typeStr === 'EXPORT';
          
          if (isExport) {
              map[key].exportValue += d.value;
              map[key].exportWeight += d.weight;
          } else {
              map[key].importValue += d.value;
              map[key].importWeight += d.weight;
          }
      });
      return Object.values(map).map(d => {
          const avgExport = d.exportWeight > 0 ? d.exportValue/d.exportWeight : 0;
          const avgImport = d.importWeight > 0 ? d.importValue/d.importWeight : 0;
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

  const summary = useMemo(() => {
    if (filteredData.length === 0) return { totalValue: 0, totalWeight: 0, avgPrice: 0 };
    const totalValue = filteredData.reduce((acc, curr) => acc + curr.value, 0);
    const totalWeight = filteredData.reduce((acc, curr) => acc + curr.weight, 0);
    
    let valDisplay = (totalValue / 10000).toFixed(0) + ' 萬';
    if (totalValue > 100000) valDisplay = (totalValue / 100000).toFixed(2) + ' 億';
    
    let weightDisplay = (totalWeight / 1000).toFixed(0) + ' 噸';
    const avg = totalWeight > 0 ? totalValue / totalWeight : 0;
    
    return {
      totalValue: valDisplay,
      totalWeight: weightDisplay,
      avgPrice: isFinite(avg) ? avg.toFixed(2) : 0,
    };
  }, [filteredData]);

  const countryTableData = useMemo(() => {
    const map = {};
    const isExport = countryViewType === '出口';
    
    filteredData.forEach(d => {
        const typeStr = String(d.type).toUpperCase();
        const dIsExport = typeStr.includes('出') || typeStr === 'E' || typeStr === 'EXPORT';
        
        if (isExport === dIsExport) {
             if (!map[d.country]) map[d.country] = { name: d.country, value: 0, weight: 0 };
             map[d.country].value += d.value;
             map[d.country].weight += d.weight;
        }
    });
    
    const totalVal = Object.values(map).reduce((acc, curr) => acc + curr.value, 0);
    const totalWgt = Object.values(map).reduce((acc, curr) => acc + curr.weight, 0);

    const result = Object.values(map)
        .map(d => {
            const up = d.weight > 0 ? d.value / d.weight : 0;
            return {
                ...d,
                unitPrice: isFinite(up) ? parseFloat(up.toFixed(2)) : 0,
                shareValue: totalVal > 0 ? ((d.value / totalVal) * 100).toFixed(1) + '%' : '0%',
                shareWeight: totalWgt > 0 ? ((d.weight / totalWgt) * 100).toFixed(1) + '%' : '0%',
                displayValue: countryMetric === 'value' ? d.value : d.weight 
            };
        })
        .sort((a, b) => b.displayValue - a.displayValue);
        
    return sanitizeForChart(result);
  }, [filteredData, countryViewType, countryMetric]);

  // Tab 2: Country Filter Logic
  const filteredCountryTableData = useMemo(() => {
      if (countryTopN === 'all') return countryTableData;
      const n = parseInt(countryTopN);
      return countryTableData.slice(0, n);
  }, [countryTableData, countryTopN]);

  const anomalies = useMemo(() => {
      if (useRealData) {
          return filteredData.filter(d => d.value > 1000 && (d.value/d.weight) > 500).slice(0, 10); 
      }
      return filteredData.filter(d => d.isAnomaly).slice(0, 10); 
  }, [filteredData, useRealData]);

  const crossProductComparison = useMemo(() => {
      if (!useRealData) return [];
      const topCountries = pivotCountryData.slice(0, 5).map(c => c.country);
      const productMap = {};
      
      dataset.forEach(d => {
          if (topCountries.includes(d.country) && d.hsCode !== searchQuery) { 
              if (!productMap[d.hsCode]) {
                  productMap[d.hsCode] = { 
                      code: d.hsCode, 
                      name: d.productName || d.hsCode,
                      totalValue: 0,
                      countries: new Set()
                  };
              }
              productMap[d.hsCode].totalValue += d.value;
              productMap[d.hsCode].countries.add(d.country);
          }
      });

      return Object.values(productMap)
          .sort((a, b) => b.totalValue - a.totalValue)
          .slice(0, 5); 
  }, [dataset, pivotCountryData, useRealData, searchQuery]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ff6b6b', '#6b7280', '#F06292', '#BA68C8'];
  const availableCodes = useMemo(() => {
      if(!dataset || dataset.length === 0) return [];
      const codes = new Set(dataset.map(d => `${d.hsCode} (${d.productName || '無名稱'})`));
      return Array.from(codes).slice(0, 20); 
  }, [dataset]);

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-800">
      {/* Settings Modal */}
      {showConfigModal && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-6 border border-slate-200 my-8">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                        <Settings className="text-blue-600"/> 資料來源設定與診斷
                    </h3>
                    <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                </div>
                {fetchError && (
                    <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-start gap-2 text-sm">
                        <AlertTriangle className="flex-shrink-0 mt-0.5" size={16}/>
                        <div><strong>讀取發生錯誤：</strong> {fetchError}</div>
                    </div>
                )}
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Google Sheet CSV 連結</label>
                        <div className="flex gap-2">
                            <input type="text" className="flex-1 p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs" placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv" value={dataSourceUrl} onChange={(e) => setDataSourceUrl(e.target.value)} />
                            <button onClick={() => { if (dataSourceUrl) { setUseRealData(true); fetchRealData(); }}} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"><RefreshCw size={18}/> 讀取</button>
                        </div>
                    </div>
                    {availableCodes.length > 0 && (
                        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-lg">
                            <h4 className="text-sm font-bold text-emerald-800 mb-2 flex items-center gap-2"><CheckCircle size={14}/> 系統已成功識別以下產品代碼 (前 20 筆)</h4>
                            <div className="flex flex-wrap gap-2">
                                {availableCodes.map(c => (<span key={c} className="px-2 py-1 bg-white border border-emerald-200 text-emerald-700 text-xs rounded shadow-sm">{c}</span>))}
                            </div>
                        </div>
                    )}

                    {/* 數據診斷區塊 */}
                    {debugInfo.totalRows > 0 && (
                        <div className="border-t border-slate-200 pt-4">
                            <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                <Bug size={14}/> 智慧標題偵測結果
                            </h4>
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs mb-3">
                                <div>偵測到總行數: <strong>{debugInfo.totalRows}</strong></div>
                                <div>認定標題列在第: <strong>{debugInfo.headerRowIndex + 1} 行</strong> (系統自動跳過前 {debugInfo.headerRowIndex} 行雜訊)</div>
                                <div>標題內容: <code className="bg-slate-200 px-1 rounded">{String(debugInfo.detectedHeaders)}</code></div>
                                <div>成功解析資料: <strong>{debugInfo.parsedRows} 筆</strong></div>
                            </div>

                            <h4 className="text-sm font-bold text-slate-700 mb-2">前 5 筆解析後資料預覽</h4>
                            <div className="bg-slate-900 rounded-lg p-3 overflow-x-auto">
                                <table className="w-full text-xs text-slate-300 font-mono">
                                    <thead>
                                        <tr className="border-b border-slate-700 text-slate-400">
                                            <th className="p-1 text-left">Date</th>
                                            <th className="p-1 text-left">Code</th>
                                            <th className="p-1 text-left text-amber-400">Name (貨名)</th>
                                            <th className="p-1 text-left">Country</th>
                                            <th className="p-1 text-left">Type</th>
                                            <th className="p-1 text-right">Value</th>
                                            <th className="p-1 text-right">Weight</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {debugData.map((row, i) => (
                                            <tr key={i} className="border-b border-slate-800 last:border-0">
                                                <td className="p-1 text-emerald-400">{row.date}</td>
                                                <td className="p-1 text-blue-400">{row.hsCode}</td>
                                                <td className="p-1 text-amber-400">{row.productName || '-'}</td>
                                                <td className="p-1">{row.country}</td>
                                                <td className="p-1">{row.type}</td>
                                                <td className="p-1 text-right">{row.value}</td>
                                                <td className="p-1 text-right">{row.weight}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex-shrink-0 hidden md:flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold flex items-center gap-2"><Globe size={24} className="text-blue-400" />貿易數據戰情室</h1>
          <p className="text-xs text-slate-400 mt-2">Customs & Trade Dashboard</p>
        </div>
        <div className="px-4 py-3 bg-slate-800 border-b border-slate-700">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase">資料模式</span>
                {useRealData && dataset.length > 0 ? (
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1"><div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div> Live ({dataset.length})</span>
                ) : (
                    <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">Mock (模擬)</span>
                )}
            </div>
            {lastUpdated && useRealData && (<div className="text-[10px] text-slate-500 mb-1">上次更新: {lastUpdated}</div>)}
            <button onClick={() => setShowConfigModal(true)} className="w-full mt-2 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 py-1.5 rounded flex items-center justify-center gap-2 transition-colors"><Settings size={12}/> 設定資料來源</button>
        </div>
        <div className="p-4 space-y-6 overflow-y-auto flex-1">
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center justify-between">重點監控產品 ({watchedProducts.length})<Database size={14} /></h3>
            <div className="space-y-2">
              {watchedProducts.length === 0 ? (
                  <div className="text-xs text-slate-500 italic p-2 border border-dashed border-slate-700 rounded">
                      尚無重點監控產品。<br/>請在搜尋後點擊標題旁的星星圖示加入。
                  </div>
              ) : (
                  watchedProducts.map(fav => (
                    <button key={fav.code} onClick={() => { selectProduct(fav.code, fav.name); }} className={`flex items-center justify-between w-full px-3 py-2 rounded-md border-l-4 transition-all ${searchQuery === fav.code ? 'bg-blue-900/50 border-blue-500 text-white' : 'bg-slate-800 border-transparent text-slate-300 hover:bg-slate-700'}`}>
                      <div className="text-left overflow-hidden"><div className="text-sm font-medium truncate" title={fav.name}>{fav.name}</div><div className="text-xs text-slate-500">{fav.code}</div></div>
                    </button>
                  ))
              )}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">最近搜尋</h3>
            <div className="space-y-2">
              {history.map(code => (
                <button key={code} onClick={() => handleSearch(code)} className="flex items-center w-full px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-md transition-colors"><History size={16} className="mr-2" />{code}</button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto h-screen flex flex-col relative">
        <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-[300px]" ref={searchContainerRef}>
                <div className="relative flex-1 max-w-lg">
                <input type="text" value={inputValue} onChange={handleInputChange} onFocus={() => { if(inputValue) setShowSuggestions(true); }} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="搜尋貨名或 Code (如: 72, 鋼鐵, 2803)" />
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                        {suggestions.map((item) => (
                            <button key={item.code} onClick={() => selectProduct(item.code, item.name)} className="w-full text-left px-4 py-2 hover:bg-blue-50 flex justify-between items-center text-sm border-b border-slate-50 last:border-0"><span className="font-medium text-slate-700">{item.name}</span><span className="text-xs text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{item.code}</span></button>
                        ))}
                    </div>
                )}
                </div>
                <button onClick={() => handleSearch()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 whitespace-nowrap"><RefreshCw size={18} className={loading ? "animate-spin" : ""}/> 搜尋</button>
            </div>
            {relatedProducts.length > 1 && (
                <div className="relative group">
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-200 transition-colors">
                        <Tag size={16} className="text-slate-500"/>
                        <span className="text-sm font-medium text-slate-700">相關細項產品 ({relatedProducts.length})</span>
                        <ChevronDown size={14} className="text-slate-400"/>
                        <select className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => { const code = e.target.value; const prod = relatedProducts.find(p => p.code === code); selectProduct(code, prod?.name || code); }} value={searchQuery}>
                            <option value="" disabled>請選擇相關產品...</option>
                            {relatedProducts.map(p => (<option key={p.code} value={p.code}>{p.code} - {p.name}</option>))}
                        </select>
                    </div>
                </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
             <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-lg">
                <div className="flex items-center px-2 text-xs font-bold text-slate-500 uppercase"><Calendar size={14} className="mr-1"/> 範圍</div>
                <select value={timeRange} onChange={(e) => setTimeRange(Number(e.target.value))} className="bg-white border border-slate-200 text-sm rounded px-2 py-1 focus:outline-none focus:border-blue-500"><option value={12}>近 1 年</option><option value={36}>近 3 年</option><option value={60}>近 5 年</option><option value={120}>近 10 年</option></select>
                <div className="w-px h-4 bg-slate-300 mx-1"></div>
                <div className="flex items-center px-2 text-xs font-bold text-slate-500 uppercase"><TableIcon size={14} className="mr-1"/> 粒度</div>
                <select value={granularity} onChange={(e) => setGranularity(e.target.value)} className="bg-white border border-slate-200 text-sm rounded px-2 py-1 focus:outline-none focus:border-blue-500"><option value="month">月 (Month)</option><option value="year">年 (Year)</option></select>
             </div>
          </div>
        </header>

        <div className="px-6 pt-6 pb-2">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><Tag size={24} /></div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        {detectedProductName || '搜尋結果'} <span className="text-slate-400 text-lg font-normal font-mono">({searchQuery})</span>
                        <button onClick={toggleWatchProduct} className={`ml-2 p-1.5 rounded-full transition-all ${isCurrentProductWatched ? 'bg-amber-100 text-amber-500 hover:bg-amber-200' : 'bg-slate-100 text-slate-400 hover:text-amber-400 hover:bg-slate-200'}`} title={isCurrentProductWatched ? "從監控清單移除" : "加入重點監控清單"}><Star size={20} fill={isCurrentProductWatched ? "currentColor" : "none"} /></button>
                    </h2>
                    {relatedProducts.length > 0 && (<p className="text-xs text-slate-500 mt-1">找到 {relatedProducts.length} 個相關細項產品，請使用上方選單切換。</p>)}
                </div>
            </div>
            {displayData.length === 0 && !loading && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                    <Info className="text-amber-500 mt-0.5" size={20}/>
                    <div>
                        <h4 className="font-bold text-amber-800 text-sm">查無此商品資料</h4>
                        <div className="text-xs text-amber-700 mt-1">
                            這可能是因為：
                            <ul className="list-disc list-inside mt-1 ml-1">
                                <li>您的 Google Sheet (CSV) 中沒有包含代碼為 <strong>{searchQuery}</strong> 的資料。</li>
                                <li>您的 CSV 格式可能與系統預期不符，導致解析失敗 (讀取到 0 筆有效資料)。</li>
                            </ul>
                            建議您點擊左下角的 <strong>「設定資料來源」</strong> 查看系統目前已讀取到的所有稅號清單。
                        </div>
                    </div>
                </div>
            )}
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-auto">
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <KPICard title="區間總貿易額 (千元)" value={summary.totalValue} subtext="包含進出口總和" trend="up" icon={TrendingUp} color="bg-blue-500"/>
            <KPICard title="區間總重量 (KG)" value={summary.totalWeight} subtext="累計量體" trend="up" icon={Database} color="bg-emerald-500"/>
            <KPICard title="平均單價 (TWD/KG)" value={`$${summary.avgPrice}`} subtext="加權平均" trend="down" icon={AlertTriangle} color="bg-amber-500"/>
            <KPICard title="異常記錄" value={anomalies.length} subtext="需關注波動" trend="down" icon={AlertTriangle} color="bg-rose-500"/>
          </section>

          {/* 加入 Error Boundary 保護圖表區域 */}
          <ErrorBoundary>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[500px]">
              <div className="border-b border-slate-200 flex overflow-x-auto">
                <button onClick={() => setActiveTab('overview')} className={`px-5 py-3 text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab === 'overview' ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50' : 'text-slate-600 hover:bg-slate-50'}`}><TrendingUp size={16}/> 時間趨勢分析</button>
                <button onClick={() => setActiveTab('country')} className={`px-5 py-3 text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab === 'country' ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50' : 'text-slate-600 hover:bg-slate-50'}`}><Globe size={16}/> 國家貿易分析</button>
                <button onClick={() => setActiveTab('pivot')} className={`px-5 py-3 text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab === 'pivot' ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50' : 'text-slate-600 hover:bg-slate-50'}`}><TableIcon size={16}/> 數據樞紐 (Pivot)</button>
                <button onClick={() => setActiveTab('analysis')} className={`px-5 py-3 text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab === 'analysis' ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50' : 'text-slate-600 hover:bg-slate-50'}`}><AlertTriangle size={16}/> 變動與關聯診斷</button>
              </div>

              <div className="p-6 flex-1 bg-slate-50/50">
                {loading ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>處理數據中...</div>
                ) : (
                  <>
                    {activeTab === 'overview' && (
                      <div className="space-y-6">
                        {/* 圖表 A */}
                        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm h-96">
                          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                              <TrendingUp size={16} className="text-blue-500"/>
                              趨勢圖 A: 進出口金額 vs 分別單價
                          </h3>
                          <ResponsiveContainer width="100%" height="90%">
                            <ComposedChart data={aggregatedData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="date" tick={{fontSize: 11}} minTickGap={30} />
                              <YAxis yAxisId="left" tickFormatter={formatCurrencyAxis} label={{ value: '金額 (千元)', angle: -90, position: 'insideLeft', style: {fontSize: 11, fill: '#64748b'} }} tick={{fontSize: 11}} />
                              <YAxis yAxisId="right" orientation="right" label={{ value: '單價', angle: 90, position: 'insideRight', style: {fontSize: 11, fill: '#64748b'} }} />
                              <Tooltip formatter={(value, name) => [isFinite(value) ? value.toLocaleString() : 0, name]} />
                              <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}}/>
                              <Bar yAxisId="left" dataKey="exportValue" name="出口金額" fill="#3b82f6" barSize={20} />
                              <Bar yAxisId="left" dataKey="importValue" name="進口金額" fill="#10b981" barSize={20} />
                              <Line yAxisId="right" type="monotone" dataKey="avgExportPrice" name="出口單價" stroke="#f59e0b" strokeWidth={2} dot={false} />
                              <Line yAxisId="right" type="monotone" dataKey="avgImportPrice" name="進口單價" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>

                        {/* 圖表 B */}
                        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm h-80">
                          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                              <Database size={16} className="text-emerald-500"/>
                              趨勢圖 B: 進出口量體 (重量比較)
                          </h3>
                          <ResponsiveContainer width="100%" height="90%">
                            <BarChart data={aggregatedData} barGap={0}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="date" tick={{fontSize: 11}} minTickGap={30} />
                              <YAxis tickFormatter={formatWeightAxis} label={{ value: '重量 (KG)', angle: -90, position: 'insideLeft', style: {fontSize: 11, fill: '#64748b'} }} tick={{fontSize: 11}} />
                              <Tooltip formatter={(value, name) => [value.toLocaleString() + ' KG', name]} />
                              <Legend wrapperStyle={{fontSize: '12px'}}/>
                              <Bar dataKey="exportWeight" name="出口重量" fill="#8884d8" fillOpacity={0.8} />
                              <Bar dataKey="importWeight" name="進口重量" fill="#82ca9d" fillOpacity={0.8} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {activeTab === 'country' && (
                      <div className="space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="flex gap-4">
                              <div className="flex bg-slate-200 p-1 rounded-lg">
                                  <button onClick={() => setCountryViewType('出口')} className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${countryViewType === '出口' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>出口</button>
                                  <button onClick={() => setCountryViewType('進口')} className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${countryViewType === '進口' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600'}`}>進口</button>
                              </div>
                              <div className="w-px h-8 bg-slate-300"></div>
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                  <span className="font-bold"><ListFilter size={14} className="inline mr-1"/>顯示排名：</span>
                                  <select value={countryTopN} onChange={(e) => setCountryTopN(e.target.value)} className="bg-white border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500">
                                      <option value="5">Top 5</option>
                                      <option value="10">Top 10</option>
                                      <option value="20">Top 20</option>
                                      <option value="all">全部顯示</option>
                                  </select>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-slate-600 ml-2">
                                  <span className="font-bold">指標：</span>
                                  <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={countryMetric === 'value'} onChange={() => setCountryMetric('value')} className="text-blue-600"/> 依金額</label>
                                  <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={countryMetric === 'weight'} onChange={() => setCountryMetric('weight')} className="text-blue-600"/> 依重量</label>
                              </div>
                          </div>
                          <div className="flex gap-2">
                              <button onClick={() => copyToClipboard(filteredCountryTableData)} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded text-sm hover:bg-slate-50 text-slate-700"><Copy size={14}/> 複製</button>
                              <button onClick={() => exportToCSV(filteredCountryTableData, `Country_Data_${countryViewType}`)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"><Download size={14}/> 下載</button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm h-96 lg:col-span-1">
                            <h4 className="font-bold text-slate-700 mb-2 text-center">{countryViewType}佔比 (前 {countryTopN === 'all' ? '所有' : countryTopN} 名)</h4>
                            <ResponsiveContainer width="100%" height="90%">
                              <PieChart>
                                <Pie data={filteredCountryTableData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="displayValue">
                                  {filteredCountryTableData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                </Pie>
                                <Tooltip formatter={(val) => val.toLocaleString() + (countryMetric === 'value' ? ' 千元' : ' KG')} />
                                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{fontSize: '11px'}} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden lg:col-span-2 flex flex-col h-96">
                              <div className="overflow-auto flex-1">
                                  <table className="w-full text-sm text-left">
                                      <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0">
                                          <tr><th className="px-4 py-3">國家</th><th className="px-4 py-3 text-right">金額 (千元)</th><th className="px-4 py-3 text-right">重量 (KG)</th><th className="px-4 py-3 text-right">單價</th><th className="px-4 py-3 text-right bg-blue-50">金額佔比</th><th className="px-4 py-3 text-right bg-emerald-50">重量佔比</th></tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                          {filteredCountryTableData.map((row, idx) => (
                                              <tr key={idx} className="hover:bg-slate-50"><td className="px-4 py-2 font-medium text-slate-800">{row.name}</td><td className="px-4 py-2 text-right font-mono">{row.value.toLocaleString()}</td><td className="px-4 py-2 text-right font-mono">{row.weight.toLocaleString()}</td><td className="px-4 py-2 text-right text-amber-600 font-bold">{row.unitPrice}</td><td className="px-4 py-2 text-right bg-blue-50/30">{row.shareValue}</td><td className="px-4 py-2 text-right bg-emerald-50/30">{row.shareWeight}</td></tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'pivot' && (
                      <div className="space-y-4 h-full flex flex-col">
                        <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200">
                            <div className="flex items-center gap-4">
                                <h3 className="font-bold text-slate-700 flex items-center gap-2"><TableIcon size={18} className="text-blue-600"/> 數據樞紐</h3>
                                <div className="flex bg-slate-100 p-1 rounded-md text-xs font-bold">
                                    <button onClick={() => setPivotMode('time')} className={`px-3 py-1 rounded ${pivotMode === 'time' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>依時間 (By Time)</button>
                                    <button onClick={() => setPivotMode('country')} className={`px-3 py-1 rounded ${pivotMode === 'country' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>依國家 (By Country)</button>
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
                                            <th className="px-4 py-3 bg-slate-100">{pivotMode === 'time' ? `時間 (${granularity})` : '國家 (Country)'}</th>
                                            <th className="px-4 py-3 text-right bg-slate-100 text-blue-700">出口金額</th>
                                            <th className="px-4 py-3 text-right bg-slate-100 text-emerald-700">進口金額</th>
                                            <th className="px-4 py-3 text-right bg-slate-100 font-bold">金額出入超</th>
                                            <th className="px-4 py-3 text-right bg-slate-100 text-slate-500 border-l border-slate-200">出口重量</th>
                                            <th className="px-4 py-3 text-right bg-slate-100 text-slate-500">進口重量</th>
                                            <th className="px-4 py-3 text-right bg-slate-100 font-bold text-slate-700">重量出入超</th>
                                            <th className="px-4 py-3 text-right bg-slate-100 text-amber-600 border-l border-slate-200">出口單價</th>
                                            <th className="px-4 py-3 text-right bg-slate-100 text-amber-600">進口單價</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(pivotMode === 'time' ? aggregatedData : pivotCountryData).map((row, idx) => (
                                              <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                                                <td className="px-4 py-2 font-medium text-slate-800 whitespace-nowrap">{pivotMode === 'time' ? row.date : row.country}</td>
                                                <td className="px-4 py-2 text-right font-mono text-blue-700">{row.exportValue.toLocaleString()}</td>
                                                <td className="px-4 py-2 text-right font-mono text-emerald-700">{row.importValue.toLocaleString()}</td>
                                                <td className={`px-4 py-2 text-right font-mono font-bold ${row.tradeBalance >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>{row.tradeBalance > 0 ? '+' : ''}{row.tradeBalance.toLocaleString()}</td>
                                                <td className="px-4 py-2 text-right font-mono text-slate-500 border-l border-slate-100">{row.exportWeight.toLocaleString()}</td>
                                                <td className="px-4 py-2 text-right font-mono text-slate-500">{row.importWeight.toLocaleString()}</td>
                                                <td className={`px-4 py-2 text-right font-mono font-bold ${row.tradeBalanceWeight >= 0 ? 'text-slate-600' : 'text-rose-500'}`}>{row.tradeBalanceWeight > 0 ? '+' : ''}{row.tradeBalanceWeight.toLocaleString()}</td>
                                                <td className="px-4 py-2 text-right font-mono text-amber-700 border-l border-slate-100">{row.avgExportPrice}</td>
                                                <td className="px-4 py-2 text-right font-mono text-amber-700">{row.avgImportPrice}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'analysis' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* 左欄：異常偵測 */}
                            <div className="space-y-4">
                                <div className="bg-rose-50 border border-rose-100 p-4 rounded-lg">
                                    <h4 className="font-bold text-rose-800 flex items-center gap-2 mb-2"><AlertTriangle size={18}/> 異常數據診斷</h4>
                                    <p className="text-sm text-rose-700">自動掃描過去 {timeRange} 個月數據，標示單價或數量劇烈波動點。</p>
                                </div>
                                {anomalies.length > 0 ? (
                                  <div className="space-y-3">
                                    {anomalies.map((item, idx) => (
                                      <div key={idx} className="bg-white border border-slate-200 p-4 rounded-lg flex gap-3 shadow-sm items-center">
                                        <div className="bg-slate-100 p-2 rounded text-center min-w-[80px]"><div className="text-xs text-slate-500 font-bold">{item.type}</div><div className="text-sm font-bold text-slate-800">{item.date}</div></div>
                                        <div className="flex-1">
                                          <div className="flex justify-between"><h4 className="font-bold text-slate-800 text-sm">{item.country}</h4><span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-xs font-bold rounded">異常</span></div>
                                          <div className="text-xs text-slate-600 mt-1">單價: {item.unitPrice} | 數量: {item.weight.toLocaleString()}</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (<div className="p-8 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">無顯著異常。</div>)}
                            </div>

                            {/* 右欄：關聯產品比較 */}
                            <div className="space-y-4">
                                <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                                    <h4 className="font-bold text-blue-800 flex items-center gap-2 mb-2"><ArrowRightLeft size={18}/> 核心夥伴之關聯產品分析</h4>
                                    <p className="text-sm text-blue-700">分析前 5 大貿易國在資料庫中其他產品 (稅號) 的交易情況，協助判斷產業關聯性。</p>
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
                                                        <td className="px-3 py-2 text-right font-mono text-blue-600">{prod.totalValue.toLocaleString()}</td>
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
                    )}
                  </>
                )}
              </div>
            </div>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
};

export default TradeDashboard;