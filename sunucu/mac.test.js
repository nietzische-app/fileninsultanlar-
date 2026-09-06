import { describe, it, expect, vi } from 'vitest';
import { Mac } from './mac.js';

const AYAR = { mode: '1v1', format: 'single', difficulty: 'normal', homeIds: ['nehir-tunca'] };

/** Bir tikin geçmesini bekler (tik 1/60 sn). */
const tikBekle = (ms = 80) => new Promise((coz) => { setTimeout(coz, ms); });

describe('maç tiki korumalı', () => {
  /*
   * Korumasızken bu senaryonun bedeli ağırdı: `setInterval` geri
   * çağrısından çıkan bir hata Node'da YAKALANMAMIŞ İSTİSNA demek ve
   * süreç ölür. Yani tek bir maçtaki tek bir hata, o an oynayan
   * herkesin maçını düşürürdü — üstelik Docker süreci sessizce
   * yeniden kaldırdığı için dışarıdan görünen tek şey "oyun koptu"
   * olurdu.
   */
  it('simülasyon hatası röleyi öldürmüyor, maçı durduruyor', async () => {
    const paketler = [];
    const bitisler = [];
    const mac = new Mac({
      ayar: AYAR,
      yolla: (p) => paketler.push(p),
      bitince: (s) => bitisler.push(s),
    });

    // Hatayı simülasyonun içine koy
    mac.oyun.ilerlet = () => {
      throw new Error('sahte simülasyon hatası');
    };

    const hataGunlugu = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => mac.baslat()).not.toThrow();
    await tikBekle();
    hataGunlugu.mockRestore();

    // Maç durdu
    expect(mac.bittiMi).toBe(true);
    expect(mac.zamanlayici).toBe(null);

    // İki istemciye de sebebi gitti — "ayrıldı" değil, doğru sebep
    expect(paketler.some((p) => p.t === 'mac-hata')).toBe(true);
    expect(paketler.some((p) => p.t === 'ayrildi')).toBe(false);

    // Odanın maç kaydı temizlensin diye bitiş çağrıldı, ama SONUÇSUZ:
    // yarım kalan maçı puanlamak, çöktüğü an önde olanı ödüllendirirdi
    expect(bitisler).toEqual([null]);
  });

  it('durduktan sonra tik atmıyor', async () => {
    const paketler = [];
    const mac = new Mac({ ayar: AYAR, yolla: (p) => paketler.push(p) });
    mac.oyun.ilerlet = () => {
      throw new Error('sahte simülasyon hatası');
    };

    const hataGunlugu = vi.spyOn(console, 'error').mockImplementation(() => {});
    mac.baslat();
    await tikBekle();
    const hataSayisi = paketler.filter((p) => p.t === 'mac-hata').length;
    await tikBekle(120);
    hataGunlugu.mockRestore();

    // Zamanlayıcı durmasaydı her tikte bir hata paketi daha giderdi
    expect(paketler.filter((p) => p.t === 'mac-hata').length).toBe(hataSayisi);
    expect(hataSayisi).toBe(1);
  });

  it('sağlam maç normal koşuyor — koruma iyi yolu bozmuyor', async () => {
    const paketler = [];
    const mac = new Mac({ ayar: AYAR, yolla: (p) => paketler.push(p) });
    mac.baslat();
    await tikBekle(200);
    mac.durdur();

    expect(paketler.some((p) => p.t === 'durum')).toBe(true);
    expect(paketler.some((p) => p.t === 'mac-hata')).toBe(false);
  });
});
