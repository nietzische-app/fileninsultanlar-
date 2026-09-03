import { describe, it, expect } from 'vitest';
import { OdaDefteri, HATA, KOD_ALFABE, KOD_UZUNLUK } from './oda.js';

/** Sırayla kod veren üreteç — testte rastgelelik istemiyoruz. */
function sirayla(...kodlar) {
  let i = 0;
  return () => kodlar[Math.min(i++, kodlar.length - 1)];
}

describe('oda defteri', () => {
  it('oda açan ev sahibi olur', () => {
    const d = new OdaDefteri({ kodUret: sirayla('ABCD') });
    expect(d.ac('a')).toEqual({ kod: 'ABCD', rol: 'ev' });
    expect(d.sayi).toBe(1);
  });

  it('katılan misafir olur ve eşi ev sahibidir', () => {
    const d = new OdaDefteri({ kodUret: sirayla('ABCD') });
    d.ac('a');
    expect(d.gir('ABCD', 'b')).toEqual({ kod: 'ABCD', rol: 'misafir', es: 'a' });
    expect(d.es('a')).toBe('b');
    expect(d.es('b')).toBe('a');
  });

  it('kod küçük harf ve boşlukla da girilebilir', () => {
    const d = new OdaDefteri({ kodUret: sirayla('ABCD') });
    d.ac('a');
    // Telefonda kod elle yazılıyor; "abcd " yüzünden oyun başlamamasın
    expect(d.gir('  abcd ', 'b').rol).toBe('misafir');
  });

  it('olmayan odaya girilemez', () => {
    const d = new OdaDefteri();
    expect(d.gir('ZZZZ', 'b')).toEqual({ hata: HATA.odaYok });
  });

  it('dolu odaya üçüncü kişi giremez', () => {
    const d = new OdaDefteri({ kodUret: sirayla('ABCD') });
    d.ac('a');
    d.gir('ABCD', 'b');
    expect(d.gir('ABCD', 'c')).toEqual({ hata: HATA.odaDolu });
  });

  it('aynı istemci iki odada olamaz', () => {
    const d = new OdaDefteri({ kodUret: sirayla('ABCD', 'EFGH') });
    d.ac('a');
    expect(d.ac('a')).toEqual({ hata: HATA.zatenOdada });
    expect(d.gir('ABCD', 'a')).toEqual({ hata: HATA.zatenOdada });
  });

  it('kod çakışırsa yeniden üretir', () => {
    const d = new OdaDefteri({ kodUret: sirayla('ABCD', 'ABCD', 'EFGH') });
    d.ac('a');
    expect(d.ac('b')).toEqual({ kod: 'EFGH', rol: 'ev' });
  });

  it('kod üretilemezse kilitlenmez, hata döner', () => {
    // Tek kodluk üreteç: her deneme çakışır
    const d = new OdaDefteri({ kodUret: () => 'ABCD' });
    d.ac('a');
    expect(d.ac('b')).toEqual({ hata: HATA.kodUretilemedi });
  });

  it('sunucu dolduğunda yeni oda açılmaz', () => {
    const d = new OdaDefteri({ kodUret: sirayla('ABCD', 'EFGH'), azamiOda: 1 });
    d.ac('a');
    expect(d.ac('b')).toEqual({ hata: HATA.sunucuDolu });
  });

  it('ev sahibi ayrılınca oda kapanır', () => {
    const d = new OdaDefteri({ kodUret: sirayla('ABCD') });
    d.ac('a');
    d.gir('ABCD', 'b');
    expect(d.ayril('a')).toEqual({ kod: 'ABCD', es: 'b', kapandi: true });
    expect(d.sayi).toBe(0);
    // Misafir de defterden düşmeli, yoksa yeni odaya giremez
    expect(d.odaOf('b')).toBe(null);
  });

  it('misafir ayrılınca oda açık kalır ve yeniden dolabilir', () => {
    const d = new OdaDefteri({ kodUret: sirayla('ABCD') });
    d.ac('a');
    d.gir('ABCD', 'b');
    expect(d.ayril('b')).toEqual({ kod: 'ABCD', es: 'a', kapandi: false });
    expect(d.sayi).toBe(1);
    expect(d.gir('ABCD', 'c').rol).toBe('misafir');
  });

  it('odada olmayanın ayrılması sessizdir', () => {
    const d = new OdaDefteri();
    expect(d.ayril('hayalet')).toBe(null);
    expect(d.es('hayalet')).toBe(null);
  });

  it('süpürge yalnız ömrünü dolduran boş odaları siler', () => {
    const d = new OdaDefteri({ kodUret: sirayla('AAAA', 'BBBB', 'CCCC'), omur: 1000 });
    d.ac('bos', 0);
    d.ac('taze', 900);
    d.ac('dolu', 0);
    d.gir('CCCC', 'misafir');

    expect(d.supur(1500)).toEqual(['AAAA']);
    expect(d.sayi).toBe(2);
    // Silinen odanın sahibi de defterden düşmeli
    expect(d.odaOf('bos')).toBe(null);
  });

  it('alfabede benzeşen karakter yok', () => {
    for (const harf of '01OIİ258BSZ') {
      expect(KOD_ALFABE).not.toContain(harf);
    }
    expect(KOD_UZUNLUK).toBe(4);
  });

  it('varsayılan üreteç alfabeden kod üretir', () => {
    const d = new OdaDefteri();
    const { kod } = d.ac('a');
    expect(kod).toHaveLength(KOD_UZUNLUK);
    for (const harf of kod) expect(KOD_ALFABE).toContain(harf);
  });
});
