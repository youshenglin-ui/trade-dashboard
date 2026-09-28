// 氫能 / CCUS 新增頁面共用的小元件（卡片、KPI、表格、標籤）。
// 刻意保持樸素（Tailwind 原子類），介面改版時直接換成新設計系統的元件即可。
import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight } from 'lucide-react';

export const Card = ({ title, subtitle, right, children, className = '', icon: Icon }) => (
  <section className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col ${className}`}>
    {(title || right) && (
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3 border-b border-slate-100 pb-2">
        <div>
          {title && <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">{Icon && <Icon size={16} className="text-slate-500" />}{title}</h3>}
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
    )}
    {children}
  </section>
);

export const Kpi = ({ label, value, unit, note }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
    <div className="text-[11px] font-bold text-slate-500">{label}</div>
    <div className="text-2xl font-black text-slate-800 font-mono leading-tight mt-1">
      {value}
      {unit && <span className="text-xs font-medium text-slate-500 ml-1">{unit}</span>}
    </div>
    {note && <div className="text-[10px] text-slate-400 mt-1 leading-snug">{note}</div>}
  </div>
);

export const Badge = ({ children, tone = 'slate', title }) => {
  const tones = {
    slate: 'bg-slate-100 text-slate-600 border-slate-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  return <span title={title} className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-bold whitespace-nowrap ${tones[tone] || tones.slate}`}>{children}</span>;
};

export const Segmented = ({ value, onChange, options }) => (
  <div className="inline-flex bg-slate-100 p-1 rounded-lg text-xs font-bold">
    {options.map((o) => (
      <button key={o.value} type="button" onClick={() => onChange(o.value)}
        className={`px-3 py-1 rounded-md transition-colors ${value === o.value ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
        {o.label}
      </button>
    ))}
  </div>
);

// 通用表格：columns = [{ key, label, align, render, sortValue, className }]
export function DataTable({ columns, rows, empty = '無資料', maxHeight = 420, initialSort, rowKey = (r, i) => r.id ?? i }) {
  const [sort, setSort] = useState(initialSort || null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    const val = (r) => (col?.sortValue ? col.sortValue(r) : r[sort.key]);
    return [...rows].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'zh-Hant');
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sort, columns]);
  return (
    <div className="overflow-auto border border-slate-100 rounded-lg" style={{ maxHeight }}>
      <table className="w-full text-xs text-left">
        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`p-2 font-bold text-slate-600 whitespace-nowrap ${c.align === 'right' ? 'text-right' : ''}`}>
                <button type="button" className="inline-flex items-center gap-0.5 hover:text-slate-900"
                  onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: 'desc' }))}>
                  {c.label}
                  {sort?.key === c.key && (sort.dir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((r, i) => (
            <tr key={rowKey(r, i)} className="hover:bg-slate-50 align-top">
              {columns.map((c) => (
                <td key={c.key} className={`p-2 ${c.align === 'right' ? 'text-right font-mono' : ''} ${c.className || ''}`}>
                  {c.render ? c.render(r) : (r[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
          {sorted.length === 0 && <tr><td colSpan={columns.length} className="p-6 text-center text-slate-400">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// 可展開區塊（放「後台看得到就好」的原始欄位）
export function Collapsible({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-lg bg-white">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{title}
      </button>
      {open && <div className="p-3 pt-0">{children}</div>}
    </div>
  );
}

// survey_answers（成本財務、意願障礙、人才…）→ 依原欄位順序顯示成表格
export function AnswersTable({ rows, hide = [], maxHeight = 360 }) {
  const cols = useMemo(() => {
    const order = [];
    rows.forEach((r) => (r.column_order || Object.keys(r.answers || {})).forEach((k) => { if (!order.includes(k) && !hide.includes(k)) order.push(k); }));
    return order;
  }, [rows, hide]);
  return (
    <DataTable
      maxHeight={maxHeight}
      rows={rows}
      columns={cols.map((k) => ({
        key: k,
        label: k,
        sortValue: (r) => r.answers?.[k],
        render: (r) => {
          const v = r.answers?.[k];
          if (v == null || v === '') return <span className="text-slate-300">—</span>;
          if (v === '✓') return <span className="text-emerald-600 font-black">✓</span>;
          return <span className="whitespace-pre-wrap">{String(v)}</span>;
        },
      }))}
    />
  );
}

export const LoadingBlock = ({ text }) => <div className="p-10 text-center text-slate-500 animate-pulse text-sm">{text}</div>;
export const ErrorBlock = ({ message, onRetry }) => (
  <div className="p-6 m-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm">
    <div className="font-bold mb-1">資料庫讀取失敗</div>
    <div className="text-xs break-words">{message}</div>
    {onRetry && <button type="button" onClick={onRetry} className="mt-3 px-3 py-1.5 rounded bg-white border border-rose-200 text-xs font-bold hover:bg-rose-100">重新讀取</button>}
  </div>
);
