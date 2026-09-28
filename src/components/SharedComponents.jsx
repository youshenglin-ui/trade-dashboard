// ==========================================
// 共用 UI 元件 (Shared UI Components)
// ==========================================
import React, { Component, useState, useEffect, useRef, useMemo } from 'react';
import { AlertTriangle, ArrowUpRight, ArrowDownRight, Newspaper, CheckSquare, ChevronDown, Square } from 'lucide-react';
import { formatSmartWeight, getCountryFlag, getSimplePlantName, cleanNumber } from '../utils/helpers';
import { GLOBAL_EVENTS } from '../utils/constants';

// Error Boundary
export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  componentDidCatch(error, errorInfo) { console.error("Chart Error:", error); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded text-slate-400">
          <AlertTriangle size={32} className="mb-2 text-amber-400" />
          <p className="text-sm">圖表資料異常</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// Chart Tooltip
export const CustomTimeTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const event = GLOBAL_EVENTS.find(e => label && (label === e.date || label.startsWith(e.date) || (label.length === 4 && e.date.startsWith(label))));
        return (
            <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-xl z-50 text-xs">
                <p className="font-bold text-slate-800 mb-2 border-b pb-1">{label}</p>
                {event && (
                    <div className="mb-2 p-1.5 bg-red-50 border border-red-200 rounded text-red-800">
                        <div className="flex items-center gap-1 font-bold"><Newspaper size={10}/> {event.label}</div>
                        <div>{event.desc}</div>
                    </div>
                )}
                {payload.map((entry, index) => (
                    <div key={index} className="flex justify-between gap-3 mb-1" style={{ color: entry.color }}>
                        <span>{entry.name}:</span>
                        <span className="font-mono font-medium">
                            {entry.name.includes('單價') ? (entry.value || 0).toLocaleString() : 
                             entry.name.includes('重量') ? formatSmartWeight(entry.value) : 
                             (entry.value || 0).toLocaleString()}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

// Pie Chart Label
export const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  
  const flag = getCountryFlag(name);

  return (
    <text x={x} y={y} fill="#374151" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11}>
      {`${flag} ${name}`} {(percent * 100).toFixed(0)}%
    </text>
  );
};

// KPI Card（風格 B：大數字、小圖示，手機兩欄）
export const KPICard = ({ title, value, subtext, trend, icon: Icon, color }) => (
  <div className="card p-4 md:p-5 flex flex-col gap-1.5 transition-all hover:-translate-y-0.5 hover:shadow-lg min-w-0">
    <div className="flex items-center gap-2">
      <p className="text-xs md:text-sm font-medium text-brand-muted flex-1 min-w-0 truncate">{title}</p>
      {Icon ? <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}><Icon size={15} className="text-white" /></span> : null}
    </div>
    <h3 className="num text-xl md:text-[26px] font-extrabold leading-tight text-brand-ink break-words">{value}</h3>
    <div className={`flex items-center text-xs md:text-sm font-bold ${trend === 'up' ? 'text-emerald-700' : 'text-rose-600'}`}>
      {trend === 'up' ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
      <span className="ml-0.5">{subtext}</span>
    </div>
  </div>
);

// 分段切換按鈕（範圍、粒度、指標等）
export const Segmented = ({ value, onChange, options, className = '' }) => (
  <div className={`seg ${className}`} role="group">
    {options.map(o => (
      <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={value === o.value}
        className={`seg-btn ${value === o.value ? 'seg-btn-on' : ''}`}>{o.label}</button>
    ))}
  </div>
);

// 手機版可左右滑動的圖表外框：資料期數多時給圖表最小寬度，避免標籤擠在一起
export const ScrollableChart = ({ points = 0, perPoint = 22, minWidth = 320, className = '', children }) => (
  <div className={`overflow-x-auto no-scrollbar md:overflow-visible ${className}`}>
    <div className="h-full min-w-[var(--chart-w)] md:min-w-0" style={{ '--chart-w': `${Math.max(minWidth, points * perPoint)}px` }}>{children}</div>
  </div>
);

// Multi Select Dropdown
export const MultiSelectDropdown = ({ options, selected, onChange, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const groupedOptions = useMemo(() => {
        const groups = {};
        options.forEach(opt => {
            const g = opt.group || '其他';
            if (!groups[g]) groups[g] = [];
            groups[g].push(opt);
        });
        return groups;
    }, [options]);

    const toggleOption = (code) => {
        if (selected.includes(code)) onChange(selected.filter(c => c !== code));
        else onChange([...selected, code]);
    };

    const toggleGroup = (groupName) => {
        const groupItems = groupedOptions[groupName].map(i => i.code);
        const allSelected = groupItems.every(c => selected.includes(c));
        if (allSelected) onChange(selected.filter(c => !groupItems.includes(c)));
        else {
            const newSelected = new Set([...selected, ...groupItems]);
            onChange(Array.from(newSelected));
        }
    };

    return (
        <div className="relative" ref={containerRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${selected.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
            >
                <CheckSquare size={16}/>
                <span className="font-medium truncate max-w-[200px]">
                    {selected.length === 0 ? `選擇${label}` : `已選 ${selected.length} 項`}
                </span>
                <ChevronDown size={14}/>
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto p-2">
                    <div className="flex justify-between mb-2 pb-2 border-b border-slate-100">
                        <button onClick={() => onChange(options.map(o => o.code))} className="text-xs text-blue-600 hover:underline">全選</button>
                        <button onClick={() => onChange([])} className="text-xs text-slate-500 hover:underline">清除</button>
                    </div>
                    {Object.entries(groupedOptions).map(([group, items]) => {
                        const groupCodes = items.map(i => i.code);
                        const isGroupAll = groupCodes.every(c => selected.includes(c));
                        const isGroupPartial = !isGroupAll && groupCodes.some(c => selected.includes(c));
                        return (
                            <div key={group} className="mb-3">
                                <div className="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded cursor-pointer hover:bg-slate-100" onClick={() => toggleGroup(group)}>
                                    {isGroupAll ? <CheckSquare size={14} className="text-blue-600"/> : isGroupPartial ? <Square size={14} className="text-blue-600 fill-blue-600 opacity-50"/> : <Square size={14} className="text-slate-400"/>}
                                    <span className="text-xs font-bold text-slate-700">{group}</span>
                                </div>
                                <div className="pl-4 mt-1 space-y-0.5">
                                    {items.map(item => (
                                        <div key={item.code} className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-blue-50" onClick={() => toggleOption(item.code)}>
                                            <div className={`w-3 h-3 border rounded flex items-center justify-center ${selected.includes(item.code) ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                                                {selected.includes(item.code) && <CheckSquare size={10} className="text-white"/>}
                                            </div>
                                            <span className="text-xs text-slate-600 truncate">{item.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// Custom X Axis Tick
export const CustomXAxisTick = ({ x, y, payload, data }) => {
    const item = data && data[payload.index];
    const company = item ? item.company : '';
    
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={16} textAnchor="end" fill="#374151" transform="rotate(-35)" fontSize={11} fontWeight="500">
          {payload.value}
        </text>
        <text x={0} y={0} dy={28} textAnchor="end" fill="#64748b" transform="rotate(-35)" fontSize={9}>
          [{company}]
        </text>
      </g>
    );
};