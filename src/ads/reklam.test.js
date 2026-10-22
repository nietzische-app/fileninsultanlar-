import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  reklamKimlikleri,
  reklamAcikMi,
  reklamKur,
  reklamSifirla,
  odulluGoster,
  gecisGoster,
  bannerGoster,
  TEST_ADMOB_APP,
  TEST_ADMOB_REWARD,
  IOS_TEST_ADMOB,
} from './reklam.js';

const kabuk = {
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => 'ios',
  },
};

function sahteEklenti(olaylar, davranis = {}) {
  const sira = [];
  const dinleyiciler = {};
  const AdMob = {
    initialize: async () => {
      sira.push('initialize');
    },
    addListener: async (olay, fn) => {
      sira.push(`listen:${olay}`);
      dinleyiciler[olay] = fn;
      return { remove: async () => {} };
    },
    prepareRewardVideoAd: async (secenek) => {
      sira.push(`prepareReward:${secenek.adId}`);
      if (davranis.odulHata) throw davranis.odulHata;
      dinleyiciler[olaylar.RewardAdPluginEvents.Loaded]?.();
    },
    showRewardVideoAd: async () => {
      sira.push('showReward');
      return { type: 'fp', amount: 1 };
    },
    prepareInterstitial: async (secenek) => {
      sira.push(`prepareInterstitial:${secenek.adId}`);
    },
    showInterstitial: async () => {
      sira.push('showInterstitial');
    },
    showBanner: async (secenek) => {
      sira.push(`showBanner:${secenek.adId}`);
    },
  };
  return { sira, eklenti: { AdMob, ...olaylar } };
}

const OLAY = {
  RewardAdPluginEvents: {
    FailedToLoad: 'rewardFailLoad',
    FailedToShow: 'rewardFailShow',
    Loaded: 'rewardLoaded',
    Rewarded: 'reward',
  },
  InterstitialAdPluginEvents: {
    FailedToLoad: 'interFailLoad',
    FailedToShow: 'interFailShow',
    Loaded: 'interLoaded',
  },
  BannerAdPluginEvents: {
    FailedToLoad: 'bannerFailLoad',
    SizeChanged: 'bannerSize',
    Loaded: 'bannerLoaded',
  },
  BannerAdPosition: { BOTTOM_CENTER: 'BOTTOM_CENTER' },
  BannerAdSize: { ADAPTIVE_BANNER: 'ADAPTIVE_BANNER' },
};

afterEach(() => {
  reklamSifirla();
  vi.restoreAllMocks();
});

describe('reklam kimlikleri', () => {
  it('geçici durumda iOS resmi demo birimlerini kullanır', () => {
    const k = reklamKimlikleri({
      VITE_ADMOB_APP_ID: 'ca-app-pub-1111111111111111~2222222222',
      VITE_ADMOB_REWARDED_ID: 'ca-app-pub-1111111111111111/3333333333',
    });
    expect(k.appId).toBe(IOS_TEST_ADMOB.app);
    expect(k.banner).toBe(IOS_TEST_ADMOB.banner);
    expect(k.interstitial).toBe(IOS_TEST_ADMOB.interstitial);
    expect(k.rewarded).toBe(IOS_TEST_ADMOB.rewarded);
    expect(k.rewardedInterstitial).toBe(IOS_TEST_ADMOB.rewardedInterstitial);
    expect(k.demo).toBe(true);
  });

  it('Android geçici durumda Android demo birimine düşer', () => {
    const k = reklamKimlikleri({}, { platform: 'android' });
    expect(k.appId).toBe(TEST_ADMOB_APP);
    expect(k.rewarded).toBe(TEST_ADMOB_REWARD);
    expect(k.banner).toBe('ca-app-pub-3940256099942544/6300978111');
    expect(k.interstitial).toBe('ca-app-pub-3940256099942544/1033173712');
  });

  it('geçici bayrak kapanınca gerçek kimlik test bayrağını kapatır', () => {
    const k = reklamKimlikleri({
      VITE_ADMOB_APP_ID: 'ca-app-pub-1111111111111111~2222222222',
      VITE_ADMOB_REWARDED_ID: 'ca-app-pub-1111111111111111/3333333333',
    }, { geciciDemo: false });
    expect(k.test).toBe(false);
    expect(k.demo).toBe(false);
    expect(k.appId).toContain('1111111111111111');
    expect(k.rewarded).toContain('3333333333');
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

describe('yükle sonra göster', () => {
  it('ödüllü reklamı yüklemeden göstermez', async () => {
    const { sira, eklenti } = sahteEklenti(OLAY);
    const odul = await odulluGoster(kabuk, { eklenti });
    expect(odul).toBe(true);
    const prepare = sira.findIndex((ad) => ad.startsWith('prepareReward'));
    const show = sira.indexOf('showReward');
    const dinle = sira.findIndex((ad) => ad === 'listen:rewardFailLoad');
    expect(sira[0]).toBe('initialize');
    expect(dinle).toBeGreaterThan(-1);
    expect(dinle).toBeLessThan(prepare);
    expect(prepare).toBeLessThan(show);
    expect(sira[prepare]).toContain(IOS_TEST_ADMOB.rewarded);
  });

  it('yükleme hatasında code ve message yazar, göstermez', async () => {
    const hata = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { sira, eklenti } = sahteEklenti(OLAY, {
      odulHata: { code: 3, message: 'No fill' },
    });
    const odul = await odulluGoster(kabuk, { eklenti });
    expect(odul).toBe(false);
    expect(sira).not.toContain('showReward');
    const yazilan = hata.mock.calls.map((satir) => satir.join(' ')).join('\n');
    expect(yazilan).toContain('code=3');
    expect(yazilan).toContain('message=No fill');
  });

  it('geçiş reklamını prepare bitmeden göstermez', async () => {
    const { sira, eklenti } = sahteEklenti(OLAY);
    const ok = await gecisGoster(kabuk, { eklenti });
    expect(ok).toBe(true);
    const prepare = sira.findIndex((ad) => ad.startsWith('prepareInterstitial'));
    const show = sira.indexOf('showInterstitial');
    expect(sira.findIndex((ad) => ad === 'listen:interFailLoad')).toBeLessThan(prepare);
    expect(prepare).toBeLessThan(show);
    expect(sira[prepare]).toContain(IOS_TEST_ADMOB.interstitial);
  });

  it('banner hata dinleyicisini göstermeden bağlar', async () => {
    const { sira, eklenti } = sahteEklenti(OLAY);
    const ok = await bannerGoster(kabuk, { eklenti });
    expect(ok).toBe(true);
    const dinle = sira.findIndex((ad) => ad === 'listen:bannerFailLoad');
    const show = sira.findIndex((ad) => ad.startsWith('showBanner'));
    expect(dinle).toBeGreaterThan(-1);
    expect(dinle).toBeLessThan(show);
    expect(sira[show]).toContain(IOS_TEST_ADMOB.banner);
  });
});
