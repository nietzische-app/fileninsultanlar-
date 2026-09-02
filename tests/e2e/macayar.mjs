import { chromium, devices } from 'playwright';

const CIKTI = process.env.CIKTI ?? 'tests/ciktilar';

/** Maç içi ayarlar: açılıyor mu, tuşlar görünür kalıyor mu, anında yansıyor mu? */
const URL = process.env.OYUN_URL ?? 'http://localhost:5173/';
let fails = 0;
const check = (l, ok, d = '') => { if (!ok) fails += 1; console.log(`${ok ? '✓' : '✗'} ${l}${d ? ` — ${d}` : ''}`); };

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
const ctx = await browser.newContext({
  viewport: { width: 851, height: 393 }, isMobile: true, hasTouch: true,
  deviceScaleFactor: 2, userAgent: devices['Pixel 5'].userAgent,
});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

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
await page.waitForTimeout(2400);

const state = () => page.evaluate(() => {
  const dir = document.querySelector('.tb-dir');
  const r = dir?.getBoundingClientRect();
  const layer = dir?.closest('[style*="opacity"]');
  return {
    running: window.__game?.running,
    dirW: r ? Math.round(r.width) : null,
    dirVisible: r ? r.width > 0 && r.bottom <= window.innerHeight + 2 : false,
    layerOpacity: layer ? Number(getComputedStyle(layer).opacity).toFixed(2) : null,
  };
});

// Duraklat
await page.getByRole('button', { name: /Duraklat/i }).click();
await page.waitForTimeout(600);
check('duraklatma oyunu durduruyor', (await state()).running === false);

// Ayarları aç
await page.getByRole('button', { name: /AYARLAR/ }).click();
await page.waitForTimeout(600);
check('maç içi ayar katmanı açılıyor',
  await page.getByRole('dialog', { name: 'Maç ayarları' }).count() > 0);
check('duraklatma menüsü gizlendi',
  await page.getByRole('button', { name: /MAÇTAN ÇIK/ }).count() === 0);

const opened = await state();
check('gerçek tuşlar görünür kalıyor (sönmüyor)',
  opened.dirVisible && opened.layerOpacity !== null && Number(opened.layerOpacity) > 0.5,
  `görünür=${opened.dirVisible} opaklık=${opened.layerOpacity}`);

// Kart alt köşeleri kapatmıyor mu
// Gerçek dikdörtgen kesişimi: kart ortada, tuşlar köşelerde — yalnızca
// dikey karşılaştırma yanlış negatif veriyordu
const clear = await page.evaluate(() => {
  const card = document.querySelector('[aria-label="Maç ayarları"] > div');
  if (!card) return null;
  const c = card.getBoundingClientRect();
  const hits = [...document.querySelectorAll('.touch-button')]
    .map((n) => ({ n: n.getAttribute('aria-label') || n.textContent.trim() || '?', r: n.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 0 && r.top < 60 === false)
    .filter(({ r }) => !(c.right <= r.left || c.left >= r.right || c.bottom <= r.top || c.top >= r.bottom));
  return {
    card: [Math.round(c.left), Math.round(c.top), Math.round(c.right), Math.round(c.bottom)],
    hits: hits.map((h) => h.n),
  };
});
check('ayar kartı hiçbir tuşun üstüne binmiyor', clear && clear.hits.length === 0,
  `kart=[${clear?.card}] çakışan=${clear?.hits.length ? hits.join(',') : 'yok'}`);

// Boyutu değiştir — anında yansımalı
const before = (await state()).dirW;
await page.getByLabel('BOYUT').fill('1.4');
await page.waitForTimeout(500);
const after = (await state()).dirW;
check('boyut anında gerçek tuşlara yansıyor', after > before, `${before}px → ${after}px`);

// Oyun hâlâ duraklatılmış olmalı
check('ayar yaparken maç duraklatılı kalıyor', (await state()).running === false);

await page.screenshot({ path: `${CIKTI}/mac-ayar.png` });

// ESC katmanı kapatmalı, oyunu başlatmamalı
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
const afterEsc = await state();
check('ESC katmanı kapatıyor, oyunu başlatmıyor',
  afterEsc.running === false
  && await page.getByRole('dialog', { name: 'Maç ayarları' }).count() === 0
  && await page.getByRole('button', { name: /MAÇTAN ÇIK/ }).count() > 0,
  `koşuyor=${afterEsc.running}`);

// Devam et
await page.getByRole('button', { name: /DEVAM ET/ }).click();
await page.waitForTimeout(700);
check('devam et oyunu başlatıyor', (await state()).running === true);

// Tuşlar çalışıyor mu
const cdp = await ctx.newCDPSession(page);
const b = await page.evaluate(() => {
  const n = [...document.querySelectorAll('.touch-button')].find((x) => x.getAttribute('aria-label') === 'Sağa git');
  const r = n.getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
});
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x, y: b.y, id: 1 }] });
await page.waitForTimeout(250);
const pressed = await page.evaluate(() => window.__game?.inputs?.p1?.right);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await page.waitForTimeout(200);
const released = await page.evaluate(() => window.__game?.inputs?.p1?.right);
check('devam sonrası tuş çalışıyor ve takılmıyor', pressed === true && released === false,
  `bas=${pressed} bırak=${released}`);

// Ayar kalıcı mı
const saved = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('filenin-sultanlari-prefs')).controls?.scale);
check('maç içi ayar tercihe yazıldı', saved === 1.4, `kayıtlı=${saved}`);

check('konsol hatası yok', errs.length === 0, errs.join(' | ') || 'temiz');
await browser.close();
console.log(`\n${fails === 0 ? 'MAÇ İÇİ AYARLAR TAMAM' : `${fails} sorun`}`);
process.exit(fails === 0 ? 0 : 1);
