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
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
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
  homeIds: ['gizel-orgen'],
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

/**
 * ÖNE ÇIKAN GÖRSEL — Play Store'un zorunlu 1024×500 afişi.
 *
 * Ekran görüntüsü DEĞİL, kompozisyon: mağaza listesinin tepesinde tam
 * genişlikte duruyor ve oyunun içinden alınmış bir kare orada hem
 * kalabalık hem de okunmaz kalıyor (skorbord, tuşlar, ipucu şeridi
 * 500 px yüksekliğe sığmıyor).
 *
 * Bu yüzden ayrı çiziliyor — ama PROJE KURALIYLA: tek bir PNG/JPG
 * kaynağı yok, figürler oyunun kendi `drawSultan`/`drawBall`
 * fonksiyonlarından geliyor. Bir tasarım programında çizilseydi afiş
 * ile oyunun görünümü zamanla ayrışır ve kimse fark etmezdi.
 *
 * KENAR PAYI: Play bu görseli bazı yerleşimlerde yanlardan kırpıyor.
 * Yazı ve figürler 84 px kenar payının içinde kalıyor; dışarıda yalnız
 * zemin var, yani kırpılan yer bir şey götürmüyor.
 *
 * SEYİRCİ RASTGELE DEĞİL: tribün noktaları sabit tohumlu bir üreteçle
 * konuluyor. `Math.random` ile her koşum farklı bir dosya üretirdi ve
 * görsel değişmediği hâlde git'te sürekli fark görünürdü.
 */
async function oneCikanCiz(page) {
  return page.evaluate(async () => {
    const { drawSultan, drawBall, drawTurkishFlag } = await import('/src/game/sprites.js');
    const { getPlayerById } = await import('/src/game/players.js');
    const { PALETTE } = await import('/src/game/constants.js');

    const EN = 1024;
    const BOY = 500;

    // Yazı tipi gömülü ama yükleme eşzamansız: beklemezsek ilk çizim
    // Times New Roman'a düşer ve afiş sessizce yanlış çıkar.
    await document.fonts.load('48px "Press Start 2P"');
    await document.fonts.load('11px "Press Start 2P"');

    const tuval = document.createElement('canvas');
    tuval.width = EN;
    tuval.height = BOY;
    const ctx = tuval.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    /** Sabit tohumlu üreteç — aynı girdi, aynı afiş. */
    let tohum = 0x5ad1;
    const rast = () => {
      tohum = (tohum * 1664525 + 1013904223) >>> 0;
      return tohum / 0x100000000;
    };

    // --- Salon zemini ---------------------------------------------
    const gokyuzu = ctx.createLinearGradient(0, 0, 0, BOY);
    gokyuzu.addColorStop(0, PALETTE.roof);
    gokyuzu.addColorStop(0.55, PALETTE.hallWall);
    gokyuzu.addColorStop(1, PALETTE.hallWallDark);
    ctx.fillStyle = gokyuzu;
    ctx.fillRect(0, 0, EN, BOY);

    // Spot ışığı — figürlerin üstüne düşüyor
    const isik = ctx.createRadialGradient(760, 40, 20, 760, 40, 520);
    isik.addColorStop(0, 'rgba(255, 244, 205, 0.20)');
    isik.addColorStop(1, 'rgba(255, 244, 205, 0)');
    ctx.fillStyle = isik;
    ctx.fillRect(0, 0, EN, BOY);

    // --- Tribün ----------------------------------------------------
    for (let sira = 0; sira < 7; sira += 1) {
      const y = 46 + sira * 26;
      ctx.fillStyle = sira % 2 === 0 ? PALETTE.tierBack : PALETTE.tierStep;
      ctx.fillRect(0, y, EN, 24);

      for (let x = 8; x < EN; x += 17) {
        if (rast() < 0.42) continue;
        const ton = rast();
        ctx.fillStyle = ton > 0.86
          ? PALETTE.turkishRed
          : `rgba(255,255,255,${(0.10 + ton * 0.18).toFixed(2)})`;
        ctx.fillRect(x + Math.round(rast() * 5), y + 7, 6, 10);
      }
    }

    // Tribünde birkaç bayrak — oyunun içindeki salonla aynı öğe
    [[132, 62], [438, 114], [872, 88]].forEach(([x, y], i) => {
      drawTurkishFlag(ctx, x, y, 3, i * 1.7);
    });

    // Işıklı şerit
    ctx.fillStyle = PALETTE.ribbonDark;
    ctx.fillRect(0, 228, EN, 16);
    for (let x = 6; x < EN; x += 26) {
      ctx.fillStyle = rast() > 0.35 ? PALETTE.ribbonOn : 'rgba(255,210,74,0.25)';
      ctx.fillRect(x, 233, 10, 6);
    }

    // --- Saha ------------------------------------------------------
    ctx.fillStyle = PALETTE.courtOut;
    ctx.fillRect(0, 244, EN, BOY - 244);
    ctx.fillStyle = PALETTE.courtIn;
    ctx.fillRect(0, 300, EN, BOY - 300);

    // Çizgiler: aşağı indikçe kalınlaşıyor — derinlik hissi
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(0, 300, EN, 3);
    ctx.fillRect(0, 372, EN, 4);
    ctx.fillRect(0, 470, EN, 6);

    ctx.fillStyle = PALETTE.floorSheen;
    ctx.fillRect(0, 302, EN, 60);

    /*
     * FİLE. Direk zemine BASIYOR (y=470, en öndeki saha çizgisi).
     * İlk denemede direk 176'da başlayıp 476'da bitiyordu ama ağ
     * tribünün içinde asılı duruyordu: file havada yüzen bir dikdörtgen
     * gibi görünüyordu, sahanın parçası gibi değil.
     */
    const fileX = 700;
    const fileUst = 214;
    const fileAlt = 330;
    ctx.fillStyle = PALETTE.netPost;
    ctx.fillRect(fileX - 5, fileUst, 10, 470 - fileUst);
    ctx.fillStyle = 'rgba(242,242,242,0.30)';
    for (let y = fileUst + 10; y < fileAlt; y += 9) ctx.fillRect(fileX - 165, y, 330, 2);
    for (let x = fileX - 165; x <= fileX + 165; x += 12) {
      ctx.fillRect(x, fileUst + 10, 2, fileAlt - fileUst - 10);
    }
    ctx.fillStyle = PALETTE.net;
    ctx.fillRect(fileX - 165, fileUst + 2, 330, 7);

    // --- Sultanlar (arkadan öne) ------------------------------------
    const kadro = [
      ['cansel-ozbey', 596, 372, 6, 'run', 1, 0.25],
      ['gizel-orgen', 812, 442, 9, 'spike', -1, 0],
      ['elifnur-sahan', 918, 470, 8, 'jump', -1, 0],
    ];
    kadro.forEach(([id, x, y, olcek, poz, yon, kare]) => {
      const veri = getPlayerById(id);
      if (!veri) return;
      // Gölge: figürü zemine bastırıyor
      ctx.fillStyle = PALETTE.shadow;
      ctx.beginPath();
      ctx.ellipse(x, y + 2, olcek * 5, olcek * 1.4, 0, 0, Math.PI * 2);
      ctx.fill();
      drawSultan(ctx, veri, {
        x, y, scale: olcek, pose: poz, facing: yon, frame: kare, showNumber: true,
      });
    });

    /*
     * TOP. Smaç yiyip filenin üstünden geçiyor: iz, vuranın elinden
     * topa doğru. İz olmadan top havada duran bir nesne gibiydi ve
     * afişte hareket hissi kalmıyordu.
     */
    const izBas = [860, 250];
    const topX = 640;
    const topY = 168;
    for (let i = 1; i <= 5; i += 1) {
      const t = i / 6;
      ctx.fillStyle = `rgba(255,255,255,${(0.05 + t * 0.16).toFixed(2)})`;
      const ix = izBas[0] + (topX - izBas[0]) * t;
      const iy = izBas[1] + (topY - izBas[1]) * t;
      const boyut = 6 + t * 10;
      ctx.fillRect(Math.round(ix - boyut / 2), Math.round(iy - boyut / 2), boyut, boyut);
    }
    drawBall(ctx, {
      x: topX, y: topY, radius: 34, rotation: 0.42,
    });

    // --- Yazı tarafını karart ---------------------------------------
    const perde = ctx.createLinearGradient(0, 0, 560, 0);
    perde.addColorStop(0, 'rgba(11,11,18,0.90)');
    perde.addColorStop(0.72, 'rgba(11,11,18,0.72)');
    perde.addColorStop(1, 'rgba(11,11,18,0)');
    ctx.fillStyle = perde;
    ctx.fillRect(0, 0, 560, BOY);

    // --- Başlık ------------------------------------------------------
    const X = 104;
    ctx.textBaseline = 'alphabetic';

    ctx.font = '11px "Press Start 2P", monospace';
    // `letterSpacing` yoksa (eski tarayıcı) yazı yine çıkıyor, sadece sık
    if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('8 BİT PİKSEL VOLEYBOL', X, 190);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

    ctx.font = '48px "Press Start 2P", monospace';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 10;
    ctx.strokeStyle = PALETTE.outline;
    ctx.fillStyle = PALETTE.turkishRed;
    ['RETRO', 'VOLEYBOL'].forEach((satir, i) => {
      const y = 258 + i * 62;
      ctx.strokeText(satir, X, y);
      ctx.fillText(satir, X, y);
    });

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(X, 344, 168, 6);

    ctx.font = '11px "Press Start 2P", monospace';
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText('TEK KİŞİLİK · ÇEVRİMİÇİ', X, 394);
    ctx.fillStyle = 'rgba(255,255,255,0.70)';
    ctx.fillText('TURNUVA · HAYATTA KALMA', X, 420);

    /*
     * SAYDAMLIK YOK. Play saydam kanallı görseli reddediyor; zemin
     * baştan tüm tuvali kapatıyor ama bunu bir de burada sabitliyoruz:
     * ileride bir katman kaldırılırsa hata mağazada değil burada çıksın.
     */
    const veri = ctx.getImageData(0, 0, EN, BOY).data;
    let saydam = 0;
    for (let i = 3; i < veri.length; i += 4 * 31) if (veri[i] < 255) saydam += 1;

    return { url: tuval.toDataURL('image/png'), saydam, en: EN, boy: BOY };
  });
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
    (t) => localStorage.setItem('retro-voleybol-prefs', JSON.stringify(t)),
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

// Öne çıkan görsel — boyuttan bağımsız, bir kere
{
  console.log('\nöne çıkan görsel (1024x500)');
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 700 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'load' });
  await page.evaluate(
    (t) => localStorage.setItem('retro-voleybol-prefs', JSON.stringify(t)),
    TERCIH,
  );
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1200);

  const sonuc = await oneCikanCiz(page);
  if (sonuc.saydam > 0) {
    throw new Error(`öne çıkan görselde saydam piksel var (${sonuc.saydam} örnek) — Play reddeder`);
  }
  const yol = join(CIKTI, 'one-cikan-1024x500.png');
  writeFileSync(yol, Buffer.from(sonuc.url.split(',')[1], 'base64'));
  console.log(`  ${sonuc.en}x${sonuc.boy} → one-cikan-1024x500.png`);
  await ctx.close();
}

await browser.close();
console.log(`\nÇıktı: ${CIKTI}`);
console.log('Play Store en az 2 telefon görüntüsü istiyor; burada 3-4 tane var.');
console.log('Öne çıkan görsel (1024x500) zorunlu ve üretildi.');
