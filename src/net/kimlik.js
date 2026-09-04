/**
 * Oyuncu kimliği — çevrimiçi maçta karşıdakinin gördüğü ad.
 *
 * Neden gerekli: hızlı eşleşmede rakip bir yabancı. Ekranda "RAKİP"
 * yazdığında maç kişisiz kalıyor; ad olunca kazanmak da kaybetmek de
 * birine karşı oluyor. Skor tablosunun anahtarı da bu.
 *
 * KİMLİĞİ ARTIK SUNUCU VERİYOR
 * ----------------------------
 * İlk sürümde kimlik numarasını istemci üretiyordu. Skor tablosu
 * yokken zararsızdı — kimse kimsenin takma adını çalmak istemez.
 * Tablo gelince aynı tasarım "başkasının kimliğini yaz, puanını al"
 * demeye dönüştü. Şimdi sunucu bir kimlik ve GİZLİ ANAHTAR veriyor;
 * anahtarı bilen kişi o kimliğin sahibi sayılıyor. Bu dosya artık
 * yalnız o ikisini saklıyor.
 *
 * Hesap YOK ve olmayacak: şifre, e-posta, doğrulama hiçbiri yok.
 * Bedeli açık — anahtar taşıyıcı bir jeton, kopyalanırsa kimlik de
 * kopyalanır; tarayıcı verisi silinirse geçmiş kaybolur ve "şifremi
 * unuttum" diye bir şey yok, çünkü kime ait olduğunu doğrulayacak bir
 * e-posta da yok. Karşılığı: oyuna girmek için form doldurmak
 * gerekmiyor ve kimseden kişisel veri toplamıyoruz. Gerçek hesap
 * ancak sıralamaya ödül bağlandığında gerekir.
 */

import { AD_UZUNLUK, adTemizle } from '../../sunucu/protokol.js';

const KIMLIK_KEY = 'filenin-sultanlari-kimlik';

/*
 * Ad kuralı (uzunluk + görünmez karakterler) protokol dosyasında,
 * sunucuyla ORTAK. İki kopya olsaydı ayrışırlardı: istemcinin geçerli
 * saydığı bir ad sunucuda başka kırpılır, oyuncu adının neden
 * değiştiğini anlamazdı.
 */
export { AD_UZUNLUK, adTemizle };

/**
 * Rastgele ad parçaları.
 *
 * Voleybol ve Türkiye'den; oyunun tonunda kalsın diye seçildi. Sıfat +
 * isim ile 20 × 16 = 320 birleşim çıkıyor. Az görünüyor ama ad benzersiz
 * OLMAK ZORUNDA DEĞİL — kimlik numarası ayrı ve o benzersiz; ad yalnız
 * ekranda görünen etiket. Aynı adlı iki oyuncu karşılaşırsa oyun yine
 * doğru çalışır.
 */
const SIFATLAR = [
  'ATEŞLİ', 'ÇELİK', 'YILDIZ', 'FIRTINA', 'ŞİMŞEK', 'KARTAL', 'ASLAN', 'DEMİR',
  'ALTIN', 'GÖKÇE', 'YAMAN', 'ÇEVİK', 'KESKİN', 'CESUR', 'ZİRVE', 'ATAK',
  'SERT', 'HIZLI', 'USTA', 'EFSANE',
];
const ISIMLER = [
  'SMAÇ', 'FİLE', 'PAS', 'BLOK', 'SERVİS', 'MANŞET', 'PLASE', 'RALLİ',
  'SAYI', 'SET', 'LİBERO', 'PASÖR', 'ÇAPRAZ', 'ORTA', 'SULTAN', 'ŞAHİN',
];

/** Rastgele takma ad üretir. */
export function adUret() {
  const sifat = SIFATLAR[Math.floor(Math.random() * SIFATLAR.length)];
  const isim = ISIMLER[Math.floor(Math.random() * ISIMLER.length)];
  return `${sifat} ${isim}`.slice(0, AD_UZUNLUK);
}

/**
 * Yerel kimliği okur.
 *
 * `id` ve `gizli` SUNUCUDAN gelmiş olabilir ya da hiç olmayabilir —
 * ilk açılışta yalnız bir takma ad var ve sunucu kimliği bağlanınca
 * veriyor. Ad her zaman dolu dönüyor: lobide bir şey göstermek
 * gerekiyor ve boş kutu "adım yok mu" diye düşündürüyor.
 *
 * Depo okunamıyorsa (gizli sekme, kapalı çerezler) yine geçerli bir
 * nesne dönüyor — yalnız kalıcı olmuyor. Oyunun açılmaması için sebep
 * değil.
 */
export function kimlikYukle() {
  let kayitli = null;
  try {
    kayitli = JSON.parse(localStorage.getItem(KIMLIK_KEY) ?? 'null');
  } catch {
    kayitli = null;
  }

  const kimlik = {
    id: typeof kayitli?.id === 'string' ? kayitli.id : null,
    gizli: typeof kayitli?.gizli === 'string' ? kayitli.gizli : null,
    ad: adTemizle(kayitli?.ad) || adUret(),
  };
  if (kayitli?.ad !== kimlik.ad) kimlikKaydet(kimlik);
  return kimlik;
}

/** Kimliği saklar; başarısızlığı sessizce yutar. */
export function kimlikKaydet(kimlik) {
  try {
    localStorage.setItem(
      KIMLIK_KEY,
      JSON.stringify({ id: kimlik.id ?? null, gizli: kimlik.gizli ?? null, ad: kimlik.ad }),
    );
  } catch {
    /* gizli sekme ya da dolu depo — oyun yine çalışır */
  }
  return kimlik;
}

/**
 * Sunucudan gelen kimlik cevabını saklar.
 *
 * `gizli` YALNIZ ilk açılışta geliyor; sonraki cevaplarda yok, çünkü
 * istemci onu zaten biliyor. Bu yüzden eskisi korunuyor — cevapta yok
 * diye silseydik oyuncu bir dahaki açılışta kimliğini kaybederdi.
 */
export function kimlikSunucudan(mesaj) {
  const onceki = kimlikYukle();
  return kimlikKaydet({
    id: mesaj.id ?? onceki.id,
    gizli: mesaj.gizli ?? onceki.gizli,
    ad: adTemizle(mesaj.ad) || onceki.ad,
  });
}

/** Yalnız adı değiştirir, kimlik ve anahtarı korur. */
export function adDegistir(yeniAd) {
  const kimlik = kimlikYukle();
  const ad = adTemizle(yeniAd) || kimlik.ad;
  return kimlikKaydet({ ...kimlik, ad });
}
