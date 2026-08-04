import { describe, expect, it } from 'vitest';
import {
  advanceServeMeter,
  aiServeChoice,
  computeServeVelocity,
  meterToAim,
  meterToPower,
  SERVE,
} from './serve.js';

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
