import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  reklamKimlikleri,
  reklamAcikMi,
  reklamKur,
  reklamSifirla,
  odulluGoster,
  gecisGoster,
  bannerGoster,
  demoFormlariYukle,
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

describe('demo formları', () => {
  function demoEklenti(olaylar, davranis = {}) {
    const sira = [];
    const dinleyiciler = {};
    const AdMob = {
      initialize: async () => { sira.push('initialize'); },
      addListener: async (olay, fn) => {
        sira.push(`listen:${olay}`);
        dinleyiciler[olay] = fn;
        return { remove: async () => {} };
      },
      prepareRewardVideoAd: async (secenek) => {
        sira.push(`prepareReward:${secenek.adId}`);
        if (davranis.odulHata) throw davranis.odulHata;
      },
      prepareInterstitial: async (secenek) => {
        sira.push(`prepareInterstitial:${secenek.adId}`);
        if (davranis.gecisHata) throw davranis.gecisHata;
      },
      showBanner: async (secenek) => {
        sira.push(`showBanner:${secenek.adId}`);
        if (davranis.bannerHata) throw davranis.bannerHata;
        dinleyiciler[olaylar.BannerAdPluginEvents.Loaded]?.();
      },
      removeBanner: async () => { sira.push('removeBanner'); },
    };
    return { sira, eklenti: { AdMob, ...olaylar } };
  }

  it('iOS demo birimlerini yükler ve başarıyı yazar', async () => {
    const bilgi = vi.spyOn(console, 'info').mockImplementation(() => {});
    const hata = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { sira, eklenti } = demoEklenti(OLAY);
    const sonuc = await demoFormlariYukle(kabuk, { eklenti, zamanAsimiMs: 50 });
    expect(sonuc).toEqual({ banner: true, interstitial: true, rewarded: true });
    expect(sira.some((ad) => ad === `prepareReward:${IOS_TEST_ADMOB.rewarded}`)).toBe(true);
    expect(sira.some((ad) => ad === `prepareInterstitial:${IOS_TEST_ADMOB.interstitial}`)).toBe(true);
    expect(sira.some((ad) => ad === `showBanner:${IOS_TEST_ADMOB.banner}`)).toBe(true);
    const reward = sira.indexOf(`prepareReward:${IOS_TEST_ADMOB.rewarded}`);
    const show = sira.indexOf('showReward');
    expect(show).toBe(-1);
    expect(sira.indexOf('showInterstitial')).toBe(-1);
    expect(sira.indexOf('removeBanner')).toBeGreaterThan(sira.indexOf(`showBanner:${IOS_TEST_ADMOB.banner}`));
    expect(reward).toBeGreaterThan(-1);
    const yazilan = bilgi.mock.calls.map((satir) => satir.join(' ')).join('\n');
    expect(yazilan).toContain('ödüllü yüklendi');
    expect(yazilan).toContain('geçiş yüklendi');
    expect(yazilan).toContain('banner yüklendi');
    expect(hata).not.toHaveBeenCalled();
  });

  it('Android demo birimlerini kullanır', async () => {
    reklamSifirla();
    const android = {
      Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' },
    };
    const { sira, eklenti } = demoEklenti(OLAY);
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await demoFormlariYukle(android, { eklenti, zamanAsimiMs: 50 });
    expect(sira.some((ad) => ad.includes('5224354917'))).toBe(true);
    expect(sira.some((ad) => ad.includes('1033173712'))).toBe(true);
    expect(sira.some((ad) => ad.includes('6300978111'))).toBe(true);
  });

  it('yükleme hatasını code ve message ile yazar', async () => {
    reklamSifirla();
    const hata = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { eklenti } = demoEklenti(OLAY, {
      odulHata: { code: 3, message: 'No fill' },
    });
    const sonuc = await demoFormlariYukle(kabuk, { eklenti, zamanAsimiMs: 50 });
    expect(sonuc.rewarded).toBe(false);
    expect(sonuc.interstitial).toBe(true);
    expect(sonuc.banner).toBe(true);
    const yazilan = hata.mock.calls.map((satir) => satir.join(' ')).join('\n');
    expect(yazilan).toContain('code=3');
    expect(yazilan).toContain('message=No fill');
    expect(yazilan).toContain(IOS_TEST_ADMOB.rewarded);
  });
});
