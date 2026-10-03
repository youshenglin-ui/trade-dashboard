// 分頁 3：節電減碳計算器
//   減碳量（公噸/年）= 年節電量（kWh）× 電力排碳係數（kgCO2e/kWh）÷ 1,000
//   - 企業可輸入設備功率×運轉時數×節能率，或直接輸入年節電量
//   - 依技術子類帶入彙編案例的「每 MWh 年節電所需投資」中位數，估算投資與回收年限
//   - 歷年電力係數、案例節電量 vs 減碳量（斜率 = 係數）、10 年減碳推估（電網持續低碳化時節電的減碳效益會遞減）
import React, { useMemo, useState } from 'react';
import {
  CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip,
  XAxis, YAxis,
} from 'recharts';
import { Calculator, Coins, Leaf, Receipt, Timer, Zap } from 'lucide-react';
import {
  CARBON_FEE_RATES, CATEGORY_COLOR, EF_HISTORY, LATEST_EF, fmtNum, fmtTon, fmtWan, fmtYears, median,
} from '../../lib/lowcarbon/metrics';
import { AXIS_TICK, Card, GRID, Kpi, Note, Segmented, Select, TipBox } from './ui';

const numIn = 'h-9 w-full rounded-lg border border-brand-line bg-white px-2.5 text-sm num text-right';

function Field({ label, unit, value, onChange, step = 'any', hint }) {
  return (
    <label className="block">
      <span className="text-[13px] text-slate-600">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input type="number" inputMode="decimal" step={step} value={value} onChange={(e) => onChange(e.target.value)} className={numIn} />
        {unit && <span className="text-xs text-slate-500 whitespace-nowrap w-16">{unit}</span>}
      </div>
      {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

export default function CalculatorTab({ rows }) {
  const [mode, setMode] = useState('device');
  const [kw, setKw] = useState('150');
  const [hours, setHours] = useState('8000');
  const [rate, setRate] = useState('25');
  const [kwhDirect, setKwhDirect] = useState('500000');
  const [price, setPrice] = useState('3.45');
  const [efYear, setEfYear] = useState(String(EF_HISTORY[EF_HISTORY.length - 1].year));
  const [efCustom, setEfCustom] = useState('0.474');
  const [inv, setInv] = useState('');
  const [feeRate, setFeeRate] = useState('general');
  const [decline, setDecline] = useState(2);

  // 參考案例：有節電量（> 0）的案例
  const elecCases = useMemo(() => rows.filter((c) => c.electricity_kwh > 0), [rows]);
  const subOptions = useMemo(() => {
    const m = new Map();
    for (const c of elecCases) {
      if (!m.has(c.subcategory)) m.set(c.subcategory, []);
      m.get(c.subcategory).push(c);
    }
    return [...m.entries()].filter(([, l]) => l.length >= 2).map(([sub, l]) => ({ sub, list: l }))
      .sort((a, b) => b.list.length - a.list.length);
  }, [elecCases]);
  const [sub, setSub] = useState('');
  const ref = subOptions.find((o) => o.sub === sub) || null;
  const refList = ref ? ref.list : elecCases;
  // 每 MWh 年節電所需投資（萬元/MWh）
  const invPerMwh = median(refList.filter((c) => c.investment_wan > 0).map((c) => c.investment_wan / (c.electricity_kwh / 1000)));

  const kwh = mode === 'device' ? (Number(kw) || 0) * (Number(hours) || 0) * ((Number(rate) || 0) / 100) : Number(kwhDirect) || 0;
  const ef = efYear === 'custom' ? Number(efCustom) || 0 : EF_HISTORY.find((e) => String(e.year) === efYear)?.ef ?? LATEST_EF.value;
  const co2 = (kwh * ef) / 1000;
  const saveWan = (kwh * (Number(price) || 0)) / 1e4;
  const fee = CARBON_FEE_RATES.find((r) => r.key === feeRate).value;
  const feeWan = (co2 * fee) / 1e4;
  const invEst = invPerMwh != null ? invPerMwh * (kwh / 1000) : null;
  const invUsed = inv !== '' ? Number(inv) : invEst;
  const payback = invUsed != null && saveWan > 0 ? invUsed / saveWan : null;
  const paybackFee = invUsed != null && saveWan + feeWan > 0 ? invUsed / (saveWan + feeWan) : null;

  // 10 年推估：電力係數每年下降 decline%
  const projection = useMemo(() => {
    const yearly = Array.from({ length: 10 }, (_, i) => {
      const e = ef * (1 - decline / 100) ** i;
      return { year: `第${i + 1}年`, ef: e, co2: (kwh * e) / 1000, flat: (kwh * ef) / 1000 * (i + 1) };
    });
    return yearly.map((y, i) => ({ ...y, cum: yearly.slice(0, i + 1).reduce((s, v) => s + v.co2, 0) }));
  }, [kwh, ef, decline]);

  const scatter = elecCases.filter((c) => c.co2_t > 0).map((c) => ({ x: c.electricity_kwh, y: c.co2_t, c }));
  const efMarker = EF_HISTORY.find((e) => String(e.year) === efYear);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <Card className="xl:col-span-2" title="輸入條件" subtitle="填入貴公司設備資料，或直接輸入年節電量。">
          <div className="space-y-3">
            <Segmented value={mode} onChange={setMode} options={[{ value: 'device', label: '由設備估算' }, { value: 'direct', label: '直接輸入年節電量' }]} />
            {mode === 'device' ? (
              <div className="grid grid-cols-3 gap-2">
                <Field label="設備功率" unit="kW" value={kw} onChange={setKw} />
                <Field label="年運轉時數" unit="小時" value={hours} onChange={setHours} hint="全年 24h 約 8,760" />
                <Field label="節能率" unit="%" value={rate} onChange={setRate} />
              </div>
            ) : (
              <Field label="年節電量" unit="kWh/年" value={kwhDirect} onChange={setKwhDirect} />
            )}
            <div className="grid grid-cols-2 gap-2">
              <Field label="平均電價" unit="元/kWh" value={price} onChange={setPrice} hint="114 年台電平均約 3.45" />
              <label className="block">
                <span className="text-[13px] text-slate-600">電力排碳係數</span>
                <div className="mt-1 flex gap-2">
                  <select value={efYear} onChange={(e) => setEfYear(e.target.value)} className="h-9 rounded-lg border border-brand-line bg-white px-2 text-sm flex-1 min-w-0">
                    {[...EF_HISTORY].reverse().map((e) => <option key={e.year} value={e.year}>{e.roc}年度 {e.ef}</option>)}
                    <option value="custom">自訂</option>
                  </select>
                  {efYear === 'custom' && <input type="number" step="0.001" value={efCustom} onChange={(e) => setEfCustom(e.target.value)} className={`${numIn} !w-20`} />}
                </div>
                <span className="text-[11px] text-slate-400">kgCO2e/kWh，經濟部能源署公告</span>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select label="參考技術" value={sub} onChange={setSub} className="col-span-2"
                options={[{ value: '', label: `全部節電案例（${elecCases.length}）` }, ...subOptions.map((o) => ({ value: o.sub, label: `${o.sub}（${o.list.length}）` }))]} />
              <Field label="投資金額（選填）" unit="萬元" value={inv} onChange={setInv}
                hint={invEst != null ? `未填則依參考案例估 ${fmtWan(invEst)}（每 MWh/年 約 ${fmtNum(invPerMwh, 2)} 萬元）` : '參考案例不足'} />
              <label className="block">
                <span className="text-[13px] text-slate-600">碳費費率</span>
                <select value={feeRate} onChange={(e) => setFeeRate(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-brand-line bg-white px-2 text-sm">
                  {CARBON_FEE_RATES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
                <span className="text-[11px] text-slate-400">僅年排放 2.5 萬公噸以上須繳</span>
              </label>
            </div>
          </div>
        </Card>

        <div className="xl:col-span-3 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Kpi icon={Zap} label="年節電量" value={fmtNum(kwh)} unit="kWh" note={`約 ${fmtNum(kwh / 1000, 1)} MWh`} />
            <Kpi icon={Leaf} label="年減碳量" value={fmtNum(co2, 1)} unit="公噸CO2e" note={`係數 ${ef} kgCO2e/kWh`} />
            <Kpi icon={Coins} label="年電費節省" value={fmtWan(saveWan)} />
            <Kpi icon={Receipt} label="年碳費節省" value={fmtWan(feeWan)} note={`以 ${fee} 元/公噸計`} />
            <Kpi icon={Calculator} label="投資金額" value={fmtWan(invUsed)} note={inv === '' ? '參考案例估算' : '自行輸入'} />
            <Kpi icon={Timer} label="簡單回收年限" value={fmtYears(payback)} note={`含碳費節省：${fmtYears(paybackFee)}`} />
          </div>
          <div className="card p-4 bg-slate-900 border-slate-700 text-slate-200 font-mono text-[13px] leading-7">
            <div className="text-slate-400 text-xs mb-1 font-sans">計算式</div>
            {mode === 'device' && <div>年節電量 = {fmtNum(Number(kw))} kW × {fmtNum(Number(hours))} h × {rate}% = <b className="text-amber-300">{fmtNum(kwh)} kWh</b></div>}
            <div>年減碳量 = {fmtNum(kwh)} kWh × {ef} kgCO2e/kWh ÷ 1,000 = <b className="text-emerald-300">{fmtNum(co2, 1)} 公噸CO2e</b></div>
            <div>年電費節省 = {fmtNum(kwh)} kWh × {price} 元 = <b className="text-sky-300">{fmtWan(saveWan)}</b></div>
            <div>回收年限 = {fmtWan(invUsed)} ÷（{fmtWan(saveWan)} + 碳費 {fmtWan(feeWan)}）= <b className="text-white">{fmtYears(paybackFee)}</b></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="歷年電力排碳係數" subtitle="同樣節省 1 度電，2017 年可減 0.554 公斤、2024 年只剩 0.474 公斤：電網越乾淨，節電的「減碳」效益越小，但省電費不變。">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <LineChart data={EF_HISTORY} margin={{ top: 16, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" tick={AXIS_TICK} tickLine={false} />
                <YAxis domain={[0.44, 0.58]} tick={AXIS_TICK} width={44} tickLine={false} axisLine={false} />
                <Tooltip content={({ active, payload }) => (active && payload?.length ? (
                  <TipBox title={`${payload[0].payload.year}（民國 ${payload[0].payload.roc} 年度）`} rows={[['電力排碳係數', `${payload[0].payload.ef} kgCO2e/kWh`]]} />
                ) : null)} />
                <Line dataKey="ef" stroke="#2a78d6" strokeWidth={2} dot={{ r: 4, fill: '#2a78d6', stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
                {efMarker && <ReferenceDot x={efMarker.year} y={efMarker.ef} r={7} fill="#eb6834" stroke="#fff" strokeWidth={2}
                  label={{ value: `計算用 ${efMarker.ef}`, position: 'left', offset: 12, fontSize: 11, fill: '#334155' }} />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="彙編案例：年節電量 × 年減碳量" subtitle="兩條斜虛線為係數 0.554（上）與 0.474（下）；落在線上的是純節電案例，偏離者含蒸汽、燃料節省或係數不同。">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <ScatterChart margin={{ top: 14, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" scale="log" domain={[1e4, 1e8]} ticks={[1e4, 1e5, 1e6, 1e7, 1e8]} allowDataOverflow
                  tickFormatter={(v) => (v >= 1e4 ? `${v / 1e4}萬` : v)} tick={AXIS_TICK} name="年節電 kWh" />
                <YAxis type="number" dataKey="y" scale="log" domain={[1, 1e5]} ticks={[1, 10, 100, 1e3, 1e4, 1e5]} allowDataOverflow
                  tickFormatter={(v) => fmtNum(v)} tick={AXIS_TICK} width={56} />
                {[0.554, 0.474].map((k) => (
                  <ReferenceLine key={k} ifOverflow="hidden" stroke="#94a3b8" strokeDasharray="5 4"
                    segment={[{ x: 1e4, y: (1e4 * k) / 1000 }, { x: 1e8, y: (1e8 * k) / 1000 }]}
                  />
                ))}
                <Tooltip content={({ active, payload }) => (active && payload?.length ? (
                  <TipBox title={payload[0].payload.c.tech_name} rows={[
                    ['年節電', `${fmtNum(payload[0].payload.x)} kWh`],
                    ['年減碳', fmtTon(payload[0].payload.y)],
                    ['原文係數', payload[0].payload.c.emission_factor ?? '—'],
                    ['隱含係數', `${fmtNum((payload[0].payload.y * 1000) / payload[0].payload.x, 3)} kg/kWh`],
                  ]} footer={payload[0].payload.c.doc_title} />
                ) : null)} />
                <Scatter data={scatter} fill={CATEGORY_COLOR['節能']} fillOpacity={0.8} stroke="#fff" strokeWidth={1} isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="10 年減碳推估" subtitle="假設電網排碳係數每年持續下降，同一項節電措施每年的減碳量會遞減；藍線為逐年減碳量，虛線為係數不變時的對照。"
        right={<label className="flex items-center gap-2 text-[13px] text-slate-600">係數年降幅
          <input type="range" min={0} max={6} step={0.5} value={decline} onChange={(e) => setDecline(Number(e.target.value))} className="accent-brand w-28" />
          <span className="num font-bold w-10">{decline}%</span></label>}>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <LineChart data={projection} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="year" tick={AXIS_TICK} tickLine={false} />
              <YAxis tick={AXIS_TICK} width={52} tickLine={false} axisLine={false} tickFormatter={(v) => fmtNum(v)} />
              <Tooltip content={({ active, payload }) => (active && payload?.length ? (
                <TipBox title={payload[0].payload.year} rows={[
                  ['當年係數', `${fmtNum(payload[0].payload.ef, 3)} kg/kWh`],
                  ['當年減碳', fmtTon(payload[0].payload.co2)],
                  ['累計減碳', fmtTon(payload[0].payload.cum)],
                ]} />
              ) : null)} />
              <ReferenceLine y={co2} stroke="#94a3b8" strokeDasharray="5 4" label={{ value: '係數不變', position: 'insideTopRight', fontSize: 10, fill: '#64748b' }} />
              <Line dataKey="co2" stroke="#2a78d6" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <Note>10 年累計減碳約 <b>{fmtTon(projection[9]?.cum)}</b>（係數不變時為 {fmtTon(co2 * 10)}）。電費節省不受係數影響；碳費、碳盤查與 CBAM 計算請以當年度公告係數為準。</Note>
      </Card>
    </div>
  );
}
