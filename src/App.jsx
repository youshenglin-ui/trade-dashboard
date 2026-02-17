import React, { useState, useEffect, useMemo, useRef, Component } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, ComposedChart, ReferenceLine, ScatterChart, Scatter, ZAxis, LabelList 
} from 'recharts';
import { 
  Search, History, TrendingUp, AlertTriangle, Globe, Database, ArrowUpRight, ArrowDownRight, 
  Filter, Download, Table as TableIcon, Calendar, FileText, Copy, Settings, RefreshCw, 
  X, Star, ChevronDown, ListFilter, ArrowRightLeft, Zap, ShieldAlert, Newspaper, 
  Map as MapIcon, Layers, BookOpen, SearchCode, CheckSquare, Square, Plus, Trash2, ExternalLink,
  Briefcase, Activity, Droplets, Factory, Leaf, AlertCircle, Info, ChevronRight, CheckCircle
} from 'lucide-react';

// ==========================================
// 1. 全域設定與常數 (System Config)
// ==========================================

const NAV_ITEMS = [
  { id: 'overview', label: '時間趨勢', icon: TrendingUp, section: 'main' },
  { id: 'country', label: '國家分析', icon: Globe, section: 'main' },
  { id: 'pivot', label: '數據樞紐', icon: TableIcon, section: 'main' },
  { id: 'analysis', label: '變動與關聯', icon: AlertTriangle, section: 'main' },
];

const GLOBAL_EVENTS = [
    { date: '2022-02', label: '烏俄戰爭', type: 'War', desc: '能源原物料飆漲' },
    { date: '2022-06', label: '美升息', type: 'Finance', desc: '強勢美元導致亞幣競貶' },
    { date: '2023-10', label: '以巴衝突', type: 'War', desc: '紅海航運危機，運費上漲' },
    { date: '2024-01', label: 'ECFA中止(12項)', type: 'Policy', desc: '首波石化產品優惠取消' },
    { date: '2024-04', label: '電價調漲', type: 'Domestic', desc: '工業電價平均調漲' },
    { date: '2024-06', label: 'ECFA中止(34項)', type: 'Policy', desc: '第二波中止，含潤滑油、紡織' },
    { date: '2024-11', label: '美國大選', type: 'Politics', desc: '川普當選，市場預期關稅壁壘升高' },
];

const TOPIC_MILESTONES = {
    'CBAM_WATCH': [
        { date: '2023-10', label: '過渡期啟動', desc: '開始試行申報碳含量 (不收費)' },
        { date: '2024-07', label: '申報常態化', desc: '需提交實際碳排數據' },
        { date: '2026-01', label: '正式收費', desc: 'CBAM憑證強制購買開始' },
        { date: '2034-01', label: '免費配額歸零', desc: '歐盟ETS免費配額完全退場' }
    ],
    'ECFA_EARLY': [
        { date: '2011-01', label: '早收生效', desc: '關稅開始降至零' },
        { date: '2024-01', label: '首波中止', desc: '丙烯等12項產品恢復關稅' },
        { date: '2024-06', label: '二波中止', desc: 'PC、潤滑油等34項產品恢復關稅' }
    ],
    'TRUMP_RISK': [
        { date: '2018-03', label: '301調查', desc: '美中貿易戰開打' },
        { date: '2018-07', label: '232條款', desc: '鋼鋁稅生效' },
        { date: '2025-01', label: '關稅預期', desc: '川普上任，預期提高全面關稅' }
    ],
    'CPTPP_IMPACT': [
        { date: '2018-12', label: 'CPTPP生效', desc: '會員國間關稅大幅調降' },
        { date: '2021-09', label: '台灣申請加入', desc: '正式遞件申請' }
    ]
};

const TRADE_REGIONS = {
    'ASEAN': { label: '東協 10 國', countries: ['越南', '泰國', '印尼', '馬來西亞', '菲律賓', '新加坡', '緬甸', '柬埔寨', '寮國', '汶萊'] },
    'EU27': { label: '歐盟 27 國', countries: ['德國', '法國', '荷蘭', '義大利', '西班牙', '比利時', '波蘭', '瑞典', '奧地利', '愛爾蘭', '捷克', '丹麥', '芬蘭', '葡萄牙', '希臘', '匈牙利', '羅馬尼亞', '斯洛伐克', '保加利亞', '愛沙尼亞', '拉脫維亞', '立陶宛', '盧森堡', '馬爾他', '賽普勒斯', '斯洛維尼亞', '克羅埃西亞'] },
    'US_CN': { label: '美中港 (G2)', countries: ['美國', '中國大陸', '香港'] },
    'CPTPP': { label: 'CPTPP 成員', countries: ['日本', '加拿大', '澳洲', '越南', '墨西哥', '新加坡', '紐西蘭', '馬來西亞', '智利', '秘魯', '汶萊', '英國'] }, 
    'MIDDLE_EAST': { label: '中東地區', countries: ['沙烏地阿拉伯', '阿聯', '科威特', '卡達', '以色列'] }
};

const STRATEGIC_TOPICS = {
    'CBAM_WATCH': { 
        title: '歐盟 CBAM 碳關稅', 
        desc: '重點監控：水泥、肥料、鋼鐵、鋁、氫、電力',
        sourceUrl: 'https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism_en',
        items: [
            { group: '水泥與礦產', code: '2507', name: '2507 高嶺土' }, { group: '水泥與礦產', code: '2523', name: '2523 水泥' }, { group: '水泥與礦產', code: '2601', name: '2601 鐵礦石' },
            { group: '化工與肥料', code: '2804', name: '2804 氫氣/其他' }, { group: '化工與肥料', code: '2814', name: '2814 氨' }, { group: '化工與肥料', code: '2834', name: '2834 亞硝酸鹽' }, { group: '化工與肥料', code: '3102', name: '3102 氮肥' }, { group: '化工與肥料', code: '3105', name: '3105 複合肥料' },
            { group: '鋼鐵原料', code: '72', name: '72 鋼鐵原料 (除7202)', excludes: ['7202'] },
            { group: '鋼鐵製品', code: '73', name: '73 鋼鐵製品(部分)' }, 
            { group: '鋁與鋁製品', code: '76', name: '76 鋁及其製品' },
        ]
    },
    'ECFA_EARLY': { 
        title: 'ECFA 早收清單', 
        desc: '石化、紡織、機械等早收清單 (含2024中止項目)',
        sourceUrl: 'https://www.trade.gov.tw/ecfa/',
        items: [
            { group: '中止項目(2024/01)', code: '290122', name: '290122 丙烯' }, { group: '中止項目(2024/01)', code: '290124', name: '290124 丁二烯' }, 
            { group: '中止項目(2024/06)', code: '271019', name: '271019 潤滑油' }, { group: '中止項目(2024/06)', code: '390740', name: '390740 聚碳酸酯 (PC)' },
            { group: '其他早收', code: '290531', name: '290531 乙二醇' }, { group: '其他早收', code: '84', name: '84章 機械設備' }, 
        ]
    },
    'CPTPP_IMPACT': {
        title: 'CPTPP 經貿衝擊監測',
        desc: '觀察我國優勢產業(紡織、塑膠)在 CPTPP 成員國間的市佔變化',
        sourceUrl: 'https://www.trade.gov.tw/',
        items: [
            { group: '紡織 (50-63章)', code: '54', name: '54章 人造纖維絲' },
            { group: '塑膠 (39章)', code: '39', name: '39章 塑膠及其製品' },
            { group: '車輛 (87章)', code: '8708', name: '8708 機動車輛零件' }
        ]
    },
    'TRUMP_RISK': { 
        title: '川普關稅風險 (60%)', 
        desc: '針對高貿易順差國之重點項目 (晶片、汽車、資通訊)',
        sourceUrl: 'https://ustr.gov/',
        items: [
            { group: '電子零組件', code: '8542', name: '8542 積體電路' }, 
            { group: '運輸工具', code: '8703', name: '8703 小客車' }, 
            { group: '資通訊產品', code: '8471', name: '8471 自動資料處理機' }
        ]
    }
};

const H2_DATA_SOURCES = {
  PRODUCTION: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ8aZTek-9SoTaK7Z_Wu9InU2c_vu4cUpD0Nn4fCs-w0IM3XoWeNXK5ZldWoEs6M3G6mJTS6QoF4Mo/pub?gid=0&single=true&output=csv',
  USAGE: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ8aZTek-9SoTaK7Z_Wu9InU2c_vu4cUpD0Nn4fCs-w0IM3XoWeNXK5ZldWoEs6M3G6mJTS6QoF4Mo/pub?gid=687277722&single=true&output=csv'
};

const MOCK_SUPPLY_MATRIX = [
  { 'Company': '長春石化', 'Plant': '苗栗廠', 'Process': '甲醇重組', '單位碳排': 8.8, '112年產能': 1.5, '112年產量': 1.2, '113年產能': 1.5, '113年產量': 1.4, '114年產量': 1.5 },
  { 'Company': '台灣中油', 'Plant': '桃園煉油廠', 'Process': 'SMR(天然氣)', '單位碳排': 9.5, '112年產能': 3.0, '112年產量': 2.5, '113年產能': 3.0, '113年產量': 2.6, '114年產量': 2.8 },
  { 'Company': '台塑石化', 'Plant': '麥寮一廠', 'Process': 'SMR(輕油)', '單位碳排': 11.2, '112年產能': 13.0, '112年產量': 11.0, '113年產能': 13.0, '113年產量': 12.0, '114年產量': 12.5 },
];

const MOCK_DEMAND_MATRIX = [
  { 'Company': '台積電', 'Plant': '南科18廠', 'Usage_Type': '化學製程(EUV)', '112年用量': 1.8, '113年用量': 2.0, '114年用量': 2.2 },
  { 'Company': '中鋼', 'Plant': '小港廠', 'Usage_Type': '煉油/還原', '112年用量': 2.8, '113年用量': 3.0, '114年用量': 3.2 },
];

const COLORS_PROCESS = {
  '主產': '#0369a1', '副產': '#7c3aed', // Level 1
  'SMR': '#0284c7', '天然氣重組': '#0ea5e9', '甲醇裂解': '#38bdf8', '甲醇重組': '#7dd3fc', '電解': '#22d3ee', '輕油重組': '#3b82f6', // Main Level 2
  '觸媒重組': '#8b5cf6', '輕油裂解': '#a78bfa', '鹼氯製程': '#c4b5fd', '回收純化': '#ddd6fe', '焦爐氣副產': '#a78bfa', '副產氫氣': '#8b5cf6', '其他': '#94a3b8' // Byproduct Level 2
};

const COLORS_USAGE = {
  '煉油': '#f59e0b', '化工': '#10b981', '燃燒': '#ef4444', '其他': '#64748b', 
  // Refining
  '加氫脫硫': '#fbbf24', '硫磺尾氣處理': '#fcd34d', '其他煉油相關': '#fde047',
  // Chemical
  '正丁醇製程': '#34d399', '1,4-丁二醇製程': '#4ade80', '已內醯胺製程': '#86efac', 
  '氫化製程': '#bbf7d0', '芳烃製程': '#6ee7b7', '半導體製程': '#10b981',
  '異丙醇製程': '#22c55e', '雙氧水製程': '#16a34a', '氫化樹脂製程': '#15803d',
  '環保溶劑製程': '#166534', '烷化製程': '#14532d', '酚酮製程': '#052e16',
  '環己酮製程': '#064e3b', '精細化學品製程': '#065f46', '其他化學製程': '#047857',
  // Burning
  '燃料燃燒': '#f87171' 
};

const TAIWAN_REGIONS_PATHS = {
    NORTH: "M195,20 L210,30 L220,50 L205,65 L180,60 L170,40 L185,25 Z", 
    CENTRAL: "M170,40 L180,60 L205,65 L190,110 L140,100 L150,60 Z",
    SOUTH: "M140,100 L190,110 L180,160 L160,220 L130,180 L110,130 Z",
    EAST: "M220,50 L230,100 L210,180 L180,160 L190,110 L205,65 Z"
};

const LOCATION_MAPPING = [
  { name: '觀音/大園', keywords: ['觀音', '大園', '桃園', '桃煉'], cx: 175, cy: 35, region: '北區' },
  { name: '頭份/苗栗', keywords: ['頭份', '苗栗', '竹南', '長春'], cx: 160, cy: 55, region: '中區' },
  { name: '台中/彰濱', keywords: ['彰濱', '彰化', '台中', '中龍'], cx: 145, cy: 80, region: '中區' },
  { name: '南投', keywords: ['南投', '南崗'], cx: 165, cy: 90, region: '中區' },
  { name: '麥寮/雲林', keywords: ['麥寮', '雲林', '六輕', '台塑'], cx: 125, cy: 105, region: '中區' },
  { name: '嘉義/新港', keywords: ['嘉義', '新港'], cx: 125, cy: 130, region: '南區' },
  { name: '南科/台南', keywords: ['台南', '南科', '善化'], cx: 125, cy: 155, region: '南區' },
  { name: '屏東', keywords: ['屏東', '屏南'], cx: 140, cy: 200, region: '南區' },
  { name: '大社/仁武', keywords: ['大社', '仁武', '高雄'], cx: 130, cy: 175, region: '南區' },
  { name: '林園/小港', keywords: ['林園', '小港', '大林', '中鋼', '中油林園', '臨海'], cx: 135, cy: 190, region: '南區' },
  { name: '花蓮/和平', keywords: ['和平', '花蓮'], cx: 210, cy: 90, region: '東區' },
  { name: '宜蘭/龍德', keywords: ['龍德', '宜蘭', '蘇澳'], cx: 205, cy: 50, region: '東區' },
];

// ==========================================
// 2. 工具函數 (Utility Functions)
// ==========================================

function normalizeCode(code) {
    return String(code).replace(/[^0-9]/g, '');
}

function isHsCodeMatch(dataCode, targetCode, excludes = []) {
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

function getCountryFlag(name) {
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

function cleanNumber(val) {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isFinite(val) ? val : 0;
  const str = String(val).trim();
  if (str === '-' || str === '－') return 0; 
  const num = parseFloat(str.replace(/[,%\s]/g, ''));
  return isFinite(num) ? num : 0;
}

function sanitizeForChart(data) {
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

function formatSmartWeight(val) {
    const v = cleanNumber(val);
    if (v === 0) return '0';
    if (v >= 1000) return (v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' 公噸';
    return v.toLocaleString() + ' 公斤';
}

function formatValueByUnit(val, unit) {
    const v = cleanNumber(val);
    if (v === 0) return '0';
    if (unit === 'million') return (v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 });
    if (unit === 'billion') return (v / 1000000).toLocaleString(undefined, { maximumFractionDigits: 2 });
    return v.toLocaleString();
}

function getUnitLabel(unit) {
    if (unit === 'million') return '百萬';
    if (unit === 'billion') return '十億';
    return '千';
}

function formatCurrencyAxis(value, unit = 'thousand') {
  const v = cleanNumber(value);
  if (v === 0) return '0';
  if (unit === 'million') return (v / 1000).toFixed(0) + 'M';
  if (unit === 'billion') return (v / 1000000).toFixed(1) + 'B';
  if (Math.abs(v) >= 100000) return (v / 100000).toFixed(1) + '億';
  if (Math.abs(v) >= 10000) return (v / 10000).toFixed(0) + '千萬';
  return v.toLocaleString();
}

function mapEventToDateKey(eventDate, granularity) {
    if (granularity === 'month') return eventDate; 
    const [year, month] = eventDate.split('-');
    if (granularity === 'year') return year; 
    if (granularity === 'quarter') {
        const q = Math.floor((parseInt(month) + 2) / 3);
        return `${year}-Q${q}`; 
    }
    return eventDate;
}

function exportToCSV(data, filename) {
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

function copyToClipboard(data) {
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

function parseCSVLine(text) {
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

function parseCSV_Safe(text) {
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
const getH2Value = (row, ...keys) => {
    const lowerKeys = keys.map(k => k.toLowerCase());
    for (let k in row) {
        const cleanK = k.toLowerCase().trim();
        if (lowerKeys.some(target => cleanK.includes(target) || cleanK === target)) return row[k];
    }
    return undefined;
};

const simplifyCompanyName = (name) => {
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

const getSimplePlantName = (company, plant) => {
    const comp = simplifyCompanyName(company);
    let p = (plant || '')
        .replace(/股份有限公司|工業區|工業|廠/g, '') 
        .replace(/煉製事業部|石化事業部/g, '') 
        .trim();
    if (!p) p = '廠區';
    return `${comp} ${p}`;
};

// ** 核心製程識別邏輯 (V40.1 Updated) **
const identifyProcess = (rawName) => {
    const n = (rawName || '').toUpperCase().trim();
    // 主產氫製程
    if (n.match(/天然氣/)) return '天然氣重組';
    if (n.match(/甲醇.*(重組|裂解)/) || n.match(/SMR.*甲醇/)) return n.includes('裂解') ? '甲醇裂解' : '甲醇重組';
    if (n.includes('SMR')) return 'SMR'; 
    // [NEW] LPG/輕油重組
    if (n.match(/(LPG|液化石油氣|輕油|NAPHTHA).*重組/)) return '輕油重組'; 
    
    // 副產氫製程
    if (n.match(/(輕油|裂解|乙烯|三輕|四輕)/)) return '輕油裂解';
    if (n.match(/(觸媒|重組)/)) return '觸媒重組'; // SMR/輕油重組已在上被攔截，這裡剩下觸媒重組
    if (n.match(/(鹼氯|碱氯|氯)/)) return '鹼氯製程';
    if (n.match(/(芳烃|芳香烴)/)) return '芳烃製程';
    if (n.match(/(脫氫|PDH)/)) return '脫氫反應'; 
    if (n.includes('苯乙烯') || n.includes('SM')) return '苯乙烯製程';
    if (n.includes('丁酮')) return '丁酮製程';
    if (n.match(/(回收|純化|PSA)/)) return '氫氣回收純化';
    
    if (n.includes('電解')) return '電解'; // 通常視為 Main

    return '其他製程';
};

const getProcessType = (processName) => {
    // 定義主產氫清單
    const mainList = ['天然氣重組', '甲醇重組', 'SMR', '甲醇裂解', '電解', '輕油重組'];
    return mainList.includes(processName) ? '主產' : '副產';
};

// ** 需求端分類邏輯 (V45.0 Sync) **
const identifyUsage = (rawName) => {
    const n = (rawName || '').toUpperCase().trim();
    
    // 1. 加氫脫硫 / 煉油
    if (n.match(/(脫硫|HDS|加氫脫硫|硫磺|尾氣)/)) return '加氫脫硫';
    if (n.match(/(三輕|四輕|裂解反應)/)) return '其他煉油相關';

    // 2. 燃料燃燒
    if (n.match(/(燃燒|燃料|發電|鍋爐|混氫)/)) return '燃料燃燒';

    // 3. 化學製程 (詳細分類)
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
    if (n.includes('EUV') || n.includes('半導體')) return '半導體製程'; // 歸類為廣義化工或電子化學
    
    // 通用化學捕捉
    if (n.match(/(氫化|化學|合成|還原|苯|胺|醇|酸|SM|MA|PTA|VAM)/)) return '其他化學製程';

    return '其他用途';
};

const getUsageCategory = (identifiedName) => {
    if (['加氫脫硫', '硫磺尾氣處理', '其他煉油相關'].includes(identifiedName)) return '煉油';
    if (['燃料燃燒'].includes(identifiedName)) return '燃燒';
    
    // 其餘皆為化工
    return '化工';
};

const getLocation = (plantName) => {
    const n = (plantName || '').trim();
    for (const loc of LOCATION_MAPPING) {
        if (loc.keywords.some(k => n.includes(k))) return loc;
    }
    return null;
};

// ** 區域判讀 (對應新資料庫 "區域" 欄位) **
const getRegion = (plantName) => {
    const n = String(plantName);
    if (n.match(/(台北|新北|桃園|新竹|苗栗|大園|觀音)/)) return '北區';
    if (n.match(/(台中|彰化|南投|雲林|麥寮)/)) return '中區';
    if (n.match(/(嘉義|台南|高雄|屏東|大社|仁武|林園|小港)/)) return '南區';
    if (n.match(/(宜蘭|花蓮|台東)/)) return '東區'; // 或歸類在其他?
    return '其他';
};

const parseHydrogenCSV = (text) => {
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

const normalizeHydrogenData = (rawData, type = 'supply') => {
    const normalized = [];
    rawData.forEach(row => {
        // Skip Summary Rows
        const company = getH2Value(row, 'Company', '公司', '廠商');
        
        // [Updated] 加強過濾總計列 (Total Summary Row)
        if (!company || 
            company === 'TOTAL_SUMMARY' || 
            company === 'Total' || 
            company.toUpperCase().includes('SUMMARY') ||
            company.includes('總計') ||
            company.includes('合計')
        ) return;

        const plant = getH2Value(row, 'Plant', '廠區', '工廠');
        // Extract Region and Note
        const regionFromDB = getH2Value(row, 'Region', '區域', 'Region');
        const region = regionFromDB ? regionFromDB.replace('部', '區') : getRegion(plant); // 標準化為 "北區" etc.
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
                        Region: region, // Add Region
                        Note: note,     // Add Note
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

const stringToColor = (str) => {
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

// ==========================================
// 3. 子組件 (Sub-Components)
// ==========================================

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  componentDidCatch(error, errorInfo) { console.error("Chart Error:", error); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded text-slate-400">
          <AlertTriangle size={32} className="mb-2 text-amber-400" />
          <p className="text-sm">圖表資料異常</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const CustomTimeTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const event = GLOBAL_EVENTS.find(e => label && (label === e.date || label.startsWith(e.date) || (label.length === 4 && e.date.startsWith(label))));
        return (
            <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-xl z-50 text-xs">
                <p className="font-bold text-slate-800 mb-2 border-b pb-1">{label}</p>
                {event && (
                    <div className="mb-2 p-1.5 bg-red-50 border border-red-200 rounded text-red-800">
                        <div className="flex items-center gap-1 font-bold"><Newspaper size={10}/> {event.label}</div>
                        <div>{event.desc}</div>
                    </div>
                )}
                {payload.map((entry, index) => (
                    <div key={index} className="flex justify-between gap-3 mb-1" style={{ color: entry.color }}>
                        <span>{entry.name}:</span>
                        <span className="font-mono font-medium">
                            {entry.name.includes('單價') ? (entry.value || 0).toLocaleString() : 
                             entry.name.includes('重量') ? formatSmartWeight(entry.value) : 
                             (entry.value || 0).toLocaleString()}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  
  const flag = getCountryFlag(name);

  return (
    <text x={x} y={y} fill="#374151" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11}>
      {`${flag} ${name}`} {(percent * 100).toFixed(0)}%
    </text>
  );
};

const KPICard = ({ title, value, subtext, trend, icon: Icon, color }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between hover:shadow-md transition-shadow">
    <div>
      <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
      <div className={`flex items-center mt-2 text-sm ${trend === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}>
        {trend === 'up' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
        <span className="ml-1 font-medium">{subtext}</span>
      </div>
    </div>
    <div className={`p-3 rounded-lg ${color}`}>{Icon ? <Icon size={24} className="text-white" /> : null}</div>
  </div>
);

const MultiSelectDropdown = ({ options, selected, onChange, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const groupedOptions = useMemo(() => {
        const groups = {};
        options.forEach(opt => {
            const g = opt.group || '其他';
            if (!groups[g]) groups[g] = [];
            groups[g].push(opt);
        });
        return groups;
    }, [options]);

    const toggleOption = (code) => {
        if (selected.includes(code)) onChange(selected.filter(c => c !== code));
        else onChange([...selected, code]);
    };

    const toggleGroup = (groupName) => {
        const groupItems = groupedOptions[groupName].map(i => i.code);
        const allSelected = groupItems.every(c => selected.includes(c));
        if (allSelected) onChange(selected.filter(c => !groupItems.includes(c)));
        else {
            const newSelected = new Set([...selected, ...groupItems]);
            onChange(Array.from(newSelected));
        }
    };

    return (
        <div className="relative" ref={containerRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${selected.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
            >
                <CheckSquare size={16}/>
                <span className="font-medium truncate max-w-[200px]">
                    {selected.length === 0 ? `選擇${label}` : `已選 ${selected.length} 項`}
                </span>
                <ChevronDown size={14}/>
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto p-2">
                    <div className="flex justify-between mb-2 pb-2 border-b border-slate-100">
                        <button onClick={() => onChange(options.map(o => o.code))} className="text-xs text-blue-600 hover:underline">全選</button>
                        <button onClick={() => onChange([])} className="text-xs text-slate-500 hover:underline">清除</button>
                    </div>
                    {Object.entries(groupedOptions).map(([group, items]) => {
                        const groupCodes = items.map(i => i.code);
                        const isGroupAll = groupCodes.every(c => selected.includes(c));
                        const isGroupPartial = !isGroupAll && groupCodes.some(c => selected.includes(c));
                        return (
                            <div key={group} className="mb-3">
                                <div className="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded cursor-pointer hover:bg-slate-100" onClick={() => toggleGroup(group)}>
                                    {isGroupAll ? <CheckSquare size={14} className="text-blue-600"/> : isGroupPartial ? <Square size={14} className="text-blue-600 fill-blue-600 opacity-50"/> : <Square size={14} className="text-slate-400"/>}
                                    <span className="text-xs font-bold text-slate-700">{group}</span>
                                </div>
                                <div className="pl-4 mt-1 space-y-0.5">
                                    {items.map(item => (
                                        <div key={item.code} className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-blue-50" onClick={() => toggleOption(item.code)}>
                                            <div className={`w-3 h-3 border rounded flex items-center justify-center ${selected.includes(item.code) ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                                                {selected.includes(item.code) && <CheckSquare size={10} className="text-white"/>}
                                            </div>
                                            <span className="text-xs text-slate-600 truncate">{item.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const IndustrialMap = ({ data, onSelect }) => {
    const locData = useMemo(() => {
        const map = {};
        data.forEach(d => {
           const loc = getLocation(d.Plant) || { name: '其他', cx: 250, cy: 300, region: '其他' };
           if(!map[loc.name]) map[loc.name] = { ...loc, value: 0, plants: new Set() };
           map[loc.name].value += (d.Output_Tons || 0);
           map[loc.name].plants.add(getSimplePlantName(d.Company, d.Plant));
        });
        return Object.values(map);
    }, [data]);

    return (
        <div className="relative w-full h-full flex items-center justify-center bg-slate-100 rounded-xl border border-slate-200 overflow-hidden">
            <svg viewBox="0 0 300 350" className="w-full h-full max-w-[300px] drop-shadow-xl">
                <path d={TAIWAN_REGIONS_PATHS.NORTH} fill="#e0f2fe" stroke="#94a3b8" strokeWidth="1" />
                <path d={TAIWAN_REGIONS_PATHS.CENTRAL} fill="#f0fdf4" stroke="#94a3b8" strokeWidth="1" />
                <path d={TAIWAN_REGIONS_PATHS.SOUTH} fill="#fff7ed" stroke="#94a3b8" strokeWidth="1" />
                <path d={TAIWAN_REGIONS_PATHS.EAST} fill="#f5f3ff" stroke="#94a3b8" strokeWidth="1" />
                
                {locData.map(loc => {
                   if(loc.value === 0) return null;
                   const radius = Math.min(Math.sqrt(loc.value) * 5 + 5, 25);
                   const plantList = Array.from(loc.plants).join(', ');
                   return (
                     <g key={loc.name} onClick={() => onSelect(loc.name)} className="cursor-pointer hover:opacity-80 transition-opacity">
                       <title>{`${loc.name}: ${loc.value.toFixed(1)} 萬噸\n(${plantList})`}</title>
                       <circle cx={loc.cx} cy={loc.cy} r={radius} fill="#3b82f6" fillOpacity="0.8" stroke="white" strokeWidth="2"/>
                       <text x={loc.cx} y={loc.cy} dy={-radius-5} textAnchor="middle" fontSize="10" fill="#1e293b" fontWeight="bold" style={{textShadow: '0px 0px 2px white'}}>{loc.name}</text>
                       <text x={loc.cx} y={loc.cy} dy={4} textAnchor="middle" fontSize="9" fill="white">{(loc.value).toFixed(1)}</text>
                     </g>
                   );
                })}
            </svg>
            <div className="absolute bottom-2 right-2 text-[10px] text-slate-500 bg-white/80 px-2 rounded flex flex-col items-end">
                <span>單位: 萬噸</span>
                <span className="text-[9px] text-slate-400">* 點擊圓點可篩選</span>
            </div>
        </div>
    );
};

// 自訂 X 軸標籤組件
const CustomXAxisTick = ({ x, y, payload, data }) => {
    // 嘗試從 data 中找到對應的項目
    // 如果 data 是陣列，我們需要找到 payload.value 對應的項目
    // 這裡的 payload.value 是 shortName。但可能有重複的 shortName。
    // Recharts 的 CartesianGrid 會傳遞 payload.index。
    const item = data && data[payload.index];
    const company = item ? item.company : '';
    
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={16} textAnchor="end" fill="#374151" transform="rotate(-35)" fontSize={11} fontWeight="500">
          {payload.value}
        </text>
        <text x={0} y={0} dy={28} textAnchor="end" fill="#64748b" transform="rotate(-35)" fontSize={9}>
          [{company}]
        </text>
      </g>
    );
};


const HydrogenSurvey = () => {
  const [supplyData, setSupplyData] = useState([]);
  const [demandData, setDemandData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [viewMode, setViewMode] = useState('dashboard');
  const [statusMsg, setStatusMsg] = useState('');
  const [rawData, setRawData] = useState({ supply: [], demand: [] }); 

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [resP, resU] = await Promise.all([
          fetch(H2_DATA_SOURCES.PRODUCTION),
          fetch(H2_DATA_SOURCES.USAGE)
        ]);

        if (!resP.ok || !resU.ok) throw new Error("Network Error");

        const txtP = await resP.text();
        const txtU = await resU.text();
        const parsedP = parseHydrogenCSV(txtP);
        const parsedU = parseHydrogenCSV(txtU);
        
        setRawData({ supply: parsedP, demand: parsedU });

        if (parsedP.length === 0 && parsedU.length === 0) throw new Error("Empty Data");

        const normP = normalizeHydrogenData(parsedP, 'supply');
        const normU = normalizeHydrogenData(parsedU, 'demand');

        if (normP.length === 0 && normU.length === 0) throw new Error("Normalization Empty");

        setSupplyData(normP);
        setDemandData(normU);
        setIsFallback(false);
        setStatusMsg(`成功載入: 供給 ${normP.length} 筆, 需求 ${normU.length} 筆`);

      } catch (e) {
        console.error("Using Mock Data", e);
        setSupplyData(normalizeHydrogenData(MOCK_SUPPLY_MATRIX, 'supply'));
        setDemandData(normalizeHydrogenData(MOCK_DEMAND_MATRIX, 'demand'));
        setIsFallback(true);
        setStatusMsg(`使用備用資料 (原因: ${e.message})`);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const availableYears = useMemo(() => {
      const years = new Set([...supplyData.map(d => d.Year), ...demandData.map(d => d.Year)]);
      return Array.from(years).sort();
  }, [supplyData, demandData]);

  useEffect(() => {
      if (availableYears.length > 0 && selectedYear === 'ALL') {
          setSelectedYear(availableYears[availableYears.length - 1]);
      }
  }, [availableYears]);

  const filteredSupply = useMemo(() => supplyData.filter(d => (selectedYear === 'ALL' || d.Year === selectedYear) && (!selectedLocation || getLocation(d.Plant)?.name === selectedLocation)), [supplyData, selectedYear, selectedLocation]);
  const filteredDemand = useMemo(() => demandData.filter(d => (selectedYear === 'ALL' || d.Year === selectedYear) && (!selectedLocation || getLocation(d.Plant)?.name === selectedLocation)), [demandData, selectedYear, selectedLocation]);

  // ** 區域重心聚合 (供給+需求) **
  const aggregatedH2Balance = useMemo(() => {
      const balanceMap = {}; 
      
      // 1. Sum Supply
      supplyData.filter(d => d.Year === selectedYear).forEach(p => {
          const region = p.Region || getRegion(p.Plant); // Use Region from DB
          if(!balanceMap[region]) balanceMap[region] = { region, supply: 0, demand: 0 };
          balanceMap[region].supply += (p.Output_Tons || 0);
      });

      // 2. Sum Demand
      demandData.filter(d => d.Year === selectedYear).forEach(u => {
          const region = u.Region || getRegion(u.Plant); // Use Region from DB
          if(!balanceMap[region]) balanceMap[region] = { region, supply: 0, demand: 0 };
          balanceMap[region].demand += (u.Demand_Tons || 0);
      });

      // Filter: only specific regions + other
      const targetRegions = ['北區', '中區', '南區', '其他'];
      return targetRegions.map(r => balanceMap[r] || { region: r, supply: 0, demand: 0 });
  }, [supplyData, demandData, selectedYear]);

  const { supplyTrendChart, supplyKeys, demandTrendChart, demandKeys, balanceStats } = useMemo(() => {
      const defaultStats = { sMain:0, sBy:0, dRefine:0, dChem:0, dFuel:0, sTotal:0, dTotal:0 };
      
      const processStackData = (data, valueKey, labelKeyFn) => {
          const map = {};
          const totals = {}; 
          
          data.forEach(d => {
              const y = d.Year;
              const key = labelKeyFn(d);
              const val = (d[valueKey] || 0);

              if(!map[y]) map[y] = { year: y };
              map[y][key] = (map[y][key] || 0) + val;
              totals[key] = (totals[key] || 0) + val;
          });

          const sortedKeys = Object.entries(totals).sort((a,b)=>b[1]-a[1]);
          const topKeys = sortedKeys.slice(0, 15).map(k=>k[0]);
          const hasOthers = sortedKeys.length > 15;

          const finalData = Object.values(map).map(row => {
              const newRow = { year: row.year };
              let otherTotal = 0;
              Object.keys(row).forEach(k => {
                  if (k === 'year') return;
                  const val = row[k];
                  if (topKeys.includes(k)) {
                      newRow[k] = val;
                  } else {
                      if (val > 0.1) otherTotal += val; 
                  }
              });
              if (otherTotal > 0) newRow['其他廠商'] = otherTotal;
              return newRow;
          });

          return { 
              chartData: finalData.sort((a,b)=>a.year-b.year), 
              finalKeys: hasOthers ? [...topKeys, '其他廠商'] : topKeys 
          };
      };

      const sData = processStackData(supplyData, 'Output_Tons', d => simplifyCompanyName(d.Company));
      const dData = processStackData(demandData, 'Demand_Tons', d => simplifyCompanyName(d.Company));
      
      let stats = { ...defaultStats };
      
      filteredSupply.forEach(d => {
          if (getProcessType(d.Process) === '主產') stats.sMain += d.Output_Tons; else stats.sBy += d.Output_Tons;
      });
      
      filteredDemand.forEach(d => {
          const cat = getUsageCategory(identifyUsage(d.Usage_Type));
          if (cat==='煉油') stats.dRefine += d.Demand_Tons;
          else if (cat==='化工') stats.dChem += d.Demand_Tons;
          else stats.dFuel += d.Demand_Tons;
      });
      stats.sTotal = stats.sMain + stats.sBy;
      stats.dTotal = stats.dRefine + stats.dChem + stats.dFuel;

      return {
          supplyTrendChart: sData.chartData,
          supplyKeys: sData.finalKeys,
          demandTrendChart: dData.chartData,
          demandKeys: dData.finalKeys,
          balanceStats: stats
      };
  }, [supplyData, demandData, filteredSupply, filteredDemand, selectedYear]);

  const capacityChartData = useMemo(() => {
      const map = {};
      filteredSupply.forEach(d => {
          const key = getSimplePlantName(d.Company, d.Plant);
          const company = simplifyCompanyName(d.Company);
          let shortName = d.Plant.replace(/股份有限公司|工業區|工業|廠/g, '').replace(/煉製事業部|石化事業部/g, '').trim() + '廠';
          
          if(!map[key]) map[key] = { name: key, company, shortName, output: 0, capacity: 0 };
          map[key].output += (d.Output_Tons || 0);
          map[key].capacity += (d.Capacity_Tons || 0);
          if(map[key].capacity < map[key].output) map[key].capacity = map[key].output;
      });

      return Object.values(map)
          .map(d => ({
              ...d,
              output: d.output,
              idle: (d.capacity - d.output),
              rate: d.capacity > 0 ? (d.output/d.capacity*100).toFixed(0) : 0
          }))
          .sort((a,b) => {
              if (a.company !== b.company) return a.company.localeCompare(b.company);
              return (b.output + b.idle) - (a.output + a.idle);
          });
  }, [filteredSupply]);

  const supplyHierarchy = useMemo(() => {
      const l1Map = {};
      const l2Map = {};
      
      filteredSupply.forEach(d => {
          const pName = identifyProcess(d.Process);
          const type = getProcessType(pName);
          const val = (d.Output_Tons || 0);
          
          if (!l1Map[type]) l1Map[type] = 0;
          l1Map[type] += val;
          
          if (!l2Map[pName]) l2Map[pName] = { name: pName, value: 0, type };
          l2Map[pName].value += val;
      });

      return {
          l1: Object.entries(l1Map).map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value),
          l2: Object.values(l2Map).sort((a,b)=>b.value-a.value)
      };
  }, [filteredSupply]);

  const demandHierarchy = useMemo(() => {
      const l1Map = {};
      const l2Map = {};
      
      filteredDemand.forEach(d => {
          // Use Usage_Type which contains specific process name
          const uName = identifyUsage(d.Usage_Type);
          const type = getUsageCategory(uName);
          const val = (d.Demand_Tons || 0);
          
          if (!l1Map[type]) l1Map[type] = 0;
          l1Map[type] += val;
          
          if (!l2Map[uName]) l2Map[uName] = { name: uName, value: 0, type };
          l2Map[uName].value += val;
      });

      return {
          l1: Object.entries(l1Map).map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value),
          l2: Object.values(l2Map).sort((a,b)=>b.value-a.value)
      };
  }, [filteredDemand]);

  const efficiencyChartData = useMemo(() => {
      const plantMap = {};
      filteredSupply.forEach(d => {
          const key = getSimplePlantName(d.Company, d.Plant);
          if(!plantMap[key]) plantMap[key] = { name: key, output: 0, total_emission: 0, intensity: 0 };
          plantMap[key].output += d.Output_Tons || 0;
          
          const currentIntensity = d.Carbon_Intensity || 0;
          if (currentIntensity > 0) {
              plantMap[key].intensity = currentIntensity; 
          }
          
          plantMap[key].total_emission += (d.Output_Tons || 0) * (d.Carbon_Intensity || 0);
      });
      // Filter out intensity > 0
      return Object.values(plantMap)
          .filter(d => d.output > 0 && d.intensity > 0)
          .sort((a,b) => b.output - a.output);
  }, [filteredSupply]);

  const { topEmitters, scatterData } = useMemo(() => {
      const list = efficiencyChartData;
      return {
          topEmitters: [...list].sort((a,b) => b.total_emission - a.total_emission).slice(0, 10),
          scatterData: list
      };
  }, [efficiencyChartData]);

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return percent > 0.05 ? (
      <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={10}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    ) : null;
  };

  const renderRawTable = (data, title) => {
      if(!data || data.length === 0) return <div className="text-slate-400 p-2">無數據</div>;
      const headers = Object.keys(data[0]);
      return (
          <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col h-[500px]">
              <div className="p-3 bg-slate-50 border-b font-bold text-slate-700 flex justify-between items-center">
                  <span>{title} ({data.length}筆)</span>
                  <div className="flex gap-2 text-xs font-normal text-slate-500">
                      <span>欄位檢查:</span>
                      {headers.some(h=>h.includes('產量')||h.includes('Output')) ? <span className="text-emerald-600 flex items-center"><CheckCircle size={10}/>產量</span> : <span className="text-red-400">缺產量</span>}
                      {headers.some(h=>h.includes('碳排')||h.includes('Carbon')||h.includes('CO2')) ? <span className="text-emerald-600 flex items-center"><CheckCircle size={10}/>碳排</span> : <span className="text-red-400">缺碳排</span>}
                  </div>
              </div>
              <div className="overflow-auto flex-1">
                  <table className="w-full text-xs text-left whitespace-nowrap">
                      <thead className="bg-slate-100 sticky top-0">
                          <tr>{headers.map(h=><th key={h} className="p-2 border-b">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                          {data.map((row, i) => (
                              <tr key={i} className="hover:bg-blue-50 border-b">
                                  {headers.map(h=><td key={h} className="p-2 border-r last:border-r-0">{row[h]}</td>)}
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      );
  };

  if (loading) return <div className="p-10 text-center animate-pulse text-slate-500">氫能數據載入中...</div>;

  return (
    <div className="space-y-8 p-4 bg-slate-50 rounded-lg animate-fade-in relative">
       <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Factory className="text-blue-600"/> 氫能供需戰情室</h2>
              <div className="flex items-center gap-2 text-sm bg-slate-100 px-3 py-1 rounded-full">
                  <Calendar size={14}/>
                  <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="bg-transparent font-bold text-blue-700 outline-none">
                      {availableYears.map(y => <option key={y} value={y}>{y}年</option>)}
                  </select>
              </div>
              {selectedLocation && <button onClick={()=>setSelectedLocation(null)} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">清除地點: {selectedLocation}</button>}
           </div>
           <div className="flex items-center gap-3">
             <span className="text-xs text-slate-400">{statusMsg}</span>
             {isFallback && <span className="text-xs text-amber-600 flex items-center gap-1"><AlertCircle size={12}/> 模擬數據模式</span>}
             <div className="flex bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setViewMode('dashboard')} className={`px-3 py-1.5 text-xs font-bold rounded-md ${viewMode==='dashboard'?'bg-white shadow text-blue-600':'text-slate-500'}`}>儀表板</button>
                <button onClick={() => setViewMode('data')} className={`px-3 py-1.5 text-xs font-bold rounded-md ${viewMode==='data'?'bg-white shadow text-blue-600':'text-slate-500'}`}>原始資料</button>
             </div>
           </div>
       </div>

       {viewMode === 'dashboard' ? (
           <>
             <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                 <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-[300px]">
                     <h3 className="font-bold text-slate-700 text-sm mb-2 flex items-center gap-2"><Database size={16}/> 歷年供給來源 (堆疊)</h3>
                     <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={supplyTrendChart}>
                             <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                             <XAxis dataKey="year" tick={{fontSize:12}}/>
                             <YAxis label={{ value: '萬噸', angle: -90, position: 'insideLeft' }} />
                             <Tooltip formatter={val=>Number(val).toFixed(2)+' 萬噸'}/>
                             <Legend wrapperStyle={{fontSize:'10px'}}/>
                             {supplyKeys && supplyKeys.map((k,i) => (
                                 <Bar key={k} dataKey={k} stackId="a" fill={stringToColor(k)} name={k} />
                             ))}
                         </BarChart>
                     </ResponsiveContainer>
                 </div>
                 
                 <div className="lg:col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center h-[300px]">
                     <h3 className="font-bold text-slate-700 text-sm mb-4">區域氫能供需平衡 ({selectedYear})</h3>
                     <div className="flex-1 w-full relative">
                         <ResponsiveContainer>
                             <BarChart data={aggregatedH2Balance}>
                                 <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                 <XAxis dataKey="region" tick={{fontSize:10}} />
                                 <YAxis tick={{fontSize:10}} />
                                 <Tooltip cursor={{fill: 'transparent'}} />
                                 <Legend wrapperStyle={{fontSize: '10px'}} />
                                 <Bar dataKey="supply" name="供給" fill="#3b82f6" />
                                 <Bar dataKey="demand" name="需求" fill="#f59e0b" />
                             </BarChart>
                         </ResponsiveContainer>
                     </div>
                 </div>

                 <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-[300px]">
                     <h3 className="font-bold text-slate-700 text-sm mb-2 flex items-center gap-2"><Activity size={16} className="text-emerald-500"/> 歷年需求流向 (堆疊)</h3>
                     <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={demandTrendChart}>
                             <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                             <XAxis dataKey="year" tick={{fontSize:12}}/>
                             <YAxis orientation="right" />
                             <Tooltip formatter={val=>(val).toFixed(1)+' 萬噸'}/>
                             <Legend wrapperStyle={{fontSize:'10px'}}/>
                             {demandKeys && demandKeys.map((k,i) => (
                                 <Bar key={k} dataKey={k} stackId="a" fill={stringToColor(k)} name={k} />
                             ))}
                         </BarChart>
                     </ResponsiveContainer>
                 </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-[400px]">
                     <h3 className="font-bold text-slate-700 mb-4 flex justify-between">
                         <span className="flex items-center gap-2"><Factory size={16} className="text-blue-500"/> 產能稼動率 (依公司分組)</span>
                         <span className="text-xs font-normal text-slate-500">單位：萬噸/年</span>
                     </h3>
                     <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={capacityChartData} margin={{top:20, bottom:60, right:20}}>
                             <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                             <XAxis 
                               dataKey="shortName" 
                               interval={0} 
                               angle={0} 
                               height={80} 
                               tick={<CustomXAxisTick data={capacityChartData} />}
                             />
                             <YAxis scale="sqrt" label={{ value: '萬噸', angle: -90, position: 'insideLeft' }} />
                             <Tooltip formatter={(val, name, props) => {
                                 if (name === 'output') return [val.toFixed(1), `產量 (${props.payload.company})`];
                                 if (name === 'idle') return [val.toFixed(1), `閒置 (${props.payload.company})`];
                                 return [val, name];
                             }} />
                             <Legend verticalAlign="top" align="right" />
                             <Bar dataKey="output" name="產量" stackId="a" fill="#3b82f6" />
                             <Bar dataKey="idle" name="閒置" stackId="a" fill="#e2e8f0" />
                         </BarChart>
                     </ResponsiveContainer>
                 </div>

                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col relative h-[400px]">
                     <div className="absolute top-4 left-4 z-10 bg-white/90 p-2 rounded shadow text-xs">
                         <h4 className="font-bold text-slate-700">區域重心 (供給)</h4>
                         <p className="text-slate-500">點擊圓點篩選</p>
                     </div>
                     <div className="flex-1 flex items-center justify-center">
                         <IndustrialMap data={filteredSupply} onSelect={setSelectedLocation} />
                     </div>
                 </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
                     <h3 className="font-bold text-slate-700 text-sm mb-2 border-b pb-2">供給結構 (內圈:主副 / 外圈:製程)</h3>
                     <div className="flex-1 h-[200px]">
                         <ResponsiveContainer>
                             <PieChart>
                                 <Pie data={supplyHierarchy.l1} cx="50%" cy="50%" outerRadius={50} dataKey="value" labelLine={false}>
                                     {supplyHierarchy.l1.map((e, i) => <Cell key={i} fill={COLORS_PROCESS[e.name] || '#94a3b8'} />)}
                                 </Pie>
                                 <Pie data={supplyHierarchy.l2} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={renderCustomizedLabel}>
                                     {supplyHierarchy.l2.map((e, i) => <Cell key={i} fill={COLORS_PROCESS[e.name] || '#94a3b8'} />)}
                                 </Pie>
                                 <Tooltip formatter={v=>(v).toFixed(2)+' 萬噸'}/>
                             </PieChart>
                         </ResponsiveContainer>
                     </div>
                     <div className="h-40 overflow-y-auto custom-scrollbar text-xs border-t pt-2">
                         <table className="w-full text-left">
                             <thead><tr className="text-slate-400"><th>製程</th><th className="text-right">類型</th><th className="text-right">萬噸</th></tr></thead>
                             <tbody>
                                 {supplyHierarchy.l2.map((e,i)=>(
                                     <tr key={i} className="hover:bg-slate-50">
                                         <td className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{backgroundColor:COLORS_PROCESS[e.name]||'#94a3b8'}}></div>{e.name}</td>
                                         <td className="text-right text-slate-500">{e.type}</td>
                                         <td className="text-right font-mono">{e.value.toFixed(2)}</td>
                                     </tr>
                                 ))}
                             </tbody>
                         </table>
                     </div>
                 </div>

                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
                     <h3 className="font-bold text-slate-700 text-sm mb-2 border-b pb-2">需求結構 (內圈:應用類 / 外圈:細項)</h3>
                     <div className="flex-1 h-[200px]">
                         <ResponsiveContainer>
                             <PieChart>
                                 <Pie data={demandHierarchy.l1} cx="50%" cy="50%" outerRadius={50} dataKey="value" labelLine={false}>
                                     {demandHierarchy.l1.map((e, i) => <Cell key={i} fill={COLORS_USAGE[e.name] || '#94a3b8'} />)}
                                 </Pie>
                                 <Pie data={demandHierarchy.l2} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={renderCustomizedLabel}>
                                     {demandHierarchy.l2.map((e, i) => <Cell key={i} fill={COLORS_USAGE[e.name] || '#94a3b8'} />)}
                                 </Pie>
                                 <Tooltip formatter={v=>(v).toFixed(2)+' 萬噸'}/>
                             </PieChart>
                         </ResponsiveContainer>
                     </div>
                     <div className="h-40 overflow-y-auto custom-scrollbar text-xs border-t pt-2">
                         <table className="w-full text-left">
                             <thead><tr className="text-slate-400"><th>用途</th><th className="text-right">分類</th><th className="text-right">萬噸</th></tr></thead>
                             <tbody>
                                 {demandHierarchy.l2.map((e,i)=>(
                                     <tr key={i} className="hover:bg-slate-50">
                                         <td className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{backgroundColor:COLORS_USAGE[e.name]||'#94a3b8'}}></div>{e.name}</td>
                                         <td className="text-right text-slate-500">{e.type}</td>
                                         <td className="text-right font-mono">{e.value.toFixed(2)}</td>
                                     </tr>
                                 ))}
                             </tbody>
                         </table>
                     </div>
                 </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
                     <h3 className="font-bold text-slate-700 text-sm mb-4 border-b pb-2 flex items-center gap-2"><Leaf size={14}/> 碳排強度矩陣 (X:產量 / Y:強度)</h3>
                     <div className="flex-1">
                         <ResponsiveContainer>
                             <ScatterChart margin={{top:20, right:20, bottom:20, left:20}}>
                                 <CartesianGrid />
                                 <XAxis type="number" dataKey="output" name="產量" unit="萬噸" tick={{fontSize:10}} />
                                 <YAxis type="number" dataKey="intensity" name="強度" unit="kg/kg" tick={{fontSize:10}} domain={[0, 'auto']} />
                                 <ZAxis type="number" dataKey="total_emission" range={[100, 1000]} />
                                 <Tooltip cursor={{strokeDasharray:'3 3'}} formatter={(v, n) => [v.toLocaleString(), n === 'total_emission' ? '總碳排(萬噸)' : n]} />
                                 <Scatter name="廠區" data={scatterData} fill="#10b981">
                                     <LabelList dataKey="name" position="top" style={{fontSize:9, fill:'#475569'}} />
                                     {scatterData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={
                                            entry.intensity > 15 ? '#ef4444' : // High Red
                                            entry.intensity > 8 ? '#f59e0b' :  // Mid Amber
                                            '#10b981'                          // Low Green
                                        } />
                                     ))}
                                 </Scatter>
                             </ScatterChart>
                         </ResponsiveContainer>
                     </div>
                 </div>

                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
                     <h3 className="font-bold text-slate-700 text-sm mb-4 border-b pb-2 flex items-center gap-2"><Zap size={14}/> 產能 vs 碳排強度對照</h3>
                     <div className="flex-1">
                         <ResponsiveContainer>
                             <ComposedChart data={efficiencyChartData} margin={{top:20, right:20, bottom:20, left:20}}>
                                 <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                 <XAxis dataKey="name" angle={-30} textAnchor="end" height={60} tick={{fontSize:10}} interval={0}/>
                                 <YAxis yAxisId="left" label={{ value: '產量(萬噸)', angle: -90, position: 'insideLeft' }} />
                                 <YAxis yAxisId="right" orientation="right" label={{ value: '強度(kg/kg)', angle: 90, position: 'insideRight' }} />
                                 <Tooltip />
                                 <Legend />
                                 <Bar yAxisId="left" dataKey="output" name="產量" fill="#3b82f6" barSize={20} />
                                 <Line yAxisId="right" type="monotone" dataKey="intensity" name="碳排強度" stroke="#ef4444" strokeWidth={2} />
                             </ComposedChart>
                         </ResponsiveContainer>
                     </div>
                 </div>
             </div>

           </>
       ) : (
           <div className="p-6 bg-white rounded-xl shadow overflow-auto h-[600px]">
               <h3 className="font-bold mb-4">原始數據檢視與診斷</h3>
               <div className="grid grid-cols-2 gap-6">
                   {renderRawTable(rawData.supply, "供給端原始資料")}
                   {renderRawTable(rawData.demand, "需求端原始資料")}
               </div>
               <div className="mt-6 p-4 bg-blue-50 rounded border border-blue-200 text-sm text-slate-700">
                   <h4 className="font-bold mb-2 flex items-center gap-2"><Info size={16}/> Google Sheet 優化建議</h4>
                   <ul className="list-disc list-inside space-y-1">
                       <li>**欄位名稱統一**: 建議將「112」改為「112年產量」或「112年用量」，避免程式誤判。</li>
                       <li>**碳排係數**: 確保每一列都有「單位碳排」或「Carbon_Intensity」，目前缺漏的會顯示為 0。</li>
                       <li>**廠區名稱**: 若能統一使用「公司名稱」+「廠區」分開的欄位會更精準。目前已自動簡化名稱。</li>
                   </ul>
               </div>
           </div>
       )}
    </div>
  );
};

// ==========================================
// 5. 貿易儀表板主程式 (TradeDashboard)
// ==========================================

const TradeDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview'); 
  const [showConfigModal, setShowConfigModal] = useState(false);

  const [searchQuery, setSearchQuery] = useState('280300'); 
  const [inputValue, setInputValue] = useState('280300'); 
  const [dataset, setDataset] = useState([]); 
  const [displayData, setDisplayData] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef(null);
  
  const [dataSources, setDataSources] = useState([
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQTBhte4P7bzMFSTlYDml3F25Wcr-sYfC7aOWQiePkfid7f2xBR-WUDMN7NAO3Z2e24Po14dqG7ZxnK/pub?gid=1075035870&single=true&output=csv',
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQTBhte4P7bzMFSTlYDml3F25Wcr-sYfC7aOWQiePkfid7f2xBR-WUDMN7NAO3Z2e24Po14dqG7ZxnK/pub?gid=111460997&single=true&output=csv',
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQTBhte4P7bzMFSTlYDml3F25Wcr-sYfC7aOWQiePkfid7f2xBR-WUDMN7NAO3Z2e24Po14dqG7ZxnK/pub?gid=9883438&single=true&output=csv',
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vRzjXsv2ydCw4O_eDQvunQkn1UWxTNaW7ejOaf3EcDrWCZZzTK1i6u6mJ3KSVkowRjaMVNUnYdA45Bx/pub?gid=1882060232&single=true&output=csv',
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vRzjXsv2ydCw4O_eDQvunQkn1UWxTNaW7ejOaf3EcDrWCZZzTK1i6u6mJ3KSVkowRjaMVNUnYdA45Bx/pub?gid=1951510622&single=true&output=csv',
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vRzjXsv2ydCw4O_eDQvunQkn1UWxTNaW7ejOaf3EcDrWCZZzTK1i6u6mJ3KSVkowRjaMVNUnYdA45Bx/pub?gid=1940628234&single=true&output=csv',
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vRzjXsv2ydCw4O_eDQvunQkn1UWxTNaW7ejOaf3EcDrWCZZzTK1i6u6mJ3KSVkowRjaMVNUnYdA45Bx/pub?gid=1693737933&single=true&output=csv',
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vRzjXsv2ydCw4O_eDQvunQkn1UWxTNaW7ejOaf3EcDrWCZZzTK1i6u6mJ3KSVkowRjaMVNUnYdA45Bx/pub?gid=1407313243&single=true&output=csv',
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vRzjXsv2ydCw4O_eDQvunQkn1UWxTNaW7ejOaf3EcDrWCZZzTK1i6u6mJ3KSVkowRjaMVNUnYdA45Bx/pub?gid=698533804&single=true&output=csv',
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vRzjXsv2ydCw4O_eDQvunQkn1UWxTNaW7ejOaf3EcDrWCZZzTK1i6u6mJ3KSVkowRjaMVNUnYdA45Bx/pub?gid=54711180&single=true&output=csv',
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vRzjXsv2ydCw4O_eDQvunQkn1UWxTNaW7ejOaf3EcDrWCZZzTK1i6u6mJ3KSVkowRjaMVNUnYdA45Bx/pub?gid=2061649166&single=true&output=csv',
  ]);
  
  const [useRealData, setUseRealData] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [detectedProductName, setDetectedProductName] = useState('');
  const [inspectorCode, setInspectorCode] = useState('');

  const [timeRange, setTimeRange] = useState(120); 
  const [granularity, setGranularity] = useState('month'); 
  const [countryViewType, setCountryViewType] = useState('出口'); 
  const [countryMetric, setCountryMetric] = useState('value'); 
  const [countryTopN, setCountryTopN] = useState('5'); 
  const [pivotMode, setPivotMode] = useState('time'); 
  const [topicMetric, setTopicMetric] = useState('value');
  const [currentTopic, setCurrentTopic] = useState(null); 
  const [selectedTopicCodes, setSelectedTopicCodes] = useState([]); 
  const [selectedRegion, setSelectedRegion] = useState('ALL'); 
  const [currencyUnit, setCurrencyUnit] = useState('thousand');
  const [topicChartLevel, setTopicChartLevel] = useState('hs2'); 
  const [trendViewMode, setTrendViewMode] = useState('summary');

  const [history, setHistory] = useState([
      { code: '280300', name: '碳黑' },
      { code: '2523', name: '水泥' }
  ]);
  const [watchedProducts, setWatchedProducts] = useState([]);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [dataHealth, setDataHealth] = useState({});

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) { setShowSuggestions(false); }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => { 
      if (useRealData && dataSources.length > 0 && dataset.length === 0) {
           fetchRealData();
      } else if (dataset.length > 0) {
           filterData(dataset, searchQuery); 
      }
  }, [useRealData, currentTopic, selectedTopicCodes]);

  const fetchRealData = async () => {
      setLoading(true); setFetchError(null);
      try {
          const responses = await Promise.all(dataSources.map(url => fetch(url).then(res => {
              if(!res.ok) throw new Error(`HTTP Error: ${res.status}`);
              return res.text();
          })));
          
          let combinedData = [];
          responses.forEach(text => {
              const { data } = parseCSV_Safe(text);
              combinedData = [...combinedData, ...data];
          });
          
          const health = {};
          combinedData.forEach(d => {
             const y = d.year;
             if(!health[y]) health[y] = { export: 0, import: 0 };
             if(d.type === '出口') health[y].export++;
             if(d.type === '進口') health[y].import++;
          });
          setDataHealth(health);

          const groups = {};
          combinedData.forEach(item => {
              const key = `${item.date}-${item.country}-${item.type}`;
              if (!groups[key]) groups[key] = [];
              groups[key].push(item);
          });

          const cleanDataset = [];
          Object.values(groups).forEach(groupItems => {
              groupItems.sort((a, b) => a.hsCode.length - b.hsCode.length);
              const keptItems = [];
              const keptCodes = new Set();
              groupItems.forEach(item => {
                  let isCovered = false;
                  for (let existingCode of keptCodes) {
                      if (item.hsCode.startsWith(existingCode)) { isCovered = true; break; }
                  }
                  if (!isCovered) {
                      keptItems.push(item);
                      keptCodes.add(item.hsCode);
                  }
              });
              cleanDataset.push(...keptItems);
          });

          cleanDataset.sort((a, b) => b.date.localeCompare(a.date));

          setDataset(cleanDataset);
          if (cleanDataset.length === 0) { setFetchError("所有來源皆無有效資料"); setUseRealData(false); }
          else filterData(cleanDataset, searchQuery);
          
      } catch (error) { setFetchError(error.message); setUseRealData(false); }
      setLoading(false);
  };

  const filterData = (allData, query) => {
      const aggMap = new Map();
      let targetCodes = [];
      let excludes = [];
      
      if (currentTopic) {
          if (selectedTopicCodes.length > 0) {
               targetCodes = selectedTopicCodes;
               selectedTopicCodes.forEach(code => {
                   const itemDef = STRATEGIC_TOPICS[currentTopic].items.find(i => i.code === code);
                   if(itemDef && itemDef.excludes) excludes.push(...itemDef.excludes);
               });
          } else {
               targetCodes = []; 
          }
      } else {
          targetCodes = [query];
      }

      const cleanQuery = normalizeCode(query).toLowerCase();

      allData.forEach(d => {
          let isMatch = false;
          const rawCleanCode = normalizeCode(d.hsCode);

          if (excludes.some(ex => rawCleanCode.startsWith(normalizeCode(ex)))) return;

          if (currentTopic) {
              isMatch = targetCodes.some(c => isHsCodeMatch(d.hsCode, c));
          } else {
              isMatch = isHsCodeMatch(d.hsCode, cleanQuery) || (d.productName && d.productName.toLowerCase().includes(cleanQuery));
          }

          if (isMatch) {
              const key = `${d.date}-${d.country}-${d.type}-${d.hsCode}`;
              if (!aggMap.has(key)) aggMap.set(key, { ...d });
              else {
                  const existing = aggMap.get(key);
                  existing.value += d.value;
                  existing.weight += d.weight;
              }
          }
      });

      const filtered = Array.from(aggMap.values());
      
      const relatedSet = new Set();
      if (!currentTopic) {
        filtered.forEach(d => relatedSet.add(d.hsCode));
      }
      const relatedList = Array.from(relatedSet).map(code => {
          const found = allData.find(d => d.hsCode === code);
          return { code, name: found ? found.productName : code };
      }).slice(0, 50); 
      setRelatedProducts(relatedList.sort((a, b) => a.code.localeCompare(b.code)));

      let displayTitle = '';
      if (currentTopic) {
          displayTitle = STRATEGIC_TOPICS[currentTopic].title;
          if (selectedTopicCodes.length > 0) {
              if (selectedTopicCodes.length === 1) {
                  const item = STRATEGIC_TOPICS[currentTopic].items.find(i => i.code === selectedTopicCodes[0]);
                  if (item) displayTitle += ` - ${item.name}`;
              } else {
                  displayTitle += ` (已選 ${selectedTopicCodes.length} 項)`;
              }
          }
      } else {
          const candidate = filtered.find(d => d.productName);
          displayTitle = candidate ? candidate.productName : '搜尋結果';
      }
      setDetectedProductName(displayTitle);
      setDisplayData(filtered);
  };

  const handleSearch = (overrideQuery, overrideName) => {
    const target = overrideQuery || inputValue;
    const nameToSave = overrideName || detectedProductName || target;
    setHistory(prev => {
        const newEntry = { code: target, name: nameToSave };
        const filtered = prev.filter(h => h.code !== target);
        return [newEntry, ...filtered].slice(0, 8);
    });
    if (useRealData && dataset.length > 0) filterData(dataset, target);
  };

  const filteredData = useMemo(() => {
    if (displayData.length === 0) return [];
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - timeRange);
    const cutoffStr = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth()+1).padStart(2,'0')}`;
    
    return displayData.filter(d => {
        if (d.date < cutoffStr) return false;
        if (selectedRegion !== 'ALL') {
            const countries = TRADE_REGIONS[selectedRegion].countries;
            return countries.some(c => d.country.includes(c));
        }
        return true;
    });
  }, [displayData, timeRange, selectedRegion]);

  const aggregatedData = useMemo(() => {
    const map = {};
    filteredData.forEach(d => {
      let key = d.date;
      if (granularity === 'year') key = d.year;
      else if (granularity === 'quarter') {
          const month = parseInt(d.date.split('-')[1]);
          const q = Math.floor((month + 2) / 3);
          key = `${d.year}-Q${q}`;
      }
      if (!map[key]) map[key] = { date: key, exportValue: 0, importValue: 0, exportWeight: 0, importWeight: 0, count: 0 };
      const isExport = d.type.includes('出') || d.type === 'E';
      if (isExport) { map[key].exportValue += d.value; map[key].exportWeight += d.weight; }
      else { map[key].importValue += d.value; map[key].importWeight += d.weight; }
      map[key].count += 1;
    });
    const result = Object.values(map).map(d => {
      const avgExportPrice = d.exportWeight > 0 ? (d.exportValue * 1000) / d.exportWeight : 0;
      const avgImportPrice = d.importWeight > 0 ? (d.importValue * 1000) / d.importWeight : 0;
      return {
        ...d,
        totalValue: d.exportValue + d.importValue,
        totalWeight: d.exportWeight + d.importWeight,
        tradeBalance: d.exportValue - d.importValue,
        tradeBalanceWeight: d.exportWeight - d.importWeight, 
        avgExportPrice: isFinite(avgExportPrice) ? parseFloat(avgExportPrice.toFixed(2)) : 0,
        avgImportPrice: isFinite(avgImportPrice) ? parseFloat(avgImportPrice.toFixed(2)) : 0
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
    return sanitizeForChart(result); 
  }, [filteredData, granularity]);

  const pivotCountryData = useMemo(() => {
      const map = {};
      filteredData.forEach(d => {
          const key = d.country;
          if (!map[key]) map[key] = { country: key, exportValue: 0, importValue: 0, exportWeight: 0, importWeight: 0 };
          const isExport = d.type.includes('出') || d.type === 'E';
          if (isExport) { map[key].exportValue += d.value; map[key].exportWeight += d.weight; }
          else { map[key].importValue += d.value; map[key].importWeight += d.weight; }
      });
      return Object.values(map).map(d => {
          const avgExport = d.exportWeight > 0 ? (d.exportValue * 1000)/d.exportWeight : 0;
          const avgImport = d.importWeight > 0 ? (d.importValue * 1000)/d.importWeight : 0;
          return {
            ...d,
            totalValue: d.exportValue + d.importValue,
            tradeBalance: d.exportValue - d.importValue,
            tradeBalanceWeight: d.exportWeight - d.importWeight,
            avgExportPrice: isFinite(avgExport) ? parseFloat(avgExport.toFixed(2)) : 0,
            avgImportPrice: isFinite(avgImport) ? parseFloat(avgImport.toFixed(2)) : 0,
          };
      }).sort((a, b) => b.totalValue - a.totalValue);
  }, [filteredData]);

  const countryPieData = useMemo(() => {
    const map = {};
    const isExportView = countryViewType === '出口';
    const isBalanceView = countryViewType === 'balance';
    
    if (isBalanceView) {
         filteredData.forEach(d => {
             if (!map[d.country]) map[d.country] = { name: d.country, value: 0 };
             map[d.country].value += (countryMetric === 'value' ? d.value : d.weight);
         });
    } else {
        filteredData.forEach(d => {
            const isExport = d.type.includes('出') || d.type === 'E';
            if (isExport === isExportView) {
                 if (!map[d.country]) map[d.country] = { name: d.country, value: 0 };
                 map[d.country].value += (countryMetric === 'value' ? d.value : d.weight);
            }
        });
    }
    const sorted = Object.values(map).sort((a, b) => b.value - a.value);
    const sliceIndex = countryTopN === 'all' ? undefined : parseInt(countryTopN);
    return sorted.slice(0, sliceIndex);
  }, [filteredData, countryViewType, countryMetric, countryTopN]);

  const countryTrendData = useMemo(() => {
      const topCountries = pivotCountryData.slice(0, parseInt(countryTopN === 'all' ? 10 : countryTopN)).map(c => c.country);
      const map = {};
      aggregatedData.forEach(t => { map[t.date] = { date: t.date }; topCountries.forEach(c => map[t.date][c] = 0); });

      filteredData.forEach(d => {
          if (topCountries.includes(d.country)) {
              let key = d.date;
              if (granularity === 'year') key = d.year;
              else if (granularity === 'quarter') {
                  const m = parseInt(d.date.split('-')[1]);
                  key = `${d.year}-Q${Math.floor((m+2)/3)}`;
              }
              if (map[key]) {
                  const val = countryMetric === 'value' ? d.value : d.weight;
                  const isExport = d.type.includes('出') || d.type === 'E';
                  if (countryViewType === 'balance') map[key][d.country] += (isExport ? val : -val);
                  else {
                      const viewIsExport = countryViewType === '出口';
                      if (isExport === viewIsExport) map[key][d.country] += val;
                  }
              }
          }
      });
      return sanitizeForChart(Object.values(map).sort((a, b) => a.date.localeCompare(b.date)));
  }, [filteredData, pivotCountryData, countryViewType, countryMetric, granularity, aggregatedData, countryTopN]);

  const summary = useMemo(() => {
    if (filteredData.length === 0) return { totalValue: 0, totalWeight: 0, avgPrice: 0 };
    const totalValue = filteredData.reduce((acc, curr) => acc + curr.value, 0);
    const totalWeight = filteredData.reduce((acc, curr) => acc + curr.weight, 0);
    const avg = totalWeight > 0 ? (totalValue * 1000) / totalWeight : 0;
    
    let valDisplay = formatValueByUnit(totalValue, currencyUnit);
    if (currencyUnit === 'thousand') {
        if (totalValue > 100000) valDisplay = (totalValue / 100000).toFixed(2) + ' 億';
        else valDisplay = (totalValue / 10000).toFixed(0) + ' 萬';
    }

    return { 
        totalValue: valDisplay, 
        totalWeight: formatSmartWeight(totalWeight), 
        avgPrice: isFinite(avg) ? avg.toFixed(2) : 0 
    };
  }, [filteredData, currencyUnit]);

  const topicBreakdown = useMemo(() => {
      if (!currentTopic) return [];
      const map = {};
      filteredData.forEach(d => {
          const matchedItem = STRATEGIC_TOPICS[currentTopic].items.find(i => isHsCodeMatch(d.hsCode, i.code));
          if (matchedItem) {
              const key = matchedItem.code;
              if (!map[key]) map[key] = { code: key, name: matchedItem.name, value: 0, weight: 0 };
              map[key].value += d.value;
              map[key].weight += d.weight;
          }
      });
      const metric = topicMetric;
      return Object.values(map).sort((a, b) => b[metric] - a[metric]);
  }, [filteredData, currentTopic, topicMetric]);

  const topicTrendData = useMemo(() => {
      if (!currentTopic || !dataset.length) return { data: [], keys: [] };
      const map = {};
      const topicItemDefs = STRATEGIC_TOPICS[currentTopic].items;
      
      filteredData.forEach(d => {
          if (!topicItemDefs.some(i => isHsCodeMatch(d.hsCode, i.code, i.excludes))) return;
          let key = d.date; 
          if (granularity === 'year') key = d.year;
          else if (granularity === 'quarter') {
              const m = parseInt(d.date.split('-')[1]);
              key = `${d.year}-Q${Math.floor((m+2)/3)}`;
          }
          
          let category = 'Unknown';
          if (topicChartLevel === 'hs2') category = d.hsCode.substring(0, 2);
          else if (topicChartLevel === 'hs4') category = d.hsCode.substring(0, 4);
          else if (topicChartLevel === 'group') {
              const item = topicItemDefs.find(i => isHsCodeMatch(d.hsCode, i.code));
              category = item ? item.group : '其他';
          }
          if (!map[key]) map[key] = { date: key };
          if (!map[key][category]) map[key][category] = 0;
          map[key][category] += (topicMetric === 'value' ? d.value : d.weight);
      });
      
      const allKeys = new Set();
      Object.values(map).forEach(obj => Object.keys(obj).forEach(k => { if(k !== 'date') allKeys.add(k); }));
      return { 
          data: Object.values(map).sort((a, b) => a.date.localeCompare(b.date)),
          keys: Array.from(allKeys)
      };
  }, [filteredData, currentTopic, topicMetric, topicChartLevel, granularity, dataset]);

  const countryStackData = useMemo(() => {
      if (!filteredData.length) return { data: [], keys: [] };
      const topCountries = pivotCountryData.slice(0, 5).map(c => c.country);
      const map = {};
      
      filteredData.forEach(d => {
          let key = d.date; 
          if (granularity === 'year') key = d.year;
          else if (granularity === 'quarter') {
              const m = parseInt(d.date.split('-')[1]);
              key = `${d.year}-Q${Math.floor((m+2)/3)}`;
          }
          let countryName = topCountries.includes(d.country) ? d.country : '其他國家';
          if (!map[key]) map[key] = { date: key };
          if (!map[key][countryName]) map[key][countryName] = 0;
          
          const isExport = d.type.includes('出') || d.type === 'E';
          if (countryViewType === '出口' && isExport) {
              map[key][countryName] += (countryMetric === 'value' ? d.value : d.weight);
          } else if (countryViewType === '進口' && !isExport) {
              map[key][countryName] += (countryMetric === 'value' ? d.value : d.weight);
          }
      });
      
      const keys = [...topCountries, '其他國家'];
      return { 
          data: Object.values(map).sort((a, b) => a.date.localeCompare(b.date)),
          keys 
      };
  }, [filteredData, pivotCountryData, countryViewType, countryMetric, granularity]);

  const crossProductComparison = useMemo(() => {
      if (!useRealData) return [];
      const topCountries = pivotCountryData.slice(0, 5).map(c => c.country);
      const productMap = {};
      dataset.forEach(d => {
          if (topCountries.includes(d.country) && d.hsCode !== searchQuery) { 
              if (!productMap[d.hsCode]) {
                  productMap[d.hsCode] = { code: d.hsCode, name: d.productName || d.hsCode, totalValue: 0 };
              }
              productMap[d.hsCode].totalValue += d.value;
          }
      });
      return Object.values(productMap).sort((a, b) => b.totalValue - a.totalValue).slice(0, 5); 
  }, [dataset, pivotCountryData, useRealData, searchQuery]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ff6b6b', '#6b7280', '#F06292', '#BA68C8'];

  const uniqueProducts = useMemo(() => {
      const map = new Map();
      watchedProducts.forEach(p => map.set(p.code, p.name));
      if (useRealData && dataset.length > 0) {
          dataset.forEach(d => {
              if (d.hsCode && !map.has(d.hsCode)) {
                  map.set(d.hsCode, d.productName || `稅號 ${d.hsCode}`);
              } else if (d.hsCode && d.productName && map.get(d.hsCode).includes('稅號')) {
                  map.set(d.hsCode, d.productName);
              }
          });
      }
      return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [dataset, useRealData, watchedProducts]);

  const selectProduct = (code, name) => {
      setInputValue(`${code} ${name}`); 
      setSearchQuery(code); 
      setCurrentTopic(null); 
      setSelectedTopicCodes([]); 
      setShowSuggestions(false); 
      handleSearch(code, name); 
  };

  const selectTopic = (topicKey) => {
      setCurrentTopic(topicKey);
      const allCodes = STRATEGIC_TOPICS[topicKey].items.map(i => i.code);
      setSelectedTopicCodes(allCodes);
      setInputValue(STRATEGIC_TOPICS[topicKey].title);
      setActiveTab('topic_overview');
  };

  const handleInputChange = (e) => {
      const val = e.target.value; 
      setInputValue(val);
      if (!val) { setSuggestions([]); setShowSuggestions(false); return; }
      const matches = uniqueProducts.filter(p => p.code.includes(val.toLowerCase()) || p.name.toLowerCase().includes(val.toLowerCase()));
      setSuggestions(matches.slice(0, 8)); 
      setShowSuggestions(true);
  };

  const runInspector = () => {
      if (!dataset.length) return "無數據";
      const cleanInput = normalizeCode(inspectorCode);
      const matches = dataset.filter(d => normalizeCode(d.hsCode).startsWith(cleanInput));
      if (matches.length === 0) return `找不到代碼為 "${cleanInput}" 開頭的資料。`;
      const dates = matches.map(d => d.date).sort();
      return `✅ 找到 ${matches.length} 筆資料。\n` +
             `📅 期間：${dates[0]} ~ ${dates[dates.length - 1]}\n` +
             `📋 包含產品：${Array.from(new Set(matches.map(d => d.productName))).slice(0,3).join(', ')}`;
  };

  const renderContent = () => {
      if (currentTopic && activeTab === 'topic_overview') return renderTopicOverview();

      switch(activeTab) {
          case 'overview': return renderOverviewTab();
          case 'country': return renderCountryTab();
          case 'pivot': return renderPivotTab();
          case 'hydrogen': return <HydrogenSurvey />; 
          case 'analysis': return renderAnalysisTab();
          default: return renderOverviewTab();
      }
  };

  const renderOverviewTab = () => (
    <div className="space-y-6">
        <div className="bg-white p-4 rounded-lg shadow-sm h-96">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-700">趨勢圖 A: {trendViewMode === 'summary' ? '金額與單價' : '國家佔比堆疊'}</h3>
                <div className="flex bg-slate-100 p-1 rounded-md text-xs font-bold">
                    <button onClick={() => setTrendViewMode('summary')} className={`px-2 py-1 rounded ${trendViewMode === 'summary' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>總量趨勢</button>
                    <button onClick={() => setTrendViewMode('country_stack')} className={`px-2 py-1 rounded ${trendViewMode === 'country_stack' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>國家堆疊</button>
                </div>
            </div>
            
            <ResponsiveContainer width="100%" height="90%">
            {trendViewMode === 'summary' ? (
                <ComposedChart data={aggregatedData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{fontSize: 11}} />
                    <YAxis yAxisId="left" tickFormatter={(val) => formatCurrencyAxis(val, currencyUnit)} label={{ value: `金額 (${getUnitLabel(currencyUnit)})`, angle: -90, position: 'insideLeft', style: {fontSize: 11, fill: '#64748b'} }} tick={{fontSize: 11}} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(val) => val.toFixed(1)} tick={{fontSize: 11}} unit=" $"/>
                    <Tooltip content={<CustomTimeTooltip />} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="exportValue" name="出口金額" fill="#3b82f6" />
                    <Bar yAxisId="left" dataKey="importValue" name="進口金額" fill="#10b981" />
                    <Line yAxisId="right" type="monotone" dataKey="avgExportPrice" name="出口單價" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="avgImportPrice" name="進口單價" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                    {GLOBAL_EVENTS.map((event, i) => (
                    <ReferenceLine key={i} x={mapEventToDateKey(event.date, granularity)} yAxisId="left" stroke="red" strokeDasharray="3 3" label={{ position: 'top', value: '!', fill: 'red', fontSize: 10 }} />
                    ))}
                </ComposedChart>
            ) : (
                <BarChart data={countryStackData.data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{fontSize: 11}} />
                    <YAxis tickFormatter={(val) => countryMetric === 'value' ? formatCurrencyAxis(val, currencyUnit) : formatSmartWeight(val)} tick={{fontSize: 11}} />
                    <Tooltip formatter={(val) => countryMetric === 'value' ? formatCurrencyAxis(val, currencyUnit) : formatSmartWeight(val)} />
                    <Legend />
                    {countryStackData.keys.map((key, i) => (
                        <Bar key={key} dataKey={key} stackId="a" fill={COLORS[i % COLORS.length]} />
                    ))}
                </BarChart>
            )}
            </ResponsiveContainer>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm h-80">
            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                <Database size={16} className="text-emerald-500"/>
                趨勢圖 B: 進出口量體 (重量比較)
            </h3>
            <ResponsiveContainer width="100%" height="90%">
            <BarChart data={aggregatedData} barGap={0}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{fontSize: 11}} />
                <YAxis tickFormatter={formatSmartWeight} label={{ value: '重量(KG/MT)', angle: -90, position: 'insideLeft', style: {fontSize: 11, fill: '#64748b'} }} tick={{fontSize: 11}} />
                <Tooltip content={<CustomTimeTooltip />} />
                <Legend wrapperStyle={{fontSize: '12px'}}/>
                <Bar dataKey="exportWeight" name="出口重量" fill="#8884d8" fillOpacity={0.8} />
                <Bar dataKey="importWeight" name="進口重量" fill="#82ca9d" fillOpacity={0.8} />
            </BarChart>
            </ResponsiveContainer>
        </div>
    </div>
  );

  const renderCountryTab = () => (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-4">
                <div className="flex bg-slate-200 p-1 rounded-lg">
                    {['出口', '進口', 'balance'].map(mode => (
                        <button key={mode} onClick={() => setCountryViewType(mode)} className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${countryViewType === mode ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600'}`}>
                            {mode === 'balance' ? '順逆差' : mode}
                        </button>
                    ))}
                </div>
                <select value={countryTopN} onChange={(e) => setCountryTopN(e.target.value)} className="border rounded px-2 text-sm"><option value="5">Top 5</option><option value="10">Top 10</option><option value="all">All</option></select>
                <div className="flex items-center gap-2 text-sm text-slate-600 ml-2">
                    <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={countryMetric === 'value'} onChange={() => setCountryMetric('value')} className="text-blue-600"/> 金額</label>
                    <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={countryMetric === 'weight'} onChange={() => setCountryMetric('weight')} className="text-blue-600"/> 重量</label>
                </div>
            </div>
            <div className="flex gap-2">
                <button onClick={() => copyToClipboard(pivotCountryData)} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded text-sm hover:bg-slate-50 text-slate-700"><Copy size={14}/> 複製</button>
                <button onClick={() => exportToCSV(pivotCountryData, `Country_Data_${countryViewType}`)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"><Download size={14}/> 下載</button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm h-80">
                <h4 className="font-bold text-center mb-2">{countryViewType === 'balance' ? '貿易總額佔比 (依存度)' : '總量佔比'}</h4>
                <ResponsiveContainer width="100%" height="90%">
                    <PieChart>
                        <Pie data={countryPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" label={renderCustomizedLabel}>
                            {countryPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(val) => countryMetric === 'value' ? formatCurrencyAxis(val, currencyUnit) : formatSmartWeight(val)} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm h-80">
                <h4 className="font-bold text-center mb-2">{countryViewType === 'balance' ? '順逆差趨勢' : '各國趨勢競賽'}</h4>
                <ResponsiveContainer width="100%" height="90%">
                    <LineChart data={countryTrendData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{fontSize: 10}} />
                        <YAxis tickFormatter={countryMetric==='value'?formatCurrencyAxis:formatSmartWeight} tick={{fontSize: 10}} />
                        <Tooltip formatter={(value, name) => [(value || 0).toLocaleString(), name]} />
                        <Legend wrapperStyle={{fontSize: '10px'}}/>
                        {pivotCountryData.slice(0, parseInt(countryTopN === 'all' ? 10 : countryTopN)).map((c, i) => (
                            <Line key={c.country} type="monotone" dataKey={c.country} stroke={COLORS[i % COLORS.length]} dot={false} strokeWidth={2} />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
        
        {/* Country Table */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col h-96">
            <div className="overflow-auto flex-1">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0">
                        <tr>
                            <th className="px-4 py-3">國家</th>
                            <th className="px-4 py-3 text-right">出口額 ({getUnitLabel(currencyUnit)})</th>
                            <th className="px-4 py-3 text-right">進口額 ({getUnitLabel(currencyUnit)})</th>
                            <th className="px-4 py-3 text-right font-bold text-blue-600">順逆差 ({getUnitLabel(currencyUnit)})</th>
                            <th className="px-4 py-3 text-right">出口重量</th>
                            <th className="px-4 py-3 text-right">進口重量</th>
                            <th className="px-4 py-3 text-right text-amber-600">出口單價</th><th className="px-4 py-3 text-right text-amber-600">進口單價</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {pivotCountryData.slice(0, parseInt(countryTopN === 'all' ? 100 : countryTopN)).map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                                <td className="px-4 py-2 font-medium text-slate-800">{row.country}</td>
                                <td className="px-4 py-2 text-right font-mono">{formatValueByUnit(row.exportValue, currencyUnit)}</td>
                                <td className="px-4 py-2 text-right font-mono">{formatValueByUnit(row.importValue, currencyUnit)}</td>
                                <td className={`px-4 py-2 text-right font-mono font-bold ${row.tradeBalance >= 0 ? 'text-slate-800' : 'text-red-500'}`}>{row.tradeBalance >= 0 ? '+' : ''}{formatValueByUnit(row.tradeBalance, currencyUnit)}</td>
                                <td className="px-4 py-2 text-right font-mono">{formatSmartWeight(row.exportWeight)}</td>
                                <td className="px-4 py-2 text-right font-mono">{formatSmartWeight(row.importWeight)}</td>
                                <td className="px-4 py-2 text-right font-mono text-amber-700">{row.avgExportPrice}</td>
                                <td className="px-4 py-2 text-right font-mono text-amber-700">{row.avgImportPrice}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
  );

  const renderPivotTab = () => (
      <div className="space-y-4 h-full flex flex-col">
        <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200">
            <div className="flex items-center gap-4">
                <h3 className="font-bold text-slate-700 flex items-center gap-2"><TableIcon size={18} className="text-blue-600"/> 數據樞紐</h3>
                <div className="flex bg-slate-100 p-1 rounded-md text-xs font-bold">
                    <button onClick={() => setPivotMode('time')} className={`px-3 py-1 rounded ${pivotMode === 'time' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>依時間</button>
                    <button onClick={() => setPivotMode('country')} className={`px-3 py-1 rounded ${pivotMode === 'country' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>依國家</button>
                </div>
            </div>
            <div className="flex gap-2">
                <button onClick={() => copyToClipboard(pivotMode === 'time' ? aggregatedData : pivotCountryData)} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded text-sm hover:bg-slate-50 text-slate-700"><Copy size={14}/> 複製</button>
                <button onClick={() => exportToCSV(pivotMode === 'time' ? aggregatedData : pivotCountryData, 'Trade_Pivot_Data')} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"><Download size={14}/> 匯出</button>
            </div>
        </div>
        
        <div className="flex-1 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-auto flex-1">
                <table className="w-full text-sm text-left relative">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-100 border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-3 bg-slate-100">{pivotMode === 'time' ? `時間 (${granularity})` : '國家'}</th>
                            <th className="px-4 py-3 text-right bg-slate-100 text-blue-700">出口金額</th>
                            <th className="px-4 py-3 text-right bg-slate-100 text-emerald-700">進口金額</th>
                            <th className="px-4 py-3 text-right bg-slate-100 font-bold">金額順逆差</th>
                            <th className="px-4 py-3 text-right bg-slate-100 text-slate-500 border-l border-slate-200">出口重量</th>
                            <th className="px-4 py-3 text-right bg-slate-100 text-slate-500">進口重量</th>
                            <th className="px-4 py-3 text-right bg-slate-100 font-bold text-slate-700">重量順逆差</th>
                            <th className="px-4 py-3 text-right bg-slate-100 text-amber-600 border-l border-slate-200">出口單價</th>
                            <th className="px-4 py-3 text-right bg-slate-100 text-amber-600">進口單價</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {(pivotMode === 'time' ? aggregatedData : pivotCountryData).map((row, idx) => (
                                <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                                <td className="px-4 py-2 font-medium text-slate-800 whitespace-nowrap">{pivotMode === 'time' ? row.date : row.country}</td>
                                <td className="px-4 py-2 text-right font-mono text-blue-700">{formatValueByUnit(row.exportValue, currencyUnit)}</td>
                                <td className="px-4 py-2 text-right font-mono text-emerald-700">{formatValueByUnit(row.importValue, currencyUnit)}</td>
                                <td className={`px-4 py-2 text-right font-mono font-bold ${row.tradeBalance >= 0 ? 'text-slate-800' : 'text-red-500'}`}>{row.tradeBalance > 0 ? '+' : ''}{formatValueByUnit(row.tradeBalance, currencyUnit)}</td>
                                <td className="px-4 py-2 text-right font-mono text-slate-500 border-l border-slate-100">{formatSmartWeight(row.exportWeight)}</td>
                                <td className="px-4 py-2 text-right font-mono text-slate-500">{formatSmartWeight(row.importWeight)}</td>
                                <td className={`px-4 py-2 text-right font-mono font-bold ${row.tradeBalanceWeight >= 0 ? 'text-slate-600' : 'text-rose-500'}`}>{row.tradeBalanceWeight > 0 ? '+' : ''}{formatSmartWeight(row.tradeBalanceWeight)}</td>
                                <td className="px-4 py-2 text-right font-mono text-amber-700 border-l border-slate-100">{row.avgExportPrice}</td>
                                <td className="px-4 py-2 text-right font-mono text-amber-700">{row.avgImportPrice}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
  );

  const renderAnalysisTab = () => (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-lg">
                    <h4 className="font-bold text-rose-800 flex items-center gap-2 mb-2"><BookOpen size={18}/> 重大歷史事件簿</h4>
                    <p className="text-sm text-rose-700">{currentTopic ? '相關政策實施時間軸' : '影響國際貿易之重大事件一覽'}</p>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {(currentTopic && TOPIC_MILESTONES[currentTopic] ? TOPIC_MILESTONES[currentTopic] : GLOBAL_EVENTS).map((ev, i) => (
                        <div key={i} className="flex items-start gap-3 text-xs bg-white p-3 rounded border border-slate-200 hover:shadow-md transition-shadow">
                            <div className="font-mono text-slate-500 font-bold min-w-[60px] pt-0.5">{ev.date}</div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-600 font-bold`}>{ev.type || 'Event'}</span>
                                    <span className="text-slate-800 font-bold text-sm">{ev.label}</span>
                                </div>
                                <div className="text-slate-600 leading-relaxed">{ev.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                    <h4 className="font-bold text-blue-800 flex items-center gap-2 mb-2"><ArrowRightLeft size={18}/> 核心夥伴之關聯產品分析</h4>
                    <p className="text-sm text-blue-700">分析前 5 大貿易國在資料庫中其他產品 (稅號) 的交易情況。</p>
                </div>
                {crossProductComparison.length > 0 ? (
                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr><th className="px-3 py-2">關聯產品 (稅號)</th><th className="px-3 py-2 text-right">對應貿易額</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {crossProductComparison.map((prod, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50">
                                        <td className="px-3 py-2">
                                            <div className="font-medium text-slate-800">{prod.name}</div>
                                            <div className="text-slate-400 text-[10px]">{prod.code}</div>
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono text-blue-600">{(prod.totalValue || 0).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-8 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                        <p>尚無關聯數據。</p>
                        <p className="text-xs mt-1">(請確認 CSV 包含多種稅號資料)</p>
                    </div>
                )}
            </div>
        </div>
      </div>
  );

  const renderTopicOverview = () => (
      <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-slate-700">分類趨勢總覽</h4>
                  <div className="flex gap-4">
                     <div className="flex bg-slate-100 p-1 rounded-md text-xs font-bold">
                          <button onClick={() => setTopicChartLevel('hs2')} className={`px-2 py-1 rounded ${topicChartLevel === 'hs2' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>HS 2碼</button>
                          <button onClick={() => setTopicChartLevel('hs4')} className={`px-2 py-1 rounded ${topicChartLevel === 'hs4' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>HS 4碼</button>
                          <button onClick={() => setTopicChartLevel('group')} className={`px-2 py-1 rounded ${topicChartLevel === 'group' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>自訂分類</button>
                     </div>
                     <div className="w-px h-6 bg-slate-300"></div>
                     <div className="flex bg-slate-100 p-1 rounded-md text-xs font-bold">
                          <button onClick={() => setTopicMetric('value')} className={`px-2 py-1 rounded ${topicMetric === 'value' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>金額</button>
                          <button onClick={() => setTopicMetric('weight')} className={`px-2 py-1 rounded ${topicMetric === 'weight' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>重量</button>
                     </div>
                  </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topicTrendData.data}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tick={{fontSize: 10}} />
                      <YAxis tickFormatter={topicMetric==='value'?formatCurrencyAxis:formatSmartWeight} tick={{fontSize: 10}} />
                      <Tooltip formatter={(val) => topicMetric === 'value' ? formatCurrencyAxis(val, currencyUnit) : formatSmartWeight(val)} />
                      <Legend />
                      {topicTrendData.keys.map((key, i) => (
                          <Bar key={key} dataKey={key} stackId="a" fill={COLORS[i % COLORS.length]} />
                      ))}
                  </BarChart>
              </ResponsiveContainer>
          </div>
          
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2"><Briefcase size={18}/> 資料庫健康度檢查</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  {Object.entries(dataHealth).sort((a,b)=>b[0].localeCompare(a[0])).slice(0, 8).map(([year, stats]) => (
                      <div key={year} className={`p-2 rounded border ${stats.export === 0 || stats.import === 0 ? 'bg-rose-100 border-rose-300 text-rose-800' : 'bg-white border-slate-200'}`}>
                          <div className="font-bold mb-1">{year}年</div>
                          <div>出口: {stats.export} 筆 {stats.export === 0 && '❌'}</div>
                          <div>進口: {stats.import} 筆 {stats.import === 0 && '❌'}</div>
                      </div>
                  ))}
              </div>
              <div className="mt-2 text-xs text-slate-500">* 若某年份出口或進口為 0，請檢查該年份 CSV 欄位是否錯置。</div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                  <h4 className="font-bold text-slate-700 mb-4">細項產品佔比 (Top 10)</h4>
                  <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                          <Pie data={topicBreakdown.slice(0, 10)} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey={topicMetric} label={renderCustomizedLabel}>
                              {topicBreakdown.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                          </Pie>
                          <Tooltip formatter={(val) => topicMetric === 'value' ? formatCurrencyAxis(val, currencyUnit) : formatSmartWeight(val)} />
                          <Legend />
                      </PieChart>
                  </ResponsiveContainer>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 overflow-auto">
                  <h4 className="font-bold text-slate-700 mb-4">清單產品明細</h4>
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50"><tr><th className="p-2">代碼</th><th className="p-2">品名</th><th className="p-2 text-right">金額 ({getUnitLabel(currencyUnit)})</th><th className="p-2 text-right">重量</th></tr></thead>
                      <tbody>
                          {topicBreakdown.map((row, i) => (
                              <tr key={i} className="border-b">
                                  <td className="p-2 font-mono text-slate-500">{row.code}</td>
                                  <td className="p-2 font-medium">{row.name}</td>
                                  <td className="p-2 text-right text-blue-600">{formatValueByUnit(row.value, currencyUnit)}</td>
                                  <td className="p-2 text-right text-slate-600">{formatSmartWeight(row.weight)}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      </div>
  );

  // --- Main Layout Render ---

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-800">
      {/* Settings Modal */}
      {showConfigModal && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 overflow-y-auto max-h-[90vh]">
                <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold flex items-center gap-2"><Settings className="text-blue-600"/> 資料來源與診斷</h3><button onClick={() => setShowConfigModal(false)}><X/></button></div>
                {fetchError && <div className="mb-4 p-2 bg-rose-50 text-rose-700 text-sm">{fetchError}</div>}
                <div className="mb-6">
                    <label className="text-sm font-bold text-slate-600 mb-2 block flex justify-between">
                        <span>Google Sheet CSV 連結 ({dataSources.length})</span>
                        <button onClick={() => setDataSources([...dataSources, ''])} className="text-blue-600 flex items-center gap-1 text-xs"><Plus size={14}/> 新增連結</button>
                    </label>
                    <div className="space-y-2">
                        {dataSources.map((url, idx) => (
                            <div key={idx} className="flex gap-2">
                                <input type="text" className="flex-1 p-2 border rounded font-mono text-xs" placeholder="https://.../output=csv" value={url} onChange={(e) => {
                                    const newSources = [...dataSources]; newSources[idx] = e.target.value; setDataSources(newSources);
                                }} />
                                {dataSources.length > 1 && <button onClick={() => setDataSources(dataSources.filter((_, i) => i !== idx))} className="text-rose-500 hover:bg-rose-50 p-2 rounded"><Trash2 size={16}/></button>}
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 text-xs text-slate-500 bg-blue-50 p-2 rounded">💡 提示：您可以將不同年份的資料分開存放在不同的 Google Sheet，再將連結貼到這裡，系統會自動合併讀取。</div>
                    <button onClick={() => { if(dataSources.some(u=>u)) { setUseRealData(true); fetchRealData(); }}} className="w-full bg-blue-600 text-white py-2 rounded mt-3">讀取並更新所有來源</button>
                </div>
                <div className="border-t pt-4">
                     <label className="text-sm font-bold text-slate-600 mb-1 block flex items-center gap-2"><SearchCode size={16}/> 資料庫診斷器 (Data Inspector)</label>
                     <div className="flex gap-2 mb-2"><input type="text" placeholder="輸入稅號 (例如 2523)" className="flex-1 p-2 border rounded" value={inspectorCode} onChange={e => setInspectorCode(e.target.value)} /></div>
                     <div className="p-3 bg-slate-100 rounded text-xs font-mono whitespace-pre-line text-slate-700 min-h-[80px]">{inspectorCode ? runInspector() : "請輸入稅號檢查..."}</div>
                </div>
            </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex-shrink-0 hidden md:flex flex-col">
        <div className="p-6 border-b border-slate-700"><h1 className="text-xl font-bold flex items-center gap-2"><Globe size={24} className="text-blue-400" />貿易戰情室</h1><p className="text-xs text-slate-400 mt-2">Customs & Trade Dashboard</p></div>
        <div className="p-4 border-b border-slate-800">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><ShieldAlert size={14}/> 戰略專題</h3>
            <div className="space-y-1">{Object.entries(STRATEGIC_TOPICS).map(([key, topic]) => (<button key={key} onClick={() => selectTopic(key)} className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${currentTopic === key ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>{topic.title}</button>))}</div>
        </div>
        
        {/* 新增：專項儀表板 (氫能) */}
        <div className="p-4 border-b border-slate-800">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Layers size={14}/> 專項儀表板</h3>
            <button 
                onClick={() => { setActiveTab('hydrogen'); setCurrentTopic(null); }}
                className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2 ${activeTab === 'hydrogen' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-300 hover:bg-slate-800'}`}
            >
                <Factory size={16} className={activeTab === 'hydrogen' ? 'text-white' : 'text-emerald-400'}/>
                <span>氫能供需戰情室</span>
                {activeTab === 'hydrogen' && <ChevronRight size={14} className="ml-auto opacity-70"/>}
            </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          <div className="mb-4"><h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">重點監控</h3>{watchedProducts.map(fav => (<button key={fav.code} onClick={() => selectProduct(fav.code, fav.name)} className="block w-full text-left px-2 py-1 text-sm text-slate-300 hover:text-white truncate">{fav.name}</button>))}</div>
          <div className="mb-4"><h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">最近搜尋</h3>
            {history.map((item, idx) => (
                <button key={idx} onClick={() => selectProduct(item.code, item.name)} className="block w-full text-left px-2 py-1 text-sm text-slate-300 hover:text-white truncate flex items-center gap-2">
                    <History size={12}/> {item.code} {item.name ? `- ${item.name}` : ''}
                </button>
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-slate-800"><button onClick={() => setShowConfigModal(true)} className="flex items-center gap-2 text-xs text-slate-400 hover:text-white"><Settings size={12}/> 設定資料源</button></div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto h-screen flex flex-col relative">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 flex-1" ref={searchContainerRef}>
                <div className="relative flex-1 max-w-lg">
                <input type="text" value={inputValue} onChange={handleInputChange} onFocus={() => inputValue && setShowSuggestions(true)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg outline-none" placeholder="搜尋貨名或 Code" />
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                {showSuggestions && (<div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">{suggestions.map((item) => (<button key={item.code} onClick={() => selectProduct(item.code, item.name)} className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm border-b border-slate-50 last:border-0"><span className="font-medium text-slate-700">{item.name}</span><span className="text-xs text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{item.code}</span></button>))}</div>)}
                </div>
                <button onClick={() => handleSearch()} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2"><RefreshCw size={18} className={loading ? "animate-spin" : ""}/> 搜尋</button>
            </div>
            {currentTopic && (
                <div className="flex flex-wrap gap-2 items-center">
                    <button onClick={() => setSelectedTopicCodes([])} className={`px-3 py-1 text-xs rounded-full border transition-colors ${selectedTopicCodes.length === 0 ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>全部 (All)</button>
                    <div className="relative">
                        <MultiSelectDropdown options={STRATEGIC_TOPICS[currentTopic].items} selected={selectedTopicCodes} onChange={setSelectedTopicCodes} label="細項" />
                    </div>
                </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 rounded-lg">
             <div className="flex items-center text-xs font-bold text-slate-500 uppercase"><Calendar size={14} className="mr-1"/> 範圍</div>
             <select value={timeRange} onChange={(e) => setTimeRange(Number(e.target.value))} className="bg-white border rounded px-2 py-1 text-sm"><option value={12}>近 1 年</option><option value={36}>近 3 年</option><option value={60}>近 5 年</option><option value={120}>近 10 年</option></select>
             <div className="w-px h-4 bg-slate-300 mx-1"></div>
             <div className="flex items-center text-xs font-bold text-slate-500 uppercase"><MapIcon size={14} className="mr-1"/> 區域</div>
             <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)} className="bg-white border rounded px-2 py-1 text-sm font-bold text-blue-700">
                 <option value="ALL">全部國家</option>
                 {Object.entries(TRADE_REGIONS).map(([key, val]) => (<option key={key} value={key}>{val.label}</option>))}
             </select>
             <div className="w-px h-4 bg-slate-300 mx-1"></div>
             <div className="flex items-center text-xs font-bold text-slate-500 uppercase"><ListFilter size={14} className="mr-1"/> 粒度</div>
             <select value={granularity} onChange={(e) => setGranularity(e.target.value)} className="bg-white border rounded px-2 py-1 text-sm"><option value="month">月</option><option value="quarter">季</option><option value="year">年</option></select>
          </div>
        </header>

        {/* Title Section */}
        <div className="px-6 pt-6 pb-2">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg text-white ${currentTopic ? 'bg-purple-600' : activeTab === 'hydrogen' ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                    {currentTopic ? <Zap size={24} /> : activeTab === 'hydrogen' ? <Factory size={24} /> : <Layers size={24} />}
                </div>
                <div className="flex-1">
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        {activeTab === 'hydrogen' ? '氫能供需戰情室' : (detectedProductName || '搜尋結果')}
                        {!currentTopic && activeTab !== 'hydrogen' && <span className="text-slate-400 text-lg font-normal font-mono">({searchQuery})</span>}
                        {!currentTopic && activeTab !== 'hydrogen' && (
                          <button onClick={() => {
                            const isWatched = watchedProducts.some(p => p.code === searchQuery);
                            if (isWatched) setWatchedProducts(prev => prev.filter(p => p.code !== searchQuery));
                            else setWatchedProducts(prev => [{ code: searchQuery, name: detectedProductName || `稅號 ${searchQuery}` }, ...prev]);
                          }} className={`ml-2 p-1.5 rounded-full transition-all ${watchedProducts.some(p => p.code === searchQuery) ? 'bg-amber-100 text-amber-500 hover:bg-amber-200' : 'bg-slate-100 text-slate-400 hover:text-amber-400 hover:bg-slate-200'}`}><Star size={20} fill={watchedProducts.some(p => p.code === searchQuery) ? "currentColor" : "none"} /></button>
                        )}
                    </h2>
                    {currentTopic && (
                        <div className="mt-2 bg-purple-50 p-3 rounded-lg border border-purple-100 flex items-center justify-between">
                             <div><p className="text-sm text-purple-800 font-bold mb-1">{STRATEGIC_TOPICS[currentTopic].desc}</p></div>
                             {STRATEGIC_TOPICS[currentTopic].sourceUrl && (<a href={STRATEGIC_TOPICS[currentTopic].sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline"><ExternalLink size={12}/> 官方資料來源</a>)}
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Content Area */}
        <div className="p-6 space-y-6 flex-1 overflow-auto">
          {/* KPI Cards (Only show for Trade, NOT Hydrogen) */}
          {activeTab !== 'hydrogen' && (
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <KPICard title={`總貿易額 (${getUnitLabel(currencyUnit)})`} value={summary.totalValue} subtext="區間累計" trend="up" icon={TrendingUp} color="bg-blue-500"/>
              <KPICard title="總重量" value={summary.totalWeight} subtext="區間累計" trend="up" icon={Database} color="bg-emerald-500"/>
              <KPICard title="平均單價 (元/KG)" value={`$${summary.avgPrice}`} subtext="加權平均" trend="down" icon={AlertTriangle} color="bg-amber-500"/>
              <KPICard title="異常波動" value={0} subtext="待人工確認" trend="down" icon={AlertTriangle} color="bg-rose-500"/>
            </section>
          )}

          <ErrorBoundary>
            <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[500px] ${activeTab === 'hydrogen' ? 'bg-transparent shadow-none border-none' : ''}`}>
              {/* Dynamic Navigation Tabs (Hide for Hydrogen since it's a standalone dashboard) */}
              {activeTab !== 'hydrogen' && (
                <div className="border-b border-slate-200 flex overflow-x-auto">
                  {currentTopic && <button onClick={() => setActiveTab('topic_overview')} className={`px-5 py-3 text-sm font-bold flex items-center gap-2 ${activeTab === 'topic_overview' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600'}`}><Layers size={16}/> 專題總覽</button>}
                  {NAV_ITEMS.map(item => (
                      <button 
                          key={item.id} 
                          onClick={() => setActiveTab(item.id)} 
                          className={`px-5 py-3 text-sm font-bold flex items-center gap-2 ${activeTab === item.id ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600'}`}
                      >
                          <item.icon size={16}/> {item.label}
                      </button>
                  ))}
                </div>
              )}

              {/* View Content */}
              <div className={`flex-1 ${activeTab !== 'hydrogen' ? 'p-6 bg-slate-50/50' : ''}`}>
                {loading ? <div className="h-full flex items-center justify-center">載入中...</div> : renderContent()}
              </div>
            </div>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
};

export default TradeDashboard;