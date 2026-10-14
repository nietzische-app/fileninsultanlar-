/**
 * İlk maç koçu: overlay çıkar, atla maça geçer, tercih kaydolur.
 *
 * E2E'nin geri kalanı `kocSeen: true` yazar ki koç onları bekletmesin.
 * Bu dosya tam tersini ölçer — yoksa overlay hiç bağlanmasa da yeşil
 * kalırdı.
 */

import {
  tarayiciAc,
  masaustuBaglam,
  sayfaAc,
  macaGir,
  kontrolcu,
} from './yardim.mjs';

const check = kontrolcu();
const browser = await tarayiciAc();
const ctx = await masaustuBaglam(browser);
const page = await sayfaAc(ctx, { kocSeen: false, tutorialSeen: true });

await macaGir(page);

check(
  'koç overlay',
  (await page.locator('[data-koc]').count()) > 0,
);
check(
  'hareket cümlesi',
  (await page.locator('[data-koc]').innerText()).includes('hareket'),
);

await page.getByRole('button', { name: /ATLA, MAÇA GEÇ/ }).click();
await page.waitForTimeout(500);

check(
  'atlayınca overlay kapandı',
  (await page.locator('[data-koc]').count()) === 0,
);
check(
  'saha duruyor',
  (await page.locator('canvas').count()) > 0,
);

const kayit = await page.evaluate(
  () => JSON.parse(localStorage.getItem('retro-voleybol-prefs') ?? '{}').kocSeen,
);
check('kocSeen kaydı', kayit === true);

await ctx.close();
await browser.close();
check.bitir('ilk maç koçu');
