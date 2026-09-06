/**
 * Röle adresi denetimi — KARARIN kendisi.
 *
 * `paket-onkontrol.mjs`'ten ayrı duruyor çünkü o betik `process.exit`
 * çağırıyor ve doğrudan sınanamıyor. Karar burada saf bir fonksiyon:
 * adres alır, sorun döner. Böylece onbir uç durum birim testinde
 * saniyeler içinde sorulabiliyor — betiği onbir kez çalıştırmadan.
 *
 * Aynı ayrım `sunucu/rele.js` içindeki `surumSorunu` için de yapılmıştı
 * ve orada bir hatayı yakalamıştı: "sorun yok" değeriyle "sorunun
 * kendisi" aynı türden olunca ikisi karışıyor. O yüzden burada da
 * dönüş ya `null` ya da bir NESNE — asla çıplak bir dize değil.
 */

/**
 * Adresin IP'ye bağlı olup olmadığını söyleyen kalıplar.
 *
 * `//` ya da satır başından sonra gelen dört sayı grubu: `wss://1.2.3.4`
 * ve `wss://1.2.3.4:8787` yakalanıyor, ama `rele.v4.example.com` ya da
 * `rele-2024.example.com` YAKALANMIYOR — yanlış alarm, gerçek alarmdan
 * daha çok zarar verir çünkü denetimi kapattırır.
 */
const IP_KALIBI = /(^|\/\/)(\d{1,3}\.){3}\d{1,3}(:|\/|$)/;

/**
 * IP'yi adın içinde taşıyan ücretsiz DNS servisleri.
 *
 * Sözcük sınırı (`\b`) şart: `sslipio-degil.example.com` gibi bir ad
 * içinde geçmesi yeterli olmamalı.
 */
const IP_DOMAIN = /\b(sslip\.io|nip\.io|xip\.io)\b/i;

/**
 * Bir röle adresinin mağaza paketi için uygunluğunu denetler.
 *
 * @param {string} adres `VITE_RELE_URL` değeri
 * @param {{ipAdresiTamam?: boolean}} [secenek]
 * @returns {{kod: string, baslik: string, satirlar: string[]} | null}
 *   Sorun yoksa `null`.
 */
export function adresSorunu(adres, secenek = {}) {
  const deger = String(adres ?? '');

  if (!deger) {
    return {
      kod: 'yok',
      baslik: 'VITE_RELE_URL verilmedi — paket ÇEVRİMİÇİ MODSUZ çıkardı.',
      satirlar: [
        'Yapı tamamlanır, oyun açılır, ama menüde ÇEVRİMİÇİ hiç görünmez',
        've bunu ancak mağazadaki uygulamayı açan biri fark eder.',
        '',
        'Örnek:',
        '  VITE_RELE_URL=wss://rele.retrovoleybol.online npm run paket',
      ],
    };
  }

  /*
   * Yerel adres. Test rölesinin adresi (`ws://localhost:8805`) yapıda
   * kalırsa uygulama telefonda kendi kendine bağlanmaya çalışır —
   * telefonda "localhost" telefonun kendisi demek, orada röle yok.
   */
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]/i.test(deger)) {
    return {
      kod: 'yerel',
      baslik: `VITE_RELE_URL yerel bir adres: ${deger}`,
      satirlar: [
        'Telefonda "localhost" telefonun KENDİSİ demek; orada röle yok.',
        'Mağaza paketinde herkese açık adres olmalı.',
      ],
    };
  }

  /*
   * Şifresiz bağlantı. Android 9'dan beri düz `ws://` varsayılan olarak
   * engelli; üstelik oyun `https://` üzerinden servis edilirse tarayıcı
   * da izin vermiyor. Belirtisi sessiz: bağlantı hiç kurulmuyor.
   */
  if (deger.startsWith('ws://')) {
    return {
      kod: 'sifresiz',
      baslik: `VITE_RELE_URL şifresiz: ${deger}`,
      satirlar: [
        'Android 9+ düz ws:// bağlantılarını varsayılan olarak engelliyor.',
        'wss:// kullan (Caddy/nginx zaten TLS sonlandırıyor).',
      ],
    };
  }

  /*
   * IP'YE BAĞLI ADRES — üçünün en önemlisi.
   *
   * sslip.io ve nip.io adresleri IP'yi adın İÇİNDE taşıyor:
   * `rele-178-104-2-249.sslip.io` yalnızca sunucu o IP'de durduğu
   * sürece çalışıyor. Web'de sorun değil — değişkeni güncelleyip
   * yeniden dağıtırsın, on dakika.
   *
   * Mağaza paketinde ölümcül: adres `.aab`'nin İÇİNE gömülüyor.
   * Sunucunun IP'si değiştiği gün telefonlardaki uygulama ölü bir
   * adrese bağlanır ve tek çare yeni sürüm yayınlayıp herkesin
   * güncellemesini beklemek olur.
   *
   * Çözüm kendi alan adın: DNS kaydı sunucu değişince güncellenir,
   * pakete gömülen adres aynı kalır.
   */
  if (!secenek.ipAdresiTamam && (IP_KALIBI.test(deger) || IP_DOMAIN.test(deger))) {
    return {
      kod: 'ip-bagli',
      baslik: `VITE_RELE_URL sunucunun IP'sine bağlı: ${deger}`,
      satirlar: [
        "Bu adres .aab'nin İÇİNE gömülüyor ve sonradan değiştirilemiyor.",
        "Sunucunun IP'si değiştiği gün mağazadaki uygulamanın çevrimiçi",
        'modu ölür; tek çare yeni sürüm yayınlamak.',
        '',
        'Kendi alan adını kullan — DNS kaydı sunucu değişince güncellenir,',
        'pakete gömülen adres aynı kalır:',
        '  VITE_RELE_URL=wss://rele.retrovoleybol.online npm run paket',
        '',
        'Bilerek yapıyorsan: PAKET_IP_ADRESI_TAMAM=1',
      ],
    };
  }

  return null;
}
