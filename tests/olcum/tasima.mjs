/**
 * TAŞIMA KATMANI — WebSocket (TCP) ile UDP arasındaki fark ne kadar?
 *
 * Bu ölçüm bir sorudan doğdu: "oyunu tarayıcıdan değil başka bir
 * platformdan oynasak bu sorunlar çözülür mü?"
 *
 * Sorunun ciddiye alınacak tarafı çizim değil TAŞIMA. Ölçtük: çizim
 * 16.7 ms'lik bütçenin yirmide birini kullanıyor, yani oradan
 * kazanılacak bir şey yok. Ama WebSocket TCP üstünde çalışıyor ve
 * TCP'nin bu oyun için gerçek bir kusuru var:
 *
 *   TCP: bir paket kaybolursa ARKASINDAKİLER DE BEKLER. Kayıp paket
 *        yeniden gönderilip varana kadar sonrakiler sırada tutulur
 *        (head-of-line blocking). İstemci hiçbir şey almaz, sonra
 *        hepsi TOPLU gelir.
 *   UDP: kayıp paket kaybolur, sonrakiler zamanında gelir. Oyun için
 *        doğru davranış: 33 ms sonra zaten daha yeni bir anlık görüntü
 *        geliyor, eskisinin yeniden gönderilmesinin bir değeri yok.
 *
 * Bu dosya ikisini AYNI kayıp oranında karşılaştırıyor. Aradaki fark,
 * "UDP taşımaya geçmenin" getireceği kazancın üst sınırı — çünkü
 * burada UDP tarafı kusursuz kabul ediliyor.
 *
 * NE SINAMIYOR: mimari değişikliğin bedelini. Röle WebSocket üstüne
 * kurulu, tarayıcıda ham UDP yok (WebTransport/WebRTC ayrı bir iş) ve
 * Capacitor paketi de bir WebView — yani "Android'e çıkmak" tek başına
 * taşımayı değiştirmiyor. Bu sayı yalnız "değer mi" sorusunun ilk
 * yarısı.
 *
 * Kullanım: npm run olcum:tasima
 */
import Game from '../../src/game/Game.js';
import { PHYSICS, PHASE } from '../../src/game/constants.js';

/** Ölçüm uzunluğu (sn). */
const SURE = 30;
/** Duvar saati çözünürlüğü (sn). */
const TIK = 0.001;
/** Tek yön taban gecikme (sn). */
const YOL = 0.055;
/** Varış seğirmesi (± sn). */
const SEGIRME = 0.005;

const AYAR = { mode: 'quick', playMode: 'vs', format: 'kisa', difficulty: 'orta' };

/**
 * Kayıplı kanal — iki taşıma modeli.
 *
 * @param {'tcp'|'udp'} kip
 * @param {number} kayip Paket kaybı olasılığı (0-1)
 * @param {() => number} rast
 */
class Kanal {
  constructor(kip, kayip, rast) {
    this.kip = kip;
    this.kayip = kayip;
    this.rast = rast;
    this.k = [];
    /** TCP'de sıranın açılacağı an — bundan öncesi teslim edilemez. */
    this.kilit = 0;
    this.sayac = { yollanan: 0, dusen: 0, gecikenArkasi: 0 };
  }

  yolla(paket, saat) {
    this.sayac.yollanan += 1;
    const segirme = (this.rast() * 2 - 1) * SEGIRME;
    let varis = saat + YOL + segirme;

    if (this.rast() < this.kayip) {
      this.sayac.dusen += 1;
      if (this.kip === 'udp') return; // kayıp kayıptır, kimse beklemez
      /*
       * TCP: paket yeniden gönderiliyor. En iyimser tahmin bir
       * gidiş-dönüş (RTO genelde daha uzun ve katlanarak büyür), yani
       * bu ölçüm TCP'yi OLDUĞUNDAN İYİ gösteriyor.
       */
      varis += YOL * 2;
    }

    if (this.kip === 'tcp') {
      /*
       * SIRA KORUNUR: bu paket kendinden öncekinden erken teslim
       * edilemez. Head-of-line blocking tam olarak bu satır.
       */
      if (varis < this.kilit) {
        varis = this.kilit;
        this.sayac.gecikenArkasi += 1;
      }
      this.kilit = varis;
    }

    this.k.push({ v: varis, d: JSON.stringify(paket) });
    this.k.sort((a, b) => a.v - b.v);
  }

  al(saat) {
    const c = [];
    while (this.k.length && this.k[0].v <= saat) c.push(JSON.parse(this.k.shift().d));
    return c;
  }
}

/**
 * @param {'tcp'|'udp'} kip
 * @param {number} kayip
 */
function olc(kip, kayip) {
  let tohum = 20260908;
  const rast = () => { tohum = (tohum * 1103515245 + 12345) & 0x7fffffff; return tohum / 0x7fffffff; };

  const yukari = new Kanal(kip, kayip, rast);
  const asagi = new Kanal(kip, kayip, rast);
  let saat = 0;

  const sunucu = new Game(null, {
    ...AYAR, bassiz: true, agRol: 'ev', agGonder: (p) => asagi.yolla(p, saat),
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

  const rakip = g.players.find((p) => p.controlSlot !== 'p1');
  let sonrakiTik = 0;
  let sonrakiKare = 0;
  let sagRakip = true;
  const gerilikler = [];
  const tamponlar = [];
  const konumlar = [];

  for (let n = 0; n * TIK < SURE; n += 1) {
    saat = n * TIK;

    if (saat >= sonrakiTik) {
      yukari.al(saat).forEach((p) => sunucu.agPaketAl(p, 'p1'));
      sunucu.phase = PHASE.RALLY; sunucu.phaseTimer = 99;
      // Rakip sabit hızla gidip geliyor — akıcılık sinyali
      const r2 = sunucu.players.find((p) => p.controlSlot === 'p2');
      if (r2.x > 800) sagRakip = false;
      else if (r2.x < 510) sagRakip = true;
      sunucu.inputs.p2.right = sagRakip;
      sunucu.inputs.p2.left = !sagRakip;
      sunucu.ilerlet(PHYSICS.step);
      sunucu.agAkis();
      sonrakiTik += PHYSICS.step;
    }

    if (saat >= sonrakiKare) {
      asagi.al(saat).forEach((p) => g.agPaketAl(p, 'p2'));
      g.ilerlet(PHYSICS.step);
      g.agAkis();
      sonrakiKare = saat + PHYSICS.step;
      if (saat > 5) {
        const t = g.agTaniOzeti();
        if (t.gerilik !== null) { gerilikler.push(t.gerilik); tamponlar.push(t.tampon); }
        konumlar.push(rakip.x);
      }
    }
  }

  const p95 = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.95)] ?? 0;
  const ort = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);

  // Akıcılık: kare başına giden yolun dalgalanması
  const yollar = [];
  for (let i = 1; i < konumlar.length; i += 1) yollar.push(Math.abs(konumlar[i] - konumlar[i - 1]));
  const yOrt = ort(yollar);
  const duraklama = (yollar.filter((y) => y < yOrt * 0.15).length / Math.max(1, yollar.length)) * 100;

  return {
    gerilik: Math.round(ort(gerilikler)),
    gerilikP95: Math.round(p95(gerilikler)),
    tampon: Math.round(ort(tamponlar)),
    duraklama,
    dusen: asagi.sayac.dusen,
    arkasi: asagi.sayac.gecikenArkasi,
  };
}

console.log('\nTAŞIMA KATMANI — TCP (WebSocket) ile UDP arasındaki fark\n');
console.log('Ağ her satırda aynı: 55 ms tek yön, ±5 ms seğirme.');
console.log('Değişen tek şey KAYIP oranı ve taşımanın kayba tepkisi.\n');
console.log('kayıp   taşıma   gerilik   p95    tampon  duraklama   sıra bekleyen');
console.log('-'.repeat(70));

const sonuc = {};
[0, 0.005, 0.02, 0.05].forEach((kayip) => {
  ['udp', 'tcp'].forEach((kip) => {
    const r = olc(kip, kayip);
    sonuc[`${kayip}-${kip}`] = r;
    console.log(
      `${`%${(kayip * 100).toFixed(1)}`.padStart(6)}   ${kip.toUpperCase().padEnd(6)} ${
        String(r.gerilik).padStart(7)}ms ${String(r.gerilikP95).padStart(6)}ms ${
        String(r.tampon).padStart(6)}ms ${`%${r.duraklama.toFixed(1)}`.padStart(9)} ${
        String(r.arkasi).padStart(14)}`,
    );
  });
});

const f = (k) => sonuc[`${k}-tcp`].gerilik - sonuc[`${k}-udp`].gerilik;
console.log(`
OKUMA: "sıra bekleyen", kaybolan bir paket yüzünden GECİKTİRİLEN
sonraki paketlerin sayısı — UDP'de tanımı gereği sıfır. Aradaki
gerilik farkı, UDP taşımaya geçmenin getireceği kazancın ÜST SINIRI
(burada UDP kusursuz kabul ediliyor).

  %0.5 kayıpta fark: ${f(0.005)} ms
  %2   kayıpta fark: ${f(0.02)} ms
  %5   kayıpta fark: ${f(0.05)} ms

Kayıp yokken iki taşıma AYNI olmalı. Değilse ölçüm bozuktur.`);
