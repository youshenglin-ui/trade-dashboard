// ==========================================
// 共用 UI 元件 (Shared UI Components)
// ==========================================
import React, { Component, useState, useEffect, useRef, useMemo } from 'react';
import { AlertTriangle, ArrowUpRight, ArrowDownRight, Newspaper, CheckSquare, ChevronDown, Square } from 'lucide-react';
import { formatSmartWeight, getCountryFlag, getLocation, getSimplePlantName, cleanNumber } from '../utils/helpers';
import { GLOBAL_EVENTS, TAIWAN_REGIONS_PATHS } from '../utils/constants';

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

// KPI Card
export const KPICard = ({ title, value, subtext, trend, icon: Icon, color }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between hover:shadow-md transition-shadow">
    <div>
      <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
      <div className={`flex items-center mt-2 text-sm ${trend === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}>
        {trend === 'up' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
        <span className="ml-1 font-medium">{subtext}</span>
      </div>
    </div>
    <div className={`p-3 rounded-lg ${color}`}>{Icon ? <Icon size={24} className="text-white" /> : null}</div>
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

// Industrial Map SVG
export const IndustrialMap = ({ data, onSelect }) => {
    const locData = useMemo(() => {
        const map = {};
        data.forEach(d => {
           const loc = getLocation(d.Plant) || { name: '其他', cx: 250, cy: 300, region: '其他' };
           if(!map[loc.name]) map[loc.name] = { ...loc, value: 0, plants: new Set() };
           map[loc.name].value += (d.Output_Tons || 0);
           map[loc.name].plants.add(getSimplePlantName(d.Company, d.Plant));
        });
        return Object.values(map);
    }, [data]);

    return (
        <div className="relative w-full h-full flex items-center justify-center bg-slate-100 rounded-xl border border-slate-200 overflow-hidden">
            <svg viewBox="0 0 300 350" className="w-full h-full max-w-[300px] drop-shadow-xl">
                <path d={TAIWAN_REGIONS_PATHS.NORTH} fill="#e0f2fe" stroke="#94a3b8" strokeWidth="1" />
                <path d={TAIWAN_REGIONS_PATHS.CENTRAL} fill="#f0fdf4" stroke="#94a3b8" strokeWidth="1" />
                <path d={TAIWAN_REGIONS_PATHS.SOUTH} fill="#fff7ed" stroke="#94a3b8" strokeWidth="1" />
                <path d={TAIWAN_REGIONS_PATHS.EAST} fill="#f5f3ff" stroke="#94a3b8" strokeWidth="1" />
                
                {locData.map(loc => {
                   if(loc.value === 0) return null;
                   const radius = Math.min(Math.sqrt(loc.value) * 5 + 5, 25);
                   const plantList = Array.from(loc.plants).join(', ');
                   return (
                     <g key={loc.name} onClick={() => onSelect(loc.name)} className="cursor-pointer hover:opacity-80 transition-opacity">
                       <title>{`${loc.name}: ${loc.value.toFixed(1)} 萬噸\n(${plantList})`}</title>
                       <circle cx={loc.cx} cy={loc.cy} r={radius} fill="#3b82f6" fillOpacity="0.8" stroke="white" strokeWidth="2"/>
                       <text x={loc.cx} y={loc.cy} dy={-radius-5} textAnchor="middle" fontSize="10" fill="#1e293b" fontWeight="bold" style={{textShadow: '0px 0px 2px white'}}>{loc.name}</text>
                       <text x={loc.cx} y={loc.cy} dy={4} textAnchor="middle" fontSize="9" fill="white">{(loc.value).toFixed(1)}</text>
                     </g>
                   );
                })}
            </svg>
            <div className="absolute bottom-2 right-2 text-[10px] text-slate-500 bg-white/80 px-2 rounded flex flex-col items-end">
                <span>單位: 萬噸</span>
                <span className="text-[9px] text-slate-400">* 點擊圓點可篩選</span>
            </div>
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