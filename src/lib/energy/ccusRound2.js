// 115 年 CCUS 第二次調查（供需匹配＋人力供需）資料讀取與代碼定義
// 資料表：supabase/ccus_survey_r2.sql；原始整理檔：data/energy/ccus_r2_*.csv
import { supabase } from '../supabaseClient';

export const UNIT_CODES = {
  A: '燃煤鍋爐／機組', B: '燃氣鍋爐／發電', C: '加熱爐／熱媒鍋爐', D: '汽電共生鍋爐', E: '高爐熱風爐',
  F: '其他鋼鐵製程', G: '水泥旋窯／石灰窯', H: 'SMR合成氣', I: '製氫尾氣', J: '轉化爐煙道氣', K: '化學品製程副產氣', L: '其他',
};
export const EMISSION_CODES = { 1: '<5萬噸', 2: '5–20萬噸', 3: '20–50萬噸', 4: '50–100萬噸', 5: '≥100萬噸' };
export const CONC_CODES = { 1: '<10%', 2: '10–20%', 3: '20–60%', 4: '60–90%', 5: '≥90%' };
export const TEMP_CODES = { 1: '<100℃', 2: '100–200℃', 3: '200–400℃', 4: '≥400℃' };
export const BASIS_CODES = { 1: '實測', 2: '設計', 3: '估計' };

export const CAPTURE_ORDER = ['<5萬噸', '5–20萬噸', '20–50萬噸', '50–100萬噸', '>100萬噸', '無法評估'];
// 區間中點（萬噸/年），用來粗估可投入量上下限
export const CAPTURE_RANGE = { '<5萬噸': [0, 5], '5–20萬噸': [5, 20], '20–50萬噸': [20, 50], '50–100萬噸': [50, 100], '>100萬噸': [100, 100] };
export const TIMING_ORDER = ['2030年前', '2030–2035年', '2035年後', '無法評估'];
export const COST_BANDS = [
  { key: 'share_lt1500', label: '<1,500 元' },
  { key: 'share_1500_3000', label: '1,500–3,000 元' },
  { key: 'share_3000_5000', label: '3,000–5,000 元' },
  { key: 'share_5000_8000', label: '5,000–8,000 元' },
  { key: 'share_gt8000', label: '>8,000 元' },
];
export const SHARE_VALUE = { 全額: 100, '75%': 75, '50%': 50, '25%': 25, '10%': 10, 不參與: 0 };
export const STAGES = ['共通', '捕捉', '運輸', '利用', '封存'];

let cache;
export function fetchCcusRound2() {
  if (!cache) {
    const get = async (t, order) => {
      const { data, error } = await supabase.from(t).select('*').order(order);
      if (error) throw new Error(`${t} 查詢失敗: ${error.message}`);
      return data || [];
    };
    cache = Promise.all([get('ccus_r2_plants', 'plant_key'), get('ccus_r2_units', 'id'), get('ccus_r2_hr', 'company'), get('ccus_r2_hr_jobs', 'id')])
      .then(([plants, units, hr, jobs]) => ({ plants, units, hr, jobs }))
      .catch((e) => { cache = null; throw e; });
  }
  return cache;
}

export const countBy = (rows, fn, order) => {
  const m = new Map();
  rows.forEach((r) => [].concat(fn(r) ?? []).filter(Boolean).forEach((k) => m.set(k, (m.get(k) || 0) + 1)));
  const keys = order ? order.filter((k) => m.has(k)).concat([...m.keys()].filter((k) => !order.includes(k))) : [...m.keys()].sort((a, b) => m.get(b) - m.get(a));
  return keys.map((k) => ({ name: k, value: m.get(k) }));
};
