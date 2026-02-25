// ==========================================
// 全域設定與常數 (System Config)
// ==========================================
import { TrendingUp, Globe, Table as TableIcon, AlertTriangle } from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'overview', label: '時間趨勢', icon: TrendingUp, section: 'main' },
  { id: 'country', label: '國家分析', icon: Globe, section: 'main' },
  { id: 'pivot', label: '數據樞紐', icon: TableIcon, section: 'main' },
  { id: 'analysis', label: '變動與關聯', icon: AlertTriangle, section: 'main' },
];

export const GLOBAL_EVENTS = [
    { date: '2022-02', label: '烏俄戰爭', type: 'War', desc: '能源原物料飆漲' },
    { date: '2022-06', label: '美升息', type: 'Finance', desc: '強勢美元導致亞幣競貶' },
    { date: '2023-10', label: '以巴衝突', type: 'War', desc: '紅海航運危機，運費上漲' },
    { date: '2024-01', label: 'ECFA中止(12項)', type: 'Policy', desc: '首波石化產品優惠取消' },
    { date: '2024-04', label: '電價調漲', type: 'Domestic', desc: '工業電價平均調漲' },
    { date: '2024-06', label: 'ECFA中止(34項)', type: 'Policy', desc: '第二波中止，含潤滑油、紡織' },
    { date: '2024-11', label: '美國大選', type: 'Politics', desc: '川普當選，市場預期關稅壁壘升高' },
];

export const TOPIC_MILESTONES = {
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

export const TRADE_REGIONS = {
    'ASEAN': { label: '東協 10 國', countries: ['越南', '泰國', '印尼', '馬來西亞', '菲律賓', '新加坡', '緬甸', '柬埔寨', '寮國', '汶萊'] },
    'EU27': { label: '歐盟 27 國', countries: ['德國', '法國', '荷蘭', '義大利', '西班牙', '比利時', '波蘭', '瑞典', '奧地利', '愛爾蘭', '捷克', '丹麥', '芬蘭', '葡萄牙', '希臘', '匈牙利', '羅馬尼亞', '斯洛伐克', '保加利亞', '愛沙尼亞', '拉脫維亞', '立陶宛', '盧森堡', '馬爾他', '賽普勒斯', '斯洛維尼亞', '克羅埃西亞'] },
    'US_CN': { label: '美中港 (G2)', countries: ['美國', '中國大陸', '香港'] },
    'CPTPP': { label: 'CPTPP 成員', countries: ['日本', '加拿大', '澳洲', '越南', '墨西哥', '新加坡', '紐西蘭', '馬來西亞', '智利', '秘魯', '汶萊', '英國'] }, 
    'MIDDLE_EAST': { label: '中東地區', countries: ['沙烏地阿拉伯', '阿聯', '科威特', '卡達', '以色列'] }
};

// 72章動態展開 (7201 ~ 7229)
const steelRawMaterials = Array.from({length: 29}, (_, i) => {
    const code = `72${(i + 1).toString().padStart(2, '0')}`;
    return { group: '鋼鐵原料 (72章)', code, name: `${code} 鋼鐵原料` };
});

export const STRATEGIC_TOPICS = {
    'CBAM_WATCH': { 
        title: '歐盟 CBAM 碳關稅', 
        desc: '涵蓋品項：水泥、肥料、鋼鐵(含72章細項)、鋁、氫',
        items: [
            { group: '水泥與礦產', code: '2507', name: '2507 高嶺土' }, 
            { group: '水泥與礦產', code: '2523', name: '2523 水泥' }, 
            { group: '水泥與礦產', code: '2601', name: '2601 鐵礦石' },
            { group: '化工與氫氣', code: '2804', name: '2804 氫氣等' }, 
            { group: '化工與氫氣', code: '2814', name: '2814 氨' }, 
            { group: '化工與氫氣', code: '2834', name: '2834 亞硝酸鹽' }, 
            { group: '化工與氫氣', code: '3102', name: '3102 氮肥' }, 
            { group: '化工與氫氣', code: '3105', name: '3105 複合肥料' },
            ...steelRawMaterials,
            { group: '鋼鐵製品', code: '7301', name: '7301 鋼鐵板樁' },
            { group: '鋼鐵製品', code: '7302', name: '7302 鐵道建材' },
            { group: '鋼鐵製品', code: '7303', name: '7303 鑄鐵管' },
            { group: '鋼鐵製品', code: '7304', name: '7304 無縫鋼管' },
            { group: '鋼鐵製品', code: '7305', name: '7305 其他鋼管' },
            { group: '鋼鐵製品', code: '7306', name: '7306 鋼鐵管及空心型' },
            { group: '鋼鐵製品', code: '7307', name: '7307 鋼鐵管配件' },
            { group: '鋼鐵製品', code: '7308', name: '7308 鋼鐵結構物' },
            { group: '鋼鐵製品', code: '7309', name: '7309 鋼鐵容器(>300L)' },
            { group: '鋼鐵製品', code: '7310', name: '7310 鋼鐵容器(<300L)' },
            { group: '鋼鐵製品', code: '7311', name: '7311 壓縮氣體鋼瓶' },
            { group: '鋼鐵製品', code: '7318', name: '7318 螺釘/螺帽' },
            { group: '鋼鐵製品', code: '7326', name: '7326 其他鋼鐵製品' },
            { group: '鋁與鋁製品', code: '7601', name: '7601 未鍛造鋁' },
            { group: '鋁與鋁製品', code: '7603', name: '7603 鋁粉' },
            { group: '鋁與鋁製品', code: '7604', name: '7604 鋁條' },
            { group: '鋁與鋁製品', code: '7605', name: '7605 鋁線' },
            { group: '鋁與鋁製品', code: '7606', name: '7606 鋁板' },
            { group: '鋁與鋁製品', code: '7607', name: '7607 鋁箔' },
            { group: '鋁與鋁製品', code: '7608', name: '7608 鋁管' },
            { group: '鋁與鋁製品', code: '7610', name: '7610 鋁結構物' },
            { group: '鋁與鋁製品', code: '7611', name: '7611 鋁容器(>300L)' },
            { group: '鋁與鋁製品', code: '7612', name: '7612 鋁容器(<300L)' },
            { group: '鋁與鋁製品', code: '7613', name: '7613 鋁製氣瓶' },
            { group: '鋁與鋁製品', code: '7614', name: '7614 鋁絞線' },
            { group: '鋁與鋁製品', code: '7616', name: '7616 其他鋁製品' },
        ]
    },
    'ECFA_EARLY': { 
        title: 'ECFA 優惠中止清單', 
        desc: '第一波中止(2024/01) 12項 及 第二波中止(2024/06) 34項',
        items: [
            { group: '第一波中止(12項)', code: '29012100', name: '29012100 乙烯' },
            { group: '第一波中止(12項)', code: '29012200', name: '29012200 丙烯' },
            { group: '第一波中止(12項)', code: '29012410', name: '29012410 丁二烯' },
            { group: '第一波中止(12項)', code: '29022000', name: '29022000 苯' },
            { group: '第一波中止(12項)', code: '29023000', name: '29023000 甲苯' },
            { group: '第一波中止(12項)', code: '29024100', name: '29024100 對二甲苯' },
            { group: '第一波中止(12項)', code: '29024300', name: '29024300 鄰二甲苯' },
            { group: '第一波中止(12項)', code: '29024400', name: '29024400 混合二甲苯' },
            { group: '第一波中止(12項)', code: '29029090', name: '29029090 其他環烴' },
            { group: '第一波中止(12項)', code: '39011000', name: '39011000 聚乙烯' },
            { group: '第一波中止(12項)', code: '39012000', name: '39012000 聚乙烯(高比重)' },
            { group: '第一波中止(12項)', code: '39021000', name: '39021000 聚丙烯' },

            { group: '第二波中止(34項)', code: '27101965', name: '27101965 基礎油' },
            { group: '第二波中止(34項)', code: '29051220', name: '29051220 異丙醇' },
            { group: '第二波中止(34項)', code: '29051300', name: '29051300 丁醇' },
            { group: '第二波中止(34項)', code: '29094100', name: '29094100 二甘醇' },
            { group: '第二波中止(34項)', code: '29094310', name: '29094310 丁基醚' },
            { group: '第二波中止(34項)', code: '29153200', name: '29153200 醋酸乙烯酯' },
            { group: '第二波中止(34項)', code: '29161410', name: '29161410 甲基丙烯酸酯' },
            { group: '第二波中止(34項)', code: '29173300', name: '29173300 鄰苯二甲酸二辛酯' },
            { group: '第二波中止(34項)', code: '29321100', name: '29321100 四氫呋喃' },
            { group: '第二波中止(34項)', code: '39032000', name: '39032000 SAN共聚物' },
            { group: '第二波中止(34項)', code: '39039010', name: '39039010 苯乙烯共聚物' },
            { group: '第二波中止(34項)', code: '39052100', name: '39052100 醋酸乙烯酯共聚物' },
            { group: '第二波中止(34項)', code: '39069010', name: '39069010 丙烯酸聚合物' },
            { group: '第二波中止(34項)', code: '39071000', name: '39071000 聚縮醛' },
            { group: '第二波中止(34項)', code: '39072900', name: '39072900 其他聚醚' },
            { group: '第二波中止(34項)', code: '39073010', name: '39073010 環氧樹脂' },
            { group: '第二波中止(34項)', code: '39074000', name: '39074000 聚碳酸酯' },
            { group: '第二波中止(34項)', code: '39075000', name: '39075000 醇酸樹脂' },
            { group: '第二波中止(34項)', code: '39079100', name: '39079100 不飽和聚酯' },
            { group: '第二波中止(34項)', code: '39079920', name: '39079920 飽洪聚酯' },
            { group: '第二波中止(34項)', code: '39094000', name: '39094000 酚醛樹脂' },
            { group: '第二波中止(34項)', code: '39095000', name: '39095000 聚胺基甲酸酯' },
            { group: '第二波中止(34項)', code: '39100010', name: '39100010 矽氧樹脂' },
            { group: '第二波中止(34項)', code: '39111010', name: '39111010 石油樹脂' },
            { group: '第二波中止(34項)', code: '39199020', name: '39199020 自黏性塑膠板片' },
            { group: '第二波中止(34項)', code: '39201010', name: '39201010 乙烯聚合物板片' },
            { group: '第二波中止(34項)', code: '39202021', name: '39202021 雙軸延伸聚丙烯薄膜' },
            { group: '第二波中止(34項)', code: '39205110', name: '39205110 聚甲基丙烯酸甲酯板片' },
            { group: '第二波中止(34項)', code: '39206210', name: '39206210 聚對苯二甲酸乙烯酯板片' },
            { group: '第二波中止(34項)', code: '39209991', name: '39209991 其他塑膠板片' },
            { group: '第二波中止(34項)', code: '39219010', name: '39219010 塑膠與他材合製板片' },
            { group: '第二波中止(34項)', code: '39231010', name: '39231010 塑膠製盒箱' },
            { group: '第二波中止(34項)', code: '39239090', name: '39239090 運輸包裝用塑膠品' },
            { group: '第二波中止(34項)', code: '39269012', name: '39269012 塑膠製螺絲墊圈' },
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

// 氫能戰情室資料庫
export const H2_DATA_SOURCES = {
  PRODUCTION: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ8aZTek-9SoTaK7Z_Wu9InU2c_vu4cUpD0Nn4fCs-w0IM3XoWeNXK5ZldWoEs6M3G6mJTS6QoF4Mo/pub?gid=0&single=true&output=csv',
  USAGE: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ8aZTek-9SoTaK7Z_Wu9InU2c_vu4cUpD0Nn4fCs-w0IM3XoWeNXK5ZldWoEs6M3G6mJTS6QoF4Mo/pub?gid=687277722&single=true&output=csv'
};

// CCUS 戰情室資料庫
export const CCUS_DATA_SOURCES = {
  CAPTURE: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ8aZTek-9SoTaK7Z_Wu9InU2c_vu4cUpD0Nn4fCs-w0IM3XoWeNXK5ZldWoEs6M3G6mJTS6QoF4Mo/pub?gid=388581449&single=true&output=csv',
  UTILIZATION: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ8aZTek-9SoTaK7Z_Wu9InU2c_vu4cUpD0Nn4fCs-w0IM3XoWeNXK5ZldWoEs6M3G6mJTS6QoF4Mo/pub?gid=1496771601&single=true&output=csv',
  STORAGE: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ8aZTek-9SoTaK7Z_Wu9InU2c_vu4cUpD0Nn4fCs-w0IM3XoWeNXK5ZldWoEs6M3G6mJTS6QoF4Mo/pub?gid=1902888591&single=true&output=csv'
};

// 氫能備用資料
export const MOCK_SUPPLY_MATRIX = [
  { 'Company': '長春石化', 'Plant': '苗栗廠', 'Process': '甲醇重組', '單位碳排': 8.8, '112年產能': 1.5, '112年產量': 1.2, '113年產能': 1.5, '113年產量': 1.4, '114年產量': 1.5 },
  { 'Company': '台灣中油', 'Plant': '桃園煉油廠', 'Process': 'SMR(天然氣)', '單位碳排': 9.5, '112年產能': 3.0, '112年產量': 2.5, '113年產能': 3.0, '113年產量': 2.6, '114年產量': 2.8 },
  { 'Company': '台塑石化', 'Plant': '麥寮一廠', 'Process': 'SMR(輕油)', '單位碳排': 11.2, '112年產能': 13.0, '112年產量': 11.0, '113年產能': 13.0, '113年產量': 12.0, '114年產量': 12.5 },
];

export const MOCK_DEMAND_MATRIX = [
  { 'Company': '台積電', 'Plant': '南科18廠', 'Usage_Type': '化學製程(EUV)', '112年用量': 1.8, '113年用量': 2.0, '114年用量': 2.2 },
  { 'Company': '中鋼', 'Plant': '小港廠', 'Usage_Type': '煉油/還原', '112年用量': 2.8, '113年用量': 3.0, '114年用量': 3.2 },
];

export const COLORS_PROCESS = {
  '主產': '#0369a1', '副產': '#7c3aed', 
  'SMR': '#0284c7', '天然氣重組': '#0ea5e9', '甲醇裂解': '#38bdf8', '甲醇重組': '#7dd3fc', '電解': '#22d3ee', '輕油重組': '#3b82f6', 
  '觸媒重組': '#8b5cf6', '輕油裂解': '#a78bfa', '鹼氯製程': '#c4b5fd', '回收純化': '#ddd6fe', '焦爐氣副產': '#a78bfa', '副產氫氣': '#8b5cf6', '其他': '#94a3b8'
};

export const COLORS_USAGE = {
  '煉油': '#f59e0b', '化工': '#10b981', '燃燒': '#ef4444', '其他': '#64748b', 
  '加氫脫硫': '#fbbf24', '硫磺尾氣處理': '#fcd34d', '其他煉油相關': '#fde047',
  '正丁醇製程': '#34d399', '1,4-丁二醇製程': '#4ade80', '已內醯胺製程': '#86efac', 
  '氫化製程': '#bbf7d0', '芳烃製程': '#6ee7b7', '半導體製程': '#10b981',
  '異丙醇製程': '#22c55e', '雙氧水製程': '#16a34a', '氫化樹脂製程': '#15803d',
  '環保溶劑製程': '#166534', '烷化製程': '#14532d', '酚酮製程': '#052e16',
  '環己酮製程': '#064e3b', '精細化學品製程': '#065f46', '其他化學製程': '#047857',
  '燃料燃燒': '#f87171' 
};

export const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ff6b6b', '#6b7280', '#F06292', '#BA68C8'];