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
  window.Capacitor = {
    isNativePlatform: () => true,
    isPluginAvailable: () => false,
  };
});

const page = await sayfaAc(ctx);
const metin = () => page.evaluate(() => document.body.innerText);

kontrol('menüde FORMA PUANI cüzdanı var', (await metin()).includes('FORMA PUANI'));

await page.getByRole('button', { name: /SINGLEPLAYER/ }).first().click();
await page.waitForTimeout(700);

const kilitli = await page.evaluate(() =>
  [...document.querySelectorAll('button[aria-label]')]
    .map((b) => b.getAttribute('aria-label'))
    .filter((a) => a && a.includes('kilitli')));
kontrol('kadroda kilitli oyuncu var', kilitli.length > 0, `${kilitli.length} kilit`);

await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(900);

const koleksiyon = page.getByRole('button', { name: /KOLEKSİYON/ }).first();
kontrol('koleksiyon düğmesi duruyor', (await koleksiyon.count()) > 0);
if (await koleksiyon.count()) {
  await koleksiyon.click();
  await page.waitForTimeout(700);
  const k = await metin();
  kontrol('koleksiyonda FP fiyatı var', k.includes(' FP'));
  kontrol('koleksiyonda OYUNCU AÇIK sayacı var', k.includes('OYUNCU AÇIK'));
}

await browser.close();
kontrol.bitir('FP MAĞAZA');
process.exit(kontrol.durum.hata === 0 ? 0 : 1);
