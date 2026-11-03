/**
 * Tanıtım sahnesi — oyunun kendi çizim kodu, zamanın fonksiyonu.
 *
 * Top, oyunun yerçekimiyle (1150 px/s²) uçar. Fileyi aşan her
 * yayda merkez, bantın üstünde kalır; bant y=270, top yarıçapı 13.
 * Pano yazısının altı y=212; topun tepesi oraya binmez.
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

const G = 1150;
const TOP_R = 13;
const BANT = 270;
const EL = 16;
const DALIS = 44;
const RAKIP_EL = 38;

/**
 * Yerçekimli yaylar. Uçlar birbirine değer; aradaki boşlukta
 * top elde ya da yerdedir.
 */
const YAY = [
  { ad: "ust", t0: 0, t1: 0.26, x0: 470, y0: 236, x1: 418, y1: 240, duz: true },
  { ad: "gelis", t0: 0.26, t1: 0.62, x0: 418, y0: 240, x1: 308, y1: 388 },
  { ad: "pas", t0: 0.62, t1: 1.16, x0: 308, y0: 388, x1: 360, y1: 240 },
  { ad: "hucum", t0: 1.16, t1: 1.66, x0: 360, y0: 240, x1: 708, y1: 342 },
  { ad: "donus", t0: 1.66, t1: 2.16, x0: 708, y0: 342, x1: 356, y1: 240 },
  { ad: "smac", t0: 2.16, t1: 2.8, x0: 356, y0: 240, x1: 774, y1: 407 },
  { ad: "atis", t0: 5.42, t1: 5.8, x0: 328, y0: 356, x1: 348, y1: 240 },
  { ad: "servis", t0: 5.8, t1: 6.3, x0: 348, y0: 240, x1: 706, y1: 340 },
  { ad: "donus2", t0: 6.3, t1: 6.8, x0: 706, y0: 340, x1: 352, y1: 242 },
  { ad: "final", t0: 6.8, t1: 7.3, x0: 352, y0: 242, x1: 698, y1: 346 },
];

const yay = (ad) => YAY.find((s) => s.ad === ad);
const UST = yay("ust");
const GELIS = yay("gelis");
const PAS = yay("pas");
const HUCUM = yay("hucum");
const DONUS = yay("donus");
const SMAC = yay("smac");
const ATIS = yay("atis");
const SERVIS = yay("servis");
const DONUS2 = yay("donus2");
const FINAL = yay("final");

const SAYI = SMAC.t1;
const ELDE = 4.95;
const ZOOM = FINAL.t0 + 0.16;

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
  if (t1 <= t0) return t >= t1 ? 1 : 0;
  return clamp((t - t0) / (t1 - t0), 0, 1);
}

function fizik(seg, t) {
  const T = seg.t1 - seg.t0;
  const tt = clamp(t, seg.t0, seg.t1) - seg.t0;
  const vx = (seg.x1 - seg.x0) / T;
  if (seg.duz) {
    const vy = (seg.y1 - seg.y0) / T;
    return { x: seg.x0 + vx * tt, y: seg.y0 + vy * tt, vx, vy };
  }
  const vy0 = (seg.y1 - seg.y0 - 0.5 * G * T * T) / T;
  return {
    x: seg.x0 + vx * tt,
    y: seg.y0 + vy0 * tt + 0.5 * G * tt * tt,
    vx,
    vy: vy0 + G * tt,
  };
}

function elde(t) {
  const u = yumusak(parca(t, ELDE, ATIS.t0));
  return {
    x: lerp(250, ATIS.x0, u),
    y: lerp(364, ATIS.y0, u),
    vx: 0,
    vy: 0,
  };
}

export function topKonum(t) {
  if (t >= SAYI && t < ELDE) return { x: SMAC.x1, y: SMAC.y1, vx: 0, vy: 0 };
  if (t >= ELDE && t < ATIS.t0) return elde(t);
  for (let i = YAY.length - 1; i >= 0; i -= 1) {
    if (t >= YAY[i].t0) return fizik(YAY[i], t);
  }
  return fizik(UST, UST.t0);
}

function zipla(t, t0, t1, h) {
  const u = parca(t, t0, t1);
  if (u <= 0 || u >= 1) return 0;
  return Math.sin(u * Math.PI) * h;
}

function gizel(t) {
  const dig = topKonum(GELIS.t1);
  const pas = topKonum(PAS.t1);
  const bitir = topKonum(SMAC.t0);
  const servis = topKonum(SERVIS.t0);
  const son = topKonum(FINAL.t0);
  const el = elde(t);

  let x = 210;
  let y = GROUND_Y;
  let pose = "run";

  if (t < GELIS.t1 - 0.05) {
    x = lerp(210, dig.x - DALIS, yumusak(parca(t, 0, GELIS.t1 - 0.05)));
    pose = "run";
  } else if (t < GELIS.t1 + 0.1) {
    x = dig.x - DALIS;
    pose = "dive";
  } else if (t < PAS.t1 - 0.2) {
    x = lerp(dig.x - DALIS, pas.x - EL, yumusak(parca(t, GELIS.t1 + 0.14, PAS.t1 - 0.2)));
    pose = "run";
  } else if (t < PAS.t1 + 0.24) {
    x = pas.x - EL;
    y = GROUND_Y - zipla(t, PAS.t1 - 0.2, PAS.t1 + 0.24, 112);
    pose = t < PAS.t1 + 0.08 ? "spike" : "jump";
  } else if (t < SMAC.t0 - 0.2) {
    x = lerp(pas.x - EL, bitir.x - EL, yumusak(parca(t, PAS.t1 + 0.24, SMAC.t0 - 0.2)));
    pose = "run";
  } else if (t < SAYI) {
    x = bitir.x - EL;
    const kalk = SMAC.t0 - 0.18;
    const inis = SMAC.t0 + 0.28;
    y = GROUND_Y - zipla(t, kalk, inis, 112);
    pose = t < SMAC.t0 + 0.1 ? "spike" : t < inis ? "jump" : "idle";
  } else if (t < ELDE) {
    x = lerp(bitir.x - EL, 236, yumusak(parca(t, SAYI, SAYI + 0.7)));
    pose = "cheer";
  } else if (t < ATIS.t0) {
    x = el.x - EL;
    pose = "run";
  } else if (t < SERVIS.t0 + 0.22) {
    x = servis.x - EL;
    y = GROUND_Y - zipla(t, SERVIS.t0 - 0.2, SERVIS.t0 + 0.22, 112);
    pose = "spike";
  } else if (t < FINAL.t0 - 0.18) {
    x = lerp(servis.x - EL, son.x - EL, yumusak(parca(t, SERVIS.t0 + 0.22, FINAL.t0 - 0.18)));
    pose = "run";
  } else if (t < FINAL.t1) {
    x = son.x - EL;
    y = GROUND_Y - zipla(t, FINAL.t0 - 0.18, FINAL.t0 + 0.22, 112);
    pose = "spike";
  } else {
    x = son.x - EL;
    pose = "idle";
  }

  return {
    data: GIZEL,
    x,
    y,
    pose,
    facing: 1,
    frame: (t * (pose === "run" ? 7.5 : 2.4)) % 1,
  };
}

function atlas(t) {
  const hucum = topKonum(HUCUM.t1);
  const servis = topKonum(SERVIS.t1);
  let x = 640;
  let y = GROUND_Y;
  let pose = "idle";

  if (t < 0.22) {
    x = 628;
    y = GROUND_Y - zipla(t, -0.12, 0.34, 96);
    pose = "spike";
  } else if (t < HUCUM.t1 - 0.28) {
    x = lerp(620, hucum.x + RAKIP_EL, yumusak(parca(t, 0.22, HUCUM.t1 - 0.28)));
    pose = t < 0.42 ? "jump" : "run";
  } else if (t < HUCUM.t1 + 0.14) {
    x = hucum.x + RAKIP_EL;
    y = GROUND_Y - zipla(t, HUCUM.t1 - 0.16, HUCUM.t1 + 0.14, 44);
    pose = "bump";
  } else if (t < SERVIS.t0) {
    x = lerp(hucum.x + RAKIP_EL, 690, yumusak(parca(t, HUCUM.t1 + 0.16, HUCUM.t1 + 0.55)));
    pose = "idle";
  } else if (t < SERVIS.t1 - 0.16) {
    x = lerp(690, servis.x + RAKIP_EL, yumusak(parca(t, SERVIS.t0, SERVIS.t1 - 0.16)));
    pose = "run";
  } else if (t < SERVIS.t1 + 0.14) {
    x = servis.x + RAKIP_EL;
    y = GROUND_Y - zipla(t, SERVIS.t1 - 0.16, SERVIS.t1 + 0.14, 44);
    pose = "bump";
  } else {
    x = servis.x + RAKIP_EL - 20;
    pose = "idle";
  }

  return {
    data: ATLAS,
    x,
    y,
    pose,
    facing: -1,
    frame: (t * (pose === "run" ? 7.5 : 0)) % 1,
  };
}

function cekim(t) {
  const plan = [
    { t: 0, s: 1.88, cx: 448, cy: 258, whip: 0 },
    { t: GELIS.t0 + 0.1, s: 1.6, cx: 320, cy: 342, whip: 0.1 },
    { t: PAS.t1 - 0.12, s: 1.42, cx: 400, cy: 286, whip: 0.1 },
    { t: HUCUM.t0 + 0.04, s: 1.72, cx: 470, cy: 256, whip: 0.09 },
    { t: HUCUM.t1 - 0.12, s: 1.36, cx: 690, cy: 330, whip: 0.1 },
    { t: SMAC.t0, s: 1.06, cx: 470, cy: 300, whip: 0.1 },
    { t: SAYI + 0.62, s: 3.05, cx: 156, cy: 278, whip: 0.13 },
    { t: SAYI + 1.45, s: 1.52, cx: 270, cy: 330, whip: 0.12 },
    { t: ELDE, s: 1.24, cx: 390, cy: 296, whip: 0.12 },
    { t: SERVIS.t0, s: 1.7, cx: 490, cy: 262, whip: 0.1 },
    { t: FINAL.t0, s: 1.4, cx: 460, cy: 276, whip: 0.1 },
  ];

  let i = 0;
  for (let k = 1; k < plan.length; k += 1) {
    if (t >= plan[k].t) i = k;
  }
  const simdi = plan[i];
  const once = plan[Math.max(0, i - 1)];
  let s = simdi.s;
  let cx = simdi.cx;
  let cy = simdi.cy;
  const whip = simdi.whip;
  if (whip > 0 && t < simdi.t + whip) {
    const k = 1 - (1 - (t - simdi.t) / whip) ** 3;
    s = lerp(once.s, simdi.s, k);
    cx = lerp(once.cx, simdi.cx, k);
    cy = lerp(once.cy, simdi.cy, k);
  }

  if (t >= ZOOM) {
    const u = clamp((t - ZOOM) / 0.36, 0, 1);
    const e = u * u;
    const top = topKonum(t);
    s = lerp(s, 12, e);
    cx = lerp(cx, top.x, Math.min(1, e + 0.35));
    cy = lerp(cy, top.y + 8, Math.min(1, e + 0.35));
  }

  const gorunenW = GAME_WIDTH / s;
  const gorunenH = GAME_HEIGHT / s;
  cx = clamp(cx, gorunenW / 2, GAME_WIDTH - gorunenW / 2);
  cy = clamp(cy, gorunenH / 2, GAME_HEIGHT - gorunenH / 2);
  return { s, cx, cy };
}

function sarsinti(t) {
  const vuruslar = [
    [GELIS.t1, 2.4, 0.08],
    [PAS.t1, 3.2, 0.07],
    [HUCUM.t1, 2.2, 0.07],
    [SMAC.t1, 5.2, 0.1],
    [SERVIS.t0, 2.6, 0.06],
    [FINAL.t0, 3.4, 0.07],
  ];
  let x = 0;
  let y = 0;
  for (let i = 0; i < vuruslar.length; i += 1) {
    const [t0, gen, sure] = vuruslar[i];
    const a = t - t0;
    if (a < 0 || a > sure) continue;
    const d = 1 - a / sure;
    x += Math.sin(a * 120) * gen * d;
    y += Math.sin(a * 90 + 1.3) * gen * 0.45 * d;
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
  const gen =
    oyuncu.pose === "dive"
      ? 46
      : 30 * (1 - clamp((GROUND_Y - oyuncu.y) / 170, 0, 1) * 0.45);
  golge(ctx, oyuncu.x, GROUND_Y, gen);

  let sx = 1;
  let sy = 1;
  if (havada && oyuncu.pose !== "dive") {
    sy = 1.06;
    sx = 0.96;
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

function cizIz(ctx, top) {
  if (Math.abs(top.vx) < 480) return;
  for (let i = 4; i >= 1; i -= 1) {
    const dt = i * 0.01;
    const oran = i / 5;
    ctx.globalAlpha = (1 - oran) * 0.4;
    ctx.fillStyle = "#FFC633";
    const boy = 16 * (1 - oran);
    const x = top.x - top.vx * dt;
    const y = top.y - top.vy * dt;
    ctx.fillRect(x - boy / 2, y - boy / 2, boy, boy);
  }
  ctx.globalAlpha = 1;
}

function parcacik(ctx, t, t0, x, y, renk, adet, sure) {
  const yas = t - t0;
  if (yas < 0 || yas > sure) return;
  const omur = 1 - yas / sure;
  for (let i = 0; i < adet; i += 1) {
    const aci = (i / adet) * Math.PI * 2 + i * 0.37;
    const hiz = 90 + (i % 4) * 48;
    const px = x + Math.cos(aci) * hiz * yas;
    const py = y + Math.sin(aci) * hiz * yas + 260 * yas * yas;
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
  if (a < 0.05) return a / 0.05;
  if (a > sure - 0.16) return (sure - a) / 0.16;
  return 1;
}

function ad(ctx, t, oyuncu) {
  if (t < SAYI + 1.5 || t > ELDE - 0.05) return;
  const giris = clamp((t - (SAYI + 1.5)) / 0.12, 0, 1);
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

function perde(ctx, t) {
  const kesmeler = [SAYI + 0.62, SAYI + 1.45, ELDE];
  const vuruslar = [
    [GELIS.t1, "#9BE7FF", 0.05, 0.18],
    [PAS.t1, "#FFD24A", 0.045, 0.2],
    [SMAC.t1, "#E30A17", 0.05, 0.18],
    [SERVIS.t0, "#FFD24A", 0.04, 0.16],
    [FINAL.t0, "#FFD24A", 0.045, 0.2],
  ];
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < kesmeler.length; i += 1) {
    const a = t - kesmeler[i];
    if (a < 0 || a > 0.08) continue;
    ctx.globalAlpha = (1 - a / 0.08) * 0.5;
    ctx.fillStyle = "#0b0b12";
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }
  for (let i = 0; i < vuruslar.length; i += 1) {
    const [t0, renk, sure, guc] = vuruslar[i];
    const a = t - t0;
    if (a < 0 || a > sure) continue;
    ctx.globalAlpha = (1 - a / sure) * guc;
    ctx.fillStyle = renk;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }
  ctx.restore();
}

function temas(t) {
  if (t < GELIS.t1) return { side: "away", count: 1 };
  if (t < PAS.t1) return { side: "home", count: 2 };
  if (t < HUCUM.t1) return { side: "home", count: 3 };
  if (t < DONUS.t1) return { side: "away", count: 1 };
  if (t < SAYI) return { side: "home", count: 1 };
  if (t < SERVIS.t0) return { side: "home", count: 0 };
  if (t < SERVIS.t1) return { side: "home", count: 1 };
  if (t < DONUS2.t1) return { side: "away", count: 1 };
  return { side: "home", count: 1 };
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
  const cam = cekim(zaman);
  const sar = sarsinti(zaman);
  const sayiOldu = zaman >= SAYI;
  const hype = sayiOldu ? clamp((zaman - SAYI) / 0.28, 0, 1) : 0;

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

  drawArena(ctx, zaman, hype, { home: sayiOldu ? 22 : 21, away: 20 }, temas(zaman));
  drawFloor(ctx);

  const topYuksek = Math.max(0, GROUND_Y - top.y);
  golge(ctx, top.x, GROUND_Y, 16 * Math.max(0.35, 1 - topYuksek / 500));
  cizOyuncu(ctx, rakip);
  cizOyuncu(ctx, ev);
  drawNet(ctx, GROUND_Y);
  cizIz(ctx, top);
  drawBall(ctx, {
    x: top.x,
    y: top.y,
    radius: TOP_R,
    rotation: zaman * 14 + top.x * 0.02,
    flaming: Math.abs(top.vx) > 620 ? 1 : 0,
  });

  const vur = (an) => topKonum(an);
  parcacik(ctx, zaman, GELIS.t1, vur(GELIS.t1).x, vur(GELIS.t1).y, "#9BE7FF", 8, 0.28);
  parcacik(ctx, zaman, PAS.t1, vur(PAS.t1).x, vur(PAS.t1).y, "#FFD24A", 8, 0.22);
  parcacik(ctx, zaman, SMAC.t1, vur(SMAC.t1).x, vur(SMAC.t1).y, "#E30A17", 10, 0.32);
  parcacik(ctx, zaman, FINAL.t0, vur(FINAL.t0).x, vur(FINAL.t0).y, "#FFD24A", 8, 0.22);

  const kurtaris = mesajAlfa(zaman, GELIS.t1, 0.42);
  if (kurtaris > 0) mesaj(ctx, "KURTARIŞ!", "#9BE7FF", kurtaris);
  const sayi = mesajAlfa(zaman, SAYI, 0.58);
  if (sayi > 0) mesaj(ctx, "SAYI!", PALETTE.gold, sayi);

  ad(ctx, zaman, ev);
  ctx.restore();
  perde(ctx, zaman);
}

/**
 * Yayların file ve pano payını ölçer. Çizimden bağımsız.
 * @returns {{ok: boolean, rapor: object[]}}
 */
export function denetle() {
  const rapor = [];
  let ok = true;
  for (const seg of YAY) {
    const T = seg.t1 - seg.t0;
    let minY = 1e9;
    let yOrta = null;
    let yKenar = -1;
    const gecer = seg.x0 < 450 !== seg.x1 < 450 || (seg.x0 > 410 && seg.x0 < 490);
    for (let i = 0; i <= 180; i += 1) {
      const p = fizik(seg, seg.t0 + (T * i) / 180);
      minY = Math.min(minY, p.y);
      if (p.x > 408 && p.x < 492) yKenar = Math.max(yKenar, p.y);
      if (Math.abs(p.x - 450) < 14) yOrta = p.y;
    }
    const pano = minY - TOP_R < 214;
    const file =
      gecer &&
      ((yOrta != null && yOrta + TOP_R > BANT - 12) || (yKenar > 0 && yKenar + TOP_R > BANT - 4));
    if (pano || file) ok = false;
    const hiz = Math.hypot((seg.x1 - seg.x0) / T, (seg.y1 - seg.y0) / T);
    rapor.push({
      ad: seg.ad,
      hiz: Math.round(hiz),
      minY: Math.round(minY),
      pay: yOrta == null ? null : Math.round(BANT - (yOrta + TOP_R)),
      pano,
      file,
    });
  }
  return { ok, rapor };
}
