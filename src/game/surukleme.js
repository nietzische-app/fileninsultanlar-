/**
 * Serbest sürükleme — parmak sahada sağa/sola kayınca yön basılı sayılır.
 *
 * Ayrı bir eşik var çünkü parmak bastığı yerde bir iki piksel titrer;
 * eşik olmasa karakter her dokunuşta bir yana kaçardı. Eşik geçilince
 * yön, parmak kalkana kadar (ya da ters yöne dönene kadar) basılı kalır.
 * Bırakma kararı burada değil: parmak kalkınca çağıran her iki yönü de
 * kapatır.
 */

export const SURUKLEME = {
  /** Yönün açıldığı yatay kayma (px). */
  deadzone: 8,
  /** Yön açıkken kapanmak için inilmesi gereken pay. Titreme yönü kesmesin. */
  release: 4,
  /** Bu kadar aşağı kayınca dalış. Yön tuşundaki kaydırmayla aynı his. */
  dive: 26,
};

/**
 * @param {number} dx Başlangıca göre yatay kayma. Sağ pozitif.
 * @param {number} dy Başlangıca göre dikey kayma. Aşağı pozitif.
 * @param {{ left?: boolean, right?: boolean, dive?: boolean }} [onceki]
 * @returns {{ left: boolean, right: boolean, dive: boolean }}
 */
export function suruklemeGirdisi(dx, dy, onceki = {}) {
  const yatayAcik = Boolean(onceki.left || onceki.right);
  const esik = yatayAcik ? SURUKLEME.release : SURUKLEME.deadzone;
  let left = false;
  let right = false;
  if (Math.abs(dx) >= esik) {
    if (dx > 0) right = true;
    else left = true;
  }

  let dive = Boolean(onceki.dive);
  if (dy >= SURUKLEME.dive) dive = true;
  else if (dy < SURUKLEME.dive * 0.5) dive = false;

  return { left, right, dive };
}

/**
 * Çift oyunculuda sol yarı 1, sağ yarı 2. Tek oyunculuda hep 1.
 * @param {number} x Öğenin soluna göre
 * @param {number} width
 * @param {boolean} dual
 * @returns {'p1'|'p2'}
 */
export function yuvaSec(x, width, dual) {
  if (!dual || !(width > 0)) return 'p1';
  return x < width / 2 ? 'p1' : 'p2';
}
