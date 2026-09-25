import { describe, expect, it } from 'vitest';
import {
  easeInOut,
  lerp,
  padSinirla,
  tutDongu,
  tutKonum,
  yeterinceSuruklendi,
  TUT_PERIOD_MS,
} from './tutorialAnim.js';

describe('tutorialAnim', () => {
  it('easeInOut uçlarda 0 ve 1', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
  });

  it('lerp doğrusal', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
    expect(lerp(10, 20, 0.5)).toBe(15);
  });

  it('döngü başında parmak gizli, tuş yerinde', () => {
    const d = tutDongu(0);
    expect(d.nx).toBe(0);
    expect(d.finger).toBe(0);
  });

  it('döngü ortasında tuş hedefe yürür', () => {
    const d = tutDongu(TUT_PERIOD_MS * 0.4);
    expect(d.nx).toBeGreaterThan(0.2);
    expect(d.nx).toBeLessThan(1);
    expect(d.finger).toBe(1);
    expect(d.press).toBe(1);
  });

  it('döngü periyodik', () => {
    const a = tutDongu(100);
    const b = tutDongu(100 + TUT_PERIOD_MS);
    expect(b.nx).toBeCloseTo(a.nx);
    expect(b.finger).toBeCloseTo(a.finger);
  });

  it('tutKonum uç noktaları bağlar', () => {
    const start = { x: 0, y: 10 };
    const end = { x: 100, y: 50 };
    expect(tutKonum({ nx: 0, ny: 0 }, start, end)).toEqual({ x: 0, y: 10 });
    expect(tutKonum({ nx: 1, ny: 1 }, start, end)).toEqual({ x: 100, y: 50 });
  });

  it('sürükleme eşiği', () => {
    expect(yeterinceSuruklendi(0, 0)).toBe(false);
    expect(yeterinceSuruklendi(28, 0)).toBe(true);
    expect(yeterinceSuruklendi(10, 10)).toBe(false);
  });

  it('pad playground içinde kalır', () => {
    expect(padSinirla(-20, -4, 40, 200, 100)).toEqual({ x: 0, y: 0 });
    expect(padSinirla(999, 999, 40, 200, 100)).toEqual({ x: 160, y: 60 });
  });
});
