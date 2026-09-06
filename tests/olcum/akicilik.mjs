/**
 * AKICILIK ölçümü — rakip ve top ekranda düzgün mü akıyor?
 *
 * `gecikme.mjs` KENDİ oyuncumuzu ölçüyor ve orada her şey iyi çıkıyor
 * (tepki 17 ms), çünkü kendi oyuncumuz tahmin ediliyor. Ama oyuncunun
 * "kasıyor" dediği şey çoğu zaman o değil: ekranın geri kalanı —
 * rakip ve top — tahmin edilmiyor, gelen anlık görüntüler arasında ARA
 * DEĞERLEME ile yumuşatılıyor. Kasma oradaysa gecikme ölçümü onu hiç
 * görmez. Bu dosya o boşluğu kapatıyor.
 *
 * ÖLÇÜM SİNYALİ: rakip sabit hızla yürütülüyor. Sabit hız kasten
 * seçildi — kusursuz bir ara değerlemede kare başına giden yol
 * DEĞİŞMEZ. Yani ölçülen her dalgalanma doğrudan ara değerlemenin (ya
 * da ağın) kusuru; sahnedeki hareketin kendisinden gelmiyor.
 *
 * ÜÇ SAYI, çünkü tek sayı yanıltır:
 *   1. dalgalanma — kare başına yolun değişim katsayısı (std/ortalama).
 *                   0 = kusursuz düz akış. Gözle fark edilen kasma
 *                   burada büyür.
 *   2. duraklama  — hareket sürerken ekranda neredeyse hiç yol
 *                   alınmayan karelerin oranı. Ara değerleme hedefine
 *                   varıp bir sonraki paketi beklerse burada çıkar;
 *                   göze "takılma" olarak görünen şey budur.
 *   3. sıçrama    — en uzun karenin ortalamaya oranı. Duraklamadan
 *                   sonra gelen telafi adımı. 1'e yakın olmalı.
 *
 * SEĞİRME (jitter) ayrı bir sütun: gerçek ağda paketler eşit aralıkla
 * gelmiyor ve sunucunun `setInterval`i de kayıyor. Seğirmesiz sayı
 * "kodumuz ne kadar iyi", seğirmeli sayı "oyuncunun gördüğü" demek.
 *
 * Kullanım:
 *   node tests/olcum/akicilik.mjs
 *   HZ=30 node tests/olcum/akicilik.mjs      # farklı durum sıklığı dene
 */

import Game from '../../src/game/Game.js';
import { PHYSICS, PHASE, GAME_WIDTH } from '../../src/game/constants.js';

const MS = PHYSICS.step * 1000;
/** Ölçüm uzunluğu (adım). 600 adım = 10 sn. */
const ADIM = Number(process.env.ADIM ?? 600);
/** İlk paketler otursun diye atlanan adım. */
const ISINMA = Number(process.env.ISINMA ?? 90);

/**
 * Yapay gecikmeli VE SEĞİRMELİ kanal.
 *
 * `gecikme.mjs`teki kanal sabit gecikmeli; orada doğru olan bu, çünkü
 * ölçüm yeniden üretilebilir olmalı. Burada seğirme ölçümün KONUSU:
 * eşit aralıkla gelen paketlerle ara değerleme zaten iyi çalışır,
 * kasma düzensiz gelişte doğar.
 */
class Kanal {
  constructor(gecikmeAdim, segirmeAdim, rastgele) {
    this.gecikme = gecikmeAdim;
    this.segirme = segirmeAdim;
    this.rastgele = rastgele;
    this.kuyruk = [];
  }

  yolla(paket, adim) {
    const sapma = this.segirme > 0
      ? Math.round((this.rastgele() * 2 - 1) * this.segirme)
      : 0;
    const varis = adim + Math.max(0, this.gecikme + sapma);
    this.kuyruk.push({ varis, veri: JSON.stringify(paket) });
    /*
     * Seğirme paketlerin SIRASINI bozabilir; gerçek ağda da bozuluyor.
     * Varışa göre sıralamak, kuyruğun "en erken varan önce" olmasını
     * sağlıyor — motorun eski paketi eleme mantığı da böylece sınanmış
     * oluyor.
     */
    this.kuyruk.sort((a, b) => a.varis - b.varis);
  }

  al(adim) {
    const cikan = [];
    while (this.kuyruk.length && this.kuyruk[0].varis <= adim) {
      cikan.push(JSON.parse(this.kuyruk.shift().veri));
    }
    return cikan;
  }
}

/** Tohumlu üreteç — koşumlar karşılaştırılabilir olsun. */
function uretec(tohum = 20260906) {
  let s = tohum;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

const AYAR = { mode: '1v1', playMode: 'vs', format: 'single', difficulty: 'normal' };

/** Sahayı ralliye sabitler — servis aşamasında oyuncular hiç adımlanmıyor. */
function sahayiSabitle(oyun) {
  oyun.phase = PHASE.RALLY;
  oyun.phaseTimer = 99;
  oyun.ball.x = GAME_WIDTH / 2;
  oyun.ball.y = 90;
  oyun.ball.vx = 0;
  oyun.ball.vy = 0;
}

function yuvadan(oyun, yuva) {
  return oyun.players.find((p) => p.controlSlot === yuva) ?? null;
}

/** Yüzdelik — sıralı diziden. */
function yuzdelik(dizi, p) {
  if (!dizi.length) return 0;
  const s = [...dizi].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
}

function olc({ gecikmeMs, segirmeMs }) {
  const rastgele = uretec();
  const gecikmeAdim = Math.round(gecikmeMs / MS);
  const segirmeAdim = Math.round(segirmeMs / MS);

  let adim = 0;
  const asagi = new Kanal(gecikmeAdim, segirmeAdim, rastgele);
  const yukari = new Kanal(gecikmeAdim, 0, rastgele);

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
    agGonder: (paket) => yukari.yolla(paket, adim),
  });
  istemci.start();

  /*
   * RAKİBİ sabit hızla yürüt. Kendi oyuncumuz değil: onu istemci tahmin
   * ediyor, yani ara değerlemeden geçmiyor ve kasmayı göstermez.
   */
  const rakipSunucu = yuvadan(sunucu, 'p2');
  const rakipIstemci = yuvadan(istemci, 'p2');
  if (!rakipSunucu || !rakipIstemci) throw new Error('rakip yuvası bulunamadı');

  const yollar = [];
  let oncekiX = null;

  for (adim = 0; adim < ADIM; adim += 1) {
    yukari.al(adim).forEach((p) => sunucu.agPaketAl(p, 'p1'));
    asagi.al(adim).forEach((p) => istemci.agPaketAl(p, 'p2'));

    // Rakip sürekli sağa; duvara varınca yön değiştir (sabit HIZ korunur)
    sahayiSabitle(sunucu);
    if (rakipSunucu.x > GAME_WIDTH - 120) sunucu.inputs.p2.right = false;
    if (rakipSunucu.x < GAME_WIDTH / 2 + 40) sunucu.inputs.p2.right = true;
    sunucu.inputs.p2.left = !sunucu.inputs.p2.right;

    sunucu.ilerlet(PHYSICS.step);
    sunucu.agAkis();

    istemci.ilerlet(PHYSICS.step);
    istemci.agAkis();

    if (adim >= ISINMA) {
      const x = rakipIstemci.x;
      if (oncekiX !== null) yollar.push(Math.abs(x - oncekiX));
      oncekiX = x;
    }
  }

  // Yön dönüşündeki karelerde yol doğal olarak küçülür; onlar ölçümü
  // kirletmesin diye en büyük %2 ve en küçük %2 atılıyor.
  const sirali = [...yollar].sort((a, b) => a - b);
  const kirp = Math.floor(sirali.length * 0.02);
  const temiz = sirali.slice(kirp, sirali.length - kirp);

  const ortalama = temiz.reduce((t, v) => t + v, 0) / temiz.length;
  const varyans = temiz.reduce((t, v) => t + (v - ortalama) ** 2, 0) / temiz.length;
  const dalgalanma = Math.sqrt(varyans) / ortalama;
  const duraklama = temiz.filter((v) => v < ortalama * 0.1).length / temiz.length;
  const sicrama = yuzdelik(temiz, 0.99) / ortalama;

  return { ortalama, dalgalanma, duraklama, sicrama };
}

const DURUMLAR = [
  ['ideal (0 ms, seğirmesiz)', { gecikmeMs: 0, segirmeMs: 0 }],
  ['iyi bağlantı (30 ms, ±5)', { gecikmeMs: 30, segirmeMs: 5 }],
  ['tipik (60 ms, ±15)', { gecikmeMs: 60, segirmeMs: 15 }],
  ['kötü (120 ms, ±40)', { gecikmeMs: 120, segirmeMs: 40 }],
];

console.log('\nAKICILIK ÖLÇÜMÜ — ekranda rakip ne kadar düzgün akıyor');
console.log(`durum sıklığı: ${process.env.HZ ?? 'varsayılan'}  ·  ${ADIM} adım\n`);
console.log('durum                        dalgalanma   duraklama   sıçrama');
console.log('------------------------------------------------------------');
for (const [ad, ayar] of DURUMLAR) {
  const s = olc(ayar);
  console.log(
    `${ad.padEnd(28)} ${s.dalgalanma.toFixed(2).padStart(9)}`
    + ` ${(s.duraklama * 100).toFixed(1).padStart(9)}%`
    + ` ${s.sicrama.toFixed(2).padStart(9)}`,
  );
}
console.log('\ndalgalanma 0 = kusursuz düz akış. duraklama = takılan kare oranı.');
