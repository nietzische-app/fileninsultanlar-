/**
 * Servis gücü / nişan — saf yardımcılar (Game.js'ten bağımsız).
 *
 * İki aşamalı bar:
 *  1) power — metre salınır, ilk basış gücü kilitler
 *  2) aim   — metre salınır, ikinci basış nişanı kilitler ve servisi atar
 */

export const SERVE = {
  /** Servis çizgisi x oranı (kendi sahasında) */
  backLineHome: 0.12,
  backLineAway: 0.88,
  /** Top el yüksekliği (GROUND_Y'den yukarı) */
  holdHeight: 52,
  /** Metre salınım hızı (birim/sn) */
  meterSpeed: 1.55,
  /** İlk basış sonrası nişan aşaması hızı */
  aimMeterSpeed: 1.35,
  /** AI servis gecikmesi aralığı (sn) */
  aiDelayMin: 0.45,
  aiDelayMax: 1.35,
  /** Güç → dikey / yatay ölçek */
  minPower: 0.35,
  maxPower: 1.0,
  baseSpeed: 620,
  lift: 420,
  /** Nişan sapması (radyan civarı yatay çarpan) */
  aimSpread: 0.55,
};

/**
 * @param {number} meter 0–1
 * @param {1|-1} dir
 * @param {number} speed
 * @param {number} dt
 * @returns {{ meter: number, dir: 1|-1 }}
 */
export function advanceServeMeter(meter, dir, speed, dt) {
  let next = meter + dir * speed * dt;
  let nextDir = dir;
  if (next >= 1) {
    next = 1;
    nextDir = -1;
  } else if (next <= 0) {
    next = 0;
    nextDir = 1;
  }
  return { meter: next, dir: nextDir };
}

/**
 * Meter değerini servis gücüne çevirir (orta = iyi, uçlar zayıf/aşırı).
 * Klasik arcade: tam dolu da işe yarar ama "sweet spot" ~0.7–0.9.
 * @param {number} meter
 * @returns {number} 0–1 güç
 */
export function meterToPower(meter) {
  const m = Math.max(0, Math.min(1, meter));
  // Uçlarda biraz cezalandır, sweet spot'u ödüllendir
  const sweet = 1 - Math.abs(m - 0.78) * 1.1;
  const raw = Math.max(SERVE.minPower, Math.min(SERVE.maxPower, sweet));
  return raw;
}

/**
 * İkinci metre → yatay nişan (-1 dip / +1 file yakını kendi perspektifinde normalize).
 * @param {number} meter
 * @returns {number} -1..1
 */
export function meterToAim(meter) {
  return Math.max(-1, Math.min(1, meter * 2 - 1));
}

/**
 * Servis hız vektörü.
 * @param {{ power: number, aim: number, toOpponent: 1|-1, serveStat?: number }} opts
 * @returns {{ vx: number, vy: number }}
 */
export function computeServeVelocity({ power, aim, toOpponent, serveStat = 70 }) {
  const p = Math.max(SERVE.minPower, Math.min(SERVE.maxPower, power));
  const stat = 0.75 + (Math.max(0, Math.min(100, serveStat)) / 100) * 0.5;
  const speed = SERVE.baseSpeed * p * stat;
  const aimX = aim * SERVE.aimSpread;
  const vx = toOpponent * speed * (0.72 + aimX * 0.28);
  const vy = -(SERVE.lift * (0.55 + p * 0.55));
  return { vx, vy };
}

/**
 * AI için güç/nişan — zorluk `serveSkill` (0–1).
 * @param {number} serveSkill
 * @returns {{ power: number, aim: number }}
 */
export function aiServeChoice(serveSkill = 0.5) {
  const skill = Math.max(0, Math.min(1, serveSkill));
  const power = SERVE.minPower + (0.55 + skill * 0.4) * (SERVE.maxPower - SERVE.minPower);
  const aimJitter = (Math.random() * 2 - 1) * (1 - skill) * 0.7;
  const aim = Math.max(-1, Math.min(1, 0.15 + aimJitter));
  return { power, aim };
}

/**
 * @param {number} serveSkill
 * @returns {number}
 */
export function aiServeDelay(serveSkill = 0.5) {
  const skill = Math.max(0, Math.min(1, serveSkill));
  const t =
    SERVE.aiDelayMax - (SERVE.aiDelayMax - SERVE.aiDelayMin) * skill;
  return t * (0.85 + Math.random() * 0.3);
}
