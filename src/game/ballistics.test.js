import { describe, expect, it } from 'vitest';
import { GAME_WIDTH, GROUND_Y, NET, PHYSICS, WALL_PAD } from './constants.js';
import {
  clearsNet,
  computeAttackVelocity,
  computeSetVelocity,
} from './ballistics.js';
import { clamp } from './math.js';

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
