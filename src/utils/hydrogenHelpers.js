// ==========================================
// 氫能戰情室共用的地理/命名輔助函式
// ==========================================
// 原本這幾個函式寫在 HydrogenDashboard.jsx 裡，現在 Supabase 讀取路徑
// （src/lib/fetchHydrogenRecords.js）跟匯入腳本（scripts/migrate-hydrogen-to-supabase.mjs）
// 都需要同一套「公司名稱簡化 / 區域校正 / 廠區座標估算」邏輯，所以搬出來共用，
// 避免像 CLAUDE.md 提到的貿易資料那樣，兩邊各寫一份清洗邏輯導致結果對不上。
import { getRegion as getBasicRegion, simplifyCompanyName } from './helpers';

export const REGION_COUNTIES = {
    '北區': ['基隆市', '臺北市', '新北市', '桃園市', '新竹縣', '新竹市', '宜蘭縣', '苗栗二廠'],
    '中區': ['苗栗縣(主)', '臺中市', '彰化縣', '南投縣', '雲林縣'],
    '南區': ['嘉義縣', '嘉義市', '臺南市', '高雄市', '屏東縣'],
    '東區': ['花蓮縣', '臺東縣']
};

export const getRefinedRegion = (plantName, companyName) => {
    const p = String(plantName || '').trim();
    const c = String(companyName || '').trim();
    const full = `${c} ${p}`;
    if (full.includes('長春') && (p.includes('二廠') || p.includes('苗栗二'))) return '北區';
    if (c.includes('台灣化纖') || c.includes('台化') || c.includes('台塑科騰')) return '中區';
    if (p.match(/(仁武|大社|林園|小港|大發|大林|高雄|屏東|台南|嘉義|南科|善化)/)) return '南區';
    if (p.match(/(麥寮|六輕|彰濱|線西|中龍|頭份|苗栗|台中|彰化|南投|雲林)/)) return '中區';
    if (p.match(/(桃園|觀音|大園|桃煉|新北|台北|基隆|新竹)/)) return '北區';
    if (c.includes('大連') && p.includes('大發')) return '南區';
    if (c.includes('李長榮') && p.includes('高雄')) return '南區';
    if (c.includes('國喬') && p.includes('高雄')) return '南區';
    if (c.includes('中油') && (p.includes('大林') || p.includes('石化') || p.includes('林園'))) return '南區';
    if (c.includes('中油') && p.includes('桃園')) return '北區';
    if (c.includes('台灣石化') || c.includes('台苯')) return '南區';
    return getBasicRegion(plantName);
};

export const getDashboardPlantName = (company, plant) => {
    const c = simplifyCompanyName(company);
    let p = String(plant || '').replace(/股份有限公司|工業區|工業|廠$/g, '') + '廠';
    if (c.includes('台化') && p.includes('台北')) p = '麥寮廠';
    if (p === '廠') p = '廠區';
    if (c === '中油' && p.includes('石化事業部')) return '中油 石化事業部';
    return `${c} ${p}`;
};

export const getIndustrialZone = (plant, company) => {
    const p = String(plant || '').trim();
    const c = String(company || '').trim();
    const full = `${c} ${p}`;
    if (c.includes('台化') && p.includes('台北')) return '雲林-麥寮工業區';
    if (c.includes('台灣化纖') || c.includes('台化') || c.includes('台塑科騰')) return '雲林-麥寮工業區';
    if (full.includes('長春') && (p.includes('二廠') || p.includes('苗栗二'))) return '北部-其他工業區';
    if (c.includes('台灣石化')) return '高雄-大發工業區';
    if ((c.includes('台苯') || c.includes('台灣苯乙烯')) && p.includes('高雄')) return '高雄-林園工業區';
    if (c.includes('李長榮') && p.includes('高雄')) return '高雄-小港工業區';
    if (c.includes('國喬') && p.includes('高雄')) return '高雄-仁武工業區';
    if (full.includes('大發')) return '高雄-大發工業區';
    if (full.includes('林園') || full.includes('大林') || (c.includes('中油') && p.includes('石化事業部'))) return '高雄-林園工業區';
    if (full.includes('小港') || full.includes('臨海') || full.includes('中鋼')) return '高雄-小港工業區';
    if (full.includes('仁武') || full.includes('大社')) return '高雄-仁武工業區';
    if (full.includes('麥寮') || full.includes('六輕') || (c.includes('台塑') && p.includes('麥寮'))) return '雲林-麥寮工業區';
    if (full.includes('彰濱') || full.includes('線西') || full.includes('中龍')) return '彰化-彰濱工業區';
    if (full.includes('桃園') || p.includes('桃煉') || full.includes('觀音') || full.includes('大園')) return '桃園工業區(含桃煉)';
    if (p.includes('頭份') || (c.includes('長春') && p.includes('苗栗'))) return '苗栗-頭份工業區';
    if (full.includes('南科') || full.includes('台積電') || p.includes('18廠')) return '台南-南部科學園區';
    return '其他獨立廠區';
};

export const getApproximateCoordinates = (plant, company) => {
    const n = `${String(company || '')} ${String(plant || '')}`;
    if (company?.includes('台化') && plant?.includes('台北')) return { lat: 23.78, lon: 120.18 };
    if (company?.includes('台塑科騰')) return { lat: 23.783, lon: 120.179 };
    if (company?.includes('李長榮') && plant?.includes('高雄')) return { lat: 22.538, lon: 120.343 };
    if ((company?.includes('台苯') || company?.includes('台灣苯乙烯')) && plant?.includes('高雄')) return { lat: 22.493, lon: 120.382 };
    if (n.includes('大發') || company?.includes('台灣石化')) return { lat: 22.58, lon: 120.40 };
    if (n.includes('林園') || n.includes('大林') || n.includes('石化事業部')) return { lat: 22.51, lon: 120.38 };
    if (n.includes('小港') || n.includes('中鋼') || n.includes('臨海')) return { lat: 22.54, lon: 120.34 };
    if (n.includes('仁武') || n.includes('大社') || n.includes('國喬')) return { lat: 22.70, lon: 120.34 };
    if (n.includes('南科') || n.includes('台積電') || n.includes('善化')) return { lat: 23.10, lon: 120.27 };
    if (n.includes('麥寮') || n.includes('六輕') || company?.includes('台灣化纖') || company?.includes('台化')) return { lat: 23.78, lon: 120.18 };
    if (n.includes('彰濱') || n.includes('線西') || n.includes('中龍')) return { lat: 24.07, lon: 120.42 };
    if (n.includes('苗栗二') || n.includes('二廠')) return { lat: 24.58, lon: 120.82 };
    if (n.includes('頭份') || n.includes('長春') || n.includes('苗栗')) return { lat: 24.68, lon: 120.91 };
    if (n.includes('桃園') || n.includes('觀音') || n.includes('桃煉')) return { lat: 25.03, lon: 121.12 };
    return { lat: 23.6, lon: 120.9 };
};
