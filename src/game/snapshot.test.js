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

/**
 * Maç durumu — paket gelir gelmez aynen uygulanan, ara değerlenmeyen
 * alanlar. Bunlar iki tarafta BİREBİR eşit olmalı.
 */
function goruntu(oyun) {
  return {
    faz: oyun.phase,
    skor: [oyun.score.home, oyun.score.away],
    set: [oyun.sets.home, oyun.sets.away],
    setNo: oyun.setNumber,
    servis: oyun.servingSide,
    dokunus: [oyun.touch.side, oyun.touch.count],
    mesaj: oyun.message,
    oyuncular: oyun.players.map((p) => [p.pose, p.facing, p.onGround]),
    kombo: oyun.combo,
  };
}

/**
 * Konumlar — ara değerlendiği için birebir DEĞİL, yakın olmalı.
 * Misafir tanımı gereği bir paket kadar geriden geliyor.
 */
function konum(oyun) {
  return {
    top: [oyun.ball.x, oyun.ball.y],
    oyuncular: oyun.players.map((p) => [p.x, p.y]),
  };
}

/** İki konum kümesi arasındaki en büyük mesafe (piksel). */
function enBuyukSapma(a, b) {
  const uzaklik = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  return Math.max(
    uzaklik(a.top, b.top),
    ...a.oyuncular.map((p, i) => uzaklik(p, b.oyuncular[i])),
  );
}

/** Misafirin kare döngüsü — paketleri işledikten sonra çizime hazırlar. */
function misafirKare(misafir, kare = 1) {
  for (let i = 0; i < kare; i += 1) misafir.misafirGuncelle(PHYSICS.step);
}

describe('anlık görüntü', () => {
  beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = sahteCtx;
  });

  it('misafir ev sahibiyle aynı maçı görür', () => {
    const { ev, misafir } = masaKur();

    // Her adımda paket: ara değerleme tam bir adımda hedefe varır
    for (let i = 0; i < 180; i += 1) {
      ev.update(PHYSICS.step);
      const paket = paketle(ev, ev.agOlaylar);
      ev.agOlaylar = [];
      expect(misafir.agPaketAl(paket)).toBe(true);
      misafirKare(misafir);
    }

    expect(goruntu(misafir)).toEqual(goruntu(ev));
    expect(enBuyukSapma(konum(misafir), konum(ev))).toBeLessThan(1);
  });

  it('20 Hz seyrek gönderimde durum aynı, konum bir paket geriden gelir', () => {
    const { ev, misafir } = masaKur();

    // Gerçek akış her adımda değil, 3 adımda bir paket yolluyor
    for (let i = 0; i < 180; i += 1) {
      ev.update(PHYSICS.step);
      if (i % 3 === 2) {
        misafir.agPaketAl(paketle(ev, ev.agOlaylar));
        ev.agOlaylar = [];
      }
      misafirKare(misafir);
    }

    // Skor/faz/duruş gecikmez — paket gelir gelmez uygulanır
    expect(goruntu(misafir)).toEqual(goruntu(ev));

    /*
     * Konum gecikir ve gecikmeli olması DOĞRU: misafir iki paket
     * arasını yumuşatıyor, yani hedefi bir paket geriden takip ediyor.
     * Sınır, topun bir paket aralığında (50 ms) alabileceği en fazla
     * yolun biraz üstünde — asıl yakalanmak istenen "kopmuş, artık
     * takip etmiyor" hâli.
     */
    expect(enBuyukSapma(konum(misafir), konum(ev))).toBeLessThan(120);
  });

  it('paket gelmeyen karelerde de hareket sürer', () => {
    const { ev, misafir } = masaKur();

    // Rallinin ortasına gel, top hareket hâlinde olsun
    for (let i = 0; i < 200; i += 1) ev.update(PHYSICS.step);
    ev.inputs.p1.action = true;
    for (let i = 0; i < 40; i += 1) ev.update(PHYSICS.step);

    misafir.agPaketAl(paketle(ev));
    misafirKare(misafir);

    // 20 Hz'de paketler arası 3 kare var; sonraki paketi göndermiyoruz
    for (let i = 0; i < 12; i += 1) ev.update(PHYSICS.step);
    misafir.agPaketAl(paketle(ev));

    const kareBasi = konum(misafir);
    misafirKare(misafir);
    const kareSonu = konum(misafir);

    /*
     * Asıl bildirilen hata buydu: konumlar yalnızca paket gelince
     * yazılıyordu, aradaki karelerde hiçbir şey kıpırdamıyordu ve oyun
     * 20 FPS'e düşmüş gibi görünüyordu ("misafirin oyunu çok donuyor").
     */
    expect(enBuyukSapma(kareBasi, kareSonu)).toBeGreaterThan(0);
  });

  it('geç kalan paket topu geri zıplatmaz', () => {
    const { ev, misafir } = masaKur();
    for (let i = 0; i < 60; i += 1) ev.update(PHYSICS.step);
    const eski = paketle(ev);
    for (let i = 0; i < 60; i += 1) ev.update(PHYSICS.step);
    const yeni = paketle(ev);

    expect(misafir.agPaketAl(yeni)).toBe(true);
    misafirKare(misafir, 4);
    const once = { ...goruntu(misafir), ...konum(misafir) };
    // Sırası geçmiş paket sessizce atılmalı
    expect(misafir.agPaketAl(eski)).toBe(false);
    expect({ ...goruntu(misafir), ...konum(misafir) }).toEqual(once);
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

  it('zorlanan girdi gönderimi değişmemiş olsa da gider', () => {
    const { misafir, misafirPaketleri } = masaKur();

    misafir.setInput('right', true);
    misafir.agGirdiGonder();
    const ilk = misafirPaketleri.length;

    // Değişmediği için normal çağrı yollamaz
    misafir.agGirdiGonder();
    expect(misafirPaketleri.length).toBe(ilk);

    /*
     * Sekme arka plana geçince tarayıcı kare döngüsünü durduruyor;
     * basılı tuşu temizlesek bile onu yollayacak kare hiç gelmiyordu ve
     * ev sahibinde tuş sonsuza kadar basılı kalıyordu. Zorlama bunun
     * için var.
     */
    misafir.clearInput();
    misafir.agGirdiGonder(true);
    expect(misafirPaketleri.length).toBe(ilk + 1);
    expect(misafirPaketleri.at(-1).k.right).toBe(false);
  });

  it('paket gelmeyince sessizlik büyür, gelince sıfırlanır', () => {
    const { ev, misafir } = masaKur();
    ev.update(PHYSICS.step);

    // Henüz paket gelmedi — ölçülecek bir sessizlik de yok
    expect(misafir.agSessizlik()).toBe(0);

    misafir.agPaketAl(paketle(ev));
    expect(misafir.agSessizlik()).toBe(0);

    // Paketsiz 2 saniye: maç ekranı bunu "rakip bekleniyor" diye gösteriyor
    misafirKare(misafir, 120);
    expect(misafir.agSessizlik()).toBeGreaterThan(1.5);

    ev.update(PHYSICS.step);
    misafir.agPaketAl(paketle(ev));
    expect(misafir.agSessizlik()).toBe(0);
  });

  it('ev sahibinde sessizlik ölçülmez', () => {
    const { ev } = masaKur();
    // Ölçüt yalnız misafir için anlamlı; ev sahibi paket beklemiyor
    expect(ev.agSessizlik()).toBe(0);
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
