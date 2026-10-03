// ==========================================
// 製造業低碳技術（經濟部產業發展署 低碳技術彙編／典範案例／低碳製程技術資料庫）
// ==========================================
// 核心：技術均化減碳成本檢索。依使用目的分三區（2026-10 重組）：
//   政府決策：技術均化減碳成本（加權平均成本曲線＋檢索）、投資門檻與效益（含補助情境）
//   企業試算：工廠減碳模擬（流程圖＋技術＋AIoT 監控）、節電減碳計算器
//   技術研究：技術類別分析、資料年代與不確定性、案例資料庫
// 資料：Supabase lowcarbon_*（scripts/crawl-lowcarbon.mjs 每月檢查；案例來自 data/lowcarbon/cases.csv）
// 指標定義：src/lib/lowcarbon/metrics.js（單案）、lcoa.js（均化成本與年代加權）、simulator.js（工廠模擬）。
import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, FlaskConical, Landmark, Loader2, RefreshCw } from 'lucide-react';
import { ErrorBoundary } from './SharedComponents';
import { fetchLowcarbonData } from '../lib/lowcarbon/fetchLowcarbon';
import { techToCase } from '../lib/lowcarbon/metrics';
import AnalysisView from './lowcarbon/AnalysisView';
import FactoryView from './lowcarbon/FactoryView';
import CalculatorTab from './lowcarbon/CalculatorTab';

const SECTIONS = [
  { id: 'policy', label: '政府決策', icon: Landmark, desc: '哪些技術每噸減碳最划算、門檻在哪裡：技術均化減碳成本與投資門檻，作為推動與補助的參考。' },
  { id: 'enterprise', label: '企業試算', icon: Building2, desc: '把減碳技術與 AIoT 監控放進自家工廠流程，試算減碳量、投資與回收；或用計算器估算節電減碳。' },
  { id: 'research', label: '技術研究', icon: FlaskConical, desc: '各技術類別與產業的差異、資料年代造成的不確定性，以及全部案例的原始資料。' },
];
// 舊網址相容
const LEGACY = { compendium: 'policy', simulator: 'enterprise' };
const ENTERPRISE_VIEWS = [
  { id: 'factory', label: '工廠減碳模擬' },
  { id: 'calc', label: '節電減碳計算器' },
];

export default function LowCarbonDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [section, setSectionState] = useState(() => {
    const p = new URLSearchParams(window.location.search).get('section');
    const s = LEGACY[p] || p;
    return SECTIONS.some((x) => x.id === s) ? s : 'policy';
  });
  const [entView, setEntView] = useState(() => {
    const v = new URLSearchParams(window.location.search).get('view');
    return ENTERPRISE_VIEWS.some((x) => x.id === v) ? v : 'factory';
  });
  const setSection = (s) => {
    setSectionState(s);
    const u = new URL(window.location.href);
    u.searchParams.set('section', s);
    u.searchParams.delete('view');
    u.searchParams.delete('tech');
    window.history.replaceState(null, '', u);
  };

  useEffect(() => {
    let alive = true;
    fetchLowcarbonData()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [reloadKey]);

  // 彙編＋典範案例；技術資料庫廠商案例另外提供，由分頁決定是否納入
  const dataset = useMemo(() => {
    if (!data) return null;
    return {
      ...data,
      reportCases: data.cases.map((c) => ({ ...c, source: 'report' })),
      techCases: data.techs.filter((t) => t.status !== 'removed').map(techToCase),
    };
  }, [data]);
  const latestCases = useMemo(() => dataset?.reportCases.filter((c) => c.is_latest) ?? [], [dataset]);
  const cur = SECTIONS.find((s) => s.id === section);

  return (
    <div className="space-y-4 md:space-y-5 pb-24 md:pb-8">
      <div className="card p-4 md:p-5">
        <div className="text-xs font-bold tracking-[0.12em] text-brand-muted">MANUFACTURING LOW-CARBON TECHNOLOGY</div>
        <h1 className="text-xl md:text-2xl font-black text-brand-ink mt-1">製造業低碳技術：均化減碳成本檢索</h1>
        <p className="text-[13px] md:text-sm text-slate-500 mt-1 leading-relaxed">
          資料來源：經濟部產業發展署「產業節能減碳資訊網」低碳技術彙編、典範案例與低碳製程技術資料庫（106–114 年版，每月自動檢查更新）。
        </p>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const on = s.id === section;
            return (
              <button key={s.id} onClick={() => setSection(s.id)}
                className={`rounded-xl border px-2 py-2.5 md:px-4 md:py-3 text-left transition-colors ${on ? 'border-brand bg-brand-ground ring-1 ring-brand' : 'border-brand-line hover:bg-slate-50'}`}>
                <div className={`flex items-center gap-1.5 font-bold text-sm md:text-base ${on ? 'text-brand-dark' : 'text-slate-700'}`}><Icon size={17} />{s.label}</div>
                <div className="hidden md:block text-xs text-slate-500 mt-1 leading-snug">{s.desc}</div>
              </button>
            );
          })}
        </div>
        <p className="md:hidden text-xs text-slate-500 mt-2 leading-snug">{cur.desc}</p>
      </div>

      {error ? (
        <div className="card p-6 flex flex-col items-center text-center gap-3">
          <AlertTriangle className="text-amber-500" />
          <p className="text-sm text-slate-600">資料讀取失敗：{error}</p>
          <button onClick={() => { setError(null); setReloadKey((k) => k + 1); }} className="h-10 px-4 rounded-xl border border-brand-line text-sm flex items-center gap-2">
            <RefreshCw size={15} /> 重新載入
          </button>
        </div>
      ) : !dataset ? (
        <div className="card p-10 flex items-center justify-center gap-2 text-slate-500 text-sm">
          <Loader2 className="animate-spin" size={18} /> 讀取低碳技術資料…
        </div>
      ) : (
        <ErrorBoundary>
          {section === 'enterprise' ? (
            <div className="space-y-4">
              <nav className="flex overflow-x-auto no-scrollbar border-b border-brand-line -mx-1 px-1" aria-label="企業試算分頁">
                {ENTERPRISE_VIEWS.map((t) => (
                  <button key={t.id} onClick={() => setEntView(t.id)} className={`tab-btn ${entView === t.id ? 'tab-btn-on' : ''}`}>{t.label}</button>
                ))}
              </nav>
              {entView === 'factory' ? <FactoryView data={dataset} /> : <CalculatorTab rows={latestCases} />}
            </div>
          ) : (
            <AnalysisView data={dataset} section={section} />
          )}
        </ErrorBoundary>
      )}
    </div>
  );
}
