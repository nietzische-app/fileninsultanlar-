/**
 * Eğitim sürükleme döngüsü — saf matematik.
 *
 * Ekran her karede burayı okur; parmak ve tuş aynı eğride yürür.
 * Ayrık tutmanın sebebi: tarayıcıda rAF varken birim testte `now`
 * verip konumu sınayabilmek.
 */

export const TUT_PERIOD_MS = 2800;
/** Oyuncu bu kadar px sürüklediyse "denedi" sayılır. */
export const TUT_DRAG_PX = 28;

/** @param {number} t 0–1 */
export function easeInOut(t) {
  const x = Math.max(0, Math.min(1, Number(t) || 0));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Bir döngünün o andaki hali.
 *
 * nx/ny: 0 = tuşun durduğu yer, 1 = sürükleme hedefi.
 * press/finger: 0–1 görünürlük ve basış.
 *
 * @param {number} now
 * @param {number} [period]
 */
export function tutDongu(now, period = TUT_PERIOD_MS) {
  const per = Math.max(1, period);
  const p = (((now % per) + per) % per) / per;

  if (p < 0.12) return { nx: 0, ny: 0, press: 0, finger: 0 };
  if (p < 0.2) {
    const t = (p - 0.12) / 0.08;
    return { nx: 0, ny: 0, press: t, finger: t };
  }
  if (p < 0.58) {
    const t = easeInOut((p - 0.2) / 0.38);
    return { nx: t, ny: t, press: 1, finger: 1 };
  }
  if (p < 0.7) return { nx: 1, ny: 1, press: 1, finger: 1 };
  if (p < 0.82) {
    const t = (p - 0.7) / 0.12;
    return { nx: 1, ny: 1, press: 1 - t, finger: 1 - t };
  }
  return { nx: 0, ny: 0, press: 0, finger: 0 };
}

/**
 * @param {{ nx: number, ny: number }} dongu
 * @param {{ x: number, y: number }} start
 * @param {{ x: number, y: number }} end
 */
export function tutKonum(dongu, start, end) {
  return {
    x: lerp(start.x, end.x, dongu.nx),
    y: lerp(start.y, end.y, dongu.ny),
  };
}

export function yeterinceSuruklendi(dx, dy, min = TUT_DRAG_PX) {
  return Math.hypot(Number(dx) || 0, Number(dy) || 0) >= min;
}

/**
 * Tuş playground dışına çıkmasın.
 * @param {number} x
 * @param {number} y
 * @param {number} pad
 * @param {number} genislik
 * @param {number} yukseklik
 */
export function padSinirla(x, y, pad, genislik, yukseklik) {
  const w = Math.max(0, genislik - pad);
  const h = Math.max(0, yukseklik - pad);
  return {
    x: Math.max(0, Math.min(w, x)),
    y: Math.max(0, Math.min(h, y)),
  };
}
