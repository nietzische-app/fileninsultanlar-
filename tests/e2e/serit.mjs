import { chromium, devices } from 'playwright';

/**
 * Kontrol şeridi: karakterlerin durduğu zemin çizgisi şeridin ÜSTÜNDE
 * kalıyor mu? Kalmazsa şerit oyuncuların ayaklarını kesiyor demektir —
 * yani sorunu çözmek yerine yer değiştirmiş oluruz.
 */
const URL = process.env.OYUN_URL ?? 'http://localhost:5173/';
let fails = 0;
const check = (l, ok, d = '') => { if (!ok) fails += 1; console.log(`${ok ? '✓' : '✗'} ${l}${d ? ` — ${d}` : ''}`); };

const GAME_H = 500, GROUND_Y = 420;   // src/game/constants.js

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
for (const [name, w, h] of [['iPhone SE', 667, 375], ['Pixel 5', 851, 393],
                            ['Galaxy S20', 800, 360], ['iPhone 14 PM', 932, 430]]) {
  for (const scale of [0.7, 1, 1.4]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true,
      hasTouch: true, deviceScaleFactor: 2, userAgent: devices['Pixel 5'].userAgent });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    await page.evaluate((sc) => localStorage.setItem('filenin-sultanlari-prefs', JSON.stringify({
      tutorialSeen: true, muted: true, mode: '1v1', difficulty: 'kolay', format: 'practice',
      opponentId: 'atlas', homeIds: ['gizem-orge'], controls: { scale: sc, opacity: 1, swap: false } })), scale);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: /HIZLI MAÇ/ }).first().click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /MAÇA BAŞLA/ }).last().click();
    await page.waitForTimeout(2200);

    const r = await page.evaluate(({ gameH, groundY }) => {
      const cv = document.querySelector('canvas[aria-label]').getBoundingClientRect();
      const st = document.querySelector('.control-strip')?.getBoundingClientRect();
      // Zemin çizgisinin EKRANDAKİ y'si
      const groundScreenY = cv.top + cv.height * (groundY / gameH);
      const btns = [...document.querySelectorAll('.control-strip .touch-button')]
        .map((n) => ({ l: n.getAttribute('aria-label'), r: n.getBoundingClientRect() }));
      const tasan = btns.filter((b) => b.r.top < st.top - 1 || b.r.bottom > st.bottom + 1).map((b) => b.l);
      // Canlı alanı (zemin çizgisinin üstünü) örten tuş var mı
      const orten = btns.filter((b) => b.r.top < groundScreenY).map((b) => b.l);
      return {
        canvas: `${Math.round(cv.width)}x${Math.round(cv.height)}`,
        stripTop: Math.round(st.top), stripH: Math.round(st.height),
        ground: Math.round(groundScreenY),
        pay: Math.round(st.top - groundScreenY),
        tasan, orten,
      };
    }, { gameH: GAME_H, groundY: GROUND_Y });

    check(`${name} %${Math.round(scale * 100)} · zemin çizgisi şeridin üstünde`,
      r.pay >= 0 && r.orten.length === 0,
      `saha=${r.canvas} zemin=${r.ground} şeritÜst=${r.stripTop} pay=${r.pay}px örten=${r.orten.join(',') || 'yok'}`);
    if (r.tasan.length) check(`${name} %${Math.round(scale * 100)} · tuşlar şeride sığıyor`, false, `taşan=${r.tasan.join(',')}`);
    await ctx.close();
  }
}
await browser.close();
console.log(`\n${fails === 0 ? 'ŞERİT TAMAM' : `${fails} sorun`}`);
process.exit(fails === 0 ? 0 : 1);
