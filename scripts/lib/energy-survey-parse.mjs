// ==========================================
// 氫能 / CCUS 問卷整併 Excel → 資料庫 payload
// ==========================================
// 兩層輸出（對應 supabase/energy_survey.sql）：
//   1. rows：每張工作表每一列原樣保存（survey_sheet_rows，後台用）
//   2. 分析表：下方 TABLES 設定把特定工作表的欄位對應到資料表欄位
//
// 問卷格式改版時要改的地方：
//   * 欄名改了 → 改 TABLES 裡對應的欄名字串（找不到的欄會在 warnings 裡列出來）
//   * 新增分頁要進分析表 → 在 TABLES 加一筆；沒加的分頁也一定會進 survey_sheet_rows，不會漏
//   * 表頭列號變了 → 自動偵測（HEADER_HINTS），偵測不到就用 A/B/C 欄代號保存
import ExcelJS from 'exceljs';

// ---------- 儲存格值 / 數值解析 ----------
export function cellValue(v) {
  if (v == null) return null;
  if (typeof v === 'object') {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    // 公式 → 取快取的計算結果；沒有結果代表公式算出空字串（例如 =IF(...,"")），視為空白
    if ('formula' in v || 'sharedFormula' in v) return 'result' in v ? cellValue(v.result) : null;
    if ('result' in v) return cellValue(v.result);
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if ('text' in v) return v.text;                          // 超連結
    if ('error' in v) return null;
    return String(v);
  }
  if (typeof v === 'string') {
    const s = v.replace(/\r\n/g, '\n').trim();
    return s === '' ? null : s;
  }
  return v;
}

const str = (v) => (v == null ? null : String(v).trim() || null);

// 嚴格數值：只接受數字或純數字字串（量體欄位用，避免把「評估中」「文字填列」猜成數字）
export function strictNum(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/,/g, '').trim();
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}

// 寬鬆數值：處理問卷常見寫法 '200-300' → 250、'~110' → 110、'≧90' → 90、'常溫(25)' → 25、'28~30' → 29
export function looseNum(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/,/g, '').replace(/[≒~～約≧≥≦≤<>＞＜]/g, (c) => ('~～'.includes(c) ? '~' : ''));
  const range = s.match(/(-?\d+(?:\.\d+)?)\s*[-~–—至]\s*(\d+(?:\.\d+)?)/);
  if (range) return (Number(range[1]) + Number(range[2])) / 2;
  const one = s.match(/-?\d+(?:\.\d+)?/);
  return one ? Number(one[0]) : null;
}

export function parseTemp(v) {
  const n = looseNum(v);
  if (n != null) return n;
  return /常溫/.test(String(v ?? '')) ? 25 : null;
}

// 壓力換算 bar；unitCol 為 'bar' / 'MPa'，原文可能自帶單位（'0.3 MPa'、'20 bar'、'30mmAq'）
export function parsePressureBar(raw, unitCol) {
  if (raw == null) return null;
  const s = String(raw);
  if (/常壓/.test(s)) return 1.013;
  if (/mmAq/i.test(s)) return 1.013 + (looseNum(s) ?? 0) * 0.0000981; // 錶壓 mmH2O → 絕對壓力近似
  const n = looseNum(s);
  if (n == null) return null;
  const unit = /mpa/i.test(s) ? 'MPa' : /bar/i.test(s) ? 'bar' : unitCol;
  return /mpa/i.test(String(unit || '')) ? n * 10 : n;
}

const yearInt = (v) => {
  const m = String(v ?? '').match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : null;
};
const rocYear = (v) => {
  const n = strictNum(v) ?? Number(String(v ?? '').match(/^\d{3}/)?.[0]);
  return Number.isFinite(n) && n >= 100 && n < 200 ? n : null;
};

// ---------- 工作表讀取 ----------
const HEADER_HINTS = ['年度', '廠區ID', '廠區', '簡稱', '項目', '公司', '產業', '指標', '編號', '#', '來源ID', '調查年度'];
const colLetter = (i) => {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

function readSheet(ws) {
  const rows = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNo) => {
    const values = [];
    for (let c = 1; c <= ws.columnCount; c++) values.push(cellValue(row.getCell(c).value));
    if (values.some((v) => v != null)) rows.push({ rowNo, values });
  });
  return rows;
}

// 表頭 = 前 8 列中第一個「以 HEADER_HINTS 開頭且至少 3 個非空文字欄」的列
function detectHeader(rows) {
  for (const r of rows.slice(0, 8)) {
    const texts = r.values.filter((v) => typeof v === 'string');
    if (texts.length >= 3 && HEADER_HINTS.includes(String(r.values[0] ?? '').trim())) return r;
  }
  return null;
}

function keyedCells(values, header) {
  const cells = {};
  values.forEach((v, i) => {
    if (v == null) return;
    let key = header ? str(header.values[i]) : null;
    if (!key) key = colLetter(i);
    if (key in cells) key = `${key}_${colLetter(i)}`;
    cells[key] = v;
  });
  return cells;
}

// 聯絡窗口等個資欄位：只存在後台完整保存層，不進前端可讀的分析表
const PRIVATE_KEYS = ['最新窗口', '職稱', '電話', 'email', 'Email', '傳真', '姓名', '聯絡(Mail/電話)'];
const stripPrivate = (obj) => Object.fromEntries(Object.entries(obj).filter(([k]) => !PRIVATE_KEYS.includes(k)));

// ---------- 分析表對應 ----------
// 每個 map 函式拿到 g(欄名) 讀值；回傳 null 代表該列不進分析表（例如合計列）
// 廠區ID 需符合代碼格式（P01/X04/C02…），避免把分頁內的小標題列當成資料
const pid = (g, col = '廠區ID') => { const v = str(g(col)); return v && /^[A-Z]\d{2}$/.test(v) ? v : null; };
const splitIssues = (v) => (v ? String(v).split(/[、,，]/).map((s) => s.trim()).filter(Boolean) : []);

function ccusStage(type) {
  const t = String(type || '');
  if (/CCU/.test(t) && !/CCS/.test(t)) return 'utilization';
  if (/CCS|捕捉\+封存/.test(t)) return 'ccs';
  if (/封存/.test(t)) return 'storage';
  if (/捕捉/.test(t)) return 'capture';
  return 'other';
}

export const TABLES = {
  hydrogen: {
    廠區主檔: {
      table: 'energy_plants',
      map: (g, cells) => {
        const id = str(g('廠區ID'));
        if (!id || !/^[A-Z]\d{2}$/.test(id)) return null;
        return {
          plant_id: id, short_name: str(g('簡稱')), company: str(g('公司')), tax_id: str(g('統編')),
          plant_name: str(g('廠區')), factory_reg_no: str(g('工廠登記編號')), address: str(g('詳細地址')),
          county: str(g('縣市')), region: str(g('區域')), zone: str(g('工業區聚落')),
          is_survey_target: id.startsWith('P'),
          responded_years: ['112', '113', '114', '115'].filter((y) => str(cells[y]) === '✓').map(Number),
          note: str(g('備註')), raw: stripPrivate(cells),
        };
      },
    },
    氫氣生產: {
      table: 'h2_production',
      map: (g, cells) => {
        const sy = rocYear(g('年度'));
        if (!sy || !pid(g)) return null;
        return {
          survey_year: sy, data_year: yearInt(g('數據年')), plant_id: str(g('廠區ID')), short_name: str(g('簡稱')),
          production_type: str(g('生產類型')), process_category: str(g('製程分類')), process_raw: str(g('原始製程名稱')),
          output_wt: strictNum(g('產量(萬噸/年)')), max_capacity_wt: strictNum(g('最大產能(萬噸/年)')),
          utilization: strictNum(g('產能利用率')), spare_capacity_wt: strictNum(g('剩餘產能(萬噸/年)')),
          co2_wt: strictNum(g('產氫碳排(萬噸CO2/年)')), intensity_reported: strictNum(g('單位碳排_申報')),
          intensity_calc: strictNum(g('單位碳排_計算')), intensity_used: strictNum(g('採用單位碳排')),
          purity_raw: str(g('純度(%)')), expansion_plan: str(g('擴產計畫')), capture_equipment: str(g('碳捕捉設備')),
          data_nature: str(g('資料性質')), source: str(g('來源')), note: str(g('備註')),
          calibrated_113_wt: strictNum(g('113訪談校正值(萬噸)')), raw: cells,
        };
      },
    },
    氫氣使用: {
      table: 'h2_usage',
      map: (g, cells) => {
        const sy = rocYear(g('年度'));
        if (!sy || !pid(g)) return null;
        return {
          survey_year: sy, data_year: yearInt(g('數據年')), plant_id: str(g('廠區ID')), short_name: str(g('簡稱')),
          usage_category: str(g('用途大類')), usage_subcategory: str(g('用途細類')), process_raw: str(g('原始製程名稱')),
          h2_wt: strictNum(g('用氫量(萬噸/年)')), purity_raw: str(g('純度要求(%)')),
          product_output_wt: strictNum(g('產品產量(萬噸/年)')), product_capacity_wt: strictNum(g('產品最大產能(萬噸/年)')),
          data_nature: str(g('資料性質')), source: str(g('來源')), note: str(g('備註')), raw: cells,
        };
      },
    },
    外購外售起訖: {
      table: 'h2_flows',
      map: (g, cells) => {
        const sy = rocYear(g('年度'));
        if (!sy || !str(g('方向'))) return null;
        return {
          survey_year: sy, data_year: yearInt(g('數據年')), reporter_plant_id: str(g('申報廠區ID')), reporter_name: str(g('申報廠區')),
          direction: str(g('方向')), counterparty_raw: str(g('對象原文')), counterparty_id: str(g('對象推定ID')),
          counterparty_name: str(g('對象推定')), inference_basis: str(g('推定依據')),
          origin_name: str(g('起點(供應方)')), origin_zone: str(g('起點工業區')), dest_name: str(g('訖點(需求方)')), dest_zone: str(g('訖點工業區')),
          volume_wt: strictNum(g('量(萬噸/年)')), transport: str(g('運輸方式')), process: str(g('產氫製程')),
          purity_raw: str(g('純度(%)')), avg_price_ntd_per_kg: strictNum(g('均價(元/kg)')), internal_external: str(g('內外部')),
          data_nature: str(g('資料性質')), source: str(g('來源')), note: str(g('備註')), raw: cells,
        };
      },
    },
    未來規劃: {
      table: 'h2_future_plans',
      map: (g, cells) => {
        if (!pid(g)) return null;
        return {
          survey_year: rocYear(g('年度')), plant_id: str(g('廠區ID')), short_name: str(g('簡稱')), plan_type: str(g('類型')), item: str(g('項目')),
          y2030_raw: str(g('2030(原文)')), y2040_raw: str(g('2040(原文)')), y2050_raw: str(g('2050(原文)')),
          y2030_low: strictNum(g('2030下限')), y2030_high: strictNum(g('2030上限')),
          y2040_low: strictNum(g('2040下限')), y2040_high: strictNum(g('2040上限')),
          y2050_low: strictNum(g('2050下限')), y2050_high: strictNum(g('2050上限')),
          reason: str(g('原因/說明')), trl: str(g('TRL')), start_year_raw: str(g('預估開始年')),
          h2_demand_raw: str(g('氫需求(原文)')), h2_demand_wt: strictNum(g('氫需求(萬噸/年)')),
          co2_reduction_t: strictNum(g('減碳量(噸CO2/年)')), bottleneck: str(g('發展瓶頸')), capacity_other: str(g('產能/其他')),
          source: str(g('來源')), raw: cells,
        };
      },
    },
    減碳政策_115: {
      table: 'survey_answers',
      map: (g, cells) => (pid(g)
        ? { domain: 'hydrogen', sheet: '減碳政策_115', survey_year: 115, plant_id: str(g('廠區ID')), short_name: str(g('簡稱')), answers: cells }
        : null),
    },
    待政府協助: {
      table: 'survey_assistance_requests',
      map: (g) => (str(g('內容(原文)'))
        ? { domain: 'hydrogen', survey_year: rocYear(g('年度')), plant_id: str(g('廠區ID')), short_name: str(g('簡稱')),
            topic: str(g('主題')), content: str(g('內容(原文)')), issues: splitIssues(g('歸納議題')) }
        : null),
    },
  },
  ccus: {
    排放源潛力: {
      table: 'ccus_emission_sources',
      map: (g, cells) => {
        const sy = rocYear(g('年度'));
        if (!sy || !pid(g)) return null;
        const pUnit = str(g('壓力單位'));
        return {
          survey_year: sy, program: str(g('計畫/問卷')), plant_id: str(g('廠區ID')), short_name: str(g('簡稱')),
          company: str(g('公司')), county: str(g('縣市')), source_desc: str(g('排放源/捕捉位置')),
          emission_wt: strictNum(g('排放量(萬噸CO2/年)')),
          temp_raw: str(g('溫度(℃)')), temp_c: parseTemp(g('溫度(℃)')),
          pressure_raw: str(g('壓力')), pressure_unit: pUnit, pressure_bar: parsePressureBar(g('壓力'), pUnit),
          co2_conc_raw: str(g('CO2濃度(%)')), co2_conc_pct: looseNum(g('CO2濃度(%)')),
          transport_pref: str(g('期待運輸方式')), storage_need: str(g('碳封存需求')),
          note: str(g('備註')), source: str(g('來源')), raw: cells,
        };
      },
    },
    已裝置捕捉: {
      table: 'ccus_capture_units',
      map: (g, cells) => {
        const sy = rocYear(g('年度'));
        if (!sy || !pid(g)) return null;
        return {
          survey_year: sy, program: str(g('計畫/問卷')), plant_id: str(g('廠區ID')), short_name: str(g('簡稱')),
          source_process: str(g('排放源/製程')), capture_tech: str(g('捕捉技術')),
          out_temp_raw: str(g('處理後溫度(℃)')), out_pressure_raw: str(g('處理後壓力')), purity_raw: str(g('CO2純度(%)')),
          flow_slpm: strictNum(g('流速(SLPM)')), capture_wt: strictNum(g('捕捉量(萬噸/年)')),
          unit_emission_wt: strictNum(g('捕捉單元排放(萬噸/年)')), net_capture_wt: strictNum(g('淨捕捉量(萬噸/年)')),
          net_ratio: strictNum(g('淨捕捉率')), cost_ntd_per_kg: strictNum(g('捕捉成本(元/kgCO2)')),
          trl: str(g('TRL')), operation_status: str(g('運轉時間')), co2_destination: str(g('CO2流向/去化')),
          note: str(g('備註')), source: str(g('來源')), raw: cells,
        };
      },
    },
    未來規劃: {
      table: 'ccus_plans',
      map: (g, cells) => {
        const sy = rocYear(g('年度'));
        if (!sy || !pid(g)) return null;
        const type = str(g('類型'));
        return {
          survey_year: sy, program: str(g('計畫/問卷')), plant_id: str(g('廠區ID')), short_name: str(g('簡稱')),
          item: str(g('規劃項目/排放源')), plan_type: type, stage: ccusStage(type), new_or_expand: str(g('新增/擴增')),
          start_year_raw: str(g('預期投入年')), start_year: yearInt(g('預期投入年')),
          capacity_wt: strictNum(g('規劃量能(萬噸/年)')), trl: str(g('TRL')), disposal: str(g('去化方式')),
          note: str(g('發展瓶頸/說明')), source: str(g('來源')), raw: cells,
        };
      },
    },
    CCU與去化: {
      table: 'ccus_utilization',
      map: (g, cells) => {
        const sy = rocYear(g('年度'));
        if (!sy || !str(g('產品'))) return null;
        return {
          survey_year: sy, program: str(g('計畫/問卷')), plant_id: str(g('廠區ID')), short_name: str(g('簡稱')),
          product: str(g('產品')), tech_type: str(g('技術類型')), trl: str(g('TRL')),
          co2_demand_wt: strictNum(g('CO2需求/去化量(萬噸/年)')), co2_source: str(g('CO2來源')),
          destination: str(g('流向/客戶')), note: str(g('備註')), source: str(g('來源')), raw: cells,
        };
      },
    },
    成本與財務: {
      table: 'survey_answers',
      map: (g, cells) => (pid(g)
        ? { domain: 'ccus', sheet: '成本與財務', survey_year: 115, program: '環境部-CCUS旗艦', plant_id: str(g('廠區ID')), short_name: str(g('簡稱')), answers: realignFinanceRow(cells) }
        : null),
    },
    意願與障礙: {
      table: 'survey_answers',
      // 此分頁有兩個表格：上表旗艦問卷勾選、下表(第二個「廠區ID」表頭之後)產發署減碳策略
      sections: [{ name: '旗艦問卷意願與障礙', program: '環境部-CCUS旗艦' }, { name: '115減碳策略CCUS占比', program: '產發署-製造部門' }],
      map: (g, cells, section) => (pid(g)
        ? { domain: 'ccus', sheet: '意願與障礙', section: section.name, survey_year: 115, program: section.program,
            plant_id: str(g('廠區ID')), short_name: str(g('簡稱')), answers: cells }
        : null),
    },
    人才需求: {
      table: 'survey_answers',
      map: (g, cells) => (str(g('公司'))
        ? { domain: 'ccus', sheet: '人才需求', survey_year: 115, program: '環境部-CCUS旗艦', short_name: str(g('公司')), answers: cells }
        : null),
    },
    期待政府協助: {
      table: 'survey_assistance_requests',
      map: (g) => (str(g('內容(原文)'))
        ? { domain: 'ccus', survey_year: rocYear(g('年度')), program: str(g('計畫/問卷')), plant_id: str(g('廠區ID')),
            short_name: str(g('簡稱')), topic: 'CCUS', content: str(g('內容(原文)')), issues: splitIssues(g('歸納議題')) }
        : null),
    },
  },
};

// ---------- 主流程 ----------
export async function parseWorkbook(filePath, domain) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const config = TABLES[domain];
  const rows = [];
  const tables = {};
  const warnings = [];

  for (const ws of wb.worksheets) {
    const sheetRows = readSheet(ws);
    const cfg = config[ws.name];
    // 一張分頁可能有多個表格：遇到跟表頭第一欄同名的列（例如第二個「廠區ID」）就切換表頭
    let header = detectHeader(sheetRows);
    let sectionIdx = 0;
    for (const r of sheetRows) {
      if (header && r.rowNo > header.rowNo && r.values[0] === header.values[0] && r.values.filter((v) => typeof v === 'string').length >= 3) {
        header = r;
        sectionIdx++;
        rows.push({ sheet: ws.name, row_no: r.rowNo, header_row_no: r.rowNo, plant_id: null, cells: keyedCells(r.values, null) });
        continue;
      }
      const active = header && r.rowNo > header.rowNo ? header : null;
      const cells = keyedCells(r.values, active);
      const plantId = str(cells['廠區ID'] ?? cells['申報廠區ID']);
      rows.push({ sheet: ws.name, row_no: r.rowNo, header_row_no: active?.rowNo ?? null, plant_id: plantId && /^[A-Z]\d{2}$/.test(plantId) ? plantId : null, cells });

      if (!cfg || !active) continue;
      const missing = new Set();
      const g = (name) => {
        if (!(name in cells) && !active.values.some((h) => str(h) === name)) missing.add(name);
        return cells[name] ?? null;
      };
      const section = cfg.sections ? cfg.sections[Math.min(sectionIdx, cfg.sections.length - 1)] : null;
      const out = cfg.map(g, cells, section);
      if (missing.size) warnings.push(`[${domain}/${ws.name}] 找不到欄位：${[...missing].join('、')}`);
      if (!out) continue;
      if (cfg.table === 'survey_answers') out.column_order = Object.keys(out.answers);
      // 對應回原始 Excel 列（後台可由分析表查回 survey_sheet_rows 的原列）
      out.source_sheet = ws.name;
      out.source_row = r.rowNo;
      (tables[cfg.table] ||= []).push(out);
    }
    if (cfg && !tables[cfg.table]?.length) warnings.push(`[${domain}/${ws.name}] 沒有任何列進入 ${cfg.table}`);
  }
  for (const name of Object.keys(config)) {
    if (!wb.getWorksheet(name)) warnings.push(`[${domain}] 找不到工作表「${name}」`);
  }
  return { sheetCount: wb.worksheets.length, rows, tables, warnings: [...new Set(warnings)] };
}

// CCUS 問卷裡出現、但氫能廠區主檔沒有的廠區（旗艦問卷的 C01…），補一筆主檔
export function plantsFromCcus(ccusTables, knownIds) {
  const extra = new Map();
  const add = (id, name, company, county) => {
    if (!id || knownIds.has(id)) return;
    const cur = extra.get(id) || { plant_id: id, short_name: name, company, county, is_survey_target: true, responded_years: [], raw: { 來源: 'CCUS 問卷' } };
    cur.company ||= company;
    cur.county ||= county;
    extra.set(id, cur);
  };
  for (const r of ccusTables.ccus_emission_sources || []) add(r.plant_id, r.short_name, r.company, r.county);
  for (const t of ['ccus_capture_units', 'ccus_plans', 'ccus_utilization', 'survey_answers']) {
    for (const r of ccusTables[t] || []) add(r.plant_id, r.short_name, null, null);
  }
  return [...extra.values()];
}


// ---------- 「成本與財務」錯位校正 ----------
// 115 年整併檔此分頁有幾列（台塑化、中鋼、台電、台泥）從「封存投入」或「剩餘50%資金籌措」之後整段右移一格，
// CCfD 執行價格落在沒有表頭的 Z 欄（解析成鍵 "Z"）。判斷規則：
//   - 「價值鏈情境」欄出現百分比（那其實是 IRR 門檻）→ 從「封存投入(億元)」起整段左移一格
//   - 否則若有 Z 欄、或「CCfD執行價格」欄是 A/B/C 方案代號 → 只把最後三欄左移一格
// 校正過的列加上「_欄位校正」說明，原始儲存格仍完整保存在 survey_sheet_rows。
export const FINANCE_HEADERS = ['廠區ID', '簡稱', '業別', '年直接排放級距', '捕捉規模(噸/年)', '捕捉CAPEX(萬元)', '捕捉OPEX(萬元/年)',
  '單位CAPEX(元/噸年產能)', '單位OPEX(元/噸)', '申報OPEX(元/噸)', '運輸成本', '封存投入(億元)', '封存攤提(年)', '工程建置期',
  '財務攤提年限', 'IRR門檻', '價值鏈情境', '需Pre-FEED全額補助', '支持措施：CAPEX補助', 'OPEX/CCfD補貼', '稅賦抵減',
  '低利融資/保證', '剩餘50%資金籌措', 'CCfD參考價格模式', 'CCfD執行價格(元/噸以上)'];

export function realignFinanceRow(cells) {
  const H = FINANCE_HEADERS;
  const at = (i) => (i === H.length ? cells.Z : cells[H[i]]);
  const out = { ...cells };
  delete out.Z;
  const full = /%/.test(String(cells['價值鏈情境'] ?? ''));
  const trailing = !full && ('Z' in cells || /^[A-C]\s/.test(String(cells['CCfD執行價格(元/噸以上)'] ?? '')));
  if (!full && !trailing) return cells;
  const from = full ? H.indexOf('封存投入(億元)') : H.indexOf('剩餘50%資金籌措');
  for (let i = from; i < H.length; i++) {
    const v = at(i + 1);
    if (v === undefined || v === null || v === '') {
      // 尾段只位移有值的欄，避免把原本正確的勾選洗掉
      if (full) delete out[H[i]];
    } else out[H[i]] = v;
  }
  out['_欄位校正'] = full ? '原檔此列自「封存投入」起右移一格，已左移對齊' : '原檔此列最後三欄右移一格，已左移對齊';
  const ordered = {};
  [...H, ...Object.keys(out)].forEach((k) => { if (k in out && !(k in ordered)) ordered[k] = out[k]; });
  return ordered;
}
