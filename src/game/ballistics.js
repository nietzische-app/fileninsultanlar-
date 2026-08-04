/**
 * Saf balistik — hücum / pas hızı ve file aşımı.
 * Game.js ince sarmalayıcılarla çağırır.
 */

import { attackRange, GROUND_Y, NET, PHYSICS } from './constants.js';
import { getModifier } from './players.js';
import { clamp } from './math.js';

/**
 * Verilen hızla atılan top filenin üstünden geçiyor mu?
 * @param {{ x: number, y: number }} ball
 * @param {{ vx: number, vy: number }} shot
 * @param {number} flight
 */
export function clearsNet(ball, shot, flight) {
  if (Math.abs(shot.vx) < 1) return false;

  const tNet = (NET.x - ball.x) / shot.vx;
  if (tNet <= 0 || tNet > flight) return true; // file yolda değil

  const yAtNet =
    ball.y + shot.vy * tNet + 0.5 * PHYSICS.ballGravity * tNet * tNet;

  return yAtNet < NET.topY - 10;
}

/**
 * Pas (kaldırma) hızı — top kendi sahasında, file önünde.
 * @param {{ x: number, y: number }} ball
 * @param {1|-1} toOpponent
 * @param {() => number} [rand]
 */
export function computeSetVelocity(ball, toOpponent, rand = Math.random) {
  const t = 0.95;
  const targetX = NET.x - toOpponent * (90 + rand() * 60);
  const targetY = GROUND_Y - 150;

  return {
    vx: (targetX - ball.x) / t,
    vy: (targetY - ball.y - 0.5 * PHYSICS.ballGravity * t * t) / t,
  };
}

/**
 * Hücum vuruşunun hızını hedefe göre çözer.
 *
 * @param {object} opts
 * @param {{ x: number, y: number, radius: number }} opts.ball
 * @param {object} opts.player
 * @param {number} opts.power
 * @param {1|-1} opts.toOpponent
 * @param {number} opts.nx
 * @param {number} [opts.arc]
 * @param {() => number} [opts.rand]
 */
export function computeAttackVelocity({
  ball,
  player,
  power,
  toOpponent,
  nx,
  arc = 1,
  rand = Math.random,
}) {
  const { data } = player;
  const { near, far } = attackRange(toOpponent);

  let spread;
  if (player.controlled) {
    const drift = (player.vx * toOpponent) / 900 + nx * toOpponent * 0.28;
    spread = clamp(
      (0.5 + drift + (rand() * 0.24 - 0.12)) * getModifier(data, 'angle'),
      0.12,
      0.96
    );
  } else {
    spread = clamp((player.aimSpread ?? 0.5) * getModifier(data, 'angle'), 0.07, 0.95);
  }

  const targetX = near + (far - near) * spread;
  const targetY = GROUND_Y - ball.radius;

  let t = clamp((PHYSICS.spikePower / power) * 0.5 * arc, 0.3 * arc, 0.66 * arc);

  const solve = (flight) => ({
    vx: (targetX - ball.x) / flight,
    vy:
      (targetY - ball.y - 0.5 * PHYSICS.ballGravity * flight * flight) / flight,
  });

  let shot = solve(t);

  let tries = 0;
  while (!clearsNet(ball, shot, t) && tries < 4) {
    t = Math.min(1.3, t * 1.3);
    shot = solve(t);
    tries += 1;
  }

  let guard = 0;
  while (Math.hypot(shot.vx, shot.vy) > PHYSICS.ballMaxSpeed && guard < 6) {
    t = Math.min(1.4, t * 1.18);
    shot = solve(t);
    guard += 1;
  }

  if (!clearsNet(ball, shot, t)) {
    return computeSetVelocity(ball, toOpponent, rand);
  }

  return shot;
}
