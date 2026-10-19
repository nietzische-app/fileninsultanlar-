/**
 * Remotion Shorts için oynanış klibi üretir.
 *
 * `public/remotion/gameplay.mp4` yoksa (veya FORCE=1) Playwright ile
 * canlı/yerel oyundan kısa HD yatay kayıt alır.
 *
 * SFX (.wav) ve ikon repoda durur; bu betik yalnızca gameplay’i yeniler.
 */

import {chromium, devices} from 'playwright';
import {spawnSync} from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const CIKTI = join(KOK, 'public', 'remotion', 'gameplay.mp4');
const OYUN_URL = process.env.OYUN_URL ?? 'https://www.retrovoleybol.online/';
const FORCE = process.env.FORCE === '1' || process.argv.includes('--force');

const TERCIH = {
  tutorialSeen: true,
  kocSeen: true,
  muted: true,
  musicVolume: 0,
  sfxVolume: 0,
  mode: '1v1',
  difficulty: 'kolay',
  format: 'practice',
  opponentId: 'atlas',
  homeIds: ['gizel-orgen'],
  lang: 'tr',
};

mkdirSync(dirname(CIKTI), {recursive: true});

if (existsSync(CIKTI) && !FORCE) {
  console.log(`✓ gameplay mevcut: ${CIKTI}`);
  process.exit(0);
}

if (spawnSync('ffmpeg', ['-version'], {encoding: 'utf8'}).status !== 0) {
  console.error('✗ ffmpeg gerekli');
  process.exit(1);
}

const tmp = join(tmpdir(), `rv-gameplay-${process.pid}`);
rmSync(tmp, {recursive: true, force: true});
mkdirSync(tmp, {recursive: true});

console.log(`→ Oynanış kaydı: ${OYUN_URL}`);

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
});
const ctx = await browser.newContext({
  viewport: {width: 1280, height: 720},
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  userAgent: devices['Pixel 5'].userAgent,
  recordVideo: {dir: tmp, size: {width: 1280, height: 720}},
});
const page = await ctx.newPage();
await page.goto(OYUN_URL, {waitUntil: 'networkidle', timeout: 60000});
await page.evaluate((t) => {
  localStorage.setItem('retro-voleybol-prefs', JSON.stringify(t));
}, TERCIH);
await page.reload({waitUntil: 'networkidle', timeout: 60000});
await page.waitForTimeout(600);

async function tikla(desenler) {
  for (const d of desenler) {
    const b = page.getByRole('button', {name: d}).first();
    if (await b.count()) {
      await b.click({timeout: 8000});
      return true;
    }
  }
  return false;
}

if (!(await tikla([/HIZLI MAÇ/i, /SINGLEPLAYER/i, /TEK MAÇ/i]))) {
  console.error('✗ menü düğmesi yok');
  process.exit(1);
}
await page.waitForTimeout(400);
if (!(await tikla([/MAÇA BAŞLA/i, /BAŞLA/i]))) {
  console.error('✗ MAÇA BAŞLA yok');
  process.exit(1);
}
await page.waitForSelector('canvas', {timeout: 15000});
await page.waitForTimeout(500);
const atla = page.getByRole('button', {name: /ATLA/i});
if (await atla.count()) await atla.first().click();

await page.waitForTimeout(2800);

const bitis = Date.now() + 11000;
let yon = 'ArrowRight';
while (Date.now() < bitis) {
  await page.keyboard.down(yon);
  await page.waitForTimeout(150);
  await page.keyboard.up(yon);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(60);
  await page.keyboard.press('Space');
  await page.waitForTimeout(260);
  yon = yon === 'ArrowRight' ? 'ArrowLeft' : 'ArrowRight';
}

await ctx.close();
await browser.close();

const webm = readdirSync(tmp).find((f) => f.endsWith('.webm'));
if (!webm) {
  console.error('✗ webm yok');
  process.exit(1);
}

const ham = join(tmp, webm);
const r = spawnSync(
  'ffmpeg',
  [
    '-y',
    '-ss', '5',
    '-i', ham,
    '-t', '12',
    '-vf', 'scale=1280:720:flags=lanczos,fps=30',
    '-an',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-crf', '18',
    '-movflags', '+faststart',
    CIKTI,
  ],
  {encoding: 'utf8'},
);

rmSync(tmp, {recursive: true, force: true});

if (r.status !== 0) {
  console.error(r.stderr?.slice(-1500));
  process.exit(1);
}

console.log(`✓ ${CIKTI}`);
