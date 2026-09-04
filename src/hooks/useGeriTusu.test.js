import { describe, it, expect } from 'vitest';
import { geriKarari } from './useGeriTusu.js';

/**
 * Android donanım GERİ tuşu testleri.
 *
 * Bu davranışı tarayıcı testiyle sınamak MÜMKÜN DEĞİL: Capacitor'ın
 * donanım tuşu olayını Playwright tetikleyemiyor ve web'de böyle bir
 * tuş yok. Karar saf bir fonksiyona ayrıldı ki elle denemeye kalmasın
 * — elle deneme, mağazaya yükledikten sonra olurdu.
 *
 * En kritik iddia: maçta geri tuşu uygulamayı KAPATMAMALI. Kapatırsa
 * çevrimiçi maçta hükmen mağlubiyet demek, çünkü karşı taraf "rakip
 * ayrıldı" alıyor.
 */

describe('geri tuşu kararı', () => {
  it('maçta uygulamayı KAPATMIYOR ve ekran değiştirmiyor', () => {
    const karar = geriKarari('match');
    expect(karar.yut).toBe(true);
    expect(karar.hedef).toBe(null);
  });

  it('başlangıç ekranında yutmuyor — uygulama kapanır', () => {
    /*
     * Android'de en üst ekrandan geri tuşu uygulamadan çıkar. Burada
     * yutsaydık oyuncu uygulamadan çıkamaz, "kapanmıyor" derdi.
     */
    expect(geriKarari('start').yut).toBe(false);
  });

  it('çevrimiçi lobiden kadro ekranına dönüyor', () => {
    // Ekrandaki GERİ düğmesiyle aynı yer; ikisi ayrışırsa kafa karıştırır
    expect(geriKarari('online')).toEqual({ yut: true, hedef: 'select' });
  });

  it('öteki ekranlardan menüye dönüyor', () => {
    ['select', 'settings', 'tutorial', 'result', 'bracket'].forEach((ekran) => {
      expect(geriKarari(ekran)).toEqual({ yut: true, hedef: 'start' });
    });
  });

  it('bilinmeyen ekranda da uygulamayı kapatmıyor', () => {
    /*
     * İleride yeni bir ekran eklenirse burayı güncellemeyi unutmak
     * mümkün. Varsayılan davranış "menüye dön" olmalı; "uygulamayı
     * kapat" olsaydı unutmanın bedeli oyuncunun oyunu kapanması olurdu.
     */
    const karar = geriKarari('yeni-ekran');
    expect(karar.yut).toBe(true);
    expect(karar.hedef).toBe('start');
  });
});
