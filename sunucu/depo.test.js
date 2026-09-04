import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Depo, genelGorunum, BASLANGIC_PUAN } from './depo.js';
import { puanDegisimi } from './puan.js';

/**
 * Depo testleri.
 *
 * Buradaki iddiaların çoğu DAYANIKLILIK iddiası — "çökme olsa bile
 * veri durur" gibi. Böyle bir iddiayı yazıp geçmek kolay; testlerin işi
 * onu gerçekten kırmaya çalışmak: dosya yarım bırakılıyor, depo
 * sıfırdan yeniden açılıyor, günlük elle bozuluyor.
 */

let dizin;

beforeEach(() => {
  dizin = mkdtempSync(join(tmpdir(), 'depo-'));
});

afterEach(() => {
  rmSync(dizin, { recursive: true, force: true });
});

const ac = () => new Depo({ dizin });

describe('oyuncu kaydı', () => {
  it('yeni oyuncu başlangıç puanıyla açılır', () => {
    const depo = ac();
    const { kayit, gizli } = depo.oyuncuAc('ATEŞLİ SMAÇ');

    expect(kayit.ad).toBe('ATEŞLİ SMAÇ');
    expect(kayit.puan).toBe(BASLANGIC_PUAN);
    expect(kayit.mac).toBe(0);
    expect(gizli).toBeTruthy();
  });

  it('her oyuncu ayrı kimlik alır', () => {
    const depo = ac();
    const kimlikler = new Set(
      Array.from({ length: 200 }, () => depo.oyuncuAc('AD').kayit.id),
    );
    expect(kimlikler.size).toBe(200);
  });

  it('gizli anahtar düz metin SAKLANMIYOR', () => {
    /*
     * Anahtar bir taşıyıcı jeton: bilen o kimliğin sahibi sayılıyor.
     * Düz saklasaydık dosyayı okuyan herkes bütün oyuncuların yerine
     * geçebilirdi.
     */
    const depo = ac();
    const { gizli } = depo.oyuncuAc('AD');
    const dosya = readFileSync(join(dizin, 'oyuncular.jsonl'), 'utf8');
    expect(dosya).not.toContain(gizli);
  });

  it('doğru anahtar doğrulanır, yanlış anahtar reddedilir', () => {
    const depo = ac();
    const { kayit, gizli } = depo.oyuncuAc('AD');

    expect(depo.dogrula(kayit.id, gizli)?.id).toBe(kayit.id);
    expect(depo.dogrula(kayit.id, 'uydurma')).toBe(null);
    expect(depo.dogrula(kayit.id, '')).toBe(null);
    expect(depo.dogrula('olmayan-kimlik', gizli)).toBe(null);
  });

  it('genel görünüm gizli özeti SIZDIRMIYOR', () => {
    const depo = ac();
    const { kayit } = depo.oyuncuAc('AD');
    const gorunum = genelGorunum(kayit);
    expect('ozet' in gorunum).toBe(false);
    expect(JSON.stringify(gorunum)).not.toContain(kayit.ozet);
  });
});

describe('kalıcılık', () => {
  it('yeniden açılınca kayıtlar duruyor', () => {
    const ilk = ac();
    const { kayit, gizli } = ilk.oyuncuAc('KALICI AD');

    // Süreç yeniden başlamış gibi: aynı dizine YENİ bir depo
    const ikinci = ac();
    expect(ikinci.oyuncu(kayit.id)?.ad).toBe('KALICI AD');
    // Anahtar da hâlâ geçerli olmalı — yoksa herkes kimliğini kaybederdi
    expect(ikinci.dogrula(kayit.id, gizli)?.id).toBe(kayit.id);
  });

  it('yarım kalan son satır önceki kayıtları GÖTÜRMÜYOR', () => {
    /*
     * Asıl korkulan senaryo: yazma ortasında sunucu ölüyor. İddia
     * "yalnız son satır bozulur" — varsaymak yerine gerçekten yarım
     * bir satır yazıp sınıyoruz.
     */
    const depo = ac();
    const a = depo.oyuncuAc('BİRİNCİ').kayit;
    const b = depo.oyuncuAc('İKİNCİ').kayit;

    appendFileSync(join(dizin, 'oyuncular.jsonl'), '{"id":"yarim","ad":"KES');

    const yeni = ac();
    expect(yeni.oyuncu(a.id)?.ad).toBe('BİRİNCİ');
    expect(yeni.oyuncu(b.id)?.ad).toBe('İKİNCİ');
    expect(yeni.oyuncu('yarim')).toBe(null);
  });

  it('ortadaki bozuk satır ötekileri götürmüyor', () => {
    const depo = ac();
    const a = depo.oyuncuAc('BİRİNCİ').kayit;
    const dosya = join(dizin, 'oyuncular.jsonl');
    const ham = readFileSync(dosya, 'utf8');
    writeFileSync(dosya, `${ham}bu json değil\n`);
    const depo2 = ac();
    depo2.oyuncuAc('SONRAKİ');

    const yeni = ac();
    expect(yeni.oyuncu(a.id)?.ad).toBe('BİRİNCİ');
    expect(yeni.sayi).toBe(2);
  });

  it('aynı kimliğin son kaydı geçerli', () => {
    const depo = ac();
    const { kayit } = depo.oyuncuAc('ESKİ AD');
    depo.adDegistir(kayit.id, 'YENİ AD');

    expect(ac().oyuncu(kayit.id).ad).toBe('YENİ AD');
  });

  it('boş dizinde açılmak hata vermez', () => {
    expect(() => ac()).not.toThrow();
    expect(ac().sayi).toBe(0);
  });
});

describe('sıkıştırma', () => {
  it('günlük şişince küçülüyor ama durum korunuyor', () => {
    const depo = ac();
    const { kayit } = depo.oyuncuAc('TEK OYUNCU');

    // Aynı oyuncuyu çok kez güncelle: günlük şişer, oyuncu sayısı 1 kalır
    for (let i = 0; i < 120; i += 1) depo.adDegistir(kayit.id, `AD ${i}`);

    const satirSayisi = readFileSync(join(dizin, 'oyuncular.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean).length;

    expect(satirSayisi).toBeLessThan(40);
    // Ve son durum korunmuş olmalı
    expect(ac().oyuncu(kayit.id).ad).toBe('AD 119');
  });

  it('sıkıştırma sonrası yeni yazmalar da kalıcı', () => {
    const depo = ac();
    const { kayit } = depo.oyuncuAc('A');
    for (let i = 0; i < 120; i += 1) depo.adDegistir(kayit.id, `AD ${i}`);
    const ikinci = depo.oyuncuAc('B').kayit;

    const yeni = ac();
    expect(yeni.oyuncu(ikinci.id).ad).toBe('B');
    expect(yeni.sayi).toBe(2);
  });
});

describe('maç sonucu', () => {
  const kur = () => {
    const depo = ac();
    const a = depo.oyuncuAc('A').kayit;
    const b = depo.oyuncuAc('B').kayit;
    return { depo, a, b };
  };

  it('kazanan puan alır, kaybeden verir', () => {
    const { depo, a, b } = kur();
    const sonuc = depo.sonucIsle(a.id, b.id, puanDegisimi);

    expect(sonuc.kazanan.galibiyet).toBe(1);
    expect(sonuc.kazanan.puan).toBe(BASLANGIC_PUAN + sonuc.degisim);
    expect(sonuc.kaybeden.maglubiyet).toBe(1);
    expect(sonuc.kaybeden.puan).toBe(BASLANGIC_PUAN - sonuc.degisim);
    expect(sonuc.kazanan.mac).toBe(1);
  });

  it('kendine karşı maç puana YAZILMIYOR', () => {
    /*
     * İki sekme açıp kendiyle eşleşmek mümkün (bkz. sunucu/README.md).
     * Oynaması zaman alıyor ama puana yazsaydı en ucuz çiftçilik yolu
     * bu olurdu.
     */
    const { depo, a } = kur();
    expect(depo.sonucIsle(a.id, a.id, puanDegisimi)).toBe(null);
    expect(depo.oyuncu(a.id).mac).toBe(0);
  });

  it('bilinmeyen oyuncu sonucu yok sayılır', () => {
    const { depo, a } = kur();
    expect(depo.sonucIsle(a.id, 'hayalet', puanDegisimi)).toBe(null);
    expect(depo.sonucIsle('hayalet', a.id, puanDegisimi)).toBe(null);
  });

  it('puan sıfırın altına düşmüyor', () => {
    const { depo, a, b } = kur();
    for (let i = 0; i < 200; i += 1) depo.sonucIsle(a.id, b.id, puanDegisimi);
    expect(depo.oyuncu(b.id).puan).toBeGreaterThanOrEqual(0);
  });

  it('sonuçlar yeniden başlatmayı atlatıyor', () => {
    const { depo, a, b } = kur();
    depo.sonucIsle(a.id, b.id, puanDegisimi);

    const yeni = ac();
    expect(yeni.oyuncu(a.id).galibiyet).toBe(1);
    expect(yeni.oyuncu(b.id).maglubiyet).toBe(1);
  });
});

describe('sıralama', () => {
  it('hiç oynamamışlar listede YOK', () => {
    /*
     * Herkes 1000 puanla başlıyor. Girselerdi tablo, oyunu açıp hiç
     * oynamamış kişilerle dolardı.
     */
    const depo = ac();
    depo.oyuncuAc('OYNAMADI');
    expect(depo.siralama()).toHaveLength(0);
  });

  it('puana göre sıralıyor', () => {
    const depo = ac();
    const a = depo.oyuncuAc('A').kayit;
    const b = depo.oyuncuAc('B').kayit;
    const c = depo.oyuncuAc('C').kayit;

    depo.sonucIsle(a.id, b.id, puanDegisimi);
    depo.sonucIsle(a.id, c.id, puanDegisimi);
    depo.sonucIsle(b.id, c.id, puanDegisimi);

    const liste = depo.siralama();
    expect(liste.map((k) => k.ad)).toEqual(['A', 'B', 'C']);
    expect(liste[0].puan).toBeGreaterThan(liste[1].puan);
  });

  it('sıralama gizli özeti sızdırmıyor', () => {
    const depo = ac();
    const a = depo.oyuncuAc('A').kayit;
    const b = depo.oyuncuAc('B').kayit;
    depo.sonucIsle(a.id, b.id, puanDegisimi);

    const metin = JSON.stringify(depo.siralama());
    expect(metin).not.toContain(a.ozet);
    expect(metin).not.toContain('ozet');
  });

  it('limit uygulanıyor', () => {
    const depo = ac();
    const kayitlar = Array.from({ length: 12 }, (_, i) => depo.oyuncuAc(`O${i}`).kayit);
    for (let i = 0; i + 1 < kayitlar.length; i += 2) {
      depo.sonucIsle(kayitlar[i].id, kayitlar[i + 1].id, puanDegisimi);
    }
    expect(depo.siralama(3)).toHaveLength(3);
  });

  it('oyuncunun kendi sırasını veriyor', () => {
    const depo = ac();
    const a = depo.oyuncuAc('A').kayit;
    const b = depo.oyuncuAc('B').kayit;
    const c = depo.oyuncuAc('C').kayit;

    depo.sonucIsle(a.id, b.id, puanDegisimi);
    depo.sonucIsle(b.id, c.id, puanDegisimi);

    expect(depo.sira(a.id)).toBe(1);
    expect(depo.sira(c.id)).toBe(3);
    // Hiç oynamamışın sırası yok
    const d = depo.oyuncuAc('D').kayit;
    expect(depo.sira(d.id)).toBe(null);
  });
});
