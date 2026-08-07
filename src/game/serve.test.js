import { describe, expect, it } from 'vitest';
import {
  advanceServeMeter,
  aiServeChoice,
  computeServeVelocity,
  meterToAim,
  meterToPower,
  safeAimRange,
  serveOutcome,
  SERVE,
} from './serve.js';
import { GAME_WIDTH, NET } from './constants.js';

describe('serve', () => {
  it('metre salınımı yön değiştirir', () => {
    const up = advanceServeMeter(0.95, 1, 1, 0.1);
    expect(up.meter).toBe(1);
    expect(up.dir).toBe(-1);
    const down = advanceServeMeter(0.05, -1, 1, 0.1);
    expect(down.meter).toBe(0);
    expect(down.dir).toBe(1);
  });

  /*
   * Eskiden burada `Math.max(minPower, …)` vardı: metre 0'da bile güç
   * 0.35 çıkıyor, barın alt yarısı tek bir değere eziliyordu.
   */
  it('güç metreyi doğrusal izler — barın her yeri farklı', () => {
    expect(meterToPower(0)).toBe(0);
    expect(meterToPower(1)).toBe(1);
    expect(meterToPower(0.3)).toBeLessThan(meterToPower(0.6));
    expect(meterToPower(0.6)).toBeLessThan(meterToPower(0.9));
  });

  it('nişan -1..1 aralığında', () => {
    expect(meterToAim(0)).toBe(-1);
    expect(meterToAim(1)).toBe(1);
    expect(meterToAim(0.5)).toBe(0);
  });

  it('servis vektörü rakibe gider', () => {
    const home = computeServeVelocity({ power: 0.6, aim: 0, toOpponent: 1 });
    expect(home.vx).toBeGreaterThan(0);
    expect(home.vy).toBeLessThan(0);
    const away = computeServeVelocity({ power: 0.6, aim: 0, toOpponent: -1 });
    expect(away.vx).toBeLessThan(0);
  });

  it('güç servisi hızlandırır', () => {
    const soft = computeServeVelocity({ power: 0.2, aim: 0, toOpponent: 1, serveStat: 80 });
    const hard = computeServeVelocity({ power: 1, aim: 0, toOpponent: 1, serveStat: 80 });
    expect(Math.abs(hard.vx)).toBeGreaterThan(Math.abs(soft.vx));
  });
});

/*
 * Barın bir bedeli olmalı.
 *
 * İlk sürümde `computeServeVelocity` fileyi aşan en kısa uçuşu arayıp
 * gücü onun üstüne bindiriyordu; az güç = uzun uçuş = yüksek kavis, yani
 * fileyi daha da rahat aşıyordu. Metre nerede yakalanırsa yakalansın
 * servis geçiyordu ve oyuncunun bildirdiği şey buydu. Aşağıdaki testler
 * o garantinin geri gelmediğini bekçiler.
 */
describe('servis barının bedeli', () => {
  it('çok zayıf servis fileye takılır', () => {
    const results = [0, 0.05, 0.1].map((power) =>
      serveOutcome({ power, aim: 0, toOpponent: 1, serveStat: 70 })
    );
    results.forEach((r) => expect(r).toBe('net'));
  });

  it('çok sert + derin servis auta çıkar', () => {
    expect(
      serveOutcome({ power: 1, aim: 1, toOpponent: 1, serveStat: 70 })
    ).toBe('out');
  });

  it('barın orta bandı sahada kalır', () => {
    expect(
      serveOutcome({ power: SERVE.sweetSpot, aim: 0, toOpponent: 1, serveStat: 70 })
    ).toBe('in');
  });

  it('güç arttıkça güvenli nişan aralığı sığlaşır', () => {
    const soft = safeAimRange({ power: 0.35, toOpponent: 1, serveStat: 70 });
    const hard = safeAimRange({ power: 0.9, toOpponent: 1, serveStat: 70 });
    expect(soft).not.toBeNull();
    expect(hard).not.toBeNull();
    // Yumuşak servis derine nişan alabilir, sert servis kısaya zorunlu
    expect(soft.max).toBeGreaterThan(hard.max);
  });

  it('güvenli aralık gerçekten güvenli', () => {
    [0.3, 0.45, 0.62, 0.8, 0.95].forEach((power) => {
      const safe = safeAimRange({ power, toOpponent: 1, serveStat: 70 });
      if (!safe) return;
      for (let m = safe.min; m <= safe.max + 1e-9; m += 0.02) {
        expect(
          serveOutcome({ power, aim: meterToAim(m), toOpponent: 1, serveStat: 70 })
        ).toBe('in');
      }
    });
  });

  it('metrenin her yeri aynı sonucu vermez', () => {
    const seen = new Set();
    for (let m = 0; m <= 1.0001; m += 0.05) {
      seen.add(serveOutcome({ power: m, aim: 0.6, toOpponent: 1, serveStat: 70 }));
    }
    expect(seen.size).toBeGreaterThanOrEqual(3); // net, in, out
  });

  it('away tarafı simetrik çalışır', () => {
    expect(
      serveOutcome({ power: SERVE.sweetSpot, aim: 0, toOpponent: -1, serveStat: 70 })
    ).toBe('in');
    expect(serveOutcome({ power: 0.05, aim: 0, toOpponent: -1 })).toBe('net');
  });

  it('nişan derinliği belirler', () => {
    const shallow = computeServeVelocity({ power: 0.5, aim: -1, toOpponent: 1 });
    const deep = computeServeVelocity({ power: 0.5, aim: 1, toOpponent: 1 });
    expect(Math.abs(deep.vx)).toBeGreaterThan(Math.abs(shallow.vx));
  });

  it('aut çizgisi sahanın içinde', () => {
    const outX = GAME_WIDTH * SERVE.outLine;
    expect(outX).toBeGreaterThan(NET.x);
    expect(outX).toBeLessThan(GAME_WIDTH);
  });
});

describe('AI servisi', () => {
  /** Verilen beceride n servisin sonuç dağılımı. */
  function tally(skill, n = 3000) {
    const out = { in: 0, net: 0, out: 0 };
    for (let i = 0; i < n; i += 1) {
      const c = aiServeChoice(skill, 1, 70);
      out[serveOutcome({ ...c, toOpponent: 1, serveStat: 70 })] += 1;
    }
    return out;
  }

  it('beceri arttıkça ortalama güç artar', () => {
    const avg = (skill) => {
      let sum = 0;
      for (let i = 0; i < 500; i += 1) sum += aiServeChoice(skill, 1, 70).power;
      return sum / 500;
    };
    expect(avg(0.95)).toBeGreaterThan(avg(0.1));
  });

  /*
   * Güvenli aralığı hesaplayıp içine nişan alan AI hiç faul yapmıyordu —
   * ölçümde normal ve zor için tam %0. Oyuncu barı ıskaladığında sayı
   * veriyorsa rakip de vermeli.
   */
  it('zayıf AI faul yapar', () => {
    const t = tally(0.25);
    // Ölçülen oran ~%5 (file üstü bandı bazı kasıtlı fauleri kurtarıyor)
    expect(t.net + t.out).toBeGreaterThan(3000 * 0.03);
  });

  it('güçlü AI bile ara sıra faul yapar', () => {
    const t = tally(0.9);
    const faults = t.net + t.out;
    expect(faults).toBeGreaterThan(0);
    expect(faults).toBeLessThan(3000 * 0.15);
  });

  it('faul oranı beceriyle düşer', () => {
    const weak = tally(0.2);
    const strong = tally(0.9);
    expect(weak.net + weak.out).toBeGreaterThan(strong.net + strong.out);
  });
});
