import { chromium, devices } from 'playwright';

/** Tuş aralığı ayarı: kaydırıcı gerçekten mesafeyi açıyor mu, maça yansıyor mu? */
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

const prefs = () => page.evaluate(() =>
  JSON.parse(localStorage.getItem('filenin-sultanlari-prefs') || '{}'));

/** Sol tuşun sağ kenarı ile sağ tuşun sol kenarı arasındaki boşluk. */
const bosluk = () => page.evaluate(() => {
  const b = [...document.querySelectorAll('.touch-button')];
  const l = b.find((n) => n.getAttribute('aria-label') === 'Sola git')?.getBoundingClientRect();
  const r = b.find((n) => n.getAttribute('aria-label') === 'Sağa git')?.getBoundingClientRect();
  if (!l || !r) return null;
  return { bosluk: Math.round(r.left - l.right), tusW: Math.round(l.width) };
});

await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(700);
await page.evaluate(() => localStorage.setItem('filenin-sultanlari-prefs', JSON.stringify({
  tutorialSeen: true, muted: true, mode: '1v1', difficulty: 'kolay',
  format: 'practice', opponentId: 'atlas', homeIds: ['gizem-orge'] })));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1300);

await page.getByRole('button', { name: /AYARLAR/ }).click();
await page.waitForTimeout(600);

const varsayilan = await bosluk();
await page.getByLabel('TUŞ ARALIĞI').fill('3');
await page.waitForTimeout(400);
const genis = await bosluk();
await page.getByLabel('TUŞ ARALIĞI').fill('0.5');
await page.waitForTimeout(400);
const dar = await bosluk();

check('aralık ayarı önizlemede mesafeyi değiştiriyor',
  genis.bosluk > varsayilan.bosluk && dar.bosluk < varsayilan.bosluk,
  `%50=${dar.bosluk}px · varsayılan=${varsayilan.bosluk}px · %300=${genis.bosluk}px`);

// Boyuttan BAĞIMSIZ olmalı: aralık değişirken tuş boyu sabit kalsın
check('aralık tuş boyutunu değiştirmiyor',
  genis.tusW === varsayilan.tusW && dar.tusW === varsayilan.tusW,
  `tuş genişliği ${dar.tusW}/${varsayilan.tusW}/${genis.tusW}px`);

await page.getByLabel('TUŞ ARALIĞI').fill('2.4');
await page.waitForTimeout(400);
check('tercihe yazıldı', (await prefs()).controls?.gap === 2.4, `kayıtlı=${(await prefs()).controls?.gap}`);

// --- Maça yansıyor mu ---
await page.getByRole('button', { name: /GERİ/ }).click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: /HIZLI MAÇ/ }).first().click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /MAÇA BAŞLA/ }).last().click();
await page.waitForTimeout(2400);
const macta = await bosluk();
check('maç ekranına yansıyor', macta.bosluk > varsayilan.bosluk,
  `maçta=${macta.bosluk}px varsayılan=${varsayilan.bosluk}px`);

// Tuşlar hâlâ çalışıyor ve şeride sığıyor mu
const tasan = await page.evaluate(() => {
  const st = document.querySelector('.control-strip').getBoundingClientRect();
  return [...document.querySelectorAll('.control-strip .touch-button')]
    .filter((n) => { const r = n.getBoundingClientRect();
      return r.left < st.left - 1 || r.right > st.right + 1 || r.top < st.top - 1 || r.bottom > st.bottom + 1; })
    .map((n) => n.getAttribute('aria-label'));
});
check('geniş aralıkta tuşlar şeridin dışına taşmıyor', tasan.length === 0, tasan.join(',') || 'taşan yok');

const cdp = await ctx.newCDPSession(page);
const r = await page.evaluate(() => {
  const n = [...document.querySelectorAll('.touch-button')].find((x) => x.getAttribute('aria-label') === 'Sağa git');
  const b = n.getBoundingClientRect();
  return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
});
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y, id: 1 }] });
await page.waitForTimeout(220);
const basildi = await page.evaluate(() => window.__game?.inputs?.p1?.right);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
check('ayrılmış tuş hâlâ basılabiliyor', basildi === true, `sağ=${basildi}`);

check('konsol hatası yok', errs.length === 0, errs.join(' | ') || 'temiz');
await browser.close();
console.log(`\n${fails === 0 ? 'ARALIK AYARI TAMAM' : `${fails} sorun`}`);
process.exit(fails === 0 ? 0 : 1);
