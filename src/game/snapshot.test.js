import { describe, it, expect, beforeAll } from 'vitest';
import Game from './Game.js';
import { PAKET_SURUM, paketle, uygula, girdiPaketle } from './snapshot.js';
import { PHYSICS } from './constants.js';

/**
 * Anlık görüntü testleri.
 *
 * Asıl soru şu: ev sahibi maçı koştururken misafirin ekranında AYNI
 * maç mı var? Bunu iddia etmek yetmez — iki motor kurulup birbirine
 * bağlanıyor ve alan alan karşılaştırılıyor.
 */

/** Çizim çağrılarını yutan 2B bağlam taklidi. */
function sahteCtx() {
  return new Proxy({}, {
    get: (_t, k) => {
      if (k === 'canvas') return { width: 900, height: 500 };
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient') {
        return () => ({ addColorStop() {} });
      }
      return () => {};
    },
    set: () => true,
  });
}

function sahteCanvas() {
  const ctx = sahteCtx();
  return {
    width: 900,
    height: 500,
    style: {},
    getContext: () => ctx,
    addEventListener() {},
    removeEventListener() {},
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 900, height: 500 }),
  };
}

/** Online 1v1 kurulumu: ev sahibi simüle eder, misafir çizer. */
function masaKur() {
  const ortak = {
    mode: '1v1',
    playMode: 'vs',
    difficulty: 'normal',
    homeIds: ['gizem-orge'],
    format: 'single',
    opponentId: 'atlas',
  };

  const evPaketleri = [];
  const misafirPaketleri = [];

  const ev = new Game(sahteCanvas(), {
    ...ortak,
    agRol: 'ev',
    agGonder: (p) => evPaketleri.push(p),
  });
  const misafir = new Game(sahteCanvas(), {
    ...ortak,
    agRol: 'misafir',
    agGonder: (p) => misafirPaketleri.push(p),
  });

  ev.emitState = () => {};
  misafir.emitState = () => {};
  ev.render = () => {};
  misafir.render = () => {};

  return { ev, misafir, evPaketleri, misafirPaketleri };
}

/** Karşılaştırılan alanlar — misafirin ekranında görünen her şey. */
function goruntu(oyun) {
  return {
    faz: oyun.phase,
    skor: [oyun.score.home, oyun.score.away],
    set: [oyun.sets.home, oyun.sets.away],
    setNo: oyun.setNumber,
    servis: oyun.servingSide,
    dokunus: [oyun.touch.side, oyun.touch.count],
    mesaj: oyun.message,
    top: [Math.round(oyun.ball.x), Math.round(oyun.ball.y)],
    oyuncular: oyun.players.map((p) => [
      Math.round(p.x), Math.round(p.y), p.pose, p.facing, p.onGround,
    ]),
    kombo: oyun.combo,
  };
}

describe('anlık görüntü', () => {
  beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = sahteCtx;
  });

  it('misafir ev sahibiyle aynı maçı görür', () => {
    const { ev, misafir } = masaKur();

    // Ev sahibi 3 saniyelik maç koşturur, her adımda misafire yollar
    for (let i = 0; i < 180; i += 1) {
      ev.update(PHYSICS.step);
      const paket = paketle(ev, ev.agOlaylar);
      ev.agOlaylar = [];
      expect(misafir.agPaketAl(paket)).toBe(true);
    }

    expect(goruntu(misafir)).toEqual(goruntu(ev));
  });

  it('20 Hz seyrek gönderimde de aynı duruma varır', () => {
    const { ev, misafir } = masaKur();

    // Gerçek akış her adımda değil, 3 adımda bir paket yolluyor
    for (let i = 0; i < 180; i += 1) {
      ev.update(PHYSICS.step);
      if (i % 3 === 2) {
        misafir.agPaketAl(paketle(ev, ev.agOlaylar));
        ev.agOlaylar = [];
      }
    }

    expect(goruntu(misafir)).toEqual(goruntu(ev));
  });

  it('geç kalan paket topu geri zıplatmaz', () => {
    const { ev, misafir } = masaKur();
    for (let i = 0; i < 60; i += 1) ev.update(PHYSICS.step);
    const eski = paketle(ev);
    for (let i = 0; i < 60; i += 1) ev.update(PHYSICS.step);
    const yeni = paketle(ev);

    expect(misafir.agPaketAl(yeni)).toBe(true);
    const once = goruntu(misafir);
    // Sırası geçmiş paket sessizce atılmalı
    expect(misafir.agPaketAl(eski)).toBe(false);
    expect(goruntu(misafir)).toEqual(once);
  });

  it('sürüm uyuşmazlığı uygulanmaz', () => {
    const { ev, misafir } = masaKur();
    ev.update(PHYSICS.step);
    const paket = { ...paketle(ev), v: PAKET_SURUM + 1 };
    expect(uygula(misafir, paket)).toBe(false);
  });

  it('efekt olayları misafirde parçacığa dönüşür', () => {
    const { ev, misafir } = masaKur();
    ev.spawnBurst(400, 200, 8, '#FFFFFF');
    ev.spawnRing(400, 200, '#FFFFFF', 40);
    expect(ev.agOlaylar).toHaveLength(2);

    const oncekiParcacik = misafir.particles.length;
    misafir.agPaketAl(paketle(ev, ev.agOlaylar));

    expect(misafir.particles.length).toBeGreaterThan(oncekiParcacik);
    expect(misafir.rings.length).toBe(1);
  });

  it('çevrimdışı oyunda olay biriktirilmez', () => {
    const oyun = new Game(sahteCanvas(), {
      mode: '1v1', difficulty: 'normal', homeIds: ['gizem-orge'],
      format: 'single', opponentId: 'atlas',
    });
    oyun.spawnBurst(10, 10, 4, '#fff');
    // Kuyruk yalnız ev sahibinde dolmalı; yoksa tek kişilik oyun
    // boşuna bellek biriktirir
    expect(oyun.agOlaylar).toHaveLength(0);
  });

  it('misafirin tuşları ev sahibinde 2. yuvaya düşer', () => {
    const { ev } = masaKur();
    ev.agPaketAl(girdiPaketle({ right: true, action: true }, 1));

    expect(ev.inputs.p2.right).toBe(true);
    expect(ev.inputs.p2.action).toBe(true);
    expect(ev.inputs.p1.right).toBe(false);
    expect(ev.actionPresses.p2).toBe(1);
  });

  it('eksik alan bırakılmış sayılır', () => {
    const { ev } = masaKur();
    ev.agPaketAl(girdiPaketle({ right: true }, 1));
    ev.agPaketAl(girdiPaketle({ left: true }, 1));

    expect(ev.inputs.p2.left).toBe(true);
    expect(ev.inputs.p2.right).toBe(false);
  });

  it('rol karışmaz: ev sahibi durum paketini yok sayar', () => {
    const { ev, misafir } = masaKur();
    misafir.update(PHYSICS.step);
    expect(ev.agPaketAl(paketle(misafir))).toBe(false);
    expect(misafir.agPaketAl(girdiPaketle({ up: true }, 1))).toBe(false);
  });

  it('misafir yerelde simüle etmez', () => {
    const { misafir } = masaKur();
    const once = { x: misafir.ball.x, y: misafir.ball.y, adim: misafir.adim };

    // Misafirin kendi döngüsü — süslemeler akmalı, fizik akmamalı
    for (let i = 0; i < 60; i += 1) misafir.misafirGuncelle(PHYSICS.step);

    expect(misafir.ball.x).toBe(once.x);
    expect(misafir.ball.y).toBe(once.y);
    expect(misafir.adim).toBe(once.adim);
    expect(misafir.time).toBeGreaterThan(0);
  });

  it('paket makul boyutta kalır', () => {
    const { ev } = masaKur();
    for (let i = 0; i < 120; i += 1) ev.update(PHYSICS.step);
    const bayt = JSON.stringify(paketle(ev, ev.agOlaylar)).length;

    /*
     * 20 Hz × iki yön ile saniyede ~12 KB eder. Mobil veriyle
     * oynanabilir olmalı; bu sınır aşılırsa paketi küçültmek gerekir,
     * sessizce büyümesin.
     */
    expect(bayt).toBeLessThan(600);
  });
});
