// ==========================================
// 製造業低碳技術（經濟部產業發展署 低碳技術彙編／典範案例／低碳製程技術資料庫）
// ==========================================
// 兩個子頁：
//   1. 低碳技術彙編：投資門檻、技術與產業比較、節電減碳計算器、減碳成本曲線、案例與資料來源
//   2. 企業減碳模式預估：依產業／廠區類型組合實際案例的減碳措施，加上 AI 點/線/面 情境（沿用 EcoRisk SCADA demo 版型）
// 資料：Supabase lowcarbon_*（scripts/crawl-lowcarbon.mjs 每月檢查；案例來自 data/lowcarbon/cases.csv）
// 指標定義集中在 src/lib/lowcarbon/metrics.js。
import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, Cpu, Loader2, RefreshCw } from 'lucide-react';
import { ErrorBoundary } from './SharedComponents';
import { fetchLowcarbonData } from '../lib/lowcarbon/fetchLowcarbon';
import { techToCase } from '../lib/lowcarbon/metrics';
import CompendiumView from './lowcarbon/CompendiumView';
import SimulatorView from './lowcarbon/SimulatorView';

const SECTIONS = [
  { id: 'compendium', label: '低碳技術彙編', icon: BookOpen, desc: '產發署彙編與典範案例的投資、減碳、回收年限分析' },
  { id: 'simulator', label: '企業減碳模式預估', icon: Cpu, desc: '依產業與廠區類型組合減碳措施，模擬 AI 點／線／面效益' },
];

export default function LowCarbonDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [section, setSection] = useState(() => {
    const p = new URLSearchParams(window.location.search).get('section');
    return SECTIONS.some((s) => s.id === p) ? p : 'compendium';
  });

  useEffect(() => {
    let alive = true;
    fetchLowcarbonData()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [reloadKey]);

  // 彙編＋典範案例；技術資料庫廠商案例另外提供，由子頁決定是否納入
  const dataset = useMemo(() => {
    if (!data) return null;
    return {
      ...data,
      reportCases: data.cases.map((c) => ({ ...c, source: 'report' })),
      techCases: data.techs.filter((t) => t.status !== 'removed').map(techToCase),
    };
  }, [data]);

  return (
    <div className="space-y-4 md:space-y-5 pb-24 md:pb-8">
      <div className="card p-4 md:p-5">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3 lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-bold tracking-[0.12em] text-brand-muted">MANUFACTURING LOW-CARBON TECHNOLOGY</div>
            <h1 className="text-xl md:text-2xl font-black text-brand-ink mt-1">製造業低碳技術</h1>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              資料來源：經濟部產業發展署「產業節能減碳資訊網」低碳技術彙編、典範案例與低碳製程技術資料庫（106–114 年版，每月自動檢查更新）。
            </p>
          </div>
          <div className="seg self-start lg:self-auto">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <button key={s.id} onClick={() => setSection(s.id)} title={s.desc}
                  className={`seg-btn flex items-center gap-1.5 ${section === s.id ? 'seg-btn-on' : ''}`}>
                  <Icon size={15} />{s.label}
                </button>
              );
            })}
          </div>
        </div>
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
          {section === 'compendium' ? <CompendiumView data={dataset} /> : <SimulatorView data={dataset} />}
        </ErrorBoundary>
      )}
    </div>
  );
}
