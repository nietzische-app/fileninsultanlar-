import { describe, it, expect } from 'vitest';
import Game from './Game.js';
import { paketle } from './snapshot.js';

/** Başsız misafir motoru — tarayıcı yok, çizim yok. */
function misafirKur() {
  return new Game(null, {
    mode: '1v1',
    format: 'single',
    difficulty: 'normal',
    playMode: 'vs',
    bassiz: true,
    agRol: 'misafir',
    agYuvam: 'p1',
  });
}

/**
 * Zamanı KARE KARE akıtır.
 *
 * `ilerlet(2)` işe yaramıyor: tek çağrı `PHYSICS.maxCatchUp` ile
 * sınırlanıyor (sekme arka plandayken biriken zamanın tek karede
 * boşalmaması için) ve yalnız iki adım atıyor. Gerçek döngü de her
 * karede bir kez çağırıyor; test de öyle yapmalı.
 */
function akit(oyun, saniye) {
  const kare = 1 / 60;
  for (let gecen = 0; gecen < saniye; gecen += kare) oyun.ilerlet(kare);
}

/** Sunucu tarafı — paket üretmek için. */
function sunucuKur() {
  return new Game(null, {
    mode: '1v1',
    format: 'single',
    difficulty: 'normal',
    playMode: 'vs',
    bassiz: true,
    agRol: 'ev',
    agGonder: () => {},
  });
}

describe('ağ sessizliği', () => {
  /*
   * Bu testin sebebi gerçek bir arıza: maç kuruldu, sunucudan tek bir
   * durum paketi gelmedi, ekran ilk karede dondu ve oyun hiçbir şey
   * söylemedi. Bekçi "son paketten beri geçen süre"ye bakıyordu ve son
   * paket hiç olmadığı için sessiz kalıyordu.
   */
  it('hiç paket gelmediyse maçın başından beri sessiz sayılır', () => {
    const g = misafirKur();
    expect(g.agSessizlik()).toBe(0);

    // 2 saniye ilerlet — misafir simüle etmez ama zaman akar
    akit(g, 2);
    expect(g.agSessizlik()).toBeGreaterThan(1.5);
  });

  it('paket geldiyse ölçü son paketten alınır', () => {
    const g = misafirKur();
    const sunucu = sunucuKur();

    akit(g, 2); // önce uzun bir sessizlik
    expect(g.agSessizlik()).toBeGreaterThan(1.5);

    // Paket gelince sayaç sıfırlanmalı
    expect(g.agPaketAl(paketle(sunucu))).toBe(true);
    expect(g.agSessizlik()).toBe(0);

    akit(g, 0.5);
    expect(g.agSessizlik()).toBeGreaterThan(0.4);
    expect(g.agSessizlik()).toBeLessThan(0.6);
  });

  it('ev sahibi için sessizlik ölçülmez — akışı o üretiyor', () => {
    const g = sunucuKur();
    akit(g, 3);
    expect(g.agSessizlik()).toBe(0);
  });
});

describe('akış başladı mı', () => {
  /*
   * Sessizliğin iki sebebi ayrı ayrı gösterilmeli: hiç başlamayan akış
   * beklemekle düzelmiyor, kesilen akış çoğu zaman geri geliyor. Ekran
   * ikisine de "rakip bekleniyor" deseydi oyuncu boşuna beklerdi.
   */
  it('ilk pakete kadar false, sonra true', () => {
    const g = misafirKur();
    const sunucu = sunucuKur();

    expect(g.agAkisBasladiMi()).toBe(false);
    akit(g, 2);
    expect(g.agAkisBasladiMi()).toBe(false);

    g.agPaketAl(paketle(sunucu));
    expect(g.agAkisBasladiMi()).toBe(true);
  });

  it('sürüm uyuşmazlığında akış BAŞLAMIŞ sayılmaz', () => {
    const g = misafirKur();
    const sunucu = sunucuKur();

    // Karşı taraf başka sürümdeyse paket uygulanmıyor
    const bozuk = { ...paketle(sunucu), v: 999 };
    expect(g.agPaketAl(bozuk)).toBe(false);
    expect(g.agAkisBasladiMi()).toBe(false);
    expect(g.agSurumUyusmazligi).toBe(true);
  });
});
