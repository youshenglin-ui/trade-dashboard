import React, { useState, useEffect } from 'react';
import { LogIn, LogOut, Plus, Pencil, Trash2, Save, X, RefreshCw, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

// ==========================================
// 氫能資料後台管理
// ==========================================
// 給後續持續新增/修正氫能資料用，不用再手動編輯 Google Sheet + 重跑同步腳本。
// 寫入權限交給 Supabase RLS 把關（只有登入過的使用者能新增/編輯/刪除，見
// supabase/hydrogen_records_schema.sql），這個頁面本身只做「未登入時只能看登入表單」
// 這一層 UI 上的門檻，真正的存取控制在資料庫端。
//
// 登入帳號要先在 Supabase Dashboard > Authentication > Users 手動建立
// （刻意不做公開註冊表單，避免任何人都能自行註冊拿到寫入權限）。

const EMPTY_FORM = {
  record_type: 'production',
  company: '',
  plant: '',
  region: '',
  process: '',
  usage_type: '',
  year: new Date().getFullYear(),
  purity: '',
  carbon_intensity: '',
  capacity_tons: '',
  output_tons: '',
  trade_vol: '',
  trade_target: '',
  demand_tons: '',
  source_company: '',
  transport_method: '',
  latitude: '',
  longitude: '',
  note: '',
};

const NUMERIC_FIELDS = [
  'purity', 'carbon_intensity', 'capacity_tons', 'output_tons', 'trade_vol',
  'demand_tons', 'latitude', 'longitude',
];

function toPayload(form) {
  const payload = { ...form };
  NUMERIC_FIELDS.forEach((f) => {
    payload[f] = payload[f] === '' || payload[f] === null ? null : Number(payload[f]);
  });
  payload.year = Number(payload.year);
  if (payload.record_type === 'production') {
    payload.usage_type = null;
    payload.demand_tons = null;
    payload.source_company = payload.source_company || null;
    payload.transport_method = null;
  } else {
    payload.process = null;
    payload.capacity_tons = null;
    payload.output_tons = null;
    payload.trade_target = null;
  }
  return payload;
}

function LoginForm({ onLoggedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    onLoggedIn(data.session);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full max-w-sm space-y-4">
        <div className="flex items-center gap-2 text-slate-800 font-bold text-lg mb-2">
          <ShieldAlert className="text-blue-600" size={22} /> 氫能資料後台登入
        </div>
        <p className="text-xs text-slate-500">帳號需先在 Supabase Dashboard 的 Authentication 建立，這裡不提供自行註冊。</p>
        <div>
          <label className="text-xs font-bold text-slate-500">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2 mt-1" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500">密碼</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2 mt-1" />
        </div>
        {error && <div className="text-rose-600 text-sm bg-rose-50 p-2 rounded">{error}</div>}
        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50">
          <LogIn size={16} className={loading ? 'animate-pulse' : ''} /> {loading ? '登入中...' : '登入'}
        </button>
      </form>
    </div>
  );
}

function RecordForm({ initial, onCancel, onSaved }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isProduction = form.record_type === 'production';

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = toPayload(form);
    const { data: { user } } = await supabase.auth.getUser();
    if (initial?.id) {
      payload.updated_by = user?.id;
      const { error: err } = await supabase.from('hydrogen_records').update(payload).eq('id', initial.id);
      setSaving(false);
      if (err) { setError(err.message); return; }
    } else {
      payload.created_by = user?.id;
      const { error: err } = await supabase.from('hydrogen_records').upsert(payload, {
        onConflict: 'record_type,company,plant,year,process,usage_type',
      });
      setSaving(false);
      if (err) { setError(err.message); return; }
    }
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-800">{initial?.id ? '編輯紀錄' : '新增紀錄'}</h3>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-slate-500">類型</label>
          <select value={form.record_type} onChange={set('record_type')} disabled={!!initial?.id} className="w-full border border-slate-300 rounded px-2 py-1.5 mt-1 disabled:bg-slate-100">
            <option value="production">供給面（產能/產量）</option>
            <option value="usage">需求面（用量）</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500">年度</label>
          <input type="number" required value={form.year} onChange={set('year')} className="w-full border border-slate-300 rounded px-2 py-1.5 mt-1" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500">公司</label>
          <input required value={form.company} onChange={set('company')} className="w-full border border-slate-300 rounded px-2 py-1.5 mt-1" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500">廠區</label>
          <input value={form.plant} onChange={set('plant')} className="w-full border border-slate-300 rounded px-2 py-1.5 mt-1" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500">區域（如：南部）</label>
          <input value={form.region} onChange={set('region')} className="w-full border border-slate-300 rounded px-2 py-1.5 mt-1" />
        </div>
        {isProduction ? (
          <div>
            <label className="text-xs font-bold text-slate-500">製程</label>
            <input value={form.process} onChange={set('process')} className="w-full border border-slate-300 rounded px-2 py-1.5 mt-1" />
          </div>
        ) : (
          <div>
            <label className="text-xs font-bold text-slate-500">用途</label>
            <input value={form.usage_type} onChange={set('usage_type')} className="w-full border border-slate-300 rounded px-2 py-1.5 mt-1" />
          </div>
        )}
        <div>
          <label className="text-xs font-bold text-slate-500">純度</label>
          <input type="number" step="any" value={form.purity} onChange={set('purity')} className="w-full border border-slate-300 rounded px-2 py-1.5 mt-1" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500">單位碳排</label>
          <input type="number" step="any" value={form.carbon_intensity} onChange={set('carbon_intensity')} className="w-full border border-slate-300 rounded px-2 py-1.5 mt-1" />
        </div>

        {isProduction ? (
          <>
            <div>
              <label className="text-xs font-bold text-slate-500">產能（萬噸）</label>
              <input type="number" step="any" value={form.capacity_tons} onChange={set('capacity_tons')} className="w-full border border-slate-300 rounded px-2 py-1.5 mt-1" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">產量（萬噸）</label>
              <input type="number" step="any" value={form.output_tons} onChange={set('output_tons')} className="w-full border border-slate-300 rounded px-2 py-1.5 mt-1" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">外售量（萬噸）</label>
              <input type="number" step="any" value={form.trade_vol} onChange={set('trade_vol')} className="w-full border border-slate-300 rounded px-2 py-1.5 mt-1" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">外售對象</label>
              <input value={form.trade_target} onChange={set('trade_target')} className="w-full border border-slate-300 rounded px-2 py-1.5 mt-1" />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="text-xs font-bold text-slate-500">用量（萬噸）</label>
              <input type="number" step="any" value={form.demand_tons} onChange={set('demand_tons')} className="w-full border border-slate-300 rounded px-2 py-1.5 mt-1" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">外購量（萬噸）</label>
              <input type="number" step="any" value={form.trade_vol} onChange={set('trade_vol')} className="w-full border border-slate-300 rounded px-2 py-1.5 mt-1" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">外購來源公司</label>
              <input value={form.source_company} onChange={set('source_company')} className="w-full border border-slate-300 rounded px-2 py-1.5 mt-1" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">運輸方式</label>
              <input value={form.transport_method} onChange={set('transport_method')} className="w-full border border-slate-300 rounded px-2 py-1.5 mt-1" />
            </div>
          </>
        )}

        <div>
          <label className="text-xs font-bold text-slate-500">緯度</label>
          <input type="number" step="any" value={form.latitude} onChange={set('latitude')} className="w-full border border-slate-300 rounded px-2 py-1.5 mt-1" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500">經度</label>
          <input type="number" step="any" value={form.longitude} onChange={set('longitude')} className="w-full border border-slate-300 rounded px-2 py-1.5 mt-1" />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-bold text-slate-500">備註</label>
          <textarea value={form.note} onChange={set('note')} className="w-full border border-slate-300 rounded px-2 py-1.5 mt-1" rows={2} />
        </div>
      </div>

      {error && <div className="text-rose-600 text-sm bg-rose-50 p-2 rounded">{error}</div>}

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600">取消</button>
        <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white flex items-center gap-2 disabled:opacity-50">
          <Save size={16} /> {saving ? '儲存中...' : '儲存'}
        </button>
      </div>
    </form>
  );
}

const PAGE_SIZE = 20;

function RecordsTable({ recordType, refreshKey, onEdit, onDeleted }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const resetKey = `${recordType}:${refreshKey}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setPage(0);
  }

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, count, error } = await supabase
        .from('hydrogen_records')
        .select('*', { count: 'exact' })
        .eq('record_type', recordType)
        .order('year', { ascending: false })
        .order('company', { ascending: true })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (cancelled) return;
      if (!error) { setRows(data || []); setTotal(count || 0); }
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [recordType, page, refreshKey]);

  const handleDelete = async (id) => {
    if (!window.confirm('確定要刪除這筆紀錄嗎？')) return;
    const { error } = await supabase.from('hydrogen_records').delete().eq('id', id);
    if (error) { window.alert(`刪除失敗: ${error.message}`); return; }
    onDeleted();
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th className="p-3">年度</th>
              <th className="p-3">公司</th>
              <th className="p-3">廠區</th>
              <th className="p-3">區域</th>
              <th className="p-3">{recordType === 'production' ? '製程' : '用途'}</th>
              <th className="p-3 text-right">{recordType === 'production' ? '產量' : '用量'}</th>
              <th className="p-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="p-6 text-center text-slate-400"><RefreshCw className="inline animate-spin mr-2" size={14} />載入中...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-slate-400">目前沒有資料</td></tr>
            ) : rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="p-3">{row.year}</td>
                <td className="p-3 font-medium">{row.company}</td>
                <td className="p-3">{row.plant}</td>
                <td className="p-3">{row.region}</td>
                <td className="p-3">{recordType === 'production' ? row.process : row.usage_type}</td>
                <td className="p-3 text-right font-mono">{recordType === 'production' ? row.output_tons : row.demand_tons}</td>
                <td className="p-3 text-right">
                  <button onClick={() => onEdit(row)} className="text-blue-600 hover:text-blue-800 mr-3"><Pencil size={15} /></button>
                  <button onClick={() => handleDelete(row.id)} className="text-rose-500 hover:text-rose-700"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
        <span>共 {total} 筆</span>
        <div className="flex items-center gap-2">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded border border-slate-300 disabled:opacity-40">上一頁</button>
          <span>{page + 1} / {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded border border-slate-300 disabled:opacity-40">下一頁</button>
        </div>
      </div>
    </div>
  );
}

const HydrogenAdmin = () => {
  const [session, setSession] = useState(undefined); // undefined = 檢查中, null = 未登入
  const [recordType, setRecordType] = useState('production');
  const [editing, setEditing] = useState(null); // null = 未開表單, {} = 新增, {...row} = 編輯
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400"><RefreshCw className="animate-spin mr-2" /> 檢查登入狀態...</div>;
  }
  if (!session) {
    return <LoginForm onLoggedIn={setSession} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800">氫能資料後台管理</h1>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span>{session.user.email}</span>
            <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-1 text-slate-500 hover:text-rose-600">
              <LogOut size={15} /> 登出
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex bg-slate-200 p-1 rounded-lg">
            {[['production', '供給面'], ['usage', '需求面']].map(([val, label]) => (
              <button key={val} onClick={() => setRecordType(val)} className={`px-4 py-1.5 rounded-md text-sm font-bold ${recordType === val ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600'}`}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => setEditing({ record_type: recordType, ...EMPTY_FORM })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">
            <Plus size={16} /> 新增紀錄
          </button>
        </div>

        {editing && (
          <RecordForm
            initial={editing.id ? editing : null}
            key={editing.id || 'new'}
            onCancel={() => setEditing(null)}
            onSaved={() => { setEditing(null); setRefreshKey((k) => k + 1); }}
          />
        )}

        <RecordsTable
          recordType={recordType}
          refreshKey={refreshKey}
          onEdit={(row) => setEditing(row)}
          onDeleted={() => setRefreshKey((k) => k + 1)}
        />
      </div>
    </div>
  );
};

export default HydrogenAdmin;
