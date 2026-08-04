/**
 * Piksel sprite çizimleri.
 *
 * Hem oyun motoru hem de React karakter seçim ekranı bu fonksiyonları
 * kullanır — böylece sahadaki figürle avatardaki figür birebir aynıdır.
 *
 * Sprite'lar bir birim ızgarasına (unit grid) çizilir: `u` bir pikselin
 * ekrandaki boyutudur. Sultan figürü 14 birim genişlik × 22 birim yükseklik.
 */

import { PALETTE } from './constants.js';

export const SPRITE_UNITS_W = 14;
export const SPRITE_UNITS_H = 22;

/**
 * Izgara birimiyle, koyu dış hatlı blok çizer.
 * Dış hat figürün zeminden ayrışmasını sağlar (pixel-art okunabilirliği).
 */
function blockPainter(ctx, originX, originY, u) {
  return (gx, gy, gw, gh, color, outline = true) => {
    const x = originX + gx * u;
    const y = originY + gy * u;
    const w = gw * u;
    const h = gh * u;

    if (outline) {
      ctx.fillStyle = PALETTE.outline;
      ctx.fillRect(Math.round(x - 1), Math.round(y - 1), Math.round(w + 2), Math.round(h + 2));
    }
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
}

/**
 * Filenin Sultanı figürünü çizer.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} data players.js'teki oyuncu nesnesi (colors + number)
 * @param {object} opts
 * @param {number} opts.x      Ayakların yatay merkezi
 * @param {number} opts.y      Ayakların değdiği zemin çizgisi
 * @param {number} [opts.scale] Birim boyutu (px)
 * @param {'idle'|'run'|'jump'|'spike'|'bump'|'cheer'} [opts.pose]
 * @param {number} [opts.facing] 1 sağa, -1 sola
 * @param {number} [opts.frame]  Yürüyüş animasyon fazı (0..1)
 * @param {boolean} [opts.showNumber]
 * @param {boolean} [opts.glow]  Sultan Gücü aktifken altın hale
 */
export function drawSultan(ctx, data, opts) {
  const {
    x,
    y,
    scale: u = 3,
    pose = 'idle',
    facing = 1,
    frame = 0,
    showNumber = true,
    glow = false,
  } = opts;

  const { primary, secondary, skin, hair, accent } = data.colors;

  const originX = x - (SPRITE_UNITS_W / 2) * u;
  const originY = y - SPRITE_UNITS_H * u;
  const px = blockPainter(ctx, originX, originY, u);

  ctx.save();

  // Sultan Gücü halesi
  if (glow) {
    ctx.shadowColor = PALETTE.gold;
    ctx.shadowBlur = 18;
  }

  // --- Bacaklar (koşu fazına göre açılır) ---
  const stride = pose === 'run' ? Math.sin(frame * Math.PI * 2) * 1.1 : 0;
  const legSpread = pose === 'jump' || pose === 'spike' ? 1.2 : 0;
  const legL = 4 - legSpread + stride;
  const legR = 8 + legSpread - stride;

  px(legL, 16, 2, 4.4, skin);
  px(legR, 16, 2, 4.4, skin);

  // Dizlikler — voleybolun klasik aksesuarı
  px(legL - 0.25, 17.4, 2.5, 1.3, secondary, false);
  px(legR - 0.25, 17.4, 2.5, 1.3, secondary, false);

  // Çoraplar ve ayakkabılar
  px(legL - 0.1, 20, 2.2, 1, '#FFFFFF', false);
  px(legR - 0.1, 20, 2.2, 1, '#FFFFFF', false);
  px(legL - 0.5, 20.9, 3, 1.2, '#F5F5F5');
  px(legR - 0.5, 20.9, 3, 1.2, '#F5F5F5');

  // --- Kollar (poza göre) ---
  // Not: her kol gövdenin üst kenarına (y=8) kadar uzatılır, yoksa
  // kaldırılmış kollar figürden kopuk görünür.
  const armColor = skin;
  if (pose === 'jump' || pose === 'spike') {
    // Havada: kollar yukarıda, smaçta vuran kol daha yüksek
    const hitArmY = pose === 'spike' ? 1.4 : 3.2;
    const hitArmH = pose === 'spike' ? 7.2 : 5.6;
    px(facing > 0 ? 10.4 : 1.5, hitArmY, 2.1, hitArmH, armColor);
    px(facing > 0 ? 1.5 : 10.4, 4.4, 2.1, 5.4, armColor);
  } else if (pose === 'bump') {
    // Manşet: iki kol birleşik, öne uzanmış
    px(facing > 0 ? 9.5 : 2.4, 10.4, 3.6, 2.2, armColor);
    px(facing > 0 ? 12.2 : 0.2, 11.4, 1.7, 1.8, armColor);
  } else if (pose === 'cheer') {
    px(1.8, 2.4, 2.1, 6.4, armColor);
    px(10.1, 2.4, 2.1, 6.4, armColor);
  } else {
    px(1.5, 9, 2.1, 5.5, armColor);
    px(10.4, 9, 2.1, 5.5, armColor);
  }

  // --- Forma (gövde) ---
  px(3, 8, 8, 6.4, primary);

  // Yaka ve omuz şeridi (ikincil renk)
  px(3, 8, 8, 1, secondary, false);
  px(3, 8, 0.9, 6.4, secondary, false);
  px(10.1, 8, 0.9, 6.4, secondary, false);

  // --- Şort ---
  px(3.2, 14, 7.6, 2.4, '#1B1B2E');

  // --- Boyun ---
  px(6, 7, 2, 1.4, skin, false);

  // --- Baş ---
  px(4, 2.4, 6, 5, skin);

  // Gözler
  ctx.fillStyle = PALETTE.outline;
  const eyeY = originY + 4.4 * u;
  ctx.fillRect(Math.round(originX + (facing > 0 ? 6.4 : 4.9) * u), Math.round(eyeY), Math.max(1, Math.round(u * 0.8)), Math.max(1, Math.round(u * 0.9)));
  ctx.fillRect(Math.round(originX + (facing > 0 ? 8.3 : 6.8) * u), Math.round(eyeY), Math.max(1, Math.round(u * 0.8)), Math.max(1, Math.round(u * 0.9)));

  // --- Saç ---
  px(3.4, 0.8, 7.2, 2.2, hair); // üst
  px(3.2, 1.6, 1.2, 4.4, hair, false); // sol yan
  px(9.6, 1.6, 1.2, 4.4, hair, false); // sağ yan
  px(facing > 0 ? 2.2 : 9.8, 2.6, 1.4, 4.6, hair); // at kuyruğu

  // Saç bandı (aksan rengi)
  px(3.4, 2.4, 7.2, 0.7, accent, false);

  // --- Forma numarası ---
  if (showNumber && u >= 2.4) {
    ctx.fillStyle = secondary === '#FFFFFF' ? '#FFFFFF' : '#FFFFFF';
    ctx.font = `${Math.round(u * 2.1)}px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(data.number), originX + 7 * u, originY + 11 * u);
  }

  ctx.restore();
}

/**
 * Voleybol topu — beyaz gövde, kırmızı/mavi panel şeritleri.
 * Sultan Gücü aktifken alevli görünür.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x:number, y:number, radius:number, rotation:number}} ball
 * @param {boolean} [flaming]
 */
export function drawBall(ctx, ball, flaming = false) {
  const { x, y, radius: r, rotation } = ball;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  if (flaming) {
    ctx.shadowColor = PALETTE.flame[2];
    ctx.shadowBlur = 22;
  }

  // Gövde
  ctx.fillStyle = flaming ? PALETTE.flame[0] : PALETTE.ballWhite;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Paneller
  ctx.lineWidth = Math.max(2, r * 0.22);
  ctx.lineCap = 'round';

  ctx.strokeStyle = flaming ? PALETTE.flame[3] : PALETTE.ballRed;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.6, Math.PI * 0.12, Math.PI * 0.92);
  ctx.stroke();

  ctx.strokeStyle = flaming ? PALETTE.flame[1] : PALETTE.ballBlue;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.6, Math.PI * 1.12, Math.PI * 1.92);
  ctx.stroke();

  // Dış hat
  ctx.shadowBlur = 0;
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

/**
 * Türk bayrağı — piksel hilal ve yıldız.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x Sol üst köşe
 * @param {number} y Sol üst köşe
 * @param {number} u Birim boyutu
 * @param {number} [wave] Dalgalanma fazı (radyan)
 */
export function drawTurkishFlag(ctx, x, y, u, wave = 0) {
  const cols = 12;
  const rows = 8;

  for (let c = 0; c < cols; c += 1) {
    // Sütun bazlı dikey kaydırma → bayrak dalgalanıyor gibi görünür
    const offset = Math.sin(wave + c * 0.55) * u * 0.5;

    for (let r = 0; r < rows; r += 1) {
      ctx.fillStyle = flagPixel(c, r) ? '#FFFFFF' : PALETTE.turkishRed;
      ctx.fillRect(
        Math.round(x + c * u),
        Math.round(y + r * u + offset),
        Math.ceil(u),
        Math.ceil(u)
      );
    }
  }
}

/**
 * 12×8 bayrak ızgarasında verilen hücre beyaz mı?
 * Hilal + yıldız kabaca piksellenmiştir.
 */
function flagPixel(c, r) {
  // Hilal: 3..6 sütunlarında C şekli
  const crescent =
    (c === 3 && r >= 3 && r <= 4) ||
    (c === 4 && (r === 2 || r === 5)) ||
    (c === 5 && (r === 1 || r === 6)) ||
    (c === 6 && (r === 1 || r === 6)) ||
    (c === 7 && (r === 2 || r === 5));

  // Yıldız: 9. sütun civarı
  const star = (c === 9 && r === 3) || (c === 9 && r === 4) || (c === 8 && r === 3.5) || (c === 10 && r === 4);

  return crescent || star;
}

/**
 * Piksel kupa (zafer ekranı ve HUD için).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x Merkez
 * @param {number} y Taban
 * @param {number} u Birim boyutu
 */
export function drawTrophy(ctx, x, y, u) {
  const px = (gx, gy, gw, gh, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x + gx * u), Math.round(y + gy * u), Math.ceil(gw * u), Math.ceil(gh * u));
  };

  const gold = PALETTE.gold;
  const goldDark = '#C99A1F';
  const goldLight = '#FFF0B0';

  // Kase
  px(-4, -12, 8, 6, gold);
  px(-3, -6, 6, 2, goldDark);
  px(-3, -11, 2, 4, goldLight); // parlama

  // Kulplar
  px(-6, -11, 2, 4, goldDark);
  px(4, -11, 2, 4, goldDark);

  // Gövde
  px(-1.5, -4, 3, 3, goldDark);

  // Taban
  px(-4, -1, 8, 1.6, gold);
  px(-5, 0.6, 10, 1.6, goldDark);
}
