import { describe, expect, it } from 'vitest';
import { SURUKLEME, suruklemeGirdisi, yuvaSec } from './surukleme.js';

describe('serbest sürükleme', () => {
  it('küçük titremede yön vermez', () => {
    expect(suruklemeGirdisi(SURUKLEME.deadzone - 1, 0)).toEqual({
      left: false,
      right: false,
      dive: false,
    });
  });

  it('sağa kayınca sağ, sola kayınca sol basılı kalır', () => {
    expect(suruklemeGirdisi(SURUKLEME.deadzone, 0).right).toBe(true);
    expect(suruklemeGirdisi(-SURUKLEME.deadzone, 0).left).toBe(true);
    const sag = suruklemeGirdisi(20, 0);
    expect(suruklemeGirdisi(-20, 0, sag)).toEqual({ left: true, right: false, dive: false });
  });

  it('yön açılınca eşikte titreme kesmez', () => {
    const sag = suruklemeGirdisi(12, 0);
    const orta = suruklemeGirdisi(SURUKLEME.release + 1, 0, sag);
    expect(orta.right).toBe(true);
    expect(suruklemeGirdisi(1, 0, sag).right).toBe(false);
  });

  it('aşağı kaydırınca dalış, yukarı dönünce bırakır', () => {
    const dalis = suruklemeGirdisi(12, SURUKLEME.dive);
    expect(dalis.dive).toBe(true);
    expect(dalis.right).toBe(true);
    expect(suruklemeGirdisi(12, SURUKLEME.dive * 0.6, dalis).dive).toBe(true);
    expect(suruklemeGirdisi(12, 0, dalis).dive).toBe(false);
  });

  it('tek oyunculuda hep birinci yuva, çiftte yarıya böler', () => {
    expect(yuvaSec(10, 200, false)).toBe('p1');
    expect(yuvaSec(40, 200, true)).toBe('p1');
    expect(yuvaSec(140, 200, true)).toBe('p2');
  });
});
