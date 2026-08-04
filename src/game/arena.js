/**
 * Salon (arena) çizimi — arka plan, tribün, zemin ve file.
 *
 * Motorun simülasyonundan ayrı tutulur: burada tek satır oyun mantığı
 * yoktur, sadece Canvas 2D çizimi. Tamamı kod — görsel dosyası yok.
 *
 * Derinlik düzeni (yukarıdan aşağı):
 *
 *   çatı kirişleri → üst tribün → LED kuşak → alt tribün →
 *   reklam panoları → oyun hacminin arkası (sade, koyu) → zemin
 *
 * Panoların altındaki bant kasıtlı olarak boş ve koyudur: top oradan
 * geçtiği için kalabalık bir arka plan topu okunmaz hale getiriyordu.
 */

import {
  ARENA,
  FLOOR,
  GAME_HEIGHT,
  GAME_WIDTH,
  GROUND_Y,
  NET,
  PALETTE,
  WALL_PAD,
} from './constants.js';
import { drawTurkishFlag } from './sprites.js';

/** Tavandaki ışıkların yatay konumları. */
const LIGHT_X = [GAME_WIDTH * 0.18, GAME_WIDTH * 0.5, GAME_WIDTH * 0.82];

/**
 * Zemin perspektifi: bir saha x koordinatının verilen derinlikteki
 * (y) ekran karşılığı. Yakın kenara inildikçe çizgiler açılır.
 *
 * @param {number} x Uzak kenardaki (GROUND_Y hizasındaki) x
 * @param {number} y Derinlik
 */
export function floorX(x, y) {
  const span = FLOOR.nearY - GROUND_Y;
  const t = span === 0 ? 0 : Math.max(0, Math.min(1, (y - GROUND_Y) / span));
  const k = 1 + (FLOOR.spread - 1) * t;
  return GAME_WIDTH / 2 + (x - GAME_WIDTH / 2) * k;
}

/** Deterministik sözde-rastgele — her karede aynı seyirci. */
function rand(seed) {
  const v = Math.sin(seed * 127.1) * 43758.5453;
  return v - Math.floor(v);
}

// =====================================================================
// Arka plan
// =====================================================================

/**
 * Salonun tamamını çizer.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} time Saniye
 * @param {number} [hype] 0–1, sayı sonrası tribün coşkusu
 */
export function drawArena(ctx, time, hype = 0) {
  drawShell(ctx);
  drawRoof(ctx, time);

  drawTier(ctx, {
    y: ARENA.upperTierY,
    height: ARENA.upperTierH,
    rows: 2,
    spacing: 20,
    size: 0.95,
    flagEvery: 5,
    dim: 0.55,
    time,
    hype,
  });

  drawRibbon(ctx, time);

  drawTier(ctx, {
    y: ARENA.lowerTierY,
    height: ARENA.lowerTierH,
    rows: 2,
    spacing: 30,
    size: 1.45,
    flagEvery: 3,
    dim: 0.9,
    time,
    hype,
  });

  // Tribünü geri it: parlak kırmızı/beyaz kalabalık top ve oyuncularla
  // görsel olarak yarışıyordu. Arka plan arka planda kalmalı.
  const haze = ctx.createLinearGradient(0, 0, 0, ARENA.boardsY);
  haze.addColorStop(0, 'rgba(8, 8, 20, 0.30)');
  haze.addColorStop(1, 'rgba(8, 8, 20, 0.55)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, GAME_WIDTH, ARENA.boardsY);

  drawAdBoards(ctx, time);
  drawBackWall(ctx);
  drawLightBeams(ctx, time);
}

/** Salonun kabuğu: tavan ve arka duvar bloğu. */
function drawShell(ctx) {
  ctx.fillStyle = PALETTE.night;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  ctx.fillStyle = PALETTE.tierBack;
  ctx.fillRect(0, 0, GAME_WIDTH, GROUND_Y);
}

/** Çatı kirişleri ve projektörler. */
function drawRoof(ctx, time) {
  ctx.fillStyle = PALETTE.roof;
  ctx.fillRect(0, 0, GAME_WIDTH, ARENA.roofH);

  // Kafes kirişler
  ctx.fillStyle = PALETTE.truss;
  for (let x = 0; x < GAME_WIDTH; x += 40) {
    ctx.fillRect(x, 6, 26, 3);
    ctx.fillRect(x + 12, 9, 3, 10);
  }
  ctx.fillRect(0, 19, GAME_WIDTH, 3);

  // Projektör gövdeleri
  LIGHT_X.forEach((x, i) => {
    const flicker = 0.9 + Math.sin(time * 4 + i * 2.1) * 0.1;

    ctx.fillStyle = '#2b2b48';
    ctx.fillRect(Math.round(x - 30), 12, 60, 8);

    ctx.fillStyle = `rgba(255, 248, 214, ${flicker})`;
    ctx.fillRect(Math.round(x - 26), 20, 52, 7);

    // Sıcak taşma
    ctx.fillStyle = `${PALETTE.lightWarm} ${0.18 * flicker})`;
    ctx.fillRect(Math.round(x - 34), 26, 68, 4);
  });
}

/**
 * Bir tribün katmanı: basamaklar + seyirciler + bayraklar.
 * Üst kat küçük ve soluk, alt kat büyük ve net → derinlik hissi.
 */
function drawTier(ctx, opts) {
  const { y, height, rows, spacing, size, flagEvery, dim, time, hype } = opts;
  const rowHeight = height / rows;

  // Basamaklar
  for (let r = 0; r < rows; r += 1) {
    ctx.fillStyle = r % 2 === 0 ? PALETTE.tierStep : PALETTE.tierBack;
    ctx.fillRect(0, y + r * rowHeight, GAME_WIDTH, rowHeight);
  }

  // Kat önü korkuluğu
  ctx.fillStyle = PALETTE.hallWallDark;
  ctx.fillRect(0, y + height - 5, GAME_WIDTH, 5);

  ctx.save();
  ctx.globalAlpha = dim;

  for (let r = 0; r < rows; r += 1) {
    const baseY = y + r * rowHeight + rowHeight * 0.15;
    const offsetX = (r % 2) * (spacing / 2);

    for (let i = 0; ; i += 1) {
      const seed = y * 3.7 + r * 31.3 + i * 17.9;
      const n = rand(seed);

      // Düzenli ızgara duvar kağıdı gibi görünüyordu; her seyirci
      // kendi tohumuna göre biraz kayar
      const jitter = (rand(seed + 5.5) - 0.5) * spacing * 0.45;
      const x = 8 + offsetX + i * spacing + jitter;
      if (x > GAME_WIDTH) break;

      // Coşku anında daha yüksek ve daha hızlı zıplama
      const bobSpeed = 2.2 + hype * 5;
      const bobAmount = (1.8 + hype * 5) * size;
      const bob = Math.sin(time * bobSpeed + seed) * bobAmount;

      if (i % flagEvery === Math.floor(n * flagEvery)) {
        drawFlagBearer(ctx, x, baseY + bob, size, time, seed, hype);
      } else {
        drawSpectator(ctx, x, baseY + bob, size, n);
      }
    }
  }

  ctx.restore();
}

/** Tek seyirci — baş ve gövde. */
function drawSpectator(ctx, x, y, size, n) {
  const w = Math.max(3, Math.round(7 * size));
  const headH = Math.max(3, Math.round(6 * size));
  const bodyH = Math.max(4, Math.round(9 * size));

  // Baş
  ctx.fillStyle = n < 0.33 ? '#C98A5E' : n < 0.66 ? '#E8B48C' : '#EFC7A6';
  ctx.fillRect(Math.round(x), Math.round(y), w, headH);

  // Saç
  ctx.fillStyle = n < 0.5 ? '#2B1B14' : '#3A2418';
  ctx.fillRect(Math.round(x), Math.round(y), w, Math.max(1, Math.round(2 * size)));

  // Gövde — kırmızı/beyaz taraftar formaları
  ctx.fillStyle = n < 0.55 ? PALETTE.turkishRed : '#EFEFF6';
  ctx.fillRect(
    Math.round(x - size),
    Math.round(y + headH),
    Math.round(w + size * 2),
    bodyH
  );
}

/** Bayrak taşıyan taraftar — direkli, dalgalanan bayrak. */
function drawFlagBearer(ctx, x, y, size, time, seed, hype) {
  const u = Math.max(1, size * 1.4);
  const flagW = 12 * u;
  const flagH = 8 * u;
  const poleH = flagH + 8 * size;

  // Direk
  ctx.fillStyle = '#6b5b3e';
  ctx.fillRect(Math.round(x - 1), Math.round(y - 2), Math.max(1, Math.round(size)), poleH);

  // Bayrak (coşkuda daha hızlı dalgalanır)
  drawTurkishFlag(
    ctx,
    x,
    y - 2,
    u,
    time * (3 + hype * 5) + seed
  );

  // Taşıyanın gövdesi bayrağın altında
  ctx.fillStyle = PALETTE.turkishRed;
  ctx.fillRect(
    Math.round(x),
    Math.round(y - 2 + flagH + 2 * size),
    Math.round(flagW * 0.5),
    Math.round(7 * size)
  );
}

/** İki tribün arasındaki LED kuşak bandı. */
function drawRibbon(ctx, time) {
  const { ribbonY: y, ribbonH: h } = ARENA;

  ctx.fillStyle = PALETTE.ribbonDark;
  ctx.fillRect(0, y, GAME_WIDTH, h);

  ctx.fillStyle = PALETTE.hallWallDark;
  ctx.fillRect(0, y, GAME_WIDTH, 2);
  ctx.fillRect(0, y + h - 2, GAME_WIDTH, 2);

  // Kayan LED desenleri: kırmızı-beyaz bloklar ve altın noktalar
  const cell = 10;
  const shift = (time * 70) % (cell * 8);

  for (let x = -cell * 8; x < GAME_WIDTH + cell * 8; x += cell) {
    const index = Math.floor((x + shift) / cell);
    const phase = ((index % 8) + 8) % 8;

    let color = null;
    if (phase === 0 || phase === 1) color = PALETTE.turkishRed;
    else if (phase === 2) color = '#FFFFFF';
    else if (phase === 4) color = PALETTE.ribbonOn;

    if (!color) continue;

    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x - shift + cell * 8), y + 4, cell - 2, h - 8);
  }
}

/** Saha kenarı reklam panoları. */
function drawAdBoards(ctx, time) {
  const { boardsY: y, boardsH: h } = ARENA;

  ctx.fillStyle = PALETTE.adBoard;
  ctx.fillRect(0, y, GAME_WIDTH, h);

  // Yan panolar — soyut sponsor blokları
  ctx.fillStyle = '#1b1b3a';
  for (let x = 6; x < GAME_WIDTH; x += 58) {
    ctx.fillRect(x, y + 4, 46, h - 8);
  }

  // Orta pano: takım adı
  const bw = 330;
  const bx = GAME_WIDTH / 2 - bw / 2;

  ctx.fillStyle = PALETTE.turkishRed;
  ctx.fillRect(bx, y + 2, bw, h - 4);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(bx, y + 2, bw, 2);
  ctx.fillRect(bx, y + h - 4, bw, 2);

  // Işık yansıması — soldan sağa kayan parlama
  const shine = ((time * 90) % (bw + 160)) - 80;
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(bx + shine, y + 2, 40, h - 4);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '10px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FİLENİN SULTANLARI', GAME_WIDTH / 2, y + h / 2);

  // Pano altı gölgesi
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, y + h, GAME_WIDTH, 6);
}

/**
 * Oyun hacminin arkası — sade ve koyu.
 * Top bu bantta uçtuğu için desen minimumda tutulur.
 */
function drawBackWall(ctx) {
  const top = ARENA.backWallY;

  ctx.fillStyle = PALETTE.backWall;
  ctx.fillRect(0, top, GAME_WIDTH, GROUND_Y - top);

  // Çok soluk dikey paneller — düz boşluk hissini kırar
  ctx.fillStyle = PALETTE.backWallPanel;
  for (let x = 20; x < GAME_WIDTH; x += 72) {
    ctx.fillRect(x, top + 6, 3, GROUND_Y - top - 12);
  }

  // Zemine yakın koyulaşma
  const grad = ctx.createLinearGradient(0, GROUND_Y - 60, 0, GROUND_Y);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, GROUND_Y - 60, GAME_WIDTH, 60);
}

/** Projektör huzmeleri — üstte parlak, zeminde sönen gradyan. */
function drawLightBeams(ctx, time) {
  LIGHT_X.forEach((x, i) => {
    const flicker = 0.88 + Math.sin(time * 3.4 + i * 1.7) * 0.12;

    const grad = ctx.createLinearGradient(0, ARENA.roofH, 0, GROUND_Y);
    grad.addColorStop(0, `${PALETTE.lightWarm} ${0.16 * flicker})`);
    grad.addColorStop(0.55, `${PALETTE.lightWarm} ${0.05 * flicker})`);
    grad.addColorStop(1, `${PALETTE.lightWarm} 0)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x - 26, ARENA.roofH);
    ctx.lineTo(x + 26, ARENA.roofH);
    ctx.lineTo(x + 150, GROUND_Y);
    ctx.lineTo(x - 150, GROUND_Y);
    ctx.closePath();
    ctx.fill();
  });
}

// =====================================================================
// Zemin
// =====================================================================

/**
 * Kırmızı/beyaz saha — perspektifle yere yatırılmış.
 *
 * Daha önce zemin düz bir şeritti ve oyuncular bir rafın üstünde
 * duruyor gibi görünüyordu. Artık çizgiler kaçış noktasına yakınsıyor.
 *
 * @param {CanvasRenderingContext2D} ctx
 */
export function drawFloor(ctx) {
  const nearY = FLOOR.nearY;

  // Serbest bölge (koyu kırmızı) — tüm zemin bandı
  ctx.fillStyle = PALETTE.courtOut;
  ctx.fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);

  // Saha içi — yamuk
  ctx.fillStyle = PALETTE.courtIn;
  ctx.beginPath();
  ctx.moveTo(WALL_PAD, GROUND_Y);
  ctx.lineTo(GAME_WIDTH - WALL_PAD, GROUND_Y);
  ctx.lineTo(floorX(GAME_WIDTH - WALL_PAD, nearY), nearY);
  ctx.lineTo(floorX(WALL_PAD, nearY), nearY);
  ctx.closePath();
  ctx.fill();

  // Zemin ışık havuzları — sahanın parladığı yerler
  LIGHT_X.forEach((x) => {
    const grad = ctx.createRadialGradient(x, GROUND_Y + 40, 4, x, GROUND_Y + 40, 190);
    grad.addColorStop(0, `${PALETTE.lightWarm} 0.13)`);
    grad.addColorStop(1, `${PALETTE.lightWarm} 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(x - 200, GROUND_Y, 400, GAME_HEIGHT - GROUND_Y);
  });

  // Dip (uzak) çizgi — oyuncuların bastığı hat
  ctx.fillStyle = PALETTE.courtLine;
  ctx.fillRect(WALL_PAD, GROUND_Y - 3, GAME_WIDTH - WALL_PAD * 2, 3);

  // Yakın çizgi
  const nl = floorX(WALL_PAD, nearY);
  const nr = floorX(GAME_WIDTH - WALL_PAD, nearY);
  ctx.fillRect(Math.round(nl), Math.round(nearY - 4), Math.round(nr - nl), 5);

  // Yakınsayan dikey çizgiler: kenarlar, orta çizgi, hücum çizgileri
  [
    WALL_PAD,
    GAME_WIDTH - WALL_PAD,
    NET.x,
    NET.x - 130,
    NET.x + 130,
  ].forEach((x) => drawConvergingLine(ctx, x, GROUND_Y, nearY));

  // Parke parlaması — zeminde yatay şeritler
  ctx.fillStyle = PALETTE.floorSheen;
  for (let y = GROUND_Y + 12; y < nearY; y += 16) {
    const l = floorX(WALL_PAD, y);
    const r = floorX(GAME_WIDTH - WALL_PAD, y);
    ctx.fillRect(Math.round(l), Math.round(y), Math.round(r - l), 1);
  }
}

/** Perspektifle genişleyen bir saha çizgisi. */
function drawConvergingLine(ctx, x, topY, bottomY) {
  const wTop = 3;
  const wBottom = 5;
  const xt = floorX(x, topY);
  const xb = floorX(x, bottomY);

  ctx.fillStyle = PALETTE.courtLine;
  ctx.beginPath();
  ctx.moveTo(xt - wTop / 2, topY);
  ctx.lineTo(xt + wTop / 2, topY);
  ctx.lineTo(xb + wBottom / 2, bottomY);
  ctx.lineTo(xb - wBottom / 2, bottomY);
  ctx.closePath();
  ctx.fill();
}

// =====================================================================
// File
// =====================================================================

/**
 * File — direk, sarkan örgü, üst bant ve antenler.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} netFloorY Filenin tabanının değdiği y (topun düzlemi)
 */
export function drawNet(ctx, netFloorY) {
  const left = NET.x - NET.width / 2;
  const topY = netFloorY - NET.height;
  const meshTop = topY + 8;
  const meshBottom = topY + 86;
  const meshLeft = left - 21;
  const meshRight = left + NET.width + 21;

  // Direk gölgesi (zeminde)
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(NET.x, netFloorY + 2, 26, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Direk
  ctx.fillStyle = PALETTE.netPost;
  ctx.fillRect(left, topY, NET.width, NET.height);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(left + NET.width - 4, topY, 4, NET.height);

  // Direk tabanı
  ctx.fillStyle = '#8d90a0';
  ctx.fillRect(left - 9, netFloorY - 10, NET.width + 18, 10);
  ctx.fillStyle = '#6d7080';
  ctx.fillRect(left - 13, netFloorY - 3, NET.width + 26, 4);

  // Örgü — hafif sarkma ile
  const sag = 5;
  ctx.fillStyle = 'rgba(240, 240, 248, 0.8)';

  for (let y = meshTop; y <= meshBottom; y += 9) {
    for (let x = meshLeft; x < meshRight; x += 2) {
      // Ortaya doğru sarkan yatay ip
      const t = (x - meshLeft) / (meshRight - meshLeft);
      const dip = Math.sin(t * Math.PI) * sag;
      ctx.fillRect(Math.round(x), Math.round(y + dip), 2, 2);
    }
  }
  for (let x = meshLeft; x <= meshRight; x += 9) {
    const t = (x - meshLeft) / (meshRight - meshLeft);
    const dip = Math.sin(t * Math.PI) * sag;
    ctx.fillRect(Math.round(x), Math.round(meshTop + dip), 2, meshBottom - meshTop);
  }

  // Üst bant
  ctx.fillStyle = PALETTE.courtLine;
  ctx.fillRect(meshLeft - 4, topY, meshRight - meshLeft + 8, 9);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(meshLeft - 4, topY + 7, meshRight - meshLeft + 8, 2);

  // Antenler — bandın üzerinde duran kısa kırmızı/beyaz çubuklar.
  // Uzun tutulunca file kale direği gibi okunuyordu.
  [meshLeft - 1, meshRight - 2].forEach((x) => {
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? PALETTE.turkishRed : '#FFFFFF';
      ctx.fillRect(Math.round(x), topY - 21 + i * 7, 3, 7);
    }
  });
}
