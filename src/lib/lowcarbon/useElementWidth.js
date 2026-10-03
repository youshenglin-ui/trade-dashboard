// 量測容器寬度：自繪 SVG 圖表用實際像素繪製（不用 viewBox 縮放），手機上字才不會被縮小
import { useEffect, useRef, useState } from 'react';

export function useElementWidth(initial = 800) {
  const ref = useRef(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}
