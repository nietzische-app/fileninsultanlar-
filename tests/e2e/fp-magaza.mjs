/**
 * MAĞAZA PAKETİ — Capacitor native sahtesi.
 *
 * Aynı JS hem Vercel'e hem .aab'ye gidiyor. Forma Puanı derleme
 * bayrağı değil, `Capacitor.isNativePlatform()` ile açılıyor. Web e2e
 * (`ilerleme.mjs`) kilitsiz kadroyu doğrular; burası AAB yolunu
 * tarayıcıda taklit eder: köprü varmış gibi davranınca kilitler ve
 * cüzdan görünmeli.
 *
 * Reklam SDK'sı yüklenmez — `isPluginAvailable` false. Aksi halde
 * AdMob web sapı konsola hata basardı ve sınav onun için kırılırdı.
 */

import {
  tarayiciAc, masaustuBaglam, sayfaAc, kontrolcu,
} from './yardim.mjs';

const kontrol = kontrolcu();
const browser = await tarayiciAc();
const ctx = await masaustuBaglam(browser, { width: 1280, height: 900 });

await ctx.addInitScript(() => {
  /*
   * `@capacitor/app` web sapı yüklenince `window.Capacitor`'ı kendi
   * köprüsüyle değiştiriyor (`isNativePlatform === false`). Gerçek
   * cihazda native köprü zaten duruyor ve üzerine binilmiyor; burada
   * sahte köprüyü kilitlemek o farkı taklit eder.
   */
  const native = {};
  Object.defineProperty(native, 'isNativePlatform', {
    value: () => true,
    writable: false,
  });
  Object.defineProperty(native, 'isPluginAvailable', {
    value: () => false,
    writable: false,
  });
  Object.freeze(native);
  Object.defineProperty(window, 'Capacitor', {
    get: () => native,
    set: () => {},
    configurable: false,
    enumerable: true,
  });
});

const page = await sayfaAc(ctx);
const metin = () => page.evaluate(() => document.body.innerText);

await page.waitForTimeout(400);
kontrol('menüde FORMA PUANI cüzdanı var', (await metin()).includes('FORMA PUANI'));

await page.getByRole('button', { name: /SINGLEPLAYER/ }).first().click();
await page.getByRole('button', { name: /MAÇA BAŞLA/ }).first().waitFor({ timeout: 8000 });

const kadro = await page.evaluate(() => ({
  native: window.Capacitor?.isNativePlatform?.() === true,
  kilitli: [...document.querySelectorAll('button[aria-label]')]
    .map((b) => b.getAttribute('aria-label'))
    .filter((a) => a && (a.includes('kilitli') || a.includes('locked'))),
  fpYazi: document.body.innerText.includes('FORMA PUANI'),
}));
kontrol('Capacitor native sahte duruyor', kadro.native);
kontrol('kadroda FORMA PUANI cüzdanı var', kadro.fpYazi);
kontrol('kadroda kilitli oyuncu var', kadro.kilitli.length > 0, `${kadro.kilitli.length} kilit`);

await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(900);

const koleksiyon = page.getByRole('button', { name: /KOLEKSİYON|COLLECTION/ }).first();
kontrol('koleksiyon düğmesi duruyor', (await koleksiyon.count()) > 0);
if (await koleksiyon.count()) {
  await koleksiyon.click();
  await page.waitForTimeout(700);
  const k = await metin();
  kontrol(
    'koleksiyonda FP fiyatı var',
    k.includes(' FP') || k.includes(' KP') || k.includes('FORMA PUANI'),
  );
  kontrol(
    'koleksiyonda açık sayacı var',
    k.includes('OYUNCU AÇIK') || k.includes('PLAYERS UNLOCKED'),
  );
}

await browser.close();
kontrol.bitir('FP MAĞAZA');
process.exit(kontrol.durum.hata === 0 ? 0 : 1);
