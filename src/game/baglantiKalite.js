/**
 * Bağlantı kalitesi kademeleri.
 *
 * EŞİKLER UYDURULMADI, ÖLÇÜLDÜ.
 *
 * Genel ağ sezgisiyle ("100 ms iyidir") eşik seçmek burada yanlış
 * olurdu: önemli olan gecikmenin kendisi değil, BU OYUNDA neyi
 * bozduğu. Ölçüt topun temas penceresi — `hitRadius` 40 + salınım payı
 * 12 + top yarıçapı 13 = ~65 px (hızlı topta `speedPenalty` ile ~41'e
 * iniyor). Görsel sapma bu pencereyi aştığında oyuncu ekranda gördüğü
 * topa nişan alıyor ama gerçek temas alanının dışında kalıyor.
 *
 * `npm run olcum:top` ile ölçülen (p95 sapma, ileri sarma açık):
 *
 *   tek yön   gidiş-dönüş   p95 sapma   pencereye oranı
 *      0 ms         0 ms        65 px   ~1x  — tam pencerede
 *     50 ms       100 ms        69 px   ~1x  — hâlâ pencerede
 *    100 ms       200 ms       119 px   ~2x  — vuruşlar kaçmaya başlar
 *    150 ms       300 ms       170 px   ~3x
 *    200 ms       400 ms       198 px   ~3x
 *    300 ms       600 ms       245 px   ~4x  — MEDYAN bile 66 px,
 *                                             yani sistematik ıska
 *
 * Buradan üç kademe çıkıyor.
 *
 * Ayrı dosyada, çünkü karar SINANABİLİR olmalı: bir bileşenin içinde
 * gömülü kalsaydı eşiklerin doğru yerde durduğunu kimse soramazdı.
 */

/** Kademe sınırları — gidiş-dönüş, milisaniye. */
export const KADEME = {
  /** Sapma temas penceresi kadar; oyun doğru hissettiriyor. */
  iyi: 100,
  /** Pencerenin 2-3 katı; vuruş zorlaşır ama oyun oynanır. */
  orta: 250,
};

/**
 * Gidiş-dönüş süresini kademeye çevirir.
 *
 * Ölçüm yoksa `null` — "bilinmiyor" ile "kötü" AYNI ŞEY DEĞİL.
 * Çevrimdışı bir maçta ya da ilk paket gelmeden kötü bir gösterge
 * çıksaydı, oyuncu kendi internetinde olmayan bir sorun arardı.
 *
 * @param {number|null|undefined} ms
 * @returns {'iyi'|'orta'|'kotu'|null}
 */
export function kaliteAdi(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return null;
  if (ms <= KADEME.iyi) return 'iyi';
  if (ms <= KADEME.orta) return 'orta';
  return 'kotu';
}
