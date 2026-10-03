# 製造業低碳技術資料（data/lowcarbon）

| 檔案 | 內容 | 怎麼產生 |
|---|---|---|
| `snapshot.json` | 爬蟲快照：書目（21 本 PDF）、企業減碳案例、低碳製程技術資料庫（含典型案例效益） | `npm run crawl:lowcarbon`（GitHub Actions 每月 1 日自動跑並提交） |
| `cases.csv` | **從 PDF 擷取的案例明細**（投資、節能量、減碳量、回收年限…），網站分析的主資料 | 人工＋AI 擷取（見下方流程） |
| `../../public/data/lowcarbon/lowcarbon-database.xlsx` | 網站提供下載的完整 Excel | `npm run export:lowcarbon` |

資料庫：`supabase/lowcarbon.sql`（`lowcarbon_documents` / `lowcarbon_cases` / `lowcarbon_articles` /
`lowcarbon_techs` / `lowcarbon_crawl_runs`），前端只讀。

## 每月自動檢查會做什麼

`.github/workflows/crawl-lowcarbon.yml`：

1. 爬取官網書目、企業減碳案例、技術資料庫，與上次快照比對。
2. 官網有、但 `cases.csv` 還沒有的 PDF ＝「待擷取」。有待擷取 PDF、新企業案例或新技術時，自動開 GitHub Issue
   （標籤 `lowcarbon-update`）。
3. 書目／企業案例／技術資料庫有增減時，送出「寫入 Supabase」核准請求（Environment `carbonfee-crawl`）。

**PDF 裡的案例數值不會自動寫入**——各年度彙編版面、單位、表格格式差異很大，規則式解析錯誤率太高，
所以首批 256 筆與之後的新報告都採「AI 讀 PDF → 人工抽查 → 匯入」。

## 收到 Issue 後：擷取新報告

開一個 Claude 工作階段，貼上 Issue 內容並說「依 data/lowcarbon/README.md 擷取這幾本」。流程：

1. 下載 PDF（Issue 內有連結），用 PyMuPDF 取文字（`pdftotext` 缺中文字型包會變空白）；
   字型編碼亂碼的頁面改成渲染 PNG 後以圖片判讀。
2. 每個技術案例一列，依 `cases.csv` 既有欄位填寫：
   - `case_id`：`<doc_id 前 8 碼>-p<頁碼>-<該頁第幾案>`，`doc_id` 用 Issue 列出的完整 doc_id。
   - `category`：節能／燃料／製程／其他（餘熱回收歸**節能**、電氣化歸**燃料**）；`subcategory` 盡量沿用既有子類。
   - 數值單位：投資、年效益＝**萬元**；年減碳＝**公噸CO2e/年**；節電＝kWh/年；回收＝年。
     原文是區間就填中位值並另填 `_min` / `_max`；原文文字保留在 `*_text` 欄位，方便日後查核。
   - `emission_factor`：原文採用的電力係數（有寫才填）。
   - `case_key`：同一個案例在其他年度彙編也出現時填相同的 key（例：`公司-技術簡稱`），統計時只算最新版。
   - **不要**填寫廠商聯絡人、電話、Email。
3. 檢查：`npm run db:import-lowcarbon -- --dry-run`（會檢查數值欄位、必要欄位、case_id 重複，並列出各書筆數）。
4. 匯入：`npm run db:import-lowcarbon`（需 `.env` 的 `SUPABASE_DB_*`；整批替換 `lowcarbon_cases`）。
   `--catalog` 會一併用 `snapshot.json` 更新書目／企業案例／技術資料庫。
5. 更新下載檔：`npm run export:lowcarbon`，連同 `cases.csv` 一起 commit，然後關閉 Issue。

## 加入創新技術

創新／新興技術（示範或試驗階段）用同一個 `cases.csv` 格式加入，`category` 填 **創新**、`subcategory` 填技術名稱類型
（例：氫能煉鋼、電熱窯爐、碳捕捉），`doc_title` 寫資料來源（文獻、示範計畫）。匯入後會自動出現在減碳成本曲線與類別分析中，
作為與傳統技術（節能、燃料、製程）的單位減碳成本對照。

## 計算定義

集中在 `src/lib/lowcarbon/metrics.js`（類別、色票、電力係數、投資強度、投資攤提成本、年化減碳成本、回收年限）、
`src/lib/lowcarbon/lcoa.js`（技術類型加權平均、資料年代權重、典型範圍與可信度）與
`src/lib/lowcarbon/simulator.js`（工廠減碳模擬：產業／廠型／製程節點、AIoT 監控／產線聯控／全廠調度假設），要改定義只改那裡。
