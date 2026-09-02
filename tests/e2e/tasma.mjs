import { chromium, devices } from 'playwright';

const URL = process.env.OYUN_URL ?? 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
for (const [name, w, h, scale] of [['SE', 667, 375, 1], ['SE %70', 667, 375, 0.7], ['Pixel5 %140', 851, 393, 1.4]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true,
    deviceScaleFactor: 2, userAgent: devices['Pixel 5'].userAgent });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await page.evaluate((sc) => localStorage.setItem('filenin-sultanlari-prefs', JSON.stringify({
    tutorialSeen: true, muted: true, mode: '1v1', difficulty: 'kolay', format: 'practice',
    opponentId: 'atlas', homeIds: ['gizem-orge'], controls: { scale: sc, opacity: 1, swap: false } })), scale);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /HIZLI MAÇ/ }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /MAÇA BAŞLA/ }).last().click();
  await page.waitForTimeout(2200);
  const r = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.touch-button').forEach((n) => {
      const lab = n.getAttribute('aria-label') || n.textContent.trim();
      const inner = n.firstElementChild;
      if (!inner) return;
      const cb = n.getBoundingClientRect(), ib = inner.getBoundingClientRect();
      const overflowY = Math.round(Math.max(0, ib.height - (cb.height - 6)));
      const overflowX = Math.round(Math.max(0, ib.width - (cb.width - 6)));
      if (overflowY > 0 || overflowX > 0)
        out.push(`${lab}: taşma Y=${overflowY} X=${overflowX} (tuş ${Math.round(cb.width)}x${Math.round(cb.height)})`);
    });
    return out;
  });
  console.log(`${name}: ${r.length ? r.join(' | ') : 'taşma yok'}`);
  await ctx.close();
}
await browser.close();
