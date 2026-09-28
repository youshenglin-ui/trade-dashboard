import React, { useState, useEffect, useRef } from 'react';
import { Settings, SearchCode, X, Search, Star, RefreshCw, ExternalLink, Zap } from 'lucide-react';
import { Sidebar, MobileTopBar, MobileBottomNav, MoreSheet } from './components/layout/AppChrome';
import { MODULES } from './config/modules';
import TradeDashboard from './components/TradeDashboard';
import HydrogenDashboard from './components/HydrogenDashboard';
import CcusDashboard from './components/CcusDashboard';
import CarbonFeeDashboard from './components/CarbonFeeDashboard';
import { STRATEGIC_TOPICS } from './utils/constants';
import { normalizeCode } from './utils/helpers';
import { fetchAllTradeRecords } from './lib/fetchTradeRecords';

const App = () => {
  const [activeTab, setActiveTab] = useState('overview'); 
  const [activeModule, setActiveModule] = useState('trade'); // 'trade' | 'hydrogen' | 'ccus' | 'carbonfee'
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false); // 新增：控制是否為獨立全螢幕展示模式
  const [showMore, setShowMore] = useState(false); // 手機版「更多」抽屜
  const [mobileSearch, setMobileSearch] = useState(false); // 手機版搜尋列展開

  // Shared Trade State
  const [searchQuery, setSearchQuery] = useState('280300'); 
  const [inputValue, setInputValue] = useState('280300'); 
  const [dataset, setDataset] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef(null);
  
  const [useRealData, setUseRealData] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [detectedProductName, setDetectedProductName] = useState('');
  const [inspectorCode, setInspectorCode] = useState('');
  const [currentTopic, setCurrentTopic] = useState(null); 
  
  const [history, setHistory] = useState([
      { code: '290511', name: '甲醇' },
      { code: '291521', name: '醋酸' },
      { code: '280410', name: '氫氣' },
      { code: '280300', name: '碳黑' },
      { code: '72', name: '鋼鐵' },
      { code: '2523', name: '水泥' }
  ]);
  
  const [watchedProducts, setWatchedProducts] = useState([]);
  const [dataHealth, setDataHealth] = useState({});

  // 解析 URL 參數 (實作獨立頁面路由機制)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mod = params.get('module');
    const standalone = params.get('standalone');
    
    if (mod && ['trade', 'hydrogen', 'ccus', 'carbonfee'].includes(mod)) {
      setActiveModule(mod);
    }
    if (standalone === 'true') {
      setIsStandalone(true);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) { setShowSuggestions(false); }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
      if (useRealData && dataset.length === 0) {
           fetchRealData();
      }
  }, [useRealData]);

  const fetchRealData = async () => {
      setLoading(true); setFetchError(null);
      try {
          const combinedData = await fetchAllTradeRecords();

          const health = {};
          combinedData.forEach(d => {
             const y = d.year;
             if(!health[y]) health[y] = { export: 0, import: 0 };
             if(d.type === '出口') health[y].export++;
             if(d.type === '進口') health[y].import++;
          });
          setDataHealth(health);

          const groups = {};
          combinedData.forEach(item => {
              const key = `${item.date}-${item.country}-${item.type}`;
              if (!groups[key]) groups[key] = [];
              groups[key].push(item);
          });

          const cleanDataset = [];
          Object.values(groups).forEach(groupItems => {
              groupItems.sort((a, b) => a.hsCode.length - b.hsCode.length);
              const keptItems = [];
              const keptCodes = new Set();
              groupItems.forEach(item => {
                  let isCovered = false;
                  for (let existingCode of keptCodes) {
                      if (item.hsCode.startsWith(existingCode)) { isCovered = true; break; }
                  }
                  if (!isCovered) {
                      keptItems.push(item);
                      keptCodes.add(item.hsCode);
                  }
              });
              cleanDataset.push(...keptItems);
          });

          cleanDataset.sort((a, b) => b.date.localeCompare(a.date));
          setDataset(cleanDataset);
          if (cleanDataset.length === 0) { setFetchError("所有來源皆無有效資料"); setUseRealData(false); }
      } catch (error) { setFetchError(error.message); setUseRealData(false); }
      setLoading(false);
  };

  const handleSearch = (overrideQuery, overrideName) => {
    const target = overrideQuery || inputValue;
    const nameToSave = overrideName || detectedProductName || target;
    setHistory(prev => {
        const newEntry = { code: target, name: nameToSave };
        const filtered = prev.filter(h => h.code !== target);
        return [newEntry, ...filtered].slice(0, 8);
    });
    setActiveModule('trade');
  };

  const selectProduct = (code, name) => {
      setInputValue(`${code} ${name}`); 
      setSearchQuery(code); 
      setCurrentTopic(null); 
      setShowSuggestions(false); 
      setActiveModule('trade');
      handleSearch(code, name); 
  };

  const selectTopic = (topicKey) => {
      setCurrentTopic(topicKey);
      setInputValue(STRATEGIC_TOPICS[topicKey].title);
      setActiveModule('trade');
  };

  const handleInputChange = (e) => {
      const val = e.target.value; 
      setInputValue(val);
      if (!val) { setSuggestions([]); setShowSuggestions(false); return; }
      
      const uniqueProducts = new Map();
      watchedProducts.forEach(p => uniqueProducts.set(p.code, p.name));
      if (dataset.length > 0) {
        for(let i=0; i<Math.min(dataset.length, 5000); i++) {
           if(uniqueProducts.size > 20) break;
           const d = dataset[i];
           if (d.hsCode.includes(val) || (d.productName && d.productName.toLowerCase().includes(val.toLowerCase()))) {
               uniqueProducts.set(d.hsCode, d.productName);
           }
        }
      }
      const matches = Array.from(uniqueProducts.entries()).map(([code, name]) => ({ code, name }));
      setSuggestions(matches.slice(0, 8)); 
      setShowSuggestions(true);
  };

  const runInspector = () => {
      if (!dataset.length) return "無數據";
      const cleanInput = normalizeCode(inspectorCode);
      const matches = dataset.filter(d => normalizeCode(d.hsCode).startsWith(cleanInput));
      if (matches.length === 0) return `找不到代碼為 "${cleanInput}" 開頭的資料。`;
      const dates = matches.map(d => d.date).sort();
      return `✅ 找到 ${matches.length} 筆資料。\n` +
             `📅 期間：${dates[0]} ~ ${dates[dates.length - 1]}\n` +
             `📋 包含產品：${Array.from(new Set(matches.map(d => d.productName))).slice(0,3).join(', ')}`;
  };

  const goModule = (id) => { setActiveModule(id); if (id !== 'trade') setCurrentTopic(null); setMobileSearch(false); window.scrollTo?.(0, 0); };
  const moduleTitle = MODULES.find(m => m.id === activeModule)?.label || '';
  const isWatched = watchedProducts.some(p => p.code === searchQuery);
  const toggleWatch = () => {
      if (isWatched) setWatchedProducts(prev => prev.filter(p => p.code !== searchQuery));
      else setWatchedProducts(prev => [{ code: searchQuery, name: detectedProductName || `稅號 ${searchQuery}` }, ...prev]);
  };

  return (
    <div className="min-h-screen md:flex text-brand-ink">
      {/* Settings Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-brand-line overflow-y-auto max-h-[90vh]">
                <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold flex items-center gap-2"><Settings className="text-brand"/> 資料來源與診斷</h3><button onClick={() => setShowConfigModal(false)} aria-label="關閉" className="w-10 h-10 rounded-lg hover:bg-slate-100 flex items-center justify-center"><X/></button></div>
                {fetchError && <div className="mb-4 p-2 bg-rose-50 text-rose-700 text-sm">{fetchError}</div>}
                <div className="mb-6">
                    <label className="text-sm font-bold text-slate-600 mb-2 block">資料庫</label>
                    <div className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg space-y-1">
                        <div>來源：Supabase（PostgreSQL）trade_records 資料表</div>
                        <div>目前已載入：{dataset.length.toLocaleString()} 筆</div>
                    </div>
                    <button onClick={() => { setUseRealData(true); fetchRealData(); }} className="w-full h-11 bg-brand text-white rounded-xl mt-3 flex items-center justify-center gap-2 font-bold">
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""}/> 重新讀取
                    </button>
                </div>
                <div className="border-t pt-4">
                     <label className="text-sm font-bold text-slate-600 mb-1 block flex items-center gap-2"><SearchCode size={16}/> 資料庫診斷器 (Data Inspector)</label>
                     <div className="flex gap-2 mb-2"><input type="text" placeholder="輸入稅號 (例如 2523)" className="flex-1 h-11 px-3 border border-brand-line rounded-lg" value={inspectorCode} onChange={e => setInspectorCode(e.target.value)} /></div>
                     <div className="p-3 bg-slate-100 rounded-lg text-xs font-mono whitespace-pre-line text-slate-700 min-h-[80px]">{inspectorCode ? runInspector() : "請輸入稅號檢查..."}</div>
                </div>
            </div>
        </div>
      )}

      {/* 電腦版左側功能列 (獨立展示模式時隱藏) */}
      {!isStandalone && (
        <Sidebar activeModule={activeModule} onModule={goModule} topics={STRATEGIC_TOPICS} currentTopic={currentTopic} onTopic={selectTopic}
          watched={watchedProducts} history={history} onProduct={selectProduct} onSettings={() => setShowConfigModal(true)} />
      )}

      {/* Main Content */}
      <main className={`flex-1 min-w-0 flex flex-col relative md:h-screen md:overflow-y-auto ${isStandalone ? '' : 'pb-24 md:pb-0'}`}>
        {!isStandalone && <MobileTopBar title={moduleTitle} showSearch={activeModule === 'trade'} onSearch={() => setMobileSearch(v => !v)} />}

        {/* 只有在貿易模組時，才顯示搜尋 Header 與標題 */}
        {activeModule === 'trade' && (
            <>
                <header className={`${mobileSearch ? 'block' : 'hidden'} md:block bg-white border-b border-brand-line px-4 md:px-7 py-3 md:sticky md:top-0 z-20`}>
                    <div className="flex items-center gap-3" ref={searchContainerRef}>
                        <div className="hidden md:block text-sm text-brand-muted whitespace-nowrap">貿易戰情室 <span className="px-1.5">/</span> <span className="text-brand-ink font-bold">{currentTopic ? '戰略專題' : '單一品項查詢'}</span></div>
                        <div className="hidden md:block flex-1" />
                        <div className="relative flex-1 md:flex-none md:w-[380px]">
                            <input type="text" value={inputValue} onChange={handleInputChange} onFocus={() => inputValue && setShowSuggestions(true)} aria-label="搜尋貨名或稅號"
                                className="w-full h-11 pl-10 pr-4 border border-brand-line rounded-xl outline-none focus:border-brand text-[15px]" placeholder="搜尋貨名或稅號" />
                            <Search className="absolute left-3.5 top-3 text-brand-muted" size={18} />
                            {showSuggestions && (<div className="absolute top-full left-0 w-full mt-1 bg-white border border-brand-line rounded-xl shadow-xl z-50 max-h-72 overflow-y-auto">{suggestions.map((item) => (<button key={item.code} onClick={() => { selectProduct(item.code, item.name); setMobileSearch(false); }} className="w-full text-left px-4 py-3 hover:bg-brand-soft text-sm border-b border-slate-50 last:border-0 flex items-center justify-between gap-2"><span className="font-medium">{item.name}</span><span className="num text-xs text-brand-muted bg-slate-100 px-1.5 py-0.5 rounded">{item.code}</span></button>))}</div>)}
                        </div>
                        <button onClick={() => { handleSearch(); setMobileSearch(false); }} className="h-11 px-5 bg-brand text-white rounded-xl flex items-center gap-2 font-bold flex-shrink-0"><RefreshCw size={17} className={loading ? "animate-spin" : ""}/> 搜尋</button>
                    </div>
                </header>

                <div className="px-4 md:px-7 pt-4 md:pt-5">
                    <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                                {currentTopic && <span className="w-9 h-9 rounded-xl bg-brand text-white flex items-center justify-center flex-shrink-0"><Zap size={20} /></span>}
                                <h2 className="text-2xl md:text-[28px] font-black leading-tight">{detectedProductName || '搜尋結果'}</h2>
                                {!currentTopic && <span className="num text-base md:text-lg text-brand-muted font-semibold">HS {searchQuery}</span>}
                                {!currentTopic && (
                                    <button onClick={toggleWatch} aria-label={isWatched ? '取消重點監控' : '加入重點監控'} title={isWatched ? '取消重點監控' : '加入重點監控'}
                                        className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors ${isWatched ? 'bg-amber-50 border-amber-200 text-amber-500' : 'bg-white border-brand-line text-slate-400 hover:text-amber-400'}`}>
                                        <Star size={19} fill={isWatched ? "currentColor" : "none"} />
                                    </button>
                                )}
                            </div>
                            {currentTopic && (
                                <div className="mt-3 bg-brand-soft p-3 rounded-xl flex flex-col md:flex-row md:items-center gap-2 md:justify-between">
                                    <p className="text-sm text-brand-dark font-bold">{STRATEGIC_TOPICS[currentTopic].desc}</p>
                                    {STRATEGIC_TOPICS[currentTopic].sourceUrl && (<a href={STRATEGIC_TOPICS[currentTopic].sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-brand hover:underline whitespace-nowrap"><ExternalLink size={13}/> 官方資料來源</a>)}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </>
        )}

        {/* Dynamic Module Rendering */}
        {activeModule === 'hydrogen' ? (
             <HydrogenDashboard />
        ) : activeModule === 'ccus' ? (
             <CcusDashboard />
        ) : activeModule === 'carbonfee' ? (
             <CarbonFeeDashboard />
        ) : (
             <TradeDashboard 
                useRealData={useRealData}
                dataset={dataset}
                setDataset={setDataset}
                setDataHealth={setDataHealth}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                inputValue={inputValue}
                setInputValue={setInputValue}
                currentTopic={currentTopic}
                setCurrentTopic={setCurrentTopic}
                detectedProductName={detectedProductName}
                setDetectedProductName={setDetectedProductName}
                setFetchError={setFetchError}
                setLoading={setLoading}
                loading={loading}
             />
        )}
      </main>

      {!isStandalone && (
        <>
          <MobileBottomNav activeModule={activeModule} onModule={goModule} onMore={() => setShowMore(true)} />
          <MoreSheet open={showMore} onClose={() => setShowMore(false)} topics={STRATEGIC_TOPICS} onTopic={selectTopic}
            history={history} onProduct={selectProduct} onSettings={() => setShowConfigModal(true)} />
        </>
      )}
    </div>
  );
};

export default App;