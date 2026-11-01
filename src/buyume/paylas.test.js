import { beforeEach, describe, expect, it } from 'vitest';
import { setLang } from '../i18n/index.js';
import { PLAY_URL } from './magaza.js';
import { davetPaylasimi, paylasAc, sonucPaylasimi } from './paylas.js';

function mac() {
  return {
    winner: 'home',
    campaign: 'match',
    format: 'classic',
    playMode: 'solo',
    sets: { home: 3, away: 1 },
    setHistory: [],
    opponent: { shortName: 'ATLAS', name: 'Atlas' },
  };
}

describe('paylaşım', () => {
  beforeEach(() => {
    setLang('tr');
  });

  it('sonuç metni skoru ve ücretsiz satırını taşır, adres ayrı alandadır', () => {
    const istek = sonucPaylasimi(mac(), null);
    expect(istek.url).toBe(PLAY_URL);
    expect(istek.text).toContain('TÜRKİYE 3-1 ATLAS');
    expect(istek.text).toContain("Google Play'de ücretsiz");
    expect(istek.text).not.toContain('https://');
  });

  it('davet metni reklamsız ve Play adresini taşır', () => {
    const istek = davetPaylasimi();
    expect(istek.text).toContain('Reklamsız');
    expect(istek.url).toContain('id=app.retrovoleybol.oyun');
  });

  it('yerel sayfa görsel dosyası, metin ve adresi birlikte açar', async () => {
    const cagrilar = [];
    const durum = await paylasAc(
      {
        ...sonucPaylasimi(mac(), null),
        canvas: { toDataURL: () => 'data:image/png;base64,YQ==' },
      },
      {
        yerel: true,
        dosyaYaz: async () => ({ uri: 'file:///cache/retro-voleybol.png' }),
        share: async (opts) => {
          cagrilar.push(opts);
        },
      },
    );
    expect(durum).toBe('ok');
    expect(cagrilar).toHaveLength(1);
    expect(cagrilar[0].files).toEqual(['file:///cache/retro-voleybol.png']);
    expect(cagrilar[0].text).toContain('TÜRKİYE 3-1 ATLAS');
    expect(cagrilar[0].url).toBe(PLAY_URL);
  });

  it('görsel reddedilirse metin ve adresle yeniden dener', async () => {
    const cagrilar = [];
    const durum = await paylasAc(
      {
        ...sonucPaylasimi(mac(), null),
        canvas: { toDataURL: () => 'data:image/png;base64,YQ==' },
      },
      {
        yerel: true,
        dosyaYaz: async () => ({ uri: 'file:///cache/a.png' }),
        share: async (opts) => {
          cagrilar.push(opts);
          if (opts.files) throw new Error('only file urls are supported');
        },
      },
    );
    expect(durum).toBe('ok');
    expect(cagrilar).toHaveLength(2);
    expect(cagrilar[0].files).toEqual(['file:///cache/a.png']);
    expect(cagrilar[1].url).toBe(PLAY_URL);
    expect(cagrilar[1].files).toBeUndefined();
  });

  it('sayfa iptali hata sayılmaz ve ikinci deneme açmaz', async () => {
    let n = 0;
    const durum = await paylasAc(
      {
        ...sonucPaylasimi(mac(), null),
        canvas: { toDataURL: () => 'data:image/png;base64,YQ==' },
      },
      {
        yerel: true,
        dosyaYaz: async () => ({ uri: 'file:///cache/a.png' }),
        share: async () => {
          n += 1;
          throw new Error('Share canceled');
        },
      },
    );
    expect(durum).toBe('iptal');
    expect(n).toBe(1);
  });

  it('tarayıcı dosyayı paylaşabiliyorsa dosyayla açar', async () => {
    const dosya = new File(['x'], 'retro-voleybol.png', { type: 'image/png' });
    let gelen = null;
    const durum = await paylasAc(sonucPaylasimi(mac(), null), {
      yerel: false,
      dosyalar: [dosya],
      navigator: {
        canShare: () => true,
        share: async (opts) => {
          gelen = opts;
        },
      },
    });
    expect(durum).toBe('ok');
    expect(gelen.files).toEqual([dosya]);
    expect(gelen.url).toBe(PLAY_URL);
  });

  it('paylaşım yoksa bağlantıyı kopyalar, görseli indirir', async () => {
    let kopya = '';
    let indirildi = false;
    const durum = await paylasAc(
      {
        ...sonucPaylasimi(mac(), null),
        canvas: { toDataURL: () => 'data:image/png;base64,YQ==' },
      },
      {
        yerel: false,
        navigator: {},
        clipboard: {
          writeText: async (metin) => {
            kopya = metin;
          },
        },
        document: {
          body: {
            appendChild() {},
          },
          createElement() {
            return {
              click() {
                indirildi = true;
              },
              remove() {},
            };
          },
        },
      },
    );
    expect(durum).toBe('yedek');
    expect(kopya).toContain(PLAY_URL);
    expect(kopya).toContain('TÜRKİYE 3-1 ATLAS');
    expect(indirildi).toBe(true);
  });

  it('tarayıcı iptalinde pano kullanılmaz', async () => {
    let kopyalandi = false;
    const durum = await paylasAc(davetPaylasimi(), {
      yerel: false,
      navigator: {
        share: async () => {
          const hata = new Error('Abort');
          hata.name = 'AbortError';
          throw hata;
        },
      },
      clipboard: {
        writeText: async () => {
          kopyalandi = true;
        },
      },
    });
    expect(durum).toBe('iptal');
    expect(kopyalandi).toBe(false);
  });
});
