// 技術研究：技術類別分析
//   1. 類別對照：各類別的件數、減碳量、投資攤提、淨成本、回收年限（看差異）
//   2. 選定類別：子類排行（可展開看組成：哪家公司、哪項技術），點「明細」開技術抽屜
//   3. 子類 × 產業 矩陣：哪些產業已導入、哪些還是空白（可借鏡）
import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CATEGORIES, CATEGORY_COLOR, CATEGORY_DESC, fmtNum, fmtTon, fmtWan, fmtYears } from '../../lib/lowcarbon/metrics';
import { aggregate, caseEcon, fmtCost, groupByTech } from '../../lib/lowcarbon/lcoa';
import { SEQ_BLUE } from '../../lib/carbonfeeMetrics';
import { useOpenTech } from './techDrawerContext';
import { Card, CategoryChip, Kpi, Note, ReliabilityBadge, Segmented } from './ui';

const METRICS = [
  { value: 'amortAll', label: '投資攤提', fmt: fmtCost, asc: true, note: '元/公噸，越低門檻越低' },
  { value: 'net', label: '淨成本', fmt: fmtCost, asc: true, note: '元/公噸，負值＝省錢' },
  { value: 'payback', label: '回收年限', fmt: fmtYears, asc: true, note: '加權（投資÷年效益）' },
  { value: 'co2Sum', label: '年減碳', fmt: fmtTon, asc: false, note: '案例合計' },
  { value: 'n', label: '案例數', fmt: (v) => `${v} 件`, asc: false, note: '' },
];

export default function CategoryView({ rows, ctx }) {
  const openTech = useOpenTech();
  const present = CATEGORIES.filter((c) => rows.some((r) => r.category === c));
  const [cat, setCat] = useState(present[0] || '節能');
  const active = present.includes(cat) ? cat : present[0];
  const [metric, setMetric] = useState('amortAll');
  const [open, setOpen] = useState(null);
  const m = METRICS.find((x) => x.value === metric);

  const byCat = useMemo(() => present.map((c) => ({ cat: c, ...aggregate(rows.filter((r) => r.category === c), ctx) })), [rows, ctx, present]);
  const catRows = useMemo(() => rows.filter((r) => r.category === active), [rows, active]);
  const cur = byCat.find((b) => b.cat === active);
  const groups = useMemo(() => {
    const g = groupByTech(catRows, ctx).map((x) => ({ ...x, payback: x.payback ?? x.paybackMedian }));
    return g.sort((a, b) => {
      const va = a[metric];
      const vb = b[metric];
      if (va == null) return 1;
      if (vb == null) return -1;
      return m.asc ? va - vb : vb - va;
    });
  }, [catRows, ctx, metric, m.asc]);
  const vals = groups.map((g) => g[metric]).filter((v) => v != null);
  const maxAbs = Math.max(1, ...vals.map(Math.abs));
  const hasNeg = vals.some((v) => v < 0);

  if (!present.length) return <Card><p className="text-sm text-slate-500 py-8 text-center">篩選條件下沒有案例</p></Card>;

  return (
    <div className="space-y-4">
      <Card title="技術類別對照" subtitle="同一組篩選條件下，各類別的規模與經濟性；投資攤提與淨成本為減碳量×資料年代加權平均。點列切換下方的類別分析。">
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm min-w-[620px]">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-brand-line">
                <th className="text-left font-medium py-2 px-1">類別</th>
                <th className="text-right font-medium py-2 px-2">案例</th>
                <th className="text-right font-medium py-2 px-2">年減碳合計</th>
                <th className="text-right font-medium py-2 px-2 text-amber-800">投資攤提（元/t）</th>
                <th className="text-right font-medium py-2 px-2">淨成本（元/t）</th>
                <th className="text-right font-medium py-2 px-2">回收年限</th>
                <th className="text-right font-medium py-2 px-2">單案投資中位數</th>
              </tr>
            </thead>
            <tbody>
              {byCat.map((b) => (
                <tr key={b.cat} onClick={() => setCat(b.cat)}
                  className={`border-b border-slate-100 cursor-pointer ${b.cat === active ? 'bg-brand-ground' : 'hover:bg-slate-50'}`}>
                  <td className="py-2 px-1"><span className="flex items-center gap-2 font-bold text-slate-800">
                    <span className="w-3 h-3 rounded-full" style={{ background: CATEGORY_COLOR[b.cat] }} />{b.cat}{b.cat === active && <span className="text-xs font-normal text-brand">◀ 分析中</span>}
                  </span></td>
                  <td className="py-2 px-2 text-right num">{b.n}</td>
                  <td className="py-2 px-2 text-right num">{fmtTon(b.co2Sum)}</td>
                  <td className="py-2 px-2 text-right num font-bold text-amber-800">{fmtCost(b.amortAll)}</td>
                  <td className="py-2 px-2 text-right num">{fmtCost(b.net)}</td>
                  <td className="py-2 px-2 text-right num">{fmtYears(b.payback ?? b.paybackMedian)}</td>
                  <td className="py-2 px-2 text-right num">{fmtWan(b.invMedian)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={active} onChange={setCat} options={present.map((c) => ({ value: c, label: `${c}（${rows.filter((r) => r.category === c).length}）` }))} />
      </div>

      <div className="card p-3 md:p-4" style={{ borderLeft: `4px solid ${CATEGORY_COLOR[active]}` }}>
        <div className="text-base font-bold text-slate-800">{active}類技術</div>
        <p className="text-[13px] text-slate-600 mt-1 leading-relaxed">{CATEGORY_DESC[active]}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="案例／技術類型" value={`${cur.n} 件`} note={`${groups.length} 個技術類型・${cur.industries.length} 個產業`} />
        <Kpi label="年減碳合計" value={fmtTon(cur.co2Sum)} />
        <Kpi label="加權投資攤提" value={fmtCost(cur.amortAll)} unit="/公噸" note={`淨成本 ${fmtCost(cur.net)}`} />
        <Kpi label="加權回收年限" value={fmtYears(cur.payback ?? cur.paybackMedian)} note={<ReliabilityBadge r={cur.reliability} />} />
      </div>

      <Card title={`${active}類：技術類型排行`} subtitle={`依${m.label}排序（${m.note}）。點 ▸ 展開組成案例，點技術名稱看完整明細。`}
        right={<Segmented value={metric} onChange={setMetric} options={METRICS} />}>
        <ul className="divide-y divide-slate-100">
          {groups.map((g) => {
            const v = g[metric];
            const isOpen = open === g.key;
            const pct = v == null ? 0 : (Math.abs(v) / maxAbs) * (hasNeg ? 50 : 100);
            return (
              <li key={g.key} className="py-2">
                <div className="flex items-center gap-2">
                  <button onClick={() => setOpen(isOpen ? null : g.key)} className="w-7 h-7 rounded-lg border border-brand-line flex items-center justify-center flex-shrink-0" aria-label={isOpen ? '收合' : '展開組成'}>
                    {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </button>
                  <button onClick={() => openTech(g.key)} className="w-28 md:w-40 text-left text-sm font-semibold text-brand hover:underline flex-shrink-0 leading-tight">{g.subcategory}</button>
                  <div className="relative flex-1 h-6 bg-slate-50 rounded min-w-0">
                    {hasNeg && <div className="absolute top-0 bottom-0 w-px bg-slate-400" style={{ left: '50%' }} />}
                    {v != null && (
                      <div className="absolute top-1 bottom-1 rounded-sm" style={{
                        background: CATEGORY_COLOR[active],
                        left: hasNeg ? (v >= 0 ? '50%' : `calc(50% - ${pct}%)`) : 0, width: `${Math.max(pct, 0.6)}%`,
                      }} />
                    )}
                  </div>
                  <span className="num text-sm font-semibold w-24 md:w-28 text-right flex-shrink-0">{m.fmt(v)}</span>
                </div>
                <div className="pl-9 mt-0.5 text-xs text-slate-500 flex flex-wrap gap-x-3">
                  <span>{g.n} 件（可算成本 {g.nComplete}）</span>
                  <span>{g.industries.join('、')}</span>
                  <ReliabilityBadge r={g.reliability} />
                </div>
                {isOpen && <Composition g={g} ctx={ctx} />}
              </li>
            );
          })}
        </ul>
      </Card>

      <IndustryMatrix groups={groups} catRows={catRows} cat={active} onPick={openTech} />

      <Note>
        類別對照中的投資攤提、淨成本為「減碳量 × 資料年代」加權平均；技術類型排行可切換指標並展開組成。案例少（可信度低）的技術類型數值僅供參考，
        建議點進明細確認個別案例的條件（規模、年份、是否含蒸汽或燃料節省）。
      </Note>
    </div>
  );
}

// 組成案例：公司、技術、產業、年版與關鍵數值
function Composition({ g, ctx }) {
  const list = g.cases.map((c) => ({ c, e: caseEcon(c, ctx.opts) })).sort((a, b) => (b.e.co2 || 0) - (a.e.co2 || 0));
  return (
    <div className="ml-9 mt-2 mb-1 rounded-xl border border-brand-line bg-brand-ground/60 overflow-x-auto">
      <table className="w-full text-xs min-w-[560px]">
        <thead>
          <tr className="text-slate-500 border-b border-brand-line">
            <th className="text-left font-medium py-1.5 px-2">技術</th>
            <th className="text-left font-medium py-1.5 px-2">公司／產業</th>
            <th className="text-right font-medium py-1.5 px-2">年版</th>
            <th className="text-right font-medium py-1.5 px-2">投資</th>
            <th className="text-right font-medium py-1.5 px-2">年減碳</th>
            <th className="text-right font-medium py-1.5 px-2">攤提（元/t）</th>
            <th className="text-right font-medium py-1.5 px-2">回收</th>
          </tr>
        </thead>
        <tbody>
          {list.map(({ c, e }) => (
            <tr key={c.case_id} className="border-b border-white/80 last:border-0">
              <td className="py-1.5 px-2 text-slate-800 font-medium">{c.tech_name}</td>
              <td className="py-1.5 px-2 text-slate-600">{c.company || c.supplier || '—'}<span className="text-slate-400">・{c.industry}</span></td>
              <td className="py-1.5 px-2 text-right num">{c.pub_year_roc || '—'}</td>
              <td className="py-1.5 px-2 text-right num">{fmtWan(e.inv)}</td>
              <td className="py-1.5 px-2 text-right num">{fmtTon(e.co2)}</td>
              <td className="py-1.5 px-2 text-right num text-amber-800 font-semibold">{fmtCost(e.amort)}</td>
              <td className="py-1.5 px-2 text-right num">{fmtYears(e.payback)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 子類 × 產業：格子 = 案例數（顏色深淺），點格子看該格案例
function IndustryMatrix({ groups, catRows, cat, onPick }) {
  const [cell, setCell] = useState(null);
  const inds = [...new Set(catRows.map((c) => c.industry))].sort((a, b) => (a === '跨產業') - (b === '跨產業') || a.localeCompare(b, 'zh-Hant'));
  const count = (g, i) => g.cases.filter((c) => c.industry === i).length;
  const max = Math.max(1, ...groups.flatMap((g) => inds.map((i) => count(g, i))));
  const color = (n) => (n ? SEQ_BLUE[Math.min(SEQ_BLUE.length - 1, 1 + Math.floor((n / max) * (SEQ_BLUE.length - 2)))] : '#f8fafc');
  const sel = cell ? groups.find((g) => g.key === cell.key)?.cases.filter((c) => c.industry === cell.ind) : null;
  return (
    <Card title={`${cat}類：技術類型 × 產業`} subtitle="數字為案例數；空白代表該產業尚無此類案例，可參考其他產業的經驗。點格子看案例。">
      <div className="overflow-x-auto">
        <table className="text-sm border-separate" style={{ borderSpacing: 3 }}>
          <thead>
            <tr>
              <th />
              {inds.map((i) => <th key={i} className="text-xs font-medium text-slate-600 px-1 min-w-[52px] align-bottom leading-tight">{i.replace('業', '')}</th>)}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.key}>
                <th className="text-right pr-2 font-medium text-slate-700 whitespace-nowrap text-[13px]">
                  <button onClick={() => onPick(g.key)} className="hover:underline">{g.subcategory}</button>
                </th>
                {inds.map((i) => {
                  const n = count(g, i);
                  const on = cell?.key === g.key && cell?.ind === i;
                  return (
                    <td key={i} className="p-0">
                      <button disabled={!n} onClick={() => setCell(on ? null : { key: g.key, ind: i })}
                        className={`w-full h-9 rounded-md num text-[13px] font-semibold ${on ? 'ring-2 ring-slate-900' : ''}`}
                        style={{ background: color(n), color: n / max > 0.5 ? '#fff' : '#1e293b' }}>{n || ''}</button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sel && (
        <div className="mt-3 rounded-xl border border-brand-line p-3">
          <div className="text-sm font-bold text-slate-700 mb-1">{cell.ind}・{groups.find((g) => g.key === cell.key)?.subcategory}（{sel.length} 件）</div>
          <ul className="text-sm divide-y divide-slate-100">
            {sel.map((c) => (
              <li key={c.case_id} className="py-1.5 flex flex-wrap gap-x-2">
                <span className="font-medium text-slate-800">{c.tech_name}</span>
                <span className="text-xs text-slate-500">{c.company || ''}{c.pub_year_roc ? `・${c.pub_year_roc} 年版` : ''}</span>
                <span className="text-xs text-slate-500 num">投資 {fmtWan(c.investment_wan)}・年減碳 {fmtTon(c.co2_t)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
        <span>少</span>{SEQ_BLUE.slice(1).map((c) => <span key={c} className="w-5 h-3 rounded-sm" style={{ background: c }} />)}<span>多（最多 {fmtNum(max)} 件）</span>
        <CategoryChip cat={cat} />
      </div>
    </Card>
  );
}
