// ==========================================
// CCUS 碳封存頁：各廠捕捉均化成本粗估 vs CCfD 期待執行價格
// ==========================================
// 資料：survey_answers「成本與財務」（115 環境部旗艦問卷）。均化成本＝單位 CAPEX × 資本回收係數 CRF(r, n) ＋ 單位 OPEX。
//   - 單位 CAPEX：問卷「單位CAPEX(元/噸年產能)」，沒填則以 捕捉CAPEX(萬元)×1萬 ÷ 捕捉規模(噸/年) 換算
//   - 單位 OPEX：「單位OPEX(元/噸)」→「申報OPEX(元/噸)」→ 捕捉OPEX(萬元/年)×1萬 ÷ 規模
//   - n：問卷「財務攤提年限」（區間取中點、「N年以上」取 N），沒填用預設；r：頁面上可調
// 只算捕捉段；運輸、封存成本另見「案場與管線規劃」的運輸估價。
import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell, LabelList } from 'recharts';
import { Card, Badge } from './ui';
import { CAT, NEUTRAL } from '../../lib/energy/palette';
import { financeRows } from '../../lib/energy/ccusCost';

const fmt = (v) => (v == null ? '—' : Math.round(v).toLocaleString());

export default function CcusCostCompare({ finance, benchmark }) {
  const [rate, setRate] = useState(0.08);
  const [defaultYears, setDefaultYears] = useState(15);
  const rows = useMemo(() => financeRows(finance, rate, defaultYears), [finance, rate, defaultYears]);
  const chartRows = rows.filter((r) => r.lcoc != null || r.ccfd != null);
  const cap = 15000;
  const data = chartRows.map((r) => ({
    ...r,
    capexBar: r.capexPart != null ? Math.min(r.capexPart, cap) : 0,
    opexBar: r.opexPart != null ? Math.min(r.opexPart, Math.max(0, cap - Math.min(r.capexPart || 0, cap))) : 0,
  }));

  return (
    <Card title="捕捉均化成本粗估 vs CCfD 期待執行價格" subtitle={`元/噸 CO2；均化成本＝單位CAPEX×CRF(${(rate * 100).toFixed(0)}%, 攤提年)＋單位OPEX，只含捕捉段`}
      right={(
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5">折現率
            <input type="range" min={0.03} max={0.15} step={0.01} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="w-24" />
            <b className="font-mono w-9">{(rate * 100).toFixed(0)}%</b>
          </label>
          <label className="flex items-center gap-1.5">未填攤提年
            <select value={defaultYears} onChange={(e) => setDefaultYears(Number(e.target.value))} className="border border-slate-200 rounded px-1 py-0.5">
              {[10, 15, 20, 25].map((y) => <option key={y} value={y}>{y} 年</option>)}
            </select>
          </label>
        </div>
      )}>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 16, left: 0, bottom: 4 }} barGap={4}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} domain={[0, cap]} allowDataOverflow tickFormatter={(v) => v.toLocaleString()} />
            <Tooltip formatter={(v, n, p) => {
              const r = p.payload;
              if (n === '資本成本(CRF)') return [`${fmt(r.capexPart)} 元/噸`, n];
              if (n === '營運成本') return [`${fmt(r.opexPart)} 元/噸`, n];
              return [`${fmt(r.ccfd)} 元/噸以上`, n];
            }} />
            {benchmark && <ReferenceLine y={Number(benchmark.value)} stroke={NEUTRAL} strokeDasharray="4 4" label={{ value: `${benchmark.label} ${Number(benchmark.value).toLocaleString()}`, position: 'insideTopLeft', fontSize: 10, fill: '#64748b' }} />}
            <Bar dataKey="capexBar" name="資本成本(CRF)" stackId="lcoc" fill={CAT[0]} barSize={26} />
            <Bar dataKey="opexBar" name="營運成本" stackId="lcoc" fill="#93c5fd" barSize={26} radius={[4, 4, 0, 0]}>
              <LabelList dataKey="lcoc" position="top" fontSize={10} fill="#1e3a8a" formatter={(v) => (v == null ? '' : v > cap ? `${fmt(v)}↑` : fmt(v))} />
            </Bar>
            <Bar dataKey="ccfd" name="CCfD 期待價格" fill={CAT[1]} barSize={26} radius={[4, 4, 0, 0]}>
              {data.map((r) => <Cell key={r.key} fill={CAT[1]} />)}
              <LabelList dataKey="ccfd" position="top" fontSize={10} fill="#9a3412" formatter={(v) => (v ? `${fmt(v)}+` : '')} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-4 text-[11px] text-slate-600 mt-1">
        <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-sm" style={{ background: CAT[0] }} />資本成本（CAPEX 年金化）</span>
        <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-sm" style={{ background: '#93c5fd' }} />營運成本</span>
        <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-sm" style={{ background: CAT[1] }} />CCfD 期待執行價格（業者填「以上」）</span>
        <span>超過 {cap.toLocaleString()} 的以 ↑ 標示（示範規模單位成本高）</span>
      </div>
      <div className="overflow-auto mt-3 border border-slate-100 rounded-lg">
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-2 text-left">廠區</th><th className="p-2 text-right">捕捉規模(噸/年)</th><th className="p-2 text-right">單位CAPEX</th>
              <th className="p-2 text-right">攤提年</th><th className="p-2 text-right">單位OPEX</th><th className="p-2 text-right">均化成本</th>
              <th className="p-2 text-right">CCfD 期待</th><th className="p-2 text-left">CCfD 參考模式</th><th className="p-2 text-left">備註</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="p-2 font-bold">{r.name}</td>
                <td className="p-2 text-right font-mono">{r.scale != null ? r.scale.toLocaleString() : r.status || '—'}</td>
                <td className="p-2 text-right font-mono">{fmt(r.uCapex)}</td>
                <td className="p-2 text-right font-mono">{r.years}{r.usedDefaultYears ? <span className="text-slate-400">（預設）</span> : ''}</td>
                <td className="p-2 text-right font-mono">{fmt(r.uOpex)}</td>
                <td className="p-2 text-right font-mono font-bold text-blue-800">{fmt(r.lcoc)}{r.partial && <span className="ml-1"><Badge tone="amber" title="CAPEX 或 OPEX 只填其一">部分</Badge></span>}</td>
                <td className="p-2 text-right font-mono font-bold text-orange-700">{r.ccfd ? `${fmt(r.ccfd)}+` : '—'}</td>
                <td className="p-2">{r.ccfdMode && r.ccfdMode !== '未勾選' ? r.ccfdMode : '—'}</td>
                <td className="p-2 text-slate-500">{[r.status, r.fixed && '原檔欄位錯位已校正'].filter(Boolean).join('；') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
