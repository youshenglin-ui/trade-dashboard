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
- 前端 Supabase 連線（`src/lib/supabaseClient.js`）內建公開的專案網址與 anon key 預設值
  （anon key 本來就會出現在瀏覽器，安全靠 RLS 唯讀），Vercel 沒設 `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY` 也能運作；有設則以環境變數為準。2026-09 曾因 Vercel 漏設導致整站白屏。
  service_role key、資料庫密碼絕對不可寫進前端程式碼。
- Vercel 有兩個專案都接這個 repo：`trade-dashboard`（部署需登入 Vercel）與 `trade-dashboard-ekbz`
  （公開網址 https://trade-dashboard-ekbz.vercel.app）。注意 `trade-dashboard.vercel.app` 是別人的網站。

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
   氫能/CCUS 已改讀「問卷整併資料庫」，見下方〈氫能 / CCUS 問卷整併資料庫〉一節；
   `energy_facility_records` 現在只剩 CCUS 規劃地圖用的範疇一排放源（category = 'ccus_scope1'）在用。
   注意 `trade_records.value_ntd_thousand` 欄名寫「千元台幣」，但以醋酸/PC/CO2 行情驗證實際是
   **千美元**（金額×1000÷重量 kg ≈ USD/kg），新功能顯示單價一律標 USD/kg。
   已知效能限制：前端目前是「全量抓取 45 萬列再篩選」，載入約 40-50 秒，比原本讀本地 CSV
   還慢，下一步要把篩選/聚合邏輯搬進資料庫查詢（RPC）才能真正做到快速查詢。
2. **地圖**：2026-09-28 起 CCUS 與氫能地圖已改用 MapLibre GL JS。共用底圖 `src/components/map/MapLibreBase.jsx`
   （動態 import maplibre-gl；底圖 OpenFreeMap positron，樣式 JSON 自己抓並有逾時，失敗就退回「純色底＋縣市界」
   備援樣式）、常數與 GeoJSON 小工具在 `src/components/map/mapUtils.js`（`REGION_BOUNDS` 北中南東範圍）。
   縣市界已簡化並放在 `public/data/tw-county.geo.json`，拉丁字 glyph 放在 `public/fonts`——**不要改回依賴外部
   字型／sprite**：這些請求若卡住，MapLibre 會一直等而整層圖層畫不出來（已踩過）。中文字由瀏覽器本機字型繪製。
   資料都轉成 GeoJSON 圖層、標籤交給 MapLibre 自動避讓；CCUS 的拖曳（樞紐、聚落、管線節點、海運/陸運控制點）、
   點管線新增節點、點節點開選單、右鍵刪除都在 `CcusDashboard.jsx` 的 `TaiwanCcusMap` 用 map 事件實作
   （事件只註冊一次，透過 `stateRef` 取最新資料）。無頭瀏覽器測試需加 `--use-angle=swiftshader` 才有 WebGL。
3. **響應式設計**：2026-09 起進行中，採「風格 B 淨零跨域」（色票與字型在 `tailwind.config.js` 的
   `brand` 與 `index.css` 的 `.card` / `.seg` / `.tab-btn`）。版面外框在 `src/components/layout/AppChrome.jsx`：
   電腦版左側功能列、手機版上方標題列 + 底部導覽列（貿易／氫能／CCUS／碳費／更多）。模組清單在
   `src/config/modules.js`。貿易模組已改為分段篩選、分頁與手機可左右滑動圖表（`ScrollableChart`）；
   CCUS 已拆成五個分頁（案場與管線規劃／價值鏈總覽／捕捉與再利用／封存與成本／排放源清單，定義在
   `CcusDashboard.jsx` 的 `CCUS_TABS`），沿用原本的地圖與表格元件；氫能也拆成五個分頁（供需總覽／結構分析／碳排強度／區域解析／原始資料，
   `HydrogenDashboard.jsx` 的 `H2_TABS`）；碳費拆成四個分頁（總覽／產業與地區／減量措施／計畫明細，
   `CarbonFeeDashboard.jsx` 的 `CF_TABS`），手機版計畫明細為卡片、明細改為底部抽屜。地圖拖曳已改用 pointer
   事件，手機可單指平移。
   可安裝到手機主畫面（PWA）：`public/manifest.webmanifest` + `public/icons/`（圖示由 `public/brand/nz-mark.png` 產生），
   `index.html` 內有 apple-touch-icon 等 meta；目前沒有 service worker（避免舊版快取造成更新不到）。

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

## 氫能 / CCUS 問卷整併資料庫（2026-09 新增）

- 來源：台綜院整併的兩本 Excel（工業部門氫氣供需問卷整併 112–115、工業部門負碳(CCUS)問卷整併 112–115）。
  原始 Excel 含聯絡窗口個資，**不進 git**（`data/energy/*.xlsx` 在 .gitignore），放本機即可。
- 資料表：`supabase/energy_survey.sql`（schema）、`energy_survey_load.sql`（寫入函式）、
  `energy_survey_seed.sql`（參考參數、CCU 產品稅號對照、封存場址/管網樞紐、管線聚落節點）。兩層設計：
  - 完整保存層 `survey_imports` / `survey_sheet_rows`：兩本 Excel 每張工作表每一列原樣存 jsonb，
    **不開放前端讀取**（RLS 無 anon policy），只在 Supabase Dashboard 看。確保「所有資料都有寫入」。
  - 分析層（公開唯讀）：`energy_plants`、`h2_production` / `h2_usage` / `h2_flows` / `h2_future_plans`、
    `ccus_emission_sources`（含煙氣溫壓濃度，原文 + 解析值）/ `ccus_capture_units` / `ccus_plans` /
    `ccus_utilization`、`survey_answers`（成本財務、意願障礙、減碳策略、人才）、`survey_assistance_requests`。
    每列另有 `raw jsonb` 存該列原文。view：`v_h2_plant_balance`、`v_ccus_product_trade_price`（USD/kg）。
- 匯入：`npm run db:import-energy -- --h2 <氫能.xlsx> --ccus <CCUS.xlsx>`（`--dry-run` 只解析；
  `--out x.json` 另存 payload）。流程：`scripts/lib/energy-survey-parse.mjs` 解析 → 合併
  `data/energy/plant_coords.csv` 座標 → 呼叫資料庫函式 `energy_survey_load(payload)`（單一交易、
  整批替換；此函式只給 postgres/service_role 執行）。問卷改版時先 `--dry-run` 看「找不到欄位」警告，
  再改 parse 檔裡的 `TABLES` 對應。沒列在 `TABLES` 的分頁也一定會進完整保存層。
- 廠區座標：`node scripts/geocode-energy-plants.mjs <氫能.xlsx> <CCUS.xlsx>` 用 OpenStreetMap
  Nominatim 把廠區主檔地址轉座標，寫 `data/energy/plant_coords.csv`；人工校正的列 `coord_source=manual`
  不會被覆蓋（資料庫端也一樣）。麥寮六輕、中鋼、台電台中等已人工校正。
- 前端：資料讀取 `src/lib/energy/fetchEnergySurvey.js`，計算定義集中在 `src/lib/energy/energyMetrics.js`
  （例如 `toLegacyHydrogen()` 把問卷表組回氫能戰情室既有圖表的資料形狀、`ccusSummary()` 對應問卷
  「總覽」分頁），色票 `src/lib/energy/palette.js`。新頁面在 `src/components/energy/`
  （CCUS 整合地圖/碳捕捉/碳封存/碳再利用、氫能「問卷深度分析」），共用疊圖地圖
  `src/components/maps/TaiwanLayerMap.jsx`（只吃 props，介面改版時可直接搬）。碳費區域地圖
  `src/components/CarbonFeeMap.jsx`（carbonfee_facilities 目前沒有座標，先放縣市中心示意位置）。
- 氫能戰情室不再有寫死的備用數字（MOCK）、公司名關鍵字推估座標/工業區；碳排參考線讀
  `energy_ref_parameters`。CCUS 規劃地圖的樞紐/聚落節點讀 `ccus_storage_sites`(kind='hub') /
  `ccus_network_nodes`，範疇一排放源讀 `energy_facility_records`，座標優先用 `ccus_emission_records`
  已查證的地址座標。
- 跨計畫提醒：產發署（製造部門淨零轉型）與環境部（CCUS 旗艦）屬不同委辦計畫，圖表以「計畫」欄區分，
  對外引用請分開呈現。

## 資料來源

Google Sheet 的實際連結只存在於 `scripts/data-sources.config.mjs`（Node-only，不會被打包進前端）。
氫能/CCUS 前端改讀 Supabase 問卷整併資料表（見上一節），不要再改回讀本地 CSV 或在元件裡寫死數值。
貿易資料前端改讀 Supabase，不要再改回讀本地 CSV 或 Google Sheet。
