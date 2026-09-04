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
  zatenSirada: 'zaten-sirada',
  sunucuDolu: 'sunucu-dolu',
  kodUretilemedi: 'kod-uretilemedi',
};

/**
 * Takma adın azami uzunluğu.
 *
 * İstemci de bunu BURADAN alıyor (src/net/kimlik.js yeniden dışa
 * aktarıyor). Yön önemli: kural sunucuda tanımlı, istemci ona uyuyor.
 * Tersi olsaydı istemcideki bir değişiklik sunucunun kabul ettiği şeyi
 * değiştirirdi — ad karşı oyuncunun ekranında görünüyor ve istemcide
 * yapılan hiçbir kısıtlama güvenlik değil.
 */
export const AD_UZUNLUK = 12;

/**
 * Takma adı görüntülenebilir hâle getirir.
 *
 * Burada durmasının sebebi: bu kural İKİ tarafta da uygulanıyor —
 * istemcide kolaylık için (yazarken görürsün), sunucuda güvenlik için
 * (protokolü konuşan herkes istemciyi atlayabilir). İki kopya olsaydı
 * ayrışırlardı: istemcinin geçerli saydığı bir ad sunucuda başka
 * kırpılır, oyuncu adının neden değiştiğini anlamazdı.
 *
 * Kontrol karakterleri atılıyor çünkü ad KARŞI OYUNCUNUN ekranında
 * görünüyor: görünmez karakterler düzeni bozar, satır sonu levhayı
 * taşırır.
 */
export function adTemizle(ham, sinir = AD_UZUNLUK) {
  return (
    String(ham ?? '')
      // Kural kazayla yazılan kontrol karakterleri için; burada atmak
      // tam olarak istenen şey.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, sinir)
      .toLocaleUpperCase('tr-TR')
  );
}
