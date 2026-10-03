// 政府決策／技術研究 兩個區塊共用：篩選列、經濟假設、技術明細抽屜
// （同一個元件依 section 切換分頁，篩選狀態在兩區塊間保留）
import React, { useCallback, useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { CATEGORIES, ECON } from '../../lib/lowcarbon/metrics';
import { AGE_ERROR_OPTIONS, DEFAULT_AGE_ERROR, refRocOf } from '../../lib/lowcarbon/lcoa';
import { TechDrawerContext } from './techDrawerContext';
import TechDrawer from './TechDrawer';
import CostView from './CostView';
import InvestTab from './InvestTab';
import CategoryView from './CategoryView';
import VintageView from './VintageView';
import CasesTab from './CasesTab';
import { CategoryLegend, Select } from './ui';

const SECTION_VIEWS = {
  policy: [
    { id: 'cost', label: '技術均化減碳成本' },
    { id: 'invest', label: '投資門檻與效益' },
  ],
  research: [
    { id: 'category', label: '技術類別分析' },
    { id: 'vintage', label: '資料年代與不確定性' },
    { id: 'cases', label: '案例資料庫' },
  ],
};

const readParam = (k) => new URLSearchParams(window.location.search).get(k);
const writeParams = (obj) => {
  const u = new URL(window.location.href);
  for (const [k, v] of Object.entries(obj)) (v ? u.searchParams.set(k, v) : u.searchParams.delete(k));
  window.history.replaceState(null, '', u);
};

export default function AnalysisView({ data, section }) {
  const views = SECTION_VIEWS[section];
  const [viewBySection, setViewBySection] = useState(() => {
    const v = readParam('view');
    return { policy: 'cost', research: 'category', [section]: views.some((x) => x.id === v) ? v : views[0].id };
  });
  const view = viewBySection[section];
  const setView = (v) => { setViewBySection((s) => ({ ...s, [section]: v })); writeParams({ view: v }); };

  const [industry, setIndustry] = useState('');
  const [hidden, setHidden] = useState([]);
  const [includeTech, setIncludeTech] = useState(false);
  const [latestOnly, setLatestOnly] = useState(true);
  const [normalizeEf, setNormalizeEf] = useState(true);
  const [ageErr, setAgeErr] = useState(DEFAULT_AGE_ERROR);
  const [econ, setEcon] = useState({ discountRate: ECON.discountRate, lifetimeYears: ECON.lifetimeYears });
  const [showFilters, setShowFilters] = useState(false);
  const years = useMemo(() => [...new Set(data.reportCases.map((c) => c.pub_year_roc).filter(Boolean))].sort((a, b) => a - b), [data]);
  const [yearFrom, setYearFrom] = useState(years[0]);
  const [yearTo, setYearTo] = useState(years[years.length - 1]);
  const [techKey, setTechKey] = useState(() => readParam('tech'));
  const openTech = useCallback((k) => { setTechKey(k); writeParams({ tech: k }); }, []);
  const closeTech = useCallback(() => { setTechKey(null); writeParams({ tech: null }); }, []);

  const industries = useMemo(() => {
    const s = new Set(data.reportCases.map((c) => c.industry).filter(Boolean));
    return ['', ...[...s].sort((a, b) => (a === '跨產業') - (b === '跨產業') || a.localeCompare(b, 'zh-Hant'))];
  }, [data]);

  // 篩選（不含類別）：圖例計數、抽屜明細使用；類別篩選在 rows 才套用
  const scoped = useMemo(() => {
    let rows = data.reportCases.filter((c) => (!latestOnly || c.is_latest) && c.pub_year_roc >= yearFrom && c.pub_year_roc <= yearTo);
    if (includeTech) rows = rows.concat(data.techCases);
    if (industry) rows = rows.filter((c) => c.industry === industry);
    return rows;
  }, [data, latestOnly, yearFrom, yearTo, includeTech, industry]);
  const rows = useMemo(() => scoped.filter((c) => !hidden.includes(c.category)), [scoped, hidden]);
  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map((c) => [c, scoped.filter((r) => r.category === c).length])), [scoped]);
  const refRoc = useMemo(() => refRocOf(data.reportCases), [data]);
  const ctx = useMemo(() => ({
    opts: { normalizeEf, discountRate: econ.discountRate, lifetimeYears: econ.lifetimeYears },
    A: ageErr ? Number(ageErr) : null, refRoc,
  }), [normalizeEf, econ, ageErr, refRoc]);

  const activeFilters = [industry, yearFrom !== years[0] || yearTo !== years[years.length - 1], !latestOnly, includeTech, !normalizeEf, hidden.length].filter(Boolean).length;

  return (
    <TechDrawerContext.Provider value={openTech}>
      <div className="space-y-4">
        <nav className="flex overflow-x-auto no-scrollbar border-b border-brand-line -mx-1 px-1" aria-label="分頁">
          {views.map((t) => (
            <button key={t.id} onClick={() => setView(t.id)} className={`tab-btn ${view === t.id ? 'tab-btn-on' : ''}`}>{t.label}</button>
          ))}
        </nav>

          <div className="card p-3 md:p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 md:hidden">
              <button onClick={() => setShowFilters((s) => !s)} className="h-9 px-3 rounded-lg border border-brand-line text-sm flex items-center gap-1.5">
                <SlidersHorizontal size={15} />篩選條件{activeFilters ? `（${activeFilters}）` : ''}
              </button>
              <span className="text-xs text-slate-500">{rows.length} 件案例</span>
            </div>
            <div className={`${showFilters ? 'flex' : 'hidden'} md:flex flex-wrap items-center gap-x-4 gap-y-2`}>
              <Select label="產業" value={industry} onChange={setIndustry}
                options={industries.map((i) => ({ value: i, label: i || '全部產業' }))} />
              <div className="flex items-center gap-1.5 text-[13px] text-slate-600">
                <span>出版年</span>
                <Select value={yearFrom} onChange={(v) => setYearFrom(Number(v))} options={years.map((y) => ({ value: y, label: `${y}年` }))} />
                <span>至</span>
                <Select value={yearTo} onChange={(v) => setYearTo(Number(v))} options={years.map((y) => ({ value: y, label: `${y}年` }))} />
              </div>
              <span title="越舊的案例標準誤差越大：加權平均時降低舊資料的權重（方法見「資料年代與不確定性」）">
                <Select label="資料年代誤差" value={ageErr} onChange={setAgeErr} options={AGE_ERROR_OPTIONS} />
              </span>
              <Check checked={latestOnly} onChange={setLatestOnly} label="重複收錄只算最新版" title="同一案例在不同年版重複收錄時，只算最新版" />
              <Check checked={normalizeEf} onChange={setNormalizeEf} label="減碳量以最新電力係數換算" title="各版彙編使用出版當年的電力排碳係數（0.554→0.474），換算成 113 年係數後跨年比較較公平" />
              <Check checked={includeTech} onChange={setIncludeTech} label="納入技術資料庫廠商案例" title="低碳製程技術資料庫中廠商自行提供的典型應用案例（無年份，視為 3 年前）" />
            </div>
            <div className={`${showFilters ? 'block' : 'hidden'} md:block`}>
              <CategoryLegend hidden={hidden} counts={counts}
                onToggle={(c) => setHidden((h) => (h.includes(c) ? h.filter((x) => x !== c) : [...h, c]))} />
            </div>
          </div>

        {view === 'cost' && <CostView rows={rows} ctx={ctx} econ={econ} setEcon={setEcon} />}
        {view === 'invest' && <InvestTab rows={rows} ctx={ctx} />}
        {view === 'category' && <CategoryView rows={rows} ctx={ctx} />}
        {view === 'vintage' && <VintageView rows={rows} ctx={ctx} />}
        {view === 'cases' && <CasesTab rows={rows} data={data} normalizeEf={normalizeEf} />}
      </div>
      {techKey && <TechDrawer techKey={techKey} cases={scoped} ctx={ctx} data={data} onClose={closeTech} />}
    </TechDrawerContext.Provider>
  );
}

const Check = ({ checked, onChange, label, title }) => (
  <label className="flex items-center gap-1.5 text-[13px] text-slate-600" title={title}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-brand w-4 h-4" />
    {label}
  </label>
);
