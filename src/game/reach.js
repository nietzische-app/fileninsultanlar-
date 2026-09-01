/**
 * Temas alanı — motorun ve yapay zekânın ORTAK erişim modeli.
 *
 * Neden ayrı bir dosya: bu hesap iki yerde birden lazım. Motor
 * (`resolveCollisions`) topa gerçekten dokunulup dokunulmadığına karar
 * verirken kullanıyor; yapay zekâ (`ai.js`) ise "menzile girdim mi,
 * vuruş tuşuna basayım mı" derken. İkisi ayrı yazıldığında sessizce
 * ayrıştılar ve rakip aptallaştı:
 *
 *   motor:  reach = (hitRadius + bonus) * speedPenalty
 *   AI:     reach = hitRadius + ballRadius + 26     ← hız cezası yok
 *
 * Servis oyundaki en hızlı toptur, yani cezanın en sert işlediği yer.
 * Gerçek erişim ~45px'e inerken AI 79px sanıyor, topun 63px yakınında
 * durup vuruş tuşuna basıyor ve top elinin 20px ötesinden geçiyordu.
 * Ölçümde her üç servisten biri "as" oluyordu — ZOR kademesinde bile,
 * çünkü zorluk kolları (`error`, `speed`, `reaction`) yanlış bir menzil
 * modelini düzeltemez.
 *
 * Artık tek kaynak var: burası. Değeri değiştiren biri iki tarafı da
 * değiştirmiş olur.
 */

import { DIVE, PHYSICS, PLAYER } from './constants.js';

/**
 * Hızlı topa temiz dokunmak zordur: temas alanı topun hızıyla daralır.
 * Bu olmadan sert smaç ile yavaş pas aynı kolaylıkta kurtarılıyor ve
 * özellikle 2v2'de ralliler hiç bitmiyordu.
 *
 * @param {number} ballSpeed Topun hızı (px/sn)
 * @returns {number} 0–1 arası çarpan
 */
export function speedPenalty(ballSpeed) {
  const raw = 1 - (ballSpeed - PHYSICS.cleanTouchSpeed) / 1600;
  return Math.max(PLAYER.minReachFactor, Math.min(1, raw));
}

/**
 * Bir oyuncunun bu karedeki temas yarıçapı (top yarıçapı HARİÇ).
 *
 * @param {object} opts
 * @param {number} opts.hitRadius
 * @param {boolean} [opts.acting] Vuruş tuşu basılı mı
 * @param {boolean} [opts.diving] Dalış hâlinde mi
 * @param {number} opts.ballSpeed
 */
export function contactRadius({ hitRadius, acting = false, diving = false, ballSpeed }) {
  const bonus = diving ? DIVE.reachBonus : acting ? PLAYER.reachBonus : 0;
  return (hitRadius + bonus) * speedPenalty(ballSpeed);
}

/**
 * Topa dokunmak için merkezler arası mesafenin altında kalması gereken
 * eşik — motorun `dist > reach + ball.radius` testiyle birebir aynı.
 *
 * @param {object} player
 * @param {object} ball
 * @param {object} [opts]
 * @param {boolean} [opts.acting] Varsayılan: oyuncunun mevcut girdisi
 * @param {boolean} [opts.diving] Varsayılan: oyuncunun mevcut hâli
 */
export function contactDistance(player, ball, opts = {}) {
  const acting = opts.acting ?? Boolean(player.input?.action);
  const diving =
    opts.diving ?? (player.diveTimer > 0 || player.recoverTimer > 0);
  const ballSpeed = Math.hypot(ball.vx, ball.vy);

  return (
    contactRadius({ hitRadius: player.hitRadius, acting, diving, ballSpeed }) +
    ball.radius
  );
}
