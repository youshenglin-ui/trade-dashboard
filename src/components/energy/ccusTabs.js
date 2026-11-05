import { Box, Factory, FlaskConical, GraduationCap, Map as MapIcon } from 'lucide-react';

// CCUS 戰情室分頁（問卷資料的四個頁面）
export const CCUS_SURVEY_TABS = [
  { value: 'overview', label: '整合地圖', icon: MapIcon },
  { value: 'capture', label: '碳捕捉', icon: Factory },
  { value: 'storage', label: '碳封存與 CCS Hub', icon: Box },
  { value: 'utilization', label: '碳再利用', icon: FlaskConical },
  { value: 'talent', label: '人才供需', icon: GraduationCap },
];
