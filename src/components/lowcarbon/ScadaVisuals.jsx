// 工業 SCADA 風格設備圖示（移植自 youshenglin-ui/ecirisk-demo「EcoRisk SCADA」demo 的 IndustrialTechNode）
import React from 'react';

export function EquipmentVisual({ visualType }) {
  return (
    <>
        {visualType === 'blast-furnace' && (
          <svg className="w-32 h-32 text-slate-400" viewBox="0 0 100 100">
             <path d="M 35 20 L 65 20 L 75 70 L 25 70 Z" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
             <rect x="40" y="5" width="20" height="15" fill="#475569" stroke="#94a3b8" strokeWidth="1.5" />
             <path d="M 60 10 L 80 10" stroke="#94a3b8" strokeWidth="3" />
             <rect x="30" y="70" width="40" height="10" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5" />
             <path d="M 45 75 L 55 75 L 55 90 L 45 90 Z" fill="#f97316" className="animate-pulse" />
             <circle cx="50" cy="50" r="10" fill="#ea580c" opacity="0.6" className="animate-pulse" />
             <path d="M 35 45 L 65 45 M 30 60 L 70 60" stroke="#64748b" strokeWidth="1" strokeDasharray="4,2" />
          </svg>
        )}

        {visualType === 'converter-furnace' && (
          <svg className="w-32 h-32 text-slate-400" viewBox="0 0 100 100">
             <path d="M 25 35 Q 50 20 75 35 L 70 70 Q 50 85 30 70 Z" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
             <rect x="47" y="0" width="6" height="40" fill="#94a3b8" />
             <polygon points="45,40 55,40 50,55" fill="#f87171" className="animate-pulse" />
             <circle cx="20" cy="55" r="5" fill="#475569" stroke="#94a3b8" strokeWidth="1" />
             <circle cx="80" cy="55" r="5" fill="#475569" stroke="#94a3b8" strokeWidth="1" />
             <line x1="10" y1="55" x2="20" y2="55" stroke="#94a3b8" strokeWidth="3" />
             <line x1="80" y1="55" x2="90" y2="55" stroke="#94a3b8" strokeWidth="3" />
             <circle cx="50" cy="65" r="12" fill="#ea580c" opacity="0.7" className="animate-pulse" />
          </svg>
        )}

        {visualType === 'rolling-mill' && (
          <svg className="w-32 h-32 text-slate-400" viewBox="0 0 100 100">
             <rect x="10" y="20" width="80" height="60" fill="none" stroke="#64748b" strokeWidth="1" strokeDasharray="2,2" />
             <circle cx="50" cy="35" r="15" fill="#475569" stroke="#94a3b8" strokeWidth="2" className="animate-[spin_2s_linear_infinite]" />
             <circle cx="50" cy="65" r="15" fill="#475569" stroke="#94a3b8" strokeWidth="2" className="animate-[spin_2s_linear_infinite_reverse]" />
             <circle cx="50" cy="35" r="3" fill="#1e293b" />
             <circle cx="50" cy="65" r="3" fill="#1e293b" />
             <rect x="10" y="47" width="35" height="6" fill="#fb923c" />
             <rect x="50" y="48.5" width="40" height="3" fill="#f87171" className="animate-pulse" />
          </svg>
        )}

        {visualType === 'rotary-kiln' && (
          <svg className="w-32 h-32 text-slate-400" viewBox="0 0 100 100">
             <g transform="rotate(10, 50, 50)">
               <rect x="15" y="35" width="70" height="30" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
               <rect x="30" y="32" width="5" height="36" fill="#64748b" stroke="#94a3b8" strokeWidth="1" />
               <rect x="65" y="32" width="5" height="36" fill="#64748b" stroke="#94a3b8" strokeWidth="1" />
               <polygon points="15,40 45,50 15,60" fill="#f97316" opacity="0.6" className="animate-pulse" />
               <line x1="15" y1="50" x2="85" y2="50" stroke="#64748b" strokeWidth="1" strokeDasharray="5,3" />
             </g>
          </svg>
        )}

        {visualType === 'grinder' && (
          <svg className="w-32 h-32 text-slate-400" viewBox="0 0 100 100">
             <circle cx="50" cy="50" r="35" fill="#334155" stroke="#94a3b8" strokeWidth="2" className="animate-[spin_5s_linear_infinite]" />
             <circle cx="50" cy="50" r="25" fill="none" stroke="#64748b" strokeWidth="1" strokeDasharray="4,4" />
             <circle cx="40" cy="65" r="4" fill="#94a3b8" />
             <circle cx="55" cy="70" r="5" fill="#94a3b8" />
             <circle cx="65" cy="60" r="4" fill="#94a3b8" />
             <rect x="40" y="45" width="20" height="10" fill="#1e293b" />
             <path d="M 25 80 L 75 80 L 85 95 L 15 95 Z" fill="#475569" stroke="#94a3b8" strokeWidth="1.5" />
          </svg>
        )}

        {visualType === 'chiller' && (
          <svg className="w-32 h-32 text-slate-400" viewBox="0 0 100 100">
             <rect x="20" y="25" width="60" height="50" rx="5" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
             <circle cx="50" cy="40" r="12" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
             <circle cx="50" cy="65" r="12" fill="#1e293b" stroke="#fb923c" strokeWidth="2" />
             <path d="M 38 40 L 62 40 M 38 65 L 62 65" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2,2" />
             <g transform="translate(50,40) scale(0.5) rotate(0)" className="animate-spin text-cyan-400">
               <path d="M0 -15 L5 -5 L-5 -5 Z M0 15 L5 5 L-5 5 Z M15 0 L5 5 L5 -5 Z M-15 0 L-5 5 L-5 -5 Z" fill="currentColor"/>
             </g>
          </svg>
        )}

        {visualType === 'ups-grid' && (
          <svg className="w-32 h-32 text-slate-400" viewBox="0 0 100 100">
             <rect x="25" y="15" width="50" height="70" rx="3" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
             <rect x="35" y="25" width="30" height="15" fill="#1e293b" stroke="#0ea5e9" strokeWidth="1" />
             <text x="50" y="35" fontSize="8" fill="#0ea5e9" textAnchor="middle" fontFamily="monospace">8.2MW</text>
             <rect x="30" y="50" width="18" height="10" fill="#475569" />
             <rect x="52" y="50" width="18" height="10" fill="#475569" />
             <rect x="30" y="65" width="18" height="10" fill="#475569" />
             <rect x="52" y="65" width="18" height="10" fill="#475569" />
             <polygon points="48,80 55,80 50,88 56,88 46,100 49,88 43,88" fill="#eab308" transform="scale(0.5) translate(50,55)" className="animate-pulse" />
          </svg>
        )}

        {visualType === 'server-rack' && (
          <svg className="w-32 h-32 text-slate-400" viewBox="0 0 100 100">
             {/* 高科技/資料中心：伺服器機櫃 */}
             <rect x="25" y="10" width="50" height="80" rx="2" fill="#1e293b" stroke="#94a3b8" strokeWidth="2" />
             {/* 伺服器刀片 */}
             {[20, 32, 44, 56, 68].map(y => (
               <g key={y}>
                 <rect x="30" y={y} width="40" height="8" fill="#334155" stroke="#475569" strokeWidth="1" />
                 <circle cx="34" cy={y+4} r="1.5" fill="#10b981" />
                 <circle cx="38" cy={y+4} r="1.5" fill="#10b981" className="animate-pulse" />
                 <line x1="45" y1={y+4} x2="65" y2={y+4} stroke="#475569" strokeWidth="1" />
               </g>
             ))}
             {/* 散熱氣流箭頭 (紅色代表熱通道異常) */}
             <path d="M 75 30 L 85 20 M 75 50 L 85 40 M 75 70 L 85 60" stroke="#f43f5e" strokeWidth="2" fill="none" className="animate-pulse" markerEnd="url(#arrow)" />
             <defs>
               <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                 <path d="M 0 0 L 10 5 L 0 10 z" fill="#f43f5e" />
               </marker>
             </defs>
          </svg>
        )}
        
        {visualType === 'cleanroom' && (
          <svg className="w-32 h-32 text-slate-400" viewBox="0 0 100 100">
             <rect x="15" y="15" width="70" height="70" fill="none" stroke="#94a3b8" strokeWidth="2" />
             <rect x="15" y="15" width="70" height="15" fill="#334155" />
             <path d="M 25 30 L 25 85 M 40 30 L 40 85 M 60 30 L 60 85 M 75 30 L 75 85" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4,4" className="animate-[slide-down_2s_linear_infinite] opacity-50" />
             <rect x="35" y="55" width="30" height="30" fill="#475569" stroke="#94a3b8" strokeWidth="1.5" />
             <circle cx="50" cy="70" r="6" fill="#1e293b" />
             <rect x="48" y="55" width="4" height="15" fill="#facc15" className="animate-pulse" />
          </svg>
        )}

        {visualType === 'fab-equipment' && (
          <svg className="w-32 h-32 text-slate-400" viewBox="0 0 100 100">
             <circle cx="50" cy="50" r="30" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
             <circle cx="50" cy="50" r="20" fill="#1e293b" stroke="#475569" strokeWidth="2" />
             <circle cx="50" cy="50" r="12" fill="#cbd5e1" />
             <rect x="10" y="45" width="10" height="10" fill="#475569" />
             <rect x="80" y="45" width="10" height="10" fill="#475569" />
             <circle cx="50" cy="50" r="16" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="4,4" className="animate-[spin_3s_linear_infinite]" />
          </svg>
        )}

        {visualType === 'scrubber' && (
          <svg className="w-32 h-32 text-slate-400" viewBox="0 0 100 100">
             <path d="M 30 20 L 70 20 L 70 80 L 30 80 Z" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
             <path d="M 40 10 L 60 10 L 60 20 L 40 20 Z" fill="#475569" />
             <path d="M 15 65 L 30 65" stroke="#94a3b8" strokeWidth="4" />
             <polygon points="25,60 35,65 25,70" fill="#38bdf8" />
             <rect x="35" y="45" width="30" height="15" fill="#f97316" opacity="0.7" className="animate-pulse" />
             <line x1="30" y1="35" x2="70" y2="35" stroke="#38bdf8" strokeWidth="2" strokeDasharray="3,3" />
             <line x1="30" y1="40" x2="70" y2="40" stroke="#38bdf8" strokeWidth="2" strokeDasharray="3,3" />
             <path d="M 45 5 C 40 5, 35 10, 45 10 C 50 10, 55 5, 45 5 Z" fill="#94a3b8" opacity="0.5" className="animate-pulse" />
          </svg>
        )}

        {visualType === 'power-boiler' && (
          <svg className="w-32 h-32 text-slate-400" viewBox="0 0 100 100">
             <rect x="25" y="15" width="50" height="70" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
             <polygon points="25,85 50,45 75,85" fill="#ea580c" opacity="0.6" className="animate-pulse" />
             <path d="M 35 20 L 35 80 M 50 20 L 50 45 M 65 20 L 65 80" stroke="#cbd5e1" strokeWidth="1.5" />
             <path d="M 50 15 L 50 5" stroke="#cbd5e1" strokeWidth="3" />
             <polygon points="45,10 50,5 55,10" fill="#cbd5e1" />
          </svg>
        )}

        {visualType === 'turbine' && (
          <svg className="w-32 h-32 text-slate-400" viewBox="0 0 100 100">
             <path d="M 20 40 L 80 25 L 80 75 L 20 60 Z" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
             <line x1="10" y1="50" x2="90" y2="50" stroke="#94a3b8" strokeWidth="4" />
             <line x1="35" y1="35" x2="35" y2="65" stroke="#475569" strokeWidth="2" />
             <line x1="50" y1="32" x2="50" y2="68" stroke="#475569" strokeWidth="2" />
             <line x1="65" y1="28" x2="65" y2="72" stroke="#475569" strokeWidth="2" />
             <path d="M 85 40 A 10 10 0 0 1 85 60" fill="none" stroke="#38bdf8" strokeWidth="2" markerEnd="url(#arrow-blue)" className="animate-pulse" />
             <defs>
               <marker id="arrow-blue" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse">
                 <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
               </marker>
             </defs>
          </svg>
        )}

        {visualType === 'generator' && (
          <svg className="w-32 h-32 text-slate-400" viewBox="0 0 100 100">
             <rect x="25" y="30" width="50" height="40" rx="5" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
             <circle cx="50" cy="50" r="12" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
             <line x1="10" y1="50" x2="25" y2="50" stroke="#94a3b8" strokeWidth="4" />
             <line x1="30" y1="35" x2="70" y2="35" stroke="#1e293b" strokeWidth="1" />
             <line x1="30" y1="65" x2="70" y2="65" stroke="#1e293b" strokeWidth="1" />
             <polygon points="75,45 95,45 90,55 80,55 75,45" fill="#facc15" />
             <polygon points="85,35 95,40 85,45" fill="#facc15" className="animate-pulse" />
          </svg>
        )}
    </>
  );
}
