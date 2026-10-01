// ==========================================
// 碳費事業座標 CSV → Supabase carbonfee_facility_coords
// ==========================================
// 用法：npm run db:import-carbonfee-coords [-- --dry-run]
// 讀 data/carbonfee/facility_coords.csv（由 scripts/geocode-carbonfee.mjs 產生、可人工修改），
// 以管制編號 upsert。資料庫裡已是 coord_source = 'manual' 的列，只會被 CSV 裡同樣是 manual 的列覆蓋。
// 需要 .env 設定 SUPABASE_DB_HOST / SUPABASE_DB_PASSWORD 等（同 npm run db:import）。
import { readFacilityCoords, COORDS_CSV } from './geocode-carbonfee.mjs';

const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const rows = (await readFacilityCoords()).map((r) => ({
    control_no: r.control_no, name: r.name || null, city: r.city || null, address: r.address || null,
    lat: num(r.lat), lon: num(r.lon), coord_source: (r.coord_source || 'not_found').trim(),
    query: r.query || null, matched: (r.matched || '').trim() || null,
  })).filter((r) => r.control_no);
  if (!rows.length) {
    console.error(`${COORDS_CSV} 沒有資料，請先跑 node scripts/geocode-carbonfee.mjs`);
    process.exit(1);
  }
  const bad = rows.filter((r) => r.lat != null && (r.lat < 21 || r.lat > 26.5 || r.lon < 118 || r.lon > 122.5));
  bad.forEach((r) => console.warn(`[座標超出台灣範圍] ${r.control_no} ${r.name}: ${r.lat},${r.lon}`));
  console.log(`CSV ${rows.length} 筆（有座標 ${rows.filter((r) => r.lat != null).length}）`);
  if (dryRun) return;

  await import('dotenv/config');
  const { default: pg } = await import('pg');
  const { SUPABASE_DB_HOST, SUPABASE_DB_PORT, SUPABASE_DB_USER, SUPABASE_DB_PASSWORD, SUPABASE_DB_NAME } = process.env;
  if (!SUPABASE_DB_HOST || !SUPABASE_DB_PASSWORD) {
    console.error('缺少 SUPABASE_DB_HOST / SUPABASE_DB_PASSWORD，請先在 .env 設定（參考 .env.example）。');
    process.exit(1);
  }
  const client = new pg.Client({
    host: SUPABASE_DB_HOST.trim().replace(/^@/, ''), port: Number(SUPABASE_DB_PORT) || 5432, user: SUPABASE_DB_USER || 'postgres',
    password: SUPABASE_DB_PASSWORD, database: SUPABASE_DB_NAME || 'postgres', ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const res = await client.query(
      `insert into carbonfee_facility_coords (control_no, name, city, address, lat, lon, coord_source, query, matched)
       select * from jsonb_to_recordset($1::jsonb) as x(control_no text, name text, city text, address text,
         lat numeric, lon numeric, coord_source text, query text, matched text)
       on conflict (control_no) do update set
         name = excluded.name, city = excluded.city, address = excluded.address, lat = excluded.lat, lon = excluded.lon,
         coord_source = excluded.coord_source, query = excluded.query, matched = excluded.matched, updated_at = now()
       where carbonfee_facility_coords.coord_source <> 'manual' or excluded.coord_source = 'manual'`,
      [JSON.stringify(rows)],
    );
    console.log(`已寫入 carbonfee_facility_coords：${res.rowCount} 筆`);
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
