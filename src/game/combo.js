/**
 * Ralli kombosu — saf yardımcılar (Game.js'ten bağımsız, test edilebilir).
 *
 * Kombo: ev sahibi smaç / blok / kurtarış zinciri.
 * Rakip sayı alınca veya set bitince sıfırlanır.
 */

/** @typedef {{ type: string, isBlock?: boolean }} ComboAction */

export const COMBO = {
  /** Bu eşiğin üstünde HUD / çağrı gösterilir */
  showAt: 2,
  /** Hit-stop süreleri (saniye) */
  hitStopSpike: 0.055,
  hitStopBlock: 0.05,
  hitStopSave: 0.04,
  hitStopSultan: 0.08,
  /** Her kombo adımında ek Sultan dolumu */
  chargePerStep: 3,
  maxChargeBonus: 18,
  /** Sayı alınırken kombo çarpanı (ek dolum) */
  pointBonusPerStep: 4,
  maxPointBonus: 24,
  /** Çağrı süresi */
  calloutTime: 0.7,
};

/**
 * @param {ComboAction} action
 * @returns {boolean}
 */
export function isComboAction(action) {
  if (!action) return false;
  return action.type === 'spike' || action.type === 'dive' || Boolean(action.isBlock);
}

/**
 * @param {number} current
 * @param {ComboAction} action
 * @returns {number}
 */
export function nextCombo(current, action) {
  if (!isComboAction(action)) return current;
  return Math.max(0, Math.floor(current)) + 1;
}

/**
 * @param {ComboAction & { sultanFired?: boolean }} action
 * @returns {number}
 */
export function hitStopFor(action) {
  if (!action) return 0;
  if (action.sultanFired) return COMBO.hitStopSultan;
  if (action.type === 'spike') return COMBO.hitStopSpike;
  if (action.isBlock) return COMBO.hitStopBlock;
  if (action.type === 'dive') return COMBO.hitStopSave;
  return 0;
}

/**
 * Temas anında ek bar dolumu.
 * @param {number} count Kombo değeri (artmış hali)
 * @returns {number}
 */
export function comboChargeBonus(count) {
  if (count < COMBO.showAt) return 0;
  return Math.min(COMBO.maxChargeBonus, (count - 1) * COMBO.chargePerStep);
}

/**
 * Kombolu sayı alınca ek bar dolumu.
 * @param {number} count
 * @returns {number}
 */
export function comboPointBonus(count) {
  if (count < COMBO.showAt) return 0;
  return Math.min(COMBO.maxPointBonus, count * COMBO.pointBonusPerStep);
}

/**
 * Kısa çağrı metni.
 * @param {number} count
 * @param {ComboAction} [action]
 * @returns {string|null}
 */
export function comboCallout(count, action) {
  if (count < COMBO.showAt) return null;

  if (count >= 8) return `x${count} EFSANE!`;
  if (count >= 5) return `x${count} MUHTEŞEM!`;
  if (count >= 3) {
    if (action?.isBlock) return `x${count} BLOK SERİSİ!`;
    if (action?.type === 'dive') return `x${count} KURTARIŞ!`;
    if (action?.type === 'spike') return `x${count} SMAÇ!`;
    return `x${count} KOMBO!`;
  }
  return `x${count}`;
}

/**
 * Sayı anı metni — kombo varsa onu öne çıkarır.
 * @param {number} count
 * @param {string|null|undefined} reason
 * @param {number} streakCount
 * @returns {string}
 */
export function comboPointMessage(count, reason, streakCount) {
  if (reason) return reason;
  if (count >= COMBO.showAt) return `x${count} KOMBO SAYI!`;
  if (streakCount > 2) return `${streakCount} SAYI ÜST ÜSTE!`;
  return 'SAYI!';
}
