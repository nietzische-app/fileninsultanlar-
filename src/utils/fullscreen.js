/**
 * Tam ekran yardımcıları.
 *
 * Tarayıcı desteği tek biçimli değil: Safari hâlâ `webkit` önekini
 * kullanıyor, iOS Safari ise `Element.requestFullscreen`'i hiç
 * desteklemiyor (yalnızca <video>). O yüzden her çağrı özellik
 * denetiminden geçer ve desteklenmiyorsa sessizce yok sayılır —
 * arayüz düğmeyi hiç göstermemek için `isFullscreenSupported`'a bakar.
 */

/** @returns {boolean} */
export function isFullscreenSupported() {
  if (typeof document === 'undefined') return false;

  const el = document.documentElement;
  const hasMethod = Boolean(
    el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.msRequestFullscreen
  );
  if (!hasMethod) return false;

  /*
   * Metodun var olması yetmez, izin de gerekir.
   *
   * Oyun portalları oyunu iframe'e gömüyor; `allow="fullscreen"`
   * verilmediğinde `requestFullscreen` yerinde duruyor ama
   * `fullscreenEnabled` false oluyor ve çağrı sessizce reddediliyor.
   * Ölçümde tam da bu görüldü: düğme görünüyor, basınca hiçbir şey
   * olmuyordu. Artık izin yoksa düğme hiç gösterilmiyor.
   */
  const enabled =
    document.fullscreenEnabled ??
    document.webkitFullscreenEnabled ??
    true;

  return Boolean(enabled);
}

/** @returns {Element | null} */
export function getFullscreenElement() {
  if (typeof document === 'undefined') return null;
  return document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
}

/**
 * Verilen elemanı tam ekrana alır.
 * @param {HTMLElement | null} element
 * @returns {Promise<boolean>} başarılı mı
 */
export async function enterFullscreen(element) {
  const target = element ?? document.documentElement;
  const request =
    target.requestFullscreen ??
    target.webkitRequestFullscreen ??
    target.msRequestFullscreen;

  if (!request) return false;

  try {
    // `navigationUI: 'hide'` desteklenmeyen tarayıcılarda yok sayılır
    await request.call(target, { navigationUI: 'hide' });
  } catch {
    try {
      await request.call(target);
    } catch {
      return false;
    }
  }

  await lockLandscape();
  return true;
}

/** @returns {Promise<void>} */
export async function exitFullscreen() {
  const exit =
    document.exitFullscreen ??
    document.webkitExitFullscreen ??
    document.msExitFullscreen;

  unlockOrientation();

  if (!exit || !getFullscreenElement()) return;
  try {
    await exit.call(document);
  } catch {
    // ignore
  }
}

/**
 * Yatay yönlendirmeyi kilitlemeyi dener.
 *
 * Android Chrome'da çalışır, iOS Safari'de API yok — o yüzden hata
 * yutulur ve arayüz bunun yerine "cihazı yatay çevir" ipucu gösterir.
 */
export async function lockLandscape() {
  const orientation = window.screen?.orientation;
  if (!orientation?.lock) return false;
  try {
    await orientation.lock('landscape');
    return true;
  } catch {
    return false;
  }
}

export function unlockOrientation() {
  try {
    window.screen?.orientation?.unlock?.();
  } catch {
    // ignore
  }
}
