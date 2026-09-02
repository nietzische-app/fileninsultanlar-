import { chromium } from 'playwright';

const CIKTI = process.env.CIKTI ?? 'tests/ciktilar';

const URL = process.env.OYUN_URL ?? 'http://localhost:5173/';
import { pinch } from './_pinch.mjs';

/**
 * Asıl regresyon riski: yakınlaştırmayı kapatırken çoklu dokunuşla
 * tuşlara basmayı da kapatmış olabilir miyiz? (Sol + zıpla aynı anda.)
 */
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
let fails = 0;
const check = (l, ok, d = '') => { if (!ok) fails += 1; console.log(`${ok ? '✓' : '✗'} ${l}${d ? ` — ${d}` : ''}`); };

// md kırılımının altında kal ki dokunmatik kontroller görünsün
const ctx = await browser.newContext({
  viewport: { width: 720, height: 360 }, isMobile: true, hasTouch: true,
  deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
});
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(900);
await page.evaluate(() => localStorage.setItem('filenin-sultanlari-prefs', JSON.stringify({
  tutorialSeen: true, muted: true, mode: '1v1', difficulty: 'kolay',
  format: 'practice', opponentId: 'atlas', homeIds: ['gizem-orge'] })));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1400);
await page.getByRole('button', { name: /HIZLI MAÇ/ }).first().click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /MAÇA BAŞLA/ }).last().click();
await page.waitForTimeout(2500);

// İkonlu tuşlarda metin yok; erişilebilirlik etiketiyle seçiyoruz
const boxes = await page.evaluate(() => {
  const out = {};
  document.querySelectorAll('.touch-button').forEach((n) => {
    const r = n.getBoundingClientRect();
    if (r.width > 0) out[n.getAttribute('aria-label') || (n.textContent || '').trim()] =
      { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  return out;
});
console.log('görünür tuşlar:', Object.keys(boxes).join(' '));
check('dokunmatik tuşlar görünür', Object.keys(boxes).length >= 4);

const right = boxes['Sağa git'];
const jump = boxes['Zıpla'];

if (right && jump) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: right.x, y: right.y, id: 1 }] });
  await page.waitForTimeout(120);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [{ x: right.x, y: right.y, id: 1 }, { x: jump.x, y: jump.y, id: 2 }],
  });
  await page.waitForTimeout(250);
  const both = await page.evaluate(() => {
    const i = window.__game?.inputs?.p1;
    return i ? { right: i.right, up: i.up, left: i.left } : null;
  });
  check('iki tuş aynı anda çalışıyor', both?.right === true && both?.up === true,
    `sağ=${both?.right} zıpla=${both?.up}`);
  const scaleWhilePressed = await page.evaluate(() => window.visualViewport?.scale);
  check('iki tuşa basarken yakınlaşma yok', scaleWhilePressed === 1, `ölçek=${scaleWhilePressed}`);

  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => {
    const i = window.__game?.inputs?.p1;
    return i ? { right: i.right, up: i.up } : null;
  });
  check('bırakınca tuşlar takılı kalmıyor', after?.right === false && after?.up === false,
    `sağ=${after?.right} zıpla=${after?.up}`);
} else {
  check('sağ/zıpla tuşları bulundu', false, `bulunanlar: ${Object.keys(boxes).join(',')}`);
}

// Sahada pinch hâlâ engelli mi (bu viewport'ta da)
const s = await pinch(cdp, page, 360, 180, 100, 12);
check('sahada pinch yakınlaştırmıyor', s === 1, `ölçek=${s}`);

check('konsol hatası yok', errs.length === 0, errs.join(' | ') || 'temiz');
await page.screenshot({ path: `${CIKTI}/multitouch.png` });
await browser.close();
console.log(`\n${fails === 0 ? 'ÇOKLU DOKUNUŞ SAĞLAM' : `${fails} sorun`}`);
