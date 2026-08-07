#!/usr/bin/env node
/**
 * Oyun portalları için dağıtım paketi üretir.
 *
 * Portallar (Oyunskor, Y8, CrazyGames vb.) oyunu ya bir ZIP olarak
 * isteyip kendi sunucularında bir ALT KLASÖRDE barındırır, ya da bir
 * URL'yi iframe içine gömer. İkisi de kök dizin varsaymaz — bu yüzden
 * `vite.config.js` içinde `base: './'` kullanılıyor.
 *
 * Bu betik normal build'i alır, portalda işe yaramayan dosyaları
 * ayıklar ve ZIP'ler:
 *   - .map  → kaynak haritaları (paketin yarısı, oyuncuya faydası yok)
 *   - sw.js → service worker alt klasörde/iframe'de zaten kaydolmuyor
 *   - manifest.webmanifest → PWA kurulumu portal bağlamında anlamsız
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const out = path.join(root, 'portal');
const zipName = 'filenin-sultanlari-portal.zip';

console.log('Portal paketi hazırlanıyor...\n');

// 1. Temiz build
execSync('npm run build', { cwd: root, stdio: 'inherit' });

// 2. dist'i portal/ altına kopyala
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(dist, out, { recursive: true });

// 3. Portalda gereksiz olanları at
let removed = 0;
const drop = (file) => {
  const p = path.join(out, file);
  if (fs.existsSync(p)) {
    const size = fs.statSync(p).size;
    fs.rmSync(p, { recursive: true, force: true });
    removed += size;
    console.log(`  çıkarıldı: ${file} (${(size / 1024).toFixed(0)} KB)`);
  }
};

console.log('\nPortalda işe yaramayanlar ayıklanıyor:');
drop('sw.js');
drop('manifest.webmanifest');
for (const f of fs.readdirSync(path.join(out, 'assets'))) {
  if (f.endsWith('.map')) drop(path.join('assets', f));
}

// 4. Mutlak yol kalmadığını doğrula — portalda en sık kırılan şey bu
const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
const absolute = [...html.matchAll(/(?:src|href)="(\/[^/][^"]*)"/g)].map((m) => m[1]);
if (absolute.length > 0) {
  console.error(`\nHATA: mutlak yol kaldı → ${absolute.join(', ')}`);
  console.error('Alt klasörde barındırılınca bu dosyalar 404 verir.');
  process.exit(1);
}

// 5. ZIP
fs.rmSync(path.join(root, zipName), { force: true });
execSync(`cd "${out}" && zip -qr "../${zipName}" .`, { stdio: 'inherit', shell: '/bin/bash' });

const zipSize = fs.statSync(path.join(root, zipName)).size;
console.log(`\n✓ ${zipName} — ${(zipSize / 1024).toFixed(0)} KB`);
console.log(`  (${(removed / 1024).toFixed(0)} KB gereksiz dosya ayıklandı)`);
console.log(`\nPaket kökünde index.html var; portal onu alt klasöre açabilir.`);
