import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEGERLENDIRME,
  degerlendirmeIslendi,
  degerlendirmeIste,
  degerlendirmeKarari,
  degerlendirmeOku,
  olumluAn,
  oturumBaslat,
} from './degerlendirme.js';

const GUN = 24 * 60 * 60 * 1000;
const yerli = {
  Capacitor: { isNativePlatform: () => true },
};

describe('değerlendirme', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('kayıp, antrenman ve hayatta kalma olumlu değil', () => {
    expect(olumluAn({ winner: 'away', campaign: 'match' }, null)).toBe(false);
    expect(olumluAn({ winner: 'home', format: 'practice' }, null)).toBe(false);
    expect(olumluAn({ winner: null, campaign: 'survival', survival: { points: 20 } }, null)).toBe(false);
    expect(olumluAn({ winner: 'away', campaign: 'tournament' }, { champion: false, status: 'lost' })).toBe(false);
  });

  it('galibiyet ve kupa olumlu', () => {
    expect(olumluAn({ winner: 'home', campaign: 'match', format: 'classic' }, null)).toBe(true);
    expect(olumluAn({ winner: 'home', campaign: 'tournament' }, { champion: true })).toBe(true);
    expect(olumluAn({ winner: 'home', campaign: 'tournament' }, { status: 'won' })).toBe(true);
  });

  it('üçüncü galibiyetten önce sormaz', () => {
    oturumBaslat(1_000);
    const karar = degerlendirmeKarari({ olumlu: true, galibiyet: 2 }, 1_000);
    expect(karar).toEqual({ iste: false, neden: 'galibiyet' });
  });

  it('üçüncü galibiyette, ilk oturumda sorar', () => {
    oturumBaslat(1_000);
    expect(degerlendirmeKarari({ olumlu: true, galibiyet: 3 }, 1_000)).toEqual({
      iste: true,
      neden: 'tamam',
    });
  });

  it('olumsuz anda galibiyet sayısı yetse de sormaz', () => {
    oturumBaslat(1_000);
    expect(degerlendirmeKarari({ olumlu: false, galibiyet: 9 }, 1_000).neden).toBe('olumlu-degil');
  });

  it('aynı oturumda bir kez, 30 günde bir, en fazla 3', () => {
    const t0 = 1_700_000_000_000;
    oturumBaslat(t0);
    expect(degerlendirmeKarari({ olumlu: true, galibiyet: 3 }, t0).iste).toBe(true);
    degerlendirmeIslendi(t0);
    expect(degerlendirmeKarari({ olumlu: true, galibiyet: 4 }, t0 + 1000).neden).toBe('aralik');

    // Uygulama 30 gün açık kalsa bile aynı oturumda ikinci kez sorma.
    const acikKaldi = t0 + DEGERLENDIRME.aralikMs + 1;
    expect(degerlendirmeKarari({ olumlu: true, galibiyet: 4 }, acikKaldi).neden).toBe('oturum-ici');

    const sonra = t0 + DEGERLENDIRME.oturumAraligiMs + 1;
    oturumBaslat(sonra);
    expect(degerlendirmeKarari({ olumlu: true, galibiyet: 4 }, sonra).neden).toBe('aralik');

    const aySonra = t0 + DEGERLENDIRME.aralikMs + 1;
    oturumBaslat(aySonra);
    expect(degerlendirmeKarari({ olumlu: true, galibiyet: 4 }, aySonra).iste).toBe(true);
    degerlendirmeIslendi(aySonra);
    degerlendirmeIslendi(aySonra + GUN);
    expect(degerlendirmeOku().soru).toBe(3);
    const ucuncuOturum = aySonra + DEGERLENDIRME.oturumAraligiMs + GUN;
    oturumBaslat(ucuncuOturum);
    expect(degerlendirmeKarari({ olumlu: true, galibiyet: 8 }, ucuncuOturum).neden).toBe('tavan');
  });

  it('30 dk içindeki ikinci açılış yeni oturum sayılmaz', () => {
    oturumBaslat(5_000);
    oturumBaslat(5_000 + 60_000);
    expect(degerlendirmeOku().oturum).toBe(1);
    oturumBaslat(5_000 + DEGERLENDIRME.oturumAraligiMs + 5);
    expect(degerlendirmeOku().oturum).toBe(2);
  });

  it('bozuk kayıt sıfırdan okunur', () => {
    localStorage.setItem('retro-voleybol-degerlendirme', '{');
    expect(degerlendirmeOku()).toMatchObject({ oturum: 0, soru: 0 });
  });

  it('webde yerel API çağrılmaz', async () => {
    let cagrildi = false;
    const ok = await degerlendirmeIste(globalThis, async () => {
      cagrildi = true;
    });
    expect(ok).toBe(false);
    expect(cagrildi).toBe(false);
  });

  it('yerel kabukta başarı kotaya yazılmaz, çağıran yazar', async () => {
    const ok = await degerlendirmeIste(yerli, async () => {});
    expect(ok).toBe(true);
    expect(degerlendirmeOku().soru).toBe(0);
  });

  it('yerel çağrı patlarsa false, kota artmaz', async () => {
    const ok = await degerlendirmeIste(yerli, async () => {
      throw new Error('Play yok');
    });
    expect(ok).toBe(false);
    expect(degerlendirmeOku().soru).toBe(0);
  });
});
