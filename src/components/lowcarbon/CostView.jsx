// 政府決策：技術均化減碳成本檢索
//   1. 篩選：回收年限（找短期可回收的技術）、折現率、設備壽命
//   2. 減碳成本曲線：技術類型加權平均（預設）或個別案例
//   3. 檢索表：可搜尋、排序，點技術看組成案例
import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { CATEGORY_COLOR, fmtTon, fmtYears } from '../../lib/lowcarbon/metrics';
import { PAYBACK_FILTERS, aggregate, caseEcon, fmtCost, groupByTech, passPayback } from '../../lib/lowcarbon/lcoa';
import CostCurve from './CostCurve';
import { useOpenTech } from './techDrawerContext';
import { Card, CategoryChip, Kpi, Note, ReliabilityBadge, Segmented, Select } from './ui';

const SORTS = [
  { value: 'net', label: '淨成本' },
  { value: 'amortAll', label: '投資攤提' },
  { value: 'payback', label: '回收年限' },
  { value: 'co2Sum', label: '年減碳量' },
];

export default function CostView({ rows, ctx, econ, setEcon }) {
  const openTech = useOpenTech();
  const [payback, setPayback] = useState('');
  const [unit, setUnit] = useState('tech');
  const [mode, setMode] = useState('split');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('net');

  const filtered = useMemo(() => rows.filter((c) => passPayback(c, payback)), [rows, payback]);
  const overall = useMemo(() => aggregate(filtered, ctx), [filtered, ctx]);
  const groups = useMemo(() => groupByTech(filtered, ctx), [filtered, ctx]);

  // 曲線資料：技術類型（加權平均）或個別案例
  const items = useMemo(() => {
    if (unit === 'tech') {
      return groups.filter((g) => g.nComplete > 0).map((g) => ({
        id: g.key, key: g.key, label: g.subcategory, category: g.category, width: completeCo2(g),
        amort: g.amort, saving: g.saving, net: g.net, p25: g.netP25, p75: g.netP75, n: g.nComplete,
        sub: `${g.nComplete} 件可算成本／共 ${g.n} 件・可信度 ${g.reliability.level}`,
      })).sort((a, b) => a.net - b.net);
    }
    return filtered.map((c) => ({ c, e: caseEcon(c, ctx.opts) })).filter(({ e }) => e.net != null && e.co2 > 0)
      .map(({ c, e }) => ({
        id: c.case_id, key: `${c.category}|${c.subcategory || '未分類'}`, label: c.tech_name, category: c.category, width: e.co2,
        amort: e.amort, saving: e.saving, net: e.net, sub: `${c.company || c.industry}・${c.subcategory}`,
      })).sort((a, b) => a.net - b.net);
  }, [unit, groups, filtered, ctx]);

  const curveCo2 = items.reduce((s, d) => s + d.width, 0);
  const underFee = items.filter((d) => d.net < 300).reduce((s, d) => s + d.width, 0);

  const table = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const list = groups.filter((g) => !kw || `${g.subcategory}${g.category}${g.industries.join('')}${g.cases.map((c) => `${c.tech_name}${c.company || ''}`).join('')}`.toLowerCase().includes(kw));
    const dir = sort === 'co2Sum' ? -1 : 1;
    return list.sort((a, b) => ((a[sort] ?? Infinity * dir) - (b[sort] ?? Infinity * dir)) * dir);
  }, [groups, q, sort]);

  return (
    <div className="space-y-4">
      <Card title="篩選與經濟假設" subtitle="回收年限篩選會先挑出案例再加權平均，用來找「短時間可回收」的技術；折現率與設備壽命決定投資攤提（資本回收因子）。">
        <div className="flex flex-col lg:flex-row lg:flex-wrap gap-3 lg:items-center">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] text-slate-600 whitespace-nowrap">回收年限</span>
            <Segmented value={payback} onChange={setPayback} options={PAYBACK_FILTERS} />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Select label="折現率" value={econ.discountRate} onChange={(v) => setEcon({ ...econ, discountRate: Number(v) })}
              options={[0, 0.03, 0.05, 0.08, 0.1].map((v) => ({ value: v, label: `${v * 100}%` }))} />
            <Select label="設備壽命" value={econ.lifetimeYears} onChange={(v) => setEcon({ ...econ, lifetimeYears: Number(v) })}
              options={[5, 8, 10, 15, 20].map((v) => ({ value: v, label: `${v} 年` }))} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="card p-3 md:p-4 !border-amber-300 !bg-amber-50 col-span-2 lg:col-span-1">
          <div className="text-xs md:text-sm font-semibold text-amber-900">平均投資攤提成本</div>
          <div className="num text-xl md:text-[26px] font-extrabold text-brand-ink mt-2">{fmtCost(overall.amortAll)}<span className="text-xs font-normal text-slate-500">／公噸</span></div>
          <div className="text-xs text-amber-900/80 mt-1">每年減 1 公噸需攤提的設備投資（不扣節能收益）</div>
        </div>
        <Kpi label="平均節能收益" value={overall.saving == null ? '—' : `−${fmtCost(overall.saving)}`} unit="/公噸" note="省下的能源費，折抵攤提" />
        <Kpi label="平均均化減碳成本" value={fmtCost(overall.net)} unit="/公噸" note={`加權中位數 ${fmtCost(overall.netMedian)}`} />
        <Kpi label="加權回收年限" value={fmtYears(overall.payback)} note={`可算成本 ${overall.nComplete} 件／篩選 ${overall.n} 件`} />
        <Kpi label="淨成本低於碳費 300 元" value={curveCo2 ? `${Math.round((underFee / curveCo2) * 100)}%` : '—'} note="占曲線年減碳量" />
      </div>

      <Card title="減碳成本曲線" subtitle={unit === 'tech'
        ? '每欄是一種技術類型的加權平均（減碳量 × 資料年代權重）。細直線為典型範圍（加權 P25–P75），越長代表案例差異越大。點欄位看組成案例。'
        : '每欄是一個案例。點欄位看所屬技術類型的組成。'}
        right={(
          <div className="flex flex-wrap gap-2 justify-end">
            <Segmented value={unit} onChange={setUnit} options={[{ value: 'tech', label: '技術類型' }, { value: 'case', label: '個別案例' }]} />
            <Segmented value={mode} onChange={setMode} options={[{ value: 'split', label: '成本拆解' }, { value: 'net', label: '淨成本' }]} />
          </div>
        )}>
        {items.length ? (
          <CostCurve items={items} mode={mode} onPick={(d) => openTech(d.key)} height={unit === 'tech' ? 440 : 400}
            refLines={[{ value: 300, label: '碳費 300 元' }]} />
        ) : <p className="text-sm text-slate-500 py-10 text-center">篩選條件下沒有可計算成本的案例</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-600">
          <span className="flex items-center gap-1"><span className="w-4 h-3 rounded-sm bg-slate-500" />實心＝投資攤提（顏色＝類別）</span>
          <span className="flex items-center gap-1"><span className="w-4 h-3 rounded-sm border border-slate-400" style={{ backgroundImage: 'repeating-linear-gradient(45deg,#94a3b8 0 2px,transparent 2px 5px)' }} />斜線＝節能收益</span>
          <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-slate-900" />黑線＝淨成本</span>
          {[...new Set(items.map((d) => d.category))].map((c) => <CategoryChip key={c} cat={c} />)}
        </div>
      </Card>

      <Card title={`技術減碳成本檢索（${table.length} 類）`}
        subtitle="搜尋技術、公司或產業；點技術名稱看組成案例、資料可信度與相關廠商技術。"
        right={<Segmented value={sort} onChange={setSort} options={SORTS} />}>
        <label className="relative block mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="例如：空壓、熱泵、中鋼、造紙業"
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-brand-line text-sm" />
        </label>
        <TechTable list={table} onPick={openTech} />
      </Card>

      <Note>
        均化減碳成本＝（投資 × 資本回收因子 − 年效益）÷ 年減碳量。節能類技術的淨成本多為負值，代表省下的能源費在設備壽命內超過投資；
        但企業仍須先拿出「投資攤提」這筆錢，推動障礙通常是資金、停機排程與資訊，因此本頁把攤提成本與節能收益分開呈現。
        技術類型平均以減碳量與資料年代加權（較舊的案例標準誤差較大、權重較低），可在上方「資料年代誤差」調整。
        之後加入的創新技術（類別「創新」）會自動出現在曲線中，作為與傳統技術的單位減碳成本對照。
      </Note>
    </div>
  );
}

// 曲線欄寬用「可算成本案例」的減碳量，與成本基礎一致
const completeCo2 = (g) => g.rows.filter((r) => r.net != null).reduce((s, r) => s + r.co2, 0);

function TechTable({ list, onPick }) {
  return (
    <>
      {/* 手機：卡片 */}
      <ul className="md:hidden divide-y divide-slate-100">
        {list.map((g) => (
          <li key={g.key}>
            <button onClick={() => onPick(g.key)} className="w-full text-left py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-800 text-[15px]">{g.subcategory}</span>
                <ReliabilityBadge r={g.reliability} compact />
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500"><CategoryChip cat={g.category} />{g.n} 件・{g.industries.length} 個產業</div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div><div className="text-amber-800">投資攤提</div><div className="num font-bold text-sm">{fmtCost(g.amortAll)}</div></div>
                <div><div className="text-slate-500">淨成本</div><div className="num font-bold text-sm">{fmtCost(g.net)}</div></div>
                <div><div className="text-slate-500">回收</div><div className="num font-bold text-sm">{fmtYears(g.payback ?? g.paybackMedian)}</div></div>
              </div>
            </button>
          </li>
        ))}
      </ul>
      {/* 電腦：表格 */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-brand-line">
              <th className="text-left font-medium py-2 pr-2">技術類型</th>
              <th className="text-right font-medium py-2 px-2">案例</th>
              <th className="text-right font-medium py-2 px-2 text-amber-800">投資攤提（元/t）</th>
              <th className="text-right font-medium py-2 px-2">節能收益</th>
              <th className="text-right font-medium py-2 px-2">淨成本</th>
              <th className="text-right font-medium py-2 px-2">典型範圍</th>
              <th className="text-right font-medium py-2 px-2">回收年限</th>
              <th className="text-right font-medium py-2 px-2">年減碳合計</th>
              <th className="text-center font-medium py-2 pl-2">可信度</th>
            </tr>
          </thead>
          <tbody>
            {list.map((g) => (
              <tr key={g.key} className="border-b border-slate-100 hover:bg-brand-ground">
                <td className="py-2 pr-2">
                  <button onClick={() => onPick(g.key)} className="text-left">
                    <div className="font-semibold text-brand hover:underline">{g.subcategory}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLOR[g.category] }} />{g.category}・{g.industries.slice(0, 3).join('、')}{g.industries.length > 3 ? '…' : ''}</div>
                  </button>
                </td>
                <td className="py-2 px-2 text-right num">{g.n}<span className="text-xs text-slate-400">／{g.nComplete}</span></td>
                <td className="py-2 px-2 text-right num font-bold text-amber-800">{fmtCost(g.amortAll)}</td>
                <td className="py-2 px-2 text-right num text-slate-600">{g.saving == null ? '—' : `−${fmtCost(g.saving)}`}</td>
                <td className="py-2 px-2 text-right num font-semibold">{fmtCost(g.net)}</td>
                <td className="py-2 px-2 text-right num text-xs text-slate-500">{g.netP25 != null && g.nComplete > 1 && g.netP25 !== g.netP75 ? `${fmtCost(g.netP25)} ～ ${fmtCost(g.netP75)}` : '—'}</td>
                <td className="py-2 px-2 text-right num">{fmtYears(g.payback ?? g.paybackMedian)}</td>
                <td className="py-2 px-2 text-right num">{fmtTon(g.co2Sum)}</td>
                <td className="py-2 pl-2 text-center"><ReliabilityBadge r={g.reliability} compact /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-slate-400 mt-2">案例欄：全部／可算成本（同時有投資、年效益、減碳量）。</p>
      </div>
    </>
  );
}
