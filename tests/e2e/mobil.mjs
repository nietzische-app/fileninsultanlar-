import { chromium, devices } from 'playwright';

const URL = process.env.OYUN_URL ?? 'http://localhost:5173/';

/**
 * Gerçek cihaz profillerinde: mobil düzen devrede mi, tuşlar görünüyor
 * mu, saha ortalanmış mı?
 */
const PROFILES = [
  ['iPhone SE yatay',      667, 375],
  ['iPhone 12 yatay',      844, 390],
  ['iPhone 14 Pro Max',    932, 430],
  ['Pixel 5 yatay',        851, 393],
  ['Galaxy S20 yatay',     800, 360],
  ['Pixel 7 yatay',        915, 412],
];

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
console.log('cihaz                 gen  tuş  sahne-tam-ekran  saha-ortalı  boşluk(sol/sağ)');
console.log('─'.repeat(84));

for (const [name, w, h] of PROFILES) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    userAgent: devices['Pixel 5'].userAgent,
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  await page.evaluate(() => localStorage.setItem('filenin-sultanlari-prefs', JSON.stringify({
    tutorialSeen: true, muted: true, mode: '1v1', difficulty: 'kolay',
    format: 'practice', opponentId: 'atlas', homeIds: ['gizem-orge'] })));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /HIZLI MAÇ/ }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /MAÇA BAŞLA/ }).last().click();
  await page.waitForTimeout(2200);

  const r = await page.evaluate(() => {
    const vis = [...document.querySelectorAll('.touch-button')]
      .filter((n) => { const b = n.getBoundingClientRect(); return b.width > 0 && b.height > 0; });
    const stage = document.querySelector('.match-stage');
    const cv = document.querySelector('canvas[aria-label]');
    const sb = stage?.getBoundingClientRect();
    const cb = cv?.getBoundingClientRect();
    return {
      buttons: vis.length,
      stageFull: sb ? (Math.abs(sb.width - window.innerWidth) < 2 && Math.abs(sb.height - window.innerHeight) < 2) : false,
      left: cb ? Math.round(cb.left) : null,
      right: cb ? Math.round(window.innerWidth - cb.right) : null,
      top: cb ? Math.round(cb.top) : null,
      cw: cb ? Math.round(cb.width) : null,
      ch: cb ? Math.round(cb.height) : null,
      vw: window.innerWidth, vh: window.innerHeight,
    };
  });
  const centered = r.left !== null && Math.abs(r.left - r.right) <= 2;
  console.log(
    `${name.padEnd(21)} ${String(r.vw).padStart(4)} ${String(r.buttons).padStart(4)}  ` +
    `${(r.stageFull ? 'EVET' : 'hayır').padEnd(16)} ${(centered ? 'evet' : 'HAYIR').padEnd(12)} ` +
    `${r.left}/${r.right}  canvas ${r.cw}x${r.ch}`
  );
  await ctx.close();
}
await browser.close();
