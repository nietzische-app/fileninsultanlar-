import { describe, expect, it } from 'vitest';
import {
  COMBO,
  comboCallout,
  comboChargeBonus,
  comboPointBonus,
  comboPointMessage,
  hitStopFor,
  isComboAction,
  nextCombo,
} from './combo.js';

describe('combo', () => {
  it('yalnızca smaç/blok/kurtarış sayılır', () => {
    expect(isComboAction({ type: 'spike' })).toBe(true);
    expect(isComboAction({ type: 'dive' })).toBe(true);
    expect(isComboAction({ type: 'hit', isBlock: true })).toBe(true);
    expect(isComboAction({ type: 'bump' })).toBe(false);
    expect(isComboAction({ type: 'hit' })).toBe(false);
  });

  it('zinciri artırır', () => {
    expect(nextCombo(0, { type: 'spike' })).toBe(1);
    expect(nextCombo(2, { type: 'dive' })).toBe(3);
    expect(nextCombo(3, { type: 'bump' })).toBe(3);
  });

  it('hit-stop süreleri verir', () => {
    expect(hitStopFor({ type: 'spike' })).toBe(COMBO.hitStopSpike);
    expect(hitStopFor({ type: 'dive' })).toBe(COMBO.hitStopSave);
    expect(hitStopFor({ type: 'hit', isBlock: true })).toBe(COMBO.hitStopBlock);
    expect(hitStopFor({ type: 'spike', sultanFired: true })).toBe(COMBO.hitStopSultan);
    expect(hitStopFor({ type: 'bump' })).toBe(0);
  });

  it('bar bonusunu sınırlar', () => {
    expect(comboChargeBonus(1)).toBe(0);
    expect(comboChargeBonus(2)).toBe(COMBO.chargePerStep);
    expect(comboChargeBonus(99)).toBe(COMBO.maxChargeBonus);
    expect(comboPointBonus(3)).toBe(12);
    expect(comboPointBonus(99)).toBe(COMBO.maxPointBonus);
  });

  it('çağrı ve sayı metni üretir', () => {
    expect(comboCallout(1)).toBeNull();
    expect(comboCallout(2)).toBe('x2');
    expect(comboCallout(3, { type: 'spike' })).toBe('x3 SMAÇ!');
    expect(comboCallout(8)).toBe('x8 EFSANE!');
    expect(comboPointMessage(4, null, 1)).toBe('x4 KOMBO SAYI!');
    expect(comboPointMessage(0, 'ÜÇ TEMAS!', 1)).toBe('ÜÇ TEMAS!');
    expect(comboPointMessage(0, null, 3)).toBe('3 SAYI ÜST ÜSTE!');
  });
});
