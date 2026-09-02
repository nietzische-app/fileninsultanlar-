import { chromium, devices } from 'playwright';

/**
 * Kanat katmanı: siyah bantlar gerçekten doldu mu, tribün hizası tutuyor
 * mu, masaüstünde boşuna çalışıyor mu?
 */
const URL = process.env.OYUN_URL ?? 'http://localhost:5173/';
let fails = 0;
const check = (l, ok, d = '') => { if (!ok) fails += 1; console.log(`${ok ? '✓' : '✗'} ${l}${d ? ` — ${d}` : ''}`); };
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });

async function ac(w, h, mobil = true) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h },
    ...(mobil ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: devices['Pixel 5'].userAgent } : {}) });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
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
  await page.waitForTimeout(2400);
  return { ctx, page, errs };
}

// --- Mobil: bant kalmadı mı? ---
{
  const { ctx, page, errs } = await ac(851, 393);
  const r = await page.evaluate(() => {
    const cvs = [...document.querySelectorAll('canvas')];
    const game = cvs.find((c) => c.getAttribute('aria-label'));
    const wing = cvs.find((c) => c.getAttribute('aria-hidden') === 'true');
    if (!wing) return { yok: true };
    const g = game.getBoundingClientRect();
    const w = wing.getBoundingClientRect();
    return {
      gameL: Math.round(g.left), gameR: Math.round(g.right),
      wingL: Math.round(w.left), wingR: Math.round(w.right),
      hizaUst: Math.round(w.top - g.top), yukFark: Math.round(w.height - g.height),
      wingW: wing.width, wingH: wing.height,
    };
  });
  check('kanat katmanı var', !r.yok);
  check('kanat sahnenin tamamını kaplıyor', r.wingL <= 0 && r.wingR >= 851,
    `kanat ${r.wingL}..${r.wingR} · saha ${r.gameL}..${r.gameR}`);
  check('kanat oyun canvas\'ıyla dikey hizalı', Math.abs(r.hizaUst) <= 1 && Math.abs(r.yukFark) <= 1,
    `üst fark=${r.hizaUst}px yükseklik fark=${r.yukFark}px`);
  check('birim ölçeği eşit (yükseklik 500 birim)', r.wingH === 500, `geri tampon ${r.wingW}x${r.wingH}`);

  // Sahanın solundaki bant gerçekten boyalı mı? Piksel oku.
  const boya = await page.evaluate(() => {
    const cvs = [...document.querySelectorAll('canvas')];
    const wing = cvs.find((c) => c.getAttribute('aria-hidden') === 'true');
    const c = wing.getContext('2d');
    // Kanat bölgesinden birkaç örnek: tribün, kulübe hizası
    const pad = Math.round((wing.width - 900) / 2);
    const pts = [[Math.round(pad / 2), 150], [Math.round(pad / 2), 60], [Math.round(pad / 2), 380]];
    return pts.map(([x, y]) => {
      const d = c.getImageData(x, y, 1, 1).data;
      return { x, y, rgba: `${d[0]},${d[1]},${d[2]},${d[3]}` };
    });
  });
  const siyahDegil = boya.filter((p) => p.rgba !== '0,0,0,0' && p.rgba !== '0,0,0,255');
  check('kanat bölgesi boyalı (saydam/siyah değil)', siyahDegil.length === boya.length,
    boya.map((p) => `y${p.y}=${p.rgba}`).join(' · '));
  check('konsol hatası yok', errs.length === 0, errs.join(' | ') || 'temiz');
  await ctx.close();
}

// --- Masaüstü: gizli ve çizim yapmıyor ---
{
  const { ctx, page, errs } = await ac(1280, 800, false);
  const r = await page.evaluate(() => {
    const wing = [...document.querySelectorAll('canvas')].find((c) => c.getAttribute('aria-hidden') === 'true');
    if (!wing) return { yok: true };
    return { gorunur: wing.offsetParent !== null, w: wing.width, h: wing.height };
  });
  check('masaüstünde kanat gizli', r.yok || r.gorunur === false, JSON.stringify(r));
  check('masaüstünde konsol hatası yok', errs.length === 0, errs.join(' | ') || 'temiz');
  await ctx.close();
}

await browser.close();
console.log(`\n${fails === 0 ? 'KANAT TAMAM' : `${fails} sorun`}`);
process.exit(fails === 0 ? 0 : 1);
