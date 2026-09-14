// ==========================================
// 資料來源設定（前端用）
// ==========================================
// 這裡只列出「本地檔案路徑」，不含任何 Google Sheet 連結。
// 實際的 Google Sheet 網址只存在於 scripts/data-sources.config.mjs，
// 由 `npm run sync-data` 讀取並產生 public/data/ 底下對應的 CSV 檔，
// 前端一律讀本地檔案，不會在瀏覽器原始碼中暴露試算表連結。
//
// 新增/調整資料來源時，記得同時更新 scripts/data-sources.config.mjs
// （key 要一致），否則 sync-data 不會產生對應檔案。

import manifest from './dataManifest.json';

const localPath = (key) => `/data/${key}.csv`;

export const TRADE_ACTIVE_SOURCES = [
  'trade/active/2025',
  'trade/active/2024',
  'trade/active/2023',
  'trade/active/2022',
  'trade/active/2021',
  'trade/active/2020',
  'trade/active/2019',
  'trade/active/2018',
  'trade/active/2017',
  'trade/active/2016',
  'trade/active/2015',
].map(localPath);

export const TRADE_ARCHIVE_SOURCES = [
  'trade/archive/2015',
  'trade/archive/2016',
  'trade/archive/2017',
  'trade/archive/2018',
  'trade/archive/2019',
  'trade/archive/2020',
  'trade/archive/2021',
  'trade/archive/2022',
].map(localPath);

export const H2_DATA_SOURCES = {
  PRODUCTION: localPath('hydrogen/production'),
  USAGE: localPath('hydrogen/usage'),
};

export const CCUS_DATA_SOURCES = {
  CAPTURE: localPath('ccus/capture'),
  UTILIZATION: localPath('ccus/utilization'),
  STORAGE: localPath('ccus/storage'),
  SCOPE1_URL: localPath('ccus/scope1'),
};

// 最後一次執行 `npm run sync-data` 的時間，可用於在畫面上顯示「資料更新於 ...」
export const DATA_SYNCED_AT = manifest.syncedAt ?? null;
