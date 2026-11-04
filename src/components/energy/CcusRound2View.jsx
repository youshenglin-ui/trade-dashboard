// ==========================================
// CCUS 第二次調查（115.09.24 發放）：供需匹配（CCS Hub 意願）＋產業人力供需
// ==========================================
// 資料：src/lib/energy/ccusRound2.js（Supabase ccus_r2_*）。個別廠資料對外引用請去識別化。
import React, { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ClipboardList, Factory, GraduationCap, Handshake, Users } from 'lucide-react';
import { Badge, Card, DataTable, ErrorBlock, Kpi, LoadingBlock, Segmented } from './ui';
import {
  BASIS_CODES, CAPTURE_ORDER, CAPTURE_RANGE, CONC_CODES, COST_BANDS, EMISSION_CODES, SHARE_VALUE, STAGES,
  TEMP_CODES, TIMING_ORDER, UNIT_CODES, countBy, fetchCcusRound2,
} from '../../lib/energy/ccusRound2';

const AXIS_TICK = { fontSize: 12, fill: '#64748b' };
const BAR = '#0f766e';

function HBar({ data, height, color = BAR, unit = '家' }) {
  return (
    <div style={{ height: height || Math.max(140, data.length * 34 + 30) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} />
          <YAxis type="category" dataKey="name" width={130} tick={AXIS_TICK} />
          <Tooltip formatter={(v) => [`${v} ${unit}`, '']} />
          <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const shareCell = (v) => {
  if (!v) return <span className="text-slate-300">—</span>;
  const n = SHARE_VALUE[v] ?? 0;
  const bg = n === 0 ? 'bg-slate-100 text-slate-500' : n >= 75 ? 'bg-emerald-600 text-white' : n >= 50 ? 'bg-emerald-400 text-white' : 'bg-emerald-100 text-emerald-800';
  return <span className={`inline-block min-w-[52px] text-center px-1.5 py-0.5 rounded text-xs font-bold ${bg}`}>{v}</span>;
};

const isScan = (r) => (r.comment || '').includes('掃描檔');

function SupplyPanel({ plants, units }) {
  const known = plants.filter((p) => CAPTURE_RANGE[p.capture_volume]);
  const lo = known.reduce((s, p) => s + CAPTURE_RANGE[p.capture_volume][0], 0);
  const hi = known.reduce((s, p) => s + CAPTURE_RANGE[p.capture_volume][1], 0);
  const willing = plants.filter((p) => COST_BANDS.some((b) => SHARE_VALUE[p[b.key]] > 0)).length;
  const unitsByPlant = useMemo(() => {
    const m = new Map();
    units.forEach((u) => m.set(u.plant_key, [...(m.get(u.plant_key) || []), u]));
    return m;
  }, [units]);

  // 各成本區間：願意自付者平均比例（不參與計 0）、參與家數
  const wtp = COST_BANDS.map((b) => {
    const ans = plants.filter((p) => p[b.key]);
    const vals = ans.map((p) => SHARE_VALUE[p[b.key]] ?? 0);
    return { name: b.label, 平均自付比例: ans.length ? Math.round(vals.reduce((a, c) => a + c, 0) / ans.length) : 0, 參與家數: vals.filter((v) => v > 0).length, 作答家數: ans.length };
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="回收廠區" value={plants.length} unit="廠" note={`鋼鐵 ${plants.filter((p) => p.industry === '鋼鐵').length}／水泥 ${plants.filter((p) => p.industry === '水泥').length}／石化 ${plants.filter((p) => p.industry === '石化').length}`} />
        <Kpi label="可投入 CO₂（勾選區間加總）" value={`${lo}–${hi}`} unit="萬噸/年" note={`${known.length} 廠有填量體；台塑石化麥寮勾選 ≥100 萬噸，以下限 100 計`} />
        <Kpi label="113 年範疇一合計" value={Math.round(plants.reduce((s, p) => s + (Number(p.scope1_wan_t) || 0), 0)).toLocaleString()} unit="萬噸" note="廠商自填，單位誤填已依盤查量級校正" />
        <Kpi label="有自付意願的廠區" value={willing} unit="廠" note="任一成本區間願自行負擔 >0%" />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card title="預估每年可投入量" icon={Factory}><HBar data={countBy(plants, (p) => p.capture_volume || '未填', [...CAPTURE_ORDER, '未填'])} /></Card>
        <Card title="可開始投入時間"><HBar data={countBy(plants, (p) => p.start_timing || '未填', [...TIMING_ORDER, '未填'])} /></Card>
        <Card title="推動 CCUS 主要阻礙" subtitle="複選"><HBar data={countBy(plants, (p) => p.barriers)} color="#b45309" /></Card>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <Card title="與樞紐交接方式"><HBar data={countBy(plants, (p) => p.handover || '未填')} color="#1d4ed8" /></Card>
        <Card title="運輸方式偏好"><HBar data={countBy(plants, (p) => p.transport_pref || '未填')} color="#1d4ed8" /></Card>
        <Card title="捕捉成本掌握程度／每噸成本預估">
          <HBar data={countBy(plants, (p) => p.cost_knowledge || '未填')} color="#7c3aed" height={150} />
          <HBar data={countBy(plants, (p) => (p.cost_estimate ? `預估 ${p.cost_estimate}` : null))} color="#a78bfa" height={150} />
        </Card>
      </div>

      <Card title="捕捉成本 vs 自行負擔意願（運輸封存由政府／樞紐負責）" icon={Handshake}
        subtitle="平均自付比例：作答廠區平均，不參與計 0%。參考：碳費一般費率 300 元/噸；國內試驗型捕捉約 2,800–3,500 元/噸。">
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={wtp} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={AXIS_TICK} />
              <YAxis tick={AXIS_TICK} unit="%" domain={[0, 100]} />
              <Tooltip formatter={(v, k, { payload }) => [k === '平均自付比例' ? `${v}%（${payload.參與家數}/${payload.作答家數} 廠參與）` : v, k]} />
              <Bar dataKey="平均自付比例" fill={BAR} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3">
          <DataTable rows={plants} rowKey={(r) => r.plant_key} maxHeight={480} columns={[
            { key: 'company', label: '廠區', render: (r) => <span className="font-bold">{r.company}<span className="text-slate-400 font-normal">｜{r.plant}</span>{isScan(r) && <Badge tone="amber" title="掃描 PDF，勾選辨識不完整">待確認</Badge>}</span> },
            ...COST_BANDS.map((b) => ({ key: b.key, label: b.label, align: 'center', render: (r) => shareCell(r[b.key]), sortValue: (r) => SHARE_VALUE[r[b.key]] ?? -1 })),
          ]} />
        </div>
      </Card>

      <Card title="廠區明細與主要排放單元煙道氣性質" icon={ClipboardList} subtitle="排放單元以問卷代碼回填；量體、濃度、溫度為區間。">
        <DataTable rows={plants} rowKey={(r) => r.plant_key} maxHeight={560}
          initialSort={{ key: 'scope1_wan_t', dir: 'desc' }}
          columns={[
            { key: 'company', label: '公司／廠區', render: (r) => <div><div className="font-bold">{r.company}</div><div className="text-[11px] text-slate-500">{r.plant}・{r.county}</div></div> },
            { key: 'industry', label: '產業' },
            { key: 'scope1_wan_t', label: '範疇一(萬噸)', align: 'right', sortValue: (r) => (r.scope1_wan_t == null ? null : Number(r.scope1_wan_t)), render: (r) => (r.scope1_wan_t != null ? Number(r.scope1_wan_t).toLocaleString() : '—') },
            { key: 'units', label: '主要排放單元', sortValue: (r) => (unitsByPlant.get(r.plant_key) || []).length, render: (r) => (
              <div className="space-y-0.5 text-[11px]">
                {(unitsByPlant.get(r.plant_key) || []).map((u) => (
                  <div key={u.id}><b>{UNIT_CODES[u.unit_code] || u.unit_code}</b>{u.unit_note ? `（${u.unit_note}）` : ''}
                    <span className="text-slate-500"> {[EMISSION_CODES[u.emission_code], CONC_CODES[u.conc_code] && `CO₂ ${CONC_CODES[u.conc_code]}`, TEMP_CODES[u.temp_code], BASIS_CODES[u.basis_code]].filter(Boolean).join('・')}</span></div>
                ))}
              </div>) },
            { key: 'capture_volume', label: '可投入量', sortValue: (r) => CAPTURE_ORDER.indexOf(r.capture_volume) },
            { key: 'start_timing', label: '時程' },
            { key: 'handover', label: '交接方式' },
            { key: 'comment', label: '意見', render: (r) => <span className="text-[11px] text-slate-600">{r.comment}</span> },
          ]} />
      </Card>
    </div>
  );
}

function HrPanel({ hr, jobs }) {
  const sumYr = (y) => hr.reduce((s, r) => s + (r[`base_${y}`] ?? r[`cons_${y}`] ?? r[`opt_${y}`] ?? 0), 0);
  const demand = [116, 117, 118].map((y) => ({ name: `${y}年`, value: sumYr(y) }));
  const methodScore = useMemo(() => {
    const m = new Map();
    hr.forEach((r) => [[r.method_rank_1, 3], [r.method_rank_2, 2], [r.method_rank_3, 1]].forEach(([k, w]) => k && m.set(k, (m.get(k) || 0) + w)));
    return [...m].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [hr]);
  const jobsByStage = STAGES.map((s) => ({ name: s, value: jobs.filter((j) => j.stage === s).length })).filter((d) => d.value);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="回收公司" value={hr.length} unit="家" note={`總就業 ${hr.reduce((s, r) => s + (r.employees || 0), 0).toLocaleString()} 人（背景資料）`} />
        <Kpi label="目前尚無 CCUS 專責人力" value={hr.filter((r) => r.no_dedicated).length} unit="家" note={`專職合計 ${hr.reduce((s, r) => s + (r.ccus_fulltime || 0), 0)} 人、兼任 ${hr.reduce((s, r) => s + (r.ccus_parttime || 0), 0)} 人`} />
        <Kpi label="116–118 年新增職缺" value={demand.reduce((s, d) => s + d.value, 0)} unit="人" note="以持平情境為主（僅填保守者採保守）" />
        <Kpi label="尚在評估、無法提供數字" value={hr.filter((r) => r.evaluating).length} unit="家" />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card title="CCUS 新增職缺（逐年）" icon={Users}><HBar data={demand} unit="人" height={150} /></Card>
        <Card title="人才供需狀況（全公司）"><HBar data={countBy(hr, (r) => r.talent_status || '未填')} color="#b45309" height={150} /></Card>
        <Card title="新增人力來源" subtitle="複選"><HBar data={countBy(hr, (r) => r.sources)} color="#1d4ed8" height={150} /></Card>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <Card title="受訓後將負責之業務" subtitle="複選" icon={GraduationCap}><HBar data={countBy(hr, (r) => r.training_areas)} color="#7c3aed" /></Card>
        <Card title="希望政府資助之培育方式" subtitle="加權分數：第一順位 3 分、第二 2 分、第三 1 分"><HBar data={methodScore} color={BAR} unit="分" /></Card>
        <Card title="人才欠缺原因" subtitle="複選"><HBar data={countBy(hr, (r) => r.shortage_reasons)} color="#b45309" /></Card>
      </div>

      <Card title="填報之 CCUS 職務需求與任職門檻" subtitle={`共 ${jobs.length} 項職務；環節分布：${jobsByStage.map((d) => `${d.name} ${d.value}`).join('、')}`}>
        <DataTable rows={jobs} rowKey={(r) => r.id} columns={[
          { key: 'company', label: '公司' },
          { key: 'stage', label: '環節', render: (r) => <Badge tone="blue">{r.stage}</Badge> },
          { key: 'title', label: '職務／主要業務' },
          { key: 'field', label: '學類' },
          { key: 'degree', label: '學歷' },
          { key: 'experience', label: '年資' },
          { key: 'difficulty', label: '招募', render: (r) => <Badge tone={r.difficulty === '困難' ? 'rose' : 'slate'}>{r.difficulty}</Badge> },
          { key: 'n', label: '116/117/118', align: 'center', render: (r) => (r.n116 == null ? '未填' : `${r.n116}/${r.n117}/${r.n118}`) },
        ]} />
      </Card>

      <Card title="各公司填答摘要">
        <DataTable rows={hr} rowKey={(r) => r.company} maxHeight={520} columns={[
          { key: 'company', label: '公司', render: (r) => <span className="font-bold">{r.company}{isScan(r) && <Badge tone="amber">待確認</Badge>}</span> },
          { key: 'industry', label: '產業' },
          { key: 'employees', label: '總就業', align: 'right' },
          { key: 'outlook', label: '營運展望' },
          { key: 'cur', label: 'CCUS 現有人力', render: (r) => (r.no_dedicated ? '尚無專責' : `專職 ${r.ccus_fulltime ?? 0}／兼任 ${r.ccus_parttime ?? 0}`) },
          { key: 'need', label: '新增需求 116/117/118', render: (r) => {
            const s = r.base_116 != null ? 'base' : r.cons_116 != null ? 'cons' : r.opt_116 != null ? 'opt' : null;
            return s ? `${r[`${s}_116`]}/${r[`${s}_117`]}/${r[`${s}_118`]}${s === 'cons' ? '（保守）' : ''}` : (r.evaluating ? '評估中' : '—');
          } },
          { key: 'comment', label: '意見', render: (r) => <span className="text-[11px] text-slate-600">{r.comment}</span> },
        ]} />
      </Card>
    </div>
  );
}

export default function CcusRound2View() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [part, setPart] = useState('supply');
  const load = () => { setError(null); fetchCcusRound2().then(setData).catch((e) => setError(e.message)); };
  useEffect(load, []);
  if (error) return <ErrorBlock message={error} onRetry={load} />;
  if (!data) return <LoadingBlock text="讀取第二次調查資料…" />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">115 年第二次調查（115.09.24 發放、10 月回收），環境部 CCUS 旗艦計畫。個別廠資料僅供內部規劃，對外請去識別化彙整；掃描檔回覆標示「待確認」者勾選項目未完整辨識。</p>
        <Segmented value={part} onChange={setPart} options={[{ value: 'supply', label: '供需匹配（CCS Hub）' }, { value: 'hr', label: '產業人力供需' }]} />
      </div>
      {part === 'supply' ? <SupplyPanel plants={data.plants} units={data.units} /> : <HrPanel hr={data.hr} jobs={data.jobs} />}
    </div>
  );
}
