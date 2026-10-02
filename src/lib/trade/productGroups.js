// 「變動與關聯」用的產品類別：同一類產品放在一起比較，才看得出事件對整個產業鏈的影響。
// codes 用稅號前綴比對（6 碼 = 該 HS6 底下全部 11 碼）。資料庫沒收錄的稅號會在頁面上標示「未收錄」。
// 要新增類別或調整成員，只改這個檔案。
export const PRODUCT_GROUPS = [
  {
    id: 'basic5',
    label: '五大基礎化學品',
    desc: '石化上游基本原料（三烯＋苯、二甲苯），下游塑化產業的成本來源',
    items: [
      { code: '290121', name: '乙烯' },
      { code: '290122', name: '丙烯' },
      { code: '290124', name: '丁二烯' },
      { code: '290220', name: '苯' },
      { code: '29024', name: '二甲苯' },
    ],
  },
  {
    id: 'aromatic_chain',
    label: '芳香烴產業鏈',
    desc: '二甲苯 → 對苯二甲酸（PTA）；苯乙烯 → 苯乙烯系樹脂',
    items: [
      { code: '290243', name: '對二甲苯' },
      { code: '291736', name: '對苯二甲酸' },
      { code: '290250', name: '苯乙烯' },
      { code: '3903', name: '苯乙烯聚合物' },
    ],
  },
  {
    id: 'ccu',
    label: '碳再利用（CCU）相關產品',
    desc: '問卷中廠商規劃以 CO2 製造或替代的產品，對應 CCUS 戰情室「碳再利用」',
    items: [
      { code: '281121', name: '二氧化碳' },
      { code: '290511', name: '甲醇' },
      { code: '291521', name: '醋酸' },
      { code: '283650', name: '碳酸鈣' },
      { code: '390740', name: '聚碳酸酯 PC' },
    ],
  },
  {
    id: 'h2',
    label: '氫能與氨',
    desc: '氫氣與氨（氫載體），對應氫能供需戰情室',
    items: [
      { code: '280410', name: '氫' },
      { code: '2814', name: '氨' },
    ],
  },
  {
    id: 'solvent',
    label: '醇類與溶劑',
    desc: '甲醇與常用醇類、醇醚溶劑',
    items: [
      { code: '290511', name: '甲醇' },
      { code: '290512', name: '異丙醇' },
      { code: '290513', name: '正丁醇' },
      { code: '290943', name: '乙二醇丁醚' },
      { code: '291532', name: '醋酸乙烯酯' },
    ],
  },
  {
    id: 'resin',
    label: '工程塑膠與樹脂',
    desc: '聚丙烯、聚縮醛、環氧樹脂、PC 等初級狀態樹脂',
    items: [
      { code: '3902', name: '聚丙烯類' },
      { code: '390710', name: '聚縮醛' },
      { code: '390730', name: '環氧樹脂' },
      { code: '390740', name: '聚碳酸酯 PC' },
      { code: '39079', name: '其他聚酯' },
    ],
  },
];
