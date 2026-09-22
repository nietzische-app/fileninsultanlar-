import { beforeEach, describe, expect, it } from 'vitest';
import {
  DIL_KODLARI,
  SOZLUK,
  detectBrowserLang,
  dilLocale,
  doldur,
  getLang,
  kalemYazi,
  modeYazi,
  normalizeLang,
  setLang,
  t,
  yuzde,
} from './index.js';

describe('i18n', () => {
  beforeEach(() => {
    setLang('tr');
  });

  it('bilinmeyen kodu tr yapar', () => {
    expect(normalizeLang('de')).toBeNull();
    expect(normalizeLang('en-US')).toBe('en');
    expect(setLang('xx')).toBe('tr');
  });

  it('tr varsayılan, en çevirir', () => {
    expect(t('nav.settings')).toBe('AYARLAR');
    setLang('en');
    expect(t('nav.settings')).toBe('SETTINGS');
    expect(t('select.startMatch')).toBe('START MATCH');
  });

  it('eksik anahtarda tr yedeğine düşer', () => {
    setLang('en');
    expect(t('__yok__')).toBe('__yok__');
  });

  it('yer tutucuları doldurur', () => {
    expect(doldur('{n}. TUR', { n: 3 })).toBe('3. TUR');
    setLang('en');
    expect(t('hud.wave', { n: 4 })).toBe('WAVE 4');
  });

  it('yüzde biçimi dile göre değişir', () => {
    expect(yuzde(55)).toBe('%55');
    setLang('en');
    expect(yuzde(55)).toBe('55%');
  });

  it('en* tarayıcıyı İngilizce sayar', () => {
    const once = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      value: { language: 'en-GB', languages: ['en-GB'] },
      configurable: true,
    });
    expect(detectBrowserLang()).toBe('en');
    Object.defineProperty(globalThis, 'navigator', {
      value: { language: 'tr-TR', languages: ['tr-TR'] },
      configurable: true,
    });
    expect(detectBrowserLang()).toBe('tr');
    if (once) {
      Object.defineProperty(globalThis, 'navigator', { value: once, configurable: true });
    }
  });

  it('her iki sözlükte aynı anahtarlar var', () => {
    const tr = Object.keys(SOZLUK.tr).sort();
    const en = Object.keys(SOZLUK.en).sort();
    expect(en).toEqual(tr);
    expect(tr.length).toBeGreaterThan(80);
  });

  it('mod yazıları id üzerinden gelir', () => {
    expect(modeYazi({ id: 'hemen' }).label).toBe('ONLINE');
    setLang('en');
    expect(modeYazi({ id: 'hemen' }).tagline).toBe('FIND MATCH');
    expect(modeYazi({ id: 'online' }).label).toBe('WITH A FRIEND');
  });

  it('locale dil ile değişir', () => {
    expect(dilLocale()).toBe('tr-TR');
    setLang('en');
    expect(dilLocale()).toBe('en-US');
    expect(getLang()).toBe('en');
  });

  it('DIL_KODLARI tr ve en', () => {
    expect(DIL_KODLARI).toEqual(['tr', 'en']);
  });

  it('FP kalemlerini dile göre yazar', () => {
    const perf = { id: 'fp.perf', ad: 'PERFORMANS', puan: 14 };
    const zor = { id: 'fp.mult', vars: { ad: 'ZOR', n: 1.35 }, ad: 'ZOR ×1.35' };
    expect(kalemYazi(perf)).toBe('PERFORMANS');
    expect(kalemYazi(zor)).toBe('ZOR ×1.35');
    setLang('en');
    expect(kalemYazi(perf)).toBe('PERFORMANCE');
    expect(kalemYazi(zor)).toBe('HARD ×1.35');
    expect(kalemYazi({ id: 'fp.sets', vars: { n: 2 }, ad: '2 SET' })).toBe('2 SETS');
  });
});
