import { describe, expect, it } from 'vitest';
import {
  arrivalHeight,
  interceptPoint,
  netCrossing,
  predictLanding,
  shouldYield,
} from './ai.js';
import {
  contactCenterY,
  contactDistance,
  contactRadius,
  mayTouch,
  speedPenalty,
} from './reach.js';
import { GROUND_Y, NET, PHYSICS, PLAYER } from './constants.js';

/**
 * Bu testler üç somut hatayı bekçiliyor. Üçü de ölçümle bulundu ve üçü
 * de "rakip çok salak oynuyor, bütün servisler sayı oluyor"un sebebiydi.
 */

const ball = (over = {}) => ({
  x: 500,
  y: 200,
  vx: 300,
  vy: 100,
  radius: PHYSICS.ballRadius,
  serveUntouched: false,
  ...over,
});

const player = (over = {}) => ({
  x: 700,
  y: GROUND_Y,
  hitRadius: PLAYER.hitRadius,
  hitOffsetY: PLAYER.hitOffsetY,
  side: 'away',
  onGround: true,
  diveTimer: 0,
  recoverTimer: 0,
  aiSpeedScale: 1,
  input: { action: false },
  ...over,
});

describe('temas alanı (reach.js)', () => {
  it('yavaş topta ceza yok', () => {
    expect(speedPenalty(PHYSICS.cleanTouchSpeed - 100)).toBe(1);
  });

  it('hızlandıkça daralır ve alt sınırda durur', () => {
    expect(speedPenalty(800)).toBeLessThan(1);
    expect(speedPenalty(100000)).toBe(PLAYER.minReachFactor);
  });

  it('vuruş tuşu erişimi artırır', () => {
    const base = { hitRadius: PLAYER.hitRadius, ballSpeed: 600 };
    expect(contactRadius({ ...base, acting: true })).toBeGreaterThan(
      contactRadius({ ...base, acting: false })
    );
  });

  /*
   * Asıl hata buydu: yapay zekâ sabit `hitRadius + ballRadius + 26` = 79px
   * kullanıyordu, motor ise hız cezalı ~54px. Rakip menzilde sanıp boşa
   * vuruyordu. Eşik artık tek kaynaktan geliyor — servis hızındaki top
   * için eski sabitin belirgin altında olmalı.
   */
  it('servis hızındaki topta eşik eski sabitin altında kalır', () => {
    const fast = ball({ vx: 800, vy: 300 });
    const eskiSabit = PLAYER.hitRadius + fast.radius + 26;
    const gercek = contactDistance(player(), fast, { acting: true });
    expect(gercek).toBeLessThan(eskiSabit);
  });
});

describe('karşılama noktası', () => {
  /*
   * `predictLanding` topun ZEMİNE değeceği x'i verir; temas merkezi ise
   * yerden 44px yukarıda. Top o yüksekliği daha erken/daha geride geçer.
   * Rakip zemin noktasında beklediği için top hep bir adım ötesinden
   * geçiyordu — sistematik kayma, rastgele sapma değil.
   */
  it('zemin noktasından geriye düşer (sağa giden topta)', () => {
    const b = ball({ x: 500, y: 150, vx: 400, vy: 50 });
    const p = player();
    const zemin = predictLanding(b).x;
    const karsilama = interceptPoint(p, b).x;
    expect(karsilama).toBeLessThan(zemin);
  });

  it('kayma yok sayılamayacak kadar büyük', () => {
    const b = ball({ x: 500, y: 150, vx: 400, vy: 50 });
    const p = player();
    const kayma = predictLanding(b).x - interceptPoint(p, b).x;
    expect(kayma).toBeGreaterThan(15);
  });

  it('top zaten dibe indiyse zemine bakar', () => {
    const alcak = ball({ y: GROUND_Y - 10 });
    const p = player();
    expect(interceptPoint(p, alcak).x).toBeCloseTo(predictLanding(alcak).x, 5);
  });
});

describe('sıçrama kararı — varış yüksekliği', () => {
  it('oyuncunun hizasına gelen topun yüksekliğini verir', () => {
    const b = ball({ x: 500, y: 200, vx: 400, vy: 0 });
    const p = player({ x: 700 });
    const y = arrivalHeight(p, b);
    expect(y).not.toBeNull();
    // 200px yol, 400px/sn → ~0.5sn düşüş; yerçekimiyle alçalmış olmalı
    expect(y).toBeGreaterThan(200);
    expect(y).toBeLessThan(GROUND_Y);
  });

  it('uzaklaşan topta null döner', () => {
    // Oyuncudan uzağa gidiyor ve duvara varmadan yere düşüyor
    const b = ball({ x: 300, y: 380, vx: -400, vy: 300 });
    const p = player({ x: 800 });
    expect(arrivalHeight(p, b)).toBeNull();
  });

  it('duvardan sekip geri gelen topu ıskalamaz', () => {
    // İlk karede uzaklaşıyor ama sağ duvardan dönüp yaklaşıyor
    const b = ball({ x: 800, y: 200, vx: 600, vy: -200 });
    const p = player({ x: 200 });
    expect(arrivalHeight(p, b)).not.toBeNull();
  });

  /*
   * Servis, ayakta karşılanacak bantta gelir. Sıçramak temas merkezini
   * yükseltip topun altından geçmesine yol açıyordu: as olan servislerin
   * %60–95'inde rakip havadaydı.
   */
  it('servis ayakta erişilebilecek bantta varır (sıçramak kazandırmaz)', () => {
    const servis = ball({ x: 470, y: 250, vx: 520, vy: 120, serveUntouched: true });
    const p = player({ x: 760 });
    const y = arrivalHeight(p, servis);
    const ayaktaTavan =
      p.y - p.hitOffsetY - contactDistance(p, servis, { acting: true });
    expect(y).not.toBeNull();
    expect(y).toBeGreaterThan(ayaktaTavan);
  });
});

describe('2v2 — takım arkadaşına yol verme', () => {
  it('görevli yetişiyorsa yol verilir', () => {
    const b = ball({ x: 500, y: 200, vx: 100, vy: 50 });
    const gorevli = player({ x: predictLanding(b).x });
    const partner = player({ x: 200 });
    expect(shouldYield(partner, b, gorevli)).toBe(true);
  });

  it('görevli çok uzaktaysa yol verilmez — top yere bırakılmaz', () => {
    const b = ball({ x: 500, y: 415, vx: 600, vy: 600 });
    const gorevli = player({ x: 60, aiSpeedScale: 0.2 });
    const partner = player({ x: 500 });
    expect(shouldYield(partner, b, gorevli)).toBe(false);
  });

  it('görevli yoksa (1v1) yol verilmez', () => {
    expect(shouldYield(player(), ball(), null)).toBe(false);
  });

  it('oyuncunun kendisine yol vermez', () => {
    const p = player();
    expect(shouldYield(p, ball(), p)).toBe(false);
  });
});

describe('file kuralı — arkadan vuruş yok', () => {
  const homeAtNet = player({ side: 'home', x: 422 }); // kendi sahasının file kenarı
  const awayAtNet = player({ side: 'away', x: 478 });

  it('kendi sahasındaki topa dokunabilir', () => {
    expect(mayTouch(homeAtNet, ball({ x: 400, y: GROUND_Y - 60 }))).toBe(true);
    expect(mayTouch(awayAtNet, ball({ x: 500, y: GROUND_Y - 60 }))).toBe(true);
  });

  /*
   * Asıl hata: oyuncu en fazla x=422'ye gelebiliyor, file merkezi 450,
   * temas yarıçapı vuruş tuşuyla ~65px. Yani rakip sahaya ~37px uzanıp
   * topa vurulabiliyordu.
   */
  it('rakip sahadaki alçak topa dokunamaz', () => {
    expect(mayTouch(homeAtNet, ball({ x: 480, y: GROUND_Y - 60 }))).toBe(false);
    expect(mayTouch(awayAtNet, ball({ x: 420, y: GROUND_Y - 60 }))).toBe(false);
  });

  it('file üstünde blok serbest kalır', () => {
    const yuksek = ball({ x: 480, y: NET.topY - PHYSICS.ballRadius - 5 });
    expect(mayTouch(homeAtNet, yuksek)).toBe(true);
  });

  it('file üstü istisnası topun TAMAMI yukarıdayken geçerli', () => {
    // Topun altı file hizasının altındaysa blok sayılmaz
    const yarim = ball({ x: 480, y: NET.topY + 2 });
    expect(mayTouch(homeAtNet, yarim)).toBe(false);
  });
});

describe('hücumda temas merkezi', () => {
  const yerde = player({ onGround: true, input: { action: true } });
  const havada = player({ onGround: false, input: { action: true } });

  it('yerde göğüs hizasında', () => {
    expect(contactCenterY(yerde)).toBe(yerde.y - PLAYER.hitOffsetY);
  });

  /*
   * Havada + vuruş tuşu = smaç. Merkez yükselmezse top kafanın üstünden
   * geçerken vurulamıyor; ölçümde temasların %13'ünde top gövdeye
   * biniyordu.
   */
  it('havada vuruşta yükselir', () => {
    expect(contactCenterY(havada)).toBe(havada.y - PLAYER.attackOffsetY);
    expect(contactCenterY(havada)).toBeLessThan(contactCenterY(yerde));
  });

  it('havada ama tuşa basmıyorsa yükselmez', () => {
    const bos = player({ onGround: false, input: { action: false } });
    expect(contactCenterY(bos)).toBe(bos.y - PLAYER.hitOffsetY);
  });

  it('dalışta gövde alçalır', () => {
    const dalan = player({ diveTimer: 0.2 });
    expect(contactCenterY(dalan)).toBeGreaterThan(contactCenterY(yerde));
  });

  it('hücum payı yerdeki savunmayı büyütmez', () => {
    // Yarıçap değil MERKEZ değişti: yerdeki erişim aynı kalmalı
    const b = ball({ vx: 400, vy: 100 });
    expect(contactDistance(yerde, b)).toBe(contactDistance(havada, b));
  });
});

describe('blok — file geçişi', () => {
  /*
   * Blok kararı topun DÜŞECEĞİ yere değil, FİLEYİ GEÇECEĞİ ana bakar:
   * blok top daha karşı sahadayken verilir. Eski kod yalnızca kendi
   * sahasındaki topa bakıyordu, dolayısıyla blok hiç olmuyordu —
   * ölçümde partner rallinin %62'sini file dibinde geçirip 100 karede
   * 0.46 kez sıçrıyordu.
   */
  it('karşı sahadan gelen topun geçiş anını ve yüksekliğini verir', () => {
    const b = ball({ x: NET.x + 120, y: NET.topY - 40, vx: -400, vy: 60 });
    const g = netCrossing(b, 'home');
    expect(g).not.toBeNull();
    expect(g.t).toBeGreaterThan(0);
    expect(g.t).toBeLessThan(0.6);
    expect(g.y).toBeGreaterThan(NET.topY - 60);
  });

  it('top zaten bizim taraftaysa null (blok konusu değil)', () => {
    const b = ball({ x: NET.x - 100, y: 200, vx: -300, vy: 0 });
    expect(netCrossing(b, 'home')).toBeNull();
  });

  it('fileye varmadan yere düşen topta null', () => {
    const b = ball({ x: NET.x + 300, y: GROUND_Y - 20, vx: -80, vy: 400 });
    expect(netCrossing(b, 'home')).toBeNull();
  });

  it('uzaklaşan topta null', () => {
    const b = ball({ x: NET.x + 100, y: 200, vx: 400, vy: -50 });
    expect(netCrossing(b, 'home')).toBeNull();
  });

  it('iki taraf simetrik çalışır', () => {
    const bize = ball({ x: NET.x - 120, y: NET.topY - 40, vx: 400, vy: 60 });
    expect(netCrossing(bize, 'away')).not.toBeNull();
    expect(netCrossing(bize, 'home')).toBeNull();
  });
});
