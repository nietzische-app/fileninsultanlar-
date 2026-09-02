import { chromium, devices } from 'playwright';

const CIKTI = process.env.CIKTI ?? 'tests/ciktilar';

const URL = process.env.OYUN_URL ?? 'http://localhost:5173/';

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
const errors = [];
const PREFS = {
  tutorialSeen: true, mode: '1v1', difficulty: 'kolay', format: 'classic',
  opponentId: 'atlas', homeIds: ['gizem-orge'], muted: true,
};

const watch = (page, tag) => {
  page.on('pageerror', (e) => errors.push(`${tag} PAGEERROR: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|404|ERR_CONNECTION/.test(m.text()))
      errors.push(`${tag} ${m.text().slice(0, 140)}`);
  });
};

const gateState = (page) =>
  page.evaluate(() => {
    const gate = document.querySelector('[aria-labelledby="rotate-gate-title"]');
    const centre = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    return {
      visible: Boolean(gate),
      // Kapı gerçekten üstte mi — ortadaki tıklama ona mı gidiyor?
      onTop: Boolean(gate && (gate === centre || gate.contains(centre))),
      running: window.__game?.running ?? null,
      text: gate?.innerText.replace(/\n+/g, ' | ').slice(0, 80) ?? null,
    };
  });

// --- 1. Dokunmatik telefon: dikey açılış ---
{
  const ctx = await browser.newContext({ ...devices['iPhone 12'], hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  watch(page, '[dikey]');
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);

  const g = await gateState(page);
  console.log('[dokunmatik dikey] menü:');
  console.log('  kapı görünür:', g.visible ? '✓' : '✗', '| en üstte:', g.onTop ? '✓' : '✗');
  console.log('  metin:', g.text);
  await page.screenshot({ path: `${CIKTI}/gate-portrait.png` });

  // Kapı açıkken menüye ulaşılabiliyor mu? (ulaşılmamalı)
  const reachable = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      /HIZLI MAÇ/.test(b.textContent)
    );
    if (!btn) return 'düğme yok';
    const r = btn.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return btn.contains(hit) ? 'ULAŞILABİLİR ✗' : 'kapı engelliyor ✓';
  });
  console.log('  menü düğmesi:', reachable);
  await ctx.close();
}

// --- 2. Yatayda oyna, sonra dikeye çevir ---
{
  const ctx = await browser.newContext({
    ...devices['iPhone 12 landscape'], hasTouch: true, isMobile: true,
  });
  const page = await ctx.newPage();
  watch(page, '[çevirme]');
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate((p) => localStorage.setItem('filenin-sultanlari-prefs', JSON.stringify(p)), PREFS);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  console.log('\n[yatay] kapı:', (await gateState(page)).visible ? 'VAR ✗' : 'yok ✓');

  await page.getByRole('button', { name: /HIZLI MAÇ/ }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /MAÇA BAŞLA/ }).last().click();
  await page.waitForTimeout(2200);
  console.log('  maç başladı, motor koşuyor:', (await gateState(page)).running ? '✓' : '✗');

  // Dikeye çevir
  await page.setViewportSize({ width: 390, height: 664 });
  await page.waitForTimeout(900);
  const rotated = await gateState(page);
  console.log('  dikeye çevrildi → kapı:', rotated.visible ? '✓' : '✗',
    '| motor durdu:', rotated.running === false ? '✓' : `✗ (${rotated.running})`);
  await page.screenshot({ path: `${CIKTI}/gate-mid-match.png` });

  // Geri yataya
  await page.setViewportSize({ width: 750, height: 340 });
  await page.waitForTimeout(900);
  const back = await gateState(page);
  const pausedOverlay = await page.evaluate(() =>
    Boolean(document.querySelector('[aria-label="Oyun duraklatıldı"]'))
  );
  console.log('  yataya dönüldü → kapı:', back.visible ? 'VAR ✗' : 'yok ✓',
    '| duraklatma katmanı bekliyor:', pausedOverlay ? '✓' : '✗',
    '| motor hâlâ durgun:', back.running === false ? '✓' : '✗');

  await page.getByRole('button', { name: /DEVAM ET/ }).first().click();
  await page.waitForTimeout(700);
  console.log('  DEVAM ET → motor:', (await gateState(page)).running ? 'koşuyor ✓' : 'durgun ✗');
  await ctx.close();
}

// --- 3. Masaüstünde dar-uzun pencere kapıyı AÇMAMALI ---
{
  const ctx = await browser.newContext({ viewport: { width: 500, height: 900 } });
  const page = await ctx.newPage();
  watch(page, '[masaüstü dar]');
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  const g = await gateState(page);
  console.log('\n[masaüstü 500x900 (dikey ama dokunmatik değil)] kapı:',
    g.visible ? 'VAR ✗' : 'yok ✓');
  await ctx.close();
}

console.log('\nhatalar:', errors.length ? errors : 'yok ✓');
await browser.close();
