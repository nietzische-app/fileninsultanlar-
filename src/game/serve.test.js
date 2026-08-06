import { describe, expect, it } from 'vitest';
import {
  advanceServeMeter,
  aiServeChoice,
  computeServeVelocity,
  meterToAim,
  meterToPower,
  SERVE,
} from './serve.js';
import { GAME_WIDTH, GROUND_Y, NET, PHYSICS, WALL_PAD } from './constants.js';

describe('serve', () => {
  it('metre salınımı yön değiştirir', () => {
    const up = advanceServeMeter(0.95, 1, 1, 0.1);
    expect(up.meter).toBe(1);
    expect(up.dir).toBe(-1);
    const down = advanceServeMeter(0.05, -1, 1, 0.1);
    expect(down.meter).toBe(0);
    expect(down.dir).toBe(1);
  });

  it('güç sweet spot üretir', () => {
    expect(meterToPower(0.78)).toBeGreaterThan(meterToPower(0.1));
    expect(meterToPower(0.78)).toBeGreaterThanOrEqual(SERVE.minPower);
    expect(meterToPower(1)).toBeLessThanOrEqual(SERVE.maxPower);
  });

  it('nişan -1..1 aralığında', () => {
    expect(meterToAim(0)).toBe(-1);
    expect(meterToAim(1)).toBe(1);
    expect(meterToAim(0.5)).toBe(0);
  });

  it('servis vektörü rakibe gider', () => {
    const home = computeServeVelocity({ power: 0.8, aim: 0, toOpponent: 1 });
    expect(home.vx).toBeGreaterThan(0);
    expect(home.vy).toBeLessThan(0);
    const away = computeServeVelocity({ power: 0.8, aim: 0, toOpponent: -1 });
    expect(away.vx).toBeLessThan(0);
  });

  it('AI seçimi zorlukla iyileşir', () => {
    const easy = aiServeChoice(0.1);
    const hard = aiServeChoice(0.95);
    expect(hard.power).toBeGreaterThan(easy.power);
  });
});

describe('servis file aşımı', () => {
  const homeX = GAME_WIDTH * SERVE.backLineHome;
  const awayX = GAME_WIDTH * SERVE.backLineAway;

  /** Servisi ileri simüle eder. */
  function fly(power, aim, fromX, toOpponent) {
    let x = fromX;
    let y = GROUND_Y - SERVE.holdHeight;
    const shot = computeServeVelocity({ power, aim, toOpponent, serveStat: 80 });
    let { vx, vy } = shot;
    const step = 1 / 240;
    let netY = null;

    for (let i = 0; i < 240 * 5; i += 1) {
      const prevX = x;
      vy += PHYSICS.ballGravity * step;
      x += vx * step;
      y += vy * step;
      const crossed =
        (prevX < NET.x && x >= NET.x) || (prevX > NET.x && x <= NET.x);
      if (netY === null && crossed) netY = y;
      if (vy > 0 && y >= GROUND_Y - PHYSICS.ballRadius) break;
    }
    return { landX: x, netY };
  }

  /*
   * Aktarılan ilk sürümde HİÇBİR güç fileyi aşamıyordu: azami güçte bile
   * top file hizasında 47 piksel aşağıdaydı, düşük güçlerde kendi
   * sahasına düşüyordu. Bu yüzden her servis sayı kaybıydı.
   */
  it('her güç ve nişanda fileyi aşar ve rakip sahaya iner', () => {
    [0.36, 0.5, 0.7, 0.85, 1].forEach((power) => {
      [-1, -0.5, 0, 0.5, 1].forEach((aim) => {
        const r = fly(power, aim, homeX, 1);
        expect(r.netY).not.toBeNull();
        expect(r.netY).toBeLessThan(NET.topY - 8);
        expect(r.landX).toBeGreaterThan(NET.x);
        expect(r.landX).toBeLessThan(GAME_WIDTH - WALL_PAD);
      });
    });
  });

  it('away tarafı simetrik çalışır', () => {
    const r = fly(0.8, 0, awayX, -1);
    expect(r.netY).toBeLessThan(NET.topY - 8);
    expect(r.landX).toBeLessThan(NET.x);
    expect(r.landX).toBeGreaterThan(WALL_PAD);
  });

  it('nişan derinliği belirler', () => {
    const near = fly(0.8, -1, homeX, 1);
    const deep = fly(0.8, 1, homeX, 1);
    expect(deep.landX).toBeGreaterThan(near.landX);
  });

  it('güç uçuş süresini kısaltır — sert servis daha hızlı gelir', () => {
    const soft = computeServeVelocity({ power: 0.36, aim: 0, toOpponent: 1, serveStat: 80 });
    const hard = computeServeVelocity({ power: 1, aim: 0, toOpponent: 1, serveStat: 80 });
    expect(Math.abs(hard.vx)).toBeGreaterThan(Math.abs(soft.vx));
  });
});
