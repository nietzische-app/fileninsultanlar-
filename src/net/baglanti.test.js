import { describe, it, expect } from 'vitest';
import { Baglanti } from './baglanti.js';

/**
 * BAĞLANTININ YAŞAM DÖNGÜSÜ.
 *
 * Burada sınanan tek şey var ve tarayıcıda yakalanması çok zordu:
 * bağlantı KURULURKEN kapatılırsa ne oluyor.
 *
 * Yaşanan arıza: `kapat()` yalnız kurulmuş taşımayı kapatıyordu, ama
 * taşıma `await` arkasında doluyor. React geliştirmede efektleri
 * bağla-çöz-bağla diye çalıştırdığı için HEMEN OYNA iki bağlantı
 * açıyordu; ilki "kapatıldı" sayılıp aslında açık kalıyor, sonra
 * kendiliğinden sıraya giriyordu. Röle iki isteği de gerçek oyuncu
 * sanıp OYUNCUYU KENDİSİYLE eşleştiriyordu.
 *
 * Ekranda gerçek bir maç görünüyordu — skorbord, rakip adı, akan bir
 * oyun. Rakip yoktu. Hiçbir yerde hata yoktu.
 */

/** Sahte soket: ne zaman açılacağını test söylüyor. */
class SahteSoket {
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.gonderilen = [];
    this.dinleyici = {};
    SahteSoket.acilanlar.push(this);
  }

  addEventListener(ad, f) { this.dinleyici[ad] = f; }

  send(m) { this.gonderilen.push(m); }

  close() { this.readyState = 3; this.dinleyici.close?.(); }

  /** Bağlantının açılma anını testin elinde tutar. */
  ac() { this.readyState = 1; this.dinleyici.open?.(); }
}
SahteSoket.acilanlar = [];

const kur = () => {
  SahteSoket.acilanlar = [];
  return new Baglanti('ws://test', { wt: false, wsYapici: (u) => new SahteSoket(u) });
};

describe('Baglanti kapatma', () => {
  it('taşıma KURULURKEN kapatılırsa geç gelen soket de kapanıyor', async () => {
    const b = kur();
    const sozu = b.baglan();

    // Taşıma henüz yok — eski kodun `kapat()`ı tam burada boşa gidiyordu
    expect(b.tasima).toBe(null);
    b.kapat();

    // Soket şimdi açılıyor: kapatma kararından SONRA
    SahteSoket.acilanlar[0].ac();
    await sozu;

    expect(SahteSoket.acilanlar).toHaveLength(1);
    expect(SahteSoket.acilanlar[0].readyState, 'geç gelen soket açık kaldı').toBe(3);
    expect(b.tasima, 'kapatılmış bağlantı taşımayı sahiplendi').toBe(null);
  });

  it('kapatıldıktan sonra sıraya GİRMİYOR', async () => {
    /*
     * Asıl zarar buydu: sahipsiz soketin kendiliğinden `hizli-esles`
     * yollaması. Bir önceki testte soketin kapandığını görüyoruz;
     * burada da o soketin ağa TEK BİR mesaj bile bırakmadığını.
     */
    const b = kur();
    const sozu = b.baglan();
    b.kapat();
    SahteSoket.acilanlar[0].ac();
    await sozu;

    b.hizliEsles();
    expect(SahteSoket.acilanlar[0].gonderilen).toEqual([]);
  });

  it('normal akışta bağlantı açık kalıyor', async () => {
    // Karşı yön: düzeltme her bağlantıyı kapatan bir şeye dönüşmemeli
    const b = kur();
    const sozu = b.baglan();
    SahteSoket.acilanlar[0].ac();
    await sozu;

    expect(b.tasima).not.toBe(null);
    b.hizliEsles();
    expect(SahteSoket.acilanlar[0].gonderilen).toHaveLength(1);
  });

  it('kapatılan bağlantı YENİDEN bağlanabiliyor', async () => {
    // `kapandi` bayrağı temizlenmezse ikinci `baglan()` sessizce ölürdü
    const b = kur();
    const ilk = b.baglan();
    SahteSoket.acilanlar[0].ac();
    await ilk;
    b.kapat();

    const ikinci = b.baglan();
    SahteSoket.acilanlar[1].ac();
    await ikinci;

    expect(b.tasima).not.toBe(null);
    b.hizliEsles();
    expect(SahteSoket.acilanlar[1].gonderilen).toHaveLength(1);
  });
});
