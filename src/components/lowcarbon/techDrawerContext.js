// 技術類型明細抽屜：任何分頁點到技術類型（類別＋子類）都呼叫 openTech(key) 打開同一個明細
import { createContext, useContext } from 'react';

export const TechDrawerContext = createContext(() => {});
export const useOpenTech = () => useContext(TechDrawerContext);
