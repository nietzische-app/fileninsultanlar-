/**
 * Eğitim: sürükleme animasyonu, Anladım → kayıt ışıltısı, Atla.
 */

import {
  tarayiciAc,
  masaustuBaglam,
  sayfaAc,
  kontrolcu,
} from './yardim.mjs';

const check = kontrolcu();
const browser = await tarayiciAc();
const ctx = await masaustuBaglam(browser);
const page = await sayfaAc(ctx);

await page.getByRole('button', { name: /NASIL OYNANIR/ }).click();
await page.waitForTimeout(700);

check(
  'tutorial açıldı',
  (await page.locator('[data-tutorial-step="0"]').count()) > 0,
);
check(
  'özelleştirme cümlesi',
  (await page.locator('[data-tutorial-caption]').innerText()).includes('özelleştirebilirsin'),
);
check(
  'sürüklenebilir A tuşu',
  (await page.locator('[data-tutorial-pad]').count()) > 0,
);
check(
  'Atla tek tık',
  (await page.getByRole('button', { name: /^ATLA$/ }).count()) > 0,
);

const pad = page.locator('[data-tutorial-pad]');
const box = await pad.boundingBox();
check('tuş görünür', Boolean(box && box.width > 20 && box.height > 20), JSON.stringify(box));

if (box) {
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 90, start.y - 70, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(400);
}

const stepAfterDrag = await page.locator('[data-tutorial-step]').getAttribute('data-tutorial-step');
if (stepAfterDrag !== '1') {
  await page.getByRole('button', { name: /ANLADIM/ }).click();
  await page.waitForTimeout(400);
}

check(
  'adım 2 kayıt ışıltısı',
  (await page.locator('[data-tutorial-step="1"]').count()) > 0
    && (await page.locator('[data-tutorial-caption]').innerText()).includes('KAYDEDİLDİ'),
);
check(
  'tuşta yeşil glow',
  await page.locator('[data-tutorial-pad]').evaluate((el) => el.classList.contains('tut-glow')),
);

await page.getByRole('button', { name: /DEVAM/ }).click();
await page.waitForTimeout(800);
check(
  'bitince açılışa döner',
  (await page.getByRole('button', { name: /AYARLAR/ }).count()) > 0,
);

await page.getByRole('button', { name: /AYARLAR/ }).click();
await page.waitForTimeout(500);
check(
  'ayarlarda eğitimi tekrar aç',
  (await page.getByRole('button', { name: /EĞİTİMİ TEKRAR AÇ/ }).count()) > 0,
);

await ctx.close();
await browser.close();
check.bitir('tutorial');
