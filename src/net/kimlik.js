/**
 * Oyuncu kimliği — çevrimiçi maçta karşıdakinin gördüğü ad.
 *
 * Neden gerekli: hızlı eşleşmede rakip bir yabancı. Ekranda "RAKİP"
 * yazdığında maç kişisiz kalıyor; ad olunca kazanmak da kaybetmek de
 * birine karşı oluyor. Sıradaki adımda (skor tablosu) da anahtar bu
 * olacak.
 *
 * Hesap YOK ve olmayacak: şifre, e-posta, doğrulama hiçbiri yok. Kimlik
 * yalnızca tarayıcıda duran rastgele bir kimlik numarası ve bir takma
 * ad. Bunun bedeli açık — kimlik taklit edilebilir, tarayıcı verisi
 * silinince kaybolur. Karşılığı da açık: oyuna girmek için form
 * doldurmak gerekmiyor ve kimseden kişisel veri toplamıyoruz. Bir
 * dostluk maçı oyunu için doğru takas bu; gerçek hesap ancak
 * sıralamaya ödül bağlandığında gerekir.
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
 * Kimlik numarası üretir.
 *
 * `crypto.randomUUID` varsa o, yoksa elle. Yedek yol gerçekten
 * gerekiyor: `randomUUID` yalnız güvenli bağlamda (https ya da
 * localhost) tanımlı ve geliştirmede oyun ağdaki telefondan
 * `http://192.168.x.x` ile açılıyor — orada tanımsız olup kimliği
 * çökertirdi.
 */
function kimlikUret() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Kimliği okur; yoksa üretip saklar.
 *
 * Saklama başarısız olursa (gizli sekme, dolu depo) yine de geçerli bir
 * kimlik dönüyor — yalnız kalıcı olmuyor. Oyunun çalışmaması için sebep
 * değil.
 */
export function kimlikYukle() {
  let kayitli = null;
  try {
    kayitli = JSON.parse(localStorage.getItem(KIMLIK_KEY) ?? 'null');
  } catch {
    kayitli = null;
  }

  const id = typeof kayitli?.id === 'string' && kayitli.id ? kayitli.id : kimlikUret();
  const ad = adTemizle(kayitli?.ad) || adUret();

  const kimlik = { id, ad };
  if (kayitli?.id !== id || kayitli?.ad !== ad) kimlikKaydet(kimlik);
  return kimlik;
}

/** Kimliği saklar; başarısızlığı sessizce yutar. */
export function kimlikKaydet(kimlik) {
  try {
    localStorage.setItem(KIMLIK_KEY, JSON.stringify({ id: kimlik.id, ad: kimlik.ad }));
  } catch {
    /* gizli sekme ya da dolu depo — oyun yine çalışır */
  }
  return kimlik;
}

/** Yalnız adı değiştirir, kimlik numarasını korur. */
export function adDegistir(yeniAd) {
  const kimlik = kimlikYukle();
  const ad = adTemizle(yeniAd) || kimlik.ad;
  return kimlikKaydet({ ...kimlik, ad });
}
