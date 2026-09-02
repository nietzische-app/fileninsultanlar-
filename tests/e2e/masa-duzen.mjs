import { chromium } from 'playwright';

/**
 * Masaüstü maç ekranı düzeni.
 *
 * Mobil düzene odaklanırken masaüstü sessizce bozulmuştu: `.match-stage`
 * tam ekran kuralı koşulsuzdu, sahne viewport boyu (900x768) oluyor ama
 * canvas 892x496'da kalıyordu — altında dev bir boşluk, sayfa taşıyor ve
 * skor tablosu ekranın dışında kalıyordu. Bu test onu bekçiliyor.
 */
const URL = process.env.OYUN_URL ?? 'http://localhost:5173/';
let fails = 0;
const check = (l, ok, d = '') => { if (!ok) fails += 1; console.log(`${ok ? '✓' : '✗'} ${l}${d ? ` — ${d}` : ''}`); };

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
for (const [w, h] of [[1280, 600], [1366, 768], [1536, 864], [1920, 1080]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
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
  await page.waitForTimeout(2200);

  const m = await page.evaluate(() => {
    const cv = document.querySelector('canvas[aria-label]');
    const st = document.querySelector('.match-stage');
    const hud = document.querySelector('.match-hud');
    const foot = document.querySelector('.match-footer');
    const c = cv.getBoundingClientRect();
    const s = st.getBoundingClientRect();
    const hd = hud.getBoundingClientRect();
    const ft = foot.getBoundingClientRect();
    return {
      cw: Math.round(c.width), ch: Math.round(c.height), oran: c.width / c.height,
      bosDikey: Math.round(s.height - c.height), bosYatay: Math.round(s.width - c.width),
      tasma: document.documentElement.scrollHeight > window.innerHeight + 2,
      hudUst: Math.round(hd.top), hudGen: Math.round(hd.width),
      sahneGen: Math.round(s.width), footGen: Math.round(ft.width),
      hudGorunur: hd.top >= 0 && hd.bottom <= window.innerHeight,
      dokunmatikTus: [...document.querySelectorAll('.touch-button')]
        .filter((n) => n.getBoundingClientRect().width > 0).length,
    };
  });

  const et = `${w}x${h}`;
  check(`${et} · sayfa taşmıyor`, !m.tasma);
  check(`${et} · canvas oranı 9:5`, Math.abs(m.oran - 1.8) < 0.01, `oran=${m.oran.toFixed(3)}`);
  // Çerçeve sahayı sarmalı: yalnızca 4px'lik kenarlık payı kalsın
  check(`${et} · sahnede boşluk yok (çerçeve sahayı sarıyor)`,
    m.bosDikey <= 10 && m.bosYatay <= 10, `dikey=${m.bosDikey}px yatay=${m.bosYatay}px`);
  check(`${et} · skor tablosu ekranda`, m.hudGorunur, `üst=${m.hudUst}`);
  check(`${et} · skor tablosu ve düğmeler sahayla hizalı`,
    Math.abs(m.hudGen - m.sahneGen) <= 10 && Math.abs(m.footGen - m.sahneGen) <= 10,
    `hud=${m.hudGen} sahne=${m.sahneGen} alt=${m.footGen}`);
  check(`${et} · masaüstünde dokunmatik tuş yok`, m.dokunmatikTus === 0, `${m.dokunmatikTus} tuş`);
  if (errs.length) check(`${et} · konsol hatası yok`, false, errs.join(' | '));
  await ctx.close();
}
await browser.close();
console.log(`\n${fails === 0 ? 'MASAÜSTÜ DÜZEN TAMAM' : `${fails} sorun`}`);
process.exit(fails === 0 ? 0 : 1);
