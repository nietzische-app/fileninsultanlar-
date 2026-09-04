/**
 * Gizlilik politikası bağlantısı — nereye ve NASIL açılacağı.
 *
 * Ayrı bir dosya ve saf fonksiyonlar, çünkü buradaki karar yerel
 * kabukta (Android WebView) ile tarayıcıda FARKLI olmak zorunda ve
 * yerel kabuktaki davranışı burada deneyemiyorum.
 *
 * Sorun somut: `target="_blank"` tarayıcıda yeni sekme açıyor, ama
 * Android WebView'inde yeni sekme diye bir şey yok. Capacitor bu
 * durumu `onCreateWindow` ile yakalayıp adresi HARİCİ tarayıcıya
 * yolluyor — ve paketin içindeki sayfanın adresi (`https://localhost/`
 * altındaki bir varlık) harici tarayıcıda AÇILMAZ. Yani mağazanın
 * "politika uygulama içinden erişilebilsin" şartını sağladığını
 * sandığımız bağlantı, telefonda ölü bir düğme olurdu ve bunu ancak
 * gerçek cihazda fark ederdik.
 *
 * Çözüm: yerel kabukta AYNI pencerede gezin. Geri dönüş iki yoldan
 * garanti: sayfanın kendi "← GERİ" bağlantısı (`history.back()`) ve
 * donanım geri tuşu — `gizlilik.html` Capacitor JS'i yüklemediği için
 * dinleyici yok, o da Capacitor'ın varsayılanına (WebView geçmişinde
 * geri) düşüyor.
 */

/** Politika sayfasının yolu. GÖRELİ: `base: './'` ile alt klasörde de çalışsın. */
export const GIZLILIK_YOLU = 'gizlilik.html';

/**
 * Capacitor'ın yerel kabuğunda mıyız?
 *
 * Genel `Capacitor` nesnesine bakıyor: yerel köprü sayfa yüklenmeden
 * önce onu enjekte ediyor. Web yapısında `@capacitor/core`'u statik
 * içe aktarmadığımız için tarayıcıda tanımsız kalıyor — yani denetim
 * "paket var mı" değil, gerçekten "yerel kabukta mıyız" diye soruyor.
 *
 * @param {object} kap Genel nesne (testte sahtesi verilebilsin diye)
 */
export function yerelKabukMu(kap = globalThis) {
  return kap?.Capacitor?.isNativePlatform?.() === true;
}

/**
 * Bağlantı elemanına verilecek nitelikler.
 *
 * @param {boolean} yerel `yerelKabukMu()` sonucu
 * @returns {{href: string, target?: string, rel?: string}}
 */
export function gizlilikBaglantisi(yerel) {
  if (yerel) return { href: GIZLILIK_YOLU };
  return { href: GIZLILIK_YOLU, target: '_blank', rel: 'noopener noreferrer' };
}
