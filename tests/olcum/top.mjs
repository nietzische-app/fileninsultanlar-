/**
 * TOP GECİKMESİ ölçümü.
 *
 * README'de duran bilinen eksik şu: kendi oyuncumuz TAHMİN edildiği
 * için ekranda "şimdi"yi gösteriyor (ölçüldü: tepki 17 ms), top ise
 * anlık görüntülerden ARA DEĞERLENİYOR ve bilerek geçmişten çiziliyor
 * (`agTamponBoyu`; sabit 100 ms idi, artık ölçülen seğirmeye göre
 * ~50-200 ms). Yani ekranda oyuncu ile top FARKLI ANLARDA duruyor.
 *
 * Bu dosya "ne kadar" sorusunu yanıtlıyor. Telafi yazmadan önce bunu
 * bilmek şart: eksik birkaç piksel ise dokunmaya değmez, çünkü
 * ileriye tahmin vuruş anında YANILIR ve topu zıplatır — yani
 * düzeltmenin kendi bedeli var.
 *
 * ÜÇ SAYI
 * -------
 *   1. sapma      — istemcinin çizdiği top ile sunucunun AYNI ADIMDAKİ
 *                   topu arasındaki mesafe (p50 / p95, piksel).
 *   2. zaman farkı — o sapmanın kaç milisaniyeye denk geldiği. Sunucunun
 *                   geçmiş konumları arasında istemcinin çizdiğine EN
 *                   YAKIN olanı aranıyor; aradaki adım sayısı budur.
 *                   Piksel tek başına yanıltıcı: yavaş giden top az
 *                   sapar ama aynı kadar geç kalmıştır.
 *   3. hız        — topun adım başına yol aldığı mesafe. Sapmayı
 *                   okurken ölçek gerekiyor.
 *
 * Ayrıca oyuncu-top AYRIMI: asıl rahatsızlık mutlak gecikme değil,
 * oyuncunun "şimdi"de, topun geçmişte olması. İkisinin zaman farkı
 * ayrı yazdırılıyor.
 *
 * Kullanım:
 *   node tests/olcum/top.mjs
 *   GECIKMELER=0,50,100,200 node tests/olcum/top.mjs
 */

import Game from '../../src/game/Game.js';
import { PHYSICS, PHASE, GAME_WIDTH, GROUND_Y } from '../../src/game/constants.js';

const GECIKMELER = (process.env.GECIKMELER ?? '0,25,50,100').split(',').map(Number);
const ADIM = Number(process.env.ADIM ?? 600);
const MS = PHYSICS.step * 1000;
/** Ölçüme girmeden önce tamponun oturması için atlanan adım. */
const ISINMA = 90;

/** Yapay gecikmeli tek yönlü kanal — `gecikme.mjs` ile aynı. */
class Kanal {
  constructor(gecikmeAdim) {
    this.gecikme = gecikmeAdim;
    this.kuyruk = [];
  }

  yolla(paket, adim) {
    this.kuyruk.push({ varis: adim + this.gecikme, veri: JSON.stringify(paket) });
  }

  al(adim) {
    const cikan = [];
    while (this.kuyruk.length && this.kuyruk[0].varis <= adim) {
      cikan.push(JSON.parse(this.kuyruk.shift().veri));
    }
    return cikan;
  }
}

function tohumla() {
  let tohum = 987654321;
  Math.random = () => {
    tohum = (tohum * 1103515245 + 12345) & 0x7fffffff;
    return tohum / 0x7fffffff;
  };
}

const AYAR = { mode: 'quick', playMode: 'vs', format: 'kisa', difficulty: 'orta' };

/**
 * Topu havada tutar.
 *
 * Gerçek ralli beklemek yerine top elle fırlatılıyor: yere düştüğünde
 * ya da sahadan çıktığında yeniden atılıyor. Sebebi ölçümün
 * TEKRARLANABİLİR olması — gerçek rallide vuruş anları rastgeleye
 * bağlı ve iki koşum arasında karşılaştırma yapılamazdı.
 *
 * Fırlatışlar tohumlu üreteçten geliyor, yani her koşumda aynı.
 */
function topuBesle(oyun, adim) {
  oyun.phase = PHASE.RALLY;
  oyun.phaseTimer = 99;

  const top = oyun.ball;
  const dustu = top.y + top.radius >= GROUND_Y;
  const disarida = top.x < 0 || top.x > GAME_WIDTH;

  if (adim === 0 || dustu || disarida) {
    /*
     * FIRLATIŞ ANLARI ÖLÇÜME GİRMİYOR ve bu bir düzeltme.
     *
     * İlk koşumda p95 ~300 px çıktı ve bunu "gecikme" sandım. Değildi:
     * fırlatışta top sunucuda IŞINLANIYOR, istemci onu bir gidiş yolu
     * sonra görüyor. O birkaç karede iki taraf tabii ki taban tabana
     * ayrı — ama bu ağ gecikmesi değil, ölçüm düzeneğimin kendi
     * ürettiği bir sıçrama. Gerçek oyunda top ışınlanmıyor.
     *
     * Fırlatıştan sonraki bir gidiş-dönüş + tampon boyu kadar kare
     * atlanıyor.
     */
    oyun.__firlatisAdim = adim;
    top.x = GAME_WIDTH * (0.25 + Math.random() * 0.5);
    top.y = 120 + Math.random() * 80;
    // Voleybolda topun tipik hız aralığı; çok yavaş atış ölçümü kolaylaştırırdı
    top.vx = (Math.random() - 0.5) * 520;
    top.vy = -80 - Math.random() * 240;
    top.rotation = 0;
  }
}

function kendiOyuncu(oyun, yuva = 'p1') {
  return oyun.players.find((p) => p.controlSlot === yuva) ?? oyun.players[0];
}

function medyan(dizi) {
  if (!dizi.length) return 0;
  const s = [...dizi].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function yuzdelik(dizi, p) {
  if (!dizi.length) return 0;
  const s = [...dizi].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
}

function olc(gecikmeMs) {
  tohumla();
  const gecikmeAdim = Math.round(gecikmeMs / MS);

  const yukari = new Kanal(gecikmeAdim);
  const asagi = new Kanal(gecikmeAdim);
  let adim = 0;

  const sunucu = new Game(null, {
    ...AYAR,
    bassiz: true,
    agRol: 'ev',
    agGonder: (paket) => asagi.yolla(paket, adim),
  });
  sunucu.start();

  const istemci = new Game(null, {
    ...AYAR,
    opponentId: sunucu.opponent.id,
    homeIds: [...sunucu.homeIds],
    bassiz: true,
    agRol: 'misafir',
    agYuvam: 'p1',
    agTahmin: process.env.TAHMIN !== '0',
    agTopIleri: process.env.TOPILERI !== '0',
    agGonder: (paket) => yukari.yolla(paket, adim),
  });
  istemci.start();

  const benSunucu = kendiOyuncu(sunucu);
  const benIstemci = kendiOyuncu(istemci);

  /*
   * Sunucunun top geçmişi. İstemcinin çizdiği topun KAÇ ADIM geride
   * olduğunu bulmak için gerekiyor; piksel farkı tek başına hızla
   * karışır.
   */
  const topGecmisi = [];
  const oyuncuGecmisi = [];

  const sapmalar = [];
  const zamanFarklari = [];
  const oyuncuZamanFarklari = [];
  const hizlar = [];

  let oncekiTop = null;
  let firlatisAtlanan = 0;
  /*
   * SIÇRAMA: istemcinin çizdiği topun bir karede atladığı mesafe, o
   * karede FİZİKSEL olarak mümkün olanın üstünde. İleri sarmanın
   * bedeli burada görünüyor — vuruş anında tahmin yanılıyor ve paket
   * gelince top gerçek yerine atlıyor. Ortalama iyileşirken bunun
   * patlaması, düzeltmenin göze batan bir bedeli olduğu anlamına gelir.
   */
  const sicramalar = [];
  let oncekiCizim = null;

  for (adim = 0; adim < ADIM; adim += 1) {
    yukari.al(adim).forEach((paket) => sunucu.agPaketAl(paket, 'p1'));
    asagi.al(adim).forEach((paket) => istemci.agPaketAl(paket, 'p2'));

    topuBesle(sunucu, adim);
    sunucu.ilerlet(PHYSICS.step);
    sunucu.agAkis();

    istemci.ilerlet(PHYSICS.step);
    istemci.agAkis();

    topGecmisi.push({ x: sunucu.ball.x, y: sunucu.ball.y });
    oyuncuGecmisi.push({ x: benSunucu.x, y: benSunucu.y });

    /*
     * `oncekiCizim` ATLANAN karelerde de sıfırlanıyor. Sıfırlamayı
     * unutmuştum ve sıçrama ölçümü ileri sarma KAPALIYKEN bile 200 px
     * gösteriyordu: atlanan aralığın iki ucu arasındaki mesafeyi tek
     * kare sıçraması sanıyordum. Ölçtüğüm şey topun davranışı değil,
     * kendi atlama bloğumdu.
     */
    if (adim < ISINMA) {
      oncekiTop = { x: sunucu.ball.x, y: sunucu.ball.y };
      oncekiCizim = null;
      continue;
    }

    // Fırlatış sıçraması geçene kadar ölçme (bkz. `topuBesle`)
    const firlatisMesafe = adim - (sunucu.__firlatisAdim ?? -999);
    if (firlatisMesafe < gecikmeAdim * 2 + 18) {
      oncekiTop = { x: sunucu.ball.x, y: sunucu.ball.y };
      oncekiCizim = null;
      firlatisAtlanan += 1;
      continue;
    }

    // Topun bu adımda aldığı yol — sapmayı okurken ölçek
    if (oncekiTop) {
      hizlar.push(Math.hypot(sunucu.ball.x - oncekiTop.x, sunucu.ball.y - oncekiTop.y));
    }
    oncekiTop = { x: sunucu.ball.x, y: sunucu.ball.y };

    // 1) Aynı andaki sapma
    const sapma = Math.hypot(
      istemci.ball.x - sunucu.ball.x,
      istemci.ball.y - sunucu.ball.y,
    );
    sapmalar.push(sapma);

    /*
     * 2) Kaç adım geride? Sunucunun geçmişinde istemcinin çizdiğine EN
     * YAKIN kareyi arıyoruz. Yaklaşık ama doğru soruyu soruyor: "bu
     * görüntü sunucunun hangi anına ait".
     */
    if (oncekiCizim) {
      const yol = Math.hypot(istemci.ball.x - oncekiCizim.x, istemci.ball.y - oncekiCizim.y);
      // O karede topun gerçekten alabileceği yol (sunucudaki hızıyla)
      const mumkun = Math.hypot(sunucu.ball.vx, sunucu.ball.vy) * PHYSICS.step;
      sicramalar.push(Math.max(0, yol - mumkun * 1.5));
    }
    oncekiCizim = { x: istemci.ball.x, y: istemci.ball.y };

    zamanFarklari.push(enYakinGecmis(topGecmisi, istemci.ball) * MS);
    oyuncuZamanFarklari.push(enYakinGecmis(oyuncuGecmisi, benIstemci) * MS);
  }

  return {
    sapmaP50: medyan(sapmalar),
    sapmaP95: yuzdelik(sapmalar, 0.95),
    topGeri: medyan(zamanFarklari),
    oyuncuGeri: medyan(oyuncuZamanFarklari),
    hiz: medyan(hizlar),
    sicramaP99: yuzdelik(sicramalar, 0.99),
    sicramaEnBuyuk: sicramalar.length ? Math.max(...sicramalar) : 0,
    orneklem: sapmalar.length,
    atlanan: firlatisAtlanan,
  };
}

/**
 * Verilen konuma en yakın geçmiş kareden bu yana geçen ADIM sayısı.
 *
 * Son 40 adıma bakıyor: daha geriye bakmak, topun yolu kendisiyle
 * kesiştiğinde (parabol) yanlış eşleşme üretiyor.
 */
function enYakinGecmis(gecmis, konum) {
  const bas = Math.max(0, gecmis.length - 40);
  let enIyi = 0;
  let enIyiFark = Infinity;
  for (let i = gecmis.length - 1; i >= bas; i -= 1) {
    const d = Math.hypot(gecmis[i].x - konum.x, gecmis[i].y - konum.y);
    if (d < enIyiFark) {
      enIyiFark = d;
      enIyi = gecmis.length - 1 - i;
    }
  }
  return enIyi;
}

console.log('TOP GECİKMESİ — istemcinin çizdiği top, sunucunun neresinde\n');
console.log('tek yön |  sapma p50 |  sapma p95 |  top geri |  sıçrama p99 |  en büyük sıçrama');
console.log('─'.repeat(80));

for (const g of GECIKMELER) {
  const r = olc(g);
  console.log(
    `${String(g).padStart(6)}ms | `
    + `${r.sapmaP50.toFixed(1).padStart(8)}px | `
    + `${r.sapmaP95.toFixed(1).padStart(8)}px | `
    + `${r.topGeri.toFixed(0).padStart(7)}ms | `
    + `${r.sicramaP99.toFixed(1).padStart(9)}px | `
    + `${r.sicramaEnBuyuk.toFixed(1).padStart(14)}px`
    + `   (${r.orneklem} örnek)`,
  );
}

console.log(
  '\n"top geri" ile "oyuncu geri" arasındaki fark, ekranda oyuncunun ve'
  + '\ntopun kaç ms farklı anda durduğudur — asıl rahatsızlık bu.',
);
