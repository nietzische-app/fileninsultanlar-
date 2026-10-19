/**
 * Otomatik 9:16 Reels/TikTok tanıtım videosu.
 *
 * Akış:
 *   1) Playwright ile canlı (veya yerel) oyunu headless kaydet
 *   2) FFmpeg ile 1080×1920 tuvale oturt, başlık + CTA şeridi ekle
 *   3) `output_reels.mp4` yaz
 *
 * Kullanım:
 *   npm run generate-video
 *   OYUN_URL=http://localhost:5173/ npm run generate-video
 *
 * Gerekli sistem aracı: `ffmpeg` (PATH'te olmalı).
 *
 * Neden yatay kayıt → dikey kompozisyon?
 *   Oyun saha oranını yataya kilitliyor; 1080×1920 viewport'ta sahayı
 *   kırpmak filenin iki yanını yok eder. Yatay kaydı bulanık arka plan
 *   + net şerit olarak dikeye yerleştirmek hem sahayı korur hem Reels
 *   tuvalini doldurur (magaza-gorsel.mjs ile aynı mantık).
 */

import { chromium, devices } from 'playwright';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  rmSync,
  readdirSync,
  copyFileSync,
  unlinkSync,
} from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');

const OYUN_URL = process.env.OYUN_URL ?? 'https://www.retrovoleybol.online/';
const CIKTI = resolve(process.env.VIDEO_OUT ?? join(KOK, 'output_reels.mp4'));
const SURE_SN = Math.min(20, Math.max(8, Number(process.env.VIDEO_DURATION ?? 13)));
const FPS = Number(process.env.VIDEO_FPS ?? 30);

/** Kayıt penceresi — saha dolumu için yatay (magaza-gorsel ile uyumlu). */
const KAYIT_W = 1280;
const KAYIT_H = 720;

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

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function ffmpegVarMi() {
  const r = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  return r.status === 0;
}

function ffprobeSure(yol) {
  const r = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', yol],
    { encoding: 'utf8' },
  );
  return Number.parseFloat(String(r.stdout).trim()) || 0;
}

async function dugmeyeTikla(page, desenler) {
  for (const d of desenler) {
    const btn = page.getByRole('button', { name: d }).first();
    if (await btn.count()) {
      await btn.click({ timeout: 8000 });
      return true;
    }
  }
  return false;
}

async function macaGir(page) {
  const okMac =
    (await dugmeyeTikla(page, [/HIZLI MAÇ/i, /SINGLEPLAYER/i, /TEK MAÇ/i])) ||
    false;
  if (!okMac) die('Menüde HIZLI MAÇ / SINGLEPLAYER bulunamadı');
  await page.waitForTimeout(450);

  const okBasla = await dugmeyeTikla(page, [/MAÇA BAŞLA/i, /BAŞLA/i]);
  if (!okBasla) die('MAÇA BAŞLA bulunamadı');

  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(600);

  const atla = page.getByRole('button', { name: /ATLA/i });
  if (await atla.count()) {
    await atla.first().click();
    await page.waitForTimeout(400);
  }
}

/** Ralli hissi için yön + zıpla + vur döngüsü. */
async function oynat(page, sn) {
  const bitis = Date.now() + sn * 1000;
  let yon = 'ArrowRight';
  while (Date.now() < bitis) {
    await page.keyboard.down(yon);
    await page.waitForTimeout(160);
    await page.keyboard.up(yon);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(70);
    await page.keyboard.press('Space');
    await page.waitForTimeout(280);
    await page.keyboard.press('Space');
    await page.waitForTimeout(220);
    yon = yon === 'ArrowRight' ? 'ArrowLeft' : 'ArrowRight';
  }
}

async function kaydetHam(tmpDir) {
  console.log(`→ Playwright kayıt: ${OYUN_URL}`);
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });

  const ctx = await browser.newContext({
    viewport: { width: KAYIT_W, height: KAYIT_H },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent: devices['Pixel 5'].userAgent,
    recordVideo: {
      dir: tmpDir,
      size: { width: KAYIT_W, height: KAYIT_H },
    },
  });

  const page = await ctx.newPage();
  await page.goto(OYUN_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate((t) => {
    localStorage.setItem('retro-voleybol-prefs', JSON.stringify(t));
  }, TERCIH);
  await page.reload({ waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(700);

  // Menüde kısa marka karesi, sonra maça gir
  await page.waitForTimeout(900);

  await macaGir(page);

  // "HAZIR OL" geri sayımını geç — rakamlar Reels'te sıkıcı duruyor
  await page.waitForTimeout(3000);

  // Kayıt süresinin çoğu oynanış (+ bir miktar pay: kurgu başı kırpılacak)
  const oynamaSn = Math.max(8, SURE_SN + 2);
  await oynat(page, oynamaSn);

  await page.waitForTimeout(400);
  await ctx.close();
  await browser.close();

  const webmler = readdirSync(tmpDir).filter((f) => f.endsWith('.webm'));
  if (!webmler.length) die('Playwright video dosyası üretmedi');
  const ham = join(tmpDir, 'ham.webm');
  copyFileSync(join(tmpDir, webmler[0]), ham);
  const sure = ffprobeSure(ham);
  console.log(`  ham: ${webmler[0]} (${sure.toFixed(1)}s)`);
  return ham;
}

/**
 * Yatay ham → 9:16 Reels + üst/alt yazı şeritleri.
 *
 *   [bulanık büyütülmüş saha — tuvali doldurur]
 *   [net saha şeridi ortada]
 *   üst: RETRO VOLEYBOL / SMAÇ · BLOK · RALLİ
 *   alt: Google Play · Ücretsiz
 */
function kurgu(hamYol, ciktiYol) {
  console.log('→ FFmpeg 9:16 kurgu + overlay…');

  // DejaVu Türkçe glyphe sahip; Press Start yoksa sistem fontu
  const fontAday = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    'C:/Windows/Fonts/arialbd.ttf',
  ];
  const font = fontAday.find((f) => existsSync(f));
  if (!font) die('Kalın TTF font bulunamadı (DejaVu/Liberation/Arial)');

  const fontEsc = font.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");

  const vf = [
    // Arka plan: tuvali doldur + blur
    `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,` +
      `crop=1080:1920,boxblur=18:1,eq=brightness=-0.10:saturation=0.85,setsar=1[bg]`,
    // Ön plan: genişliğe oturt (saha bozulmaz)
    `[0:v]scale=1080:-2,setsar=1,fps=${FPS}[fg]`,
    `[bg][fg]overlay=(W-w)/2:(H-h)/2[base]`,
    // Üst başlık
    `[base]drawtext=fontfile='${fontEsc}':` +
      `text='RETRO VOLEYBOL':fontsize=58:fontcolor=white:` +
      `borderw=5:bordercolor=0xE30A17:x=(w-text_w)/2:y=110[t1]`,
    `[t1]drawtext=fontfile='${fontEsc}':` +
      `text='SMAÇ  /  BLOK  /  RALLİ':fontsize=36:fontcolor=0xFFD24A:` +
      `borderw=3:bordercolor=black:x=(w-text_w)/2:y=185[t2]`,
    // Alt CTA şeridi
    `[t2]drawbox=x=0:y=ih-168:w=iw:h=168:color=0x0B0B12@0.72:t=fill[t3]`,
    `[t3]drawtext=fontfile='${fontEsc}':` +
      `text='Google Play  ·  Ücretsiz':fontsize=40:fontcolor=0xFFD24A:` +
      `borderw=3:bordercolor=black:x=(w-text_w)/2:y=h-100`,
  ].join(';');

  // Menü + maça giriş + HAZIR OL — Reels hook için atlanır
  const KIRP_BAS = Number(process.env.VIDEO_SKIP_SEC ?? 7.5);

  const args = [
    '-y',
    '-ss', String(KIRP_BAS),
    '-i', hamYol,
    '-filter_complex', vf,
    '-an',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'medium',
    '-crf', '18',
    '-r', String(FPS),
    '-movflags', '+faststart',
    '-t', String(SURE_SN),
    ciktiYol,
  ];

  const r = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(r.stderr?.slice(-2000));
    die('FFmpeg kurgu başarısız');
  }
}

async function main() {
  if (!ffmpegVarMi()) die('ffmpeg bulunamadı — kurup PATH\'e ekleyin');

  const tmpDir = join(tmpdir(), `rv-reels-${process.pid}`);
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });

  try {
    const ham = await kaydetHam(tmpDir);
    const tmpOut = join(tmpDir, 'output_reels.mp4');
    kurgu(ham, tmpOut);

    mkdirSync(dirname(CIKTI), { recursive: true });
    if (existsSync(CIKTI)) unlinkSync(CIKTI);
    copyFileSync(tmpOut, CIKTI);

    const sure = ffprobeSure(CIKTI);
    const probe = spawnSync(
      'ffprobe',
      ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'csv=p=0', CIKTI],
      { encoding: 'utf8' },
    );
    console.log(`✓ ${CIKTI}`);
    console.log(`  ${String(probe.stdout).trim()} · ${sure.toFixed(1)}s`);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
