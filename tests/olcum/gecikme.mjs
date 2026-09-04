/**
 * GECİKME ölçümü — tuşa basıştan kendi oyuncunun kıpırdamasına kadar.
 *
 * Neden bu ölçüm var: sunucu hakem mimaride istemci hiç simüle etmiyor.
 * Tuşa basılıyor, paket sunucuya gidiyor, sunucu adımı atıyor, anlık
 * görüntü geri geliyor, ancak o zaman oyuncu kıpırdıyor. Yerelde
 * (0 ms ağ) bu fark görünmez — bu yüzden ölçümde YAPAY GECİKME var.
 * Gecikme telafisi (istemci tarafı tahmin) tam olarak bu sayıyı
 * düşürmek için yazılıyor; düşürdüğünü buradan görüyoruz.
 *
 * Ölçüm gerçek soket kullanmıyor: iki motor aynı süreçte, adım adım
 * kilitli koşuyor ve paketler N ADIM geciktirilerek karşı tarafa
 * veriliyor. Böylece sonuç yeniden üretilebilir — gerçek ağda aynı
 * ölçümü iki kez alsak iki farklı sayı çıkardı ve iyileşme gürültünün
 * içinde kaybolurdu.
 *
 * Üç sayıya bakıyoruz, çünkü tahmin katmanı birinciyi iyileştirip
 * ötekileri bozabilir — tek sayıya bakmak yanıltır:
 *
 *   1. tepki   — basıştan kendi oyuncunun EKRANDA kıpırdamasına kaç ms.
 *                Tahminin düşürmesi gereken sayı bu.
 *   2. hata    — TAHMİN HATASI: istemcinin şu an çizdiği konum ile
 *                sunucunun bir gidiş yolu sonra gerçekten ürettiği
 *                konum arasındaki fark (p95, piksel).
 *
 *                Neden aynı ANDAKİ sunucu konumuyla değil: tahminin
 *                AMACI ileride olmak — istemci, şu an bastığım tuş
 *                sunucuya vardığında oyuncunun nerede olacağını
 *                çiziyor. Aynı andaki sunucu konumuyla karşılaştırmak
 *                doğru çalışan tahmini "sapmış" gösterirdi; ilk
 *                ölçümde tam bu tuzağa düşüp 40 px'i hata sandık,
 *                oysa o farkın tamamı kasıtlı öngörüydü. Doğru soru
 *                "ileride mi" değil, "DOĞRU yeri mi tahmin etti".
 *   3. öngörü  — istemcinin sunucunun önünde olduğu mesafe (medyan,
 *                piksel). Hata değil, tahminin ta kendisi; tek yönlü
 *                gecikmeyle orantılı olmalı. Sıfırsa tahmin çalışmıyor
 *                demektir — bu yüzden tabloda duruyor.
 *   4. sıçrama — istemcinin kendi oyuncusunun bir adımda atladığı en
 *                büyük mesafe, bir adımda MÜMKÜN olanın üstünde
 *                (piksel). Uzlaştırma yanlış tahmini düzeltirken
 *                oyuncuyu ışınlarsa burada görünür. 0'a yakın olmalı.
 *
 * Kullanım:
 *   node tests/olcum/gecikme.mjs
 *   GECIKMELER=0,50,100,200 node tests/olcum/gecikme.mjs
 */

import Game from '../../src/game/Game.js';
import { PHYSICS, PHASE, GAME_WIDTH } from '../../src/game/constants.js';

/** Tek yönlü gecikmeler (ms). Gidiş-dönüş bunun iki katı. */
const GECIKMELER = (process.env.GECIKMELER ?? '0,25,50,100').split(',').map(Number);
/** Ölçüm uzunluğu (adım). 60 adım = 1 sn. */
const ADIM = Number(process.env.ADIM ?? 240);
/** Tuşa hangi adımda basılıyor — ilk anlık görüntüler oturduktan sonra. */
const BASIS = Number(process.env.BASIS ?? 60);
const MS = PHYSICS.step * 1000;

/** Bir adımda bir oyuncunun gidebileceği en fazla mesafe (piksel). */
const AZAMI_ADIM_YOLU = PHYSICS.playerSpeed * PHYSICS.step;

/**
 * Yapay gecikmeli tek yönlü kanal.
 *
 * Paketler JSON'a çevrilip geri okunuyor: gerçek soketten geçse de öyle
 * olacak. Bu olmadan iki motor aynı nesneyi paylaşır ve tel üzerinde
 * gitmeyen bir alan sayesinde ölçüm haksız yere iyi çıkardı.
 */
class Kanal {
  constructor(gecikmeAdim) {
    this.gecikme = gecikmeAdim;
    this.kuyruk = [];
  }

  yolla(paket, adim) {
    this.kuyruk.push({ varis: adim + this.gecikme, veri: JSON.stringify(paket) });
  }

  /** Bu adımda varmış paketleri sırayla verir. */
  al(adim) {
    const cikan = [];
    while (this.kuyruk.length && this.kuyruk[0].varis <= adim) {
      cikan.push(JSON.parse(this.kuyruk.shift().veri));
    }
    return cikan;
  }
}

/** Tohumlu rastgelelik — iki koşumu karşılaştırabilmek için. */
function tohumla() {
  let tohum = 987654321;
  Math.random = () => {
    tohum = (tohum * 1103515245 + 12345) & 0x7fffffff;
    return tohum / 0x7fffffff;
  };
}

const AYAR = { mode: 'quick', playMode: 'vs', format: 'kisa', difficulty: 'orta' };

/**
 * Sahayı ralliye sabitler.
 *
 * Oyuncu girdisi YALNIZCA ralli aşamasında işleniyor; servis
 * aşamasında motor `updatePlayers`'ı hiç çağırmıyor. Bu tuzağa daha
 * önce düşüp "girdi zinciri kopuk" diye var olmayan bir hata aramıştık.
 * Top da sabitleniyor: yere düşüp sayı olursa aşama değişir ve ölçüm
 * ortasında oyuncu girdisi kesilir.
 */
function sahayiSabitle(oyun) {
  oyun.phase = PHASE.RALLY;
  oyun.phaseTimer = 99;
  oyun.ball.x = GAME_WIDTH / 2;
  oyun.ball.y = 90;
  oyun.ball.vx = 0;
  oyun.ball.vy = 0;
}

function kendiOyuncu(oyun, yuva = 'p1') {
  return oyun.players.find((p) => p.controlSlot === yuva) ?? oyun.players[0];
}

/**
 * Oyuncunun EKRANDA göründüğü x.
 *
 * `player.x` değil: uzlaştırma düzeltmesi çizim sırasında yediriliyor,
 * yani simülasyondaki konum ile çizilen konum bir süre farklı oluyor.
 * Ölçtüğümüz şey oyuncunun hissettiği gecikme olduğuna göre bakılacak
 * sayı da ekrandaki. Çizim kodunun okuduğu fonksiyonun aynısı
 * çağrılıyor — ayrı hesaplasak sıçramayı ölçemezdik.
 */
function cizimX(oyun, player) {
  return player.x + (oyun.agCizimKaydirma(player)?.x ?? 0);
}

function olc(gecikmeMs) {
  tohumla();
  const gecikmeAdim = Math.round(gecikmeMs / MS);

  const yukari = new Kanal(gecikmeAdim); // istemci → sunucu (girdi)
  const asagi = new Kanal(gecikmeAdim); // sunucu → istemci (durum)

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
    // Sunucunun KESİNLEŞMİŞ ayarı — rastgele rakip iki tarafta farklı
    // çıkmasın diye motorun seçtiğini alıyoruz, isteneni değil.
    opponentId: sunucu.opponent.id,
    homeIds: [...sunucu.homeIds],
    bassiz: true,
    agRol: 'misafir',
    agYuvam: 'p1',
    /*
     * TAHMIN=0 ile tahmin katmanı kapanıyor. Ölçüm aracının kendisini
     * doğrulamak için: düzeltmenin gerçekten tahmindan geldiğini ancak
     * kapalıyken eski sayıların geri gelmesini görerek biliyoruz.
     */
    agTahmin: process.env.TAHMIN !== '0',
    agGonder: (paket) => yukari.yolla(paket, adim),
  });
  istemci.start();

  const benSunucu = kendiOyuncu(sunucu);
  const benIstemci = kendiOyuncu(istemci);

  /* Adım adım izler — hata, gidiş yolu kadar kaydırılarak sonda hesaplanıyor. */
  const istemciIz = [];
  const sunucuIz = [];
  let tepkiAdim = null;
  let sicrama = 0;
  let oncekiX = null;
  let basisX = null;

  for (adim = 0; adim < ADIM; adim += 1) {
    // 1) Varan paketler
    yukari.al(adim).forEach((paket) => sunucu.agPaketAl(paket, 'p1'));
    asagi.al(adim).forEach((paket) => istemci.agPaketAl(paket, 'p2'));

    // 2) Tuş: BASIS adımından sonra sağa doğru basılı
    if (adim === BASIS) {
      istemci.inputs.p1.right = true;
      basisX = cizimX(istemci, benIstemci);
    }

    // 3) Sunucu bir adım + akış
    sahayiSabitle(sunucu);
    sunucu.ilerlet(PHYSICS.step);
    sunucu.agAkis();

    // 4) İstemci bir adım + akış
    istemci.ilerlet(PHYSICS.step);
    istemci.agAkis();

    // 5) Ölçüm
    if (adim >= BASIS) {
      const ekranX = cizimX(istemci, benIstemci);
      if (tepkiAdim === null && Math.abs(ekranX - basisX) > 0.05) {
        tepkiAdim = adim - BASIS;
      }
      istemciIz.push(ekranX);
      sunucuIz.push(benSunucu.x);
      if (process.env.IZ && gecikmeMs === Number(process.env.IZ)) {
        console.log(
          `${adim - BASIS}\tistemci=${ekranX.toFixed(1)}\tsunucu=${benSunucu.x.toFixed(1)}\tfark=${(ekranX - benSunucu.x).toFixed(1)}`,
        );
      }
      if (oncekiX !== null) {
        // Bir adımda mümkün olanın ÜSTÜ = uzlaştırma sıçraması
        const fazla = Math.abs(ekranX - oncekiX) - AZAMI_ADIM_YOLU;
        if (fazla > sicrama) sicrama = fazla;
      }
      oncekiX = ekranX;
    }
  }

  sunucu.destroy();
  istemci.destroy();

  /*
   * Tahmin hatası: istemcinin t anında çizdiği konum, sunucunun
   * t + (tek yön gecikme) anında ürettiğiyle karşılaştırılıyor. Kayma
   * budur çünkü istemci "şu an bastığım tuş sunucuya varınca neresi
   * olacağım" sorusunu cevaplıyor; tuşun varması tam o kadar sürüyor.
   */
  const hatalar = [];
  const ongoruler = [];
  for (let i = 0; i + gecikmeAdim < istemciIz.length; i += 1) {
    hatalar.push(Math.abs(istemciIz[i] - sunucuIz[i + gecikmeAdim]));
    /*
     * Öngörü YALNIZ oyuncu hareket ederken ölçülüyor. Ölçümün ikinci
     * yarısında oyuncu saha kenarına dayanıp duruyor; duran bir
     * oyuncuda öngörü tanımı gereği sıfır ve o sıfırlar medyanı
     * yutuyordu — tahmin çalışırken "öngörü = 0" diye yanlış bir
     * sonuç okuyorduk.
     */
    if (i > 0 && Math.abs(sunucuIz[i] - sunucuIz[i - 1]) > 0.05) {
      ongoruler.push(istemciIz[i] - sunucuIz[i]);
    }
  }
  const siralaAl = (dizi, oran) => {
    const s = [...dizi].sort((a, b) => a - b);
    return s[Math.floor(s.length * oran)] ?? 0;
  };

  return {
    gecikmeMs,
    tepkiMs: tepkiAdim === null ? null : Math.round((tepkiAdim + 1) * MS),
    hataP95: Number(siralaAl(hatalar, 0.95).toFixed(1)),
    ongoru: Number(siralaAl(ongoruler, 0.5).toFixed(1)),
    sicrama: Number(Math.max(0, sicrama).toFixed(1)),
  };
}

const gercekRandom = Math.random;
const satirlar = GECIKMELER.map(olc);
Math.random = gercekRandom;

console.log('\nGECİKME TELAFİSİ ÖLÇÜMÜ');
console.log(`adım=${ADIM}  basış=${BASIS}  (1 adım = ${MS.toFixed(1)} ms)\n`);
console.log('tek yön   gidiş-dönüş   tepki     hata p95    öngörü    sıçrama');
console.log('-'.repeat(68));
for (const s of satirlar) {
  console.log(
    `${String(s.gecikmeMs).padStart(5)} ms` +
      `${String(s.gecikmeMs * 2).padStart(11)} ms` +
      `${String(s.tepkiMs ?? 'YOK').padStart(9)}${s.tepkiMs === null ? '' : ' ms'}` +
      `${String(s.hataP95).padStart(10)} px` +
      `${String(s.ongoru).padStart(9)} px` +
      `${String(s.sicrama).padStart(10)} px`,
  );
}
console.log('');
