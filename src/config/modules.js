// 戰情模組清單（左側功能列、手機底部導覽列共用）
import { Globe, Factory, Leaf, TrendingDown } from 'lucide-react';

export const MODULES = [
  { id: 'trade', label: '貿易戰情室', short: '貿易', icon: Globe },
  { id: 'hydrogen', label: '氫能供需戰情室', short: '氫能', icon: Factory },
  { id: 'ccus', label: '碳捕捉與封存戰情室', short: 'CCUS', icon: Leaf },
  { id: 'carbonfee', label: '碳費自主減量計畫', short: '碳費', icon: TrendingDown },
];
