// ==========================================
// 資料同步腳本
// ==========================================
// 用法: npm run sync-data
// 把 scripts/data-sources.config.mjs 列出的每一個 Google Sheet
// 抓成本地 CSV，存到 public/data/<key>.csv，並產生
// src/config/dataManifest.json 記錄各來源的最後同步時間與筆數，
// 供前端顯示「資料更新時間」用。

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_SOURCES } from './data-sources.config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'public', 'data');
const MANIFEST_PATH = join(ROOT, 'src', 'config', 'dataManifest.json');

function countDataRows(csvText) {
  return csvText.split(/\r\n|\n/).filter((line) => line.trim()).length - 1;
}

async function fetchOne(source) {
  const outPath = join(DATA_DIR, `${source.key}.csv`);
  await mkdir(dirname(outPath), { recursive: true });

  const res = await fetch(source.url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const text = await res.text();

  if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
    throw new Error('收到 HTML 而非 CSV（試算表可能未發布到網路，或連結已失效）');
  }

  // 加上 UTF-8 BOM，避免 Windows 版 Excel 雙擊開啟 CSV 時誤判編碼、中文變亂碼
  const withBom = text.startsWith('﻿') ? text : '﻿' + text;
  await writeFile(outPath, withBom, 'utf-8');
  return { rows: countDataRows(text), bytes: Buffer.byteLength(withBom, 'utf-8') };
}

async function main() {
  console.log(`開始同步 ${DATA_SOURCES.length} 個資料來源...\n`);

  const manifest = { syncedAt: new Date().toISOString(), sources: {} };
  let failCount = 0;

  for (const source of DATA_SOURCES) {
    process.stdout.write(`  ${source.key} ... `);
    try {
      const { rows, bytes } = await fetchOne(source);
      manifest.sources[source.key] = { rows, bytes, ok: true };
      console.log(`OK (${rows} 筆, ${(bytes / 1024).toFixed(0)} KB)`);
    } catch (err) {
      manifest.sources[source.key] = { ok: false, error: err.message };
      console.log(`失敗 - ${err.message}`);
      failCount++;
    }
  }

  await mkdir(dirname(MANIFEST_PATH), { recursive: true });
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

  console.log(`\n完成。${DATA_SOURCES.length - failCount}/${DATA_SOURCES.length} 個來源成功。`);
  console.log(`清單已寫入 ${MANIFEST_PATH.replace(ROOT, '.')}`);

  if (failCount > 0) {
    console.log('\n有來源同步失敗，本地 CSV 保留舊版本（若存在），請檢查上方錯誤訊息。');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('同步腳本發生未預期錯誤:', err);
  process.exitCode = 1;
});
