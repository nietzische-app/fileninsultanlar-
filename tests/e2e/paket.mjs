/**
 * PAKET testi — oyunun mağaza kabuğunda çalıştığı gibi.
 *
 * Öteki tarayıcı testleri Vite'ın GELİŞTİRME sunucusuna karşı koşuyor.
 * Capacitor öyle servis etmiyor: `dist/` klasörünü WebView'in kökünden
 * düz dosya olarak veriyor, geliştirme sunucusu yok, sıcak yeniden
 * yükleme yok, ve `import.meta.env.DEV` false.
 *
 * Aradaki farkın somut sonuçları var ve hepsi sessizce bozulan türden:
 *   - Varlık yolları mutlaksa (`/assets/...`) WebView'de 404 verir ve
 *     ekran bomboş açılır.
 *   - `?rele=` ezmesi ÜRETİMDE okunmuyor (bilerek), yani mağaza
 *     yapısında röle adresi derleme anında gömülmüş olmalı. Gömülü
 *     değilse ÇEVRİMİÇİ düğmesi hiç görünmez ve bunu ancak mağazaya
 *     yükledikten sonra fark ederiz.
 *   - Android'in donanım GERİ tuşu, işlenmezse uygulamayı kapatıyor.
 *     Maçın ortasında bu, hükmen mağlubiyet demek.
 *
 * Bu test yapılmış `dist/`i düz bir dosya sunucusundan servis edip
 * gerçek tarayıcıda açıyor — Capacitor'ın yaptığının aynısı.
 */

import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { baslat } from '../../sunucu/rele.js';
import { tarayiciAc, mobilBaglam, masaustuBaglam, VARSAYILAN_TERCIH, kontrolcu } from './yardim.mjs';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = Number(process.env.PAKET_PORT ?? 5300);
const RELE_PORT = Number(process.env.PAKET_RELE_PORT ?? 8805);
const URL = `http://localhost:${PORT}/`;

const kontrol = kontrolcu();

/*
 * Yapıyı test KENDİ üretiyor, hazır `dist/`e güvenmiyor.
 *
 * İki sebebi var. Birincisi: hazır dist bayat olabilir ve test o
 * zaman geçmiş bir sürümü sınar — sessizce yanlış bir yeşil.
 * İkincisi: röle adresinin GÖMÜLÜ olduğunu sınamak istiyoruz ve bunun
 * için adresi biz vermeliyiz.
 *
 * Ayrı bir dizine yazıyor: gerçek `dist/`i test rölesinin adresiyle
 * ezmek, sonra o klasörü dağıtan biri için sinsi bir tuzak olurdu.
 */
const DIST = mkdtempSync(join(tmpdir(), 'paket-dist-'));
console.log('═══ mağaza paketi');
console.log('yapı kuruluyor…');
execFileSync('npx', ['vite', 'build', '--outDir', DIST, '--emptyOutDir'], {
  cwd: KOK,
  env: { ...process.env, VITE_RELE_URL: `ws://localhost:${RELE_PORT}` },
  stdio: 'ignore',
});

/*
 * Düz dosya sunucusu — Capacitor'ın WebView'e verdiği şeyin aynısı.
 * Vite'ın `preview` komutu da olurdu ama o kendi ara katmanlarını
 * ekliyor; burada istediğimiz tam olarak ARA KATMANSIZ servis.
 * Node ile yazılıyor, `python3 -m http.server` ile değil: testin
 * koştuğu her yerde python olduğunu varsayamayız.
 */
const TURLER = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};
const sunucu = createServer((istek, cevap) => {
  const yol = decodeURIComponent(istek.url.split('?')[0]);
  // `normalize` + kök denetimi: dizin dışına çıkan yol servis edilmesin
  const dosya = normalize(join(DIST, yol === '/' ? 'index.html' : yol));
  if (!dosya.startsWith(DIST) || !existsSync(dosya) || !statSync(dosya).isFile()) {
    cevap.writeHead(404).end();
    return;
  }
  cevap.writeHead(200, { 'content-type': TURLER[extname(dosya)] ?? 'application/octet-stream' });
  createReadStream(dosya).pipe(cevap);
});
await new Promise((coz) => sunucu.listen(PORT, coz));

const veriDizini = mkdtempSync(join(tmpdir(), 'paket-veri-'));
const rele = await baslat({ port: RELE_PORT, nabiz: 60_000, veriDizini });

const browser = await tarayiciAc();

async function sayfaAc({ mobil = true } = {}) {
  const ctx = mobil
    ? await mobilBaglam(browser)
    : await masaustuBaglam(browser, { width: 1280, height: 720 });
  const page = await ctx.newPage();
  const hatalar = [];
  const istekler = [];
  page.on('pageerror', (e) => hatalar.push(`PAGEERROR ${String(e).slice(0, 200)}`));
  page.on('console', (m) => {
    if (m.type() === 'error') hatalar.push(`CONSOLE ${m.text().slice(0, 160)}`);
  });
  // 404'ler sessiz: varlık yolu bozuksa ancak burada görünür
  page.on('response', (r) => {
    if (r.status() >= 400) istekler.push(`${r.status()} ${r.url().slice(0, 90)}`);
  });

  await page.goto(URL, { waitUntil: 'load' });
  await page.evaluate(
    (t) => localStorage.setItem('filenin-sultanlari-prefs', JSON.stringify(t)),
    { ...VARSAYILAN_TERCIH, format: 'practice' },
  );
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1200);

  page.hatalar = hatalar;
  page.kirikIstekler = istekler;
  return { ctx, page };
}

const { ctx, page } = await sayfaAc();

// --- Varlık yolları ---
kontrol(
  'hiçbir istek 404 vermiyor',
  page.kirikIstekler.length === 0,
  page.kirikIstekler.slice(0, 4).join(' | '),
);
kontrol('konsol hatası yok', page.hatalar.length === 0, page.hatalar.slice(0, 3).join(' | '));

// --- Oyun gerçekten açıldı mı ---
kontrol(
  'başlangıç ekranı geldi',
  (await page.getByRole('button', { name: /OYNA|BAŞLA/ }).count()) > 0
    || (await page.locator('canvas').count()) > 0,
);

// --- Röle adresi GÖMÜLÜ mü ---
/*
 * Üretim yapısında `?rele=` okunmuyor, yani adres derleme anında
 * gömülmüş olmalı. Gömülü değilse ÇEVRİMİÇİ menüde hiç çıkmaz ve bunu
 * ancak mağazaya yükledikten sonra fark ederdik.
 */
kontrol(
  'ÇEVRİMİÇİ düğmesi var (röle adresi gömülü)',
  (await page.getByRole('button', { name: /ÇEVRİMİÇİ/ }).count()) > 0,
);

// --- Çevrimiçi gerçekten çalışıyor mu (gömülü adresle) ---
await page.getByRole('button', { name: /ÇEVRİMİÇİ/ }).first().click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: /ODA KUR/ }).last().click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: /HIZLI EŞLEŞ/ }).click();
await page.waitForTimeout(1500);

kontrol(
  'gömülü adresle röleye bağlanıyor',
  rele.sira.sayi === 1,
  `sırada=${rele.sira.sayi}`,
);
await ctx.close();

// --- Geliştirme ezmesi ÜRETİMDE kapalı olmalı ---
/*
 * `?rele=` ile yabancı bir sunucuya yönlendirilememeli: paylaşılan bir
 * bağlantı oyuncuyu başkasının rölesine bağlayabilirdi. Bunu ölçmenin
 * DOĞRU yolu, ezme denendiğinde oyunun HÂLÂ gömülü adrese bağlandığını
 * görmek.
 *
 * İlk yazışımda `window.__RELE_URL` diye var olmayan bir alanı okuyup
 * "null, demek ki ezme çalışmıyor" diyordum — o kontrol hiçbir şey
 * ölçmüyordu, her hâlükârda geçerdi.
 */
const ctx2 = await mobilBaglam(browser);
const sahtePage = await ctx2.newPage();
await sahtePage.goto(`${URL}?rele=ws://127.0.0.1:1/yabanci`, { waitUntil: 'load' });
await sahtePage.evaluate(
  (t) => localStorage.setItem('filenin-sultanlari-prefs', JSON.stringify(t)),
  { ...VARSAYILAN_TERCIH, format: 'practice' },
);
await sahtePage.reload({ waitUntil: 'load' });
await sahtePage.waitForTimeout(1200);

await sahtePage.getByRole('button', { name: /ÇEVRİMİÇİ/ }).first().click();
await sahtePage.waitForTimeout(400);
await sahtePage.getByRole('button', { name: /ODA KUR/ }).last().click();
await sahtePage.waitForTimeout(600);
await sahtePage.getByRole('button', { name: /HIZLI EŞLEŞ/ }).click();
await sahtePage.waitForTimeout(1500);

/*
 * Ezme çalışsaydı oyun 127.0.0.1:1'e (kapalı port) bağlanmaya çalışır
 * ve sıramıza HİÇ kimse gelmezdi. Sıraya girdiyse gömülü adres
 * kullanılmış demektir.
 */
kontrol(
  'üretimde ?rele= ezmesi çalışmıyor — gömülü adrese bağlandı',
  rele.sira.sayi === 1,
  `sırada=${rele.sira.sayi}`,
);
await ctx2.close();

await browser.close();
await new Promise((coz) => sunucu.close(coz));
await rele.kapat();
rmSync(DIST, { recursive: true, force: true });
rmSync(veriDizini, { recursive: true, force: true });

kontrol.bitir('MAĞAZA PAKETİ');
