/**
 * Tarayıcı testleri için ortak kurulum.
 *
 * Neden tek yerde: bu testlerin hepsi aynı üç adımı tekrar ediyordu —
 * sayfayı aç, tercihleri yaz, maça gir. Kopyalar arasında akış
 * değiştiğinde biri güncellenip diğeri unutuluyor ve test yeşil kalırken
 * gerçeği ölçmemeye başlıyordu. Bu oturumda tam olarak bu oldu: tuş
 * etiketleri ikona dönünce `textContent`'e bakan iki test "çakışma yok"
 * yazdırırken aslında çakışma vardı.
 */

import { chromium, devices } from 'playwright';

export const URL = process.env.OYUN_URL ?? 'http://localhost:5173/';

/** Varsayılan tercihler — testler maça hızlı girsin diye. */
export const VARSAYILAN_TERCIH = {
  tutorialSeen: true,
  muted: true,
  mode: '1v1',
  difficulty: 'kolay',
  format: 'practice',
  opponentId: 'atlas',
  homeIds: ['gizem-orge'],
};

export async function tarayiciAc() {
  return chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? undefined,
  });
}

/** Yatay telefon bağlamı (dokunmatik, coarse pointer). */
export function mobilBaglam(browser, { width = 851, height = 393 } = {}) {
  return browser.newContext({
    viewport: { width, height },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    userAgent: devices['Pixel 5'].userAgent,
  });
}

/** Masaüstü bağlamı (fine pointer, dokunmatik yok). */
export function masaustuBaglam(browser, { width = 1366, height = 768 } = {}) {
  return browser.newContext({ viewport: { width, height } });
}

/**
 * Sayfayı açar, tercihleri yazar ve giriş ekranına döner.
 * Tercihler `localStorage`'a YAZILDIKTAN SONRA sayfa tazelenir; uygulama
 * tercihleri yalnızca açılışta okuyor.
 */
export async function sayfaAc(ctx, tercih = {}) {
  const page = await ctx.newPage();
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(`PAGEERROR ${String(e).slice(0, 200)}`));
  page.on('console', (m) => {
    if (m.type() === 'error') hatalar.push(`CONSOLE ${m.text().slice(0, 200)}`);
  });

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  await page.evaluate(
    (t) => localStorage.setItem('filenin-sultanlari-prefs', JSON.stringify(t)),
    { ...VARSAYILAN_TERCIH, ...tercih }
  );
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1200);

  page.hatalar = hatalar;
  return page;
}

/** Giriş ekranından maça girer. */
export async function macaGir(page) {
  await page.getByRole('button', { name: /HIZLI MAÇ/ }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /MAÇA BAŞLA/ }).last().click();
  await page.waitForTimeout(2300);
}

/** Tek adımda: bağlam + tercih + maç. */
export async function maca(browser, { tercih, mobil = true, ...boyut } = {}) {
  const ctx = mobil ? await mobilBaglam(browser, boyut) : await masaustuBaglam(browser, boyut);
  const page = await sayfaAc(ctx, tercih);
  await macaGir(page);
  return { ctx, page };
}

/**
 * Tuşları ETİKETE göre bulur.
 *
 * `textContent` kullanmayın: tuşların içi ikon, metin boş dönüyor ve
 * kontrol sessizce "sorun yok" diyor.
 */
export function tusKutulari(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('.touch-button')]
      .map((n) => {
        const r = n.getBoundingClientRect();
        return {
          etiket: n.getAttribute('aria-label') ?? '?',
          x: Math.round(r.x), y: Math.round(r.y),
          w: Math.round(r.width), h: Math.round(r.height),
          sol: Math.round(r.left), sag: Math.round(r.right),
          ust: Math.round(r.top), alt: Math.round(r.bottom),
          gorunur: r.width > 0,
        };
      })
      .filter((b) => b.gorunur)
  );
}

/** Basit iddia toplayıcı. */
export function kontrolcu() {
  const durum = { hata: 0, toplam: 0 };
  const kontrol = (etiket, gecti, detay = '') => {
    durum.toplam += 1;
    if (!gecti) durum.hata += 1;
    console.log(`${gecti ? '✓' : '✗'} ${etiket}${detay ? ` — ${detay}` : ''}`);
  };
  kontrol.bitir = (baslik) => {
    console.log(`\n${durum.hata === 0 ? `${baslik} TAMAM` : `${durum.hata} sorun`}`);
    process.exitCode = durum.hata === 0 ? 0 : 1;
    return durum.hata;
  };
  kontrol.durum = durum;
  return kontrol;
}
