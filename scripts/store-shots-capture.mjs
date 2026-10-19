/**
 * Mağaza görselleri için 5 kaynak ekran görüntüsü yakalar (yatay, HD).
 *
 * Remotion `StoreScreenshots` bu PNG'leri telefon çerçevesine koyar.
 * Oyun yatay kilitli olduğu için kaynaklar yatay alınır.
 *
 * Kullanım:
 *   npm run dev            # ayrı terminalde (ya da OYUN_URL ver)
 *   npm run store-shots:capture
 *
 * Çıktı: public/remotion/store/shot-{1..5}.png  (git'e girmez)
 *
 * Ortam: OYUN_URL, PLAYWRIGHT_CHROMIUM, FORCE=1 (varsa yeniden yakalar)
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const CIKTI = join(KOK, 'public', 'remotion', 'store');
const URL = process.env.OYUN_URL ?? 'http://localhost:5173/';

const DOSYALAR = [1, 2, 3, 4, 5].map((n) => join(CIKTI, `shot-${n}.png`));
if (!process.env.FORCE && DOSYALAR.every((d) => existsSync(d))) {
  console.log('store-shots-capture: kaynaklar mevcut, atlandı (FORCE=1 ile yenile)');
  process.exit(0);
}
mkdirSync(CIKTI, { recursive: true });

const TERCIH = {
  tutorialSeen: true,
  muted: true,
  mode: '1v1',
  difficulty: 'normal',
  format: 'single',
  opponentId: 'atlas',
  homeIds: ['gizel-orgen'],
};

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? undefined,
});

async function yeniSayfa(prefs = TERCIH) {
  const ctx = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'load' });
  await page.evaluate(
    (t) => localStorage.setItem('retro-voleybol-prefs', JSON.stringify(t)),
    prefs,
  );
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1500);
  return { ctx, page };
}

async function cek(page, n) {
  await page.screenshot({ path: join(CIKTI, `shot-${n}.png`) });
  console.log(`  shot-${n}.png`);
}

/** Maç sahnesini sabitler: durumu yaz → durdur → çiz. */
async function sahne(page, kur) {
  await page.evaluate((kurSrc) => {
    const g = window.__game;
    if (!g) return;
    // eslint-disable-next-line no-new-func
    new Function('g', kurSrc)(g);
    g.stop();
    g.render();
  }, kur);
  await page.waitForTimeout(150);
}

async function macaBasla(page) {
  await page.getByRole('button', { name: /SINGLEPLAYER/ }).first().click();
  await page.waitForTimeout(900);
  return async () => {
    await page.getByRole('button', { name: /MAÇA BAŞLA|BAŞLA/ }).last().click();
    await page.waitForTimeout(2500);
  };
}

// 1) Maç başı: skor 0-0, oyuncular yerinde, top serviste — genel saha görünümü
{
  console.log('1) maç başlangıcı');
  const { ctx, page } = await yeniSayfa();
  const basla = await macaBasla(page);
  await basla();
  await sahne(
    page,
    `g.score.home = 0; g.score.away = 0; g.phase = 'rally'; g.phaseTimer = 99;
     g.ball.x = 480; g.ball.y = 210; g.ball.vx = 40; g.ball.vy = -30;
     g.hype = 0.4; g.combo = 0;
     g.players.forEach((p, i) => {
       p.x = i % 2 === 0 ? 330 : 700; p.y = i % 2 === 0 ? 395 : 410;
       p.pose = 'idle'; p.onGround = true; p.vy = 0;
     });
     g.message = null; g.serve = null;`,
  );
  await cek(page, 1);

  // 2) Smaç anı — aynı maç, skor çekişmeli
  console.log('2) smaç');
  await sahne(
    page,
    `g.score.home = 22; g.score.away = 20; g.phase = 'rally'; g.phaseTimer = 99;
     g.ball.x = 470; g.ball.y = 150; g.ball.vx = 180; g.ball.vy = 60;
     g.hype = 0.9; g.combo = 3;
     g.players.forEach((p, i) => {
       p.x = i % 2 === 0 ? 300 : 640; p.y = i % 2 === 0 ? 370 : 420;
       p.pose = i % 2 === 0 ? 'spike' : 'jump';
       p.onGround = i % 2 !== 0; p.vy = i % 2 === 0 ? -220 : -80;
     });
     g.message = null; g.serve = null;`,
  );
  await cek(page, 2);

  // 5) Zafer / sonuç ekranı — maçı bitirmeyi dener
  console.log('5) sonuç');
  await page.evaluate(() => {
    const g = window.__game;
    if (!g) return;
    g.score.home = 25;
    g.score.away = 21;
    g.sets.home = 2;
    g.sets.away = 0;
    g.setHistory = [{ home: 25, away: 21, winner: 'home' }];
    Object.assign(g.stats, { spikes: 14, blocks: 6, saves: 9, longestRally: 17 });
    g.emitFinish('home');
  });
  await page.waitForTimeout(1800);
  await cek(page, 5);
  await ctx.close();
}

// 3) Kadro seçimi
{
  console.log('3) kadro seçimi');
  const { ctx, page } = await yeniSayfa();
  await macaBasla(page);
  await page.waitForTimeout(600);
  await cek(page, 3);
  await ctx.close();
}

// 4) Mod seçimi (ana menü)
{
  console.log('4) mod menüsü');
  const { ctx, page } = await yeniSayfa();
  await cek(page, 4);
  await ctx.close();
}

await browser.close();
console.log(`Çıktı: ${CIKTI}`);
