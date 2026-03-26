import React, { useState, useEffect, useRef } from 'react';
import { 
  Globe, ShieldAlert, Layers, Factory, ChevronRight, Settings, Plus, Trash2, SearchCode, X, Search, History, Star, RefreshCw, ExternalLink, Zap, Leaf
} from 'lucide-react';
import TradeDashboard from './components/TradeDashboard';
import HydrogenDashboard from './components/HydrogenDashboard';
import CcusDashboard from './components/CcusDashboard';
import { STRATEGIC_TOPICS } from './utils/constants';
import { normalizeCode, parseCSV_Safe } from './utils/helpers';

const App = () => {
  const [activeTab, setActiveTab] = useState('overview'); 
  const [activeModule, setActiveModule] = useState('trade'); // 'trade' | 'hydrogen' | 'ccus'
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false); // 新增：控制是否為獨立全螢幕展示模式

  // Shared Trade State
  const [searchQuery, setSearchQuery] = useState('280300'); 
  const [inputValue, setInputValue] = useState('280300'); 
  const [dataset, setDataset] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef(null);
  
  const activeBase = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQTBhte4P7bzMFSTlYDml3F25Wcr-sYfC7aOWQiePkfid7f2xBR-WUDMN7NAO3Z2e24Po14dqG7ZxnK/pub';
  const archiveBase = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRzjXsv2ydCw4O_eDQvunQkn1UWxTNaW7ejOaf3EcDrWCZZzTK1i6u6mJ3KSVkowRjaMVNUnYdA45Bx/pub';

  const [dataSources, setDataSources] = useState([
    `${activeBase}?gid=9883438&single=true&output=csv`,      // 2025
    `${activeBase}?gid=111460997&single=true&output=csv`,    // 2024
    `${activeBase}?gid=1075035870&single=true&output=csv`,   // 2023
    `${activeBase}?gid=2046100985&single=true&output=csv`,   // 2022
    `${activeBase}?gid=1831893040&single=true&output=csv`,   // 2021
    `${activeBase}?gid=1203579653&single=true&output=csv`,   // 2020
    `${activeBase}?gid=1828590182&single=true&output=csv`,   // 2019
    `${activeBase}?gid=892690605&single=true&output=csv`,    // 2018
    `${activeBase}?gid=127022410&single=true&output=csv`,    // 2017
    `${activeBase}?gid=723477109&single=true&output=csv`,    // 2016
    `${activeBase}?gid=1464732954&single=true&output=csv`,   // 2015

    `${archiveBase}?gid=1882060232&single=true&output=csv`,
    `${archiveBase}?gid=1951510622&single=true&output=csv`,
    `${archiveBase}?gid=1940628234&single=true&output=csv`,
    `${archiveBase}?gid=1693737933&single=true&output=csv`,
    `${archiveBase}?gid=1407313243&single=true&output=csv`,
    `${archiveBase}?gid=698533804&single=true&output=csv`,
    `${archiveBase}?gid=54711180&single=true&output=csv`,
    `${archiveBase}?gid=2061649166&single=true&output=csv`
  ]);
  
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
    
    if (mod && ['trade', 'hydrogen', 'ccus'].includes(mod)) {
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
      if (useRealData && dataSources.length > 0 && dataset.length === 0) {
           fetchRealData();
      }
  }, [useRealData]);

  const fetchRealData = async () => {
      setLoading(true); setFetchError(null);
      try {
          const responses = await Promise.all(dataSources.map(url => fetch(url).then(res => {
              if(!res.ok) throw new Error(`HTTP Error: ${res.status}`);
              return res.text();
          })));
          
          let combinedData = [];
          responses.forEach(text => {
              const { data } = parseCSV_Safe(text);
              combinedData = [...combinedData, ...data];
          });
          
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

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-800">
      {/* Settings Modal */}
      {showConfigModal && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 overflow-y-auto max-h-[90vh]">
                <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold flex items-center gap-2"><Settings className="text-blue-600"/> 資料來源與診斷</h3><button onClick={() => setShowConfigModal(false)}><X/></button></div>
                {fetchError && <div className="mb-4 p-2 bg-rose-50 text-rose-700 text-sm">{fetchError}</div>}
                <div className="mb-6">
                    <label className="text-sm font-bold text-slate-600 mb-2 block flex justify-between">
                        <span>Google Sheet CSV 連結 ({dataSources.length})</span>
                        <button onClick={() => setDataSources([...dataSources, ''])} className="text-blue-600 flex items-center gap-1 text-xs"><Plus size={14}/> 新增連結</button>
                    </label>
                    <div className="space-y-2">
                        {dataSources.map((url, idx) => (
                            <div key={idx} className="flex gap-2">
                                <input type="text" className="flex-1 p-2 border rounded font-mono text-xs" placeholder="https://.../output=csv" value={url} onChange={(e) => {
                                    const newSources = [...dataSources]; newSources[idx] = e.target.value; setDataSources(newSources);
                                }} />
                                {dataSources.length > 1 && <button onClick={() => setDataSources(dataSources.filter((_, i) => i !== idx))} className="text-rose-500 hover:bg-rose-50 p-2 rounded"><Trash2 size={16}/></button>}
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 text-xs text-slate-500 bg-blue-50 p-2 rounded">💡 提示：您可以將不同年份的資料分開存放在不同的 Google Sheet，再將連結貼到這裡，系統會自動合併讀取。</div>
                    <button onClick={() => { if(dataSources.some(u=>u)) { setUseRealData(true); fetchRealData(); }}} className="w-full bg-blue-600 text-white py-2 rounded mt-3">讀取並更新所有來源</button>
                </div>
                <div className="border-t pt-4">
                     <label className="text-sm font-bold text-slate-600 mb-1 block flex items-center gap-2"><SearchCode size={16}/> 資料庫診斷器 (Data Inspector)</label>
                     <div className="flex gap-2 mb-2"><input type="text" placeholder="輸入稅號 (例如 2523)" className="flex-1 p-2 border rounded" value={inspectorCode} onChange={e => setInspectorCode(e.target.value)} /></div>
                     <div className="p-3 bg-slate-100 rounded text-xs font-mono whitespace-pre-line text-slate-700 min-h-[80px]">{inspectorCode ? runInspector() : "請輸入稅號檢查..."}</div>
                </div>
            </div>
        </div>
      )}

      {/* Sidebar (獨立展示模式時隱藏) */}
      {!isStandalone && (
        <aside className="w-64 bg-slate-900 text-white flex-shrink-0 hidden md:flex flex-col">
          <div className="p-6 border-b border-slate-700"><h1 className="text-xl font-bold flex items-center gap-2"><Globe size={24} className="text-blue-400" />貿易戰情室</h1><p className="text-xs text-slate-400 mt-2">Customs & Trade Dashboard</p></div>
          <div className="p-4 border-b border-slate-800">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><ShieldAlert size={14}/> 戰略專題</h3>
              <div className="space-y-1">{Object.entries(STRATEGIC_TOPICS).map(([key, topic]) => (<button key={key} onClick={() => selectTopic(key)} className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${currentTopic === key && activeModule === 'trade' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>{topic.title}</button>))}</div>
          </div>
          
          <div className="p-4 border-b border-slate-800">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Layers size={14}/> 專項儀表板</h3>
              <div className="space-y-2">
                  <button 
                      onClick={() => { setActiveModule('hydrogen'); setCurrentTopic(null); }}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2 ${activeModule === 'hydrogen' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-300 hover:bg-slate-800'}`}
                  >
                      <Factory size={16} className={activeModule === 'hydrogen' ? 'text-white' : 'text-emerald-400'}/>
                      <span>氫能供需戰情室</span>
                      {activeModule === 'hydrogen' && <ChevronRight size={14} className="ml-auto opacity-70"/>}
                  </button>
                  <button 
                      onClick={() => { setActiveModule('ccus'); setCurrentTopic(null); }}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2 ${activeModule === 'ccus' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-300 hover:bg-slate-800'}`}
                  >
                      <Leaf size={16} className={activeModule === 'ccus' ? 'text-white' : 'text-teal-400'}/>
                      <span>碳捕捉與封存戰情室</span>
                      {activeModule === 'ccus' && <ChevronRight size={14} className="ml-auto opacity-70"/>}
                  </button>
              </div>
          </div>

          <div className="p-4 overflow-y-auto flex-1">
            <div className="mb-4"><h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">重點監控</h3>{watchedProducts.map(fav => (<button key={fav.code} onClick={() => selectProduct(fav.code, fav.name)} className="block w-full text-left px-2 py-1 text-sm text-slate-300 hover:text-white truncate">{fav.name}</button>))}</div>
            <div className="mb-4"><h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">最近搜尋</h3>
              {history.map((item, idx) => (
                  <button key={idx} onClick={() => selectProduct(item.code, item.name)} className="block w-full text-left px-2 py-1 text-sm text-slate-300 hover:text-white truncate flex items-center gap-2">
                      <History size={12}/> {item.code} {item.name ? `- ${item.name}` : ''}
                  </button>
              ))}
            </div>
          </div>
          <div className="p-4 border-t border-slate-800"><button onClick={() => setShowConfigModal(true)} className="flex items-center gap-2 text-xs text-slate-400 hover:text-white"><Settings size={12}/> 設定資料源</button></div>
        </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto h-screen flex flex-col relative">
        
        {/* 只有在貿易模組時，才顯示搜尋 Header 與標題 */}
        {activeModule === 'trade' && (
            <>
                <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-3 flex-1" ref={searchContainerRef}>
                        <div className="relative flex-1 max-w-lg">
                        <input type="text" value={inputValue} onChange={handleInputChange} onFocus={() => inputValue && setShowSuggestions(true)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg outline-none" placeholder="搜尋貨名或 Code" />
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        {showSuggestions && (<div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">{suggestions.map((item) => (<button key={item.code} onClick={() => selectProduct(item.code, item.name)} className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm border-b border-slate-50 last:border-0"><span className="font-medium text-slate-700">{item.name}</span><span className="text-xs text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{item.code}</span></button>))}</div>)}
                        </div>
                        <button onClick={() => handleSearch()} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2"><RefreshCw size={18} className={loading ? "animate-spin" : ""}/> 搜尋</button>
                    </div>
                </div>
                </header>

                <div className="px-6 pt-6 pb-2">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg text-white ${currentTopic ? 'bg-purple-600' : 'bg-blue-600'}`}>
                            {currentTopic ? <Zap size={24} /> : <Layers size={24} />}
                        </div>
                        <div className="flex-1">
                            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                {detectedProductName || '搜尋結果'}
                                {!currentTopic && <span className="text-slate-400 text-lg font-normal font-mono">({searchQuery})</span>}
                                {!currentTopic && (
                                <button onClick={() => {
                                    const isWatched = watchedProducts.some(p => p.code === searchQuery);
                                    if (isWatched) setWatchedProducts(prev => prev.filter(p => p.code !== searchQuery));
                                    else setWatchedProducts(prev => [{ code: searchQuery, name: detectedProductName || `稅號 ${searchQuery}` }, ...prev]);
                                }} className={`ml-2 p-1.5 rounded-full transition-all ${watchedProducts.some(p => p.code === searchQuery) ? 'bg-amber-100 text-amber-500 hover:bg-amber-200' : 'bg-slate-100 text-slate-400 hover:text-amber-400 hover:bg-slate-200'}`}><Star size={20} fill={watchedProducts.some(p => p.code === searchQuery) ? "currentColor" : "none"} /></button>
                                )}
                            </h2>
                            {currentTopic && (
                                <div className="mt-2 bg-purple-50 p-3 rounded-lg border border-purple-100 flex items-center justify-between">
                                    <div><p className="text-sm text-purple-800 font-bold mb-1">{STRATEGIC_TOPICS[currentTopic].desc}</p></div>
                                    {STRATEGIC_TOPICS[currentTopic].sourceUrl && (<a href={STRATEGIC_TOPICS[currentTopic].sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline"><ExternalLink size={12}/> 官方資料來源</a>)}
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
        ) : (
             <TradeDashboard 
                dataSources={dataSources}
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
    </div>
  );
};

export default App;