import { describe, expect, it } from 'vitest';
import { GAME_WIDTH, GROUND_Y, NET, PHYSICS, TIP, WALL_PAD } from './constants.js';
import {
  clearsNet,
  computeAttackVelocity,
  computeSetVelocity,
  computeTipVelocity,
} from './ballistics.js';
import { clamp } from './math.js';

const SAMPLE_PLAYER = { modifiers: {} };

/** Topu ileri simüle edip yere değdiği noktayı verir. */
function simulate(ball, shot, step = 1 / 240) {
  let { x, y } = ball;
  let { vx, vy } = shot;

  for (let i = 0; i < 240 * 4; i += 1) {
    vy += PHYSICS.ballGravity * step;
    x += vx * step;
    y += vy * step;
    if (x - ball.radius <= WALL_PAD || x + ball.radius >= GAME_WIDTH - WALL_PAD) {
      vx = -vx * PHYSICS.wallRestitution;
    }
    if (vy > 0 && y >= GROUND_Y - ball.radius) return { x, t: i * step };
  }
  return { x, t: Infinity };
}

describe('clamp', () => {
  it('aralığa sıkıştırır', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});

describe('clearsNet', () => {
  const ball = { x: 200, y: GROUND_Y - 120, radius: PHYSICS.ballRadius };

  it('file üstünden geçen atışı kabul eder', () => {
    // Kısa uçuşta yüksek parabola — fileyi aşar
    const shot = { vx: 400, vy: -700 };
    expect(clearsNet(ball, shot, 1.2)).toBe(true);
  });

  it('fileye çarpan alçak atışı reddeder', () => {
    const shot = { vx: 500, vy: -50 };
    expect(clearsNet(ball, shot, 0.8)).toBe(false);
  });

  it('file yolunda değilse true döner', () => {
    const nearNet = { x: NET.x + 10, y: 200, radius: 13 };
    expect(clearsNet(nearNet, { vx: 300, vy: -100 }, 0.5)).toBe(true);
  });
});

describe('computeSetVelocity', () => {
  it('topu kendi sahasında file önüne kaldırır', () => {
    const ball = { x: 180, y: GROUND_Y - 40, radius: PHYSICS.ballRadius };
    const shot = computeSetVelocity(ball, 1, () => 0.5);
    expect(shot.vy).toBeLessThan(0);
    // Hedef file solunda (home → away yönü)
    const targetApprox = NET.x - 120;
    const t = 0.95;
    const landX = ball.x + shot.vx * t;
    expect(landX).toBeCloseTo(targetApprox, 0);
    expect(landX).toBeLessThan(NET.x);
  });
});

describe('computeAttackVelocity', () => {
  it('rakip sahaya inen bir smaç üretir', () => {
    const ball = {
      x: NET.x - 80,
      y: GROUND_Y - 160,
      radius: PHYSICS.ballRadius,
    };
    const player = {
      controlled: true,
      vx: 0,
      aimSpread: 0.5,
      data: { modifiers: {} },
    };

    const shot = computeAttackVelocity({
      ball,
      player,
      power: PHYSICS.spikePower,
      toOpponent: 1,
      nx: 0.2,
      arc: 1,
      rand: () => 0.5,
    });

    expect(shot.vx).toBeGreaterThan(0);
    expect(clearsNet(ball, shot, 1.0)).toBe(true);

    // Kabaca rakip sahaya düşmeli
    const t = 0.5;
    const xAt = ball.x + shot.vx * t;
    expect(xAt).toBeGreaterThan(NET.x);
    expect(xAt).toBeLessThan(GAME_WIDTH - WALL_PAD);
  });

  it('AI aimSpread değerini kullanır', () => {
    const ball = {
      x: NET.x - 60,
      y: GROUND_Y - 150,
      radius: PHYSICS.ballRadius,
    };
    const base = {
      controlled: false,
      vx: 0,
      data: { modifiers: {} },
    };

    const near = computeAttackVelocity({
      ball,
      player: { ...base, aimSpread: 0.15 },
      power: PHYSICS.spikePower,
      toOpponent: 1,
      nx: 0,
      rand: () => 0.5,
    });
    const far = computeAttackVelocity({
      ball,
      player: { ...base, aimSpread: 0.9 },
      power: PHYSICS.spikePower,
      toOpponent: 1,
      nx: 0,
      rand: () => 0.5,
    });

    expect(far.vx).toBeGreaterThan(near.vx);
  });
});

describe('plase (dink)', () => {
  const ball = { x: 430, y: 250, radius: PHYSICS.ballRadius };

  it('topu rakip sahaya, file dibine gönderir', () => {
    const shot = computeTipVelocity({ ball, toOpponent: 1, aim: 0 });
    const land = simulate(ball, shot);
    expect(land.x).toBeGreaterThan(NET.x);
    expect(land.x - NET.x).toBeLessThan(TIP.maxDepth + 60);
  });

  it('her iki yöne de çalışır', () => {
    const left = simulate(
      { ...ball, x: 470 },
      computeTipVelocity({ ball: { ...ball, x: 470 }, toOpponent: -1, aim: 0.5 })
    );
    expect(left.x).toBeLessThan(NET.x);
  });

  it('fileyi geçer', () => {
    const shot = computeTipVelocity({ ball, toOpponent: 1, aim: 0.3 });
    expect(clearsNet(ball, shot, TIP.flight * 1.6)).toBe(true);
  });

  it('smaçtan belirgin biçimde yavaştır', () => {
    const tip = computeTipVelocity({ ball, toOpponent: 1, aim: 0.5 });
    const spike = computeAttackVelocity({
      ball,
      player: { controlled: false, aimSpread: 0.5, vx: 0, data: SAMPLE_PLAYER },
      power: PHYSICS.spikePower,
      toOpponent: 1,
      nx: 0.2,
    });
    expect(Math.hypot(tip.vx, tip.vy)).toBeLessThan(Math.hypot(spike.vx, spike.vy));
  });

  it('nişan büyüdükçe daha derine düşer', () => {
    const shallow = simulate(ball, computeTipVelocity({ ball, toOpponent: 1, aim: 0 }));
    const deep = simulate(ball, computeTipVelocity({ ball, toOpponent: 1, aim: 1 }));
    expect(deep.x).toBeGreaterThan(shallow.x);
  });
});
