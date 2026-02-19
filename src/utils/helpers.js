// ==========================================
// 工具函數 (Utility Functions)
// ==========================================
import { LOCATION_MAPPING } from './constants';

export function normalizeCode(code) {
    return String(code).replace(/[^0-9]/g, '');
}

export function isHsCodeMatch(dataCode, targetCode, excludes = []) {
    if (!dataCode || !targetCode) return false;
    const d = normalizeCode(dataCode);
    const t = normalizeCode(targetCode);
    if (excludes && excludes.length > 0) {
        if (excludes.some(ex => d.startsWith(normalizeCode(ex)))) {
            return false;
        }
    }
    return d.startsWith(t) || t.startsWith(d);
}

export function getCountryFlag(name) {
    if (!name) return '🌐';
    const n = name;
    if (n.includes('中國') || n.includes('大陸')) return '🇨🇳';
    if (n.includes('美國')) return '🇺🇸';
    if (n.includes('日本')) return '🇯🇵';
    if (n.includes('韓國')) return '🇰🇷';
    if (n.includes('越南')) return '🇻🇳';
    if (n.includes('德國')) return '🇩🇪';
    if (n.includes('荷蘭')) return '🇳🇱';
    if (n.includes('台灣')) return '🇹🇼';
    return '🌐';
}

export function cleanNumber(val) {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isFinite(val) ? val : 0;
  const str = String(val).trim();
  if (str === '-' || str === '－') return 0; 
  const num = parseFloat(str.replace(/[,%\s]/g, ''));
  return isFinite(num) ? num : 0;
}

export function sanitizeForChart(data) {
  if (!Array.isArray(data)) return [];
  return data.map(item => {
    const cleanItem = { ...item };
    Object.keys(cleanItem).forEach(key => {
      if (typeof cleanItem[key] === 'number') {
        if (!isFinite(cleanItem[key]) || isNaN(cleanItem[key])) {
          cleanItem[key] = 0;
        }
      }
    });
    return cleanItem;
  });
}

export function formatSmartWeight(val) {
    const v = cleanNumber(val);
    if (v === 0) return '0';
    if (v >= 1000) return (v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' 公噸';
    return v.toLocaleString() + ' 公斤';
}

export function formatValueByUnit(val, unit) {
    const v = cleanNumber(val);
    if (v === 0) return '0';
    if (unit === 'million') return (v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 });
    if (unit === 'billion') return (v / 1000000).toLocaleString(undefined, { maximumFractionDigits: 2 });
    return v.toLocaleString();
}

export function getUnitLabel(unit) {
    if (unit === 'million') return '百萬';
    if (unit === 'billion') return '十億';
    return '千';
}

export function formatCurrencyAxis(value, unit = 'thousand') {
  const v = cleanNumber(value);
  if (v === 0) return '0';
  if (unit === 'million') return (v / 1000).toFixed(0) + 'M';
  if (unit === 'billion') return (v / 1000000).toFixed(1) + 'B';
  if (Math.abs(v) >= 100000) return (v / 100000).toFixed(1) + '億';
  if (Math.abs(v) >= 10000) return (v / 10000).toFixed(0) + '千萬';
  return v.toLocaleString();
}

export function mapEventToDateKey(eventDate, granularity) {
    if (granularity === 'month') return eventDate; 
    const [year, month] = eventDate.split('-');
    if (granularity === 'year') return year; 
    if (granularity === 'quarter') {
        const q = Math.floor((parseInt(month) + 2) / 3);
        return `${year}-Q${q}`; 
    }
    return eventDate;
}

export function exportToCSV(data, filename) {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(fieldName => {
      const val = row[fieldName];
      return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
    }).join(','))
  ].join('\n');
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function copyToClipboard(data) {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]);
    const textContent = [
        headers.join('\t'),
        ...data.map(row => headers.map(fieldName => row[fieldName]).join('\t'))
    ].join('\n');
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(textContent).then(() => alert("已複製到剪貼簿"));
    } else {
        alert("請使用 Ctrl+C 複製 (模擬環境限制)");
    }
}

export function parseCSVLine(text) {
    const res = [];
    let current = '';
    let inQuote = false;
    for (let c of text) {
        if (c === '"') { inQuote = !inQuote; continue; }
        if (c === ',' && !inQuote) { res.push(current); current = ''; continue; }
        current += c;
    }
    res.push(current);
    return res.map(s => s.trim());
}

export function parseCSV_Safe(text) {
    if (!text || typeof text !== 'string') return { data: [], debugInfo: {} };
    const lines = text.split(/\r\n|\n/).filter(l => l.trim());
    if (lines.length < 2) return { data: [], debugInfo: { error: "No data" } };

    let bestMapIndex = { date: -1, hsCode: -1, country: -1, type: -1, value: -1, weight: -1, productName: -1 };
    let maxScore = 0;

    for (let i = 0; i < Math.min(lines.length, 20); i++) {
        const row = parseCSVLine(lines[i]);
        let score = 0;
        const idx = { date: -1, hsCode: -1, country: -1, type: -1, value: -1, weight: -1, productName: -1 };
        
        row.forEach((cell, col) => {
            const val = String(cell).trim().toLowerCase();
            if (val.match(/(date|日期|年月|time)/)) { idx.date = col; score += 10; }
            if (val.match(/(code|稅號|ccc|hscode)/)) { idx.hsCode = col; score += 10; }
            if (val.match(/(country|國家|產地)/)) { idx.country = col; score += 5; }
            if (val.match(/(type|進出口|別|flow)/)) { idx.type = col; score += 5; }
            if (val.match(/(value|金額|twd|usd)/)) { idx.value = col; score += 5; }
            if (val.match(/(weight|重量|kg|mass)/)) { idx.weight = col; score += 5; }
            if (val.match(/(name|貨名|品名|desc)/)) { idx.productName = col; score += 5; } 
        });

        if (score > maxScore) { maxScore = score; bestMapIndex = idx; }
    }

    if (maxScore < 10) {
        if (bestMapIndex.productName === -1) bestMapIndex.productName = 2; 
    }
    if (bestMapIndex.hsCode > -1 && bestMapIndex.productName === -1) {
        bestMapIndex.productName = bestMapIndex.hsCode + 1;
    }

    const parsedData = [];
    const today = new Date();
    const maxAllowedDate = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 7);

    for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        if (row.length < 2) continue;

        const getCol = (idx) => (idx > -1 && row[idx] !== undefined) ? String(row[idx]).trim() : '';

        const rawDate = getCol(bestMapIndex.date || 0);
        const rawCode = getCol(bestMapIndex.hsCode || 1);
        let rawCountry = getCol(bestMapIndex.country || 3); 
        let rawType = getCol(bestMapIndex.type || 4);
        const rawValue = getCol(bestMapIndex.value || 5);
        const rawWeight = getCol(bestMapIndex.weight || 6);
        const rawName = getCol(bestMapIndex.productName); 

        let cleanType = '進口'; 
        if (rawType.includes('出口') || rawType.includes('Export')) cleanType = '出口';
        else if (rawType.includes('進口') || rawType.includes('Import')) cleanType = '進口';
        else if (rawCountry.includes('出口')) { cleanType = '出口'; rawCountry = 'Unknown'; } 
        else if (rawCountry.includes('進口')) { cleanType = '進口'; rawCountry = 'Unknown'; }

        if (rawCountry === '全球' || rawCountry === 'World' || rawCountry === 'Total' || rawCountry.includes('總計')) continue;

        const cleanValue = cleanNumber(rawValue);
        const cleanWeight = cleanNumber(rawWeight);
        const cleanCode = rawCode.replace(/[^0-9]/g, '');
        const cleanName = rawName.replace(/^["']|["']$/g, '').trim();

        let cleanDate = '';
        let yearPart = '2023';
        try {
            if (rawDate) {
                let norm = rawDate.replace(/[\/\.年月]/g, '-').replace(/[日\s]/g, '').trim();
                if (norm.endsWith('-')) norm = norm.slice(0, -1);
                
                let y = 0, m = 0;
                if (/^\d{5,6}$/.test(norm)) {
                     if (norm.length === 5) { y = parseInt(norm.substring(0, 3)) + 1911; m = parseInt(norm.substring(3, 5)); } 
                     else { y = parseInt(norm.substring(0, 4)); if(y<1911) y+=1911; m = parseInt(norm.substring(4, 6)); }
                } else if (norm.includes('-')) {
                    const parts = norm.split('-');
                    if (parts.length >= 2) {
                        y = parseInt(parts[0]);
                        m = parseInt(parts[1]);
                        if (y < 1900) y += 1911;
                    }
                }
                if (m >= 1 && m <= 12) {
                     const mStr = m < 10 ? `0${m}` : `${m}`;
                     cleanDate = `${y}-${mStr}`;
                     yearPart = String(y);
                }
            }
            if (cleanDate > maxAllowedDate) cleanDate = '';
        } catch (e) { cleanDate = ''; }

        if (cleanDate && cleanCode) {
             parsedData.push({
                id: `row-${i}-${cleanCode}`, 
                date: cleanDate, 
                year: yearPart, 
                hsCode: cleanCode, 
                productName: cleanName || cleanCode, 
                country: rawCountry || 'Unknown', 
                type: cleanType, 
                value: cleanValue, 
                weight: cleanWeight 
            });
        }
    }
    return { data: parsedData };
}

// ** 氫能工具函式 **
export const getH2Value = (row, ...keys) => {
    const lowerKeys = keys.map(k => k.toLowerCase());
    for (let k in row) {
        const cleanK = k.toLowerCase().trim();
        if (lowerKeys.some(target => cleanK.includes(target) || cleanK === target)) return row[k];
    }
    return undefined;
};

export const simplifyCompanyName = (name) => {
  if (!name) return '未知廠商';
  let n = name.trim().replace(/股份有限公司|工業|企業/g, '').trim();
  const mapping = {
      '台灣化學纖維': '台化', '台化': '台化',
      '台灣苯乙烯': '台苯', '台苯': '台苯',
      '中國石油化學': '中石化', '中石化': '中石化',
      '台灣中油': '中油', '中油': '中油',
      '台塑石化': '台塑化', '台塑化': '台塑化',
      '台灣積體電路製造': '台積電', '台積電': '台積電',
      '中國鋼鐵': '中鋼', '中鋼': '中鋼',
      '長春人造樹脂': '長春樹脂', '長春石油化學': '長春石化'
  };
  for (const [full, short] of Object.entries(mapping)) {
      if (n.includes(full)) return short;
  }
  return n;
};

export const getSimplePlantName = (company, plant) => {
    const comp = simplifyCompanyName(company);
    let p = (plant || '')
        .replace(/股份有限公司|工業區|工業|廠/g, '') 
        .replace(/煉製事業部|石化事業部/g, '') 
        .trim();
    if (!p) p = '廠區';
    return `${comp} ${p}`;
};

export const identifyProcess = (rawName) => {
    const n = (rawName || '').toUpperCase().trim();
    if (n.match(/天然氣/)) return '天然氣重組';
    if (n.match(/甲醇.*(重組|裂解)/) || n.match(/SMR.*甲醇/)) return n.includes('裂解') ? '甲醇裂解' : '甲醇重組';
    if (n.includes('SMR')) return 'SMR'; 
    if (n.match(/(LPG|液化石油氣|輕油|NAPHTHA).*重組/)) return '輕油重組'; 
    if (n.match(/(輕油|裂解|乙烯|三輕|四輕)/)) return '輕油裂解';
    if (n.match(/(觸媒|重組)/)) return '觸媒重組';
    if (n.match(/(鹼氯|碱氯|氯)/)) return '鹼氯製程';
    if (n.match(/(芳烃|芳香烴)/)) return '芳烃製程';
    if (n.match(/(脫氫|PDH)/)) return '脫氫反應'; 
    if (n.includes('苯乙烯') || n.includes('SM')) return '苯乙烯製程';
    if (n.includes('丁酮')) return '丁酮製程';
    if (n.match(/(回收|純化|PSA)/)) return '氫氣回收純化';
    if (n.includes('電解')) return '電解'; 
    return '其他製程';
};

export const getProcessType = (processName) => {
    const mainList = ['天然氣重組', '甲醇重組', 'SMR', '甲醇裂解', '電解', '輕油重組'];
    return mainList.includes(processName) ? '主產' : '副產';
};

export const identifyUsage = (rawName) => {
    const n = (rawName || '').toUpperCase().trim();
    if (n.match(/(脫硫|HDS|加氫脫硫|硫磺|尾氣)/)) return '加氫脫硫';
    if (n.match(/(三輕|四輕|裂解反應)/)) return '其他煉油相關';
    if (n.match(/(燃燒|燃料|發電|鍋爐|混氫)/)) return '燃料燃燒';
    if (n.match(/(丁二醇|BDO)/)) return '1,4-丁二醇製程';
    if (n.includes('正丁醇')) return '正丁醇製程';
    if (n.match(/(已內醯胺|CPL)/)) return '已內醯胺製程';
    if (n.match(/(異丙醇|IPA)/)) return '異丙醇製程';
    if (n.match(/(雙氧水|過氧化氫)/)) return '雙氧水製程';
    if (n.match(/(酚|酮|PHENOL)/)) return '酚酮製程';
    if (n.match(/(環己酮)/)) return '環己酮製程';
    if (n.match(/(樹脂)/)) return '氫化樹脂製程';
    if (n.match(/(溶劑)/)) return '環保溶劑製程';
    if (n.match(/(烷化)/)) return '烷化製程';
    if (n.match(/(精細|特用)/)) return '精細化學品製程';
    if (n.match(/(芳烃|芳香烴)/)) return '芳烃製程';
    if (n.includes('EUV') || n.includes('半導體')) return '半導體製程'; 
    if (n.match(/(氫化|化學|合成|還原|苯|胺|醇|酸|SM|MA|PTA|VAM)/)) return '其他化學製程';
    return '其他用途';
};

export const getUsageCategory = (identifiedName) => {
    if (['加氫脫硫', '硫磺尾氣處理', '其他煉油相關'].includes(identifiedName)) return '煉油';
    if (['燃料燃燒'].includes(identifiedName)) return '燃燒';
    return '化工';
};

export const getLocation = (plantName) => {
    const n = (plantName || '').trim();
    for (const loc of LOCATION_MAPPING) {
        if (loc.keywords.some(k => n.includes(k))) return loc;
    }
    return null;
};

export const getRegion = (plantName) => {
    const n = String(plantName);
    if (n.match(/(台北|新北|桃園|新竹|苗栗|大園|觀音)/)) return '北區';
    if (n.match(/(台中|彰化|南投|雲林|麥寮)/)) return '中區';
    if (n.match(/(嘉義|台南|高雄|屏東|大社|仁武|林園|小港)/)) return '南區';
    if (n.match(/(宜蘭|花蓮|台東)/)) return '東區'; 
    return '其他';
};

export const parseHydrogenCSV = (text) => {
    if (!text || text.includes('<!DOCTYPE html>')) return [];
    const lines = text.split(/\r\n|\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    
    const parseLine = (line) => {
        const res = [];
        let current = '';
        let inQuote = false;
        for (let c of line) {
            if (c === '"') { inQuote = !inQuote; continue; }
            if (c === ',' && !inQuote) { res.push(current.trim()); current = ''; continue; }
            current += c;
        }
        res.push(current.trim());
        return res;
    };

    const headers = parseLine(lines[0]);
    return lines.slice(1).map(line => {
        const row = parseLine(line);
        const obj = {};
        headers.forEach((h, i) => {
            const cleanKey = h.replace(/^[\uFEFF\s]+|[\s]+$/g, '');
            obj[cleanKey] = row[i];
        });
        return obj;
    });
};

export const normalizeHydrogenData = (rawData, type = 'supply') => {
    const normalized = [];
    rawData.forEach(row => {
        const company = getH2Value(row, 'Company', '公司', '廠商');
        if (!company || company === 'TOTAL_SUMMARY' || company === 'Total' || company.toUpperCase().includes('SUMMARY') || company.includes('總計') || company.includes('合計')) return;

        const plant = getH2Value(row, 'Plant', '廠區', '工廠');
        const regionFromDB = getH2Value(row, 'Region', '區域', 'Region');
        const region = regionFromDB ? regionFromDB.replace('部', '區') : getRegion(plant);
        const note = getH2Value(row, 'Note', '備註', '註解');

        const process = getH2Value(row, 'Process', '製程', '技術'); 
        const usage = getH2Value(row, 'Usage_Type', '用途', '流向'); 
        const intensity = cleanNumber(getH2Value(row, '單位碳排', 'Unit_Carbon', 'Carbon_Intensity', '碳排強度', 'CO2', 'Emission', '碳排'));

        Object.keys(row).forEach(key => {
            const cleanKey = key.trim();
            const yearMatch = cleanKey.match(/(\d{2,4})/);
            const typeMatch = cleanKey.match(/(產量|Output|用量|Demand|產能|Capacity)/i);
            
            if (yearMatch) {
                let yearStr = yearMatch[1];
                let year = parseInt(yearStr);
                if (year < 1911) year += 1911; 
                
                const value = cleanNumber(row[key]);
                
                let isCapacity = false;
                let isOutput = false;
                let isDemand = false;

                if (typeMatch) {
                    const dataType = typeMatch[1];
                    isCapacity = dataType.includes('產能') || dataType.includes('Capacity');
                    isOutput = dataType.includes('產量') || dataType.includes('Output');
                    isDemand = dataType.includes('用量') || dataType.includes('Demand');
                } else {
                    if (type === 'supply') isOutput = true; 
                    if (type === 'demand') isDemand = true; 
                }

                if (value > 0 || isCapacity) { 
                    const record = {
                        Company: company,
                        Plant: plant,
                        Region: region,
                        Note: note,
                        Year: String(year),
                        Carbon_Intensity: intensity,
                        ...(type === 'supply' ? {
                            Process: process,
                            Output_Tons: isOutput ? value : 0,
                            Capacity_Tons: isCapacity ? value : 0
                        } : {
                            Usage_Type: usage,
                            Demand_Tons: isDemand ? value : 0
                        })
                    };
                    normalized.push(record);
                }
            }
        });
    });
    
    const mergedMap = {};
    normalized.forEach(item => {
        const id = `${item.Company}_${item.Plant}_${item.Year}_${item.Process || item.Usage_Type}`;
        if (!mergedMap[id]) {
            mergedMap[id] = { ...item };
        } else {
            if (item.Output_Tons) mergedMap[id].Output_Tons = (mergedMap[id].Output_Tons || 0) + item.Output_Tons;
            if (item.Capacity_Tons) mergedMap[id].Capacity_Tons = (mergedMap[id].Capacity_Tons || 0) + item.Capacity_Tons;
            if (item.Demand_Tons) mergedMap[id].Demand_Tons = (mergedMap[id].Demand_Tons || 0) + item.Demand_Tons;
        }
    });

    return Object.values(mergedMap);
};

export const stringToColor = (str) => {
    const COLORS_POOL = [
        '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', // Blue
        '#059669', '#10b981', '#34d399', '#6ee7b7', // Emerald
        '#d97706', '#f59e0b', '#fbbf24', '#fcd34d', // Amber
        '#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', // Violet
        '#dc2626', '#ef4444', '#f87171', '#fca5a5'  // Red
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const index = Math.abs(hash) % COLORS_POOL.length;
    return COLORS_POOL[index];
};