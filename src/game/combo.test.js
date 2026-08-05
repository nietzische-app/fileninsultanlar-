import { describe, expect, it } from 'vitest';
import {
  comboChargeMultiplier,
  comboPowerMultiplier,
  comboTierAt,
  currentComboTier,
  isPerfectTiming,
} from './combo.js';
import { COMBO, PERFECT } from './constants.js';

describe('kombo kademeleri', () => {
  it('yalnızca eşiğe tam ulaşınca duyurur', () => {
    const first = COMBO.tiers[0].at;
    expect(comboTierAt(first)?.at).toBe(first);
    expect(comboTierAt(first + 1)).toBeNull();
    expect(comboTierAt(first - 1)).toBeNull();
  });

  it('geçerli kademe en yüksek aşılan eşiktir', () => {
    const [t1, t2] = COMBO.tiers;
    expect(currentComboTier(0)).toBeNull();
    expect(currentComboTier(t1.at)?.at).toBe(t1.at);
    expect(currentComboTier(t2.at - 1)?.at).toBe(t1.at);
    expect(currentComboTier(t2.at)?.at).toBe(t2.at);
  });

  it('kademeler artan sırada tanımlı', () => {
    COMBO.tiers.forEach((tier, i) => {
      if (i > 0) expect(tier.at).toBeGreaterThan(COMBO.tiers[i - 1].at);
    });
  });
});

describe('kombo çarpanları', () => {
  it('kombo yokken çarpan 1', () => {
    expect(comboChargeMultiplier(0)).toBe(1);
    expect(comboPowerMultiplier(0)).toBe(1);
  });

  it('kombo büyüdükçe artar', () => {
    expect(comboChargeMultiplier(5)).toBeGreaterThan(comboChargeMultiplier(2));
    expect(comboPowerMultiplier(5)).toBeGreaterThan(comboPowerMultiplier(2));
  });

  it('tavanı aşmaz', () => {
    expect(comboChargeMultiplier(999)).toBe(COMBO.maxChargeMultiplier);
    expect(comboPowerMultiplier(999)).toBe(COMBO.maxPowerMultiplier);
  });

  it('güç ödülü dolum ödülünden belirgin biçimde zayıf', () => {
    // Kombo topu hızlandırmak için değil, Sultan Gücü'ne çabuk ulaşmak
    // için. Güç de aynı hızda büyüseydi kombo yapan geri dönülemez
    // biçimde öne geçerdi.
    expect(COMBO.maxPowerMultiplier).toBeLessThan(COMBO.maxChargeMultiplier);
    expect(comboPowerMultiplier(10) - 1).toBeLessThan(
      (comboChargeMultiplier(10) - 1) / 3
    );
  });

  it('negatif kombo çarpanı bozmaz', () => {
    expect(comboChargeMultiplier(-4)).toBe(1);
    expect(comboPowerMultiplier(-4)).toBe(1);
  });
});

describe('tam vuruş zamanlaması', () => {
  it('pencere içinde basış tam vuruştur', () => {
    expect(isPerfectTiming(10, 10)).toBe(true);
    expect(isPerfectTiming(10 + PERFECT.window * 0.5, 10)).toBe(true);
    expect(isPerfectTiming(10 + PERFECT.window, 10)).toBe(true);
  });

  it('pencere dolduktan sonra tam vuruş değil', () => {
    expect(isPerfectTiming(10 + PERFECT.window + 0.01, 10)).toBe(false);
  });

  it('tuş basılmadıysa tam vuruş yok', () => {
    expect(isPerfectTiming(10, null)).toBe(false);
    expect(isPerfectTiming(10, undefined)).toBe(false);
  });

  it('tuşu basılı tutmak pencereyi kaçırır', () => {
    // Basış anı sabit kalır; zaman ilerledikçe fark büyür.
    // Düzeltilen asıl davranış bu: "tuşa bas ve bırakma" artık
    // ödüllendirilmiyor.
    const pressedAt = 3;
    expect(isPerfectTiming(3.05, pressedAt)).toBe(true);
    expect(isPerfectTiming(4.5, pressedAt)).toBe(false);
  });

  it('gelecekte basış sayılmaz', () => {
    expect(isPerfectTiming(9, 10)).toBe(false);
  });
});
