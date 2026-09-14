// ==========================================
// 資料來源設定 (伺服器端 / 建置腳本專用)
// ==========================================
// 這裡是所有 Google Sheet 的「唯一真實來源」設定。
// 只有 scripts/sync-data.mjs 會讀這個檔案，不會被打包進前端 JS，
// 所以 Google Sheet 的實際連結不會出現在瀏覽器看得到的原始碼裡。
//
// 要更新資料：
//   1. 在 Google Sheet 裡改好資料（需維持「發布到網路」狀態）
//   2. 執行 `npm run sync-data`，會把下面每一筆來源抓成本地 CSV
//      存到 public/data/<outPath>，並自動更新 src/config/dataManifest.json
//   3. 用 `git status` 確認資料變動、commit、部署

const TRADE_ACTIVE_BASE =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQTBhte4P7bzMFSTlYDml3F25Wcr-sYfC7aOWQiePkfid7f2xBR-WUDMN7NAO3Z2e24Po14dqG7ZxnK/pub';
const TRADE_ARCHIVE_BASE =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRzjXsv2ydCw4O_eDQvunQkn1UWxTNaW7ejOaf3EcDrWCZZzTK1i6u6mJ3KSVkowRjaMVNUnYdA45Bx/pub';
const ENERGY_BASE =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ8aZTek-9SoTaK7Z_Wu9InU2c_vu4cUpD0Nn4fCs-w0IM3XoWeNXK5ZldWoEs6M3G6mJTS6QoF4Mo/pub';

const csvUrl = (base, gid) => `${base}?gid=${gid}&single=true&output=csv`;

// key: 前端讀取時會用到的識別碼（同時決定 public/data/ 底下的檔案路徑）
export const DATA_SOURCES = [
  // 貿易資料 - active（聚合格式，逐年更新）
  { key: 'trade/active/2025', url: csvUrl(TRADE_ACTIVE_BASE, 9883438) },
  { key: 'trade/active/2024', url: csvUrl(TRADE_ACTIVE_BASE, 111460997) },
  { key: 'trade/active/2023', url: csvUrl(TRADE_ACTIVE_BASE, 1075035870) },
  { key: 'trade/active/2022', url: csvUrl(TRADE_ACTIVE_BASE, 2046100985) },
  { key: 'trade/active/2021', url: csvUrl(TRADE_ACTIVE_BASE, 1831893040) },
  { key: 'trade/active/2020', url: csvUrl(TRADE_ACTIVE_BASE, 1203579653) },
  { key: 'trade/active/2019', url: csvUrl(TRADE_ACTIVE_BASE, 1828590182) },
  { key: 'trade/active/2018', url: csvUrl(TRADE_ACTIVE_BASE, 892690605) },
  { key: 'trade/active/2017', url: csvUrl(TRADE_ACTIVE_BASE, 127022410) },
  { key: 'trade/active/2016', url: csvUrl(TRADE_ACTIVE_BASE, 723477109) },
  { key: 'trade/active/2015', url: csvUrl(TRADE_ACTIVE_BASE, 1464732954) },

  // 貿易資料 - archive（明細格式，歷史留存）
  { key: 'trade/archive/2022', url: csvUrl(TRADE_ARCHIVE_BASE, 2061649166) },
  { key: 'trade/archive/2021', url: csvUrl(TRADE_ARCHIVE_BASE, 54711180) },
  { key: 'trade/archive/2020', url: csvUrl(TRADE_ARCHIVE_BASE, 698533804) },
  { key: 'trade/archive/2019', url: csvUrl(TRADE_ARCHIVE_BASE, 1407313243) },
  { key: 'trade/archive/2018', url: csvUrl(TRADE_ARCHIVE_BASE, 1693737933) },
  { key: 'trade/archive/2017', url: csvUrl(TRADE_ARCHIVE_BASE, 1940628234) },
  { key: 'trade/archive/2016', url: csvUrl(TRADE_ARCHIVE_BASE, 1951510622) },
  { key: 'trade/archive/2015', url: csvUrl(TRADE_ARCHIVE_BASE, 1882060232) },

  // 氫能供需戰情室
  { key: 'hydrogen/production', url: csvUrl(ENERGY_BASE, 0) },
  { key: 'hydrogen/usage', url: csvUrl(ENERGY_BASE, 687277722) },

  // CCUS 戰情室
  { key: 'ccus/capture', url: csvUrl(ENERGY_BASE, 388581449) },
  { key: 'ccus/utilization', url: csvUrl(ENERGY_BASE, 1496771601) },
  { key: 'ccus/storage', url: csvUrl(ENERGY_BASE, 1902888591) },
  { key: 'ccus/scope1', url: csvUrl(ENERGY_BASE, 2122803569) },
];
