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

/** Türkçe ünlüler, kalınlık ve yuvarlaklığa göre. */
const UNLULER = {
  'a': 'ın', 'ı': 'ın', 'A': 'ın', 'I': 'ın',
  'e': 'in', 'i': 'in', 'E': 'in', 'İ': 'in',
  'o': 'un', 'u': 'un', 'O': 'un', 'U': 'un',
  'ö': 'ün', 'ü': 'ün', 'Ö': 'ün', 'Ü': 'ün',
};

/**
 * Özel ada Türkçe ilgi eki takar: NORDİK → NORDİK'İN.
 *
 * Neden gerekli: mesajlar İngilizce kalıptan çevrildiği için isimler
 * ham hâlde yapıştırılıyordu — "NORDİK SAYI", "1. SET NORDİK". Ev
 * sahibi tarafı zaten doğruydu ("TÜRKİYE'NİN"), rakip tarafı değildi.
 *
 * Ek son ünlüye göre seçilir (ünlü uyumu) ve kelime ünlüyle bitiyorsa
 * araya kaynaştırma 'n'si girer: ADRİYA → ADRİYA'NIN.
 *
 * Büyük harfe çevirme Türkçe yapılır; yoksa "ın" eki "IN" yerine
 * noktalı "İN" olurdu.
 *
 * @param {string} value
 * @returns {string} Eki takılmış ad; boş girdide boş dize
 */
export function ilgiEki(value) {
  const ad = String(value ?? '').trim();
  if (!ad) return '';

  // Son ünlüyü bul — ek ona göre seçilir
  let ek = 'in';
  for (let i = ad.length - 1; i >= 0; i -= 1) {
    const bulunan = UNLULER[ad[i]];
    if (bulunan) {
      ek = bulunan;
      break;
    }
  }

  // Ünlüyle bitiyorsa kaynaştırma 'n'si
  const sonHarf = ad[ad.length - 1];
  if (UNLULER[sonHarf]) ek = `n${ek}`;

  return `${ad}'${upper(ek)}`;
}
