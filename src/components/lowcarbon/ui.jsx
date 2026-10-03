// 製造業低碳技術模組共用小元件（版面風格沿用碳費模組）
import React from 'react';
import { CATEGORY_COLOR, CATEGORIES } from '../../lib/lowcarbon/metrics';

export const AXIS_TICK = { fontSize: 11, fill: '#64748b' };
export const GRID = '#e2e8f0';

export const Card = ({ title, subtitle, right, children, className = '' }) => (
  <div className={`card p-3 md:p-4 flex flex-col min-w-0 ${className}`}>
    {(title || right) && (
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          {title && <h3 className="font-bold text-slate-800 text-base">{title}</h3>}
          {subtitle && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{subtitle}</p>}
        </div>
        {right}
      </div>
    )}
    <div className="flex-1 min-h-0">{children}</div>
  </div>
);

export const Kpi = ({ label, value, unit, note, icon: Icon, tone }) => (
  <div className={`card p-3 md:p-4 min-w-0 ${tone === 'dark' ? '!bg-slate-900 !border-slate-700' : ''}`}>
    <div className={`flex items-center gap-1.5 text-xs md:text-sm font-medium ${tone === 'dark' ? 'text-slate-400' : 'text-brand-muted'}`}>
      {Icon && <Icon size={14} className="text-slate-400" />}{label}
    </div>
    <div className="mt-2 flex items-baseline gap-1 flex-wrap">
      <span className={`num text-xl md:text-[26px] font-extrabold leading-tight ${tone === 'dark' ? 'text-white' : 'text-brand-ink'}`}>{value}</span>
      {unit && <span className="text-xs text-slate-500">{unit}</span>}
    </div>
    {note && <div className={`text-xs mt-1 leading-snug ${tone === 'dark' ? 'text-slate-400' : 'text-brand-muted'}`}>{note}</div>}
  </div>
);

export const Segmented = ({ value, onChange, options, size = 'sm' }) => (
  <div className="seg max-w-full overflow-x-auto no-scrollbar">
    {options.map((o) => (
      <button key={o.value} onClick={() => onChange(o.value)}
        className={`seg-btn ${size === 'sm' ? '!h-8 !px-3 text-[13px]' : ''} ${value === o.value ? 'seg-btn-on' : ''}`}>{o.label}</button>
    ))}
  </div>
);

export const TipBox = ({ title, rows, footer }) => (
  <div className="bg-white/95 backdrop-blur-sm p-2.5 border border-slate-200 rounded-lg shadow-xl text-xs max-w-xs">
    <p className="font-bold text-slate-800 mb-1.5 border-b border-slate-100 pb-1 leading-snug">{title}</p>
    {rows.filter(Boolean).map(([k, v, color]) => (
      <div key={k} className="flex justify-between gap-4 py-0.5">
        <span className="flex items-center gap-1.5 text-slate-500">
          {color && <span className="w-2 h-2 rounded-sm" style={{ background: color }} />}{k}
        </span>
        <span className="font-mono font-bold text-slate-700 text-right">{v}</span>
      </div>
    ))}
    {footer && <p className="mt-1.5 pt-1 border-t border-slate-100 text-slate-400 leading-snug">{footer}</p>}
  </div>
);

// 類別圖例（顏色 + 文字，永遠不只靠顏色）；可點擊切換顯示
export const CategoryLegend = ({ hidden = [], onToggle, counts }) => (
  <div className="flex flex-wrap gap-2">
    {CATEGORIES.map((c) => {
      const off = hidden.includes(c);
      return (
        <button key={c} onClick={onToggle ? () => onToggle(c) : undefined}
          className={`h-8 px-2.5 rounded-lg border text-[13px] flex items-center gap-1.5 ${off ? 'border-slate-200 text-slate-400 bg-white' : 'border-brand-line bg-brand-ground text-slate-700'} ${onToggle ? '' : 'cursor-default'}`}>
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: off ? '#cbd5e1' : CATEGORY_COLOR[c] }} />
          {c}{counts && <span className="num text-xs text-slate-400">{counts[c] ?? 0}</span>}
        </button>
      );
    })}
  </div>
);

export const Select = ({ value, onChange, options, label, className = '' }) => (
  <label className={`flex items-center gap-1.5 text-[13px] text-slate-600 ${className}`}>
    {label && <span className="whitespace-nowrap">{label}</span>}
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-lg border border-brand-line bg-white px-2 text-[13px] text-slate-700 min-w-0 max-w-[12rem]">
      {options.map((o) => (typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  </label>
);

export const Note = ({ children }) => (
  <p className="text-[11px] leading-relaxed text-slate-500 bg-brand-ground border border-brand-line rounded-lg px-3 py-2">{children}</p>
);
