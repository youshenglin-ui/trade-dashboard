// 國旗小圖：Windows 的瀏覽器不顯示國旗 emoji，所以改用圖片（flagcdn），載不到就自動隱藏。
import React, { useState } from 'react';
import { countryMeta, flagUrl } from '../../lib/geo/countries';

export default function CountryFlag({ country, size = 16 }) {
  const [failed, setFailed] = useState(false);
  const meta = countryMeta(country);
  if (!meta || failed) return null;
  return (
    <img src={flagUrl(meta.iso2, 40)} alt="" aria-hidden="true" loading="lazy"
      width={Math.round(size * 1.5)} height={size}
      className="inline-block rounded-[2px] border border-slate-200 object-cover flex-shrink-0"
      style={{ width: size * 1.5, height: size }}
      onError={() => setFailed(true)} />
  );
}
