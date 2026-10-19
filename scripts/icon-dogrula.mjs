/**
 * Play Store ikon kurallarını denetler: 512x512, <= 1 MB, köşeler dolu
 * (yuvarlatma/şeffaflık yok). Yazı yokluğu çizim kodundan garanti:
 * `remotion/icons/` hiç metin çizmiyor.
 *
 * Kullanım: npm run icons:verify
 */
import {chromium} from 'playwright';
import {readFileSync, statSync, existsSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOSYALAR = [
  'icon_flaming_ball.png',
  'icon_player_hero.png',
  'icon_minimal_court.png',
  'icon_arcade_shield.png',
];

const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? undefined});
const page = await browser.newPage();
let hata = 0;

for (const ad of DOSYALAR) {
  const yol = join(KOK, 'out', ad);
  if (!existsSync(yol)) {
    console.log(`YOK    ${ad}`);
    hata++;
    continue;
  }
  const buf = readFileSync(yol);
  const boyut = statSync(yol).size;
  const sonuc = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let seffaf = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 255) seffaf++;
    const alfa = (x, y) => d[(y * c.width + x) * 4 + 3];
    const koseler = [alfa(0, 0), alfa(c.width - 1, 0), alfa(0, c.height - 1), alfa(c.width - 1, c.height - 1)];
    return {en: img.width, boy: img.height, seffaf, koseler};
  }, buf.toString('base64'));

  const sorunlar = [];
  if (sonuc.en !== 512 || sonuc.boy !== 512) sorunlar.push(`boyut ${sonuc.en}x${sonuc.boy}`);
  if (boyut > 1024 * 1024) sorunlar.push(`dosya ${boyut} B > 1 MB`);
  if (sonuc.seffaf > 0) sorunlar.push(`${sonuc.seffaf} şeffaf piksel`);
  if (sonuc.koseler.some((a) => a !== 255)) sorunlar.push('köşe şeffaf/yuvarlak');

  console.log(`${sorunlar.length ? 'HATA  ' : 'TAMAM '} ${ad}  ${sonuc.en}x${sonuc.boy}  ${(boyut / 1024).toFixed(1)} KB`);
  for (const s of sorunlar) console.log(`         - ${s}`);
  hata += sorunlar.length;
}

await browser.close();
process.exit(hata ? 1 : 0);
