# trade-dashboard

貿易/氫能/CCUS 戰情室儀表板。React 19 + Vite (rolldown-vite) + Tailwind + Recharts。

## 工作流程

- **改完程式碼後直接 commit + push 到 GitHub，不用每次先問。** 這是使用者明確要求的標準流程，因為
  GitHub repo 已（或即將）連接 Vercel 的自動部署，push 到 `main` 就會自動上線。
  例外：若變更未經瀏覽器驗證過（功能明顯可能壞掉）、或使用者當下明確要求先不要 push，才暫緩。
  一律不使用 `--force`、不改寫已推送的歷史。
- 資料同步：`npm run sync-data`（把 Google Sheet 抓成本地 CSV；貿易資料存到 `data/`，
  氫能/CCUS 存到 `public/data/`，見 `scripts/data-sources.config.mjs`）
- 資料庫匯入：`npm run db:import`（讀 `data/trade/*.csv` 匯入 Supabase），需要 `.env` 設定
  `SUPABASE_DB_HOST` / `SUPABASE_DB_PASSWORD` 等（見 `.env.example`，連線用分開欄位而非單一 URI，
  避免密碼特殊符號被解析器誤判）
- Vercel 上要另外設定 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 這兩個環境變數（本機 `.env`
  不會自動同步過去），前端才抓得到資料

## 架構現況（2026-09 起逐步遷移中）

專案正在做「漸進式重構」，不是重寫，順序：**資料庫 → 地圖 → 響應式設計**。

1. **資料庫**：貿易模組已完成遷移並正式上線（2026-09-17）——前端改讀 Supabase
   （`src/lib/fetchTradeRecords.js`），不再 fetch Google Sheet CSV，`data/trade/*.csv` 現在只是
   `sync-data → db:import` 這條匯入管線的中繼檔，不會打包進 `vite build`。schema 見
   `supabase/schema.sql`，匯入邏輯共用 `src/utils/helpers.js` 的 `parseCSV_Safe`（不要在匯入腳本
   裡重寫一份簡化的清洗邏輯，容易跟前端行為對不上——已經踩過這個坑）。
   `trade_records` 對 (source, period, hs_code, country, flow_type) 有唯一鍵，同鍵多筆時匯入腳本
   會加總 value/weight，不是覆蓋。查詢分頁只排有索引的 `id`，active/archive 的優先序改成抓完後
   在前端用穩定排序處理（別在 DB 端對大表排序 + 深分頁，會撞 statement timeout）。
   氫能/CCUS 資料表（`energy_facility_records`）已建好、已匯入，但前端還沒接上，
   仍讀 `public/data/hydrogen`、`public/data/ccus` 本地 CSV。
   已知效能限制：前端目前是「全量抓取 45 萬列再篩選」，載入約 40-50 秒，比原本讀本地 CSV
   還慢，下一步要把篩選/聚合邏輯搬進資料庫查詢（RPC）才能真正做到快速查詢。
2. **地圖**：CCUS 戰情室現有的手刻 SVG 地圖（座標寫死、手算縮放）之後要換成 MapLibre GL JS
   （向量地圖、原生支援縮放時標籤密度自動調整），目前尚未動工。
3. **響應式設計**：目前手機版數字看不清楚，需要重新設計資訊架構（拆分桌面版/手機版元件），
   不是單純加 media query，目前尚未動工。

## 碳費自主減量計畫模組（2026-09 新增）

- 來源：環境部「自主減量計畫公開資訊」https://carbonfee.moenv.gov.tw/front/reductionpublic/list
  （伺服器端渲染 HTML，用 cheerio 解析即可，不需要瀏覽器）。
- 爬蟲：`npm run crawl:carbonfee`（`--dry-run` 只爬不寫、`--from-snapshot <file>` 用既有快照寫入、
  `--force` 跳過防呆）。解析邏輯在 `scripts/lib/carbonfee-parse.mjs`，寫庫/異動比對在
  `scripts/lib/carbonfee-db.mjs`，快照存 `data/carbonfee/snapshot.json`。
- 資料表：`supabase/carbonfee.sql`（plans → facilities → measures，加上 crawl_runs、changes）。
  共同申請案件在官網列表頁只顯示代表事業本身的排放量，計畫整體合計在明細頁 → `list_*` vs `total_*`，
  分析一律用 `total_*`。
- 前端：`src/components/CarbonFeeDashboard.jsx`，資料讀取 `src/lib/fetchCarbonfee.js`，
  指標定義（減量率、規模分級、色票）集中在 `src/lib/carbonfeeMetrics.js`，要改定義只改那裡。
- 排程：`.github/workflows/crawl-carbonfee.yml`，每月第一個週六 09:00（台灣時間）觸發，
  綁定 GitHub Environment `carbonfee-crawl`（Required reviewers），需使用者核准後才執行。
  排程只在預設分支（main）上生效。資料庫連線用 Supabase Session pooler（GitHub runner 不支援 IPv6）。

## 資料來源

Google Sheet 的實際連結只存在於 `scripts/data-sources.config.mjs`（Node-only，不會被打包進前端）。
氫能/CCUS 前端一律透過 `src/config/dataSources.js` 讀本地路徑，不要在元件裡寫死 Google Sheet 網址。
貿易資料前端改讀 Supabase，不要再改回讀本地 CSV 或 Google Sheet。
