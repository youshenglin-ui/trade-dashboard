import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Area, AreaChart, ReferenceLine } from 'recharts';
import { Search, History, TrendingUp, AlertTriangle, Globe, Database, ArrowUpRight, ArrowDownRight, Filter, Download, Table as TableIcon, Calendar, FileText, Copy, UploadCloud, Settings, Link as LinkIcon, RefreshCw, CheckCircle, Bug, Info, Tag, X, Star, ChevronDown, ListFilter, ArrowRightLeft, Zap, ShieldAlert, Newspaper, Scale, Map as MapIcon, Layers, Flag, BookOpen } from 'lucide-react';

// --- 1. 國際重大事件與政策 (時間軸標記) ---
const GLOBAL_EVENTS = [
    { date: '2022-02', label: '烏俄戰爭', type: 'War', desc: '能源原物料飆漲' },
    { date: '2022-06', label: '美升息', type: 'Finance', desc: '強勢美元' },
    { date: '2023-10', label: '以巴衝突', type: 'War', desc: '紅海航運危機' },
    { date: '2024-01', label: 'ECFA中止', type: 'Policy', desc: '12項石化產品優惠取消' },
    { date: '2024-04', label: '電價調漲', type: 'Domestic', desc: '工業電價平均調漲' },
];

// --- 戰略專題的特殊時間軸 ---
const TOPIC_MILESTONES = {
    'CBAM_WATCH': [
        { date: '2023-10', label: '過渡期開始', desc: '開始試行申報碳含量' },
        { date: '2026-01', label: '正式收費', desc: 'CBAM憑證強制購買' }
    ],
    'ECFA_EARLY': [
        { date: '2011-01', label: '早收生效', desc: '關稅開始降至零' },
        { date: '2024-01', label: '部分中止', desc: '丙烯等12項產品恢復關稅' }
    ]
};

// --- 2. 貿易區域定義 ---
const TRADE_REGIONS = {
    'ASEAN': { label: '東協 10 國', countries: ['越南', '泰國', '印尼', '馬來西亞', '菲律賓', '新加坡', '緬甸', '柬埔寨', '寮國', '汶萊'] },
    'EU27': { label: '歐盟 27 國', countries: ['德國', '法國', '荷蘭', '義大利', '西班牙', '比利時', '波蘭', '瑞典', '奧地利', '愛爾蘭', '捷克', '丹麥', '芬蘭', '葡萄牙', '希臘', '匈牙利'] },
    'US_CN': { label: '美中港 (G2)', countries: ['美國', '中國大陸', '香港'] },
    'CPTPP': { label: 'CPTPP 成員', countries: ['日本', '加拿大', '澳洲', '越南', '墨西哥', '新加坡', '紐西蘭'] },
    'MIDDLE_EAST': { label: '中東地區', countries: ['沙烏地阿拉伯', '阿聯', '科威特', '卡達', '以色列'] }
};

// --- 3. 戰略專題定義 ---
const STRATEGIC_TOPICS = {
    'ECFA_EARLY': { 
        title: 'ECFA 早收清單', 
        desc: '石化、紡織、機械等關鍵貨品 (539項)',
        items: [
            { code: '2902', name: '苯/甲苯/二甲苯' }, { code: '3901', name: '聚乙烯 (PE)' },
            { code: '3902', name: '聚丙烯 (PP)' }, { code: '3907', name: '聚碳酸酯 (PC)' }
        ]
    },
    'CBAM_WATCH': { 
        title: '歐盟 CBAM 列管', 
        desc: '鋼鐵、鋁、水泥、肥料、氫氣、電力 (6大類)',
        items: [
            { code: '7208', name: '熱軋鋼鐵' }, { code: '7210', name: '鍍面鋼鐵' },
            { code: '7318', name: '鋼鐵螺釘' }, { code: '7601', name: '未鍛軋鋁' },
            { code: '2523', name: '水泥' }
        ]
    },
    'TRUMP_RISK': { 
        title: '川普關稅風險 (60%)', 
        desc: '針對高貿易順差國之重點項目',
        items: [
            { code: '8542', name: '積體電路' }, { code: '8703', name: '小客車' }, { code: '8471', name: '電腦產品' }
        ]
    }
};

// --- 4. 關鍵輔助函式 ---

const getCountryFlag = (name) => {
    if (!name) return '🌐';
    const n = name;
    if (n.includes('中國') || n.includes('大陸')) return '🇨🇳';
    if (n.includes('美國')) return '🇺🇸';
    if (n.includes('日本')) return '🇯🇵';
    if (n.includes('韓國')) return '🇰🇷';
    if (n.includes('越南')) return '🇻🇳';
    if (n.includes('德國')) return '🇩🇪';
    if (n.includes('荷蘭')) return '🇳🇱';
    if (n.includes('馬來西亞')) return '🇲🇾';
    if (n.includes('印尼')) return '🇮🇩';
    if (n.includes('泰國')) return '🇹🇭';
    if (n.includes('香港')) return '🇭🇰';
    if (n.includes('新加坡')) return '🇸🇬';
    if (n.includes('澳洲')) return '🇦🇺';
    if (n.includes('印度')) return '🇮🇳';
    return '🌐';
};

const cleanNumber = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isFinite(val) ? val : 0;
  const str = String(val).trim();
  if (str === '-' || str === '－') return 0; 
  const num = parseFloat(str.replace(/[,，]/g, ''));
  return isFinite(num) ? num : 0;
};

// 確保圖表數據安全
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

const formatSmartWeight = (val) => {
    const v = cleanNumber(val);
    if (v === 0) return '0';
    if (v >= 1000) return (v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' 公噸';
    return v.toLocaleString() + ' 公斤';
};

const formatCurrencyAxis = (value) => {
  const v = cleanNumber(value);
  if (v === 0) return '0';
  if (Math.abs(v) >= 100000) return (v / 100000).toFixed(1) + '億';
  if (Math.abs(v) >= 10000) return (v / 10000).toFixed(0) + '千萬';
  return v.toLocaleString();
};

const formatWeightAxis = (value) => {
  const v = cleanNumber(value);
  if (v === 0) return '0';
  if (v >= 1000) return (v / 1000).toFixed(0) + '噸';
  return v.toLocaleString();
};

// 事件映射函式 (處理年/季/月對應)
const mapEventToDateKey = (eventDate, granularity) => {
    if (granularity === 'month') return eventDate; // YYYY-MM
    const [year, month] = eventDate.split('-');
    if (granularity === 'year') return year; // YYYY
    if (granularity === 'quarter') {
        const q = Math.floor((parseInt(month) + 2) / 3);
        return `${year}-Q${q}`; // YYYY-Qx
    }
    return eventDate;
};

// --- 5. 元件 ---

const CustomTimeTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        // 尋找當月/當季/當年是否有事件 (需考慮粒度模糊比對)
        const event = GLOBAL_EVENTS.find(e => label && (label === e.date || label.startsWith(e.date) || (label.length === 4 && e.date.startsWith(label))));
        
        return (
            <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-xl z-50 text-xs">
                <p className="font-bold text-slate-800 mb-2 border-b pb-1">{label}</p>
                {event && (
                    <div className="mb-2 p-1.5 bg-red-50 border border-red-200 rounded text-red-800">
                        <div className="flex items-center gap-1 font-bold"><Newspaper size={10}/> {event.label}</div>
                        <div>{event.desc}</div>
                    </div>
                )}
                {payload.map((entry, index) => (
                    <div key={index} className="flex justify-between gap-3 mb-1" style={{ color: entry.color }}>
                        <span>{entry.name}:</span>
                        <span className="font-mono font-medium">
                            {entry.name.includes('單價') ? (entry.value || 0).toLocaleString() : 
                             entry.name.includes('重量') ? formatSmartWeight(entry.value) : 
                             (entry.value || 0).toLocaleString()}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

// 圓餅圖標籤
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + (outerRadius + 40) * Math.cos(-midAngle * RADIAN);
  const y = cy + (outerRadius + 40) * Math.sin(-midAngle * RADIAN);
  const flag = getCountryFlag(name);

  return (
    <text x={x} y={y} fill="#374151" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11}>
      {`${flag} ${name}`} {(percent * 100).toFixed(0)}%
    </text>
  );
};

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  componentDidCatch(error, errorInfo) { console.error("Chart Error:", error); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded text-slate-400">
          <AlertTriangle size={32} className="mb-2 text-amber-400" />
          <p className="text-sm">圖表資料異常</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- 解析器 ---
const parseCSV = (text) => {
  if (!text || typeof text !== 'string') return { data: [], debugInfo: {} };
  const lines = text.split(/\r\n|\n/).filter(l => l.trim());
  if (lines.length < 2) return { data: [], debugInfo: { error: "No data" } };

  let headerRowIndex = 0;
  let maxScore = 0;
  let bestMapIndex = { date: -1, hsCode: -1, country: -1, type: -1, value: -1, weight: -1, productName: -1 };

  for(let i=0; i < Math.min(lines.length, 20); i++) {
     const row = parseCSVLine(lines[i]);
     let score = 0;
     const currentMapIndex = { date: -1, hsCode: -1, country: -1, type: -1, value: -1, weight: -1, productName: -1 };
     row.forEach((h, idx) => {
        const normalized = String(h || '').toLowerCase().replace(/[\s_"'.()]/g, '');
        if (['date', '日期', '年月', 'time'].some(k => normalized.includes(k))) { currentMapIndex.date = idx; score += 5; }
        if (['hscode', 'code', '稅號', 'ccc'].some(k => normalized.includes(k))) { currentMapIndex.hsCode = idx; score += 5; }
        if (['country', '國家', '產地'].some(k => normalized.includes(k))) { currentMapIndex.country = idx; score += 3; }
        if (['type', '進出口', 'flow'].some(k => normalized.includes(k))) { currentMapIndex.type = idx; score += 3; }
        if (['value', '金額', 'twd'].some(k => normalized.includes(k))) { currentMapIndex.value = idx; score += 3; }
        if (['weight', '重量', 'kg'].some(k => normalized.includes(k))) { currentMapIndex.weight = idx; score += 3; }
        if (['name', '貨名', '品名'].some(k => normalized.includes(k))) { currentMapIndex.productName = idx; score += 3; }
     });
     if(score > maxScore) { maxScore = score; headerRowIndex = i; bestMapIndex = currentMapIndex; }
  }

  const parsedData = lines.slice(headerRowIndex + 1).map((line, idx) => {
    const row = parseCSVLine(line);
    if (row.length < 2) return null; 

    const rawDate = bestMapIndex.date > -1 ? (row[bestMapIndex.date] || '') : '';
    const rawCode = bestMapIndex.hsCode > -1 ? (row[bestMapIndex.hsCode] || '') : '';
    let rawCountry = bestMapIndex.country > -1 ? (row[bestMapIndex.country] || '未知') : '未知';
    const rawType = bestMapIndex.type > -1 ? (row[bestMapIndex.type] || '出口') : '出口'; 
    const rawValue = bestMapIndex.value > -1 ? (row[bestMapIndex.value] || '0') : '0';
    const rawWeight = bestMapIndex.weight > -1 ? (row[bestMapIndex.weight] || '0') : '0';
    const rawName = bestMapIndex.productName > -1 ? (row[bestMapIndex.productName] || '') : '';

    const cleanValue = cleanNumber(rawValue);
    const cleanWeight = cleanNumber(rawWeight);
    const cleanCode = String(rawCode).replace(/[\s.]/g, ''); 

    let cleanDate = rawDate ? rawDate.trim().replace(/\//g, '-').replace(/\./g, '-') : '';
    let yearPart = '2023';
    try {
        if (cleanDate) {
            if (/^\d{5,6}$/.test(cleanDate)) {
                 const yr = parseInt(cleanDate.substring(0, cleanDate.length - 2)) + 1911;
                 cleanDate = `${yr}-${cleanDate.slice(-2)}`;
            } else {
                const rocMatch = cleanDate.match(/^(\d{2,3})[-/](\d{1,2})$/);
                if (rocMatch) cleanDate = `${parseInt(rocMatch[1])+1911}-${rocMatch[2].padStart(2,'0')}`;
            }
            yearPart = cleanDate.substring(0, 4);
        }
    } catch (e) { cleanDate = '2023-01'; }

    const countryStr = String(rawCountry).trim();
    if (['CN', 'China', '大陸'].some(k => countryStr.includes(k))) rawCountry = '中國大陸';
    if (['US', 'USA', 'United States'].some(k => countryStr.includes(k))) rawCountry = '美國';
    if (['JP', 'Japan'].some(k => countryStr.includes(k))) rawCountry = '日本';
    if (['KR', 'Korea', '韓國'].some(k => countryStr.includes(k))) rawCountry = '韓國';
    if (['VN', 'Vietnam'].some(k => countryStr.includes(k))) rawCountry = '越南';

    return {
        id: `row-${idx}`, date: cleanDate, year: yearPart, hsCode: cleanCode, productName: rawName.trim(), country: rawCountry, type: rawType.trim(), value: cleanValue, weight: cleanWeight, isAnomaly: false
    };
  }).filter(item => item !== null && item.hsCode && item.date && item.date.length >= 7);

  return { data: parsedData };
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

const generateMockData = (hsCode, years = 10) => {
    const data = [];
    const countries = ['中國大陸', '美國', '日本', '韓國', '越南', '德國'];
    for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        countries.forEach(country => {
            const val = Math.floor(Math.random() * 50000);
            const wgt = Math.floor(Math.random() * 2000);
            data.push({ id: `${monthStr}-${country}`, date: monthStr, year: monthStr.substring(0,4), hsCode, country, type: Math.random()>0.5?'出口':'進口', value: val, weight: wgt, productName: 'Mock' });
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
    <div className={`p-3 rounded-lg ${color}`}><Icon size={24} className="text-white" /></div>
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
  
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [dataSourceUrl, setDataSourceUrl] = useState('https://docs.google.com/spreadsheets/d/e/2PACX-1vQTBhte4P7bzMFSTlYDml3F25Wcr-sYfC7aOWQiePkfid7f2xBR-WUDMN7NAO3Z2e24Po14dqG7ZxnK/pub?gid=0&single=true&output=csv');
  const [useRealData, setUseRealData] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [detectedProductName, setDetectedProductName] = useState('');

  const [timeRange, setTimeRange] = useState(120); 
  const [granularity, setGranularity] = useState('month'); 
  const [countryViewType, setCountryViewType] = useState('出口'); 
  const [countryMetric, setCountryMetric] = useState('value'); 
  const [countryTopN, setCountryTopN] = useState('5'); 
  const [pivotMode, setPivotMode] = useState('time'); 
  const [currentTopic, setCurrentTopic] = useState(null); 
  const [selectedRegion, setSelectedRegion] = useState('ALL'); 

  const [history, setHistory] = useState(['280300']);
  const [watchedProducts, setWatchedProducts] = useState([]);
  const [relatedProducts, setRelatedProducts] = useState([]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) { setShowSuggestions(false); }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const uniqueProducts = useMemo(() => {
      const map = new Map();
      watchedProducts.forEach(p => map.set(p.code, p.name));
      if (useRealData && dataset.length > 0) {
          dataset.forEach(d => {
              if (d.hsCode && !map.has(d.hsCode)) map.set(d.hsCode, d.productName || `稅號 ${d.hsCode}`);
              else if (d.hsCode && d.productName) { if (map.get(d.hsCode).includes('稅號')) map.set(d.hsCode, d.productName); }
          });
      }
      return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [dataset, useRealData, watchedProducts]);

  const handleInputChange = (e) => {
      const val = e.target.value; setInputValue(val);
      if (!val) { setSuggestions([]); setShowSuggestions(false); return; }
      const matches = uniqueProducts.filter(p => p.code.includes(val.toLowerCase()) || p.name.toLowerCase().includes(val.toLowerCase()));
      setSuggestions(matches.slice(0, 8)); setShowSuggestions(true);
  };

  const selectProduct = (code, name) => {
      setInputValue(`${code} ${name}`); setSearchQuery(code); setCurrentTopic(null); setShowSuggestions(false); handleSearch(code);
  };

  const selectTopic = (topicKey) => {
      setCurrentTopic(topicKey);
      setInputValue(STRATEGIC_TOPICS[topicKey].title);
      setActiveTab('topic_overview');
  };

  const toggleWatchProduct = () => {
      const isWatched = watchedProducts.some(p => p.code === searchQuery);
      if (isWatched) setWatchedProducts(prev => prev.filter(p => p.code !== searchQuery));
      else setWatchedProducts(prev => [{ code: searchQuery, name: detectedProductName || `稅號 ${searchQuery}` }, ...prev]);
  };

  const isCurrentProductWatched = useMemo(() => {
      return watchedProducts.some(p => p.code === searchQuery);
  }, [watchedProducts, searchQuery]);

  useEffect(() => { if (useRealData && dataSourceUrl) fetchRealData(); else handleSearch(searchQuery); }, [useRealData]);

  const fetchRealData = async () => {
      setLoading(true); setFetchError(null);
      try {
          const response = await fetch(dataSourceUrl);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const text = await response.text();
          const { data } = parseCSV(text);
          setDataset(data);
          setLastUpdated(new Date().toLocaleString());
          if (data.length === 0) { setFetchError("讀取無資料"); setUseRealData(false); }
          else filterData(data, searchQuery);
      } catch (error) { setFetchError(error.message); setUseRealData(false); }
      setLoading(false);
  };

  const filterData = (allData, query) => {
      const aggMap = new Map();
      let targetCodes = [query];
      
      if (currentTopic) targetCodes = STRATEGIC_TOPICS[currentTopic].items.map(i => i.code);
      const cleanQuery = String(query).replace(/[\s.]/g, '').toLowerCase(); 

      allData.forEach(d => {
          let isMatch = false;
          const rawCleanCode = d.hsCode.replace(/[\s.]/g, '');
          if (currentTopic) isMatch = targetCodes.some(c => rawCleanCode.startsWith(c));
          else {
              const matchCode = rawCleanCode.includes(cleanQuery);
              const matchName = d.productName && d.productName.toLowerCase().includes(cleanQuery);
              isMatch = matchCode || matchName;
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
        if (relatedSet.size < 2 && useRealData) {
            allData.forEach(d => {
                if (d.hsCode.startsWith(cleanQuery)) relatedSet.add(d.hsCode);
            });
        }
      }
      const relatedList = Array.from(relatedSet).map(code => {
          const found = allData.find(d => d.hsCode === code && d.productName);
          const name = found ? found.productName : (watchedProducts.find(p=>p.code === code)?.name || code);
          return { code, name };
      }).slice(0, 50); 
      setRelatedProducts(relatedList.sort((a, b) => a.code.localeCompare(b.code)));

      let foundName = '';
      const candidate = filtered.find(d => d.productName);
      if (candidate) foundName = candidate.productName;
      setDetectedProductName(currentTopic ? STRATEGIC_TOPICS[currentTopic].title : foundName);

      if (filtered.length === 0 && useRealData) setDisplayData([]);
      else setDisplayData(useRealData ? filtered : generateMockData(query, 10));
  };

  useEffect(() => { if (dataset.length > 0) filterData(dataset, searchQuery); }, [currentTopic]);

  const handleSearch = (overrideQuery) => {
    const target = overrideQuery || inputValue;
    if (!history.includes(target) && target.length < 20) setHistory(prev => [target, ...prev].slice(0, 5));
    if (useRealData) filterData(dataset, target);
    else { setLoading(true); setTimeout(() => { setDisplayData(generateMockData(target, 10)); setLoading(false); }, 600); }
  };

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
      // 1. 粒度處理 (年/季/月)
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
      // 3. 單價修正：(總金額*1000) / 總重量 = 元/公斤
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

  const countryTableData = useMemo(() => {
    const data = [...pivotCountryData];
    data.sort((a, b) => {
        let valA = 0; let valB = 0;
        if (countryViewType === 'balance') {
             valA = countryMetric === 'value' ? a.tradeBalance : a.tradeBalanceWeight;
             valB = countryMetric === 'value' ? b.tradeBalance : b.tradeBalanceWeight;
        } else {
             const isExport = countryViewType === '出口';
             if (countryMetric === 'value') { valA = isExport ? a.exportValue : a.importValue; valB = isExport ? b.exportValue : b.importValue; } 
             else { valA = isExport ? a.exportWeight : a.importWeight; valB = isExport ? b.exportWeight : b.importWeight; }
        }
        return valB - valA;
    });
    const sliceIndex = countryTopN === 'all' ? undefined : parseInt(countryTopN);
    return data.slice(0, sliceIndex);
  }, [pivotCountryData, countryViewType, countryMetric, countryTopN]);

  const filteredCountryTableData = useMemo(() => {
      return countryTableData;
  }, [countryTableData]);

  const countryTrendData = useMemo(() => {
      const topCountries = countryTableData.map(c => c.country);
      const map = {};
      aggregatedData.forEach(t => { map[t.date] = { date: t.date }; topCountries.forEach(c => map[t.date][c] = 0); });

      filteredData.forEach(d => {
          if (topCountries.includes(d.country)) {
              let key = d.date;
              if (granularity === 'year') key = d.year;
              else if (granularity === 'quarter') {
                  const month = parseInt(d.date.split('-')[1]);
                  const q = Math.floor((month + 2) / 3);
                  key = `${d.year}-Q${q}`;
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
  }, [filteredData, countryTableData, countryViewType, countryMetric, granularity, aggregatedData]);

  const summary = useMemo(() => {
    if (filteredData.length === 0) return { totalValue: 0, totalWeight: 0, avgPrice: 0 };
    const totalValue = filteredData.reduce((acc, curr) => acc + curr.value, 0);
    const totalWeight = filteredData.reduce((acc, curr) => acc + curr.weight, 0);
    const avg = totalWeight > 0 ? (totalValue * 1000) / totalWeight : 0;
    
    let valDisplay = (totalValue / 10000).toFixed(0) + ' 萬';
    if (totalValue > 100000) valDisplay = (totalValue / 100000).toFixed(2) + ' 億';
    return { totalValue: valDisplay, totalWeight: formatSmartWeight(totalWeight), avgPrice: isFinite(avg) ? avg.toFixed(2) : 0 };
  }, [filteredData]);

  const topicBreakdown = useMemo(() => {
      if (!currentTopic) return [];
      const codes = STRATEGIC_TOPICS[currentTopic].items.map(i => i.code);
      const map = {};
      filteredData.forEach(d => {
          const matchedItem = STRATEGIC_TOPICS[currentTopic].items.find(i => d.hsCode.startsWith(i.code));
          if (matchedItem) {
              const key = matchedItem.code;
              if (!map[key]) map[key] = { code: key, name: matchedItem.name, value: 0 };
              map[key].value += d.value;
          }
      });
      return Object.values(map).sort((a, b) => b.value - a.value);
  }, [filteredData, currentTopic]);

  const anomalies = useMemo(() => {
      if (useRealData) { return filteredData.filter(d => d.value > 1000 && (d.value/d.weight) > 500).slice(0, 10); }
      return filteredData.filter(d => d.isAnomaly).slice(0, 10); 
  }, [filteredData, useRealData]);

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
        <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
                <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold flex items-center gap-2"><Settings className="text-blue-600"/> 資料來源設定</h3><button onClick={() => setShowConfigModal(false)}><X/></button></div>
                {fetchError && <div className="mb-4 p-2 bg-rose-50 text-rose-700 text-sm">{fetchError}</div>}
                <input type="text" className="w-full p-2 border rounded font-mono text-xs mb-2" value={dataSourceUrl} onChange={(e) => setDataSourceUrl(e.target.value)} />
                <button onClick={() => { if(dataSourceUrl) { setUseRealData(true); fetchRealData(); }}} className="w-full bg-blue-600 text-white py-2 rounded">讀取</button>
            </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex-shrink-0 hidden md:flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold flex items-center gap-2"><Globe size={24} className="text-blue-400" />貿易戰情室</h1>
          <p className="text-xs text-slate-400 mt-2">Customs & Trade Dashboard</p>
        </div>
        <div className="p-4 border-b border-slate-800">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><ShieldAlert size={14}/> 戰略專題</h3>
            <div className="space-y-1">
                {Object.entries(STRATEGIC_TOPICS).map(([key, topic]) => (
                    <button key={key} onClick={() => selectTopic(key)} className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${currentTopic === key ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>{topic.title}</button>
                ))}
            </div>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          <div className="mb-4"><h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">重點監控</h3>
             {watchedProducts.map(fav => (<button key={fav.code} onClick={() => selectProduct(fav.code, fav.name)} className="block w-full text-left px-2 py-1 text-sm text-slate-300 hover:text-white truncate">{fav.name}</button>))}
          </div>
          {/* 功能 2: 歷史紀錄回歸 */}
          <div className="mb-4"><h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">最近搜尋</h3>
             {history.map(code => (
                <button key={code} onClick={() => handleSearch(code)} className="block w-full text-left px-2 py-1 text-sm text-slate-300 hover:text-white truncate flex items-center gap-2">
                    <History size={12}/> {code}
                </button>
             ))}
          </div>
        </div>
        <div className="p-4 border-t border-slate-800"><button onClick={() => setShowConfigModal(true)} className="flex items-center gap-2 text-xs text-slate-400 hover:text-white"><Settings size={12}/> 設定資料源</button></div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto h-screen flex flex-col relative">
        <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 flex-1" ref={searchContainerRef}>
                <div className="relative flex-1 max-w-lg">
                <input type="text" value={inputValue} onChange={handleInputChange} onFocus={() => inputValue && setShowSuggestions(true)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg outline-none" placeholder="搜尋貨名或 Code" />
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                {showSuggestions && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                        {suggestions.map((item) => (<button key={item.code} onClick={() => selectProduct(item.code, item.name)} className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm border-b border-slate-50">{item.name} <span className="text-xs text-slate-400">({item.code})</span></button>))}
                    </div>
                )}
                </div>
                <button onClick={() => handleSearch()} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2"><RefreshCw size={18} className={loading ? "animate-spin" : ""}/> 搜尋</button>
            </div>
            {/* 下拉選單檢視相關產品 */}
            {relatedProducts.length > 1 && !currentTopic && (
                <div className="relative group">
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg cursor-pointer hover:bg-slate-200">
                        <Tag size={16} className="text-slate-500"/><span className="text-sm font-medium text-slate-700">細項產品 ({relatedProducts.length})</span><ChevronDown size={14}/>
                        <select className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => { const p = relatedProducts.find(i=>i.code===e.target.value); selectProduct(p.code, p.name); }} value={searchQuery}>
                            {relatedProducts.map(p => (<option key={p.code} value={p.code}>{p.code} - {p.name}</option>))}
                        </select>
                    </div>
                </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 rounded-lg">
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
          </div>
        </header>

        <div className="px-6 pt-6 pb-2">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                {detectedProductName || '搜尋結果'} 
                {!currentTopic && <button onClick={toggleWatchProduct} className="ml-2 text-slate-400 hover:text-amber-400"><Star size={20} fill={isCurrentProductWatched ? "gold" : "none"} /></button>}
            </h2>
            {currentTopic && (
                <div className="mt-3 bg-purple-50 p-4 rounded-lg border border-purple-100">
                     <div className="flex items-start gap-3">
                        <Scale className="text-purple-600 mt-1" />
                        <div>
                            <p className="font-bold text-purple-900">{STRATEGIC_TOPICS[currentTopic].desc}</p>
                            <p className="text-sm text-purple-700 mt-1">包含項目：{STRATEGIC_TOPICS[currentTopic].items.map(i => i.name).join('、')}</p>
                        </div>
                     </div>
                </div>
            )}
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-auto">
          {currentTopic && activeTab === 'topic_overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                      <h4 className="font-bold text-slate-700 mb-4">專題產品佔比 (依金額)</h4>
                      <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                              <Pie data={topicBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                                  {topicBreakdown.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                              </Pie>
                              <Tooltip formatter={(val) => formatCurrencyAxis(val) + ' 千元'} />
                              <Legend />
                          </PieChart>
                      </ResponsiveContainer>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 overflow-auto">
                      <h4 className="font-bold text-slate-700 mb-4">清單產品明細</h4>
                      <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50"><tr><th className="p-2">代碼</th><th className="p-2">品名</th><th className="p-2 text-right">總額 (千元)</th></tr></thead>
                          <tbody>
                              {topicBreakdown.map((row, i) => (
                                  <tr key={i} className="border-b"><td className="p-2 font-mono text-slate-500">{row.code}</td><td className="p-2 font-medium">{row.name}</td><td className="p-2 text-right text-blue-600">{(row.value || 0).toLocaleString()}</td></tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          )}

          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <KPICard title="總貿易額 (千元)" value={summary.totalValue} subtext="區間累計" trend="up" icon={TrendingUp} color="bg-blue-500"/>
            <KPICard title="總重量" value={summary.totalWeight} subtext="區間累計" trend="up" icon={Database} color="bg-emerald-500"/>
            <KPICard title="平均單價 (元/KG)" value={`$${summary.avgPrice}`} subtext="加權平均" trend="down" icon={AlertTriangle} color="bg-amber-500"/>
            <KPICard title="異常波動" value={0} subtext="待人工確認" trend="down" icon={AlertTriangle} color="bg-rose-500"/>
          </section>

          <ErrorBoundary>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[500px]">
              <div className="border-b border-slate-200 flex overflow-x-auto">
                {currentTopic && <button onClick={() => setActiveTab('topic_overview')} className={`px-5 py-3 text-sm font-bold flex items-center gap-2 ${activeTab === 'topic_overview' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600'}`}><Layers size={16}/> 專題總覽</button>}
                <button onClick={() => setActiveTab('overview')} className={`px-5 py-3 text-sm font-bold flex items-center gap-2 ${activeTab === 'overview' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600'}`}><TrendingUp size={16}/> 時間趨勢</button>
                <button onClick={() => setActiveTab('country')} className={`px-5 py-3 text-sm font-bold flex items-center gap-2 ${activeTab === 'country' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600'}`}><Globe size={16}/> 國家分析</button>
                <button onClick={() => setActiveTab('pivot')} className={`px-5 py-3 text-sm font-bold flex items-center gap-2 ${activeTab === 'pivot' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600'}`}><TableIcon size={16}/> 數據樞紐</button>
                <button onClick={() => setActiveTab('analysis')} className={`px-5 py-3 text-sm font-bold flex items-center gap-2 ${activeTab === 'analysis' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600'}`}><AlertTriangle size={16}/> 變動與關聯診斷</button>
              </div>

              <div className="p-6 flex-1 bg-slate-50/50">
                {loading ? <div className="h-full flex items-center justify-center">載入中...</div> : (
                  <>
                    {activeTab === 'overview' && (
                      <div className="space-y-6">
                        <div className="bg-white p-4 rounded-lg shadow-sm h-96">
                          <h3 className="font-bold text-slate-700 mb-4">趨勢圖 A: 金額與單價</h3>
                          <ResponsiveContainer width="100%" height="90%">
                            <ComposedChart data={aggregatedData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="date" tick={{fontSize: 11}} />
                              <YAxis yAxisId="left" tickFormatter={formatCurrencyAxis} tick={{fontSize: 11}} />
                              <YAxis yAxisId="right" orientation="right" tickFormatter={(val) => val.toFixed(1)} tick={{fontSize: 11}} unit=" $"/>
                              <Tooltip content={<CustomTimeTooltip />} />
                              <Legend />
                              <Bar yAxisId="left" dataKey="exportValue" name="出口金額" fill="#3b82f6" />
                              <Bar yAxisId="left" dataKey="importValue" name="進口金額" fill="#10b981" />
                              <Line yAxisId="right" type="monotone" dataKey="avgExportPrice" name="出口單價" stroke="#f59e0b" strokeWidth={2} dot={false} />
                              <Line yAxisId="right" type="monotone" dataKey="avgImportPrice" name="進口單價" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                              {/* 功能 1: 時間軸事件標記 (支援年/季) */}
                              {GLOBAL_EVENTS.map((event, i) => (
                                <ReferenceLine key={i} x={mapEventToDateKey(event.date, granularity)} yAxisId="left" stroke="red" strokeDasharray="3 3" label={{ position: 'top', value: '!', fill: 'red', fontSize: 10 }} />
                              ))}
                            </ComposedChart>
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
                              <YAxis tickFormatter={formatSmartWeight} label={{ value: '重量', angle: -90, position: 'insideLeft', style: {fontSize: 11, fill: '#64748b'} }} tick={{fontSize: 11}} />
                              <Tooltip content={<CustomTimeTooltip />} />
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
                                  <button onClick={() => setCountryViewType('balance')} className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${countryViewType === 'balance' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-600'}`}>順逆差</button>
                              </div>
                              <select value={countryTopN} onChange={(e) => setCountryTopN(e.target.value)} className="border rounded px-2 text-sm"><option value="5">Top 5</option><option value="10">Top 10</option><option value="all">All</option></select>
                              <div className="flex items-center gap-2 text-sm text-slate-600 ml-2">
                                  <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={countryMetric === 'value'} onChange={() => setCountryMetric('value')} className="text-blue-600"/> 金額</label>
                                  <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={countryMetric === 'weight'} onChange={() => setCountryMetric('weight')} className="text-blue-600"/> 重量</label>
                              </div>
                          </div>
                          <div className="flex gap-2">
                              <button onClick={() => copyToClipboard(filteredCountryTableData)} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded text-sm hover:bg-slate-50 text-slate-700"><Copy size={14}/> 複製</button>
                              <button onClick={() => exportToCSV(filteredCountryTableData, `Country_Data_${countryViewType}`)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"><Download size={14}/> 下載</button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm h-80">
                                <h4 className="font-bold text-center mb-2">
                                    {countryViewType === 'balance' ? '貿易總額佔比 (依存度)' : '總量佔比'}
                                </h4>
                                <ResponsiveContainer width="100%" height="90%">
                                    <PieChart>
                                        <Pie data={countryPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" label={renderCustomizedLabel}>
                                            {countryPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={(val) => countryMetric === 'value' ? formatCurrencyAxis(val) : formatSmartWeight(val)} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm h-80">
                                <h4 className="font-bold text-center mb-2">
                                    {countryViewType === 'balance' ? '順逆差趨勢' : '各國趨勢競賽'}
                                </h4>
                                <ResponsiveContainer width="100%" height="90%">
                                    <LineChart data={countryTrendData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="date" tick={{fontSize: 10}} />
                                        <YAxis tickFormatter={countryMetric==='value'?formatCurrencyAxis:formatSmartWeight} tick={{fontSize: 10}} />
                                        <Tooltip formatter={(value, name) => [(value || 0).toLocaleString(), name]} />
                                        <Legend wrapperStyle={{fontSize: '10px'}}/>
                                        {pivotCountryData.slice(0, parseInt(countryTopN)).map((c, i) => (
                                            <Line key={c.country} type="monotone" dataKey={c.country} stroke={COLORS[i % COLORS.length]} dot={false} strokeWidth={2} />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col h-96">
                              <div className="overflow-auto flex-1">
                                  <table className="w-full text-sm text-left">
                                      <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0">
                                          <tr><th className="px-4 py-3">國家</th><th className="px-4 py-3 text-right">出口額</th><th className="px-4 py-3 text-right">進口額</th><th className="px-4 py-3 text-right font-bold text-blue-600">順逆差</th><th className="px-4 py-3 text-right">出口重量</th><th className="px-4 py-3 text-right">進口重量</th><th className="px-4 py-3 text-right text-amber-600">出口單價</th><th className="px-4 py-3 text-right text-amber-600">進口單價</th></tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                          {countryTableData.map((row, idx) => (
                                              <tr key={idx} className="hover:bg-slate-50">
                                                  <td className="px-4 py-2 font-medium text-slate-800">{row.country}</td>
                                                  <td className="px-4 py-2 text-right font-mono">{(row.exportValue || 0).toLocaleString()}</td>
                                                  <td className="px-4 py-2 text-right font-mono">{(row.importValue || 0).toLocaleString()}</td>
                                                  <td className={`px-4 py-2 text-right font-mono font-bold ${row.tradeBalance >= 0 ? 'text-slate-800' : 'text-red-500'}`}>{row.tradeBalance >= 0 ? '+' : ''}{(row.tradeBalance || 0).toLocaleString()}</td>
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
                    )}

                    {activeTab === 'pivot' && (
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
                                                <td className="px-4 py-2 text-right font-mono text-blue-700">{(row.exportValue || 0).toLocaleString()}</td>
                                                <td className="px-4 py-2 text-right font-mono text-emerald-700">{(row.importValue || 0).toLocaleString()}</td>
                                                <td className={`px-4 py-2 text-right font-mono font-bold ${row.tradeBalance >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>{row.tradeBalance > 0 ? '+' : ''}{(row.tradeBalance || 0).toLocaleString()}</td>
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
                    )}

                    {activeTab === 'analysis' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* 左欄：功能 4 - 重大歷史事件簿 */}
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

                            {/* 右欄：關聯產品比較 */}
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