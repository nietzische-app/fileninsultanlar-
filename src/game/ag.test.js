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

describe('servis metresi ara değerlemesi', () => {
  /*
   * Metre 0.65 sn'de baştan sona gidiyor, paketler 1/20 sn arayla
   * geliyor. Doğrudan yazıldığında bar karelerin %74'ünde hiç
   * kıpırdamıyor, sonra 4,4 kat sıçrıyordu (ölçüm: olcum/akicilik.mjs).
   * Oyuncunun "güç ve yön barları kasıyor" dediği şey buydu.
   */
  const paket = (asama, metre, yon, atan = 'p1') => [asama, metre, atan, 0, 0, yon];

  it('iki paket arasında metre yürür', () => {
    const g = misafirKur();
    g.agServisYaz(paket('power', 0.2, 1), paket('power', 0.4, 1), 0.5);
    expect(g.serve.meter).toBeCloseTo(0.3, 5);
  });

  it('sekmede metre uca gidip geri döner, ters yöne KAÇMAZ', () => {
    const g = misafirKur();
    // 0.9'dan 1'e çarpıp 0.85'e dönmüş: toplam yol 0.1 + 0.15 = 0.25
    const once = paket('power', 0.9, 1);
    const sonra = paket('power', 0.85, -1);

    // Yolun ilk %20'si: hâlâ yukarı, 0.9 + 0.05 = 0.95
    g.agServisYaz(once, sonra, 0.2);
    expect(g.serve.meter).toBeCloseTo(0.95, 5);

    // Yolun %40'ı: tam uçta
    g.agServisYaz(once, sonra, 0.4);
    expect(g.serve.meter).toBeCloseTo(1, 5);

    // Yolun %80'i: geri dönüşte, 1 - (0.2 - 0.1) = 0.9
    g.agServisYaz(once, sonra, 0.8);
    expect(g.serve.meter).toBeCloseTo(0.9, 5);

    /*
     * Sekme bilinmeseydi doğrusal karışım 0.9 → 0.85 arası inerdi,
     * yani bar tam ters yöne yürürdü. Uçta nişan alan oyuncu için en
     * kötü an orası.
     */
    g.agServisYaz(once, sonra, 0.2);
    expect(g.serve.meter).toBeGreaterThan(0.9);
  });

  it('aşama değişince ara değerleme yapılmaz — metre sıfırlanmıştır', () => {
    const g = misafirKur();
    g.agServisYaz(paket('power', 0.95, 1), paket('aim', 0.5, 1), 0.5);
    expect(g.serve.stage).toBe('aim');
    expect(g.serve.meter).toBe(0.5);
  });

  it('servis atan değişince de ara değerleme yapılmaz', () => {
    const g = misafirKur();
    g.agServisYaz(paket('power', 0.9, 1, 'p1'), paket('power', 0.1, 1, 'p2'), 0.5);
    expect(g.serve.meter).toBe(0.1);
  });

  it('servis bitince gösterge kalkar', () => {
    const g = misafirKur();
    g.agServisYaz(paket('power', 0.5, 1), null, 0.5);
    expect(g.serve).toBe(null);
  });
});
