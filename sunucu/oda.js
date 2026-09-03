/**
 * Oda defteri — kim kiminle eşleşti.
 *
 * Sunucunun oyundan haberi yok ve olmayacak: iki soketi bir kodla
 * buluşturur, aralarındaki mesajları taşır, biri gidince diğerine haber
 * verir. Maçı ev sahibi istemci simüle eder.
 *
 * Bu dosya bilerek soketlerden bağımsız — "istemci" dediği şey herhangi
 * bir nesne olabilir. Sebebi test edilebilirlik: eşleşme mantığının
 * doğruluğu için WebSocket ayağa kaldırmak gerekmiyor.
 */

import { KOD_ALFABE, KOD_UZUNLUK, HATA } from './protokol.js';

// İstemci de bu sabitleri okuyor — tek yerden dışa aktarılıyorlar
export { KOD_ALFABE, KOD_UZUNLUK, HATA };

function varsayilanKodUret() {
  let kod = '';
  for (let i = 0; i < KOD_UZUNLUK; i += 1) {
    kod += KOD_ALFABE[Math.floor(Math.random() * KOD_ALFABE.length)];
  }
  return kod;
}

export class OdaDefteri {
  /**
   * @param {object} [ayar]
   * @param {() => string} [ayar.kodUret] Kod üreteci — testte sabitlenir.
   * @param {number} [ayar.azamiOda] Aynı anda açık kalabilecek oda sayısı.
   * @param {number} [ayar.omur] Kimse katılmazsa odanın yaşayacağı süre (ms).
   */
  constructor({ kodUret = varsayilanKodUret, azamiOda = 500, omur = 15 * 60 * 1000 } = {}) {
    this.kodUret = kodUret;
    this.azamiOda = azamiOda;
    this.omur = omur;
    /** @type {Map<string, {kod:string, ev:any, misafir:any, acilis:number}>} */
    this.odalar = new Map();
    /** İstemciden odaya ters bakış — ayrılırken odayı aramak zorunda kalmayalım. */
    this.nerede = new Map();
  }

  /** Açık oda sayısı. */
  get sayi() {
    return this.odalar.size;
  }

  /**
   * Yeni oda açar, açanı ev sahibi yapar.
   * @returns {{kod:string, rol:'ev'}|{hata:string}}
   */
  ac(istemci, simdi = Date.now()) {
    if (this.nerede.has(istemci)) return { hata: HATA.zatenOdada };
    if (this.odalar.size >= this.azamiOda) return { hata: HATA.sunucuDolu };

    /*
     * Çakışmada yeniden dene. Alfabe 23 harf, kod 4 hane → 280 bin
     * ihtimal; birkaç yüz odada çakışma nadir ama imkânsız değil.
     * Sonsuz döngü yerine sayılı deneme: alfabe daralırsa ya da kod
     * üreteci bozulursa sunucu kilitlenmesin, hata dönsün.
     */
    let kod = null;
    for (let deneme = 0; deneme < 30; deneme += 1) {
      const aday = this.kodUret();
      if (!this.odalar.has(aday)) {
        kod = aday;
        break;
      }
    }
    if (!kod) return { hata: HATA.kodUretilemedi };

    this.odalar.set(kod, { kod, ev: istemci, misafir: null, acilis: simdi });
    this.nerede.set(istemci, kod);
    return { kod, rol: 'ev' };
  }

  /**
   * Var olan odaya katılır.
   * @returns {{kod:string, rol:'misafir', es:any}|{hata:string}}
   */
  gir(kod, istemci) {
    if (this.nerede.has(istemci)) return { hata: HATA.zatenOdada };

    const temiz = String(kod ?? '').trim().toUpperCase();
    const oda = this.odalar.get(temiz);
    if (!oda) return { hata: HATA.odaYok };
    if (oda.misafir) return { hata: HATA.odaDolu };

    oda.misafir = istemci;
    this.nerede.set(istemci, temiz);
    return { kod: temiz, rol: 'misafir', es: oda.ev };
  }

  /** İstemcinin odadaki eşi — mesaj taşırken hedef budur. */
  es(istemci) {
    const oda = this.odaOf(istemci);
    if (!oda) return null;
    return oda.ev === istemci ? oda.misafir : oda.ev;
  }

  /** İstemcinin odası. */
  odaOf(istemci) {
    const kod = this.nerede.get(istemci);
    return kod ? this.odalar.get(kod) ?? null : null;
  }

  /**
   * İstemciyi odasından çıkarır.
   *
   * Ev sahibi giderse oda kapanır — maçı o simüle ediyor, misafir tek
   * başına oyunu sürdüremez. Misafir giderse oda açık kalır ve başka
   * biri aynı kodla katılabilir.
   *
   * @returns {{kod:string, es:any, kapandi:boolean}|null}
   */
  ayril(istemci) {
    const kod = this.nerede.get(istemci);
    if (!kod) return null;
    const oda = this.odalar.get(kod);
    this.nerede.delete(istemci);
    if (!oda) return null;

    if (oda.ev === istemci) {
      if (oda.misafir) this.nerede.delete(oda.misafir);
      this.odalar.delete(kod);
      return { kod, es: oda.misafir, kapandi: true };
    }

    oda.misafir = null;
    return { kod, es: oda.ev, kapandi: false };
  }

  /**
   * Ömrünü doldurmuş boş odaları siler.
   *
   * Oda açıp vazgeçen istemci soketi kapatınca zaten temizleniyor; bu
   * süpürge, soketi açık kalıp kimseyi beklemeyen odalar için. Dolu
   * odalara dokunulmaz — uzun maç kesilmesin.
   *
   * @returns {string[]} Silinen kodlar
   */
  supur(simdi = Date.now()) {
    const silinen = [];
    this.odalar.forEach((oda, kod) => {
      if (oda.misafir) return;
      if (simdi - oda.acilis < this.omur) return;
      this.nerede.delete(oda.ev);
      this.odalar.delete(kod);
      silinen.push(kod);
    });
    return silinen;
  }
}
