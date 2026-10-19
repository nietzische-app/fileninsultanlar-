import {
  type Grid,
  disc,
  ellipse,
  hash,
  line,
  makeGrid,
  outlineOf,
  rect,
  set,
  stamp,
} from './pixel';

/** Oyunun kendi paleti (`src/game/constants.js` PALETTE) ile aynı tonlar. */
export const C = {
  night: '#0B0B12',
  outline: '#15121A',
  red: '#E30A17',
  redDark: '#9E0710',
  redDeep: '#5C070D',
  court: '#8E1018',
  orange: '#FF7A18',
  gold: '#FFD24A',
  goldDark: '#D99A1E',
  goldDeep: '#8A5A10',
  white: '#FFFFFF',
  whiteShade: '#CFD3E6',
  blue: '#1B4FE0',
  blueDark: '#12358F',
  flame: ['#FFF3A0', '#FFC633', '#FF7A18', '#E30A17'],
  skin: '#F2B891',
  skinShade: '#D98F68',
  hair: '#3A2216',
  hairLight: '#5A3A24',
};

export const N = 64;

type BallColors = {a: string; aDark: string; b: string; bDark: string};
export const BALL_RED_BLUE: BallColors = {a: C.red, aDark: C.redDark, b: C.blue, bDark: C.blueDark};
export const BALL_RED_GOLD: BallColors = {a: '#FF2A3D', aDark: C.redDark, b: C.gold, bDark: C.goldDark};

/** Voleybol topu: beyaz zemin, iki renkli kavisli şerit, sağ-alt gölge, sol-üst parlama. */
export function drawBall(g: Grid, cx: number, cy: number, r: number, colors: BallColors, angle = -0.6) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy > r * r) continue;
      const rx = dx * cos + dy * sin;
      const ry = -dx * sin + dy * cos;
      const t = (ry + (0.32 * rx * rx) / r) / r;
      const shaded = dx * 0.7 + dy * 0.7 > r * 0.45;
      let col: string;
      if (t > -0.58 && t < -0.24) col = shaded ? colors.aDark : colors.a;
      else if (t > 0.26 && t < 0.6) col = shaded ? colors.bDark : colors.b;
      else col = shaded ? C.whiteShade : C.white;
      set(g, x, y, col);
    }
  }
  // parlama
  const hx = Math.floor(cx - r * 0.45);
  const hy = Math.floor(cy - r * 0.55);
  set(g, hx, hy, C.white);
  set(g, hx + 1, hy, C.white);
  set(g, hx, hy + 1, C.white);
}

/** Topu kendi konturuyla birlikte tuvale çizer. */
export function stampBall(g: Grid, cx: number, cy: number, r: number, colors: BallColors, angle?: number) {
  const layer = makeGrid(g.n);
  drawBall(layer, cx, cy, r, colors, angle);
  stamp(g, outlineOf(layer, C.outline));
  stamp(g, layer);
}

/** Dört uçlu parıltı (artı biçimli). */
export function sparkle(g: Grid, x: number, y: number, size: number, color: string, core = C.white) {
  for (let i = 1; i <= size; i++) {
    set(g, x - i, y, color);
    set(g, x + i, y, color);
    set(g, x, y - i, color);
    set(g, x, y + i, color);
  }
  set(g, x, y, core);
}

/** Bayer 2x2 titreşimli iki ton karışımı — bantlar arası geçiş için. */
const bayer = (x: number, y: number) => [0, 2, 3, 1][(y % 2) * 2 + (x % 2)] / 4;

/** Dikey bant degradesi: `stops` renkleri üst→alt; geçişlerde titreşim. */
export function bandedGradient(g: Grid, stops: string[], from = 0, to = g.n) {
  const span = (to - from) / stops.length;
  for (let y = from; y < to; y++) {
    const f = (y - from) / span;
    const i = Math.min(stops.length - 1, Math.floor(f));
    const frac = f - i;
    for (let x = 0; x < g.n; x++) {
      const next = Math.min(stops.length - 1, i + 1);
      const useNext = frac > 0.72 && bayer(x, y) < (frac - 0.72) / 0.28;
      set(g, x, y, stops[useNext ? next : i]);
    }
  }
}

// ---------------------------------------------------------------------
// 1) Alevli top
// ---------------------------------------------------------------------
export function drawFlamingBall(): Grid {
  const g = makeGrid(N);
  bandedGradient(g, ['#060A22', '#0A1238', '#0F1B54', '#16287A', '#1E3496']);

  // uzak yıldızlar / salon ışıkları
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(hash(i, 1, 7) * N);
    const y = Math.floor(hash(i, 2, 7) * 40);
    set(g, x, y, i % 4 === 0 ? '#9FB4FF' : '#3A4FB0');
  }

  // arka planda file: üst bant + ağ + direk
  const netTop = 49;
  for (let y = netTop; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const mesh = (x % 4 === 0 || y % 4 === (netTop + 1) % 4) && y > netTop + 1;
      set(g, x, y, mesh ? '#3F58C8' : '#101C5E');
    }
  }
  rect(g, 0, netTop, N, 2, '#C9D2FF');
  rect(g, 56, netTop - 9, 3, N - netTop + 9, '#8E9AD0');
  rect(g, 56, netTop - 9, 1, N - netTop + 9, '#C9D2FF');

  // alev: top merkezinden sağ-üste doğru
  const bx = 25;
  const by = 38;
  const R = 11;
  const dirx = 0.74;
  const diry = -0.67;
  const L = 50;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = x + 0.5 - bx;
      const dy = y + 0.5 - by;
      const u = dx * dirx + dy * diry;
      const v = -dx * diry + dy * dirx;
      if (u < -3) continue;
      const k = Math.max(0, 1 - u / L);
      const noise = hash(Math.floor(u / 2.5), Math.floor(v / 2.5), 3);
      const tongue = 0.72 + noise * 0.55 + 0.18 * Math.sin(u * 0.45 + v * 0.05);
      const w = (R + 3) * Math.pow(k, 0.85) * tongue;
      if (Math.abs(v) >= w) continue;
      const q = Math.abs(v) / Math.max(w, 1) + (u / L) * 0.55 + (noise - 0.5) * 0.18;
      const col = q < 0.22 ? C.flame[0] : q < 0.48 ? C.flame[1] : q < 0.78 ? C.flame[2] : C.flame[3];
      set(g, x, y, col);
    }
  }

  // kıvılcımlar
  for (let i = 0; i < 22; i++) {
    const t = 8 + hash(i, 5, 11) * 46;
    const off = (hash(i, 6, 11) - 0.5) * 30 * (1 - t / 70);
    const x = Math.floor(bx + dirx * t - off * diry);
    const y = Math.floor(by + diry * t + off * dirx);
    set(g, x, y, i % 3 === 0 ? C.flame[0] : i % 3 === 1 ? C.flame[1] : C.flame[2]);
  }

  stampBall(g, bx, by, R, BALL_RED_BLUE, -0.55);
  return g;
}

// ---------------------------------------------------------------------
// 2) Smaç atan voleybolcu
// ---------------------------------------------------------------------
export function drawPlayerHero(): Grid {
  const g = makeGrid(N);

  // güneş ışınlı kırmızı zemin
  const cx = 30;
  const cy = 34;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const ang = Math.atan2(dy, dx) + Math.PI;
      const ray = Math.floor(ang / (Math.PI / 9)) % 2 === 0;
      const dist = Math.hypot(dx, dy);
      const ring = dist < 20 ? 0 : dist < 36 ? 1 : 2;
      const pal = [
        ['#F23A2A', '#E3202A'],
        ['#D90B18', '#C20915'],
        ['#A8070F', '#8E050C'],
      ][ring];
      set(g, x, y, pal[ray ? 0 : 1]);
    }
  }

  // altın ışıltılar
  sparkle(g, 9, 11, 3, C.gold);
  sparkle(g, 55, 26, 2, C.gold);
  sparkle(g, 8, 44, 2, C.gold);
  sparkle(g, 53, 52, 3, C.gold);
  sparkle(g, 18, 5, 1, C.gold);

  const fig = makeGrid(N);

  // atkı kuyruğu
  line(fig, 25, 15, 17, 17, 4, C.hair);
  line(fig, 17, 17, 10, 23, 3, C.hair);
  line(fig, 10, 23, 8, 29, 2, C.hairLight);

  // denge kolu (öne bükülü)
  line(fig, 24, 30, 17, 35, 4, C.skin);
  line(fig, 17, 35, 14, 29, 4, C.skin);
  disc(fig, 14, 28, 2.6, C.skin);

  // bacaklar (bükülü, zıplama)
  line(fig, 28, 50, 23, 57, 5, C.skin);
  line(fig, 23, 57, 27, 64, 5, C.skin);
  line(fig, 34, 50, 40, 56, 5, C.skin);
  line(fig, 40, 56, 36, 64, 5, C.skinShade);
  line(fig, 24, 59, 27, 64, 5, C.white);
  line(fig, 39, 58, 36, 64, 5, C.whiteShade);

  // şort
  for (let y = 43; y <= 52; y++) {
    const l = 23 + (y - 43) * 0.1;
    const r = 38 - (y - 43) * 0.1;
    rect(fig, Math.round(l), y, Math.round(r - l), 1, C.red);
  }
  rect(fig, 23, 43, 15, 1, C.redDark);

  // forma gövdesi
  for (let y = 26; y <= 43; y++) {
    const l = 22 + (y - 26) * 0.22;
    const r = 38 - (y - 26) * 0.22;
    rect(fig, Math.round(l), y, Math.round(r - l), 1, C.white);
    set(fig, Math.round(r) - 1, y, C.whiteShade);
    set(fig, Math.round(r) - 2, y, C.whiteShade);
    set(fig, Math.round(l), y, C.red);
  }
  // göğüste kırmızı şerit
  rect(fig, 23, 32, 14, 3, C.red);
  rect(fig, 23, 35, 14, 1, C.redDark);
  // yaka
  rect(fig, 27, 26, 6, 1, C.red);

  // boyun + baş
  rect(fig, 28, 22, 4, 5, C.skinShade);
  disc(fig, 30, 16, 7, C.skin);
  // saç (üst yarı + arka)
  for (let y = 8; y <= 17; y++) {
    for (let x = 22; x <= 38; x++) {
      const dx = x + 0.5 - 30;
      const dy = y + 0.5 - 16;
      if (dx * dx + dy * dy <= 49 && (y < 14 || dx < -2.5)) set(fig, x, y, C.hair);
    }
  }
  set(fig, 27, 10, C.hairLight);
  set(fig, 28, 10, C.hairLight);
  set(fig, 29, 9, C.hairLight);
  // kırmızı saç bandı
  rect(fig, 23, 13, 15, 2, C.red);
  rect(fig, 38, 13, 1, 2, C.redDark);
  // göz
  set(fig, 34, 17, C.outline);
  set(fig, 34, 18, C.outline);
  set(fig, 33, 20, C.skinShade);
  set(fig, 34, 20, C.skinShade);

  // vuruş kolu: yukarı, topa uzanıyor
  const sleeve = (t: number) => (t < 0.32 ? C.white : C.skin);
  line(fig, 36, 29, 44, 15, 5, sleeve);
  rect(fig, 36, 29, 3, 1, C.red);
  disc(fig, 45, 13, 3.4, C.skin);

  stamp(g, outlineOf(fig, C.outline));
  stamp(g, fig);

  // top + hareket çizgileri
  for (let i = 0; i < 3; i++) {
    line(g, 44 - i * 3, 5 + i * 3, 38 - i * 3, 5 + i * 3 - 1, 1, i === 0 ? C.gold : C.white);
  }
  stampBall(g, 50, 9, 6.2, BALL_RED_BLUE, -0.4);
  sparkle(g, 57, 4, 2, C.gold);
  return g;
}

// ---------------------------------------------------------------------
// 3) Minimal saha
// ---------------------------------------------------------------------
export function drawMinimalCourt(): Grid {
  const g = makeGrid(N);
  bandedGradient(g, ['#0B0B12', '#0F0F1C', '#14142A'], 0, 16);

  const farY = 13;
  const nearY = 62;
  const farL = 12;
  const farR = 52;
  const nearL = 0;
  const nearR = 64;
  const edge = (y: number) => {
    const t = (y - farY) / (nearY - farY);
    return {l: farL + (nearL - farL) * t, r: farR + (nearR - farR) * t};
  };

  for (let y = farY; y < N; y++) {
    const {l, r} = edge(y);
    const t = (y - farY) / (nearY - farY);
    for (let x = 0; x < N; x++) {
      if (x + 0.5 >= l && x + 0.5 <= r) {
        const band = Math.floor(t * 8) % 2 === 0;
        const col = t < 0.3 ? (band ? '#A31420' : '#9A121D') : t < 0.65 ? (band ? '#C8300F' : '#BE2C10') : band ? '#EC5412' : '#E34E12';
        set(g, x, y, col);
      } else set(g, x, y, '#1B1B30');
    }
  }

  const lineAt = (y: number) => {
    const {l, r} = edge(y);
    rect(g, Math.round(l), y, Math.round(r - l) + 1, 1, C.white);
  };
  for (let y = farY; y <= nearY; y++) {
    const {l, r} = edge(y);
    set(g, Math.round(l), y, C.white);
    set(g, Math.round(l) + 1, y, C.white);
    set(g, Math.round(r) - 1, y, C.white);
    set(g, Math.round(r), y, C.white);
  }
  lineAt(farY);
  lineAt(nearY - 1);
  lineAt(nearY);
  lineAt(27);
  lineAt(50);

  const mid = 38;
  const e = edge(mid);
  for (let y = mid + 1; y <= mid + 3; y++) {
    const ee = edge(y);
    for (let x = Math.round(ee.l) + 2; x < Math.round(ee.r) - 1; x++) set(g, x, y, y === mid + 1 ? '#5C070D' : '#7A0C14');
  }

  const netL = Math.round(e.l) - 4;
  const netR = Math.round(e.r) + 4;
  for (let y = 30; y <= mid; y++) {
    for (let x = netL; x <= netR; x++) set(g, x, y, (x + y) % 2 === 0 ? '#F2F2F2' : '#2A2A44');
  }
  rect(g, netL, 30, netR - netL + 1, 2, C.white);
  rect(g, netL, 28, 2, mid - 26, '#C9CBD6');
  rect(g, netR - 1, 28, 2, mid - 26, '#C9CBD6');
  rect(g, netL, 28, 1, mid - 26, C.white);
  rect(g, netR - 1, 28, 1, mid - 26, C.white);
  rect(g, netL, mid, netR - netL + 1, 1, '#9AA0B8');

  ellipse(g, 35, 27, 8, 1.6, '#5C070D');
  stampBall(g, 32, 19, 9, BALL_RED_BLUE, -0.5);
  return g;
}

// ---------------------------------------------------------------------
// 4) Arcade kalkan
// ---------------------------------------------------------------------
export function drawArcadeShield(): Grid {
  const g = makeGrid(N);
  const cx = 32;
  const cy = 34;

  // koyu gri zemin + neon kırmızı halo (bantlı)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 0.9);
      const checker = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0;
      let col = checker ? '#1B1B24' : '#17171F';
      if (d < 22) col = checker ? '#7A0E22' : '#6F0C1F';
      else if (d < 30) col = checker ? '#4A0D1E' : '#420B1A';
      else if (d < 38) col = checker ? '#2A1220' : '#25101C';
      set(g, x, y, col);
    }
  }

  const top = 8;
  const bottom = 60;
  const hwAt = (y: number) => {
    if (y < top) return -1;
    if (y <= 36) return 23;
    const t = (y - 36) / (bottom - 36);
    return 23 * Math.pow(1 - t, 0.8);
  };
  const shield = (x: number, y: number, inset: number) => {
    if (y < top + inset || y > bottom) return false;
    const chamfer = y - (top + inset) < 3 ? 3 - (y - (top + inset)) : 0;
    return Math.abs(x + 0.5 - cx) <= hwAt(y) - inset - chamfer * 0.7;
  };

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (!shield(x, y, 0)) continue;
      if (!shield(x, y, 1)) {
        set(g, x, y, C.outline);
      } else if (!shield(x, y, 4)) {
        const light = x + 0.5 < cx - 4 || y < top + 4;
        set(g, x, y, light ? C.gold : x + 0.5 > cx + 8 ? C.goldDeep : C.goldDark);
      } else if (!shield(x, y, 5)) {
        set(g, x, y, C.outline);
      } else {
        const upper = y < 33;
        if (upper) {
          const stripe = (x + y) % 8 < 2;
          set(g, x, y, stripe ? '#FF4A5A' : '#E3112A');
        } else {
          const stripe = (x - y + 64) % 8 < 2;
          set(g, x, y, stripe ? '#3A3A48' : '#2A2A35');
        }
      }
    }
  }
  // iç parlama
  for (let y = top + 6; y < top + 14; y++) set(g, 15 + (y - top - 6), y, '#FF8A96');

  // altın yıldızlar (kalkanın üstünde)
  const star = (x: number, y: number) => {
    sparkle(g, x, y, 2, C.gold, '#FFF3A0');
  };
  star(15, 5);
  star(32, 3);
  star(49, 5);

  stampBall(g, cx, 31, 11, BALL_RED_GOLD, -0.5);
  // topun etrafına altın halka
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - 31);
      if (d > 12.6 && d <= 14.2) set(g, x, y, C.gold);
    }
  }
  return g;
}

export const DRAWERS = {
  flaming: drawFlamingBall,
  hero: drawPlayerHero,
  court: drawMinimalCourt,
  shield: drawArcadeShield,
} as const;

export type IconVariant = keyof typeof DRAWERS;
