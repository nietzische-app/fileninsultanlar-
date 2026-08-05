/**
 * Kombo — saf hesaplar.
 *
 * Kombo, üst üste iyi oynanan hamlelerin sayacıdır: tam vuruş, blok ve
 * dalış kurtarışı büyütür, sayı kaybetmek sıfırlar. Motor yalnızca
 * sayacı tutar; kademe/çarpan mantığı burada durur ve test edilir.
 */

import { COMBO, PERFECT } from './constants.js';

/**
 * Verilen kombo sayısında geçilen kademe (yoksa null).
 *
 * Yalnızca eşiğe **tam olarak** ulaşıldığında döner: her vuruşta
 * "SÜPER!" bağırmak yerine kademe atlandığı anda bir kez duyurulur.
 *
 * @param {number} count
 * @returns {{at:number, label:string, color:string} | null}
 */
export function comboTierAt(count) {
  return COMBO.tiers.find((tier) => tier.at === count) ?? null;
}

/**
 * Şu anda geçerli olan en yüksek kademe (HUD rozeti için).
 * @param {number} count
 */
export function currentComboTier(count) {
  let found = null;
  COMBO.tiers.forEach((tier) => {
    if (count >= tier.at) found = tier;
  });
  return found;
}

/**
 * Sultan barı dolum çarpanı.
 * @param {number} count
 */
export function comboChargeMultiplier(count) {
  const safe = Math.max(0, count);
  return Math.min(
    COMBO.maxChargeMultiplier,
    1 + safe * COMBO.chargeStep
  );
}

/**
 * Hücum gücü çarpanı.
 *
 * Bilerek dolum çarpanından çok daha zayıf: kombo topu hızlandırmak
 * için değil, Sultan Gücü'ne daha çabuk ulaşmak için bir ödül. Güç de
 * aynı oranda büyüseydi kombo yapan oyuncu geri dönülemez biçimde
 * öne geçerdi.
 *
 * @param {number} count
 */
export function comboPowerMultiplier(count) {
  const safe = Math.max(0, count);
  return Math.min(
    COMBO.maxPowerMultiplier,
    1 + safe * COMBO.powerStep
  );
}

/**
 * Temas, tuşa basıldıktan sonra tam vuruş penceresinde mi gerçekleşti?
 *
 * `pressedAt` null ise tuş bu temas için hiç basılmamıştır (ör. manşet)
 * ya da basış bilgisi temizlenmiştir — tam vuruş sayılmaz.
 *
 * @param {number} now Motor zamanı (sn)
 * @param {number | null} pressedAt Tuşa basıldığı an
 * @param {number} [window]
 */
export function isPerfectTiming(now, pressedAt, window = PERFECT.window) {
  if (pressedAt === null || pressedAt === undefined) return false;
  const delta = now - pressedAt;
  return delta >= 0 && delta <= window;
}
