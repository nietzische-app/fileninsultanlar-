/**
 * Eşleşme sırası — kimseyi tanımayan oyuncular için.
 *
 * Oda kodu iki kişinin BİRBİRİNİ tanımasını gerektiriyor: kodu söylemek
 * için karşındakiyle konuşabiliyor olman lazım. Oyunu ilk açan kişinin
 * elinde kod verecek kimse yok ve "ÇEVRİMİÇİ" düğmesi onun için boş bir
 * odaya açılıyor. Bu dosya o boşluğu dolduruyor: sıraya gir, sunucu seni
 * bekleyen biriyle eşleştirsin.
 *
 * `oda.js` gibi bilerek soketlerden bağımsız — "istemci" dediği şey
 * herhangi bir nesne olabilir. Sebebi test edilebilirlik: eşleşme
 * mantığının doğruluğu için WebSocket ayağa kaldırmak gerekmiyor, ve
 * asıl sınamak istediğimiz şey (aynı anda gelen onlarca istekte kimse
 * iki kez eşleşmesin, kimse sırada unutulmasın) soketlerle
 * ölçülemeyecek kadar zamanlamaya bağlı olurdu.
 */

import { HATA } from './protokol.js';

/**
 * Rakip bulunamadan önce beklenecek süre (ms).
 *
 * Bu süre dolunca sıradan ÇIKARILMIYOR, yalnız haber veriliyor:
 * "rakip yok, istersen yapay zekâya karşı oyna". Oyuncu beklemeye
 * devam edebilir; tam o sırada biri gelirse gerçek maç olur. Çıkarsaydık
 * iki kişinin birbirini birer saniye farkla kaçırması mümkün olurdu.
 */
export const BEKLEME_SINIRI = 20_000;

// Hata kodları tek yerden: istemci bunlara göre Türkçe metin gösteriyor

export class EslesmeSirasi {
  /**
   * @param {object} [ayar]
   * @param {number} [ayar.beklemeSiniri] Rakip yok uyarısının eşiği (ms).
   * @param {number} [ayar.azamiSira] Sıradaki en fazla kişi.
   */
  constructor({ beklemeSiniri = BEKLEME_SINIRI, azamiSira = 500 } = {}) {
    this.beklemeSiniri = beklemeSiniri;
    this.azamiSira = azamiSira;
    /**
     * Bekleyenler, GİRİŞ SIRASIYLA.
     *
     * Normal akışta bu dizide EN FAZLA BİR kişi olur: gelen ya
     * bekleyenle eşleşir ya da tek bekleyen olur. Yine de dizi,
     * çünkü eşleştirme başarısız olup ikisini de geri koyabiliyor
     * (bkz. rele.js `siradanEslestir`) ve o an sıra geçici olarak
     * büyüyor. Dizi olunca o durumda da en uzun bekleyen önce
     * eşleşiyor; tek kişilik bir alan olsaydı biri sessizce
     * kaybolurdu.
     * @type {{istemci:any, kimlik:object, giris:number, uyarildi:boolean}[]}
     */
    this.bekleyenler = [];
  }

  /** Sıradaki kişi sayısı. */
  get sayi() {
    return this.bekleyenler.length;
  }

  /** İstemci sırada mı. */
  varMi(istemci) {
    return this.bekleyenler.some((k) => k.istemci === istemci);
  }

  /**
   * Sıraya girer; bekleyen varsa ANINDA eşleşir.
   *
   * @returns {{es:object, ben:object}|{sira:number}|{hata:string}}
   *   `es` doluysa eşleşme oldu ve İKİSİ DE sıradan çıkmıştır.
   */
  katil(istemci, kimlik = {}, simdi = Date.now()) {
    if (this.varMi(istemci)) return { hata: HATA.zatenSirada };

    const ben = { istemci, kimlik, giris: simdi, uyarildi: false };

    /*
     * Eşleşme, sıraya EKLEMEDEN önce deneniyor. Önce ekleseydik kendi
     * kendimizle eşleşme ihtimali doğardı ve onu ayrıca elemek
     * gerekirdi; sıra da bir an için tutarsız görünürdü.
     */
    const es = this.bekleyenler.shift();
    if (es) return { es, ben };

    /*
     * Doluluk sınırı eşleşme denemesinden SONRA. Önce bakıyordu ve
     * testte yakalandı: dolu bir sıraya gelen kişi, sırayı BOŞALTACAK
     * olan kişiydi ve "sunucu dolu" ile geri çevriliyordu. Sınır
     * yalnızca sıranın büyümesini engellemeli, küçülmesini değil.
     */
    if (this.bekleyenler.length >= this.azamiSira) return { hata: HATA.sunucuDolu };

    this.bekleyenler.push(ben);
    return { sira: this.bekleyenler.length };
  }

  /**
   * İstemciyi sıradan çıkarır.
   * @returns {boolean} Sırada bulunup çıkarıldıysa true
   */
  cik(istemci) {
    const yer = this.bekleyenler.findIndex((k) => k.istemci === istemci);
    if (yer < 0) return false;
    this.bekleyenler.splice(yer, 1);
    return true;
  }

  /**
   * Bekleme sınırını yeni aşanlar — her biri için YALNIZ BİR KEZ.
   *
   * `uyarildi` bayrağı olmadan bu liste her çağrıda aynı kişileri
   * döndürürdü ve sunucu saniyede bir "rakip yok" mesajı yollardı;
   * ekranda titreyen bir uyarı ve boşuna trafik olurdu.
   *
   * @returns {object[]} Kayıtlar (istemci + kimlik)
   */
  uyarilacaklar(simdi = Date.now()) {
    const liste = [];
    this.bekleyenler.forEach((kayit) => {
      if (kayit.uyarildi) return;
      if (simdi - kayit.giris < this.beklemeSiniri) return;
      kayit.uyarildi = true;
      liste.push(kayit);
    });
    return liste;
  }
}
