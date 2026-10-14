import { describe, it, expect } from 'vitest';
import { DIFFICULTY } from './constants.js';

describe('zorluk kademeleri', () => {
  it('kolay < normal < zor (rakip güç kolları)', () => {
    const { kolay, normal, zor } = DIFFICULTY;
    expect(kolay.speed).toBeLessThan(normal.speed);
    expect(normal.speed).toBeLessThan(zor.speed);
    expect(kolay.power).toBeLessThan(normal.power);
    expect(normal.power).toBeLessThan(zor.power);
    expect(kolay.placement).toBeLessThan(normal.placement);
    expect(normal.placement).toBeLessThan(zor.placement);
    expect(kolay.diveSkill).toBeLessThan(normal.diveSkill);
    expect(kolay.blockSkill).toBeLessThan(normal.blockSkill);
    expect(kolay.serveSkill).toBeLessThan(normal.serveSkill);
  });

  it('kolay daha geç tepki verir ve daha çok sapar', () => {
    const { kolay, normal, zor } = DIFFICULTY;
    expect(kolay.reaction).toBeGreaterThan(normal.reaction);
    expect(normal.reaction).toBeGreaterThan(zor.reaction);
    expect(kolay.error).toBeGreaterThan(normal.error);
    expect(normal.error).toBeGreaterThan(zor.error);
  });

  it('kolay sapması temas yarıçapının epey üstünde — ıska bırakır', () => {
    /*
     * Temas dairesi ~53px. error bunun altındaysa sapma ıskaya
     * dönüşmez, rakip hiç sayı vermez. Kolay bunu açık ara aşmalı.
     */
    expect(DIFFICULTY.kolay.error).toBeGreaterThan(120);
    expect(DIFFICULTY.normal.error).toBeGreaterThan(100);
  });
});
