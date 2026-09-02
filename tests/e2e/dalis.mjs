import { chromium, devices } from 'playwright';

/** Yön tuşundan aşağı kaydırma gerçekten dalış tetikliyor mu? */
const URL = process.env.OYUN_URL ?? 'http://localhost:5173/';
let fails = 0;
const check = (l, ok, d = '') => { if (!ok) fails += 1; console.log(`${ok ? '✓' : '✗'} ${l}${d ? ` — ${d}` : ''}`); };

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
const ctx = await browser.newContext({ viewport: { width: 851, height: 393 }, isMobile: true,
  hasTouch: true, deviceScaleFactor: 2, userAgent: devices['Pixel 5'].userAgent });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(700);
await page.evaluate(() => localStorage.setItem('filenin-sultanlari-prefs', JSON.stringify({
  tutorialSeen: true, muted: true, mode: '1v1', difficulty: 'kolay',
  format: 'practice', opponentId: 'atlas', homeIds: ['gizem-orge'] })));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1300);
await page.getByRole('button', { name: /HIZLI MAÇ/ }).first().click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: /MAÇA BAŞLA/ }).last().click();
await page.waitForTimeout(2400);

const btns = await page.evaluate(() =>
  [...document.querySelectorAll('.touch-button')].map((n) => n.getAttribute('aria-label')));
check('DAL tuşu kaldırıldı', !btns.some((b) => b === 'Dalış'), btns.join(' · '));

const cdp = await ctx.newCDPSession(page);
const at = async (label) => page.evaluate((l) => {
  const n = [...document.querySelectorAll('.touch-button')]
    .find((x) => (x.getAttribute('aria-label') || '').startsWith(l));
  const r = n.getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
}, label);

const inputs = () => page.evaluate(() => ({ ...window.__game?.inputs?.p1 }));
const pose = () => page.evaluate(() => window.__game?.players?.find((p) => p.controlled)?.pose);
const phase = () => page.evaluate(() => window.__game?.phase);

/*
 * Servisi tamamla: PHASE.SERVE sırasında motor oyuncu girdisini hiç
 * uygulamıyor (`updatePlayers(dt, active)` yalnızca rallide aktif), o
 * yüzden dalış orada test edilemez.
 */
const vur = await at('Vur');
for (let i = 0; i < 2 && (await phase()) === 'serve'; i += 1) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: vur.x, y: vur.y, id: 9 }] });
  await page.waitForTimeout(90);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(260);
}
check('ralli başladı (dalış ancak orada olur)', (await phase()) === 'rally', `aşama=${await phase()}`);

// --- Sadece basmak dalış tetiklememeli ---
const r = await at('Sağa git');
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y, id: 1 }] });
await page.waitForTimeout(160);
const basili = await inputs();
check('düz basışta dalış YOK, yön var', basili.right === true && basili.dive === false,
  `sağ=${basili.right} dal=${basili.dive}`);

// --- Aşağı kaydır ---
for (const dy of [10, 20, 32, 44]) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: r.x + dy * 0.4, y: r.y + dy, id: 1 }] });
  await page.waitForTimeout(70);
}
const kaydirma = await inputs();
const p = await pose();
check('aşağı kaydırınca dalış tetikleniyor', kaydirma.dive === true, `dal=${kaydirma.dive} yön(sağ)=${kaydirma.right}`);
check('karakter dalış pozuna geçti', p === 'dive', `poz=${p}`);

await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await page.waitForTimeout(200);
const birak = await inputs();
check('bırakınca dalış ve yön temizleniyor', birak.dive === false && birak.right === false,
  `dal=${birak.dive} sağ=${birak.right}`);

// --- Parmak geri yukarı çekilirse dalıştan vazgeçilir ---
const l = await at('Sola git');
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: l.x, y: l.y, id: 2 }] });
await page.waitForTimeout(100);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: l.x, y: l.y + 40, id: 2 }] });
await page.waitForTimeout(120);
const asagi = await inputs();
await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: l.x, y: l.y + 4, id: 2 }] });
await page.waitForTimeout(120);
const geri = await inputs();
check('parmak yukarı dönünce dalıştan vazgeçiliyor',
  asagi.dive === true && geri.dive === false, `aşağı=${asagi.dive} geri=${geri.dive}`);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

check('konsol hatası yok', errs.length === 0, errs.join(' | ') || 'temiz');
await browser.close();
console.log(`\n${fails === 0 ? 'DALIŞ HAREKETİ TAMAM' : `${fails} sorun`}`);
process.exit(fails === 0 ? 0 : 1);
