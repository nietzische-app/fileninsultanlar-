/**
 * Küçük sayısal yardımcılar — motor ve balistik ortak kullanır.
 */

/** Bir değeri aralığa sıkıştırır. */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
