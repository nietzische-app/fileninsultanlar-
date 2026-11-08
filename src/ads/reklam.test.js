import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  reklamKimlikleri,
  reklamAcikMi,
  reklamKur,
  reklamSifirla,
  izlemeIzniIste,
  odulluGoster,
  gecisGoster,
  bannerGoster,
  TEST_ADMOB_APP,
  TEST_ADMOB_REWARD,
  TEST_ADMOB_BANNER,
  TEST_ADMOB_INTERSTITIAL,
  IOS_TEST_ADMOB,
  GECICI_DEMO_BIRIM,
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
  it('geçici bayrak AÇIKKEN iOS resmi demo birimlerini kullanır', () => {
    const k = reklamKimlikleri({
      VITE_ADMOB_IOS_APP_ID: 'ca-app-pub-1111111111111111~2222222222',
    }, { geciciDemo: true });
    expect(k.appId).toBe(IOS_TEST_ADMOB.app);
    expect(k.banner).toBe(IOS_TEST_ADMOB.banner);
    expect(k.interstitial).toBe(IOS_TEST_ADMOB.interstitial);
    expect(k.rewarded).toBe(IOS_TEST_ADMOB.rewarded);
    expect(k.rewardedInterstitial).toBe(IOS_TEST_ADMOB.rewardedInterstitial);
    expect(k.demo).toBe(true);
  });

  it('Android geçici durumda Android demo birimine düşer', () => {
    const k = reklamKimlikleri({}, { platform: 'android', geciciDemo: true });
    expect(k.appId).toBe(TEST_ADMOB_APP);
    expect(k.rewarded).toBe(TEST_ADMOB_REWARD);
    expect(k.banner).toBe(TEST_ADMOB_BANNER);
    expect(k.interstitial).toBe(TEST_ADMOB_INTERSTITIAL);
  });

  it('YAYINDA geçici bayrak kapalı', () => {
    /*
     * Asıl arıza buydu: bayrak `true` commit edildi ve mağazadaki iki
     * sürüm de demo reklam istedi. Bu satır onu bir daha kaçırmıyor.
     */
    expect(GECICI_DEMO_BIRIM).toBe(false);
  });

  it('Android gerçek kimlikleri verilince onları kullanır', () => {
    const k = reklamKimlikleri({
      VITE_ADMOB_APP_ID: 'ca-app-pub-1111111111111111~2222222222',
      VITE_ADMOB_REWARDED_ID: 'ca-app-pub-1111111111111111/3333333333',
      VITE_ADMOB_INTERSTITIAL_ID: 'ca-app-pub-1111111111111111/4444444444',
      VITE_ADMOB_BANNER_ID: 'ca-app-pub-1111111111111111/5555555555',
    }, { geciciDemo: false, platform: 'android' });
    expect(k.test).toBe(false);
    expect(k.demo).toBe(false);
    expect(k.eksik).toEqual([]);
    expect(k.appId).toContain('2222222222');
    expect(k.rewarded).toContain('3333333333');
    expect(k.interstitial).toContain('4444444444');
    expect(k.banner).toContain('5555555555');
  });

  it('ANDROID KİMLİĞİ iOS TARAFINA SIZMAZ', () => {
    /*
     * AdMob uygulama ve birim kimliklerini platform başına veriyor;
     * iOS'ta Android birimini istemek "no fill" demek. Bayrak
     * kapatıldığında eski kod iki platforma da aynı `VITE_ADMOB_*`
     * değerini veriyordu, yani iOS sessizce boş dönecekti.
     */
    const env = {
      VITE_ADMOB_APP_ID: 'ca-app-pub-1111111111111111~2222222222',
      VITE_ADMOB_REWARDED_ID: 'ca-app-pub-1111111111111111/3333333333',
    };
    const k = reklamKimlikleri(env, { geciciDemo: false, platform: 'ios' });
    expect(k.appId).not.toContain('1111111111111111');
    expect(k.rewarded).not.toContain('3333333333');
    // Android değeri yerine İOS demo birimine düşmeli
    expect(k.appId).toBe(IOS_TEST_ADMOB.app);
    expect(k.rewarded).toBe(IOS_TEST_ADMOB.rewarded);
  });

  it('eksik değişken demo birime düşer, test açılır ve adı bildirilir', () => {
    const k = reklamKimlikleri({
      VITE_ADMOB_IOS_APP_ID: 'ca-app-pub-1111111111111111~2222222222',
      VITE_ADMOB_IOS_REWARDED_ID: 'ca-app-pub-1111111111111111/3333333333',
    }, { geciciDemo: false, platform: 'ios' });
    expect(k.appId).toContain('2222222222');
    expect(k.rewarded).toContain('3333333333');
    // Verilmeyen iki yuva demoya düştü
    expect(k.interstitial).toBe(IOS_TEST_ADMOB.interstitial);
    expect(k.banner).toBe(IOS_TEST_ADMOB.banner);
    expect(k.test).toBe(true);
    expect(k.eksik).toEqual([
      'VITE_ADMOB_IOS_INTERSTITIAL_ID',
      'VITE_ADMOB_IOS_BANNER_ID',
    ]);
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

describe('izleme izni', () => {
  function izinli(status) {
    const sira = [];
    let durum = status;
    const AdMob = {
      initialize: async () => { sira.push('initialize'); },
      trackingAuthorizationStatus: async () => ({ status: durum }),
      requestTrackingAuthorization: async () => {
        sira.push('requestTracking');
        durum = 'authorized';
      },
    };
    return { sira, AdMob };
  }

  it('iOS’ta SDK kurulmadan önce sistem iznini ister', async () => {
    const { sira, AdMob } = izinli('notDetermined');
    const ok = await reklamKur(kabuk, { eklenti: { AdMob }, izlemeBekleMs: 0 });
    expect(ok).toBe(true);
    expect(sira.indexOf('requestTracking')).toBeGreaterThan(-1);
    expect(sira.indexOf('requestTracking')).toBeLessThan(sira.indexOf('initialize'));
  });

  it('izin daha önce verildiyse diyaloğu yeniden açmaz', async () => {
    const { sira, AdMob } = izinli('authorized');
    const sonuc = await izlemeIzniIste(AdMob, kabuk, 0);
    expect(sonuc).toBe('authorized');
    expect(sira).not.toContain('requestTracking');
  });

  it('izin reddedilse de SDK kurulur', async () => {
    const sira = [];
    const AdMob = {
      initialize: async () => { sira.push('initialize'); },
      trackingAuthorizationStatus: async () => ({ status: 'denied' }),
      requestTrackingAuthorization: async () => { sira.push('requestTracking'); },
    };
    const ok = await reklamKur(kabuk, { eklenti: { AdMob }, izlemeBekleMs: 0 });
    expect(ok).toBe(true);
    expect(sira).toEqual(['initialize']);
  });

  it('izin çağrısı düşerse kuruluma devam eder', async () => {
    const hata = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sira = [];
    const AdMob = {
      initialize: async () => { sira.push('initialize'); },
      requestTrackingAuthorization: async () => {
        throw { code: 1, message: 'att yok' };
      },
    };
    const ok = await reklamKur(kabuk, { eklenti: { AdMob }, izlemeBekleMs: 0 });
    expect(ok).toBe(true);
    expect(sira).toEqual(['initialize']);
    expect(hata.mock.calls.map((satir) => satir.join(' ')).join('\n')).toContain('message=att yok');
  });

  it('Android’de izleme diyaloğu açmaz', async () => {
    const android = {
      Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' },
    };
    const sira = [];
    const AdMob = {
      initialize: async () => { sira.push('initialize'); },
      requestTrackingAuthorization: async () => { sira.push('requestTracking'); },
    };
    const ok = await reklamKur(android, { eklenti: { AdMob }, izlemeBekleMs: 0 });
    expect(ok).toBe(true);
    expect(sira).toEqual(['initialize']);
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
