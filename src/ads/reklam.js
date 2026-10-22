/**
 * Reklam — yalnız mağaza kabuğunda.
 *
 * Web'de çağrılmaz. Eklenti yoksa ya da izleme yarıda kesilirse ödül
 * yok: sessizce "devam et" vermek reklamı atlatmanın yolu olurdu.
 *
 * Geçici olarak gerçek birimler kapalı. iOS Google'ın resmi demo
 * birimlerini kullanır; Android kendi demo birimlerini. `isTesting`
 * bilinçli olarak kapalı: eklenti bu bayrak açıkken iOS banner ve
 * interstitial kimliğini Android demo birimiyle değiştiriyor, istek
 * de "no fill" ile düşüyor.
 *
 * Yayın öncesi `GECICI_DEMO_BIRIM` false olmalı. O zaman kimlikler
 * yine `VITE_ADMOB_APP_ID` / `VITE_ADMOB_REWARDED_ID`.
 */

import { yerelKabukMu } from '../utils/gizlilik.js';

/** Yayın öncesi kapat. Açıkken ortam değişkenindeki gerçek birim yok sayılır. */
export const GECICI_DEMO_BIRIM = true;

/** Google'ın Android demo birimleri. */
export const TEST_ADMOB_APP = 'ca-app-pub-3940256099942544~3347511713';
export const TEST_ADMOB_REWARD = 'ca-app-pub-3940256099942544/5224354917';
export const TEST_ADMOB_BANNER = 'ca-app-pub-3940256099942544/6300978111';
export const TEST_ADMOB_INTERSTITIAL = 'ca-app-pub-3940256099942544/1033173712';

/**
 * Google'ın resmi iOS demo birimleri.
 * https://developers.google.com/admob/ios/test-ads
 */
export const IOS_TEST_ADMOB = {
  app: 'ca-app-pub-3940256099942544~1458002511',
  banner: 'ca-app-pub-3940256099942544/2934735716',
  interstitial: 'ca-app-pub-3940256099942544/4411468910',
  rewarded: 'ca-app-pub-3940256099942544/1712485313',
  rewardedInterstitial: 'ca-app-pub-3940256099942544/6978759866',
};

export function reklamKimlikleri(env = import.meta.env, secenek = {}) {
  const gecici = secenek.geciciDemo ?? GECICI_DEMO_BIRIM;
  const platform = secenek.platform === 'android' ? 'android' : 'ios';
  if (gecici && platform === 'ios') {
    return {
      appId: IOS_TEST_ADMOB.app,
      banner: IOS_TEST_ADMOB.banner,
      interstitial: IOS_TEST_ADMOB.interstitial,
      rewarded: IOS_TEST_ADMOB.rewarded,
      rewardedInterstitial: IOS_TEST_ADMOB.rewardedInterstitial,
      test: true,
      demo: true,
    };
  }
  if (gecici) {
    return {
      appId: TEST_ADMOB_APP,
      banner: TEST_ADMOB_BANNER,
      interstitial: TEST_ADMOB_INTERSTITIAL,
      rewarded: TEST_ADMOB_REWARD,
      rewardedInterstitial: 'ca-app-pub-3940256099942544/5354046379',
      test: true,
      demo: true,
    };
  }
  const appId = String(env?.VITE_ADMOB_APP_ID || '').trim() || TEST_ADMOB_APP;
  const rewarded = String(env?.VITE_ADMOB_REWARDED_ID || '').trim() || TEST_ADMOB_REWARD;
  const banner = String(env?.VITE_ADMOB_BANNER_ID || '').trim() || TEST_ADMOB_BANNER;
  const interstitial = String(env?.VITE_ADMOB_INTERSTITIAL_ID || '').trim() || TEST_ADMOB_INTERSTITIAL;
  return {
    appId,
    banner,
    interstitial,
    rewarded,
    rewardedInterstitial: interstitial,
    test: appId === TEST_ADMOB_APP || rewarded === TEST_ADMOB_REWARD,
    demo: false,
  };
}

export function reklamAcikMi(kap = globalThis) {
  return yerelKabukMu(kap);
}

function platformAdi(kap) {
  const ad = kap?.Capacitor?.getPlatform?.();
  return ad === 'android' ? 'android' : 'ios';
}

/**
 * Yükleme / gösterme hatasını konsola yazar. `code` ve `message`
 * AdMob'un döndürdüğü alanlar; promise reddi bazen code'u yazı verir.
 * @param {string} asama
 * @param {unknown} hata
 */
export function reklamHatasiYaz(asama, hata) {
  const kayit = hata && typeof hata === 'object' ? hata : {};
  const code = kayit.code ?? kayit.errorCode ?? (typeof hata === 'string' ? 'yok' : 'yok');
  const message = kayit.message
    ?? kayit.errorMessage
    ?? (typeof hata === 'string' ? hata : '');
  console.error(
    `[AdMob] ${asama} başarısız`,
    `code=${code}`,
    `message=${message || 'yok'}`,
  );
}

let kurulu = false;
let hazirSoz = null;

async function eklenti() {
  const mod = await import('@capacitor-community/admob');
  return {
    AdMob: mod.AdMob ?? mod.default,
    RewardAdPluginEvents: mod.RewardAdPluginEvents,
    InterstitialAdPluginEvents: mod.InterstitialAdPluginEvents,
    BannerAdPluginEvents: mod.BannerAdPluginEvents,
    BannerAdPosition: mod.BannerAdPosition,
    BannerAdSize: mod.BannerAdSize,
  };
}

async function apiAl(bag) {
  return bag?.eklenti ?? eklenti();
}

async function dinle(AdMob, olay, fn, tut) {
  if (!olay || typeof AdMob?.addListener !== 'function') return;
  const tutamak = await AdMob.addListener(olay, fn);
  tut.push(tutamak);
}

async function dinleyicileriBirak(tut) {
  await Promise.all(tut.map((d) => d?.remove?.()));
}

/**
 * SDK'yı bir kez kur. Web'de no-op.
 * @returns {Promise<boolean>}
 */
export async function reklamKur(kap = globalThis, bag = {}) {
  if (!reklamAcikMi(kap)) return false;
  /*
   * E2E Capacitor sahtesinde eklenti yoktur. Gerçek kabukta
   * `isPluginAvailable` yoksa (eski köprü) içe aktarmayı deneriz.
   */
  if (typeof kap?.Capacitor?.isPluginAvailable === 'function'
    && kap.Capacitor.isPluginAvailable('AdMob') === false) {
    return false;
  }
  if (kurulu) return true;
  if (hazirSoz) return hazirSoz;
  hazirSoz = (async () => {
    try {
      const { AdMob } = await apiAl(bag);
      const kim = reklamKimlikleri(undefined, { platform: platformAdi(kap) });
      await AdMob.initialize({
        initializeForTesting: kim.demo ? false : kim.test,
      });
      kurulu = true;
      return true;
    } catch (hata) {
      reklamHatasiYaz('SDK kurulumu', hata);
      kurulu = false;
      return false;
    }
  })();
  const ok = await hazirSoz;
  if (!ok) hazirSoz = null;
  return ok;
}

/**
 * Önce yükle, yükleme bitmeden gösterme.
 * Yükleme reddederse ya da FailedToLoad gelirse show çağrılmaz.
 */
async function yukleSonraGoster({
  AdMob,
  asama,
  failedToLoad,
  failedToShow,
  ekstra,
  yukle,
  goster,
}) {
  const tut = [];
  let yuklenemedi = false;
  try {
    await dinle(AdMob, failedToLoad, (hata) => {
      yuklenemedi = true;
      reklamHatasiYaz(`${asama} yükleme`, hata);
    }, tut);
    await dinle(AdMob, failedToShow, (hata) => {
      reklamHatasiYaz(`${asama} gösterme`, hata);
    }, tut);
    if (ekstra) await ekstra(tut);
    await yukle();
    if (yuklenemedi) return false;
    await goster();
    if (yuklenemedi) return false;
    return true;
  } catch (hata) {
    reklamHatasiYaz(asama, hata);
    return false;
  } finally {
    await dinleyicileriBirak(tut);
  }
}

/**
 * Ödüllü videoyu gösterir. Kullanıcı ödülü tamamlamazsa false.
 * Sıra: dinleyici → prepareRewardVideoAd → showRewardVideoAd.
 * @returns {Promise<boolean>}
 */
export async function odulluGoster(kap = globalThis, bag = {}) {
  if (!reklamAcikMi(kap)) return false;
  const ok = await reklamKur(kap, bag);
  if (!ok) return false;
  const { AdMob, RewardAdPluginEvents } = await apiAl(bag);
  const kim = reklamKimlikleri(undefined, { platform: platformAdi(kap) });
  let odul = false;
  const gosterildi = await yukleSonraGoster({
    AdMob,
    asama: 'ödüllü',
    failedToLoad: RewardAdPluginEvents?.FailedToLoad,
    failedToShow: RewardAdPluginEvents?.FailedToShow,
    ekstra: (tut) => dinle(AdMob, RewardAdPluginEvents?.Rewarded, () => {
      odul = true;
    }, tut),
    yukle: () => AdMob.prepareRewardVideoAd({
      adId: kim.rewarded,
      isTesting: kim.demo ? false : kim.test,
    }),
    goster: async () => {
      const sonuc = await AdMob.showRewardVideoAd();
      if (sonuc && (sonuc.type || sonuc.amount)) odul = true;
    },
  });
  return gosterildi && odul;
}

/**
 * Geçiş reklamı. Sıra: dinleyici → prepareInterstitial → showInterstitial.
 * @returns {Promise<boolean>}
 */
export async function gecisGoster(kap = globalThis, bag = {}) {
  if (!reklamAcikMi(kap)) return false;
  const ok = await reklamKur(kap, bag);
  if (!ok) return false;
  const { AdMob, InterstitialAdPluginEvents } = await apiAl(bag);
  const kim = reklamKimlikleri(undefined, { platform: platformAdi(kap) });
  return yukleSonraGoster({
    AdMob,
    asama: 'geçiş',
    failedToLoad: InterstitialAdPluginEvents?.FailedToLoad,
    failedToShow: InterstitialAdPluginEvents?.FailedToShow,
    yukle: () => AdMob.prepareInterstitial({
      adId: kim.interstitial,
      isTesting: false,
    }),
    goster: () => AdMob.showInterstitial(),
  });
}

/**
 * Banner. Bu eklentide ayrı prepare yok; showBanner hem yükler hem gösterir.
 * FailedToLoad dinleyicisi show'dan önce bağlanır.
 * @returns {Promise<boolean>}
 */
export async function bannerGoster(kap = globalThis, bag = {}) {
  if (!reklamAcikMi(kap)) return false;
  const ok = await reklamKur(kap, bag);
  if (!ok) return false;
  const { AdMob, BannerAdPluginEvents, BannerAdPosition, BannerAdSize } = await apiAl(bag);
  const kim = reklamKimlikleri(undefined, { platform: platformAdi(kap) });
  return yukleSonraGoster({
    AdMob,
    asama: 'banner',
    failedToLoad: BannerAdPluginEvents?.FailedToLoad,
    failedToShow: BannerAdPluginEvents?.FailedToShow,
    yukle: () => Promise.resolve(),
    goster: () => AdMob.showBanner({
      adId: kim.banner,
      isTesting: false,
      adSize: BannerAdSize?.ADAPTIVE_BANNER,
      position: BannerAdPosition?.BOTTOM_CENTER,
    }),
  });
}

/** Testlerde kurulum durumunu sıfırla. */
export function reklamSifirla() {
  kurulu = false;
  hazirSoz = null;
}
