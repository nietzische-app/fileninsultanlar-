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
export const PAKET_SURUM = 2;

/** Yön kısaltmaları — 'home'/'away' yerine tek harf. */
const YON_KISA = { home: 'h', away: 'a' };
const YON_UZUN = { h: 'home', a: 'away' };

/** Sayı yuvarlama: 0.1 piksel altı fark çizimde görünmez, bayt yer. */
function yuvarla(sayi) {
  return Math.round(sayi * 10) / 10;
}

/** Süre alanları için: milisaniye çözünürlüğü. */
function yuvarla3(sayi) {
  return Math.round(sayi * 1000) / 1000;
}

/**
 * Oyuncunun çizim ve his için gereken alanları.
 *
 * 0-9 arası çizim alanları. 10'dan sonrakiler FİZİK alanları: istemci
 * kendi oyuncusunu tahmin ederken sunucunun düzeltmesini bu hâlden
 * devam ettirmek zorunda. Onlarsız uzlaştırma yarım kalırdı — konum
 * doğru, hız yanlış olurdu ve oyuncu her düzeltmede seğirirdi.
 *
 * Dört alan da her oyuncu için gidiyor, yalnız tahmin edilen için
 * değil: paket ~60 bayt büyüyor, karşılığında hangi yuvanın hangi
 * istemcide tahmin edildiğini paketleyicinin bilmesi gerekmiyor.
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
    // --- tahmin için gereken fizik ---
    yuvarla(p.vx),
    // Sayaçlar 0.1 sn çözünürlükte yuvarlanamaz: salınım 0.45 sn ve
    // adım 0.017 sn — kaba yuvarlama vuruşu bir adım uzatıp kısaltırdı.
    yuvarla3(p.swingTimer ?? 0),
    yuvarla3(p.diveCooldown ?? 0),
    p.actionWasDown ? 1 : 0,
  ];
}

/**
 * Paketteki fizik alanlarını oyuncuya yazar — tahminin başlangıç hâli.
 *
 * Yalnız uzlaştırma yolunda çağrılıyor: tahmin etmediğimiz oyuncular
 * için bu alanlar boşuna yazılırdı, onları zaten simüle etmiyoruz.
 */
export function oyuncuFizikUygula(p, d) {
  if (!p || !d || d.length < 14) return;
  p.x = d[0];
  p.y = d[1];
  p.vy = d[2];
  p.facing = d[3];
  p.pose = d[4];
  p.runFrame = d[5];
  p.squash = d[6];
  p.onGround = d[7] === 1;
  p.diveTimer = d[8];
  p.recoverTimer = d[9];
  p.vx = d[10];
  p.swingTimer = d[11];
  p.diveCooldown = d[12];
  p.actionWasDown = d[13] === 1;
  /*
   * `actionPressedAt` bilerek YOK. Tek okuyucusu tam vuruş
   * zamanlaması (`resolveCollisions`) ve o yalnız sunucuda koşuyor —
   * istemcide değeri hiçbir şeyi değiştirmiyor. Üstelik sunucunun
   * saatiyle istemcininki aynı değil; olduğu gibi yazsak yanlış bir
   * şeyi doğru sanırdık.
   */
}

/**
 * Oyuncunun ARA DEĞERLENMEYEN alanları.
 *
 * Konum (x, y, vy, runFrame, squash) burada YOK: onlar paketler arası
 * yumuşatılıyor (bkz. Game.agKonumHedefle). Buradakiler kategorik ya da
 * eşikli değerler — "yarı dönmüş yüz" ya da "yarı dalış" diye bir şey
 * yok, anında geçmeleri gerekiyor.
 */
function oyuncuAyriksiUygula(p, d) {
  if (!d) return;
  p.facing = d[3];
  p.pose = d[4];
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
    /*
     * Mesaj sayacı YUVARLANIYOR. Paketteki her sayı yuvarlanıyordu ama
     * bu alan nesne olarak olduğu gibi geçtiği için gözden kaçmıştı:
     * `timer: 1.0500000000000003` telde 19 karakter yer kaplıyordu,
     * yuvarlanmış hâli 4. Ekranda görünen fark yok — mesaj sayacı
     * yalnız solma zamanlamasını sürüyor.
     */
    ms: oyun.message
      ? { ...oyun.message, timer: yuvarla3(oyun.message.timer ?? 0) }
      : null,
    bt: oyun.finished ? 1 : 0,
    // Görsel durum
    b: [yuvarla(b.x), yuvarla(b.y), yuvarla(b.rotation)],
    p: oyun.players.map(oyuncuPaketle),
    /*
     * Girdi onayı: her yuva için, SİMÜLASYONA KATILMIŞ son girdinin
     * istemci saatindeki damgası. İstemci bunu kendi saatiyle
     * karşılaştırıp "bu görüntü ne kadar eski" sorusunu yanıtlıyor ve
     * aradaki farkı kendi tahminiyle kapatıyor.
     *
     * Damga sunucunun değil İSTEMCİNİN saati — geri yolladığımız şey
     * onun kendi gönderdiği sayı. İki saati birbirine ayarlamaya gerek
     * kalmıyor; yalnız aynı saatteki iki an çıkarılıyor.
     */
    az: [oyun.agOnayIslenen.p1?.z ?? null, oyun.agOnayIslenen.p2?.z ?? null],
    /*
     * O damganın sunucuda BEKLEDİĞİ süre (sn).
     *
     * İstemcinin gördüğü fark (kendi saati eksi geri dönen damga)
     * gidiş-dönüşe eşit değil: damga sunucuya vardıktan sonra bir
     * sonraki anlık görüntüye kadar bekliyor, üstelik girdi her adımda
     * yollanmadığı için sunucudaki en taze damga zaten biraz eski
     * olabiliyor. Bu bekleme düşülmezse istemci kendini fazla ileri
     * sürüyor. Süreyi ancak sunucu bilebilir; ölçüp yolluyor.
     */
    ay: [
      oyun.agOnayIslenen.p1 ? yuvarla3(oyun.time - oyun.agOnayIslenen.p1.geldi) : 0,
      oyun.agOnayIslenen.p2 ? yuvarla3(oyun.time - oyun.agOnayIslenen.p2.geldi) : 0,
    ],
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
  if (!paket) return false;
  if (paket.v !== PAKET_SURUM) {
    /*
     * Sürüm uyuşmazlığı sessizce atılmıyor, İŞARETLENİYOR.
     *
     * Belirtisi teşhis edilemez bir şey: paketler geliyor ama hiçbiri
     * uygulanmıyor, ekran donuyor ve "rakip bekleniyor" yazıyor —
     * oysa rakip orada. Gerçek sebep sitenin yeni, rölenin eski (ya da
     * tersi) sürümde olması; dağıtımın ikisini birden kapsaması
     * gerekiyor. Maç ekranı bu bayrağı okuyup bunu söylüyor.
     */
    oyun.agSurumUyusmazligi = true;
    return false;
  }

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

  paket.p.forEach((d, i) => oyuncuAyriksiUygula(oyun.players[i], d));

  /*
   * Kendi oyuncusunu tahmin eden istemci onu ara değerlemeye BIRAKMAZ:
   * uzlaştırma paketin fizik alanlarından devam ediyor. Sıra önemli —
   * `agUzlastir` konumu yazdıktan sonra `agKonumHedefle` çağrılıyor ve
   * tahmin edilen oyuncu hedef listesinden çıkarılıyor.
   */
  const tahminIndeksi = oyun.agUzlastir(paket);

  /*
   * Konumlar doğrudan yazılmıyor, hedef olarak veriliyor.
   *
   * Doğrudan yazıldığı sürümde misafirin ekranı saniyede 20 kez
   * güncelleniyordu: tarayıcı 60 FPS çizse bile top 20 kez zıplayarak
   * ilerlediği için oyun "donuyor" gibi görünüyordu. Şimdi iki paket
   * arası ara değerleniyor (Game.agAradegerle).
   */
  oyun.agKonumHedefle(paket.b, paket.p, tahminIndeksi);

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
 *
 * @param {number} an İstemcinin motor saati. Sunucu bunu okumaz, geri
 *   yollar (`az`); istemci kendi saatinden çıkarıp "görüntü ne kadar
 *   eski" sorusunu yanıtlıyor. Saatleri eşitlemeye gerek kalmamasının
 *   sebebi bu — damga hep sahibine dönüyor.
 */
export function girdiPaketle(tuslar, basisSayaci, an) {
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
    z: an,
  };
}
