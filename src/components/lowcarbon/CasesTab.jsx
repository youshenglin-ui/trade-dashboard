// 分頁 5：案例與資料來源（可搜尋、排序、下載）
import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Download, ExternalLink, FileSpreadsheet, Search } from 'lucide-react';
import { CATEGORY_COLOR, co2Of, fmtNum, fmtTon, fmtWan, fmtYears, paybackOf, rocToAd } from '../../lib/lowcarbon/metrics';
import { Card, Segmented } from './ui';

const COLS = [
  { key: 'tech_name', label: '技術名稱', get: (c) => c.tech_name },
  { key: 'category', label: '類別', get: (c) => c.category },
  { key: 'industry', label: '產業', get: (c) => c.industry },
  { key: 'company', label: '公司／供應商', get: (c) => c.company || c.supplier || '' },
  { key: 'investment_wan', label: '投資（萬元）', get: (c) => c.investment_wan, num: true },
  { key: 'electricity_kwh', label: '年節電（kWh）', get: (c) => c.electricity_kwh, num: true },
  { key: 'co2', label: '年減碳（公噸）', get: (c, o) => co2Of(c, o), num: true },
  { key: 'benefit_wan', label: '年效益（萬元）', get: (c) => c.benefit_wan, num: true },
  { key: 'payback', label: '回收年限', get: (c) => paybackOf(c), num: true },
  { key: 'pub_year_roc', label: '出版年', get: (c) => c.pub_year_roc, num: true },
];
const PAGE = 30;

// CSV（UTF-8 BOM，Excel 可直接開啟）
function downloadCsv(name, header, rows) {
  const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const text = `\uFEFF${[header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')}`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function CasesTab({ rows, data, normalizeEf }) {
  const [view, setView] = useState('cases');
  const docs = data.documents;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <Segmented value={view} onChange={setView} options={[
          { value: 'cases', label: `案例明細（${rows.length}）` },
          { value: 'docs', label: `書目（${docs.length}）` },
          { value: 'techs', label: `技術資料庫（${data.techs.length}）` },
          { value: 'articles', label: `企業減碳案例（${data.articles.length}）` },
        ]} />
        <a href="/data/lowcarbon/lowcarbon-database.xlsx" download className="h-9 px-3 rounded-xl border border-brand-line bg-white text-sm flex items-center gap-1.5 hover:bg-brand-ground">
          <FileSpreadsheet size={15} className="text-emerald-600" /> 下載完整 Excel（含書目、技術資料庫、分類統計）
        </a>
      </div>
      {view === 'cases' && <CaseTable rows={rows} docs={docs} normalizeEf={normalizeEf} />}
      {view === 'docs' && <DocList data={data} />}
      {view === 'techs' && <TechList techs={data.techs} />}
      {view === 'articles' && <ArticleList articles={data.articles} />}
    </div>
  );
}

function CaseTable({ rows, docs, normalizeEf }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ key: 'co2', dir: -1 });
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(null);
  const opts = useMemo(() => ({ normalizeEf }), [normalizeEf]);
  const fileUrl = useMemo(() => Object.fromEntries(docs.map((d) => [d.doc_id, d.file_url])), [docs]);

  const list = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const col = COLS.find((c) => c.key === sort.key);
    return rows.filter((c) => !kw || [c.tech_name, c.company, c.supplier, c.industry, c.subcategory, c.saving_text, c.doc_title]
      .some((v) => v && String(v).toLowerCase().includes(kw)))
      .sort((a, b) => {
        const va = col.get(a, opts);
        const vb = col.get(b, opts);
        if (va == null) return 1;
        if (vb == null) return -1;
        return (col.num ? va - vb : String(va).localeCompare(String(vb), 'zh-Hant')) * sort.dir;
      });
  }, [rows, q, sort, opts]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const shown = list.slice(page * PAGE, page * PAGE + PAGE);

  const exportCsv = () => downloadCsv(`低碳技術案例_${new Date().toISOString().slice(0, 10)}.csv`,
    ['技術名稱', '類別', '子類', '產業', '公司', '供應商', '狀態', '投資(萬元)', '投資說明', '節能內容', '年節電(kWh)', '蒸汽(公噸/年)', '燃料油(公秉/年)', '燃煤(公噸/年)', '天然氣(m3/年)', '年效益(萬元)', '年減碳(公噸CO2e)', '電力係數', '回收年限(年)', '備註', '來源', '出版年(民國)', 'PDF頁碼', '連結'],
    list.map((c) => [c.tech_name, c.category, c.subcategory, c.industry, c.company, c.supplier, c.status, c.investment_wan, c.investment_text,
      c.saving_text, c.electricity_kwh, c.steam_t, c.fuel_oil_kl, c.coal_t, c.gas_m3, c.benefit_wan, co2Of(c, opts), c.emission_factor,
      paybackOf(c), c.note, c.doc_title, c.pub_year_roc, c.page, c.url || fileUrl[c.doc_id]]));

  return (
    <Card>
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="搜尋技術、公司、產業、節能內容…"
            className="h-9 w-full rounded-lg border border-brand-line pl-8 pr-3 text-sm" />
        </div>
        <button onClick={exportCsv} className="h-9 px-3 rounded-lg border border-brand-line text-sm flex items-center gap-1.5 hover:bg-brand-ground">
          <Download size={15} /> 下載篩選結果（CSV）
        </button>
      </div>
      <div className="overflow-x-auto -mx-3 md:mx-0">
        <table className="w-full text-sm min-w-[880px]">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-brand-line">
              {COLS.map((c) => (
                <th key={c.key} className={`py-2 px-2 font-medium whitespace-nowrap ${c.num ? 'text-right' : 'text-left'}`}>
                  <button onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? -s.dir : (c.num ? -1 : 1) }))} className="inline-flex items-center gap-0.5">
                    {c.label}{sort.key === c.key && (sort.dir > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <React.Fragment key={c.case_id}>
                <tr onClick={() => setOpen(open === c.case_id ? null : c.case_id)} className="border-b border-slate-100 hover:bg-brand-ground cursor-pointer">
                  <td className="py-2 px-2 font-medium text-slate-800 max-w-[260px]">{c.tech_name}</td>
                  <td className="py-2 px-2 whitespace-nowrap"><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: CATEGORY_COLOR[c.category] }} />{c.category}<span className="text-xs text-slate-400">／{c.subcategory}</span></td>
                  <td className="py-2 px-2 whitespace-nowrap">{c.industry}</td>
                  <td className="py-2 px-2 text-slate-600 max-w-[160px] truncate">{c.company || c.supplier || '—'}</td>
                  <td className="py-2 px-2 text-right num">{fmtNum(c.investment_wan, 1)}</td>
                  <td className="py-2 px-2 text-right num">{fmtNum(c.electricity_kwh)}</td>
                  <td className="py-2 px-2 text-right num">{fmtNum(co2Of(c, opts))}</td>
                  <td className="py-2 px-2 text-right num">{fmtNum(c.benefit_wan, 1)}</td>
                  <td className="py-2 px-2 text-right num">{fmtNum(paybackOf(c), 2)}</td>
                  <td className="py-2 px-2 text-right num">{c.pub_year_roc ?? '—'}</td>
                </tr>
                {open === c.case_id && (
                  <tr className="bg-brand-ground">
                    <td colSpan={COLS.length} className="px-3 py-3 text-[13px] text-slate-600 space-y-1">
                      {c.saving_text && <div><b>節能內容：</b>{c.saving_text}</div>}
                      {c.investment_text && <div><b>投資內容：</b>{c.investment_text}</div>}
                      {c.benefit_text && <div><b>效益計算：</b>{c.benefit_text}</div>}
                      {c.co2_text && <div><b>減碳計算：</b>{c.co2_text}</div>}
                      {c.emission_factor && <div><b>原文電力係數：</b>{c.emission_factor} kgCO2e/kWh</div>}
                      {c.note && <div><b>備註：</b>{c.note}</div>}
                      <div className="text-xs text-slate-500">
                        來源：{c.doc_title}{c.page ? `，PDF 第 ${c.page} 頁` : ''}{c.pub_year_roc ? `（${rocToAd(c.pub_year_roc)}）` : ''}
                        {(c.url || fileUrl[c.doc_id]) && (
                          <a href={`${c.url || fileUrl[c.doc_id]}${c.page && !c.url ? `#page=${c.page}` : ''}`} target="_blank" rel="noopener noreferrer" className="ml-2 text-brand inline-flex items-center gap-0.5">
                            開啟原文 <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-3 text-sm text-slate-500">
        <span>共 {list.length} 件，點列可展開計算說明與原文連結</span>
        <div className="flex items-center gap-2">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="h-8 px-3 rounded-lg border border-brand-line disabled:opacity-40">上一頁</button>
          <span className="num">{page + 1} / {pages}</span>
          <button disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="h-8 px-3 rounded-lg border border-brand-line disabled:opacity-40">下一頁</button>
        </div>
      </div>
    </Card>
  );
}

function DocList({ data }) {
  const count = useMemo(() => {
    const m = {};
    for (const c of data.cases) m[c.doc_id] = (m[c.doc_id] || 0) + 1;
    return m;
  }, [data]);
  const docs = [...data.documents].sort((a, b) => (b.roc_year || 0) - (a.roc_year || 0));
  return (
    <Card title="書目與擷取狀態" subtitle={`官網書目由爬蟲每月檢查；最近一次成功檢查：${data.lastRun ? new Date(data.lastRun.started_at).toLocaleDateString('zh-TW') : '—'}。「待擷取」代表新書已上架、案例數值尚未整理進資料庫。`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead><tr className="text-xs text-slate-500 border-b border-brand-line text-left">
            <th className="py-2 px-2 font-medium">書名</th><th className="py-2 px-2 font-medium">類型</th><th className="py-2 px-2 font-medium">產業</th>
            <th className="py-2 px-2 font-medium">官網發佈</th><th className="py-2 px-2 font-medium text-right">案例數</th><th className="py-2 px-2 font-medium" />
          </tr></thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.doc_id} className="border-b border-slate-100">
                <td className="py-2 px-2 font-medium">{d.title}{d.status === 'removed' && <span className="ml-1 text-xs text-amber-600">（官網已下架）</span>}</td>
                <td className="py-2 px-2 text-slate-600">{d.kind === 'compilation' ? '低碳技術彙編' : '典範案例'}</td>
                <td className="py-2 px-2 text-slate-600">{d.industry}</td>
                <td className="py-2 px-2 num text-slate-600">{d.published_on || '—'}</td>
                <td className="py-2 px-2 text-right">{count[d.doc_id] ? <span className="num">{count[d.doc_id]}</span> : <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">待擷取</span>}</td>
                <td className="py-2 px-2"><a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-brand inline-flex items-center gap-0.5 text-xs">PDF <ExternalLink size={11} /></a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function TechList({ techs }) {
  const [q, setQ] = useState('');
  const list = techs.filter((t) => t.status !== 'removed' && (!q || [t.tech_name, t.vendor, t.equipment, t.process_type].some((v) => v?.includes(q))));
  const groups = [...new Set(list.map((t) => t.process_type))];
  return (
    <Card title="低碳製程技術資料庫" subtitle="台灣綠色生產力基金會維護，設備廠商提供技術資料與典型應用案例（效益數字為規則式自動擷取，請以原文為準）。">
      <div className="relative mb-3 max-w-sm">
        <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋技術、設備、廠商" className="h-9 w-full rounded-lg border border-brand-line pl-8 pr-3 text-sm" />
      </div>
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g}>
            <div className="text-sm font-bold text-slate-700 mb-1">{g}（{list.filter((t) => t.process_type === g).length}）</div>
            <ul className="divide-y divide-slate-100 text-sm">
              {list.filter((t) => t.process_type === g).map((t) => (
                <li key={t.tech_id} className="py-1.5 flex flex-wrap items-baseline gap-x-3">
                  <a href={t.detail_url} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-800 hover:text-brand">{t.tech_name}</a>
                  <span className="text-xs text-slate-500">{t.vendor}</span>
                  <span className="text-xs text-slate-500 num">
                    {[t.case_kwh && `節電 ${fmtNum(t.case_kwh)} kWh/年`, t.case_co2_t && `減碳 ${fmtTon(t.case_co2_t)}/年`, t.case_benefit_wan && `效益 ${fmtWan(t.case_benefit_wan)}/年`, t.case_payback_years && `回收 ${fmtYears(t.case_payback_years)}`].filter(Boolean).join('・')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ArticleList({ articles }) {
  const list = [...articles].filter((a) => a.status !== 'removed').sort((a, b) => String(b.published_on).localeCompare(String(a.published_on)));
  return (
    <Card title="企業減碳案例（產業節能減碳資訊網）" subtitle="新聞稿式的企業淨零與國際指標案例，附件為完整 PDF。">
      <ul className="divide-y divide-slate-100">
        {list.map((a) => (
          <li key={a.article_id} className="py-2.5">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-800 hover:text-brand">{a.title}</a>
              <span className="text-xs text-slate-400 num">{a.published_on}</span>
              {(a.keywords || []).map((k) => <span key={k} className="text-[11px] text-slate-500 bg-brand-ground border border-brand-line rounded px-1.5">{k}</span>)}
            </div>
            {a.summary && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{a.summary.replace(/\n/g, ' ')}</p>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
