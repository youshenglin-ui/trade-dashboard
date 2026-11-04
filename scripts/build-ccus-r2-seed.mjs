// 由 data/energy/ccus_r2_*.csv 產生 supabase/ccus_survey_r2_seed.sql（整批替換）。
// 用法：node scripts/build-ccus-r2-seed.mjs，再於 Supabase SQL Editor 執行產出的 SQL。
import fs from 'node:fs';
const parse = (f) => {
  const [head, ...lines] = fs.readFileSync(`data/energy/${f}`, 'utf8').trim().split('\n');
  const cols = head.split(',');
  return lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v.trim()])));
};
const ARR = new Set(['barriers', 'sources', 'shortage_reasons', 'training_areas']);
const BOOL = new Set(['no_dedicated', 'evaluating']);
const NUM = /^(scope1_wan_t|employees|ccus_|opt_|base_|cons_|n11|seq|emission_code|conc_code|temp_code|pressure_code|basis_code)/;
const lit = (k, v) => {
  if (v === '' || v == null) return BOOL.has(k) ? 'false' : 'null';
  if (BOOL.has(k)) return v === '1' ? 'true' : 'false';
  if (ARR.has(k)) return `array[${v.split('|').map((s) => `'${s.replace(/'/g, "''")}'`).join(',')}]::text[]`;
  if (NUM.test(k) && /^-?[\d.]+$/.test(v)) return v;
  if (NUM.test(k)) return 'null';
  return `'${v.replace(/'/g, "''")}'`;
};
const ins = (table, rows) => rows.map((r) =>
  `insert into ${table} (${Object.keys(r).join(',')}) values (${Object.entries(r).map(([k, v]) => lit(k, v)).join(',')});`).join('\n');
const sql = ['begin;', 'delete from ccus_r2_units; delete from ccus_r2_plants; delete from ccus_r2_hr_jobs; delete from ccus_r2_hr;',
  ins('ccus_r2_plants', parse('ccus_r2_plants.csv')), ins('ccus_r2_units', parse('ccus_r2_units.csv')),
  ins('ccus_r2_hr', parse('ccus_r2_hr.csv')), ins('ccus_r2_hr_jobs', parse('ccus_r2_hr_jobs.csv')), 'commit;'].join('\n');
fs.writeFileSync('supabase/ccus_survey_r2_seed.sql', sql + '\n');
console.log('wrote supabase/ccus_survey_r2_seed.sql');
