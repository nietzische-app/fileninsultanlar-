/**
 * Sahanın iki yanındaki boşluğu dolduran salon katmanı.
 *
 * Neden var: oyun canvas'ı 9:5 oranında ve yatay telefonda yüksekliğe
 * sığdırılıyor, dolayısıyla iki yanda geniş siyah bant kalıyor (Pixel
 * 5'te 851px ekranın 205px'i, yani beşte biri). Kontrol şeridi eklenince
 * canvas biraz daha küçüldü ve bantlar büyüdü.
 *
 * Yaklaşım: oyun canvas'ının ARKASINDA, sahnenin tamamını kaplayan ikinci
 * bir canvas. Aynı birim ölçeğinde çizildiği için tribün sıraları
 * dikişsiz devam eder — ortadaki 900 birim zaten oyun canvas'ıyla
 * örtülür, yani burada çizilen şeyin çoğu görünmez; görünen yalnızca
 * kanatlar.
 *
 * Ölçek eşitliği şart: kanat canvas'ının yüksekliği de 500 birim,
 * genişliği ise sahnenin oyun canvas'ına oranından türetiliyor
 * (`wingWidthUnits`). Böylece 1 birim iki canvas'ta da aynı piksele
 * denk gelir.
 *
 * Tribünün altına yedek kulübeleri kondu: solda Türkiye, sağda rakip.
 * Boş bant tribünle doldurulunca üst yarı doluyor ama saha hizasındaki
 * bant hâlâ boş kalıyordu; kulübe orayı salonun bir parçası yapıyor.
 */

import { ARENA, GAME_HEIGHT, GAME_WIDTH, GROUND_Y, PALETTE } from './constants.js';
import { drawTier } from './arena.js';

/**
 * Sahne genişliğine karşılık gelen kanat canvas'ı genişliği (oyun birimi).
 *
 * @param {number} stageW Sahnenin CSS genişliği
 * @param {number} canvasH Oyun canvas'ının CSS yüksekliği
 */
export function wingWidthUnits(stageW, canvasH) {
  if (!canvasH) return GAME_WIDTH;
  return Math.max(GAME_WIDTH, Math.round((GAME_HEIGHT * stageW) / canvasH));
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ width: number, time?: number, hype?: number }} opts
 *   `width` oyun birimi cinsinden toplam genişlik (900'den büyük).
 */
export function drawWings(ctx, { width, time = 0, hype = 0 }) {
  const w = Math.max(GAME_WIDTH, width);
  // Oyun alanı ortada; kanatlar onun dışında kalan pay
  const pad = (w - GAME_WIDTH) / 2;

  ctx.clearRect(0, 0, w, GAME_HEIGHT);

  // --- Salon kabuğu ---
  ctx.fillStyle = PALETTE.night;
  ctx.fillRect(0, 0, w, GAME_HEIGHT);
  ctx.fillStyle = PALETTE.tierBack;
  ctx.fillRect(0, 0, w, GROUND_Y);

  // --- Çatı ---
  ctx.fillStyle = PALETTE.roof;
  ctx.fillRect(0, 0, w, ARENA.roofH);
  ctx.fillStyle = PALETTE.truss;
  for (let x = 0; x < w; x += 40) {
    ctx.fillRect(x, 6, 26, 3);
    ctx.fillRect(x + 12, 9, 3, 10);
  }
  ctx.fillRect(0, 19, w, 3);

  // --- Tribünler: oyun alanıyla AYNI fonksiyon, aynı hizada ---
  drawTier(ctx, {
    x0: 0, x1: w,
    y: ARENA.upperTierY, height: ARENA.upperTierH,
    rows: 2, spacing: 20, size: 0.95, flagEvery: 5, dim: 0.55, time, hype,
  });

  // Şerit bandı (orta koridordaki afiş kanatlarda düz bant olarak sürer)
  ctx.fillStyle = PALETTE.hallWallDark;
  ctx.fillRect(0, ARENA.ribbonY, w, ARENA.ribbonH);

  drawTier(ctx, {
    x0: 0, x1: w,
    y: ARENA.lowerTierY, height: ARENA.lowerTierH,
    rows: 2, spacing: 30, size: 1.45, flagEvery: 3, dim: 0.9, time, hype,
  });

  // Tribünü geri iten pus — oyun alanındakiyle aynı
  const haze = ctx.createLinearGradient(0, 0, 0, ARENA.boardsY);
  haze.addColorStop(0, 'rgba(8, 8, 20, 0.30)');
  haze.addColorStop(1, 'rgba(8, 8, 20, 0.55)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, w, ARENA.boardsY);

  // --- Reklam panosu bandı ve arka duvar ---
  ctx.fillStyle = '#12122a';
  ctx.fillRect(0, ARENA.boardsY, w, ARENA.boardsH);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(0, ARENA.boardsY + ARENA.boardsH, w, 4);
  ctx.fillStyle = PALETTE.hallWall;
  ctx.fillRect(0, ARENA.backWallY, w, GROUND_Y - ARENA.backWallY);

  // --- Zemin: serbest bölge kanatlarda da sürer ---
  ctx.fillStyle = PALETTE.courtOut;
  ctx.fillRect(0, GROUND_Y, w, GAME_HEIGHT - GROUND_Y);

  // --- Yedek kulübeleri ---
  if (pad > 60) {
    drawBench(ctx, {
      cx: pad / 2,
      primary: PALETTE.turkishRed,
      secondary: '#FFFFFF',
      time,
      seed: 3,
    });
    drawBench(ctx, {
      cx: w - pad / 2,
      primary: '#2B3A8F',
      secondary: '#7d8ad8',
      time,
      seed: 11,
    });
  }
}

/**
 * Yedek kulübesi: gölgelik, sıra, oturan oyuncular, su bidonu.
 *
 * Oyuncular saha kenarındaki gerçek boylarından küçük çizilir; kanatlar
 * sahanın dışı, yani perspektifte daha geride. Aynı boyda olsalardı
 * gözün sahadaki oyunculardan ayırt etmesi zorlaşırdı.
 */
function drawBench(ctx, { cx, primary, secondary, time, seed }) {
  const baseY = GROUND_Y + 2;
  const w = 104;
  const left = Math.round(cx - w / 2);

  // Gölgelik (arkalık paneli)
  ctx.fillStyle = '#101026';
  ctx.fillRect(left, baseY - 74, w, 40);
  ctx.fillStyle = primary;
  ctx.fillRect(left, baseY - 74, w, 5);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fillRect(left, baseY - 69, w, 2);

  // Direkler
  ctx.fillStyle = '#22224a';
  ctx.fillRect(left + 2, baseY - 74, 4, 74);
  ctx.fillRect(left + w - 6, baseY - 74, 4, 74);

  // Sıra
  ctx.fillStyle = '#2a2a4a';
  ctx.fillRect(left + 6, baseY - 18, w - 12, 6);
  ctx.fillStyle = '#1a1a34';
  ctx.fillRect(left + 6, baseY - 12, w - 12, 3);

  // Oturan oyuncular
  const seats = 4;
  for (let i = 0; i < seats; i += 1) {
    const x = left + 16 + i * ((w - 34) / (seats - 1));
    // Hafif nefes alma — hepsi aynı anda kıpırdamasın
    const bob = Math.sin(time * 1.4 + seed + i * 1.7) * 0.8;
    drawSeated(ctx, x, baseY - 18 + bob, primary, secondary, (seed + i * 7) % 3);
  }

  // Su bidonu ve havlu yığını
  ctx.fillStyle = '#3a6ea8';
  ctx.fillRect(left + w - 14, baseY - 26, 8, 14);
  ctx.fillStyle = '#cfe3ff';
  ctx.fillRect(left + w - 14, baseY - 26, 8, 3);
  ctx.fillStyle = secondary;
  ctx.fillRect(left + 8, baseY - 24, 10, 5);

  // Zemin gölgesi
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(left + 4, baseY - 2, w - 8, 3);
}

/** Sırada oturan tek oyuncu — kafa, gövde, dizler. */
function drawSeated(ctx, x, y, primary, secondary, skinIndex) {
  const skin = ['#C98A5E', '#E8B48C', '#EFC7A6'][skinIndex] ?? '#E8B48C';

  // Bacaklar (öne sarkık)
  ctx.fillStyle = '#1B1B2E';
  ctx.fillRect(Math.round(x + 4), Math.round(y - 1), 5, 11);

  // Gövde
  ctx.fillStyle = primary;
  ctx.fillRect(Math.round(x), Math.round(y - 13), 9, 13);
  ctx.fillStyle = secondary;
  ctx.fillRect(Math.round(x), Math.round(y - 13), 9, 2);

  // Baş
  ctx.fillStyle = skin;
  ctx.fillRect(Math.round(x + 1), Math.round(y - 20), 7, 7);

  // Saç
  ctx.fillStyle = '#2B1B14';
  ctx.fillRect(Math.round(x + 1), Math.round(y - 20), 7, 2);
}
