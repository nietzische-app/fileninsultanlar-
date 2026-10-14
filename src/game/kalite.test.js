import { describe, it, expect, beforeEach } from 'vitest';
import {
  KALITE_DUSUK,
  KALITE_TAM,
  kaliteCizimdenOgren,
  kaliteDusukMu,
  kaliteSeviye,
  kaliteSifirla,
} from './kalite.js';

describe('çizim kalitesi', () => {
  beforeEach(() => {
    kaliteSifirla();
  });

  it('başta tam', () => {
    expect(kaliteSeviye()).toBe(KALITE_TAM);
    expect(kaliteDusukMu()).toBe(false);
  });

  it('tek uzun kare düşürmez', () => {
    kaliteCizimdenOgren(20);
    expect(kaliteDusukMu()).toBe(false);
  });

  it('üst üste ağır çizimde düşer', () => {
    for (let i = 0; i < 12; i += 1) kaliteCizimdenOgren(14);
    expect(kaliteSeviye()).toBe(KALITE_DUSUK);
    expect(kaliteDusukMu()).toBe(true);
  });

  it('toparlanınca geri çıkar', () => {
    for (let i = 0; i < 12; i += 1) kaliteCizimdenOgren(14);
    for (let i = 0; i < 45; i += 1) kaliteCizimdenOgren(5);
    expect(kaliteSeviye()).toBe(KALITE_TAM);
  });
});
