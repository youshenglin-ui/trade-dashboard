// ==========================================
// 版面外框：電腦版左側功能列、手機版上方標題列 / 底部導覽列 / 「更多」抽屜
// 風格 B「淨零跨域」
// ==========================================
import React from 'react';
import { Settings, History, Star, Search, LayoutGrid, X, ChevronRight } from 'lucide-react';
import { MODULES } from '../../config/modules';

const SectionTitle = ({ children }) => (
  <div className="px-2 pb-1.5 text-xs font-bold tracking-[0.12em] text-brand-muted">{children}</div>
);

export const Sidebar = ({ activeModule, onModule, topics, currentTopic, onTopic, watched, history, onProduct, onSettings }) => (
  <aside className="hidden md:flex w-64 flex-shrink-0 flex-col bg-white border-r border-brand-line h-screen sticky top-0">
    <div className="px-5 pt-5 pb-4 border-b border-brand-line space-y-3">
      <img src="/brand/tri-logo.png" alt="財團法人台灣綜合研究院" className="h-10 w-auto" />
      <div>
        <div className="text-xl font-black tracking-wide text-brand-ink">產業戰情室</div>
        <div className="text-[11px] tracking-[0.08em] text-brand-muted mt-0.5">TRADE · HYDROGEN · CCUS · CARBON FEE</div>
      </div>
    </div>

    <nav aria-label="戰情模組" className="px-3 pt-4 pb-2 space-y-1">
      <SectionTitle>戰情模組</SectionTitle>
      {MODULES.map(({ id, label, icon }) => {
        const Icon = icon;
        const on = activeModule === id;
        return (
          <button key={id} onClick={() => onModule(id)}
            className={`w-full h-11 px-3 rounded-xl flex items-center gap-3 text-[15px] transition-all hover:translate-x-0.5 ${on ? 'bg-brand-soft text-brand-dark font-bold shadow-[inset_4px_0_0_#2a5ee8]' : 'text-brand-ink hover:bg-slate-50'}`}>
            <Icon size={19} /> <span>{label}</span>
            {on && <ChevronRight size={15} className="ml-auto opacity-60" />}
          </button>
        );
      })}
    </nav>

    <div className="px-3 pt-3 pb-2 space-y-0.5">
      <SectionTitle>戰略專題</SectionTitle>
      {Object.entries(topics).map(([key, topic]) => (
        <button key={key} onClick={() => onTopic(key)}
          className={`w-full text-left h-9 px-3 rounded-lg text-sm transition-colors ${currentTopic === key && activeModule === 'trade' ? 'bg-brand text-white font-bold' : 'text-brand-ink hover:bg-slate-50'}`}>
          {topic.title}
        </button>
      ))}
    </div>

    <div className="px-3 pt-3 pb-2 flex-1 overflow-y-auto no-scrollbar">
      {watched.length > 0 && (
        <div className="mb-3">
          <SectionTitle>重點監控</SectionTitle>
          {watched.map(p => (
            <button key={p.code} onClick={() => onProduct(p.code, p.name)} className="w-full text-left h-8 px-3 rounded-lg text-sm hover:bg-slate-50 flex items-center gap-2 truncate">
              <Star size={12} className="text-brand-orange flex-shrink-0" fill="currentColor" /> <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      )}
      <SectionTitle>最近搜尋</SectionTitle>
      {history.map((item) => (
        <button key={item.code} onClick={() => onProduct(item.code, item.name)} className="w-full text-left h-8 px-3 rounded-lg text-sm hover:bg-slate-50 flex items-baseline gap-2">
          <span className="num text-xs text-brand-muted w-12 flex-shrink-0">{item.code}</span><span className="truncate">{item.name}</span>
        </button>
      ))}
    </div>

    <div className="px-4 py-3 border-t border-brand-line flex items-center gap-2.5">
      <img src="/brand/nz-mark.png" alt="" className="w-7 h-auto" />
      <div className="text-xs font-bold leading-tight flex-1">淨零跨域前瞻技術<br />策略交流平台</div>
      <button onClick={onSettings} aria-label="設定資料源" title="設定資料源" className="w-9 h-9 rounded-lg flex items-center justify-center text-brand-muted hover:bg-slate-100"><Settings size={17} /></button>
    </div>
  </aside>
);

export const MobileTopBar = ({ title, showSearch, onSearch }) => (
  <header className="md:hidden sticky top-0 z-30 bg-white border-b border-brand-line px-4 py-2.5 flex items-center gap-2.5">
    <img src="/brand/tri-logo.png" alt="財團法人台灣綜合研究院" className="h-7 w-auto" />
    <div className="flex flex-col min-w-0 flex-1">
      <span className="text-[11px] text-brand-muted leading-tight">產業戰情室</span>
      <span className="text-base font-black leading-tight truncate">{title}</span>
    </div>
    {showSearch && (
      <button onClick={onSearch} aria-label="搜尋貨名或稅號" className="w-11 h-11 rounded-xl bg-brand-soft text-brand-dark flex items-center justify-center"><Search size={20} /></button>
    )}
  </header>
);

export const MobileBottomNav = ({ activeModule, onModule, onMore }) => (
  <nav aria-label="戰情模組" className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-brand-line pb-safe">
    <div className="grid grid-cols-5 h-16">
      {MODULES.map(({ id, short, icon }) => {
        const Icon = icon;
        const on = activeModule === id;
        return (
          <button key={id} onClick={() => onModule(id)} className={`flex flex-col items-center justify-center gap-1 text-xs ${on ? 'text-brand font-bold' : 'text-brand-muted'}`}>
            <Icon size={22} /> {short}
          </button>
        );
      })}
      <button onClick={onMore} className="flex flex-col items-center justify-center gap-1 text-xs text-brand-muted"><LayoutGrid size={22} />更多</button>
    </div>
  </nav>
);

export const MoreSheet = ({ open, onClose, topics, onTopic, history, onProduct, onSettings }) => {
  if (!open) return null;
  return (
    <div className="md:hidden fixed inset-0 z-50 bg-slate-900/50 flex flex-col justify-end" onClick={onClose}>
      <div className="bg-white rounded-t-3xl px-5 pt-3 pb-8 space-y-5 max-h-[85vh] overflow-y-auto animate-[sheetUp_.25s_ease]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center">
          <span className="mx-auto w-10 h-1.5 rounded-full bg-brand-line" />
          <button onClick={onClose} aria-label="關閉" className="absolute right-4 w-10 h-10 rounded-xl bg-brand-ground text-brand-muted flex items-center justify-center"><X size={18} /></button>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-bold tracking-[0.1em] text-brand-muted">戰略專題</div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(topics).map(([key, topic]) => (
              <button key={key} onClick={() => { onTopic(key); onClose(); }} className="min-h-12 px-3 py-2 rounded-xl border border-brand-line bg-brand-ground text-sm font-bold text-left">{topic.title}</button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-bold tracking-[0.1em] text-brand-muted">最近搜尋</div>
          <div className="flex flex-wrap gap-2">
            {history.map(item => (
              <button key={item.code} onClick={() => { onProduct(item.code, item.name); onClose(); }} className="h-10 px-3.5 rounded-full border border-brand-line text-sm flex items-center gap-1.5">
                <History size={13} className="text-brand-muted" /> {item.name} <span className="num text-xs text-brand-muted">{item.code}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 pt-4 border-t border-brand-line">
          <img src="/brand/nz-mark.png" alt="" className="w-8 h-auto" />
          <span className="text-sm font-bold flex-1">淨零跨域前瞻技術策略交流平台</span>
          <button onClick={() => { onSettings(); onClose(); }} className="h-10 px-3.5 rounded-xl border border-brand-line text-sm">設定資料源</button>
        </div>
      </div>
    </div>
  );
};
