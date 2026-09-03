/**
 * Anlık görüntü — maçın tel üzerinden geçen hâli.
 *
 * Online mimarisi ev sahibi yetkili (host-authoritative): maçı yalnızca
 * odayı açan taraf simüle eder, misafir onun ürettiği durumu çizer.
 * Bu dosya o durumun paketlenmesi ve geri kurulmasıdır.
 *
 * Neden lockstep değil: iki makinenin aynı girdiden aynı sonucu üretmesi
 * gerekirdi, simülasyon yolunda 30'dan fazla `Math.random()` çağrısı var
 * ve hepsini tohumlu üretece çevirmek ayrı bir proje. Ev sahibi yetkili
 * mimaride rastgelelik tek yerde çalışıyor, öbür taraf sonucu okuyor.
 *
 * Alan adları kısa çünkü bunlar saniyede ~20 kez gidiyor. Uzun adlarla
 * paket ~3 katına çıkıyordu; okunabilirliği bu dosyadaki eşleme
 * tablosu taşıyor, tel üzerindeki baytlar değil.
 */

/**
 * Paket biçimi sürümü.
 *
 * İki taraf farklı sürüm dağıtımı çalıştırabilir (biri sayfayı
 * yenilememiştir). Uyuşmazlığı sessizce yanlış çizmektense açıkça
 * söylemek gerekiyor.
 */
export const PAKET_SURUM = 1;

/** Yön kısaltmaları — 'home'/'away' yerine tek harf. */
const YON_KISA = { home: 'h', away: 'a' };
const YON_UZUN = { h: 'home', a: 'away' };

/** Sayı yuvarlama: 0.1 piksel altı fark çizimde görünmez, bayt yer. */
function yuvarla(sayi) {
  return Math.round(sayi * 10) / 10;
}

/**
 * Oyuncunun çizim ve his için gereken alanları.
 *
 * Fizik alanları (vx, hitCooldown, AI durumu) YOK: misafir simüle
 * etmiyor. `vy` istisna — havadaki gerilme efekti onu okuyor.
 */
function oyuncuPaketle(p) {
  return [
    yuvarla(p.x),
    yuvarla(p.y),
    yuvarla(p.vy),
    p.facing,
    p.pose,
    yuvarla(p.runFrame),
    yuvarla(p.squash),
    p.onGround ? 1 : 0,
    yuvarla(p.diveTimer),
    yuvarla(p.recoverTimer),
  ];
}

function oyuncuUygula(p, d) {
  if (!d) return;
  [p.x, p.y, p.vy, p.facing, p.pose, p.runFrame, p.squash] = d;
  p.onGround = d[7] === 1;
  p.diveTimer = d[8];
  p.recoverTimer = d[9];
}

/**
 * Maçın o anki hâlini paketler.
 *
 * @param {import('./Game.js').default} oyun
 * @param {Array} [olaylar] Son pakettenberi biriken efekt/ses olayları
 */
export function paketle(oyun, olaylar = []) {
  const b = oyun.ball;
  return {
    t: 'durum',
    v: PAKET_SURUM,
    n: oyun.adim,
    // Maç durumu
    f: oyun.phase,
    ft: yuvarla(oyun.phaseTimer),
    sk: [oyun.score.home, oyun.score.away],
    st: [oyun.sets.home, oyun.sets.away],
    sn: oyun.setNumber,
    sg: oyun.setHistory,
    sv: YON_KISA[oyun.servingSide] ?? 'h',
    sr: [YON_KISA[oyun.streak.side] ?? null, oyun.streak.count],
    dk: [YON_KISA[oyun.touch.side] ?? null, oyun.touch.count],
    ms: oyun.message,
    bt: oyun.finished ? 1 : 0,
    // Görsel durum
    b: [yuvarla(b.x), yuvarla(b.y), yuvarla(b.rotation)],
    p: oyun.players.map(oyuncuPaketle),
    ko: oyun.combo,
    tv: yuvarla(oyun.perfectFlash),
    hy: yuvarla(oyun.hype),
    sa: yuvarla(oyun.shake),
    // Servis göstergesi — yalnız servis aşamasında dolu
    se: oyun.serve
      ? [oyun.serve.stage, yuvarla(oyun.serve.meter), oyun.serve.serverId,
         yuvarla(oyun.serve.power), yuvarla(oyun.serve.aim)]
      : null,
    o: olaylar,
  };
}

/**
 * Gelen paketi maça uygular.
 *
 * Eski paket sessizce atılır. WebSocket sırayı koruyor, yani bu normalde
 * olmamalı; yine de tek satırlık sigorta, çünkü olduğunda belirtisi
 * "top bir an geri zıpladı" gibi teşhisi zor bir şey olurdu.
 *
 * @returns {boolean} Uygulandıysa true
 */
export function uygula(oyun, paket) {
  if (!paket || paket.v !== PAKET_SURUM) return false;

  /*
   * Sıra denetimi `adim`e değil ayrı bir alana bakıyor. İkisini
   * birleştirmiştim ve maçın ilk paketi (n=0) düşüyordu: misafirin
   * `adim`i de 0'dan başlıyor, "0 <= 0" eski paket sayılıyordu.
   * `adim` "kaç adım atıldı", `agSonAdim` "en son hangi paket
   * uygulandı" — aynı sayı değiller.
   */
  if (typeof paket.n === 'number' && paket.n <= oyun.agSonAdim) return false;
  oyun.agSonAdim = paket.n ?? oyun.agSonAdim;

  oyun.adim = paket.n ?? oyun.adim;

  oyun.phase = paket.f;
  oyun.phaseTimer = paket.ft;
  oyun.score.home = paket.sk[0];
  oyun.score.away = paket.sk[1];
  oyun.sets.home = paket.st[0];
  oyun.sets.away = paket.st[1];
  oyun.setNumber = paket.sn;
  oyun.setHistory = paket.sg ?? [];
  oyun.servingSide = YON_UZUN[paket.sv] ?? 'home';
  oyun.streak = { side: YON_UZUN[paket.sr[0]] ?? null, count: paket.sr[1] };
  oyun.touch = { side: YON_UZUN[paket.dk[0]] ?? null, count: paket.dk[1] };
  oyun.message = paket.ms;
  oyun.finished = paket.bt === 1;

  oyun.ball.x = paket.b[0];
  oyun.ball.y = paket.b[1];
  oyun.ball.rotation = paket.b[2];

  paket.p.forEach((d, i) => oyuncuUygula(oyun.players[i], d));

  oyun.combo = paket.ko;
  oyun.perfectFlash = paket.tv;
  oyun.hype = paket.hy;
  oyun.shake = paket.sa;

  oyun.serve = paket.se
    ? {
        stage: paket.se[0],
        meter: paket.se[1],
        serverId: paket.se[2],
        power: paket.se[3],
        aim: paket.se[4],
        // Misafir tarafta kullanılmaz ama alanlar dursun ki çizim
        // kodu tanımsızla karşılaşmasın
        dir: 1,
        aiTimer: 0,
        actionLatch: false,
      }
    : null;

  return true;
}

/**
 * Girdi paketi — misafirden ev sahibine.
 *
 * Tüm tuşlar her pakette gider; eksik alan "bırakıldı" demektir. Fark
 * göndermek daha ucuz olurdu ama kaybolan tek bir "bıraktım" paketi
 * oyuncuyu sağa doğru koşturup bırakırdı. Paket zaten 60 bayt.
 */
export function girdiPaketle(tuslar, basisSayaci) {
  return {
    t: 'girdi',
    v: PAKET_SURUM,
    k: {
      left: Boolean(tuslar.left),
      right: Boolean(tuslar.right),
      up: Boolean(tuslar.up),
      down: Boolean(tuslar.down),
      action: Boolean(tuslar.action),
      dive: Boolean(tuslar.dive),
    },
    b: basisSayaci,
  };
}
