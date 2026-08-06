import { GAME_WIDTH, GROUND_Y, NET, PHYSICS } from './constants.js';

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
  /**
   * Top el yüksekliği (GROUND_Y'den yukarı).
   * 52 iken top file üstünün çok altından çıkıyordu; smaç servisi
   * yapan bir oyuncunun eli bu civarda olur.
   */
  holdHeight: 96,
  /** Metre salınım hızı (birim/sn) */
  meterSpeed: 1.55,
  /** İlk basış sonrası nişan aşaması hızı */
  aimMeterSpeed: 1.35,
  /**
   * İnsan servis atanın en fazla bekleyebileceği süre (sn).
   *
   * Bu olmadan tuşu basılı tutan oyuncu kilitleniyordu: güç aşaması
   * ilk karede geçiliyor, nişan aşaması ise ikinci bir basış beklediği
   * için tuş bırakılmadıkça asla gelmiyor ve maç servis aşamasında
   * sonsuza kadar donuyordu. Süre dolunca servis kendiliğinden atılır.
   */
  autoAfter: 4,
  /**
   * Servis atanın kendi topuna tekrar vuramayacağı süre (sn).
   * Top el yüksekliğinde, oyuncunun temas dairesinin içinde doğuyor.
   */
  recontactLock: 0.35,
  /** AI servis gecikmesi aralığı (sn) */
  aiDelayMin: 0.45,
  aiDelayMax: 1.35,
  /** Güç → uçuş süresi aralığı (sn): yumuşak kavisli ↔ sert düz */
  minPower: 0.35,
  maxPower: 1.0,
  /**
   * Denenecek en kısa uçuş (buradan yukarı taranır).
   *
   * Servis bir silah değil, rallinin başlangıcı olsun diye kasıtlı
   * yüksek tutuldu: bu değerde en sert servis bile rahat karşılanır.
   * (Düşürmek servisi hızlandırır ama ölçümde denge üzerinde belirgin
   * bir etkisi görülmedi.)
   */
  fastFlight: 0.82,
  /** Yumuşak servisin uçuşu en kısa uçuşun kaç katı olabilir. */
  loopFactor: 1.3,
  /** Kavis yükseltilirken aşılamayacak süre. */
  maxFlight: 1.7,
  /**
   * Filenin üstünden bırakılacak pay (px).
   *
   * Analitik kontrol ile motorun 60 fps Euler entegrasyonu arasında
   * birkaç piksel fark oluşuyor: hesapta geçen top oyunda fileye
   * takılabiliyordu. Pay, entegrasyon hatasının üstünde tutulur.
   */
  netClearance: 26,
  /** Nişanın rakip sahada hedefleyebildiği derinlik (fileden px). */
  minDepth: 90,
  maxDepth: 330,
  /** Nişan sapması (radyan civarı yatay çarpan) */
  aimSpread: 0.55,
  /**
   * Metrenin en verimli noktası. Hem `meterToPower` hem de göstergedeki
   * beyaz çizgi buradan okur — iki yere ayrı yazılsaydı biri
   * değiştiğinde gösterge yalan söylerdi.
   */
  sweetSpot: 0.78,
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
  const sweet = 1 - Math.abs(m - SERVE.sweetSpot) * 1.1;
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
  const p = clampRange(power, SERVE.minPower, SERVE.maxPower);
  const stat = 0.75 + (Math.max(0, Math.min(100, serveStat)) / 100) * 0.5;

  // Nişan hedefi seçer: -1 file dibi, +1 dip çizgi
  const a = Math.max(-1, Math.min(1, aim));
  const depth =
    SERVE.minDepth + ((a + 1) / 2) * (SERVE.maxDepth - SERVE.minDepth);
  const targetX = NET.x + toOpponent * depth;
  const targetY = GROUND_Y - PHYSICS.ballRadius;

  const startX =
    GAME_WIDTH * (toOpponent > 0 ? SERVE.backLineHome : SERVE.backLineAway);
  const startY = GROUND_Y - SERVE.holdHeight;

  const solve = (flight) => ({
    vx: (targetX - startX) / flight,
    vy: (targetY - startY - 0.5 * PHYSICS.ballGravity * flight * flight) / flight,
  });

  /*
   * Önce fileyi aşan EN KISA uçuşu bul, sonra gücü onun üstüne bindir.
   *
   * Önceki sıralama (önce güçten süre seç, aşamazsa uzat) gücü tersine
   * çeviriyordu: düz atılan sert servis fileyi aşamayıp uzatılıyor,
   * sonuçta yumuşak servisten daha yavaş geliyordu. Testte sert vx=518,
   * yumuşak vx=578 çıktı. Taban olarak en kısa geçerli uçuşu almak bunu
   * yapısal olarak düzeltiyor: azami güç = aşabilen en hızlı servis.
   */
  let minFlight = SERVE.maxFlight;
  for (let t = SERVE.fastFlight; t <= SERVE.maxFlight; t += 0.02) {
    if (serveClearsNet(startX, startY, solve(t), t)) {
      minFlight = t;
      break;
    }
  }

  // Güç 0–1'e normalize: 1 → en kısa uçuş, 0 → belirgin kavisli
  const norm = clampRange(
    ((p - SERVE.minPower) / (SERVE.maxPower - SERVE.minPower)) * stat,
    0,
    1
  );
  const flight = Math.min(
    SERVE.maxFlight,
    minFlight * (1 + (1 - norm) * (SERVE.loopFactor - 1))
  );

  return solve(flight);
}

/** Servis topu filenin üstünden geçiyor mu? */
function serveClearsNet(startX, startY, shot, flight) {
  if (Math.abs(shot.vx) < 1) return false;

  const tNet = (NET.x - startX) / shot.vx;
  if (tNet <= 0 || tNet > flight) return false;

  const yAtNet =
    startY + shot.vy * tNet + 0.5 * PHYSICS.ballGravity * tNet * tNet;

  return yAtNet < NET.topY - SERVE.netClearance;
}

function clampRange(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
