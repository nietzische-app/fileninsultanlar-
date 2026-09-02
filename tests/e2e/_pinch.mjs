import { chromium, devices } from 'playwright';

/**
 * Gerçek dokunuş olaylarıyla pinch — synthesizePinchGesture hit-test'i
 * atladığı için touch-action'ı ölçemiyordu. dispatchTouchEvent normal
 * dokunuş hattından geçer, yani touch-action gerçekten devreye girer.
 */
export async function pinch(cdp, page, x, y, spread = 90, steps = 10) {
  const pt = (dx) => [
    { x: x - dx, y, id: 1 },
    { x: x + dx, y, id: 2 },
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(12) });
  for (let i = 1; i <= steps; i += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: pt(12 + (spread * i) / steps),
    });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(700);
  return page.evaluate(() => window.visualViewport?.scale);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
  console.log('--- ARAÇ DOĞRULAMA (kontrol sayfası) ---');
  for (const [label, meta, ta] of [
    ['kural yok', 'width=device-width, initial-scale=1', 'auto'],
    ['manipulation', 'width=device-width, initial-scale=1', 'manipulation'],
    ['none', 'width=device-width, initial-scale=1', 'none'],
    ['kural yok + maximum-scale=1', 'width=device-width, initial-scale=1, maximum-scale=1', 'auto'],
  ]) {
    const ctx = await browser.newContext({ ...devices['Pixel 5 landscape'], isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await page.setContent(`<!doctype html><html><head><meta name="viewport" content="${meta}">
      <style>html,body{margin:0;height:100%}#a{height:100%;background:linear-gradient(#333,#888);touch-action:${ta}}</style>
      </head><body><div id="a">içerik</div></body></html>`);
    await page.waitForTimeout(500);
    const vw = await page.evaluate(() => window.innerWidth);
    const vh = await page.evaluate(() => window.innerHeight);
    const s = await pinch(cdp, page, Math.round(vw / 2), Math.round(vh / 2));
    console.log(`  ${label.padEnd(28)} → ölçek=${typeof s === 'number' ? s.toFixed(2) : s}`);
    await ctx.close();
  }
  await browser.close();
}
