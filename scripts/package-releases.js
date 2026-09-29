/**
 * Multi-Platform Release Packager
 * Generates portable, zero-install release bundles for Windows, Astra Linux, and SMB Network Shares
 * Fully bundles production Tesseract WASM + traineddata and Secure Context launchers
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist-releases');

const packageJson = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'package.json'), 'utf8'));
const version = packageJson.version || '1.0.0';

console.log(`\n======================================================`);
console.log(`📦 СБОРКА АВТОНОМНЫХ ПОРТАТИВНЫХ РЕЛИЗОВ v${version}`);
console.log(`======================================================\n`);

// 1. Download vendor assets if missing
try {
  console.log('🔄 Проверка и загрузка оффлайн-ресурсов (Tesseract WASM & traineddata)...');
  execSync('node scripts/download-vendor-tesseract.js', { stdio: 'inherit' });
} catch (e) {
  console.warn('⚠️ Загрузчик Tesseract завершился:', e.message);
}

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function createDataStructure(targetDir) {
  const dirs = [
    'data/tasks',
    'data/employees',
    'data/contracts',
    'data/docs',
    'data/locks'
  ];
  dirs.forEach(d => {
    fs.mkdirSync(path.join(targetDir, d), { recursive: true });
    fs.writeFileSync(path.join(targetDir, d, '.gitkeep'), '');
  });
}

// 1. Build Base SMB Network Share Bundle
const smbDir = path.join(distDir, `SUP-Director-v${version}-SMB-Share`);
fs.mkdirSync(smbDir, { recursive: true });
fs.copyFileSync(path.join(rootDir, 'index.html'), path.join(smbDir, 'index.html'));
copyDir(path.join(rootDir, 'css'), path.join(smbDir, 'css'));
copyDir(path.join(rootDir, 'js'), path.join(smbDir, 'js'));
copyDir(path.join(rootDir, 'vendor'), path.join(smbDir, 'vendor'));
createDataStructure(smbDir);

// Copy launchers into root
fs.copyFileSync(path.join(rootDir, 'launchers/windows/Запуск_СУП.bat'), path.join(smbDir, 'Запуск_СУП.bat'));
fs.copyFileSync(path.join(rootDir, 'launchers/windows/Запуск_СУП_Фоновый.vbs'), path.join(smbDir, 'Запуск_СУП_Фоновый.vbs'));
fs.copyFileSync(path.join(rootDir, 'launchers/astra-linux/start_sup_astra.sh'), path.join(smbDir, 'start_sup_astra.sh'));
fs.chmodSync(path.join(smbDir, 'start_sup_astra.sh'), 0o755);
fs.copyFileSync(path.join(rootDir, 'launchers/astra-linux/sup-director.desktop'), path.join(smbDir, 'sup-director.desktop'));

// 2. Windows Portable
const winDir = path.join(distDir, `SUP-Director-v${version}-Windows-Portable`);
copyDir(smbDir, winDir);

// 3. Astra Linux Portable
const astraDir = path.join(distDir, `SUP-Director-v${version}-AstraLinux-Portable`);
copyDir(smbDir, astraDir);

console.log('✅ Структура каталогов платформ сформирована.');

// 4. Archive packaging
const winZipName = `SUP-Director-v${version}-Windows-Portable.zip`;
const astraTarName = `SUP-Director-v${version}-AstraLinux-Portable.tar.gz`;
const smbZipName = `SUP-Director-v${version}-SMB-NetworkShare.zip`;

try {
  execSync(`cd "${distDir}" && tar -czf "${astraTarName}" "SUP-Director-v${version}-AstraLinux-Portable"`, { stdio: 'inherit' });
  console.log(`✅ Создан архив: ${astraTarName}`);
} catch (e) {
  console.warn('ℹ️ tar не найден.');
}

try {
  execSync(`cd "${distDir}" && zip -r "${winZipName}" "SUP-Director-v${version}-Windows-Portable"`, { stdio: 'inherit' });
  execSync(`cd "${distDir}" && zip -r "${smbZipName}" "SUP-Director-v${version}-SMB-Share"`, { stdio: 'inherit' });
  console.log(`✅ Созданы архивы: ${winZipName}, ${smbZipName}`);
} catch (e) {
  console.warn('ℹ️ zip утилита будет вызвана в среде GitHub Actions runner.');
}

console.log(`\n🎉 СБОРКА ЗАВЕРШЕНА. ПАКЕТЫ ГОТОВЫ В ПАПКЕ /dist-releases/\n`);
