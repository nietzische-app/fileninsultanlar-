/**
 * Tanıtım sahnesi — oyunun kendi çizim kodu, zamanın fonksiyonu.
 *
 * Ekran görüntüsü yok. Her kare `src/game` içindeki salon, sultan
 * ve top çizicileriyle üretilir. Konumlar aranmaz; vuruş anları
 * sabittir, böylece herhangi bir kare tek başına çizilebilir.
 */
import { drawArena, drawFloor, drawNet } from "../../src/game/arena.js";
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  GROUND_Y,
  PALETTE,
  PLAYER,
} from "../../src/game/constants.js";
import { OPPONENT_TEMPLATE, ROSTER } from "../../src/game/players.js";
import { drawBall, drawSultan } from "../../src/game/sprites.js";

const GIZEL = ROSTER.find((p) => p.id === "gizel-orgen");
const ATLAS = {
  ...OPPONENT_TEMPLATE,
  id: "atlas",
  name: "Atlas",
  number: 7,
};

/** Vuruş anları, saniye. Müzik 150 vuruş/dk; bunlar ölçü başı. */
const KURTARIS = 1.6;
const SMAÇ = 4.8;
const SAYI = 6.4;

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function lerp(a, b, u) {
  return a + (b - a) * u;
}

function yumusak(u) {
  const x = clamp(u, 0, 1);
  return x * x * (3 - 2 * x);
}

function parca(t, t0, t1) {
  return clamp((t - t0) / (t1 - t0), 0, 1);
}

/**
 * Top, kiriş üzerinde bir parabol.
 * `lift` orta noktayı kirişin ÜSTÜNE çeker (ekran y aşağı bakar).
 */
function yay(t, t0, t1, x0, y0, x1, y1, lift) {
  const u = parca(t, t0, t1);
  return {
    x: lerp(x0, x1, u),
    y: lerp(y0, y1, u) - 4 * lift * u * (1 - u),
    u,
  };
}

function topKonum(t) {
  // Top, pano yazısının altında kalır (pano 188–212). Merkez y ≥ 236.
  if (t < KURTARIS) {
    return yay(t, 0, KURTARIS, 660, 286, 304, 378, 16);
  }
  if (t < 3.55) {
    return yay(t, KURTARIS, 3.55, 304, 378, 352, 246, 62);
  }
  if (t < SMAÇ) {
    return yay(t, 3.55, SMAÇ, 352, 246, 360, 244, 0);
  }
  if (t < 5.45) {
    return yay(t, SMAÇ, 5.45, 360, 244, 640, 256, 6);
  }
  if (t < SAYI) {
    return yay(t, 5.45, SAYI, 640, 256, 760, 407, 4);
  }
  if (t < 9.3) {
    return { x: 742, y: 407, u: 1 };
  }
  if (t < 11.2) {
    return yay(t, 9.3, 11.2, 250, 330, 640, 310, 30);
  }
  return { x: 640, y: 310, u: 1 };
}

function gizel(t) {
  let x = 188;
  let pose = "run";
  let y = GROUND_Y;
  let facing = 1;

  if (t < 1.25) {
    x = lerp(176, 248, yumusak(t / 1.25));
    pose = "run";
  } else if (t < 2.2) {
    x = 252;
    pose = "dive";
  } else if (t < 4.15) {
    x = lerp(252, 348, yumusak((t - 2.2) / 1.95));
    pose = "run";
  } else if (t < 5.4) {
    x = 352;
    const u = parca(t, 4.15, 5.35);
    y = GROUND_Y - Math.sin(u * Math.PI) * 108;
    pose = t < 5.1 ? "spike" : "jump";
  } else if (t < 6.55) {
    x = 340;
    pose = "idle";
  } else if (t < 9.15) {
    x = lerp(340, 236, yumusak((t - 6.55) / 1.2));
    pose = "cheer";
  } else if (t < 9.9) {
    x = 236;
    const u = parca(t, 9.25, 9.85);
    y = GROUND_Y - Math.sin(u * Math.PI) * 42;
    pose = "spike";
  } else {
    x = 236;
    pose = "idle";
  }

  return {
    data: GIZEL,
    x,
    y,
    pose,
    facing,
    frame: (t * 2.6) % 1,
  };
}

function atlas(t) {
  let x = 720;
  let y = GROUND_Y;
  let pose = "idle";

  if (t < 0.45) {
    x = 734;
    pose = "spike";
  } else if (t < 4.85) {
    x = lerp(724, 690, yumusak(t / 4.85));
    pose = "idle";
  } else if (t < 6.5) {
    x = lerp(700, 455, yumusak((t - 4.9) / 0.4));
    const u = parca(t, 5.15, 6.25);
    y = GROUND_Y - Math.sin(clamp(u, 0, 1) * Math.PI) * 100;
    pose = u > 0.02 && u < 0.98 ? "jump" : "idle";
  } else if (t < 7.15) {
    x = lerp(455, 640, yumusak((t - 6.5) / 0.65));
    pose = "run";
  } else {
    x = 640;
    pose = "idle";
  }

  return {
    data: ATLAS,
    x,
    y,
    pose,
    facing: -1,
    frame: 0,
  };
}

function kamera(t, top) {
  let s = 1;
  let cx = 450;
  let cy = 268;

  if (t < 4.5) {
    s = 1.04;
    cx = lerp(450, top.x, 0.12);
    cy = 300;
  } else if (t < 5.05) {
    const u = yumusak((t - 4.5) / 0.28);
    s = lerp(1.04, 1.48, u);
    cx = lerp(420, 390, u);
    cy = lerp(300, 280, u);
  } else if (t < 5.7) {
    const u = yumusak((t - 5.05) / 0.4);
    s = lerp(1.48, 1, u);
    cx = lerp(390, 460, u);
    cy = lerp(280, 290, u);
  } else if (t < 10.45) {
    s = 1;
    cx = 450;
    cy = 268;
  } else {
    const u = clamp((t - 10.45) / 1.15, 0, 1);
    const e = u * u;
    s = lerp(1, 6.4, e);
    cx = top.x;
    cy = top.y;
  }

  const gorunenW = GAME_WIDTH / s;
  const gorunenH = GAME_HEIGHT / s;
  cx = clamp(cx, gorunenW / 2, GAME_WIDTH - gorunenW / 2);
  cy = clamp(cy, gorunenH / 2, GAME_HEIGHT - gorunenH / 2);
  return { s, cx, cy };
}

function sarsinti(t) {
  const vuruslar = [
    [KURTARIS, 3.2, 0.16],
    [SMAÇ, 4.6, 0.1],
    [SAYI, 6.4, 0.26],
  ];
  let x = 0;
  let y = 0;
  for (let i = 0; i < vuruslar.length; i += 1) {
    const [t0, gen, sure] = vuruslar[i];
    const a = t - t0;
    if (a < 0 || a > sure) continue;
    const d = 1 - a / sure;
    x += Math.sin(a * 92) * gen * d;
    y += Math.sin(a * 71 + 1.3) * gen * 0.55 * d;
  }
  return { x, y };
}

function golge(ctx, x, y, yari) {
  ctx.fillStyle = PALETTE.shadow;
  ctx.beginPath();
  ctx.ellipse(x, y + 2, yari, yari * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
}

function cizOyuncu(ctx, oyuncu) {
  const havada = oyuncu.y < GROUND_Y - 2;
  const gen = oyuncu.pose === "dive" ? 46 : 30 * (1 - clamp((GROUND_Y - oyuncu.y) / 170, 0, 1) * 0.45);
  golge(ctx, oyuncu.x, GROUND_Y, gen);

  let sx = 1;
  let sy = 1;
  if (havada && oyuncu.pose !== "dive") {
    sy = 1.08;
    sx = 0.94;
  }

  ctx.save();
  ctx.translate(oyuncu.x, oyuncu.y);
  ctx.scale(sx, sy);
  ctx.translate(-oyuncu.x, -oyuncu.y);
  drawSultan(ctx, oyuncu.data, {
    x: oyuncu.x,
    y: oyuncu.y,
    scale: PLAYER.spriteScale,
    pose: oyuncu.pose,
    facing: oyuncu.facing,
    frame: oyuncu.frame,
  });
  ctx.restore();
}

function cizIz(ctx, t, top) {
  if (t < SMAÇ || t > SAYI) return;
  for (let i = 5; i >= 1; i -= 1) {
    const eski = topKonum(t - i * 0.028);
    const oran = i / 6;
    ctx.globalAlpha = (1 - oran) * 0.34;
    ctx.fillStyle = "#FFC633";
    const boy = 18 * (1 - oran);
    ctx.fillRect(eski.x - boy / 2, eski.y - boy / 2, boy, boy);
  }
  ctx.globalAlpha = 1;
  void top;
}

function parcacik(ctx, t, t0, x, y, renk, adet, sure) {
  const yas = t - t0;
  if (yas < 0 || yas > sure) return;
  const omur = 1 - yas / sure;
  for (let i = 0; i < adet; i += 1) {
    const aci = (i / adet) * Math.PI * 2 + i * 0.4;
    const hiz = 70 + (i % 4) * 36;
    const px = x + Math.cos(aci) * hiz * yas;
    const py = y + Math.sin(aci) * hiz * yas + 220 * yas * yas;
    ctx.globalAlpha = omur;
    ctx.fillStyle = i % 2 === 0 ? renk : "#FFFFFF";
    const boy = 3 + omur * 4;
    ctx.fillRect(px - boy / 2, py - boy / 2, boy, boy);
  }
  ctx.globalAlpha = 1;
}

function mesaj(ctx, yazi, renk, alfa) {
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.font = '20px "Press Start 2P"';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const gen = ctx.measureText(yazi).width;
  const kutu = gen + 52;
  const sol = GAME_WIDTH / 2 - kutu / 2;
  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.fillRect(sol, 218, kutu, 44);
  ctx.strokeStyle = renk;
  ctx.lineWidth = 3;
  ctx.strokeRect(sol, 218, kutu, 44);
  ctx.fillStyle = renk;
  ctx.fillText(yazi, GAME_WIDTH / 2, 241);
  ctx.restore();
}

function mesajAlfa(t, bas, sure) {
  const a = t - bas;
  if (a < 0 || a > sure) return 0;
  if (a < 0.06) return a / 0.06;
  if (a > sure - 0.22) return (sure - a) / 0.22;
  return 1;
}

function ad(ctx, t, oyuncu) {
  if (t < 6.7 || t > 9.15) return;
  const giris = clamp((t - 6.7) / 0.16, 0, 1);
  ctx.save();
  ctx.globalAlpha = giris;
  ctx.font = '15px "Press Start 2P"';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const yazi = "GİZEL ÖRGEN";
  const w = ctx.measureText(yazi).width;
  const x = oyuncu.x;
  const y = oyuncu.y - 22 * PLAYER.spriteScale - 28;
  ctx.fillStyle = "#05050c";
  ctx.fillRect(x - w / 2 - 12, y - 16, w + 24, 32);
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText(yazi, x, y);
  ctx.restore();
}

/**
 * Bir kareyi `t` saniyesinde çizer. Önceki kareye bağlı değildir.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} t
 */
export function ciz(ctx, t) {
  const zaman = Number.isFinite(t) ? t : 0;
  const top = topKonum(zaman);
  const ev = gizel(zaman);
  const rakip = atlas(zaman);
  const cam = kamera(zaman, top);
  const sar = sarsinti(zaman);
  const sayiOldu = zaman >= SAYI;
  const hype = sayiOldu ? clamp((zaman - SAYI) / 0.4, 0, 1) : 0;
  const temas =
    zaman < KURTARIS
      ? { side: "away", count: 1 }
      : zaman < SMAÇ
        ? { side: "home", count: 1 }
        : zaman < SAYI
          ? { side: "home", count: 2 }
          : { side: "home", count: 0 };

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(
    cam.s,
    0,
    0,
    cam.s,
    GAME_WIDTH / 2 - cam.cx * cam.s + sar.x,
    GAME_HEIGHT / 2 - cam.cy * cam.s + sar.y,
  );

  drawArena(
    ctx,
    zaman,
    hype,
    { home: sayiOldu ? 22 : 21, away: 20 },
    temas,
  );
  drawFloor(ctx);

  const topYuksek = Math.max(0, GROUND_Y - top.y);
  golge(ctx, top.x, GROUND_Y, 16 * Math.max(0.35, 1 - topYuksek / 500));
  cizOyuncu(ctx, rakip);
  cizOyuncu(ctx, ev);
  drawNet(ctx, GROUND_Y);

  cizIz(ctx, zaman, top);
  drawBall(ctx, {
    x: top.x,
    y: top.y,
    radius: 13,
    rotation: zaman * 7 + top.x * 0.02,
    flaming: zaman >= SMAÇ && zaman <= SAYI ? 1 : 0,
  });

  const vur = (an) => topKonum(an);
  parcacik(ctx, zaman, KURTARIS, vur(KURTARIS).x, vur(KURTARIS).y, "#9BE7FF", 10, 0.45);
  parcacik(ctx, zaman, SMAÇ, vur(SMAÇ).x, vur(SMAÇ).y, "#FFD24A", 12, 0.4);
  parcacik(ctx, zaman, SAYI, vur(SAYI).x, vur(SAYI).y, "#E30A17", 14, 0.55);

  const kurtaris = mesajAlfa(zaman, KURTARIS, 0.85);
  if (kurtaris > 0) mesaj(ctx, "KURTARIŞ!", "#9BE7FF", kurtaris);
  const sayi = mesajAlfa(zaman, SAYI, 1.05);
  if (sayi > 0) mesaj(ctx, "SAYI!", PALETTE.gold, sayi);

  ad(ctx, zaman, ev);
  ctx.restore();
}
