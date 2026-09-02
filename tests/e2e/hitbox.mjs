import { chromium, devices } from 'playwright';

/**
 * Dokunma alanı ölçümü — GERÇEK dokunuşla.
 *
 * Görsel tuşun kenarından dışarı doğru tarayıp girdinin hangi mesafeye
 * kadar algılandığına bakıyoruz. İki şey birden doğrulanmalı:
 *  1) alan görsel tuştan geniş,
 *  2) komşu tuşun alanına taşmıyor (yanlış tuş basılmıyor).
 */
const URL = process.env.OYUN_URL ?? 'http://localhost:5173/';
let fails = 0;
const check = (l, ok, d = '') => { if (!ok) fails += 1; console.log(`${ok ? '✓' : '✗'} ${l}${d ? ` — ${d}` : ''}`); };

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });

async function olc(gap) {
  const ctx = await browser.newContext({ viewport: { width: 851, height: 393 }, isMobile: true,
    hasTouch: true, deviceScaleFactor: 2, userAgent: devices['Pixel 5'].userAgent });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  await page.evaluate((g) => localStorage.setItem('filenin-sultanlari-prefs', JSON.stringify({
    tutorialSeen: true, muted: true, mode: '1v1', difficulty: 'kolay', format: 'practice',
    opponentId: 'atlas', homeIds: ['gizem-orge'], controls: { scale: 1, opacity: 1, gap: g, swap: false } })), gap);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /HIZLI MAÇ/ }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /MAÇA BAŞLA/ }).last().click();
  await page.waitForTimeout(2300);

  const cdp = await ctx.newCDPSession(page);
  const box = (label) => page.evaluate((l) => {
    const n = [...document.querySelectorAll('.touch-button')].find((x) => x.getAttribute('aria-label') === l);
    const r = n.getBoundingClientRect();
    return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top),
             b: Math.round(r.bottom), cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2),
             w: Math.round(r.width) };
  }, label);
  const inputs = () => page.evaluate(() => ({ ...window.__game?.inputs?.p1 }));

  /** (x,y) noktasına dokun, hangi girdilerin açıldığını döndür. */
  async function tap(x, y) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await page.waitForTimeout(90);
    const i = await inputs();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(60);
    return i;
  }

  const sol = await box('Sola git');
  const sag = await box('Sağa git');

  /*
   * Sol tuşun SAĞINDAN (komşuya doğru) tara.
   *
   * Not: dışa doğru taramak güvenilmez — sol tuşun sol kenarı x=8'de ve
   * tarama viewport'un dışına çıkıyor, yani ölçülen sınır ekranın kenarı
   * oluyor, hitbox'ın değil. İç kenar hem ölçülebilir hem de asıl riskin
   * olduğu taraf.
   */
  let icPay = 0;
  for (let d = 1; d <= 30 && sol.r + d < sag.l; d += 1) {
    const i = await tap(sol.r + d, sol.cy);
    if (i.left) icPay = d; else break;
  }
  // Altından dışarı tara
  let altPay = 0;
  for (let d = 1; d <= 30; d += 1) {
    const i = await tap(sol.cx, sol.b + d);
    if (i.left) altPay = d; else break;
  }
  // Köşe: dairenin dışında ama karenin içinde
  const kose = await tap(sol.l + 4, sol.t + 4);

  // Komşuya taşma: iki tuşun tam ortası kimi tetikliyor?
  const orta = await tap(Math.round((sol.r + sag.l) / 2), sol.cy);

  await ctx.close();
  return { gap, tusW: sol.w, bosluk: sag.l - sol.r, icPay, altPay,
           kose: kose.left === true, ortaSol: orta.left === true, ortaSag: orta.right === true };
}

for (const gap of [1, 0.5]) {
  const r = await olc(gap);
  console.log(`\n--- aralık %${Math.round(gap * 100)} (tuş ${r.tusW}px, boşluk ${r.bosluk}px)`);
  check('iç kenardan taşan alan var', r.icPay > 0, `${r.icPay}px komşuya doğru algılanıyor`);
  check('iç pay boşluğun yarısını geçmiyor (komşu çalınmıyor)',
    r.icPay <= Math.ceil(r.bosluk / 2), `pay=${r.icPay}px boşluk=${r.bosluk}px`);
  check('alt kenardan taşan alan var', r.altPay > 0, `${r.altPay}px aşağıdan algılanıyor`);
  check('dairenin köşesi artık ölü değil', r.kose, `sol üst köşe=${r.kose}`);
  check('iki tuşun tam ortasında çift tetikleme yok',
    !(r.ortaSol && r.ortaSag), `sol=${r.ortaSol} sağ=${r.ortaSag}`);
}

await browser.close();
console.log(`\n${fails === 0 ? 'HITBOX TAMAM' : `${fails} sorun`}`);
process.exit(fails === 0 ? 0 : 1);
