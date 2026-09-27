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
- CCUS 排放清冊年度更新：`npm run db:import-ccus-registry <CSV路徑>`，見
  `scripts/import-ccus-emission-records.mjs` 開頭說明（環境部網站沒有批次下載，需手動下載後
  跑這支腳本）
- Vercel 上要另外設定 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 這兩個環境變數（本機 `.env`
  不會自動同步過去），前端才抓得到資料

## 架構現況（2026-09 起逐步遷移中）

專案正在做「漸進式重構」，不是重寫，順序：**資料庫 → 地圖 → 響應式設計**。

1. **資料庫**：
   - **貿易模組**：已完成遷移並正式上線（2026-09-17）——前端改讀 Supabase
     （`src/lib/fetchTradeRecords.js`），不再 fetch Google Sheet CSV，`data/trade/*.csv` 現在只是
     `sync-data → db:import` 這條匯入管線的中繼檔，不會打包進 `vite build`。schema 見
     `supabase/schema.sql`，匯入邏輯共用 `src/utils/helpers.js` 的 `parseCSV_Safe`（不要在匯入腳本
     裡重寫一份簡化的清洗邏輯，容易跟前端行為對不上——已經踩過這個坑）。
     `trade_records` 對 (source, period, hs_code, country, flow_type) 有唯一鍵，同鍵多筆時匯入腳本
     會加總 value/weight，不是覆蓋。查詢改走 `supabase/rpc_search_trade_records.sql` 的
     database-side RPC（`search_trade_records` / `search_trade_records_count` /
     `trade_code_catalog` / `related_products_by_countries`），不再一次抓全表 45 萬列再篩選
     ——早期版本這樣做過，載入要 40-50 秒，比讀本地 CSV 還慢，已淘汰。查詢分頁只排有索引的
     `id`，active/archive 的優先序改成抓完後在前端用穩定排序處理（別在 DB 端對大表排序 +
     深分頁，會撞 statement timeout；`anon`/`authenticated` role 也已設定
     `plan_cache_mode = force_custom_plan` 避免 Postgres 5 次執行後切換成 generic plan 導致
     Seq Scan）。
   - **氫能模組**：已遷移到 Supabase 正規化資料表 `hydrogen_records`（schema 見
     `supabase/hydrogen_records_schema.sql`），前端讀取邏輯在 `src/lib/fetchHydrogenRecords.js`，
     公司名稱簡化/區域校正等顯示層轉換統一在讀取時套用（`src/utils/hydrogenHelpers.js`），資料庫
     只存原始輸入值，新舊資料顯示才會一致。新增了氫能資料後台管理頁
     （`src/components/HydrogenAdmin.jsx`，側欄「氫能資料後台」進入），登入才能寫入
     （Supabase Auth，只能透過 Supabase Dashboard 手動建帳號，沒有自行註冊表單）。
   - **CCUS 模組**：`capture.csv` / `utilization.csv` / `storage.csv` 仍讀
     `public/data/ccus/` 本地檔案（筆數少，暫不急著搬）；管線規劃地圖用的範疇一排放源
     （原本讀 `public/data/ccus/scope1.csv`）也還是這樣讀，維持「單一年度快照」給地圖用，不
     要因為下面這張新表而改動。**新增的 `ccus_emission_records`** 資料表（schema 見
     `supabase/ccus_emission_records_schema.sql`）存的是環境部溫室氣體排放量登錄平台 104-113
     年全部登錄家數（跟 scope1.csv 資料同源，但這張表是「歷年」，用在 CCUS 戰情室的「歷年
     登錄總覽」分頁，見 `src/lib/fetchEmissionRecords.js`），對 (roc_year, control_no) 有唯一鍵。
     這個資料來源**沒有批次下載 API**（該網站是查詢表單，不是資料集），每年更新流程見
     `scripts/import-ccus-emission-records.mjs` 開頭的說明；已設定一個每年 11/1 的排程提醒
     使用者去下載最新清冊。地址/座標目前大多是空的或用公司名關鍵字比對的粗略估計值
     （`getApproximateCoordinates`），只有 `capture.csv` 裡少數已裝 CCUS 的廠區有精確經緯度
     ——政府公開資料本身只到縣市層級，沒有街道地址，要更精確需要另外補資料來源。
2. **地圖**：CCUS 戰情室現有的手刻 SVG 地圖（座標寫死、手算縮放）已經做過幾輪互動優化
   （滑鼠滾輪縮放、縮放時的標籤密度區隔、點擊廠區彈出詳細資訊、樞紐/聚落可拖曳搬遷），但
   底層還是手刻 SVG，還沒換成 MapLibre GL JS（向量地圖、原生支援縮放時標籤密度自動調整）；
   要不要換看未來需求，目前功能面已經堪用。
3. **響應式設計**：整體畫面密度已經拆過一輪（氫能戰情室、CCUS 案場規劃都改成分頁式呈現，
   側欄可收合成純圖示列），但手機版數字看不清楚的問題還沒處理，仍需要重新設計資訊架構
   （拆分桌面版/手機版元件），不是單純加 media query，目前尚未動工。

## 資料來源

Google Sheet 的實際連結只存在於 `scripts/data-sources.config.mjs`（Node-only，不會被打包進前端）。
氫能/CCUS 前端一律透過 `src/config/dataSources.js` 讀本地路徑，不要在元件裡寫死 Google Sheet 網址。
貿易資料前端改讀 Supabase，不要再改回讀本地 CSV 或 Google Sheet。
