/**
 * Dil: TR ↔ EN geçişi, kalıcılık, tarayıcı tahmini.
 *
 * Playwright Chromium en-US. Tercih yazılmazsa UI İngilizce açılır;
 * mevcut e2e'ler `lang: 'tr'` eker. Bu dosya o kararı bekçiliyor.
 *
 * ONLINE röle yokken menüde durmaz; SINGLEPLAYER her ortamda vardır.
 * Dil tuşu `EN` alt dize eşleşmesine takılır ("sEn seç", "geçEn") —
 * exact + grup etiketi kullanılıyor.
 */

import {
  tarayiciAc,
  masaustuBaglam,
  sayfaAc,
  kontrolcu,
  URL,
} from './yardim.mjs';

const check = kontrolcu();
const browser = await tarayiciAc();

function dilTusu(page, kod) {
  return page.getByRole('group', { name: /Dil|Language/ }).getByRole('button', {
    name: kod,
    exact: true,
  });
}

{
  const ctx = await masaustuBaglam(browser);
  const page = await sayfaAc(ctx);

  check(
    'kayıtlı TR · AYARLAR',
    (await page.getByRole('button', { name: /AYARLAR/ }).count()) > 0,
  );
  check(
    'SINGLEPLAYER her iki dilde aynı',
    (await page.locator('[data-mode="match"]').count()) > 0
      && (await page.locator('[data-mode="match"]').innerText()).includes('SINGLEPLAYER'),
  );

  await dilTusu(page, 'EN').first().click();
  await page.waitForTimeout(500);

  check(
    'EN · SETTINGS',
    (await page.getByRole('button', { name: /SETTINGS/ }).count()) > 0,
  );
  check(
    'EN · AYARLAR yok',
    (await page.getByRole('button', { name: /AYARLAR/ }).count()) === 0,
  );
  check(
    'EN · SINGLEPLAYER duruyor',
    (await page.locator('[data-mode="match"]').innerText()).includes('SINGLEPLAYER'),
  );
  check(
    'EN · HOW TO PLAY',
    (await page.getByRole('button', { name: /HOW TO PLAY/ }).count()) > 0,
  );

  const kayit = await page.evaluate(
    () => JSON.parse(localStorage.getItem('retro-voleybol-prefs') || '{}').lang,
  );
  check('tercih en yazıldı', kayit === 'en', `lang=${kayit}`);

  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1000);
  check(
    'yenilemede EN kalır',
    (await page.getByRole('button', { name: /SETTINGS/ }).count()) > 0,
  );

  await dilTusu(page, 'TR').first().click();
  await page.waitForTimeout(500);
  check(
    'TR geri · AYARLAR',
    (await page.getByRole('button', { name: /AYARLAR/ }).count()) > 0,
  );

  await page.getByRole('button', { name: /AYARLAR/ }).click();
  await page.waitForTimeout(600);
  check(
    'ayarlarda dil bölümü',
    (await page.getByRole('heading', { name: /DİL/ }).count()) > 0,
  );

  await ctx.close();
}

{
  const ctx = await browser.newContext({
    locale: 'en-US',
    viewport: { width: 1366, height: 768 },
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  check(
    'en tarayıcı · SETTINGS',
    (await page.getByRole('button', { name: /SETTINGS/ }).count()) > 0,
  );
  const lang = await page.evaluate(
    () => JSON.parse(localStorage.getItem('retro-voleybol-prefs') || '{}').lang,
  );
  check('en tarayıcı lang=en', lang === 'en', `lang=${lang}`);
  await ctx.close();
}

{
  const ctx = await browser.newContext({
    locale: 'tr-TR',
    viewport: { width: 1366, height: 768 },
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  check(
    'tr tarayıcı · AYARLAR',
    (await page.getByRole('button', { name: /AYARLAR/ }).count()) > 0,
  );
  await ctx.close();
}

await browser.close();
check.bitir('dil');
