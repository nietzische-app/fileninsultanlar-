/**
 * Reklam — yalnız mağaza kabuğunda.
 *
 * Web'de çağrılmaz. Eklenti yoksa ya da izleme yarıda kesilirse ödül
 * yok: sessizce "devam et" vermek reklamı atlatmanın yolu olurdu.
 *
 * KİMLİKLER PLATFORMA GÖRE AYRI. AdMob her platform için ayrı
 * uygulama ve ayrı reklam birimi veriyor; iOS'ta Android biriminin
 * istenmesi "no fill" demek. Demo tarafında bu ayrım zaten vardı,
 * gerçek tarafta YOKTU: bayrak kapatıldığında iki platform da aynı
 * `VITE_ADMOB_*` değerini alıyordu ve iOS sessizce boş dönerdi.
 *
 * Kimlik verilmemişse o yuva Google'ın O PLATFORMA ait demo birimine
 * düşüyor ve `test` açılıyor — yanlış platformun gerçek birimini
 * istemektense test reklamı göstermek yeğdir; `eksik` listesi de
 * hangi değişkenin verilmediğini söylüyor.
 */

import { yerelKabukMu } from '../utils/gizlilik.js';

/**
 * Gerçek birimleri yok sayıp demo birimlerle koşmak için acil kapak.
 *
 * YAYINDA FALSE. Bir süre `true` kaldı ve mağazadaki iki sürüm de
 * Google'ın demo reklamlarını istedi: reklamlar ya hiç görünmedi ya
 * test reklamı olarak göründü, gelir sıfır oldu. Cihazda hata
 * ayıklarken elle açılabilir, ama commit edilmez.
 */
export const GECICI_DEMO_BIRIM = false;

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

/** Platform başına demo birimler — gerçek kimlik yoksa buraya düşülür. */
const DEMO = {
  ios: IOS_TEST_ADMOB,
  android: {
    app: TEST_ADMOB_APP,
    banner: TEST_ADMOB_BANNER,
    interstitial: TEST_ADMOB_INTERSTITIAL,
    rewarded: TEST_ADMOB_REWARD,
    rewardedInterstitial: 'ca-app-pub-3940256099942544/5354046379',
  },
};

/**
 * Hangi ortam değişkeni hangi yuvayı dolduruyor.
 *
 * Android adları eski hâlleriyle kaldı (`VITE_ADMOB_APP_ID`): iş
 * akışları ve depo değişkenleri onlara bakıyor, yeniden adlandırmak
 * sessizce boş kimlik demek olurdu.
 */
export const ADMOB_DEGISKENLERI = {
  ios: {
    app: 'VITE_ADMOB_IOS_APP_ID',
    rewarded: 'VITE_ADMOB_IOS_REWARDED_ID',
    interstitial: 'VITE_ADMOB_IOS_INTERSTITIAL_ID',
    banner: 'VITE_ADMOB_IOS_BANNER_ID',
  },
  android: {
    app: 'VITE_ADMOB_APP_ID',
    rewarded: 'VITE_ADMOB_REWARDED_ID',
    interstitial: 'VITE_ADMOB_INTERSTITIAL_ID',
    banner: 'VITE_ADMOB_BANNER_ID',
  },
};

/**
 * Bu platformun reklam kimlikleri.
 *
 * @param {object} [env] Vite ortam değişkenleri
 * @param {{geciciDemo?: boolean, platform?: 'ios'|'android'}} [secenek]
 * @returns {{appId: string, banner: string, interstitial: string,
 *   rewarded: string, rewardedInterstitial: string, test: boolean,
 *   demo: boolean, platform: string, eksik: string[]}}
 */
export function reklamKimlikleri(env = import.meta.env, secenek = {}) {
  const gecici = secenek.geciciDemo ?? GECICI_DEMO_BIRIM;
  const platform = secenek.platform === 'android' ? 'android' : 'ios';
  const demo = DEMO[platform];

  if (gecici) {
    return {
      appId: demo.app,
      banner: demo.banner,
      interstitial: demo.interstitial,
      rewarded: demo.rewarded,
      rewardedInterstitial: demo.rewardedInterstitial,
      test: true,
      demo: true,
      platform,
      eksik: [],
    };
  }

  const degisken = ADMOB_DEGISKENLERI[platform];
  const eksik = [];
  /** Değer yoksa AYNI PLATFORMUN demo birimine düş ve bunu bildir. */
  const al = (yuva) => {
    const deger = String(env?.[degisken[yuva]] || '').trim();
    if (deger) return deger;
    eksik.push(degisken[yuva]);
    return demo[yuva];
  };

  const appId = al('app');
  const rewarded = al('rewarded');
  const interstitial = al('interstitial');
  const banner = al('banner');

  return {
    appId,
    banner,
    interstitial,
    rewarded,
    /*
     * Ayrı bir "ödüllü geçiş" birimi istemiyoruz; o biçim kullanılmıyor
     * ve geçiş birimini oraya vermek yanlış biçimde istek demek olurdu.
     */
    rewardedInterstitial: demo.rewardedInterstitial,
    test: eksik.length > 0,
    demo: false,
    platform,
    eksik,
  };
}

export function reklamAcikMi(kap = globalThis) {
  return yerelKabukMu(kap);
}

function platformAdi(kap) {
  const ad = kap?.Capacitor?.getPlatform?.();
  return ad === 'android' ? 'android' : 'ios';
}

/** İzin diyaloğu açıkken SDK'nın başlaması için üst süre. Oyun bu sırada kilitlenmez. */
const IZLEME_BEKLE_MS = 90000;

function bekle(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * iOS'ta reklam ölçümünden önce sistem izleme iznini ister.
 * Android'de ve web'de no-op. Reddetmek reklamı kapatmaz.
 * @returns {Promise<string>} authorized, denied, restricted, notDetermined, yok veya hata
 */
export async function izlemeIzniIste(AdMob, kap, bekleMs = IZLEME_BEKLE_MS) {
  if (platformAdi(kap) !== 'ios') return 'yok';
  if (typeof AdMob?.requestTrackingAuthorization !== 'function') return 'yok';
  const baslangic = Date.now();
  const kalan = () => Math.max(0, bekleMs - (Date.now() - baslangic));
  const oku = async () => {
    if (typeof AdMob.trackingAuthorizationStatus !== 'function') return null;
    const durum = await AdMob.trackingAuthorizationStatus();
    return typeof durum?.status === 'string' ? durum.status : null;
  };
  try {
    let status = await oku();
    if (status && status !== 'notDetermined') return status;
    const istek = Promise.resolve()
      .then(() => AdMob.requestTrackingAuthorization())
      .catch((hata) => {
        reklamHatasiYaz('izleme izni', hata);
      });
    await Promise.race([istek, bekle(kalan())]);
    status = await oku();
    while ((!status || status === 'notDetermined') && kalan() > 0) {
      await bekle(Math.min(250, kalan()));
      status = await oku();
    }
    return status || 'notDetermined';
  } catch (hata) {
    reklamHatasiYaz('izleme izni', hata);
    return 'hata';
  }
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
      await izlemeIzniIste(AdMob, kap, bag.izlemeBekleMs);
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
