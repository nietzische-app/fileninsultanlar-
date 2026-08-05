/**
 * Türkçe metin yardımcıları.
 */

/**
 * Türkçe kurallara göre büyük harfe çevirir.
 *
 * JavaScript'in varsayılan `toUpperCase()` metodu İngilizce eşlemesi
 * yapar: "Gizem" → "GIZEM" (noktasız I). Türkçede doğrusu "GİZEM"dir.
 * Oyunun arayüzü tamamen Türkçe olduğu için her yerde bu kullanılmalı.
 *
 * @param {string} value
 * @returns {string}
 */
export function upper(value) {
  return String(value ?? '').toLocaleUpperCase('tr-TR');
}
