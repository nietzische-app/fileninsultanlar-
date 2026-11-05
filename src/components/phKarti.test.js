import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { setLang } from '../i18n/index.js';
import ProductHuntKarti from './ProductHuntKarti.jsx';
import { PH_ADRES, phKartiGoster } from './phKarti.js';

describe('phKartiGoster', () => {
  it('kendi sitemizde ve geliştirmede açık', () => {
    expect(phKartiGoster({ hostname: 'www.retrovoleybol.online' })).toBe(true);
    expect(phKartiGoster({ hostname: 'retrovoleybol.online' })).toBe(true);
    expect(phKartiGoster({ hostname: 'localhost' })).toBe(true);
  });

  it('mağaza paketi, iframe ve yabancı alan adında kapalı', () => {
    expect(phKartiGoster({ hostname: 'localhost', yerel: true })).toBe(false);
    expect(phKartiGoster({ hostname: 'www.retrovoleybol.online', cerceve: true })).toBe(false);
    expect(phKartiGoster({ hostname: 'www.y8.com' })).toBe(false);
    expect(phKartiGoster({ hostname: 'oyun.crazygames.com' })).toBe(false);
  });
});

describe('ProductHuntKarti', () => {
  it('bağlantı Product Hunt gömüsü ve yeni sekmede', () => {
    setLang('en');
    const html = renderToStaticMarkup(
      createElement(ProductHuntKarti, { yerel: false, hostname: 'www.retrovoleybol.online', cerceve: false }),
    );
    expect(html.replaceAll('&amp;', '&')).toContain(`href="${PH_ADRES}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('noopener');
    expect(html).toContain('Check it out on Product Hunt');
    expect(html).toContain('8-bit pixel volleyball');
  });

  it('Türkçe düğme metni', () => {
    setLang('tr');
    const html = renderToStaticMarkup(
      createElement(ProductHuntKarti, { yerel: false, hostname: 'localhost', cerceve: false }),
    );
    expect(html).toContain('Product Hunt');
    expect(html).not.toContain('Check it out');
  });

  it('yerel kabukta hiç çizilmez', () => {
    const html = renderToStaticMarkup(
      createElement(ProductHuntKarti, { yerel: true, hostname: 'localhost', cerceve: false }),
    );
    expect(html).toBe('');
  });
});
