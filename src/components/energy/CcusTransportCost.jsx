// ==========================================
// CCUS 案場與管線規劃：運輸估價計算
// ==========================================
// 依規劃地圖目前的管線／海運／陸運拓樸，逐段計算理論運輸成本；參數可調，地圖上拖曳節點後即時重算。
// 模型與預設值在 src/lib/energy/ccusCost.js（TRANSPORT_DEFAULTS、transportCosts）。
import React, { useMemo, useState } from 'react';
import { Calculator, RotateCcw } from 'lucide-react';
import { TRANSPORT_DEFAULTS, transportCosts } from '../../lib/energy/ccusCost';
import { Segmented } from '../SharedComponents';

const KIND_COLOR = { 主幹管線: '#2a78d6', 分支管線: '#6da7ec', 海運: '#0d9488', 陸運槽車: '#eda100' };
const fmt0 = (v) => (v == null || !isFinite(v) ? '—' : Math.round(v).toLocaleString());
const fmtYi = (ntd) => (ntd == null ? '—' : `${(ntd / 1e8).toFixed(2)} 億元`);

function Field({ label, unit, value, onChange, step = 0.1, min = 0 }) {
  return (
    <label className="flex flex-col gap-0.5 text-[11px] text-slate-500">
      <span>{label}</span>
      <span className="flex items-center gap-1">
        <input type="number" value={value} step={step} min={min} onChange={(e) => onChange(Number(e.target.value))}
          className="w-20 h-8 px-2 border border-slate-200 rounded font-mono text-sm text-slate-800" />
        <span className="text-slate-400">{unit}</span>
      </span>
    </label>
  );
}

export default function CcusTransportCost({ topology, refParams }) {
  const initial = useMemo(() => {
    const byKey = Object.fromEntries(Object.values(refParams || {}).map((p) => [p.key, Number(p.value)]));
    return {
      ...TRANSPORT_DEFAULTS,
      pipeLand: byKey.ccus_iea_pipe_land ?? TRANSPORT_DEFAULTS.pipeLand,
      pipeOffshore: byKey.ccus_iea_pipe_offshore ?? TRANSPORT_DEFAULTS.pipeOffshore,
      shipBase: byKey.ccus_iea_ship_base ?? TRANSPORT_DEFAULTS.shipBase,
    };
  }, [refParams]);
  const [override, setOverride] = useState({});
  const p = { ...initial, ...override };
  const set = (k) => (v) => setOverride((o) => ({ ...o, [k]: v }));
  const [kind, setKind] = useState('ALL');

  const result = transportCosts(topology, p); // 路段數量少（數十段），每次重算即可
  const byKind = ['主幹管線', '分支管線', '海運', '陸運槽車'].map((k) => {
    const rs = result.rows.filter((r) => r.kind === k);
    return { kind: k, n: rs.length, km: rs.reduce((a, r) => a + r.km, 0), annual: rs.reduce((a, r) => a + r.annualNtd, 0) };
  });
  const rows = result.rows.filter((r) => kind === 'ALL' || r.kind === kind).sort((a, b) => b.annualNtd - a.annualNtd);

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3 border-b pb-2">
        <div>
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2"><Calculator size={16} className="text-sky-600" />運輸估價計算（依目前地圖拓樸即時計算）</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            管線單價有規模效應：單價 = 基準單價 ×（年輸送量 ÷ 基準量）^(−規模指數)，限制在基準的 0.5–5 倍；長度含 1.3 倍繞行係數。
            海運 = 起步成本 + 距離成本；陸運 = 裝卸 + 每公里。拖曳地圖節點或改參數會即時重算。
          </p>
        </div>
        <button type="button" onClick={() => setOverride({})} className="flex items-center gap-1 h-8 px-2.5 text-xs border border-slate-200 rounded hover:bg-slate-50"><RotateCcw size={12} />還原預設</button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div className="space-y-3">
          <div className="text-xs font-bold text-slate-600">管線</div>
          <div className="flex flex-wrap gap-3">
            <Field label="陸管基準單價" unit="USD/噸/100km" value={p.pipeLand} onChange={set('pipeLand')} />
            <Field label="離岸管基準單價" unit="USD/噸/100km" value={p.pipeOffshore} onChange={set('pipeOffshore')} />
            <Field label="基準量" unit="百萬噸/年" value={p.pipeRefMt} onChange={set('pipeRefMt')} />
            <Field label="規模指數" unit="" value={p.scaleExp} step={0.05} onChange={set('scaleExp')} />
          </div>
          <div className="text-xs font-bold text-slate-600">海運／陸運／匯率</div>
          <div className="flex flex-wrap gap-3">
            <Field label="海運起步成本" unit="USD/噸" value={p.shipBase} onChange={set('shipBase')} />
            <Field label="海運距離成本" unit="USD/噸/100km" value={p.shipPer100km} onChange={set('shipPer100km')} />
            <Field label="槽車裝卸" unit="元/噸" value={p.truckBase} step={10} onChange={set('truckBase')} />
            <Field label="槽車運費" unit="元/噸/km" value={p.truckPerKm} step={0.5} onChange={set('truckPerKm')} />
            <Field label="匯率" unit="NTD/USD" value={p.fx} step={0.5} onChange={set('fx')} />
          </div>
          <p className="text-[10px] text-slate-400">預設值：管線、海運取 IEA 2023（energy_ref_parameters）；槽車參考林園先進問卷「5 萬元/車」約每車 20 噸換算，可依實際報價調整。</p>
        </div>

        <div className="xl:col-span-3 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-2.5">
              <div className="text-[10px] font-bold text-sky-700">平均運輸成本</div>
              <div className="text-xl font-black text-sky-900 font-mono">{fmt0(result.avgNtdPerT)}<span className="text-xs font-medium ml-1">元/噸</span></div>
              <div className="text-[10px] text-sky-600">送達樞紐 {fmt0((result.delivered || 0) / 1e4)} 萬噸/年</div>
            </div>
            {byKind.map((k) => (
              <button key={k.kind} type="button" onClick={() => setKind((v) => (v === k.kind ? 'ALL' : k.kind))}
                className={`text-left rounded-lg border p-2.5 ${kind === k.kind ? 'ring-2 ring-sky-300' : ''} border-slate-200 bg-white hover:bg-slate-50`}>
                <div className="text-[10px] font-bold flex items-center gap-1" style={{ color: KIND_COLOR[k.kind] }}><i className="w-2 h-2 rounded-sm" style={{ background: KIND_COLOR[k.kind] }} />{k.kind}</div>
                <div className="text-base font-black text-slate-800 font-mono">{fmtYi(k.annual)}<span className="text-[10px] font-medium text-slate-400">/年</span></div>
                <div className="text-[10px] text-slate-500">{k.n} 段・{fmt0(k.km)} km</div>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <Segmented value={kind} onChange={setKind} options={[{ value: 'ALL', label: '全部路段' }, ...byKind.map((k) => ({ value: k.kind, label: k.kind }))]} />
            <span className="text-xs text-slate-500">年運輸成本合計 <b className="font-mono text-slate-800">{fmtYi(result.annual)}</b></span>
          </div>
          <div className="overflow-auto max-h-[320px] border border-slate-100 rounded-lg">
            <table className="w-full text-xs whitespace-nowrap">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="p-2 text-left">類型</th><th className="p-2 text-left">起點 → 終點</th><th className="p-2 text-right">長度 km</th>
                  <th className="p-2 text-right">年輸送量 萬噸</th><th className="p-2 text-right">單價 USD/噸/100km</th>
                  <th className="p-2 text-right">每噸成本 元</th><th className="p-2 text-right">年成本</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="p-2"><span className="inline-flex items-center gap-1 font-bold" style={{ color: KIND_COLOR[r.kind] }}><i className="w-2 h-2 rounded-sm" style={{ background: KIND_COLOR[r.kind] }} />{r.kind}</span></td>
                    <td className="p-2 max-w-[280px] truncate" title={`${r.from} → ${r.to}`}>{r.from} → {r.to}</td>
                    <td className="p-2 text-right font-mono">{r.km.toFixed(1)}</td>
                    <td className="p-2 text-right font-mono">{(r.flowT / 1e4).toFixed(1)}</td>
                    <td className="p-2 text-right font-mono">{r.unitUsd100 == null ? '—' : r.unitUsd100.toFixed(2)}</td>
                    <td className="p-2 text-right font-mono font-bold">{fmt0(r.ntdPerT)}</td>
                    <td className="p-2 text-right font-mono">{fmtYi(r.annualNtd)}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-400">目前沒有路段</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
