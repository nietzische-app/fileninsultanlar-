import { describe, it, expect, beforeAll } from 'vitest';
import Game from './Game.js';
import { paketle, uygula, girdiPaketle, oyuncuFizikUygula } from './snapshot.js';
import { PHYSICS, PHASE, PLAYER } from './constants.js';

/**
 * GECİKME TELAFİSİ testleri — istemci tarafı tahmin ve uzlaştırma.
 *
 * Sunucu hakem mimaride istemci hiç simüle etmiyordu: tuşa basmakla
 * oyuncunun kıpırdaması arasında tam bir gidiş-dönüş vardı. Tahmin
 * katmanı bu boşluğu istemcide dolduruyor, sunucunun cevabı gelince
 * de kendi tahminini düzeltiyor.
 *
 * Buradaki testlerin çoğu ÇİFT: bir kere tahmin açık, bir kere kapalı.
 * Tek yönlü test "çalışıyor" der ama iddianın tahminden geldiğini
 * göstermez — kapalıyken de geçen bir test hiçbir şey ölçmüyordur.
 */

function sahteCtx() {
  return new Proxy(
    {},
    {
      get: (_t, k) => {
        if (k === 'canvas') return { width: 900, height: 500 };
        if (k === 'measureText') return () => ({ width: 10 });
        if (k === 'createLinearGradient' || k === 'createRadialGradient') {
          return () => ({ addColorStop() {} });
        }
        return () => {};
      },
      set: () => true,
    },
  );
}

const ORTAK = {
  mode: '1v1',
  playMode: 'vs',
  difficulty: 'normal',
  homeIds: ['gizem-orge'],
  format: 'single',
  opponentId: 'atlas',
};

/** Sunucu (hakem) motoru. */
function sunucuKur(yolla = () => {}) {
  const oyun = new Game(null, {
    ...ORTAK,
    bassiz: true,
    agRol: 'ev',
    agGonder: yolla,
  });
  oyun.emitState = () => {};
  return oyun;
}

/** İstemci motoru — tahmin varsayılan olarak açık. */
function istemciKur(secenek = {}) {
  const oyun = new Game(null, {
    ...ORTAK,
    bassiz: true,
    agRol: 'misafir',
    agYuvam: 'p1',
    agGonder: () => {},
    ...secenek,
  });
  oyun.emitState = () => {};
  return oyun;
}

/**
 * Sahayı ralliye sabitler.
 *
 * Oyuncu girdisi yalnız ralli aşamasında işleniyor — servis
 * aşamasında motor `updatePlayers`'ı hiç çağırmıyor. Bunu ayarlamadan
 * yazılan bir girdi testi hep "hareket yok" der ve insan girdi
 * zincirinde olmayan bir hata arar; bu depoda bir kez yaşandı.
 */
function ralliye(oyun) {
  oyun.phase = PHASE.RALLY;
  oyun.phaseTimer = 99;
}

function benim(oyun) {
  return oyun.players.find((p) => p.controlSlot === 'p1');
}

describe('girdi paketi', () => {
  it('istemcinin saat damgasını taşır', () => {
    const paket = girdiPaketle({ right: true }, 3, 1.25);
    expect(paket.z).toBe(1.25);
    expect(paket.k.right).toBe(true);
  });

  it('damga değişmemiş girdide de tazelenir', () => {
    const yollananlar = [];
    const istemci = istemciKur();
    istemci.agGonder = (p) => yollananlar.push(p);
    ralliye(istemci);

    istemci.inputs.p1.right = true;
    // 1 saniye boyunca TEK bir tuş değişikliği var
    for (let i = 0; i < 60; i += 1) {
      istemci.misafirGuncelle(PHYSICS.step);
      istemci.agAkis();
    }

    /*
     * Tahmin penceresi "kendi saatim eksi geri dönen damgam" ile
     * ölçülüyor; damga tazelenmezse pencere durmadan büyür. Bu yüzden
     * girdi değişmese de saniyede ~20 kez gidiyor.
     */
    // Aralık dar değil: ilk paket tuş DEĞİŞİMİYLE gidiyor, sonraki
    // 20 Hz damgalar ona göre fazlanıyor. Ölçtüğümüz "saniyede bir
    // avuç", "hiç" ile "her adımda" arasındaki fark.
    expect(yollananlar.length).toBeGreaterThanOrEqual(18);
    expect(yollananlar.length).toBeLessThanOrEqual(24);
    const damgalar = yollananlar.map((p) => p.z);
    expect(damgalar[damgalar.length - 1]).toBeGreaterThan(damgalar[0]);
  });
});

describe('sunucu onayı', () => {
  it('anlık görüntü istemcinin damgasını ve bekleme süresini geri yollar', () => {
    const sunucu = sunucuKur();
    ralliye(sunucu);

    sunucu.agPaketAl(girdiPaketle({ right: true }, 0, 4.5), 'p1');
    sunucu.update(PHYSICS.step);
    // Damga geldikten sonra sunucu biraz daha koştu
    for (let i = 0; i < 6; i += 1) sunucu.update(PHYSICS.step);

    const paket = paketle(sunucu, []);
    expect(paket.az[0]).toBe(4.5);
    // 6 adım ≈ 0.1 sn beklemiş
    expect(paket.ay[0]).toBeGreaterThan(0.09);
    expect(paket.ay[0]).toBeLessThan(0.12);
  });

  it('onay ALINDIĞINDA değil İŞLENDİĞİNDE ilerler', () => {
    const sunucu = sunucuKur();
    ralliye(sunucu);

    sunucu.agPaketAl(girdiPaketle({ right: true }, 0, 2.0), 'p1');
    /*
     * Henüz adım atılmadı: girdi alındı ama simülasyona katılmadı.
     * Burada onaylasaydık istemci onu işlenmiş sayıp bir adım fazla
     * ileri tahmin ederdi.
     */
    expect(paketle(sunucu, []).az[0]).toBe(null);

    sunucu.update(PHYSICS.step);
    expect(paketle(sunucu, []).az[0]).toBe(2.0);
  });
});

describe('istemci tahmini', () => {
  it('tuşa basılan adımda oyuncu kıpırdar — paket beklemeden', () => {
    const istemci = istemciKur();
    ralliye(istemci);
    const oyuncu = benim(istemci);
    const once = oyuncu.x;

    istemci.inputs.p1.right = true;
    istemci.misafirGuncelle(PHYSICS.step);

    expect(oyuncu.x).toBeGreaterThan(once);
  });

  it('tahmin kapalıyken paket gelmeden kıpırdamaz', () => {
    // Aynı senaryonun ölçüm aracı doğrulaması: üstteki test tahminin
    // varlığını ölçüyor mu, yoksa her hâlükârda mı geçiyor?
    const istemci = istemciKur({ agTahmin: false });
    ralliye(istemci);
    const oyuncu = benim(istemci);
    const once = oyuncu.x;

    istemci.inputs.p1.right = true;
    for (let i = 0; i < 10; i += 1) istemci.misafirGuncelle(PHYSICS.step);

    expect(oyuncu.x).toBe(once);
  });

  it('yalnız KENDİ oyuncusunu tahmin eder, rakibi değil', () => {
    const istemci = istemciKur();
    ralliye(istemci);
    const rakip = istemci.players.find((p) => p.controlSlot !== 'p1');
    const once = rakip.x;

    istemci.inputs.p1.right = true;
    for (let i = 0; i < 10; i += 1) istemci.misafirGuncelle(PHYSICS.step);

    // Rakip yalnızca sunucudan gelen paketle hareket eder
    expect(rakip.x).toBe(once);
  });

  it('kare arasına sıkışan basış tahminde de vuruş başlatır', () => {
    const istemci = istemciKur();
    ralliye(istemci);
    const oyuncu = benim(istemci);

    /*
     * Bas–bırak aynı karede: tuş durumu hiç "basılı" görünmüyor,
     * yalnız sayaç artıyor. Sunucu bunu vuruş sayıyor; tahmin de
     * saymalı, yoksa oyuncu kendi ekranında vurmadığını görürdü.
     */
    istemci.actionPresses.p1 += 1;
    istemci.misafirGuncelle(PHYSICS.step);

    expect(oyuncu.swingTimer).toBeGreaterThan(0);
  });

  it('servis aşamasında tahmin oyuncuyu yürütmez', () => {
    // Sunucu servis sırasında `updatePlayers(dt, false)` çağırıyor:
    // girdi işlenmiyor. Tahmin de aynısını yapmalı, yoksa istemci
    // sunucunun yapmadığı bir hareketi çizerdi.
    const istemci = istemciKur();
    istemci.phase = PHASE.SERVE;
    const oyuncu = benim(istemci);
    const once = oyuncu.x;

    istemci.inputs.p1.right = true;
    for (let i = 0; i < 10; i += 1) istemci.misafirGuncelle(PHYSICS.step);

    expect(oyuncu.x).toBe(once);
  });
});

describe('uzlaştırma', () => {
  it('paketin fizik alanları geri kurulur', () => {
    const oyuncu = {
      x: 0, y: 0, vy: 0, facing: 1, pose: 'idle', runFrame: 0, squash: 0,
      onGround: true, diveTimer: 0, recoverTimer: 0, vx: 0, swingTimer: 0,
      diveCooldown: 0, actionWasDown: false,
    };
    oyuncuFizikUygula(oyuncu, [
      120, 300, -50, -1, 'spike', 0.4, 0.1, 0, 0.2, 0.3, 210, 0.25, 0.5, 1,
    ]);

    expect(oyuncu.x).toBe(120);
    expect(oyuncu.vx).toBe(210);
    expect(oyuncu.swingTimer).toBe(0.25);
    expect(oyuncu.diveCooldown).toBe(0.5);
    expect(oyuncu.actionWasDown).toBe(true);
    expect(oyuncu.onGround).toBe(false);
  });

  it('sunucunun konumundan başlayıp bekleyen adımları yeniden oynar', () => {
    const sunucu = sunucuKur();
    const istemci = istemciKur();
    ralliye(sunucu);
    ralliye(istemci);

    // İstemcinin saati 1.0 sn; sunucu 0.5 sn önceki girdiyi işlemiş ve
    // damga sunucuda 0.1 sn beklemiş → pencere = 1.0 - 0.5 - 0.1 = 0.4
    istemci.time = 1.0;
    istemci.agGirdiGecmisi = [{ an: 0, tuslar: { right: true } }];
    istemci.inputs.p1.right = true;

    const paket = paketle(sunucu, []);
    paket.n = 5;
    const sira = sunucu.players.findIndex((p) => p.controlSlot === 'p1');
    const sunucuX = paket.p[sira][0];
    paket.az = [0.5, null];
    paket.ay = [0.1, 0];

    uygula(istemci, paket);

    const adet = Math.round(0.4 / PHYSICS.step);
    const beklenen = sunucuX + adet * PHYSICS.playerSpeed * PHYSICS.step;
    // Yön çarpanı ve saha sınırı payı — tam eşitlik değil, aynı mertebe
    expect(benim(istemci).x).toBeGreaterThan(sunucuX + 10);
    expect(benim(istemci).x).toBeLessThanOrEqual(beklenen * 1.3);
  });

  it('bekleme süresi düşülmezse fazla ileri sarardı', () => {
    /*
     * Ölçüm aracı doğrulaması: `ay` alanının işe yaradığını, onsuz
     * sonucun FARKLI çıktığını göstermek. İlk sürümde bu alan yoktu
     * ve istemci her pakette üç adım fazla ileri gidip geri
     * sıçrıyordu.
     */
    const sunucu = sunucuKur();
    ralliye(sunucu);
    const temelPaket = paketle(sunucu, []);
    temelPaket.az = [0.5, null];

    const kur = () => {
      const istemci = istemciKur();
      ralliye(istemci);
      istemci.time = 1.0;
      istemci.agGirdiGecmisi = [{ an: 0, tuslar: { right: true } }];
      istemci.inputs.p1.right = true;
      return istemci;
    };

    const ileBekleme = kur();
    uygula(ileBekleme, { ...temelPaket, n: 5, ay: [0.2, 0] });

    const beklemesiz = kur();
    uygula(beklemesiz, { ...temelPaket, n: 5, ay: [0, 0] });

    expect(beklemesiz.players.find((p) => p.controlSlot === 'p1').x).toBeGreaterThan(
      ileBekleme.players.find((p) => p.controlSlot === 'p1').x + 10,
    );
  });

  it('geri sarım penceresi sınırlıdır', () => {
    // Bağlantı kopunca son onay eskir; sınır olmasa istemci her
    // pakette yüzlerce adım koşturup kare süresini patlatırdı.
    const sunucu = sunucuKur();
    ralliye(sunucu);
    const paket = paketle(sunucu, []);
    paket.n = 5;
    paket.az = [0, null];
    paket.ay = [0, 0];

    const istemci = istemciKur();
    ralliye(istemci);
    istemci.time = 30; // 30 saniyelik boşluk
    istemci.agGirdiGecmisi = [{ an: 0, tuslar: { right: true } }];

    const t0 = Date.now();
    uygula(istemci, paket);
    // 30 sn'lik geri sarım 1800 adım olurdu; sınır 0.5 sn = 30 adım
    expect(Date.now() - t0).toBeLessThan(200);
    const sira = sunucu.players.findIndex((p) => p.controlSlot === 'p1');
    const azami = paket.p[sira][0] + 0.5 * PHYSICS.playerSpeed * 1.5;
    expect(benim(istemci).x).toBeLessThanOrEqual(azami);
  });

  it('tahmin edilen oyuncu ara değerlemeye alınmaz', () => {
    const sunucu = sunucuKur();
    ralliye(sunucu);
    const paket = paketle(sunucu, []);
    paket.n = 5;
    paket.az = [null, null];
    paket.ay = [0, 0];

    const istemci = istemciKur();
    ralliye(istemci);
    uygula(istemci, paket);

    const sira = istemci.players.findIndex((p) => p.controlSlot === 'p1');
    /*
     * Kendi oyuncusu hedef listesinden çıkarılmalı: ara değerleme onu
     * her karede sunucunun ESKİ konumuna geri çekseydi tahmin
     * anlamsızlaşır, tuş yine geç cevap verirdi.
     */
    expect(istemci.agAra.hedefOyuncu[sira]).toBe(null);
    expect(istemci.agAra.hedefOyuncu.filter(Boolean).length).toBe(
      istemci.players.length - 1,
    );
  });

  it('tahmin kapalıyken herkes ara değerlemede kalır', () => {
    const sunucu = sunucuKur();
    ralliye(sunucu);
    const paket = paketle(sunucu, []);
    paket.n = 5;

    const istemci = istemciKur({ agTahmin: false });
    uygula(istemci, paket);

    expect(istemci.agAra.hedefOyuncu.filter(Boolean).length).toBe(
      istemci.players.length,
    );
  });
});

describe('düzeltmenin yedirilmesi', () => {
  it('küçük düzeltme ekrana yedirilir, ışınlanma olmaz', () => {
    const istemci = istemciKur();
    ralliye(istemci);
    const oyuncu = benim(istemci);

    // 20 px'lik bir yanlış tahmin
    istemci.agSapmaAl(oyuncu, oyuncu.x + 20, oyuncu.y);
    expect(istemci.agCizimKaydirma(oyuncu).x).toBeCloseTo(20, 5);

    // Birkaç kare içinde erir
    for (let i = 0; i < 30; i += 1) istemci.misafirGuncelle(PHYSICS.step);
    expect(istemci.agCizimKaydirma(oyuncu)).toBe(null);
  });

  it('büyük düzeltme yedirilmez, anında uygulanır', () => {
    /*
     * Sayı arası ya da paket kaybı sonrası tahmin gerçekten uzağa
     * düşebiliyor. Böyle bir farkı yumuşatmak oyuncuyu saniyelerce
     * yanlış yerde gösterirdi.
     */
    const istemci = istemciKur();
    const oyuncu = benim(istemci);

    istemci.agSapmaAl(oyuncu, oyuncu.x + 400, oyuncu.y);
    expect(istemci.agCizimKaydirma(oyuncu)).toBe(null);
  });

  it('kaydırma yalnız kendi oyuncusuna uygulanır', () => {
    const istemci = istemciKur();
    const oyuncu = benim(istemci);
    const rakip = istemci.players.find((p) => p.controlSlot !== 'p1');

    istemci.agSapmaAl(oyuncu, oyuncu.x + 20, oyuncu.y);
    expect(istemci.agCizimKaydirma(rakip)).toBe(null);
  });
});

describe('tahmin ile sunucu ayrışmaz', () => {
  it('aynı girdi dizisi iki tarafta aynı konumu verir', () => {
    /*
     * Asıl korku bu: tahmin hareket kodunu KOPYALASAYDI iki kopya
     * zamanla ayrışırdı — bu depoda `reach.js`'te tam olarak bu
     * yaşanmış, iki kopya %79'a kadar ayrışmıştı. Tahmin de sunucu da
     * `insanOyuncuAdimla`yı çağırıyor; bu test o tekliği koruyor.
     */
    const sunucu = sunucuKur();
    const istemci = istemciKur();
    ralliye(sunucu);
    ralliye(istemci);

    const tuslar = [
      { right: true }, { right: true }, { right: true },
      { up: true, right: true }, { up: true },
      {}, {}, { left: true }, { left: true }, { action: true },
    ];

    tuslar.forEach((t) => {
      // Sunucu: yuvaya yaz, adımla
      Object.keys(sunucu.inputs.p1).forEach((ad) => {
        sunucu.inputs.p1[ad] = Boolean(t[ad]);
      });
      sunucu.update(PHYSICS.step);

      // İstemci: aynı tuşlar, kendi tahmin yolundan
      Object.keys(istemci.inputs.p1).forEach((ad) => {
        istemci.inputs.p1[ad] = Boolean(t[ad]);
      });
      istemci.misafirGuncelle(PHYSICS.step);
    });

    const a = benim(sunucu);
    const b = benim(istemci);
    expect(b.x).toBeCloseTo(a.x, 6);
    expect(b.y).toBeCloseTo(a.y, 6);
    expect(b.vy).toBeCloseTo(a.vy, 6);
    expect(b.swingTimer).toBeCloseTo(a.swingTimer, 6);
    expect(b.pose).toBe(a.pose);
  });

  it('salınım süresi iki tarafta da aynı sınırda biter', () => {
    const istemci = istemciKur();
    ralliye(istemci);
    const oyuncu = benim(istemci);

    istemci.inputs.p1.action = true;
    istemci.misafirGuncelle(PHYSICS.step);
    expect(oyuncu.swingTimer).toBeCloseTo(PLAYER.swingDuration - PHYSICS.step, 5);

    // Basılı tutmak salınımı UZATMAZ — yerel oyundaki kuralın aynısı
    const adet = Math.ceil(PLAYER.swingDuration / PHYSICS.step) + 5;
    for (let i = 0; i < adet; i += 1) istemci.misafirGuncelle(PHYSICS.step);
    expect(oyuncu.swingTimer).toBe(0);
  });
});

beforeAll(() => {
  if (typeof HTMLCanvasElement !== 'undefined') {
    HTMLCanvasElement.prototype.getContext = sahteCtx;
  }
});
