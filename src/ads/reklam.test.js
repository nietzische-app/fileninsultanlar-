import { describe, it, expect } from 'vitest';
import {
  reklamKimlikleri,
  reklamAcikMi,
  reklamKur,
  reklamSifirla,
  TEST_ADMOB_APP,
  TEST_ADMOB_REWARD,
} from './reklam.js';

describe('reklam kimlikleri', () => {
  it('env yoksa Google test birimine düşer', () => {
    const k = reklamKimlikleri({});
    expect(k.appId).toBe(TEST_ADMOB_APP);
    expect(k.rewarded).toBe(TEST_ADMOB_REWARD);
    expect(k.test).toBe(true);
  });

  it('gerçek kimlik test bayrağını kapatır', () => {
    const k = reklamKimlikleri({
      VITE_ADMOB_APP_ID: 'ca-app-pub-1111111111111111~2222222222',
      VITE_ADMOB_REWARDED_ID: 'ca-app-pub-1111111111111111/3333333333',
    });
    expect(k.test).toBe(false);
    expect(k.appId).toContain('1111111111111111');
  });
});

describe('reklam yalnız native', () => {
  it('Capacitor yokken kapalı', () => {
    expect(reklamAcikMi({})).toBe(false);
  });

  it('isNativePlatform true iken açık', () => {
    expect(reklamAcikMi({ Capacitor: { isNativePlatform: () => true } })).toBe(true);
  });
});

describe('reklamKur eklenti yokken', () => {
  it('isPluginAvailable false ise SDK yüklemez', async () => {
    reklamSifirla();
    const ok = await reklamKur({
      Capacitor: {
        isNativePlatform: () => true,
        isPluginAvailable: () => false,
      },
    });
    expect(ok).toBe(false);
  });
});
