import { chromium, devices } from 'playwright';

const CIKTI = process.env.CIKTI ?? 'tests/ciktilar';

const URL = process.env.OYUN_URL ?? 'http://localhost:5173/';
/** En kötü durum: en dar cihaz + en büyük tuş ayarı. */
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
let fails = 0;
const check = (l, ok, d = '') => { if (!ok) fails += 1; console.log(`${ok ? '✓' : '✗'} ${l}${d ? ` — ${d}` : ''}`); };

for (const [name, w, h] of [['iPhone SE', 667, 375], ['Galaxy S20', 800, 360]]) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h }, isMobile: true, hasTouch: true,
    deviceScaleFactor: 2, userAgent: devices['Pixel 5'].userAgent,
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  // En büyük tuş ayarıyla başla
  await page.evaluate(() => localStorage.setItem('filenin-sultanlari-prefs', JSON.stringify({
    tutorialSeen: true, muted: true, mode: '1v1', difficulty: 'kolay',
    format: 'practice', opponentId: 'atlas', homeIds: ['gizem-orge'],
    controls: { scale: 1.4, opacity: 1, swap: false } })));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1300);
  await page.getByRole('button', { name: /HIZLI MAÇ/ }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /MAÇA BAŞLA/ }).last().click();
  await page.waitForTimeout(2300);
  await page.getByRole('button', { name: /Duraklat/i }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /AYARLAR/ }).click();
  await page.waitForTimeout(600);

  const r = await page.evaluate(() => {
    const card = document.querySelector('[aria-label="Maç ayarları"] > div');
    const c = card.getBoundingClientRect();
    const hits = [...document.querySelectorAll('.touch-button')]
      .map((n) => ({ n: n.getAttribute('aria-label') || n.textContent.trim() || '?', r: n.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.top > 60)
      .filter(({ r }) => !(c.right <= r.left || c.left >= r.right || c.bottom <= r.top || c.top >= r.bottom));
    const scrolls = card.scrollHeight > card.clientHeight + 2;
    return { card: [Math.round(c.left), Math.round(c.top), Math.round(c.right), Math.round(c.bottom)],
             hits: hits.map((h) => h.n), scrolls };
  });
  check(`${name} · kart tuşlara binmiyor (ölçek %140)`, r.hits.length === 0,
    `kart=[${r.card}] çakışan=${r.hits.length ? r.hits.join(',') : 'yok'} kaydırılabilir=${r.scrolls}`);
  await page.screenshot({ path: `${CIKTI}/mac-ayar-${w}.png` });
  await ctx.close();
}
await browser.close();
console.log(`\n${fails === 0 ? 'DAR EKRAN TAMAM' : `${fails} sorun`}`);
