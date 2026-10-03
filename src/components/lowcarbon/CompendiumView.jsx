// 低碳技術彙編：共用篩選列 + 五個分頁
import React, { useMemo, useState } from 'react';
import { CATEGORIES } from '../../lib/lowcarbon/metrics';
import { CategoryLegend, Select } from './ui';
import InvestTab from './InvestTab';
import CompareTab from './CompareTab';
import CalculatorTab from './CalculatorTab';
import MaccTab from './MaccTab';
import CasesTab from './CasesTab';

export const LC_TABS = [
  { id: 'invest', label: '投資門檻與減碳效益' },
  { id: 'compare', label: '技術與產業比較' },
  { id: 'calc', label: '節電減碳計算器' },
  { id: 'macc', label: '減碳成本曲線' },
  { id: 'cases', label: '案例與資料來源' },
];

export default function CompendiumView({ data }) {
  const [tab, setTab] = useState('invest');
  const [industry, setIndustry] = useState('');
  const [hidden, setHidden] = useState([]);
  const [includeTech, setIncludeTech] = useState(false);
  const [latestOnly, setLatestOnly] = useState(true);
  const [normalizeEf, setNormalizeEf] = useState(false);
  const years = useMemo(() => [...new Set(data.reportCases.map((c) => c.pub_year_roc).filter(Boolean))].sort((a, b) => a - b), [data]);
  const [yearFrom, setYearFrom] = useState(years[0]);
  const [yearTo, setYearTo] = useState(years[years.length - 1]);

  const industries = useMemo(() => {
    const s = new Set(data.reportCases.map((c) => c.industry).filter(Boolean));
    return ['', ...[...s].sort((a, b) => (a === '跨產業') - (b === '跨產業') || a.localeCompare(b, 'zh-Hant'))];
  }, [data]);

  // 篩選（不含類別）：給圖例計數與分頁使用；類別篩選在 rows 才套用
  const scoped = useMemo(() => {
    let rows = data.reportCases.filter((c) => (!latestOnly || c.is_latest) && c.pub_year_roc >= yearFrom && c.pub_year_roc <= yearTo);
    if (includeTech) rows = rows.concat(data.techCases);
    if (industry) rows = rows.filter((c) => c.industry === industry);
    return rows;
  }, [data, latestOnly, yearFrom, yearTo, includeTech, industry]);
  const rows = useMemo(() => scoped.filter((c) => !hidden.includes(c.category)), [scoped, hidden]);
  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map((c) => [c, scoped.filter((r) => r.category === c).length])), [scoped]);

  const ctx = { rows, allRows: scoped, data, normalizeEf, industry, setIndustry, includeTech };

  return (
    <div className="space-y-4">
      <div className="card p-3 md:p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Select label="產業" value={industry} onChange={setIndustry}
            options={industries.map((i) => ({ value: i, label: i || '全部產業' }))} />
          <div className="flex items-center gap-1.5 text-[13px] text-slate-600">
            <span>出版年</span>
            <Select value={yearFrom} onChange={(v) => setYearFrom(Number(v))} options={years.map((y) => ({ value: y, label: `${y}年` }))} />
            <span>至</span>
            <Select value={yearTo} onChange={(v) => setYearTo(Number(v))} options={years.map((y) => ({ value: y, label: `${y}年` }))} />
          </div>
          <label className="flex items-center gap-1.5 text-[13px] text-slate-600" title="同一案例在不同年版重複收錄時，只算最新版">
            <input type="checkbox" checked={latestOnly} onChange={(e) => setLatestOnly(e.target.checked)} className="accent-brand w-4 h-4" />
            重複收錄只算最新版
          </label>
          <label className="flex items-center gap-1.5 text-[13px] text-slate-600" title="低碳製程技術資料庫中廠商自行提供的典型應用案例">
            <input type="checkbox" checked={includeTech} onChange={(e) => setIncludeTech(e.target.checked)} className="accent-brand w-4 h-4" />
            納入技術資料庫廠商案例
          </label>
          <label className="flex items-center gap-1.5 text-[13px] text-slate-600" title="各版彙編使用出版當年的電力排碳係數（0.554→0.474），勾選後把以電力計算的減碳量換算成 113 年係數，跨年比較較公平">
            <input type="checkbox" checked={normalizeEf} onChange={(e) => setNormalizeEf(e.target.checked)} className="accent-brand w-4 h-4" />
            減碳量以最新電力係數換算
          </label>
        </div>
        <CategoryLegend hidden={hidden} counts={counts}
          onToggle={(c) => setHidden((h) => (h.includes(c) ? h.filter((x) => x !== c) : [...h, c]))} />
      </div>

      <nav className="flex overflow-x-auto no-scrollbar border-b border-brand-line -mx-1 px-1" aria-label="低碳技術彙編分頁">
        {LC_TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`tab-btn ${tab === t.id ? 'tab-btn-on' : ''}`}>{t.label}</button>
        ))}
      </nav>

      {tab === 'invest' && <InvestTab {...ctx} />}
      {tab === 'compare' && <CompareTab {...ctx} />}
      {tab === 'calc' && <CalculatorTab {...ctx} />}
      {tab === 'macc' && <MaccTab {...ctx} />}
      {tab === 'cases' && <CasesTab {...ctx} />}
    </div>
  );
}
