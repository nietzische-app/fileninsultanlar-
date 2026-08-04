import { describe, expect, it } from 'vitest';
import { PHYSICS, RULES } from './constants.js';
import {
  applyTouch,
  canAttackOnTouch,
  isMatchOver,
  isSetOver,
  matchWinner,
  resolveHitType,
  setWinner,
} from './rules.js';

describe('isSetOver', () => {
  it('15e 2 farkla biter', () => {
    expect(isSetOver(15, 13)).toBe(true);
    expect(isSetOver(14, 13)).toBe(false);
    expect(isSetOver(15, 14)).toBe(false);
  });

  it('uzatmada 2 fark ister', () => {
    expect(isSetOver(16, 15)).toBe(false);
    expect(isSetOver(17, 15)).toBe(true);
  });

  it('21 tavanda fark şartı kalkar', () => {
    expect(isSetOver(21, 20)).toBe(true);
    expect(isSetOver(20, 21)).toBe(true);
  });
});

describe('setWinner / matchWinner', () => {
  it('set kazananını seçer', () => {
    expect(setWinner(15, 10)).toBe('home');
    expect(setWinner(12, 15)).toBe('away');
  });

  it('maç 2 setle biter', () => {
    expect(isMatchOver({ home: 2, away: 0 })).toBe(true);
    expect(isMatchOver({ home: 1, away: 1 })).toBe(false);
    expect(matchWinner({ home: 2, away: 1 })).toBe('home');
  });
});

describe('applyTouch', () => {
  it('yeni taraf temasında sayacı 1 yapar', () => {
    expect(applyTouch({ side: null, count: 0 }, 'home')).toEqual({
      touch: { side: 'home', count: 1 },
      foul: false,
    });
  });

  it('aynı tarafta 3 temasa izin verir, 4. faul', () => {
    let state = { side: null, count: 0 };
    for (let i = 1; i <= 3; i += 1) {
      const next = applyTouch(state, 'home');
      expect(next.foul).toBe(false);
      expect(next.touch.count).toBe(i);
      state = next.touch;
    }
    const foul = applyTouch(state, 'home');
    expect(foul.foul).toBe(true);
    expect(foul.touch.count).toBe(RULES.maxTouches + 1);
  });

  it('rakibe geçince sayaç sıfırlanır', () => {
    const after = applyTouch({ side: 'home', count: 3 }, 'away');
    expect(after).toEqual({ touch: { side: 'away', count: 1 }, foul: false });
  });
});

describe('resolveHitType / canAttackOnTouch', () => {
  it('dalış her zaman dive döner', () => {
    expect(
      resolveHitType({ diving: true, acting: true, airborne: true, controlled: true })
    ).toBe('dive');
  });

  it('havada kontrollü vuruş smaçtır', () => {
    expect(
      resolveHitType({ diving: false, acting: true, airborne: true, controlled: true })
    ).toBe('spike');
  });

  it('yerde kontrollü vuruş hit’tir', () => {
    expect(
      resolveHitType({ diving: false, acting: true, airborne: false, controlled: true })
    ).toBe('hit');
  });

  it('kontrol yoksa manşet', () => {
    expect(
      resolveHitType({ diving: false, acting: true, airborne: true, controlled: false })
    ).toBe('bump');
  });

  it('sert ilk temasta hücum kapalı, ikinci temasta açık', () => {
    const fast = PHYSICS.attackControlSpeed + 50;
    expect(canAttackOnTouch(fast, 1, PHYSICS.attackControlSpeed)).toBe(false);
    expect(canAttackOnTouch(fast, 2, PHYSICS.attackControlSpeed)).toBe(true);
    expect(canAttackOnTouch(100, 1, PHYSICS.attackControlSpeed)).toBe(true);
  });
});
