// ==========================================
// 貿易戰情室：上方重點指標
// ==========================================
// 1 貿易規模（進出口、順逆差、近 12 個月年增率）
// 2 主要進口來源、3 主要出口市場（國旗、佔比、前三大集中度 HHI）
// 4 單價與異常（近 12 個月均價年增率、月度金額偏離 ±2σ 的異常月份）
import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Ship, PackageOpen, Activity, Scale } from 'lucide-react';
import CountryFlag from './CountryFlag';
import { buildCountryRows, concentration, hhiLabel, fmtUsdK, fmtPct, isExportType } from '../../lib/trade/countryMetrics';

const ym = (d) => d.date.slice(0, 7);

function lastMonths(rows, months, offset = 0) {
  const all = [...new Set(rows.map(ym))].sort();
  if (!all.length) return [];
  const last = all[all.length - 1];
  const [y, m] = last.split('-').map(Number);
  const keys = new Set();
  for (let i = offset; i < offset + months; i++) {
    const d = new Date(y, m - 1 - i, 1);
    keys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return rows.filter((r) => keys.has(ym(r)));
}

const sumFlow = (rows) => rows.reduce((a, d) => {
  if (isExportType(d.type)) { a.ev += d.value; a.ew += d.weight; } else { a.iv += d.value; a.iw += d.weight; }
  return a;
}, { ev: 0, ew: 0, iv: 0, iw: 0 });

const pctChange = (now, prev) => (prev > 0 ? now / prev - 1 : null);
const price = (v, w) => (w > 0 ? (v * 1000) / w : null);

function Delta({ value, suffix = '年增' }) {
  if (value == null || !isFinite(value)) return <span className="text-slate-400">{suffix} —</span>;
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return <span className={`inline-flex items-center gap-0.5 font-bold ${up ? 'text-emerald-700' : 'text-rose-600'}`}><Icon size={13} />{suffix} {up ? '+' : ''}{(value * 100).toFixed(1)}%</span>;
}

function Shell({ title, icon, tone, children, note }) {
  const Icon = icon;
  return (
    <div className="card p-4 flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-xs md:text-sm font-medium text-brand-muted flex-1 min-w-0 truncate">{title}</p>
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${tone}`}><Icon size={15} className="text-white" /></span>
      </div>
      {children}
      {note && <div className="text-[11px] text-slate-400 leading-snug mt-auto pt-1">{note}</div>}
    </div>
  );
}

function PartnerCard({ title, icon, tone, rows, shareKey, valueKey, emptyText }) {
  const ranked = rows.filter((r) => r[valueKey] > 0).sort((a, b) => b[valueKey] - a[valueKey]);
  const { topN, hhi } = concentration(rows, valueKey, 3);
  const top = ranked[0];
  return (
    <Shell title={title} icon={icon} tone={tone} note={top ? `前三大合計 ${fmtPct(topN, 0)}・HHI ${hhi}（${hhiLabel(hhi)}）` : null}>
      {top ? (
        <>
          <div className="flex items-center gap-2 min-w-0">
            <CountryFlag country={top.country} size={18} />
            <span className="text-lg md:text-xl font-extrabold text-brand-ink truncate">{top.country}</span>
            <span className="ml-auto font-mono text-lg font-black text-brand">{fmtPct(top[shareKey], 0)}</span>
          </div>
          <div className="text-xs text-slate-500 font-mono">{fmtUsdK(top[valueKey])}</div>
          <div className="flex flex-col gap-0.5 mt-1">
            {ranked.slice(1, 3).map((r, i) => (
              <div key={r.country} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="text-slate-400 w-3">{i + 2}</span><CountryFlag country={r.country} size={10} />
                <span className="truncate flex-1">{r.country}</span><span className="font-mono">{fmtPct(r[shareKey], 0)}</span>
              </div>
            ))}
          </div>
        </>
      ) : <div className="text-sm text-slate-400 py-3">{emptyText}</div>}
    </Shell>
  );
}

export default function TradeKpis({ filteredData, regionData, loading }) {
  const k = useMemo(() => {
    const flow = sumFlow(filteredData);
    const { rows } = buildCountryRows(filteredData);
    const y0 = sumFlow(lastMonths(regionData, 12));
    const y1 = sumFlow(lastMonths(regionData, 12, 12));
    // 月度總額 → 偏離平均 ±2 個標準差的月份
    const byMonth = new Map();
    filteredData.forEach((d) => byMonth.set(ym(d), (byMonth.get(ym(d)) || 0) + d.value));
    const series = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const vals = series.map((s) => s[1]);
    const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
    const sd = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / (vals.length || 1));
    const anomalies = sd > 0 ? series.filter(([, v]) => Math.abs(v - mean) > 2 * sd).map(([m, v]) => ({ m, up: v > mean })) : [];
    return {
      flow, rows, y0, y1, anomalies, months: series.length,
      yoyTotal: pctChange(y0.ev + y0.iv, y1.ev + y1.iv),
      pi: price(y0.iv, y0.iw), pe: price(y0.ev, y0.ew),
      piYoy: pctChange(price(y0.iv, y0.iw), price(y1.iv, y1.iw)),
      peYoy: pctChange(price(y0.ev, y0.ew), price(y1.ev, y1.ew)),
    };
  }, [filteredData, regionData]);

  if (loading) return null;
  const bal = k.flow.ev - k.flow.iv;
  const lastAnom = k.anomalies[k.anomalies.length - 1];

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
      <Shell title="貿易規模（區間累計）" icon={Scale} tone="bg-brand" note="年增率：最近 12 個月 vs 前 12 個月（不受上方範圍影響）">
        <div className="num text-xl md:text-[26px] font-extrabold leading-tight text-brand-ink">{fmtUsdK(k.flow.ev + k.flow.iv)}</div>
        <div className="text-xs"><Delta value={k.yoyTotal} /></div>
        <div className="grid grid-cols-3 gap-1 text-[11px] mt-1">
          <div><div className="text-slate-400">出口</div><div className="font-mono font-bold text-slate-700">{fmtUsdK(k.flow.ev)}</div></div>
          <div><div className="text-slate-400">進口</div><div className="font-mono font-bold text-slate-700">{fmtUsdK(k.flow.iv)}</div></div>
          <div><div className="text-slate-400">{bal >= 0 ? '順差' : '逆差'}</div><div className={`font-mono font-bold ${bal >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{fmtUsdK(Math.abs(bal))}</div></div>
        </div>
      </Shell>
      <PartnerCard title="主要進口來源" icon={PackageOpen} tone="bg-brand-cyan" rows={k.rows} valueKey="importValue" shareKey="importShare" emptyText="區間內無進口紀錄" />
      <PartnerCard title="主要出口市場" icon={Ship} tone="bg-emerald-600" rows={k.rows} valueKey="exportValue" shareKey="exportShare" emptyText="區間內無出口紀錄" />
      <Shell title="單價（近 12 個月）與異常月份" icon={Activity} tone="bg-brand-orange"
        note={k.anomalies.length ? `月度金額偏離平均 ±2σ 的月份：${k.anomalies.slice(-4).map((a) => `${a.m}${a.up ? '↑' : '↓'}`).join('、')}` : `近 ${k.months} 個月無明顯異常（±2σ）`}>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[11px] text-slate-400">進口均價</div>
            <div className="font-mono text-lg font-extrabold text-brand-ink">{k.pi != null ? k.pi.toFixed(2) : '—'}<span className="text-[10px] font-medium text-slate-400 ml-0.5">USD/kg</span></div>
            <div className="text-[11px]"><Delta value={k.piYoy} /></div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">出口均價</div>
            <div className="font-mono text-lg font-extrabold text-brand-ink">{k.pe != null ? k.pe.toFixed(2) : '—'}<span className="text-[10px] font-medium text-slate-400 ml-0.5">USD/kg</span></div>
            <div className="text-[11px]"><Delta value={k.peYoy} /></div>
          </div>
        </div>
        <div className="text-xs mt-1">
          異常月份 <b className={`font-mono ${k.anomalies.length ? 'text-rose-600' : 'text-slate-700'}`}>{k.anomalies.length}</b> 個
          {lastAnom && <span className="text-slate-500">（最近：{lastAnom.m}）</span>}
        </div>
      </Shell>
    </section>
  );
}
