// ==========================================
// Supabase (PostgreSQL) 連線設定：碳費、低碳技術彙編爬蟲共用
// ==========================================

// 容錯解析資料庫主機設定：Secrets 常被貼成完整連線字串、https 網址或「主機:埠」，
// 這裡統一拆出 host / port / user，避免因為格式不對而連不上（getaddrinfo ENOTFOUND）。
export function resolveDbConfig(env) {
  let host = (env.SUPABASE_DB_HOST || '').trim();
  let port = (env.SUPABASE_DB_PORT || '').trim();
  let user = (env.SUPABASE_DB_USER || '').trim();
  const password = env.SUPABASE_DB_PASSWORD || '';
  if (/^[a-z]+:\/\//i.test(host)) {
    try {
      const u = new URL(host.replace(/^postgres(ql)?:/i, 'http:'));
      host = u.hostname;
      port = port || u.port;
      if (!user && u.username) user = decodeURIComponent(u.username);
    } catch { /* 交給下面的格式檢查回報 */ }
  }
  const m = /^([^:/\s]+):(\d+)$/.exec(host);
  if (m) { host = m[1]; port = port || m[2]; }
  host = host.replace(/\/.*$/, '');
  return {
    host,
    port: Number(port) || 5432,
    user: user || 'postgres',
    password,
    database: (env.SUPABASE_DB_NAME || '').trim() || 'postgres',
    ssl: env.SUPABASE_DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
  };
}

// 連線失敗時的診斷：只描述格式特徵，不印出實際值（GitHub 也會把 secret 遮成 ***）
export function describeDbConfig(cfg, rawHost) {
  const raw = (rawHost || '').trim();
  return [
    `原始 SUPABASE_DB_HOST 長度 ${raw.length}${raw !== (rawHost || '') ? '（前後有空白，已自動去除）' : ''}`,
    `含「://」：${raw.includes('://') ? '是（已自動拆出主機）' : '否'}`,
    `解析後主機結尾：${cfg.host.endsWith('.pooler.supabase.com') ? '.pooler.supabase.com ✓' : cfg.host.endsWith('.supabase.co') ? '.supabase.co（直連位址只有 IPv6，GitHub Actions 連不到，請改用 Session pooler）' : '不是 Supabase 主機格式 ✗'}`,
    `port ${cfg.port}、user ${cfg.user.startsWith('postgres.') ? 'postgres.<project-ref> ✓' : cfg.user === 'postgres' ? 'postgres（Session pooler 需用 postgres.<project-ref>）' : '格式不符'}`,
  ].join('\n  ');
}
