import { chromium } from 'playwright';

const CIKTI = process.env.CIKTI ?? 'tests/ciktilar';

const URL = process.env.OYUN_URL ?? 'http://localhost:5173/';
/** Masaüstü regresyonu: dokunmatik tuşlar ÇIKMAMALI, düzen akışta kalmalı. */
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
let fails = 0;
const check = (l, ok, d = '') => { if (!ok) fails += 1; console.log(`${ok ? '✓' : '✗'} ${l}${d ? ` — ${d}` : ''}`); };

await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(800);
await page.evaluate(() => localStorage.setItem('filenin-sultanlari-prefs', JSON.stringify({
  tutorialSeen: true, muted: true, mode: '1v1', difficulty: 'kolay',
  format: 'practice', opponentId: 'atlas', homeIds: ['gizem-orge'] })));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1300);
await page.getByRole('button', { name: /HIZLI MAÇ/ }).first().click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /MAÇA BAŞLA/ }).last().click();
await page.waitForTimeout(2500);

const r = await page.evaluate(() => {
  const vis = [...document.querySelectorAll('.touch-button')]
    .filter((n) => { const b = n.getBoundingClientRect(); return b.width > 0 && b.height > 0; });
  const stage = document.querySelector('.match-stage')?.getBoundingClientRect();
  return {
    buttons: vis.length,
    coarse: window.matchMedia('(pointer: coarse)').matches,
    stageFixed: getComputedStyle(document.querySelector('.match-screen')).position,
    stageW: stage ? Math.round(stage.width) : null,
    vw: window.innerWidth,
    keyboardHint: Boolean([...document.querySelectorAll('p')].find((p) => /HAREKET/.test(p.textContent))),
  };
});
check('masaüstünde dokunmatik tuş yok', r.buttons === 0, `tuş=${r.buttons} coarse=${r.coarse}`);
check('düzen akışta (fixed değil)', r.stageFixed !== 'fixed', `position=${r.stageFixed}`);
check("sahne masaüstü genişliğinde (viewport kaplanmıyor)",
  r.stageW !== null && r.stageW <= 1160 && r.stageW < r.vw, `sahne=${r.stageW} viewport=${r.vw}`);
check('klavye ipucu görünür', r.keyboardHint);

// Klavye hâlâ çalışıyor mu
await page.keyboard.down('d');
await page.waitForTimeout(220);
const right = await page.evaluate(() => window.__game?.inputs?.p1?.right);
await page.keyboard.up('d');
check('klavye çalışıyor', right === true, `sağ=${right}`);
check('konsol hatası yok', errs.length === 0, errs.join(' | ') || 'temiz');
await page.screenshot({ path: `${CIKTI}/masaustu.png` });
await browser.close();
console.log(`\n${fails === 0 ? 'MASAÜSTÜ SAĞLAM' : `${fails} sorun`}`);
