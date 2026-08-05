/**
 * Canvas parçacık / darbe / iz efektleri.
 * Game motorundan bağımsız — dizi referansları üzerinde çalışır.
 */

import { PALETTE, PHASE } from './constants.js';

/**
 * @param {object[]} particles
 * @param {number} x
 * @param {number} y
 * @param {number} count
 * @param {string} color
 */
export function spawnBurst(particles, x, y, count, color) {
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const speed = 90 + Math.random() * 210;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.45 + Math.random() * 0.3,
      maxLife: 0.75,
      size: 3 + Math.random() * 3,
      color,
      gravity: 420,
    });
  }
}

/**
 * @param {object[]} particles
 * @param {number} x
 * @param {number} y
 * @param {string[]} [colors]
 */
export function spawnFlame(particles, x, y, colors = PALETTE.flame) {
  particles.push({
    x: x + (Math.random() * 8 - 4),
    y: y + (Math.random() * 8 - 4),
    vx: (Math.random() * 2 - 1) * 40,
    vy: (Math.random() * 2 - 1) * 40 - 30,
    life: 0.3 + Math.random() * 0.2,
    maxLife: 0.5,
    size: 4 + Math.random() * 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    gravity: -60,
  });
}

/**
 * @param {object[]} particles
 * @param {number} x
 * @param {number} y
 * @param {number} [count]
 */
export function spawnDust(particles, x, y, count = 7) {
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x,
      y,
      vx: (Math.random() * 2 - 1) * 130,
      vy: -Math.random() * 120,
      life: 0.3 + Math.random() * 0.25,
      maxLife: 0.55,
      size: 2 + Math.random() * 3,
      color: 'rgba(255,255,255,0.75)',
      gravity: 500,
    });
  }
}

/**
 * Vuruş anında genişleyen darbe halkası.
 * @param {object[]} rings
 * @param {number} x
 * @param {number} y
 * @param {string} color
 * @param {number} [maxRadius]
 */
export function spawnRing(rings, x, y, color, maxRadius = 46) {
  rings.push({ x, y, r: 6, maxRadius, life: 0.26, maxLife: 0.26, color });
}

/** @param {object[]} rings @param {number} dt */
export function updateRings(rings, dt) {
  for (let i = rings.length - 1; i >= 0; i -= 1) {
    const ring = rings[i];
    ring.life -= dt;
    if (ring.life <= 0) {
      rings.splice(i, 1);
      continue;
    }
    const t = 1 - ring.life / ring.maxLife;
    ring.r = 6 + (ring.maxRadius - 6) * t;
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {object[]} rings */
export function drawRings(ctx, rings) {
  rings.forEach((ring) => {
    ctx.globalAlpha = Math.max(0, ring.life / ring.maxLife) * 0.85;
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
}

/**
 * Hızlı topun arkasında kalan iz.
 * @param {object[]} ballTrail
 * @param {{ x: number, y: number, vx: number, vy: number }} ball
 * @param {string} phase
 */
export function updateBallTrail(ballTrail, ball, phase) {
  const speed = Math.hypot(ball.vx, ball.vy);

  if (phase !== PHASE.RALLY || speed < 420) {
    if (ballTrail.length > 0) ballTrail.shift();
    return;
  }

  ballTrail.push({ x: ball.x, y: ball.y });
  if (ballTrail.length > 5) ballTrail.shift();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object[]} ballTrail
 * @param {{ radius: number, flaming: number }} ball
 */
export function drawBallTrail(ctx, ballTrail, ball) {
  const count = ballTrail.length;
  if (count === 0) return;

  const flaming = ball.flaming > 0;

  ballTrail.forEach((point, i) => {
    const t = (i + 1) / count;
    ctx.globalAlpha = t * 0.26;
    ctx.fillStyle = flaming ? PALETTE.flame[1] : '#FFFFFF';
    const size = ball.radius * 1.1 * t;
    ctx.fillRect(point.x - size / 2, point.y - size / 2, size, size);
  });

  ctx.globalAlpha = 1;
}

/** @param {object[]} particles @param {number} dt */
export function updateParticles(particles, dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {object[]} particles */
export function drawParticles(ctx, particles) {
  particles.forEach((p) => {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  });
  ctx.globalAlpha = 1;
}
