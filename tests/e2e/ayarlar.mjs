import { chromium, devices } from 'playwright';

const CIKTI = process.env.CIKTI ?? 'tests/ciktilar';

/** Ayarlar ekranı: kaydediyor mu, maça yansıyor mu, sıfırlama çalışıyor mu? */
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

const prefs = () => page.evaluate(() =>
  JSON.parse(localStorage.getItem('filenin-sultanlari-prefs') || '{}'));

await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(800);
await page.evaluate(() => localStorage.setItem('filenin-sultanlari-prefs', JSON.stringify({
  tutorialSeen: true, muted: true, mode: '1v1', difficulty: 'kolay',
  format: 'practice', opponentId: 'atlas', homeIds: ['gizem-orge'] })));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1300);

// --- Ayarlara gir ---
await page.getByRole('button', { name: /AYARLAR/ }).click();
await page.waitForTimeout(700);
check('ayarlar ekranı açılıyor', await page.getByRole('heading', { name: 'AYARLAR' }).count() > 0);

// --- Önizleme masaüstü/mobil fark etmeksizin görünür mü ---
const previewBtns = await page.evaluate(() =>
  [...document.querySelectorAll('.touch-button')]
    .filter((n) => { const b = n.getBoundingClientRect(); return b.width > 0; }).length);
// Sol, sağ, vur, zıpla = 4 (DAL kaydırma hareketine dönüştü)
check('önizlemede tuşlar görünüyor', previewBtns >= 4, `${previewBtns} tuş`);

// --- Boyut ayarı ---
const dirSize = () => page.evaluate(() => {
  const el = document.querySelector('.tb-dir');
  const r = el?.getBoundingClientRect();
  return r ? Math.round(r.width) : null;
});
const base = await dirSize();
await page.getByLabel('BOYUT').fill('1.4');
await page.waitForTimeout(500);
const big = await dirSize();
await page.getByLabel('BOYUT').fill('0.7');
await page.waitForTimeout(500);
const small = await dirSize();
check('boyut ayarı önizlemeyi değiştiriyor', big > base && small < base,
  `%70=${small}px · varsayılan=${base}px · %140=${big}px`);
check('boyut tercihe yazıldı', (await prefs()).controls?.scale === 0.7,
  `kayıtlı=${(await prefs()).controls?.scale}`);

// --- Saydamlık ---
await page.getByLabel('SAYDAMLIK').fill('0.4');
await page.waitForTimeout(400);
const op = await page.evaluate(() => {
  const el = document.querySelector('.tb-dir')?.closest('[style*="opacity"]');
  return el ? getComputedStyle(el).opacity : null;
});
check('saydamlık uygulanıyor', op !== null && Math.abs(Number(op) - 0.4) < 0.02, `opacity=${op}`);

// --- Solak düzeni ---
const sides = () => page.evaluate(() => {
  const btns = [...document.querySelectorAll('.touch-button')];
  const left = btns.find((n) => n.getAttribute('aria-label') === 'Sola git');
  const jump = btns.find((n) => n.getAttribute('aria-label') === 'Zıpla');
  return {
    dpadX: left ? Math.round(left.getBoundingClientRect().x) : null,
    jumpX: jump ? Math.round(jump.getBoundingClientRect().x) : null,
  };
});
const before = await sides();
await page.getByRole('button', { name: /SOL ELE AL|SAĞ ELE AL/ }).click();
await page.waitForTimeout(500);
const after = await sides();
check('solak düzeni tarafları değiştiriyor',
  before.dpadX < before.jumpX && after.dpadX > after.jumpX,
  `önce yön=${before.dpadX} zıpla=${before.jumpX} · sonra yön=${after.dpadX} zıpla=${after.jumpX}`);

// --- Maça yansıyor mu ---
await page.getByRole('button', { name: /GERİ/ }).click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: /HIZLI MAÇ/ }).first().click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /MAÇA BAŞLA/ }).last().click();
await page.waitForTimeout(2400);

const inMatch = await sides();
const matchSize = await dirSize();
check('ayar maç ekranına yansıyor — küçültülmüş tuş',
  matchSize !== null && matchSize < base, `maçta=${matchSize}px varsayılan=${base}px`);
check('ayar maç ekranına yansıyor — solak düzeni',
  inMatch.dpadX > inMatch.jumpX, `yön=${inMatch.dpadX} zıpla=${inMatch.jumpX}`);

// Tuşlar hâlâ çalışıyor mu
const cdp = await ctx.newCDPSession(page);
const rightBtn = await page.evaluate(() => {
  const n = [...document.querySelectorAll('.touch-button')].find((x) => x.getAttribute('aria-label') === 'Sağa git');
  const r = n.getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
});
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rightBtn.x, y: rightBtn.y, id: 1 }] });
await page.waitForTimeout(250);
const pressed = await page.evaluate(() => window.__game?.inputs?.p1?.right);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
check('küçültülmüş tuş hâlâ basılabiliyor', pressed === true, `sağ=${pressed}`);

// --- Sıfırlama ---
// Maçtan çıkış onay akışını dolaşmak yerine sayfayı tazele; tercihler
// zaten localStorage'da, yani sıfırlamayı bozmadan giriş ekranına döner
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1500);
const kept = (await prefs()).controls;
check('ayarlar yeniden yüklemede korunuyor',
  kept?.scale === 0.7 && kept?.swap === true, JSON.stringify(kept));
await page.getByRole('button', { name: /AYARLAR/ }).click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: /VARSAYILAN/ }).click();
await page.waitForTimeout(600);
const reset = (await prefs()).controls;
check('sıfırlama varsayılana döndürüyor',
  reset?.scale === 1 && reset?.swap === false && Math.abs(reset?.opacity - 0.85) < 0.01,
  JSON.stringify(reset));

check('konsol hatası yok', errs.length === 0, errs.join(' | ') || 'temiz');
await page.screenshot({ path: `${CIKTI}/ayarlar.png`, fullPage: true });
await browser.close();
console.log(`\n${fails === 0 ? 'AYARLAR TAMAM' : `${fails} sorun`}`);
process.exit(fails === 0 ? 0 : 1);
