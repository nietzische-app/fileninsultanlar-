import { beforeEach, describe, expect, it } from 'vitest';
import { setLang } from '../i18n/index.js';
import { cizPaylasimKarti, kartVerisi, modAdi } from './kart.js';
import { PLAY_URL } from './magaza.js';

function mac(extra = {}) {
  return {
    winner: 'home',
    campaign: 'match',
    format: 'classic',
    playMode: 'solo',
    sets: { home: 3, away: 1 },
    setHistory: [
      { home: 25, away: 20 },
      { home: 22, away: 25 },
      { home: 15, away: 10 },
      { home: 15, away: 8 },
    ],
    opponent: { name: 'Atlas Fırtınası', shortName: 'ATLAS' },
    ...extra,
  };
}

function sahteCtx() {
  const yazilar = [];
  return {
    yazilar,
    imageSmoothingEnabled: true,
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    fillRect() {},
    fillText(text) {
      yazilar.push(String(text));
    },
    measureText(text) {
      return { width: String(text).length * 18 };
    },
  };
}

describe('paylaşım kartı', () => {
  beforeEach(() => {
    setLang('tr');
  });

  it('galibiyet kartında skor, takım, logo yazısı ve Play adresi var', () => {
    const kart = kartVerisi(mac());
    expect(kart.baslik).toBe('RETRO VOLEYBOL');
    expect(kart.mod).toBe('SINGLEPLAYER');
    expect(kart.ev).toBe('TÜRKİYE');
    expect(kart.deplasman).toBe('ATLAS');
    expect(kart.skorSatiri).toBe('TÜRKİYE 3-1 ATLAS');
    expect(kart.sonuc).toContain('şampiyon');
    expect(kart.ucretsiz).toBe("Google Play'de ücretsiz");
    expect(kart.url).toBe(PLAY_URL);
    expect(kart.url).toContain('id=app.retrovoleybol.oyun');
    expect(kart.setler).toContain('25-20');

    const ctx = sahteCtx();
    cizPaylasimKarti(ctx, kart, 1080, 1080);
    const metin = ctx.yazilar.join('\n');
    expect(metin).toContain('RETRO VOLEYBOL');
    expect(metin).toContain('TÜRKİYE');
    expect(metin).toContain('ATLAS');
    expect(metin).toContain('3');
    expect(metin).toContain('1');
    expect(metin).toContain("Google Play'de ücretsiz");
    expect(metin).toContain('app.retrovoleybol.oyun');
  });

  it('kayıp, kupa, elenme ve hayatta kalma ayrı başlık', () => {
    expect(kartVerisi(mac({ winner: 'away' })).sonuc).toContain('maç bitti');
    expect(kartVerisi(mac({ campaign: 'tournament' }), { champion: true }).sonuc).toContain('kupayı');
    expect(kartVerisi(mac({ winner: 'away', campaign: 'tournament' }), { champion: false }).sonuc).toContain('elendik');
    const kosu = kartVerisi(mac({
      winner: null,
      campaign: 'survival',
      survival: { points: 42, wave: 3 },
    }));
    expect(kosu.hayatta).toBe(true);
    expect(kosu.skorSatiri).toContain('42');
    expect(kosu.skorSatiri).toContain('3');
    expect(kosu.mod).toBe('HAYATTA KALMA');
  });

  it('mod adı çevrimiçi, co-op ve karşılıklı ayrılır', () => {
    expect(modAdi(mac({ playMode: 'coop' }))).toBe('CO-OP');
    expect(modAdi(mac({ playMode: 'vs' }))).toBe('KARŞILIKLI');
    expect(modAdi(mac({ playMode: 'vs', cevrimici: true }))).toBe('ONLINE');
  });

  it('İngilizce kartta Free on Google Play yazar', () => {
    setLang('en');
    const kart = kartVerisi(mac());
    expect(kart.ucretsiz).toBe('Free on Google Play');
    expect(kart.ev).toBe('TÜRKİYE');
    expect(kart.skorSatiri).toBe('TÜRKİYE 3-1 ATLAS');
    const ctx = sahteCtx();
    cizPaylasimKarti(ctx, kart);
    expect(ctx.yazilar.join('\n')).toContain('Free on Google Play');
  });
});
