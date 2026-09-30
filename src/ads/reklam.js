/**
 * Ödüllü reklam — yalnız mağaza kabuğunda.
 *
 * Web'de çağrılmaz: Forma Puanı da reklam da Capacitor native'de açılır.
 * Eklenti yoksa ya da izleme yarıda kesilirse ödül YOK — sessizce
 * "devam et" vermek reklamı atlatmanın yolu olurdu.
 *
 * Kimlikler `VITE_ADMOB_APP_ID` / `VITE_ADMOB_REWARDED_ID`. Yoksa
 * Google'ın resmi test birimleri (para getirmez; Play'e çıkmadan
 * GitHub variable'ına gerçek kimliği yaz).
 */

import { yerelKabukMu } from '../utils/gizlilik.js';

export const TEST_ADMOB_APP = 'ca-app-pub-3940256099942544~3347511713';
export const TEST_ADMOB_REWARD = 'ca-app-pub-3940256099942544/5224354917';

export function reklamKimlikleri(env = import.meta.env) {
  const appId = String(env?.VITE_ADMOB_APP_ID || '').trim() || TEST_ADMOB_APP;
  const rewarded = String(env?.VITE_ADMOB_REWARDED_ID || '').trim() || TEST_ADMOB_REWARD;
  return {
    appId,
    rewarded,
    test: appId === TEST_ADMOB_APP || rewarded === TEST_ADMOB_REWARD,
  };
}

export function reklamAcikMi(kap = globalThis) {
  return yerelKabukMu(kap);
}

let kurulu = false;
let hazirSoz = null;

async function eklenti() {
  const mod = await import('@capacitor-community/admob');
  return {
    AdMob: mod.AdMob ?? mod.default,
    RewardAdPluginEvents: mod.RewardAdPluginEvents,
  };
}

/**
 * SDK'yı bir kez kur. Web'de no-op.
 * @returns {Promise<boolean>}
 */
export async function reklamKur(kap = globalThis) {
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
      const { AdMob } = await eklenti();
      const kim = reklamKimlikleri();
      await AdMob.initialize({
        initializeForTesting: kim.test,
      });
      kurulu = true;
      return true;
    } catch {
      kurulu = false;
      return false;
    }
  })();
  const ok = await hazirSoz;
  if (!ok) hazirSoz = null;
  return ok;
}

/**
 * Ödüllü videoyu gösterir. Kullanıcı ödülü tamamlamazsa false.
 * @returns {Promise<boolean>}
 */
export async function odulluGoster(kap = globalThis) {
  if (!reklamAcikMi(kap)) return false;
  const ok = await reklamKur(kap);
  if (!ok) return false;
  try {
    const { AdMob, RewardAdPluginEvents } = await eklenti();
    const kim = reklamKimlikleri();
    await AdMob.prepareRewardVideoAd({
      adId: kim.rewarded,
      isTesting: kim.test,
    });
    let odul = false;
    const dinleyici = RewardAdPluginEvents
      ? await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
        odul = true;
      })
      : null;
    try {
      const sonuc = await AdMob.showRewardVideoAd();
      if (sonuc && (sonuc.type || sonuc.amount)) odul = true;
    } finally {
      await dinleyici?.remove?.();
    }
    return odul;
  } catch {
    return false;
  }
}

/** Testlerde kurulum durumunu sıfırla. */
export function reklamSifirla() {
  kurulu = false;
  hazirSoz = null;
}
