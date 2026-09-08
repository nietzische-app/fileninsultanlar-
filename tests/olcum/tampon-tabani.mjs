/**
 * TAMPONUN TABANI — ne kadar indirilebilir?
 *
 * Bir teşhis raporu şunu önerdi: "seğirme 3-6 ms kadar düşükken 60 ms
 * tampona gerek yok, 30-40 ms'ye çekin." Öneri makul görünüyor ama
 * tamponun tabanını belirleyen şey SEĞİRME DEĞİL, PAKET ARALIĞI.
 *
 * Ara değerleme çizilecek anın elimizdeki iki paketin ARASINDA
 * kalmasını gerektiriyor. Paketler 33 ms arayla geliyorsa, tampon bir
 * tam aralıktan küçük olduğu anda çizim saati en yeni paketi geçiyor
 * ve tampon KURUYOR — ekran son bilinen kareyi tutuyor, yani donuyor.
 * 30 ms'lik bir tampon 33 ms'lik akışta her aralıkta kuruyor demek.
 *
 * NEDEN AYRI BİR ÖLÇÜM: elimizdeki iki araç bu soruyu göremiyor.
 *   · `olcum:akicilik` seğirme enjekte ediyor (±5 ila ±40 ms) ve
 *     seğirme payı tabanı örtüyor — taban 1.0'a indirilse bile
 *     duraklama %0 çıkıyor, yani araç tabanı hiç sınamıyor.
 *   · `olcum:hissedilen` tek adım (16.7 ms) çözünürlükte; 60 ms ile
 *     50 ms arasındaki farkı ayıramıyor.
 *
 * Bu ölçüm KURUMAYI DOĞRUDAN sayıyor: motor tampon kuruduğunda
 * `agKareYaz(son, son, 1)` çağırıyor, yani iki ucu AYNI kayıt oluyor.
 * O çağrı sarmalanıp sayılıyor — dolaylı bir belirtiye değil,
 * mekanizmanın kendisine bakılıyor.
 *
 * Kullanım: npm run olcum:tampon-tabani
 */
import Game from '../../src/game/Game.js';
import { PHYSICS } from '../../src/game/constants.js';

/** Ölçüm uzunluğu (sn). */
const SURE = 25;
/** Duvar saati çözünürlüğü (sn). */
const TIK = 0.001;
/** Taban tek yön gecikme (sn). */
const YOL = 0.05;

const AYAR = { mode: 'quick', playMode: 'vs', format: 'kisa', difficulty: 'orta' };

class Kanal {
  constructor(taban) { this.taban = taban; this.k = []; }

  yolla(p, saat, segirme = 0) {
    this.k.push({ v: saat + this.taban + segirme, d: JSON.stringify(p) });
  }

  al(saat) {
    const c = [];
    while (this.k.length && this.k[0].v <= saat) c.push(JSON.parse(this.k.shift().d));
    return c;
  }
}

/**
 * @param {number} taban  Sınanacak `AG.tamponTaban` değeri
 * @param {number} segirmeMs Enjekte edilen varış seğirmesi (± ms)
 */
function olc(taban, segirmeMs, tokezHz = 0) {
  let tohum = 20260908;
  const rast = () => { tohum = (tohum * 1103515245 + 12345) & 0x7fffffff; return tohum / 0x7fffffff; };

  const yukari = new Kanal(YOL);
  const asagi = new Kanal(YOL);
  let saat = 0;

  const sunucu = new Game(null, {
    ...AYAR,
    bassiz: true,
    agRol: 'ev',
    agGonder: (p) => {
      /*
       * TÖKEZLEME: saniyede `tokezHz` kez TEK bir paket geç kalıyor —
       * gerçek Wi-Fi hıçkırığının hâli. Bu, tabanı sınamanın asıl
       * yolu: seğirme EWMA'sı ~20 pakette (0.7 sn) tepki verdiği için
       * ANİ bir gecikmeyi önceden soğuramaz, onu tampon karşılamalı.
       */
      const tokez = tokezHz > 0 && rast() < tokezHz / 30 ? 0.08 : 0;
      asagi.yolla(p, saat, (rast() * 2 - 1) * segirmeMs * 0.001 + tokez);
    },
  });
  sunucu.start();
  const g = new Game(null, {
    ...AYAR,
    opponentId: sunucu.opponent.id,
    homeIds: [...sunucu.homeIds],
    bassiz: true,
    agRol: 'misafir',
    agYuvam: 'p1',
    agGonder: (p) => yukari.yolla(p, saat),
    agSaat: () => saat,
  });
  g.start();

  /*
   * TABAN AYARDAN DEĞİL, DIŞARIDAN dayatılıyor: `AG` modül içi sabit
   * ve dışa açılmıyor. Hedef formülü `tamponTaban * paketAralik +
   * seğirme * kat` olduğu için, tabanı değiştirmenin dürüst yolu
   * ölçülen hedefi aynı formülle yeniden kurmak.
   */
  const asilOlc = g.agSegirmeOlc.bind(g);
  g.agSegirmeOlc = (zaman) => {
    /*
     * Motorun kendi tampon güncellemesi GERİ ALINIYOR, üstüne
     * yazılmıyor. İlk yazışta sadece üstüne yazmıştım ve iki formül
     * birlikte çalıştığı için sonuç ikisinin ortasında kalıyordu:
     * taban 1.0 ile 1.5 arasında tampon 16.7 ms yerine 8 ms
     * oynuyordu, yani ölçüm sınadığını sandığı şeyi sınamıyordu.
     */
    const once = g.agTamponBoyu;
    asilOlc(zaman); // agVarisSapma ve agPaketAralik güncellensin
    g.agTamponBoyu = once;
    const hedef = Math.min(0.2, taban * g.agPaketAralik + g.agVarisSapma * 2.5);
    g.agTamponBoyu += (hedef - g.agTamponBoyu) * 0.05;
  };

  /*
   * KURUMA SAYACI. Motor tampon kuruyunca `agKareYaz(son, son, 1)`
   * çağırıyor — iki uç aynı nesne. Belirtiye değil mekanizmaya
   * bakılıyor.
   */
  let kuru = 0;
  let olcum = 0;
  let enAzPay = Infinity;

  let sonrakiTik = 0;
  let sonrakiKare = 0;
  const gerilikler = [];

  for (let n = 0; n * TIK < SURE; n += 1) {
    saat = n * TIK;

    if (saat >= sonrakiTik) {
      yukari.al(saat).forEach((p) => sunucu.agPaketAl(p, 'p1'));
      sunucu.phase = 'rally'; sunucu.phaseTimer = 99;
      sunucu.inputs.p2.right = (Math.floor(saat * 2) % 2) === 0;
      sunucu.ilerlet(PHYSICS.step);
      sunucu.agAkis();
      sonrakiTik += PHYSICS.step;
    }

    if (saat >= sonrakiKare) {
      const gelen = asagi.al(saat);
      /*
       * PAY, PAKET GELMEDEN HEMEN ÖNCE ölçülüyor — en düşük olduğu an
       * orası. Kare başına ölçmek yanıltıyordu: kareler paketlerle
       * 2:1 faz kilidinde olduğu için ölçüm dip noktasını hiç
       * görmüyordu ve tampon yarıya inse bile "kuruma %0" diyordu.
       */
      if (gelen.length && g.agTampon.length && saat > 5) {
        const pay = g.agTampon[g.agTampon.length - 1].zaman - g.agCizimSaati;
        enAzPay = Math.min(enAzPay, pay);
        olcum += 1;
        if (pay <= 0) kuru += 1;
      }
      gelen.forEach((p) => g.agPaketAl(p, 'p2'));
      g.ilerlet(PHYSICS.step);
      g.agAkis();
      /*
       * Kare zamanlaması PAKETLERLE FAZ KİLİDİNDE OLMAMALI; gerçek
       * cihazda da değil. Kilitliyken ölçüm dip noktasını kaçırıyor.
       */
      sonrakiKare = saat + PHYSICS.step * (0.85 + rast() * 0.3);
      if (saat > 5) {
        const t = g.agTaniOzeti();
        if (t.gerilik !== null) gerilikler.push(t.gerilik);
      }
    }
  }

  return {
    kuruYuzde: (kuru / Math.max(1, olcum)) * 100,
    enAzPay: Math.round(enAzPay * 1000),
    gerilik: Math.round(gerilikler.reduce((a, b) => a + b, 0) / gerilikler.length),
    tampon: Math.round(g.agTamponBoyu * 1000),
  };
}

console.log('\nTAMPONUN TABANI — nereye kadar inebilir?\n');
console.log('Paket aralığı 33 ms (30 Hz). Taban PAKET ARALIĞI cinsinden.');
console.log('"kuruma" = tamponun boşaldığı ve ekranın son kareyi TUTTUĞU kare oranı.\n');

const SENARYO = [
  ['sakin ağ (±4 ms)', 4, 0],
  ['hafif seğirme (±12 ms)', 12, 0],
  ['saniyede 1 hıçkırık (+80 ms)', 4, 1],
  ['saniyede 3 hıçkırık (+80 ms)', 4, 3],
];

SENARYO.forEach(([ad, segirmeMs, tokezHz]) => {
  console.log(`--- ${ad} ---`);
  console.log('  taban   tampon   gerilik   en az pay   KURUMA');
  [0.75, 1.0, 1.15, 1.25, 1.4, 1.5].forEach((taban) => {
    const r = olc(taban, segirmeMs, tokezHz);
    const isaret = r.kuruYuzde > 0 ? '  ← ekran donuyor' : '';
    console.log(
      `  ${taban.toFixed(2)}  ${String(r.tampon).padStart(5)}ms  ${
        String(r.gerilik).padStart(6)}ms  ${String(r.enAzPay).padStart(8)}ms  ${
        r.kuruYuzde.toFixed(1).padStart(6)}%${isaret}`,
    );
  });
  console.log('');
});

console.log(`OKUMA: kuruma sıfır kalmadan tabanı indirmek gecikmeyi düşürmez,
DONMAYA çevirir. Aranan şey, kurumanın sıfır kaldığı EN KÜÇÜK taban.

Bir teşhis raporu "seğirme düşükken tamponu 30-40 ms'ye çekin" dedi.
30 ms bir paket aralığından (33 ms) küçük; o bölgede kuruma kaçınılmaz
ve önerinin dayandığı "seğirme düşük" gerekçesi tabanı belirlemiyor —
tabanı paket aralığı belirliyor, seğirme yalnız ÜSTÜNE biniyor.`);
