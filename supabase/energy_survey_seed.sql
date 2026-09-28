-- ==========================================
-- 氫能 / CCUS 參考資料（原本寫死在前端元件裡的數值）
-- ==========================================
-- 要調整數值直接改資料表（Supabase Dashboard > Table Editor）或改這個檔案後重跑；
-- 全部 on conflict do update，可重複執行。

-- ---------- 參考參數 ----------
insert into energy_ref_parameters (key, domain, label, value, unit, category, sort_order, note, source) values
  ('h2_ci_smr_ref',        'hydrogen', '天然氣重組',   12.5, 'kgCO2e/kgH2', 'h2_intensity_benchmark', 10, '12–13 區間中點', '原氫能戰情室參考線'),
  ('h2_ci_methanol_ref',   'hydrogen', '甲醇裂解',     11.5, 'kgCO2e/kgH2', 'h2_intensity_benchmark', 20, '11–12 區間中點', '原氫能戰情室參考線'),
  ('h2_ci_ng_psa_ref',     'hydrogen', 'NG+PSA',        6.9, 'kgCO2e/kgH2', 'h2_intensity_benchmark', 30, null, '原氫能戰情室參考線'),
  ('h2_ci_std_us_kr',      'hydrogen', '美/韓低碳氫標準', 4.0, 'kgCO2e/kgH2', 'h2_intensity_standard', 40, null, '原氫能戰情室參考線'),
  ('h2_ci_std_jp_eu',      'hydrogen', '日(3.4)/歐(3.38)標準', 3.4, 'kgCO2e/kgH2', 'h2_intensity_standard', 50, null, '原氫能戰情室參考線'),
  ('h2_density_kg_per_nm3','hydrogen', '氫氣密度',     0.08988, 'kg/Nm3', 'conversion', 100, '問卷 kNm³ 換算萬噸用', '112原始問卷_各產業'),
  ('co2_density_kg_per_m3','ccus',     'CO2 密度',     1.977, 'kg/m3', 'conversion', 100, '聯華氣體捕捉量換算用', '已裝置捕捉 備註'),
  ('ccus_ccs_lcoc_ntd_t',  'ccus',     'CCS 均化成本初估', 3000, '元/噸', 'cost_benchmark', 200, '要點初估', 'CCUS 總覽 判讀重點4'),
  ('ccus_iea_pipe_land',   'ccus',     '陸地管線運輸成本', 3, 'USD/噸/100km', 'cost_benchmark', 210, 'IEA 2023：約 2–4', '原 CCUS 戰情室說明文字'),
  ('ccus_iea_pipe_offshore','ccus',    '離岸管線運輸成本', 4.5, 'USD/噸/100km', 'cost_benchmark', 220, 'IEA 2023：約 3–6', '原 CCUS 戰情室說明文字'),
  ('ccus_iea_ship_base',   'ccus',     '海運起步成本', 17.5, 'USD/噸', 'cost_benchmark', 230, 'IEA 2023：約 15–20（含液化/港口）', '原 CCUS 戰情室說明文字')
on conflict (key) do update set domain = excluded.domain, label = excluded.label, value = excluded.value, unit = excluded.unit,
  category = excluded.category, sort_order = excluded.sort_order, note = excluded.note, source = excluded.source;

-- ---------- CCU 產品 → 貿易稅號 ----------
insert into ccus_product_hs_map (product, hs_code, trade_name, match_note) values
  ('液化CO2',        '281121', '其他二氧化碳', null),
  ('LCO2',           '281121', '其他二氧化碳', null),
  ('醋酸',           '291521', '醋酸（乙酸）', null),
  ('聚碳酸酯中間產物', '390740', '聚碳酸樹脂，初級狀態', '以下游產品聚碳酸酯(PC)價格參考，非中間產物本身'),
  ('碳酸鈣',         '283650', '碳酸鈣', '貿易資料庫目前未收錄此稅號'),
  ('碳酸二甲酯(DMC)', '292090', '其他無機酸酯', '貿易資料庫目前未收錄此稅號；DMC 歸 2920.90'),
  ('轉爐底吹',       null, null, '廠內製程用途，無對應產品'),
  ('雨生紅球藻(微藻養殖)', null, null, '示範計畫，無對應稅號')
on conflict (product) do update set hs_code = excluded.hs_code, trade_name = excluded.trade_name, match_note = excluded.match_note;

-- ---------- 封存場址（問卷「封存與其他」）與管網規劃樞紐（原 INITIAL_CCS_HUBS） ----------
insert into ccus_storage_sites (site_id, name, kind, site_type, region, lat, lon, capacity_raw, capacity_wt, start_year, status, operator_plant_id, note, source, sort_order) values
  ('S_TIEZHENSHAN', '中油苗栗鐵砧山碳封存試驗場域', 'storage', '陸地封存', '中區', 24.45, 120.68, '30萬噸(10萬噸/年)', 10, 2026, '規劃 2026–2028 封存', null,
     '旗艦問卷投入意願：台塑化否(自行開發)、中鋼否(研發平台)、台電否(自有場址)、台泥否(運輸及環評法規)', '115旗艦供需匹配問卷題幹', 10),
  ('S_TAIPOWER_TAIXI', '台電台中電廠自有封存(台西盆地)', 'storage', '自有封存', '中區', 24.21, 120.48, '0.2萬噸/年，2028年啟用', 0.2, 2028, '規劃中', 'C02',
     '預期營運2年、投入20億元、攤提11年、CO2純度≧99.5%', '115年環境部CCUS旗艦計畫供需匹配調查', 20),
  ('S_FPCC_TAIXI', '台塑化自行開發封存(台西盆地)', 'storage', '自有封存', '中區', 23.80, 120.10, '評估中', null, null, '評估中', 'P01',
     '全價值鏈整合', '115年環境部CCUS旗艦計畫供需匹配調查', 30),
  ('S_AUSTRALIA', '澳洲海域封存(跨境)', 'storage', '跨境封存', '境外', null, null, '150｜海運｜85', null, null, '數值意義待確認', 'X04',
     '114工作表1 中鋼小港廠列：欄位標題缺漏，推測為量/方式/成本', '問卷回收情況(1140422)-繪圖板.xlsx', 40),
  ('NORTH_HUB', '台北港/林口 (陸地轉海域)', 'hub', '本土外海封存', '北區', 25.14, 121.32, null, null, null, '規劃假設', null, '管網規劃樞紐（可在規劃地圖拖曳調整）', '原 CCUS 戰情室設定', 100),
  ('CENTRAL_HUB_1', '台中港接收站 (陸地轉海域)', 'hub', '本土外海封存', '中區', 24.25, 120.45, null, null, null, '規劃假設', null, '管網規劃樞紐', '原 CCUS 戰情室設定', 110),
  ('CENTRAL_HUB_2', '麥寮外海 (陸地轉海域)', 'hub', '本土外海封存', '中區', 23.80, 120.10, null, null, null, '規劃假設', null, '管網規劃樞紐', '原 CCUS 戰情室設定', 120),
  ('CENTRAL_HUB_LAND', '苗栗鐵砧山 (陸地封存)', 'hub', '陸地封存場域', '中區', 24.45, 120.68, null, null, null, '規劃假設', null, '管網規劃樞紐', '原 CCUS 戰情室設定', 130),
  ('SOUTH_HUB', '高雄港接收站 (輸出轉運)', 'hub', '港口接收轉運', '南區', 22.55, 120.32, null, null, null, '規劃假設', null, '南部無封存點，需船運或管線往中北部', '原 CCUS 戰情室設定', 140),
  ('EAST_HUB', '花蓮港接收站 (輸出北送)', 'hub', '港口接收轉運', '東區', 23.98, 121.62, null, null, null, '規劃假設', null, '管網規劃樞紐', '原 CCUS 戰情室設定', 150),
  ('SOUTHEAST_HUB', '台東接收站 (南迴轉運)', 'hub', '港口接收轉運', '南區', 22.75, 121.15, null, null, null, '規劃假設', null, '管網規劃樞紐', '原 CCUS 戰情室設定', 160)
on conflict (site_id) do update set name = excluded.name, kind = excluded.kind, site_type = excluded.site_type, region = excluded.region,
  lat = excluded.lat, lon = excluded.lon, capacity_raw = excluded.capacity_raw, capacity_wt = excluded.capacity_wt, start_year = excluded.start_year,
  status = excluded.status, operator_plant_id = excluded.operator_plant_id, note = excluded.note, source = excluded.source, sort_order = excluded.sort_order;

-- ---------- 管線規劃聚落節點（原 INITIAL_CLUSTERS） ----------
insert into ccus_network_nodes (node_id, name, lat, lon, next_node_id, transport) values
  ('C_KEE_PORT', '基隆港轉運站', 25.15, 121.74, 'NORTH_HUB', 'sea'),
  ('C_TPE', '北北基聚落', 25.05, 121.45, 'NORTH_HUB', 'land'),
  ('C_TYN_IN', '桃園內陸聚落', 24.95, 121.25, 'C_TYN_COAST', 'land'),
  ('C_TYN_COAST', '桃園沿海聚落', 25.05, 121.10, 'NORTH_HUB', 'land'),
  ('C_HSZ', '新竹聚落', 24.80, 121.00, 'C_TYN_IN', 'land'),
  ('C_MIA', '苗栗聚落', 24.55, 120.80, 'CENTRAL_HUB_LAND', 'land'),
  ('C_TXG', '台中聚落', 24.20, 120.60, 'CENTRAL_HUB_1', 'land'),
  ('C_CHW_N', '彰北聚落', 24.10, 120.45, 'CENTRAL_HUB_1', 'land'),
  ('C_CHW_S', '彰南聚落', 23.95, 120.35, 'CENTRAL_HUB_2', 'land'),
  ('C_YUN_IN', '雲林內陸聚落', 23.75, 120.45, 'CENTRAL_HUB_2', 'land'),
  ('C_CYI', '嘉義聚落', 23.45, 120.30, 'C_YUN_IN', 'land'),
  ('C_TNN', '台南聚落', 23.10, 120.25, 'C_KHH_N', 'land'),
  ('C_KHH_IN', '高雄內陸(大樹等)', 22.70, 120.40, 'C_KHH_N', 'land'),
  ('C_KHH_N', '北高雄(仁武大社)', 22.72, 120.35, 'SOUTH_HUB', 'land'),
  ('C_KHH_S', '南高雄(林園大發)', 22.53, 120.38, 'SOUTH_HUB', 'land'),
  ('C_PTG', '屏東聚落', 22.50, 120.45, 'C_KHH_S', 'land'),
  ('C_YIL', '宜蘭聚落', 24.70, 121.75, 'NORTH_HUB', 'sea'),
  ('C_HUA', '花蓮聚落', 23.98, 121.60, 'C_KEE_PORT', 'sea'),
  ('C_TTT', '台東聚落', 22.75, 121.14, 'SOUTH_HUB', 'sea')
on conflict (node_id) do update set name = excluded.name, lat = excluded.lat, lon = excluded.lon,
  next_node_id = excluded.next_node_id, transport = excluded.transport;
