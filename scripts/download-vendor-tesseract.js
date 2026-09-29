/**
 * Automated Vendor Asset Downloader for CI/CD & Build Pipelines
 * Downloads genuine official production Tesseract.js, WASM core, Worker, and Russian/English traineddata models
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const vendorTesseractDir = path.resolve(__dirname, '../vendor/tesseract');

fs.mkdirSync(vendorTesseractDir, { recursive: true });

const filesToDownload = [
  {
    name: 'tesseract.min.js',
    url: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/dist/tesseract.min.js'
  },
  {
    name: 'worker.min.js',
    url: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/dist/worker.min.js'
  },
  {
    name: 'tesseract-core.wasm.js',
    url: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0/tesseract-core.wasm.js'
  },
  {
    name: 'tesseract-core-simd.wasm.js',
    url: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0/tesseract-core-simd.wasm.js'
  },
  {
    name: 'rus.traineddata.gz',
    url: 'https://tessdata.projectnaptha.com/4.0.0_fast/rus.traineddata.gz'
  },
  {
    name: 'eng.traineddata.gz',
    url: 'https://tessdata.projectnaptha.com/4.0.0_fast/eng.traineddata.gz'
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
  console.log('📥 Проверка и загрузка оффлайн-бинарников Tesseract.js WASM и языковых моделей...');
  
  for (const item of filesToDownload) {
    const destPath = path.join(vendorTesseractDir, item.name);
    // If file doesn't exist or is < 1KB (stub)
    let needsDownload = true;
    if (fs.existsSync(destPath)) {
      const stats = fs.statSync(destPath);
      if (stats.size > 2048) {
        needsDownload = false;
        console.log(`  ✓ ${item.name} (${(stats.size / 1024).toFixed(1)} KB) уже загружен`);
      }
    }

    if (needsDownload) {
      console.log(`  ⬇ Загрузка ${item.name} с ${item.url}...`);
      try {
        await downloadFile(item.url, destPath);
        const stats = fs.statSync(destPath);
        console.log(`  ✓ Успешно: ${item.name} (${(stats.size / 1024).toFixed(1)} KB)`);
      } catch (err) {
        console.warn(`  ⚠️ Не удалось скачать ${item.name} (${err.message}). Будет использован встроенный OCR движок.`);
      }
    }
  }
  console.log('✅ Подготовка /vendor/tesseract/ завершена.\n');
}

main().catch(console.error);
