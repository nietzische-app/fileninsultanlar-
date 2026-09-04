/**
 * Mağaza ekran görüntüleri — Play Store / App Store boyutlarında.
 *
 * Neden betik: ekran görüntüsü elle alınınca her seferinde farklı bir
 * ana, farklı bir çözünürlüğe ve farklı bir menü durumuna denk geliyor.
 * Oyun değişince de kimse görüntüleri tazelemeyi hatırlamıyor —
 * mağazada bir yıl önceki arayüz duruyor. Betik olunca `npm run
 * magaza-gorsel` yeniden üretiyor.
 *
 * Aynı sebeple sahneler SABİTLENİYOR: maç görüntüsünde skor ve top
 * konumu elle kuruluyor, "şansa güzel bir an yakalarız" diye
 * beklenmiyor. Rastgele bir kare çoğu zaman topun sahanın dışında
 * olduğu, kimsenin bir şey yapmadığı bir an oluyor.
 *
 * ÖNCE geliştirme sunucusunu başlat:
 *   npm run dev
 *   npm run magaza-gorsel
 *
 * Çıktı: tests/ciktilar/magaza/
 */

import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const CIKTI = join(KOK, 'tests', 'ciktilar', 'magaza');
const URL = process.env.OYUN_URL ?? 'http://localhost:5173/';

/**
 * Boyutlar — ÖLÇÜLEREK seçildi.
 *
 * Play Store telefon görüntüsü için oran 16:9 ile 9:16 arasında ve
 * kenar 320-3840 px olmalı. İlk denemede 1920x1080 pencere kullandım
 * ve görüntünün alt %22'si BOŞ SİYAH bant çıktı: oyun kendini
 * ~1148x638'de sınırlıyor, fazlası dolgu oluyor.
 *
 * Ölçüm (sahanın pencereyi doldurma oranı):
 *   1100x619 → %63    1200x675 → %66
 *   1152x648 → %65    1280x720 → %69
 *   1366x768 → %71  ← en iyisi
 *
 * Kalan %29 boşluk değil: skorboard, tuşlar ve ipucu şeridi. Onlar
 * oyunun parçası ve mağaza görüntüsünde görünmeleri iyi.
 *
 * `deviceScaleFactor: 2` ile çıktı 2732x1536 oluyor — 16:9, üst
 * sınırın (3840) altında ve mağaza listesinde küçültülünce piksel
 * sanatı hâlâ keskin.
 */
const BOYUTLAR = [
  ['telefon', 1366, 768, 2],
  // Tablet: farklı bir oran listelemeyi zenginleştiriyor (5:3'e yakın)
  ['tablet', 1280, 800, 2],
];

/** Oyun tercihleri — her görüntüde aynı kadro ve rakip çıksın. */
const TERCIH = {
  tutorialSeen: true,
  muted: true,
  mode: '1v1',
  difficulty: 'normal',
  format: 'single',
  opponentId: 'atlas',
  homeIds: ['gizem-orge'],
};

rmSync(CIKTI, { recursive: true, force: true });
mkdirSync(CIKTI, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? undefined,
});

/**
 * Maç sahnesini KURAR — rastgele bir kare beklemez.
 *
 * Skor çekişmeli, top havada ve oyuncular sahada dağılmış olacak
 * şekilde ayarlanıyor. Rastgele bir an çoğu zaman topun aut olduğu ya
 * da servis beklendiği sıkıcı bir kare oluyor.
 */
async function sahneKur(page) {
  await page.evaluate(() => {
    const g = window.__game;
    if (!g) return;
    /*
     * SIRA: önce sahneyi kur, SONRA durdur.
     *
     * İki denemede iki ayrı şey bozuldu ve ikisi de sıradan
     * kaynaklanıyordu:
     *   1. Sahneyi kurup `render()` çağırmak yetmiyordu — kare döngüsü
     *      hemen üstüne yazıyor, oyuncular kurduğum pozlara girmiyordu.
     *   2. Önce `stop()` çağırmak da olmadı: `stop()` durumu React'e
     *      yolluyor ve tepedeki skorbord kurulmamış hâli (0–0)
     *      gösterirken sahadaki skorbord 22–20 diyordu.
     * Doğrusu: durumu yaz → durdur (o an emit edilen doğru durum) →
     * çiz.
     */
    g.score.home = 22;
    g.score.away = 20;
    g.phase = 'rally';
    g.phaseTimer = 99;
    g.ball.x = 470;
    g.ball.y = 150;
    g.ball.vx = 180;
    g.ball.vy = 60;
    g.hype = 0.9;
    g.combo = 3;
    // Oyuncuları sahaya yay — hepsi başlangıç noktasında durmasın
    g.players.forEach((p, i) => {
      p.x = i % 2 === 0 ? 300 : 640;
      // 300 denemiştim: isim levhası üstteki pankartla çakışıyordu
      p.y = i % 2 === 0 ? 370 : 420;
      p.pose = i % 2 === 0 ? 'spike' : 'jump';
      p.onGround = i % 2 !== 0;
      p.vy = i % 2 === 0 ? -220 : -80;
    });
    /*
     * Aşama mesajı ve servis göstergesi temizleniyor: "SERVİS" yazısı
     * ralli sahnesinin üstünde duruyordu ve kare kendi kendisiyle
     * çelişiyordu.
     */
    g.message = null;
    g.serve = null;

    g.stop();
    g.render();
  });
  await page.waitForTimeout(120);
}

async function cek(page, ad, etiket) {
  const yol = join(CIKTI, `${etiket}-${ad}.png`);
  await page.screenshot({ path: yol });
  console.log(`  ${ad}`);
}

for (const [etiket, en, boy, olcek] of BOYUTLAR) {
  console.log(`\n${etiket} (${en}x${boy} × ${olcek} = ${en * olcek}x${boy * olcek})`);
  const ctx = await browser.newContext({
    viewport: { width: en, height: boy },
    deviceScaleFactor: olcek,
    hasTouch: false,
  });
  const page = await ctx.newPage();

  await page.goto(URL, { waitUntil: 'load' });
  await page.evaluate(
    (t) => localStorage.setItem('filenin-sultanlari-prefs', JSON.stringify(t)),
    TERCIH,
  );
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1500);

  // 1) Başlangıç ekranı — mağazada ilk görülecek kare
  await cek(page, '1-menu', etiket);

  // 2) Kadro seçimi — sultanları gösteriyor
  await page.getByRole('button', { name: /HIZLI MAÇ|OYNA/ }).first().click();
  await page.waitForTimeout(900);
  await cek(page, '2-kadro', etiket);

  // 3) Maç — asıl oyun
  await page.getByRole('button', { name: /MAÇA BAŞLA|BAŞLA/ }).last().click();
  await page.waitForTimeout(2500);
  await sahneKur(page);
  await cek(page, '3-mac', etiket);

  /*
   * 4) Skor tablosu. Röle adresi tanımlı değilse ÇEVRİMİÇİ menüsü hiç
   * çıkmıyor (bilerek: çalışmayan bir düğme, basılana kadar süren bir
   * yalan). O durumda bu kareyi atlıyoruz — eksik görüntü, yanlış
   * görüntüden iyi.
   */
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const cevrimici = page.getByRole('button', { name: /ÇEVRİMİÇİ/ });
  if ((await cevrimici.count()) > 0) {
    await cevrimici.first().click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /ODA KUR/ }).last().click();
    await page.waitForTimeout(800);
    await cek(page, '4-cevrimici', etiket);
  } else {
    console.log('  4-cevrimici ATLANDI — VITE_RELE_URL tanımlı değil');
  }

  await ctx.close();
}

await browser.close();
console.log(`\nÇıktı: ${CIKTI}`);
console.log('Play Store en az 2 telefon görüntüsü istiyor; burada 3-4 tane var.');
