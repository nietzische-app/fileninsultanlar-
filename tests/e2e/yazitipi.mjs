/**
 * PİKSEL YAZI TİPİ GERÇEKTEN KULLANILIYOR MU.
 *
 * NEDEN VAR: bu test yazılmadan önce oyun BİR AY boyunca piksel
 * yazı tipi olmadan çalıştı ve kimse fark etmedi.
 *
 * `public/fonts/press-start-2p.woff2` yerine Google Fonts CSS'indeki
 * İKİNCİ `@font-face` kaydı — kiril alt kümesi — indirilmişti. Dosya
 * geçerli bir woff2'ydi: tarayıcı onu sorunsuz yüklüyor,
 * `document.fonts.status` "loaded" diyor, hiçbir yerde hata çıkmıyor.
 * Ama içinde TEK BİR LATİN HARFİ yoktu; her yazı sessizce tarayıcının
 * monospace'ine düşüyordu. 8 bit görünüm iddia eden bir oyunun bütün
 * yazıları düz bir daktilo fontuydu ve bunu hiçbir denetim görmedi:
 * ekran görüntüleri "çalışıyor" gibiydi, testler yeşildi.
 *
 * O yüzden burada "font yüklendi mi" DEĞİL, "harfler gerçekten o
 * fonttan mı çiziliyor" ölçülüyor. Ölçü ilerleme genişliği:
 * Press Start 2P her karakteri tam 1em veriyor, yedek monospace 0.6em.
 * Bir karakter fontta yoksa tarayıcı yalnız o karakter için yedeğe
 * düşüyor ve genişliği 0.6em'e iniyor — yani eksik harf tek tek
 * yakalanıyor.
 */

import { chromium } from 'playwright';

const URL = process.env.OYUN_URL ?? 'http://localhost:5173/';
const AILE = '"Press Start 2P", monospace';
const BOY = 50;

let hata = 0;
const kontrol = (ad, gecti, detay = '') => {
  console.log(`${gecti ? '✓' : '✗'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!gecti) hata += 1;
};

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
});
const page = await browser.newPage();
await page.goto(URL, { waitUntil: 'load' });

const olcum = await page.evaluate(async ({ aile, boy }) => {
  await document.fonts.load(`${boy}px "Press Start 2P"`);
  const ctx = document.createElement('canvas').getContext('2d');

  const genislik = (metin, font) => {
    ctx.font = font;
    return ctx.measureText(metin).width;
  };

  /*
   * Oyunun YAZDIĞI karakterler. Süs değil: her biri arayüzde geçiyor
   * ve biri eksikse o yazı yarı yolda yedek fonta düşüyor — Türkçe
   * harfler için bu "8 BİT" başlığının ortasında yazı tipi değişmesi
   * demek.
   */
  const harfler = [...'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ0123456789.,:·!?%★♪→←↑↓'];

  return {
    piksel: genislik('VOLEYBOL', `${boy}px ${aile}`),
    yedek: genislik('VOLEYBOL', `${boy}px monospace`),
    denenen: harfler.length,
    eksik: harfler.filter((h) => Math.abs(genislik(h, `${boy}px ${aile}`) - boy) > 1),
    yuzler: [...document.fonts].map((f) => `${f.family}:${f.status}`),
  };
}, { aile: AILE, boy: BOY });

/*
 * 8 karakter × 1em = 400 px. Yedek monospace'te 240 px çıkıyor ve
 * BOZUK HÂLDE TAM OLARAK BU OLUYORDU — yani bu tek satır, bir ay
 * gözden kaçan arızayı doğrudan yakalıyor.
 */
kontrol(
  'piksel yazı tipi gerçekten çiziliyor',
  Math.abs(olcum.piksel - BOY * 8) < 2,
  `VOLEYBOL = ${olcum.piksel.toFixed(0)}px (piksel ${BOY * 8}, yedek ${olcum.yedek.toFixed(0)})`,
);

kontrol(
  'yazı tipi kaydı sayfada duruyor',
  olcum.yuzler.some((y) => y.startsWith('Press Start 2P')),
  olcum.yuzler.join(', ') || 'hiç @font-face yok',
);

kontrol(
  'oyunun kullandığı bütün karakterler fontta VAR',
  olcum.eksik.length === 0,
  olcum.eksik.length ? `eksik: ${olcum.eksik.join(' ')}` : `${olcum.denenen} karakter denendi`,
);

/*
 * VE EKRANDA. Yukarısı tuvalde ölçüyor; burada asıl başlık elemanının
 * genişliği okunuyor. CSS tarafında yazı tipi zincirinden düşerse
 * (örneğin bir `font-family` fazladan yazılırsa) tuval ölçümü hâlâ
 * geçerdi ama ekranda yazı yine yanlış olurdu.
 */
await page.waitForTimeout(900);
const baslik = await page.evaluate(() => {
  const h = document.querySelector('h1');
  if (!h) return null;
  const s = getComputedStyle(h);
  return { aile: s.fontFamily, boy: parseFloat(s.fontSize), en: h.getBoundingClientRect().width };
});

kontrol(
  'başlık ekranda piksel yazı tipiyle çiziliyor',
  Boolean(baslik) && baslik.aile.includes('Press Start 2P')
    // "VOLEYBOL" 8 karakter; satır kutusu en az onun kadar geniş olmalı
    && baslik.en >= baslik.boy * 8 - 2,
  baslik ? `${baslik.aile.split(',')[0]} · ${baslik.en.toFixed(0)}px ≥ ${(baslik.boy * 8).toFixed(0)}px`
    : 'h1 bulunamadı',
);

await browser.close();
console.log(`\n${hata === 0 ? 'YAZI TİPİ TAMAM' : `${hata} sorun`}`);
process.exit(hata === 0 ? 0 : 1);
