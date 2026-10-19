/**
 * Küçük piksel-sanat çizim kütüphanesi.
 *
 * İkonlar 64x64 hücrelik bir ızgaraya çizilir ve 8x büyütülür (512 px).
 * Böylece her "piksel" tam 8x8 olur: kenarlar keskin, yumuşatma yok.
 * Rastgelelik yok — `hash` sabit tohumlu, aynı girdi aynı ikon.
 */

export type Color = string | null;
export type Grid = {n: number; cells: Color[]};

export const makeGrid = (n: number, fill: Color = null): Grid => ({
  n,
  cells: new Array<Color>(n * n).fill(fill),
});

export const inside = (g: Grid, x: number, y: number) =>
  x >= 0 && y >= 0 && x < g.n && y < g.n;

export const get = (g: Grid, x: number, y: number): Color =>
  inside(g, x, y) ? g.cells[y * g.n + x] : null;

export const set = (g: Grid, x: number, y: number, c: Color) => {
  x = Math.floor(x);
  y = Math.floor(y);
  if (inside(g, x, y)) g.cells[y * g.n + x] = c;
};

export const rect = (g: Grid, x: number, y: number, w: number, h: number, c: Color) => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(g, x + i, y + j, c);
};

export const disc = (g: Grid, cx: number, cy: number, r: number, c: Color) => {
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r * r) set(g, x, y, c);
    }
  }
};

export const ellipse = (g: Grid, cx: number, cy: number, rx: number, ry: number, c: Color) => {
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) set(g, x, y, c);
    }
  }
};

/** Kalın çizgi: iki uç arasında yarıçaplı yuvarlak fırça. */
export const line = (
  g: Grid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  thick: number,
  c: Color | ((t: number) => Color),
) => {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
  for (let s = 0; s <= steps; s++) {
    const t = steps === 0 ? 0 : s / steps;
    const col = typeof c === 'function' ? c(t) : c;
    disc(g, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, thick / 2, col);
  }
};

/** Deterministik 0..1 gürültü. */
export const hash = (x: number, y: number, seed = 1) => {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 10000) / 10000;
};

/** `layer`ın dolu piksellerinin dışına 4-komşu kontur çizer (ayrı katman döner). */
export const outlineOf = (layer: Grid, color: string): Grid => {
  const out = makeGrid(layer.n);
  for (let y = 0; y < layer.n; y++) {
    for (let x = 0; x < layer.n; x++) {
      if (get(layer, x, y)) continue;
      if (get(layer, x - 1, y) || get(layer, x + 1, y) || get(layer, x, y - 1) || get(layer, x, y + 1)) {
        set(out, x, y, color);
      }
    }
  }
  return out;
};

/** `top`taki dolu pikselleri `base`in üstüne yazar. */
export const stamp = (base: Grid, top: Grid) => {
  for (let i = 0; i < top.cells.length; i++) {
    const c = top.cells[i];
    if (c) base.cells[i] = c;
  }
};

/** Her satırdaki aynı renkli ardışık hücreleri tek dikdörtgene birleştirir. */
export const toRuns = (g: Grid) => {
  const runs: {x: number; y: number; w: number; c: string}[] = [];
  for (let y = 0; y < g.n; y++) {
    let x = 0;
    while (x < g.n) {
      const c = g.cells[y * g.n + x];
      if (!c) {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < g.n && g.cells[y * g.n + x + w] === c) w++;
      runs.push({x, y, w, c});
      x += w;
    }
  }
  return runs;
};
