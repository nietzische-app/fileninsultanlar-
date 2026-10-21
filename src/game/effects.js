/**
 * Canvas parçacık / darbe / iz efektleri.
 * Game motorundan bağımsız — dizi referansları üzerinde çalışır.
 */

import { PALETTE, PHASE } from './constants.js';

/** Parçacık ve halka nesneleri geri dönüşür; her vuruşta yeni nesne doğmaz. */
const parcacikHavuz = [];
const halkaHavuz = [];
const izHavuz = [];

function parcacikAl() {
  return parcacikHavuz.pop() || {
    x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, size: 0, color: '', gravity: 0,
  };
}

function parcacikBirak(p) {
  if (parcacikHavuz.length < 180) parcacikHavuz.push(p);
}

function halkaAl() {
  return halkaHavuz.pop() || { x: 0, y: 0, r: 0, maxRadius: 0, life: 0, maxLife: 0, color: '' };
}

function halkaBirak(ring) {
  if (halkaHavuz.length < 24) halkaHavuz.push(ring);
}

function izAl() {
  return izHavuz.pop() || { x: 0, y: 0 };
}

/** Ölen öğeyi sondakinin yerine koyar; splice kopyası ve yeni dizi yok. */
function yerindenAl(liste, i) {
  const olen = liste[i];
  const son = liste.pop();
  if (i < liste.length) liste[i] = son;
  return olen;
}

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
    const p = parcacikAl();
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.life = 0.45 + Math.random() * 0.3;
    p.maxLife = 0.75;
    p.size = 3 + Math.random() * 3;
    p.color = color;
    p.gravity = 420;
    particles.push(p);
  }
}

/**
 * @param {object[]} particles
 * @param {number} x
 * @param {number} y
 * @param {string[]} [colors]
 */
export function spawnFlame(particles, x, y, colors = PALETTE.flame) {
  const p = parcacikAl();
  p.x = x + (Math.random() * 8 - 4);
  p.y = y + (Math.random() * 8 - 4);
  p.vx = (Math.random() * 2 - 1) * 40;
  p.vy = (Math.random() * 2 - 1) * 40 - 30;
  p.life = 0.3 + Math.random() * 0.2;
  p.maxLife = 0.5;
  p.size = 4 + Math.random() * 4;
  p.color = colors[Math.floor(Math.random() * colors.length)];
  p.gravity = -60;
  particles.push(p);
}

/**
 * @param {object[]} particles
 * @param {number} x
 * @param {number} y
 * @param {number} [count]
 */
export function spawnDust(particles, x, y, count = 7) {
  for (let i = 0; i < count; i += 1) {
    const p = parcacikAl();
    p.x = x;
    p.y = y;
    p.vx = (Math.random() * 2 - 1) * 130;
    p.vy = -Math.random() * 120;
    p.life = 0.3 + Math.random() * 0.25;
    p.maxLife = 0.55;
    p.size = 2 + Math.random() * 3;
    p.color = 'rgba(255,255,255,0.75)';
    p.gravity = 500;
    particles.push(p);
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
  const ring = halkaAl();
  ring.x = x;
  ring.y = y;
  ring.r = 6;
  ring.maxRadius = maxRadius;
  ring.life = 0.26;
  ring.maxLife = 0.26;
  ring.color = color;
  rings.push(ring);
}

/** @param {object[]} rings @param {number} dt */
export function updateRings(rings, dt) {
  for (let i = rings.length - 1; i >= 0; i -= 1) {
    const ring = rings[i];
    ring.life -= dt;
    if (ring.life <= 0) {
      halkaBirak(yerindenAl(rings, i));
      if (i < rings.length) i += 1;
      continue;
    }
    const t = 1 - ring.life / ring.maxLife;
    ring.r = 6 + (ring.maxRadius - 6) * t;
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {object[]} rings */
export function drawRings(ctx, rings) {
  for (let i = 0; i < rings.length; i += 1) {
    const ring = rings[i];
    ctx.globalAlpha = Math.max(0, ring.life / ring.maxLife) * 0.85;
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
    ctx.stroke();
  }
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
    if (ballTrail.length > 0) {
      const eski = ballTrail.shift();
      if (izHavuz.length < 8) izHavuz.push(eski);
    }
    return;
  }

  const nokta = izAl();
  nokta.x = ball.x;
  nokta.y = ball.y;
  ballTrail.push(nokta);
  if (ballTrail.length > 5) {
    const eski = ballTrail.shift();
    if (izHavuz.length < 8) izHavuz.push(eski);
  }
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

  for (let i = 0; i < count; i += 1) {
    const point = ballTrail[i];
    const t = (i + 1) / count;
    ctx.globalAlpha = t * 0.26;
    ctx.fillStyle = flaming ? PALETTE.flame[1] : '#FFFFFF';
    const size = ball.radius * 1.1 * t;
    ctx.fillRect(point.x - size / 2, point.y - size / 2, size, size);
  }

  ctx.globalAlpha = 1;
}

/** @param {object[]} particles @param {number} dt */
export function updateParticles(particles, dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      parcacikBirak(yerindenAl(particles, i));
      if (i < particles.length) i += 1;
      continue;
    }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {object[]} particles */
export function drawParticles(ctx, particles) {
  for (let i = 0; i < particles.length; i += 1) {
    const p = particles[i];
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}
