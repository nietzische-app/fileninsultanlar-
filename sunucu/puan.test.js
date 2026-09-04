import { describe, it, expect } from 'vitest';
import { puanDegisimi, K } from './puan.js';
import { Depo, BASLANGIC_PUAN } from './depo.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Puanlama testleri.
 *
 * Bu dosyadaki testler MUTASYONLA doğrulandı: formül bozulup hangi
 * testin düştüğüne bakıldı. Sonuç öğreticiydi ve buraya yazılması
 * gerekiyor, çünkü testlerden biri adının vaat ettiğini ölçmüyor.
 *
 *   - Formül testleri (ilk bölüm): `puanDegisimi` sabit K/2 döndürünce
 *     ÜÇÜ birden düşüyor. Beceriyi yok sayan bir puanlamayı yakalıyorlar.
 *   - "çok oynamak tek başına yükseltmiyor": kaybedene puan kaybettirmeyi
 *     bıraktığımızda (yani puan = galibiyet sayacı olduğunda) düşüyor.
 *     Elo'yu seçmemizin ASIL sebebini koruyan test bu.
 *   - "bilinen güçteki oyuncular doğru sırayla diziliyor": sabit K/2
 *     mutasyonunda BİLE geçiyor. Yani Elo'yu basit bir galibiyet-mağlubiyet
 *     farkından AYIRT ETMİYOR — ikisi de beceriye göre sıralıyor, çünkü
 *     benzetimde herkes benzer sayıda maç oynuyor. Yine de duruyor:
 *     zincirin tamamının (formül + depo + sıralama) gürültü altında
 *     anlamlı bir tablo ürettiğini gösteriyor. Ölçtüğü şey bu, daha
 *     fazlası değil.
 */

describe('puan değişimi', () => {
  it('eşit puanlıda K/2', () => {
    expect(puanDegisimi(1000, 1000)).toBe(K / 2);
  });

  it('güçlü zayıfı yenince az, zayıf güçlüyü yenince çok alıyor', () => {
    const kolayGalibiyet = puanDegisimi(1600, 1000);
    const zorGalibiyet = puanDegisimi(1000, 1600);

    expect(kolayGalibiyet).toBeLessThan(K / 2);
    expect(zorGalibiyet).toBeGreaterThan(K / 2);
    expect(zorGalibiyet).toBeGreaterThan(kolayGalibiyet);
  });

  it('fark büyüdükçe kazanç düşüyor ama SIFIR olmuyor', () => {
    /*
     * Sıfır olsaydı tablo tepesindeki oyuncu için maç kazanmanın
     * hiçbir karşılığı kalmazdı — oynamayı bırakması için sebep.
     */
    const uzak = puanDegisimi(3000, 100);
    expect(uzak).toBeGreaterThanOrEqual(1);
    expect(uzak).toBeLessThan(5);
  });

  it('400 puan fark ≈ %91 kazanma beklentisi', () => {
    // Elo'nun tanım gereği tuttuğu değer; formülün doğru kurulduğunun kanıtı
    const degisim = puanDegisimi(1400, 1000);
    expect(degisim).toBe(Math.round(K * (1 - 0.909)));
  });

  it('değişim tam sayı', () => {
    for (let i = 0; i < 100; i += 1) {
      const a = 500 + Math.random() * 2000;
      const b = 500 + Math.random() * 2000;
      expect(Number.isInteger(puanDegisimi(a, b))).toBe(true);
    }
  });
});

describe('tablo beceriye göre sıralıyor mu', () => {
  it('bilinen güçteki oyuncular doğru sırayla diziliyor', () => {
    /*
     * Ölçüm: beş oyuncuya GİZLİ bir "gerçek güç" veriliyor. Her maçın
     * kazananı bu güçlere göre olasılıkla belirleniyor (güçlü olan hep
     * kazanmıyor — gerçek hayatta da kazanmıyor). Sonra tablonun
     * ürettiği sıralama gerçek güç sıralamasıyla karşılaştırılıyor.
     *
     * SINIRI: bu test Elo'yu basit bir galibiyet-mağlubiyet farkından
     * ayırt etmiyor (mutasyonla doğrulandı, dosya başındaki nota bak).
     * Herkes benzer sayıda maç oynadığı için ikisi de doğru sıralıyor.
     * Ölçtüğü şey zincirin bütünü: formül + depo + sıralama, gürültü
     * altında anlamlı bir tablo veriyor mu.
     *
     * Tohumlu rastgelelik: aynı koşum aynı sonucu vermeli, yoksa test
     * ara sıra kırmızı yanar ve kimse sebebini bulamaz.
     */
    let tohum = 20240904;
    const rastgele = () => {
      tohum = (tohum * 1103515245 + 12345) & 0x7fffffff;
      return tohum / 0x7fffffff;
    };

    const dizin = mkdtempSync(join(tmpdir(), 'puan-'));
    try {
      const depo = new Depo({ dizin });
      // Gerçek güçler — tabloya asla söylenmiyor
      const guc = { A: 1800, B: 1500, C: 1200, D: 900, E: 600 };
      const kayitlar = Object.fromEntries(
        Object.keys(guc).map((ad) => [ad, depo.oyuncuAc(ad).kayit]),
      );
      const adlar = Object.keys(guc);

      for (let i = 0; i < 3000; i += 1) {
        const a = adlar[Math.floor(rastgele() * adlar.length)];
        let b = adlar[Math.floor(rastgele() * adlar.length)];
        while (b === a) b = adlar[Math.floor(rastgele() * adlar.length)];

        // Gerçek güce göre kazanma olasılığı (yine Elo eğrisi)
        const pA = 1 / (1 + 10 ** ((guc[b] - guc[a]) / 400));
        const kazanan = rastgele() < pA ? a : b;
        const kaybeden = kazanan === a ? b : a;
        depo.sonucIsle(kayitlar[kazanan].id, kayitlar[kaybeden].id, puanDegisimi);
      }

      const tablo = depo.siralama().map((k) => k.ad);
      expect(tablo).toEqual(['A', 'B', 'C', 'D', 'E']);
    } finally {
      rmSync(dizin, { recursive: true, force: true });
    }
  });

  it('çok oynamak tek başına yükseltmiyor', () => {
    /*
     * Elo'yu seçmemizin ASIL sebebi ve bunu koruyan tek test:
     * galibiyet sayısına bakan bir tablo beceriyi değil BOŞ ZAMANI
     * ölçüyor. Burada ÇOK oynayıp yarısını kazanan ile AZ oynayıp
     * hepsini kazanan karşılaştırılıyor.
     *
     * Mutasyonla doğrulandı: kaybedene puan kaybettirmeyi bırakınca
     * (puan = galibiyet sayacı) bu test düşüyor, ötekiler geçmeye
     * devam ediyor.
     */
    const dizin = mkdtempSync(join(tmpdir(), 'puan-'));
    try {
      const depo = new Depo({ dizin });
      const calis = depo.oyuncuAc('ÇOK OYNAYAN').kayit;
      const usta = depo.oyuncuAc('AZ AMA İYİ').kayit;
      const kurban = depo.oyuncuAc('KURBAN').kayit;

      // Çok oynayan: 100 maç, yarısı galibiyet
      for (let i = 0; i < 100; i += 1) {
        if (i % 2 === 0) depo.sonucIsle(calis.id, kurban.id, puanDegisimi);
        else depo.sonucIsle(kurban.id, calis.id, puanDegisimi);
      }
      // Usta: 10 maç, hepsi galibiyet
      for (let i = 0; i < 10; i += 1) {
        depo.sonucIsle(usta.id, kurban.id, puanDegisimi);
      }

      const c = depo.oyuncu(calis.id);
      const u = depo.oyuncu(usta.id);

      // Galibiyet sayısında çok oynayan ÖNDE
      expect(c.galibiyet).toBeGreaterThan(u.galibiyet);
      // Ama tabloda usta önde olmalı
      expect(u.puan).toBeGreaterThan(c.puan);
      expect(depo.siralama()[0].ad).toBe('AZ AMA İYİ');
    } finally {
      rmSync(dizin, { recursive: true, force: true });
    }
  });

  it('yeni oyuncu birkaç maçta yerini buluyor', () => {
    /*
     * K katsayısının gerekçesi: 16 olsaydı yeni bir oyuncunun gerçek
     * yerini bulması onlarca maç sürerdi. 10 maçta 1000'den belirgin
     * şekilde ayrılabilmeli.
     */
    const dizin = mkdtempSync(join(tmpdir(), 'puan-'));
    try {
      const depo = new Depo({ dizin });
      const yeni = depo.oyuncuAc('YENİ').kayit;
      const rakip = depo.oyuncuAc('RAKİP').kayit;

      for (let i = 0; i < 10; i += 1) depo.sonucIsle(yeni.id, rakip.id, puanDegisimi);

      expect(depo.oyuncu(yeni.id).puan - BASLANGIC_PUAN).toBeGreaterThan(100);
    } finally {
      rmSync(dizin, { recursive: true, force: true });
    }
  });
});
