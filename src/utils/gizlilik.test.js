import { describe, it, expect } from 'vitest';
import { GIZLILIK_YOLU, yerelKabukMu, gizlilikBaglantisi } from './gizlilik';

describe('gizlilik bağlantısı', () => {
  it('yol göreli — alt klasörde servis edilirse de çalışsın', () => {
    expect(GIZLILIK_YOLU.startsWith('/')).toBe(false);
    expect(GIZLILIK_YOLU.startsWith('http')).toBe(false);
  });

  it('tarayıcıda yeni sekmede açılır ve rel korumalı', () => {
    const b = gizlilikBaglantisi(false);
    expect(b.target).toBe('_blank');
    // `noopener` olmadan açılan sayfa `window.opener` ile bizi yönlendirebilir
    expect(b.rel).toContain('noopener');
  });

  it('yerel kabukta _blank YOK — WebView yeni sekme açamıyor', () => {
    const b = gizlilikBaglantisi(true);
    expect(b.target).toBeUndefined();
    expect(b.href).toBe(GIZLILIK_YOLU);
  });
});

describe('yerelKabukMu', () => {
  it('Capacitor genel nesnesi yoksa false (tarayıcı)', () => {
    expect(yerelKabukMu({})).toBe(false);
    expect(yerelKabukMu(undefined)).toBe(false);
  });

  it('Capacitor var ama web platformu ise false', () => {
    expect(yerelKabukMu({ Capacitor: { isNativePlatform: () => false } })).toBe(false);
  });

  it('yerel platformda true', () => {
    expect(yerelKabukMu({ Capacitor: { isNativePlatform: () => true } })).toBe(true);
  });

  it('eski/eksik köprüde çökmez', () => {
    // Capacitor 2'de `isNativePlatform` yoktu; tanımsız çağrı atmamalı
    expect(yerelKabukMu({ Capacitor: {} })).toBe(false);
  });
});
