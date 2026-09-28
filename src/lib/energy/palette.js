// 氫能 / CCUS 圖表色票：沿用碳費模組同一組經 CVD 驗證的類別色（固定順序指派，不依排名重排）。
// 地圖上每個圖層另有不同的點位形狀，顏色不是唯一的辨識方式。
export const CAT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
export const NEUTRAL = '#94a3b8';

export const CCUS_LAYERS = {
  capture: { id: 'capture', label: '已裝置捕捉', color: CAT[0], shape: 'square' },
  sources: { id: 'sources', label: '排放源潛力（點源）', color: CAT[1], shape: 'circle' },
  utilization: { id: 'utilization', label: '碳再利用 CCU', color: CAT[2], shape: 'diamond' },
  storage: { id: 'storage', label: '封存場址', color: CAT[3], shape: 'hexagon' },
  plans: { id: 'plans', label: '規劃捕捉 / CCS', color: CAT[4], shape: 'triangle' },
  hubs: { id: 'hubs', label: '管網規劃樞紐（假設）', color: '#64748b', shape: 'circle' },
};

export const PROGRAM_COLOR = { 產發署: CAT[0], 環境部旗艦: CAT[1] };
