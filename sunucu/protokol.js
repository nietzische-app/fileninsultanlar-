/**
 * Röle protokolünün iki tarafın da bilmesi gereken parçaları.
 *
 * Ayrı dosya olmasının sebebi somut: kod uzunluğunu istemci giriş
 * kutusu da biliyor. `oda.js` içinden almak sunucu sınıfını tarayıcı
 * paketine sokma riskini doğuruyordu; burada yalnızca sabit var, yan
 * etkisi yok.
 */

/**
 * Kod alfabesi.
 *
 * Kod telefonda okunup karşıdakine sesli söylenecek; birbirine benzeyen
 * harf ve rakamlar (0/O, 1/I/İ, 2/Z, 5/S, 8/B) kasten dışarıda.
 * Türkçe'ye özgü harfler de yok — karşı taraf farklı klavyede olabilir.
 */
export const KOD_ALFABE = 'ACDEFGHJKLMNPRTUVY34679';
export const KOD_UZUNLUK = 4;

/** Hata sebepleri — istemci bunlara göre Türkçe metin gösterir. */
export const HATA = {
  odaYok: 'oda-yok',
  odaDolu: 'oda-dolu',
  zatenOdada: 'zaten-odada',
  sunucuDolu: 'sunucu-dolu',
  kodUretilemedi: 'kod-uretilemedi',
};
