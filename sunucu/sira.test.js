import { describe, it, expect } from 'vitest';
import { EslesmeSirasi } from './sira.js';

/**
 * Eşleşme sırası testleri.
 *
 * Asıl korku iki tane ve ikisi de sessiz bozulur:
 *   - Biri İKİ KEZ eşleşsin (iki maça birden girer, ikisi de bozulur).
 *   - Biri sırada UNUTULSUN (sonsuza kadar "rakip bekleniyor" görür).
 * İkisi de tek bir eşleşmeye bakarak fark edilmez, o yüzden aşağıda
 * kalabalık bir koşum var.
 */

/** Sıraya girecek sahte istemci — soket olması gerekmiyor. */
const istemci = (ad) => ({ ad });

describe('eşleşme sırası', () => {
  it('ilk giren bekler', () => {
    const sira = new EslesmeSirasi();
    const sonuc = sira.katil(istemci('a'));
    expect(sonuc.sira).toBe(1);
    expect(sira.sayi).toBe(1);
  });

  it('ikinci giren beklemez, anında eşleşir', () => {
    const sira = new EslesmeSirasi();
    const a = istemci('a');
    const b = istemci('b');

    sira.katil(a);
    const sonuc = sira.katil(b);

    expect(sonuc.es.istemci).toBe(a);
    expect(sonuc.ben.istemci).toBe(b);
    // Eşleşenler sıradan ÇIKMIŞ olmalı
    expect(sira.sayi).toBe(0);
  });

  it('normal akışta sırada en fazla bir kişi olur', () => {
    /*
     * Gelen ya bekleyenle eşleşir ya tek bekleyen olur — sıra hiç
     * büyümez. Bunu yazmamın sebebi: ilk hâlde "en uzun bekleyen ilk
     * eşleşir" diye bir test yazmıştım ve o kural bu tasarımda hiç
     * çalışmıyordu, çünkü sırada aynı anda iki kişi bulunamıyor.
     * Sınamadan doğru sandığım bir davranıştı.
     */
    const sira = new EslesmeSirasi();
    const a = istemci('a');
    const b = istemci('b');
    const c = istemci('c');

    sira.katil(a);
    expect(sira.sayi).toBe(1);
    expect(sira.katil(b).es.istemci).toBe(a);
    expect(sira.sayi).toBe(0);

    sira.katil(c);
    expect(sira.sayi).toBe(1);
  });

  it('sıra zorla büyürse en uzun bekleyen ilk eşleşir', () => {
    /*
     * Eşleştirme başarısız olup ikisini de geri koyduğunda sıra
     * geçici olarak ikiye çıkıyor (bkz. rele.js `siradanEslestir`).
     * FIFO yalnız o durumda görünüyor ama görünüyor.
     */
    const sira = new EslesmeSirasi();
    const a = istemci('a');
    const b = istemci('b');

    sira.katil(a, {}, 0);
    // Eşleşmenin bozulup ikisinin de geri konduğu durumu kur
    sira.bekleyenler.push({ istemci: b, kimlik: {}, giris: 1, uyarildi: false });
    expect(sira.sayi).toBe(2);

    expect(sira.katil(istemci('c')).es.istemci).toBe(a);
    expect(sira.varMi(b)).toBe(true);
  });

  it('aynı istemci iki kez sıraya giremez', () => {
    const sira = new EslesmeSirasi();
    const a = istemci('a');

    sira.katil(a);
    expect(sira.katil(a).hata).toBe('zaten-sirada');
    expect(sira.sayi).toBe(1);
  });

  it('kendisiyle eşleşmez', () => {
    // Tek kişilik sunucuda ikinci `katil` çağrısı kendi kaydını
    // bulup eşleştirebilirdi; "önce eşleştir, sonra ekle" sırası
    // bunu imkânsız kılıyor.
    const sira = new EslesmeSirasi();
    const a = istemci('a');
    sira.katil(a);
    const sonuc = sira.katil(a);
    expect(sonuc.es).toBeUndefined();
  });

  it('sıradan çıkan eşleşmez', () => {
    const sira = new EslesmeSirasi();
    const a = istemci('a');
    const b = istemci('b');

    sira.katil(a);
    expect(sira.cik(a)).toBe(true);

    const sonuc = sira.katil(b);
    expect(sonuc.es).toBeUndefined();
    expect(sonuc.sira).toBe(1);
  });

  it('sırada olmayanı çıkarmak zararsız', () => {
    const sira = new EslesmeSirasi();
    expect(sira.cik(istemci('yok'))).toBe(false);
  });

  it('doluluk sınırı, sırayı BOŞALTACAK kişiyi geri çevirmez', () => {
    /*
     * Bu testi yazınca gerçek bir hata çıktı: doluluk denetimi
     * eşleşme denemesinden ÖNCE duruyordu ve dolu sıraya gelen kişi —
     * yani sırayı boşaltacak olan kişi — "sunucu dolu" ile geri
     * çevriliyordu. Sınırın işi sıranın büyümesini engellemek,
     * küçülmesini değil.
     */
    const sira = new EslesmeSirasi({ azamiSira: 1 });
    sira.katil(istemci('a'));
    expect(sira.sayi).toBe(1); // sıra tam dolu

    expect(sira.katil(istemci('b')).es).toBeTruthy();
    expect(sira.sayi).toBe(0);
  });

  it('sıra gerçekten dolduğunda reddeder', () => {
    const sira = new EslesmeSirasi({ azamiSira: 2 });
    // Sırayı elle iki kişiye çıkar (normal akışta olmaz)
    sira.bekleyenler.push({ istemci: istemci('a'), kimlik: {}, giris: 0, uyarildi: false });
    sira.bekleyenler.push({ istemci: istemci('b'), kimlik: {}, giris: 0, uyarildi: false });

    // c gelince a ile eşleşir, sıra 1'e düşer — ret yok
    expect(sira.katil(istemci('c')).es).toBeTruthy();
    expect(sira.sayi).toBe(1);
  });

  it('kimlik eşleşmeyle birlikte taşınır', () => {
    const sira = new EslesmeSirasi();
    const a = istemci('a');
    sira.katil(a, { id: 'k1', ad: 'ATEŞLİ SMAÇ' });
    const sonuc = sira.katil(istemci('b'), { id: 'k2', ad: 'ÇELİK BLOK' });

    expect(sonuc.es.kimlik.ad).toBe('ATEŞLİ SMAÇ');
    expect(sonuc.ben.kimlik.ad).toBe('ÇELİK BLOK');
  });
});

describe('bekleme uyarısı', () => {
  it('sınır dolmadan uyarmaz', () => {
    const sira = new EslesmeSirasi({ beklemeSiniri: 1000 });
    sira.katil(istemci('a'), {}, 0);
    expect(sira.uyarilacaklar(500)).toHaveLength(0);
  });

  it('sınır dolunca uyarır', () => {
    const sira = new EslesmeSirasi({ beklemeSiniri: 1000 });
    const a = istemci('a');
    sira.katil(a, {}, 0);
    const liste = sira.uyarilacaklar(1000);
    expect(liste).toHaveLength(1);
    expect(liste[0].istemci).toBe(a);
  });

  it('aynı kişiyi iki kez uyarmaz', () => {
    /*
     * Sunucu bu listeyi saniyede bir soruyor. Bayrak olmasaydı aynı
     * oyuncuya saniyede bir "rakip yok" giderdi: ekranda titreyen bir
     * uyarı ve boşuna trafik.
     */
    const sira = new EslesmeSirasi({ beklemeSiniri: 1000 });
    sira.katil(istemci('a'), {}, 0);
    expect(sira.uyarilacaklar(1000)).toHaveLength(1);
    expect(sira.uyarilacaklar(2000)).toHaveLength(0);
    expect(sira.uyarilacaklar(9000)).toHaveLength(0);
  });

  it('uyarılan sırada KALIR', () => {
    /*
     * Kasıtlı: uyarı "seni sıradan attım" demek değil. Çıkarsaydık,
     * tam o saniyede gelen biriyle eşleşme kaçardı — iki oyuncu
     * birbirini bir saniye farkla ıskalardı.
     */
    const sira = new EslesmeSirasi({ beklemeSiniri: 1000 });
    const a = istemci('a');
    sira.katil(a, {}, 0);
    sira.uyarilacaklar(1000);

    expect(sira.varMi(a)).toBe(true);
    expect(sira.katil(istemci('b')).es.istemci).toBe(a);
  });
});

describe('kalabalık', () => {
  it('herkes ya tam bir kez eşleşir ya sırada kalır', () => {
    /*
     * Tek eşleşmeye bakan testler iki sessiz arızayı yakalayamaz:
     * birinin iki maça birden girmesi, ve birinin sırada unutulması.
     * Burada 200 istemci karışık sırayla giriyor-çıkıyor, sonunda
     * sayım tutmalı.
     */
    const sira = new EslesmeSirasi();
    const eslesmeSayisi = new Map();
    const istemciler = Array.from({ length: 200 }, (_, i) => istemci(`i${i}`));

    const say = (k) => eslesmeSayisi.set(k, (eslesmeSayisi.get(k) ?? 0) + 1);

    istemciler.forEach((k, i) => {
      const sonuc = sira.katil(k);
      if (sonuc.es) {
        say(sonuc.es.istemci);
        say(sonuc.ben.istemci);
      }
      // Her 7'de bir kişi vazgeçip çıksın — gerçek hayattaki gibi
      if (i % 7 === 0 && i > 0) sira.cik(istemciler[i - 1]);
    });

    const eslesenler = [...eslesmeSayisi.keys()];
    // Kimse iki kez eşleşmemiş
    expect([...eslesmeSayisi.values()].every((n) => n === 1)).toBe(true);
    // Eşleşen sayısı çift
    expect(eslesenler.length % 2).toBe(0);
    // Kayıp yok: her istemci ya eşleşti, ya sırada, ya çıktı
    const sirada = istemciler.filter((k) => sira.varMi(k));
    expect(eslesenler.length + sirada.length).toBeLessThanOrEqual(istemciler.length);
    // Eşleşenler artık sırada olmamalı
    expect(eslesenler.some((k) => sira.varMi(k))).toBe(false);
  });

  it('çift sayıda giren herkes eşleşir, sıra boş kalır', () => {
    const sira = new EslesmeSirasi();
    const istemciler = Array.from({ length: 50 }, (_, i) => istemci(`i${i}`));
    let cift = 0;

    istemciler.forEach((k) => {
      if (sira.katil(k).es) cift += 1;
    });

    expect(cift).toBe(25);
    expect(sira.sayi).toBe(0);
  });
});
