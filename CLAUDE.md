# trade-dashboard

貿易/氫能/CCUS 戰情室儀表板。React 19 + Vite (rolldown-vite) + Tailwind + Recharts。

## 工作流程

- **改完程式碼後直接 commit + push 到 GitHub，不用每次先問。** 這是使用者明確要求的標準流程，因為
  GitHub repo 已（或即將）連接 Vercel 的自動部署，push 到 `main` 就會自動上線。
  例外：若變更未經瀏覽器驗證過（功能明顯可能壞掉）、或使用者當下明確要求先不要 push，才暫緩。
  一律不使用 `--force`、不改寫已推送的歷史。
- 資料同步：`npm run sync-data`（把 Google Sheet 抓成本地 CSV，見 `scripts/data-sources.config.mjs`）
- 資料庫匯入（遷移到 Supabase 後）：`npm run db:import`，需要 `.env` 設定 `SUPABASE_DB_URL`

## 架構現況（2026-09 起逐步遷移中）

專案正在做「漸進式重構」，不是重寫，順序：**資料庫 → 地圖 → 響應式設計**。

1. **資料庫**：從公開 Google Sheet 遷移到 Supabase（PostgreSQL）。schema 見 `supabase/schema.sql`，
   匯入腳本 `scripts/import-to-supabase.mjs`。過渡期間 `public/data/*.csv`（本地同步快照）仍是
   前端實際讀取的來源，Supabase 匯入先在背景驗證，等資料與 API 都穩定後才切換前端 fetch 目標。
2. **地圖**：CCUS 戰情室現有的手刻 SVG 地圖（座標寫死、手算縮放）之後要換成 MapLibre GL JS
   （向量地圖、原生支援縮放時標籤密度自動調整），目前尚未動工。
3. **響應式設計**：目前手機版數字看不清楚，需要重新設計資訊架構（拆分桌面版/手機版元件），
   不是單純加 media query，目前尚未動工。

## 資料來源

Google Sheet 的實際連結只存在於 `scripts/data-sources.config.mjs`（Node-only，不會被打包進前端）。
前端一律透過 `src/config/dataSources.js` 讀本地路徑，不要在元件裡寫死 Google Sheet 網址。
