import { describe, it, expect } from 'vitest';
import { kaliteAdi, KADEME } from './baglantiKalite.js';
import { PLAYER, PHYSICS } from './constants.js';

/**
 * Eşiklerin ÖLÇÜMLE bağını koruyan testler.
 *
 * Buradaki asıl risk, sayıların zamanla anlamını yitirmesi: biri
 * `hitRadius`ı değiştirir, temas penceresi daralır, eşikler eski
 * ölçüme göre kalır ve gösterge sessizce yalan söylemeye başlar.
 * O yüzden testlerden biri eşiği kadroyla değil TEMAS PENCERESİYLE
 * karşılaştırıyor.
 */

describe('bağlantı kalitesi kademeleri', () => {
  it('ölçüm yoksa kademe de YOK', () => {
    /*
     * "Bilinmiyor" ile "kötü" aynı şey değil. Çevrimdışı bir maçta ya
     * da ilk paket gelmeden kötü bir gösterge çıksaydı oyuncu kendi
     * internetinde olmayan bir sorun arardı.
     */
    expect(kaliteAdi(null)).toBeNull();
    expect(kaliteAdi(undefined)).toBeNull();
    expect(kaliteAdi(NaN)).toBeNull();
    expect(kaliteAdi('120')).toBeNull();
    expect(kaliteAdi(-5)).toBeNull();
  });

  it('kademeler sırayla ilerliyor', () => {
    expect(kaliteAdi(0)).toBe('iyi');
    expect(kaliteAdi(KADEME.iyi)).toBe('iyi');
    expect(kaliteAdi(KADEME.iyi + 1)).toBe('orta');
    expect(kaliteAdi(KADEME.orta)).toBe('orta');
    expect(kaliteAdi(KADEME.orta + 1)).toBe('kotu');
    expect(kaliteAdi(5000)).toBe('kotu');
  });

  it('sınırlar tutarlı: iyi < orta', () => {
    expect(KADEME.iyi).toBeLessThan(KADEME.orta);
  });

  it('EŞİKLER ölçümün dayandığı temas penceresiyle uyumlu', () => {
    /*
     * Eşikler `npm run olcum:top` ölçümünden çıktı ve o ölçümün
     * ölçütü temas penceresiydi: 100 ms gidiş-dönüşte p95 sapma 69 px,
     * yani pencerenin (~65 px) tam sınırında. Pencere değişirse eşik
     * de yeniden ölçülmeli.
     *
     * Bu test pencereyi KODDAN hesaplıyor; biri `hitRadius`ı ya da
     * salınım payını değiştirirse burada durur ve ölçümü tazelemek
     * gerektiğini söyler.
     */
    const pencere = PLAYER.hitRadius + PLAYER.reachBonus + PHYSICS.ballRadius;
    expect(
      pencere,
      'Temas penceresi değişmiş — eşikler `npm run olcum:top` ile yeniden ölçülmeli',
    ).toBe(65);
  });

  it('gerçek ölçüm noktaları beklenen kademeye düşüyor', () => {
    // Ölçüm tablosundaki gidiş-dönüş değerleri (bkz. baglantiKalite.js)
    expect(kaliteAdi(0)).toBe('iyi');     // p95 65 px — pencerede
    expect(kaliteAdi(100)).toBe('iyi');   // p95 69 px — pencerede
    expect(kaliteAdi(200)).toBe('orta');  // p95 119 px — 2 katı
    expect(kaliteAdi(300)).toBe('kotu');  // p95 170 px — 3 katı
    expect(kaliteAdi(600)).toBe('kotu');  // medyan bile pencerede
  });
});
