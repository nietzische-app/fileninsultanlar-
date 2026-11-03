/**
 * Mağaza değerlendirme isteği.
 *
 * Pencere bizim değil: Android'de Play In-App Review, iOS'ta
 * SKStoreReviewController. İkisi de göstermeyebilir; başarılı çağrıyı
 * yine de "soruldu" sayarız, yoksa her galibiyette yeniden deneriz.
 *
 * Eşik üçüncü galibiyet. Kayıp, antrenman ve hayatta kalma sayılmaz.
 * Aynı oturumda bir kez, sonra 30 günde bir, toplam en fazla 3.
 * Sonuç ekranı önce çizilir; istek düğmeleri kilitlemez.
 */

import { yerelKabukMu } from '../utils/gizlilik.js';

const ANAHTAR = 'retro-voleybol-degerlendirme';

export const DEGERLENDIRME = {
  /** Üçüncü galibiyet. Antrenman bu sayıya yazılmaz. */
  minGalibiyet: 3,
  /** 30 dk: aynı oturuşta ikinci kez sorma. */
  oturumAraligiMs: 30 * 60 * 1000,
  /** Mağazanın kendi kotasına ek. */
  aralikMs: 30 * 24 * 60 * 60 * 1000,
  enFazla: 3,
  /** Kutlama görünsün, PAYLAŞ ve menü hemen basılabilsin. */
  gecikmeMs: 1200,
};

function taze() {
  return { oturum: 0, soru: 0, sonSoru: 0, sonOturum: 0, sorulanOturum: 0 };
}

function sayi(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** @returns {ReturnType<typeof taze>} */
export function degerlendirmeOku() {
  try {
    const raw = localStorage.getItem(ANAHTAR);
    if (!raw) return taze();
    const parsed = JSON.parse(raw);
    return {
      oturum: sayi(parsed?.oturum),
      soru: sayi(parsed?.soru),
      sonSoru: sayi(parsed?.sonSoru),
      sonOturum: sayi(parsed?.sonOturum),
      sorulanOturum: sayi(parsed?.sorulanOturum),
    };
  } catch {
    return taze();
  }
}

function yaz(durum) {
  const temiz = {
    oturum: sayi(durum?.oturum),
    soru: sayi(durum?.soru),
    sonSoru: sayi(durum?.sonSoru),
    sonOturum: sayi(durum?.sonOturum),
    sorulanOturum: sayi(durum?.sorulanOturum),
  };
  try {
    localStorage.setItem(ANAHTAR, JSON.stringify(temiz));
  } catch {
    /* kota / gizli sekme — oyun devam eder, istek bir sonraki sefere kalır */
  }
  return temiz;
}

/**
 * Uygulama açılışında bir kez. 30 dk içindeki ikinci çağrı (StrictMode
 * dahil) yeni oturum sayılmaz.
 * @param {number} [simdi]
 */
export function oturumBaslat(simdi = Date.now()) {
  const durum = degerlendirmeOku();
  if (durum.sonOturum && simdi - durum.sonOturum < DEGERLENDIRME.oturumAraligiMs) {
    return durum;
  }
  return yaz({ ...durum, oturum: durum.oturum + 1, sonOturum: simdi });
}

/**
 * Sonuç ekranı olumlu bir an mı?
 * Turnuva kapanışı yalnız kupadaysa olumlu; elenmek kayıptır.
 * Ara turlar bu ekrana gelmez.
 * @param {object | null | undefined} result
 * @param {{ champion?: boolean, status?: string } | null | undefined} tournament
 */
export function olumluAn(result, tournament) {
  if (!result) return false;
  if (result.campaign === 'survival' || result.survival) return false;
  if (result.format === 'practice') return false;
  if (tournament) {
    return tournament.champion === true || tournament.status === 'won';
  }
  return result.winner === 'home';
}

/**
 * @param {{ olumlu?: boolean, galibiyet?: number }} baglam
 * @param {number} [simdi]
 * @returns {{ iste: boolean, neden: string }}
 */
export function degerlendirmeKarari(baglam, simdi = Date.now()) {
  const durum = degerlendirmeOku();
  if (!baglam?.olumlu) return { iste: false, neden: 'olumlu-degil' };
  if (sayi(baglam.galibiyet) < DEGERLENDIRME.minGalibiyet) {
    return { iste: false, neden: 'galibiyet' };
  }
  if (durum.soru >= DEGERLENDIRME.enFazla) return { iste: false, neden: 'tavan' };
  if (durum.sonSoru && simdi - durum.sonSoru < DEGERLENDIRME.aralikMs) {
    return { iste: false, neden: 'aralik' };
  }
  if (durum.sorulanOturum && durum.sorulanOturum === durum.oturum) {
    return { iste: false, neden: 'oturum-ici' };
  }
  return { iste: true, neden: 'tamam' };
}

/** Yerel çağrı bittiğinde (pencere görünmese de) kotayı işler. */
export function degerlendirmeIslendi(simdi = Date.now()) {
  const durum = degerlendirmeOku();
  return yaz({
    ...durum,
    soru: durum.soru + 1,
    sonSoru: simdi,
    sorulanOturum: durum.oturum,
  });
}

/**
 * @param {object} [kap]
 * @param {(() => Promise<void>) | null} [iste] Test enjeksiyonu
 * @returns {Promise<boolean>}
 */
export async function degerlendirmeIste(kap = globalThis, iste = null) {
  if (!yerelKabukMu(kap)) return false;
  try {
    if (iste) {
      await iste();
      return true;
    }
    const mod = await import('@capacitor-community/in-app-review');
    const api = mod.InAppReview ?? mod.default;
    await api.requestReview();
    return true;
  } catch {
    return false;
  }
}
