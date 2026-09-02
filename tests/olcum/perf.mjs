import { chromium, devices } from 'playwright';

/**
 * Kare süresi ölçümü.
 *
 * Telefonun kendisi yok, o yüzden CPU kısıtlamasıyla taklit ediyoruz.
 * Mutlak fps değil, DAĞILIM ve uzun kare sayısı anlamlı: "hafif kasma"
 * ortalama düşüklüğü değil, düzenli aralıklarla gelen uzun kareleri
 * tarif ediyor.
 */
const URL = process.env.OYUN_URL ?? 'http://localhost:5173/';
const KISIT = Number(process.env.CPU ?? 6);
const SURE = Number(process.env.SURE ?? 9000);

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
const ctx = await browser.newContext({ viewport: { width: 851, height: 393 }, isMobile: true,
  hasTouch: true, deviceScaleFactor: 2, userAgent: devices['Pixel 5'].userAgent });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(600);
await page.evaluate(() => localStorage.setItem('filenin-sultanlari-prefs', JSON.stringify({
  tutorialSeen: true, muted: true, mode: '1v1', difficulty: 'kolay',
  format: 'practice', opponentId: 'atlas', homeIds: ['gizem-orge'] })));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1200);
await page.getByRole('button', { name: /HIZLI MAÇ/ }).first().click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: /MAÇA BAŞLA/ }).last().click();
await page.waitForTimeout(2000);

await cdp.send('Emulation.setCPUThrottlingRate', { rate: KISIT });
await page.waitForTimeout(800);

const r = await page.evaluate((ms) => new Promise((resolve) => {
  const d = [];
  let prev = performance.now();
  const t0 = prev;
  function tick(now) {
    d.push(now - prev);
    prev = now;
    if (now - t0 < ms) requestAnimationFrame(tick);
    else resolve(d);
  }
  requestAnimationFrame(tick);
}), SURE);

await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
await browser.close();

const s = r.slice(5).sort((a, b) => a - b);
const q = (p) => s[Math.floor(s.length * p)].toFixed(1);
const uzun = (t) => r.filter((x) => x > t).length;
console.log(`CPU kısıtı ${KISIT}x · ${r.length} kare · ${(SURE / 1000).toFixed(0)}sn`);
console.log(`  ortanca ${q(0.5)}ms · p90 ${q(0.9)}ms · p95 ${q(0.95)}ms · p99 ${q(0.99)}ms · en uzun ${s[s.length - 1].toFixed(1)}ms`);
console.log(`  >33ms (takılma): ${uzun(33)} kare (%${(uzun(33) / r.length * 100).toFixed(1)})`);
console.log(`  >50ms (belirgin): ${uzun(50)} kare (%${(uzun(50) / r.length * 100).toFixed(1)})`);
