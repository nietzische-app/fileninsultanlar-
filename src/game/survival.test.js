import { describe, expect, it } from 'vitest';
import {
  baselineWave,
  pointsToNextWave,
  survivalDifficulty,
  survivalRank,
  waveForPoints,
  waveLabel,
  waveOpponent,
} from './survival.js';
import { DIFFICULTY, SURVIVAL } from './constants.js';
import { OPPONENT_TEAMS } from './opponents.js';

describe('dalga hesabı', () => {
  it('ilk puanlar 1. dalgada', () => {
    expect(waveForPoints(0)).toBe(1);
    expect(waveForPoints(SURVIVAL.waveLength - 1)).toBe(1);
  });

  it('eşik puanda dalga yükselir', () => {
    expect(waveForPoints(SURVIVAL.waveLength)).toBe(2);
    expect(waveForPoints(SURVIVAL.waveLength * 3)).toBe(4);
  });

  it('geçersiz puanı 1. dalgaya düşürür', () => {
    expect(waveForPoints(-5)).toBe(1);
  });

  it('kalan puanı doğru sayar', () => {
    expect(pointsToNextWave(0)).toBe(SURVIVAL.waveLength);
    expect(pointsToNextWave(SURVIVAL.waveLength - 1)).toBe(1);
    expect(pointsToNextWave(SURVIVAL.waveLength)).toBe(SURVIVAL.waveLength);
  });

  it('dalga adı bire kadar kırpılır', () => {
    expect(waveLabel(3)).toBe('3. DALGA');
    expect(waveLabel(0)).toBe('1. DALGA');
  });
});

describe('dalga rakibi', () => {
  it('ilk dalga listenin ilk takımı', () => {
    expect(waveOpponent(1)).toBe(OPPONENT_TEAMS[0]);
  });

  it('liste bitince başa sarar', () => {
    expect(waveOpponent(OPPONENT_TEAMS.length + 1)).toBe(OPPONENT_TEAMS[0]);
  });

  it('her dalgada tanımlı bir takım verir', () => {
    for (let wave = 1; wave <= 30; wave += 1) {
      expect(waveOpponent(wave)).toBeDefined();
    }
  });
});

describe('zorluk rampası', () => {
  it('1. dalga seçilen kademeden yumuşak başlar', () => {
    const w1 = survivalDifficulty(DIFFICULTY.normal, 1);
    expect(w1.error).toBeGreaterThan(DIFFICULTY.normal.error);
    expect(w1.speed).toBeLessThan(DIFFICULTY.normal.speed);
  });

  it('birkaç dalga sonra seçilen kademeyi geçer', () => {
    const base = DIFFICULTY.normal;
    const later = survivalDifficulty(base, baselineWave() + 2);
    expect(later.error).toBeLessThan(base.error);
    expect(later.speed).toBeGreaterThan(base.speed);
  });

  it('dalga yükseldikçe rakip sertleşir', () => {
    const w1 = survivalDifficulty(DIFFICULTY.normal, 1);
    const w5 = survivalDifficulty(DIFFICULTY.normal, 5);

    expect(w5.error).toBeLessThan(w1.error);
    expect(w5.reaction).toBeLessThan(w1.reaction);
    expect(w5.speed).toBeGreaterThan(w1.speed);
    expect(w5.placement).toBeGreaterThan(w1.placement);
  });

  it('rampa üst sınırda durur', () => {
    const capped = survivalDifficulty(DIFFICULTY.normal, SURVIVAL.maxRampWave);
    const beyond = survivalDifficulty(DIFFICULTY.normal, SURVIVAL.maxRampWave + 40);
    expect(beyond).toEqual(capped);
  });

  it('hiçbir kol saçmalamaz — sınırlar korunur', () => {
    Object.values(DIFFICULTY).forEach((base) => {
      for (let wave = 1; wave <= 40; wave += 1) {
        const d = survivalDifficulty(base, wave);
        expect(d.speed).toBeLessThanOrEqual(1.12);
        expect(d.reaction).toBeGreaterThan(0);
        expect(d.error).toBeGreaterThan(0);
        expect(d.placement).toBeLessThanOrEqual(0.92);
        expect(d.diveSkill).toBeLessThanOrEqual(0.9);
      }
    });
  });

  it('kolay seviye zor seviyeyi geçmez', () => {
    const wave = 6;
    expect(survivalDifficulty(DIFFICULTY.kolay, wave).error).toBeGreaterThan(
      survivalDifficulty(DIFFICULTY.zor, wave).error
    );
  });
});

describe('rütbe', () => {
  it('puan arttıkça rütbe düşmez', () => {
    const seen = [];
    for (let p = 0; p <= 80; p += 1) seen.push(survivalRank(p));
    expect(seen[0]).toBe('ÇAYLAK');
    expect(seen[80]).toBe('EFSANE');
    expect(new Set(seen).size).toBe(6);
  });
});
