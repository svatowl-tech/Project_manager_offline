/**
 * Download script for PDF-Lib and Mozilla PDF.js vendor assets
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const vendorDir = path.resolve(__dirname, '../vendor');

fs.mkdirSync(vendorDir, { recursive: true });

const filesToDownload = [
  {
    name: 'pdf-lib.min.js',
    url: 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js'
  },
  {
    name: 'pdf.min.js',
    url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
  },
  {
    name: 'pdf.worker.min.js',
    url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  }
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        return reject(new Error(`HTTP ${response.statusCode} for ${url}`));
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve(true));
      });
    }).on('error', (err) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  console.log('📥 Загрузка локальных библиотек PDF-Lib и PDF.js в /vendor/...');
  for (const item of filesToDownload) {
    const dest = path.join(vendorDir, item.name);
    try {
      console.log(`  ⬇ Загрузка ${item.name}...`);
      await downloadFile(item.url, dest);
      const size = (fs.statSync(dest).size / 1024).toFixed(1);
      console.log(`  ✓ ${item.name} сохранен (${size} KB)`);
    } catch (e) {
      console.warn(`  ⚠️ Не удалось скачать ${item.name}: ${e.message}`);
    }
  }
}

main();
