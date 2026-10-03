// data/lowcarbon/cases.csv 讀寫（RFC 4180：欄位內可有逗號、雙引號以 "" 跳脫、換行）
// 匯入資料庫、產生 Excel、爬蟲比對「哪些書已擷取」都讀這份檔案。

import { readFile } from 'node:fs/promises';

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuote = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuote) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else inQuote = false;
      } else field += c;
    } else if (c === '"') inQuote = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((v) => v !== '')) rows.push(row); }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

export async function readCasesCsv(path) {
  return parseCsv(await readFile(path, 'utf8'));
}
