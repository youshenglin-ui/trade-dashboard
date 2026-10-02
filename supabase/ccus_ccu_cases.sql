-- 國內碳再利用（CCU）／碳捕捉示範案例名錄（2026-10 新增）
-- 問卷只涵蓋目前有回覆的廠區；過去曾公開的示範案場（含已停止、規劃中）整理在這張表，
-- 資料來自問卷整併檔「外部來源補充」「來源比對_待討論」分頁（IDA 產發署談參、CCA 氣候署會議資料、NSTC 國科會）與 115 旗艦問卷。
-- 狀態定義：運轉中＝最近一次資料仍在運轉；停止中＝已知停止或近年無運轉資訊；規劃中＝尚未建置。
create table if not exists ccus_ccu_cases (
  case_id text primary key,
  name text not null,                 -- 案例名稱
  company text,
  plant_id text,                      -- 對應 energy_plants（有的話）
  location text,
  lat numeric,
  lon numeric,
  co2_source text,                    -- CO2 來源／捕捉技術
  product text,                       -- 再利用產品
  hs_code text,                       -- 對應貿易資料庫稅號（可連到貿易頁）
  scale_raw text,                     -- 規模原文
  scale_t numeric,                    -- 代表規模（噸 CO2／年）
  period text,                        -- 時點（原文）
  status text not null,               -- 運轉中 / 停止中 / 規劃中
  status_note text,
  sources text,                       -- 資料來源代號與說明
  sort_order int default 100
);

alter table ccus_ccu_cases enable row level security;
drop policy if exists "public read ccus_ccu_cases" on ccus_ccu_cases;
create policy "public read ccus_ccu_cases" on ccus_ccu_cases for select using (true);

insert into ccus_ccu_cases (case_id, name, company, plant_id, location, lat, lon, co2_source, product, hs_code, scale_raw, scale_t, period, status, status_note, sources, sort_order) values
  ('CSC_STEELCHEM_P1', '中鋼鋼化聯產先導工廠', '中國鋼鐵', 'X04', '高雄市小港區', 22.5447, 120.3566,
     '轉爐氣 PSA 分離捕捉 CO（>98.5%）／CO2（>99.9%）', '甲醇、甲烷', '290511', '減碳 4,900 噸CO2e/年（另 0.17 萬噸 CO2＋0.49 萬噸 CO）', 4900, '2022 起',
     '停止中', '先導工廠，近年無運轉量資訊；與熱風爐碳捕捉測試平台為不同設施，不可相加', 'IDA-1 產發署談參、NSTC-1（來源比對 K8）', 10),
  ('CSC_STEELCHEM_P2', '中鋼鋼化聯產第二階段（醋酸）', '中國鋼鐵', 'X04', '高雄市小港區', 22.5447, 120.3566,
     '轉爐氣捕捉 CO 約 30 萬噸/年', '醋酸 60 萬噸/年', '291521', '減碳 48 萬噸CO2e/年（CCA-3 引中鋼旗艦計畫為 12.5 萬噸）', 480000, '醋酸廠 2029 完工、2030 運轉',
     '規劃中', '減碳量依來源比對 K8 裁示採 IDA-1 的 48 萬噸', 'IDA-1、CCA-3（來源比對 K8）', 20),
  ('CSC_CAPTURE_PLATFORM', '中鋼碳捕捉測試平台（熱風爐化學吸收）', '中國鋼鐵', 'X04', '高雄市小港區', 22.5447, 120.3566,
     '熱風爐煙氣化學吸收法（進氣 CO2 28–30%）', '廠內轉爐底吹（技術評估中）', null, '500 噸/年（淨捕捉 375 噸為申報值）', 500, '2024.10 迄今',
     '運轉中', '定位為研發平台，無法提供穩定捕碳量', '115 旗艦問卷、CCA-2、CCA-3', 30),
  ('TCC_CALCIUM_LOOP', '台泥和平廠鈣迴路碳捕捉＋微藻養殖', '台灣水泥', 'C01', '花蓮縣秀林鄉和平村', 24.30323, 121.75270,
     '水泥窯煙道氣鈣迴路（與工研院合作）', '雨生紅球藻（蝦紅素保健、保養品）', null, '鈣迴路 3,285 噸/年（產發署談參 0.3 萬噸/年；問卷手寫判讀 20 噸）', 3285, '2013 起示範；115 年問卷仍填報',
     '運轉中', '現況捕捉量採約 0.3 萬噸/年（來源比對 K6）；另規劃純氧燃燒 2030 年 10 萬噸', 'CCA-2、IDA-1、115 旗艦問卷（來源比對 K6）', 40),
  ('OUCC_EC', '東聯化學林園廠環氧乙烷尾氣 CO2 再利用', '東聯化學', null, '高雄市林園區（林園石化工業區）', 22.5130, 120.4100,
     '環氧乙烷製程尾氣熱碳酸鹽捕捉（1–3% 提濃至 22–26%）', '碳酸乙烯酯（EC）／碳酸二甲酯（DMC）、界面活性劑原料', null, '捕捉 8–10 萬噸、消耗 3–4 萬噸/年（IDA-1）；2024 年 1.3 萬噸（IDA-3）', 13000, '2024 資料',
     '運轉中', '問卷未涵蓋，量體在各來源差異大（捕捉量 vs 產品減碳量），建議納入 116 年問卷確認', 'IDA-1、IDA-3、NSTC-1（來源比對 K3）', 50),
  ('FPC_RENWU_METHANATION', '台塑仁武廠 CO2 甲烷化示範', '台灣塑膠工業', null, '高雄市仁武區（汽電共生廠）', 22.6990, 120.3480,
     '汽電共生煙道氣醋酸鉀捕捉＋鎳觸媒甲烷化（技術司 A+ 計畫，成大、南台、工研院）', '甲烷', null, 'CO2 30–36 噸/年（甲烷 10–13 噸）', 36, '2024 示範',
     '停止中', '氣候署盤點註記「停止運轉」；產發署參考資料誤植為台塑石化（來源比對 K4）', 'IDA-1、NSTC-1、CCA-3（來源比對 K4）', 60),
  ('RENYI_DEMO', '仁義化工碳捕捉示範（氣候署盤點列「仁儀」）', '仁義化工', null, null, null, null,
     '（未載明）', '（未載明）', null, '70 噸/年', 70, '2026 氣候署盤點',
     '停止中', '僅見於氣候署示範案場盤點，近期無運轉資訊；名稱以「仁儀」列示，待確認', 'CCA-3', 70)
on conflict (case_id) do update set name = excluded.name, company = excluded.company, plant_id = excluded.plant_id, location = excluded.location,
  lat = excluded.lat, lon = excluded.lon, co2_source = excluded.co2_source, product = excluded.product, hs_code = excluded.hs_code,
  scale_raw = excluded.scale_raw, scale_t = excluded.scale_t, period = excluded.period, status = excluded.status,
  status_note = excluded.status_note, sources = excluded.sources, sort_order = excluded.sort_order;
