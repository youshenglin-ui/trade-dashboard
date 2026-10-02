// 貿易「國家分析」共用計算：各國進出口彙總、佔比、依目前檢視（出口/進口/總額/順逆差 × 金額/重量）取值。
// 金額單位：trade_records 的千美元（見 CLAUDE.md）。

const isExportType = (t) => String(t || '').includes('出') || t === 'E';

export const VIEW_OPTIONS = [
  { value: '出口', label: '出口' },
  { value: '進口', label: '進口' },
  { value: 'total', label: '進出口總額' },
  { value: 'balance', label: '順逆差' },
];

export const viewLabel = (view) => VIEW_OPTIONS.find((o) => o.value === view)?.label || view;

// rows: filteredData（每列 { country, type, value, weight }）→ 各國彙總 + 佔比
export function buildCountryRows(rows) {
  const map = new Map();
  rows.forEach((d) => {
    const key = d.country || '未知';
    if (!map.has(key)) map.set(key, { country: key, exportValue: 0, importValue: 0, exportWeight: 0, importWeight: 0 });
    const m = map.get(key);
    if (isExportType(d.type)) { m.exportValue += d.value || 0; m.exportWeight += d.weight || 0; }
    else { m.importValue += d.value || 0; m.importWeight += d.weight || 0; }
  });
  const list = [...map.values()];
  const tot = list.reduce((a, r) => ({
    exportValue: a.exportValue + r.exportValue, importValue: a.importValue + r.importValue,
    exportWeight: a.exportWeight + r.exportWeight, importWeight: a.importWeight + r.importWeight,
  }), { exportValue: 0, importValue: 0, exportWeight: 0, importWeight: 0 });
  const share = (v, t) => (t > 0 ? v / t : 0);
  return {
    totals: tot,
    rows: list.map((r) => {
      const totalValue = r.exportValue + r.importValue;
      const totalWeight = r.exportWeight + r.importWeight;
      return {
        ...r,
        totalValue, totalWeight,
        tradeBalance: r.exportValue - r.importValue,
        tradeBalanceWeight: r.exportWeight - r.importWeight,
        avgExportPrice: r.exportWeight > 0 ? (r.exportValue * 1000) / r.exportWeight : null,
        avgImportPrice: r.importWeight > 0 ? (r.importValue * 1000) / r.importWeight : null,
        exportShare: share(r.exportValue, tot.exportValue),
        importShare: share(r.importValue, tot.importValue),
        totalShare: share(totalValue, tot.exportValue + tot.importValue),
        exportShareW: share(r.exportWeight, tot.exportWeight),
        importShareW: share(r.importWeight, tot.importWeight),
        totalShareW: share(totalWeight, tot.exportWeight + tot.importWeight),
      };
    }),
  };
}

// 依目前檢視取值（順逆差可為負）
export function viewValue(row, view, metric) {
  const w = metric === 'weight';
  if (view === '出口') return w ? row.exportWeight : row.exportValue;
  if (view === '進口') return w ? row.importWeight : row.importValue;
  if (view === 'balance') return w ? row.tradeBalanceWeight : row.tradeBalance;
  return w ? row.totalWeight : row.totalValue;
}

// 依目前檢視的佔比（順逆差沒有佔比意義，回傳總額佔比）
export function viewShare(row, view, metric) {
  const w = metric === 'weight';
  if (view === '出口') return w ? row.exportShareW : row.exportShare;
  if (view === '進口') return w ? row.importShareW : row.importShare;
  return w ? row.totalShareW : row.totalShare;
}

export const sortByView = (rows, view, metric) =>
  [...rows].sort((a, b) => Math.abs(viewValue(b, view, metric)) - Math.abs(viewValue(a, view, metric)));

// 千美元 → 易讀字串（億美元 / 萬美元）
export function fmtUsdK(v) {
  const n = Number(v) || 0;
  const a = Math.abs(n);
  if (a >= 1e5) return `${(n / 1e5).toFixed(2)} 億美元`;
  if (a >= 10) return `${(n / 10).toLocaleString(undefined, { maximumFractionDigits: 0 })} 萬美元`;
  return `${(n * 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} 美元`;
}

export function fmtKg(v) {
  const n = Number(v) || 0;
  const a = Math.abs(n);
  if (a >= 1e7) return `${(n / 1e7).toFixed(2)} 萬公噸`;
  if (a >= 1e3) return `${(n / 1e3).toLocaleString(undefined, { maximumFractionDigits: 0 })} 公噸`;
  return `${n.toLocaleString()} 公斤`;
}

export const fmtMetric = (v, metric) => (metric === 'weight' ? fmtKg(v) : fmtUsdK(v));
export const fmtPct = (x, d = 1) => (x == null || !isFinite(x) ? '—' : `${(x * 100).toFixed(d)}%`);

// 集中度：前 n 名佔比與 HHI（0–10000）
export function concentration(rows, key, n = 3) {
  const vals = rows.map((r) => r[key] || 0).filter((v) => v > 0).sort((a, b) => b - a);
  const total = vals.reduce((a, b) => a + b, 0);
  if (!total) return { topN: 0, hhi: 0 };
  return {
    topN: vals.slice(0, n).reduce((a, b) => a + b, 0) / total,
    hhi: Math.round(vals.reduce((a, v) => a + ((v / total) * 100) ** 2, 0)),
  };
}

export const hhiLabel = (hhi) => (hhi >= 2500 ? '高度集中' : hhi >= 1500 ? '中度集中' : '分散');

export { isExportType };
