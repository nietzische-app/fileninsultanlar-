/**
 * YÜKSEK TAZELEME HIZLI EKRANDA AKICILIK — kim düzgün akıyor, kim değil?
 *
 * Bu ölçüm bir gözlemden doğdu: aynı maçta iPhone (120 Hz ProMotion)
 * kusursuz akıcı görünürken PC'de aynı his yoktu. İlk açıklamam
 * "iPhone 120 Hz, PC 60 Hz, tabii ki daha akıcı" idi ama bu tembel bir
 * cevap — kodda bunu ÜRETEN bir asimetri olabilir.
 *
 * ŞÜPHE: `agAradegerle` (rakip ve top) artık KARE BAŞINA çalışıyor,
 * yani ekran kaç Hz ise o kadar. Ama `agTahminAdimla` (KENDİ
 * oyuncumuz) hâlâ sabit adım döngüsünün İÇİNDE, yani saniyede 60 kez.
 *
 * 60 Hz ekranda ikisi aynı: her karede tam bir adım atılıyor.
 * 144 Hz ekranda değil: kendi oyuncumuz karelerin ancak %42'sinde
 * kıpırdıyor, rakip ve top her karede. Yani kontrol ettiğin şey —
 * en çok baktığın şey — diğer her şeyden daha kesikli akıyor.
 *
 * ÖLÇÜM SİNYALİ: sabit hız. Kendi oyuncumuz sağa basılı tutuyor, rakip
 * sunucuda sabit hızla yürüyor. Kusursuz bir çizimde kare başına giden
 * yol DEĞİŞMEZ; ölçülen her dalgalanma doğrudan kodun kusuru.
 *
 * ÇİZİLEN konum okunuyor, `player.x` değil: kendi oyuncumuzda
 * uzlaştırma farkı `agCizimKaydirma` ile ekrana yediriliyor ve ekranda
 * görünen şey o toplam. Ham `x`e bakan bir ölçüm, oyuncunun gördüğü
 * kesikliliği ıskalardı.
 *
 * Kullanım: npm run olcum:ekran-hizi
 */
import Game from '../../src/game/Game.js';
import { PHYSICS, PHASE } from '../../src/game/constants.js';

/** Ölçüm uzunluğu (sn). */
const SURE = 12;
/** Duvar saati çözünürlüğü (sn). */
const TIK = 0.0005;
/** Tek yön ağ gecikmesi (sn). */
const YOL = 0.04;

const AYAR = { mode: 'quick', playMode: 'vs', format: 'kisa', difficulty: 'orta' };

class Kanal {
  constructor(taban) { this.taban = taban; this.k = []; }

  yolla(p, saat) { this.k.push({ v: saat + this.taban, d: JSON.stringify(p) }); }

  al(saat) {
    const c = [];
    while (this.k.length && this.k[0].v <= saat) c.push(JSON.parse(this.k.shift().d));
    return c;
  }
}

/**
 * Bir dizi çizim konumundan akıcılık ölçütleri çıkarır.
 *
 * @param {number[]} konumlar Kare kare çizilen x
 */
function akicilik(konumlar) {
  const yollar = [];
  for (let i = 1; i < konumlar.length; i += 1) {
    // `null` = dönüş penceresi; o aralığı atla, iki yanını birleştirme
    if (konumlar[i] === null || konumlar[i - 1] === null) continue;
    yollar.push(Math.abs(konumlar[i] - konumlar[i - 1]));
  }
  const hareketli = yollar.filter((y) => y > 0.001);
  if (!hareketli.length) return { dalgalanma: 0, duraklama: 100, ort: 0 };
  const ort = yollar.reduce((a, b) => a + b, 0) / yollar.length;
  const varyans = yollar.reduce((a, b) => a + (b - ort) ** 2, 0) / yollar.length;
  return {
    dalgalanma: Math.sqrt(varyans) / (ort || 1),
    // "Duraklama": hareket sürerken neredeyse hiç yol alınmayan kareler
    duraklama: (yollar.filter((y) => y < ort * 0.15).length / yollar.length) * 100,
    ort,
  };
}

/** @param {number} ekranHz İstemcinin ekran tazeleme hızı */
function olc(ekranHz) {
  const yukari = new Kanal(YOL);
  const asagi = new Kanal(YOL);
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

  const ben = g.players.find((p) => p.controlSlot === 'p1');
  const rakip = g.players.find((p) => p.controlSlot !== 'p1');

  let sonrakiTik = 0;
  let sonrakiKare = 0;
  /*
   * DÖNÜŞ ANLARI ÖLÇÜMÜN DIŞINDA. Yön değiştiren oyuncu gerçekten
   * yavaşlayıp duruyor ve bu kesiklik DEĞİL, fiziğin kendisi. İlk
   * halinde dönüşler ölçüme giriyordu ve rakip sütunu %0'dan %20'ye
   * fırlıyordu — yani araç, sınamak istediği şeyi değil hareketin
   * kendisini ölçüyordu. Yalnız SABİT HIZLI bölümler sayılıyor.
   */
  let sonDonusBen = 0;
  let sonDonusRakip = 0;
  let oncekiSagBen = true;
  let oncekiSagRakip = true;
  let oncekiSagBen2 = true;
  let oncekiSagRakip2 = true;
  /*
   * Dönüşten sonra atlanan süre. Bant 240 px, yani bir bacak ~0.64 sn;
   * 0.2 sn atlayınca ölçülecek 0.44 sn kalıyor.
   */
  const DONUS_PAYI = 0.2; // sn
  const kareSuresi = 1 / ekranHz;
  const benimKonum = [];
  const rakipKonum = [];

  for (let n = 0; n * TIK < SURE; n += 1) {
    saat = n * TIK;

    if (saat >= sonrakiTik) {
      yukari.al(saat).forEach((p) => sunucu.agPaketAl(p, 'p1'));
      sunucu.phase = PHASE.RALLY; sunucu.phaseTimer = 99;
      /*
       * Rakip SUNUCUDA sabit hızla gidip geliyor. İlk yazışta sağa
       * basılı tutuyordum ve oyuncu bir saniyede duvara dayanıyordu:
       * örnekleme başladığında herkes SABİTTİ ve ölçüm bütün ekran
       * hızlarında "dalgalanma 0, duraklama %100" diyordu — yani hiçbir
       * şey ölçmüyordu. Bant, dönüşleri seyrek tutacak kadar geniş.
       */
      /*
       * DÖNÜŞ KONUMA GÖRE, ZAMANA GÖRE DEĞİL. Zamana göre denedim ve
       * oyuncular duvara dayanıp orada bekliyordu: yürüme hızı 376
       * px/sn, oyuncunun bandı 370 px — yani yarım saniyede duvarı
       * buluyor. Duvarda geçen kareler "duraklama" olarak sayılıyor ve
       * rakip sütunu %0'dan %25'e fırlıyordu.
       */
      const r2 = sunucu.players.find((pp) => pp.controlSlot === 'p2');
      if (r2.x > 800) oncekiSagRakip = false;
      else if (r2.x < 510) oncekiSagRakip = true;
      const sag = oncekiSagRakip ?? true;
      if (sag !== oncekiSagRakip2) sonDonusRakip = saat;
      oncekiSagRakip2 = sag;
      oncekiSagRakip = sag;
      sunucu.inputs.p2.right = sag;
      sunucu.inputs.p2.left = !sag;
      sunucu.ilerlet(PHYSICS.step);
      sunucu.agAkis();
      sonrakiTik += PHYSICS.step;
    }

    if (saat >= sonrakiKare) {
      asagi.al(saat).forEach((p) => g.agPaketAl(p, 'p2'));
      g.phase = PHASE.RALLY; g.phaseTimer = 99;
      /*
       * YÖN ZAMANA GÖRE, KONUMA GÖRE DEĞİL.
       *
       * Önce konuma göre çeviriyordum ve ölçüm bozuluyordu: dönüş
       * kararı istemcinin TAHMİN ETTİĞİ x'e bakıyor, sunucu ise kendi
       * x'ine — ikisi bir tahmin penceresi kadar farklı. Sonuç, her
       * dönüşte 10 px'lik uzlaştırma düzeltmeleri ve dalgalanmanın
       * çoğunun oradan gelmesiydi. İnsan da tuşa zamana göre basar.
       */
      if (ben.x > 360) oncekiSagBen = false;
      else if (ben.x < 120) oncekiSagBen = true;
      const sagBen = oncekiSagBen ?? true;
      if (sagBen !== oncekiSagBen2) sonDonusBen = saat;
      oncekiSagBen2 = sagBen;
      oncekiSagBen = sagBen;
      g.inputs.p1.right = sagBen;
      g.inputs.p1.left = !sagBen;
      g.ilerlet(kareSuresi);
      g.agAkis();
      sonrakiKare = saat + kareSuresi;

      if (saat > 3) {
        /*
         * ÇİZİLEN konum: ham x + uzlaştırmanın ekrana yedirilen farkı.
         * Dizilere `null` konuyor ki dönüş boşlukları ARDIŞIK
         * sayılmasın — yoksa dönüşün iki yanı tek bir dev adım gibi
         * görünür ve dalgalanmayı şişirir.
         */
        benimKonum.push(saat - sonDonusBen > DONUS_PAYI
          ? ben.x + (g.agCizimKaydirma(ben)?.x ?? 0) : null);
        rakipKonum.push(saat - sonDonusRakip > DONUS_PAYI ? rakip.x : null);
      }
    }
  }

  return { benim: akicilik(benimKonum), rakip: akicilik(rakipKonum), kare: benimKonum.length };
}

console.log('\nEKRAN TAZELEME HIZI — kendi oyuncum ve rakip aynı akıcılıkta mı?\n');
console.log('Ağ her satırda aynı. Değişen tek şey istemcinin ekran hızı.');
console.log('dalgalanma 0 = kusursuz düz akış. duraklama = kıpırdamayan kare oranı.\n');
console.log('ekran      KENDİ OYUNCUM              RAKİP');
console.log('  Hz    dalgalanma  duraklama    dalgalanma  duraklama');
console.log('-'.repeat(56));

const sonuc = {};
let gecersiz = false;
[60, 75, 90, 120, 144].forEach((hz) => {
  const r = olc(hz);
  sonuc[hz] = r;
  /*
   * ARACIN DOĞRULAMASI: kimse yürümediyse bütün sayılar sahte.
   * İlk koşumda tam bu oldu ve tablo "her ekran hızında kusursuz"
   * diyordu — oysa oyuncular duvara dayanmış, hiç kıpırdamıyordu.
   */
  if (r.benim.ort < 0.5 || r.rakip.ort < 0.5) {
    gecersiz = true;
    console.log(`  !! ${hz} Hz: hareket yok (benim ${r.benim.ort.toFixed(2)} px/kare, `
      + `rakip ${r.rakip.ort.toFixed(2)} px/kare) — ÖLÇÜM GEÇERSİZ`);
  }
  console.log(
    `${String(hz).padStart(4)}  ${r.benim.dalgalanma.toFixed(2).padStart(9)} ${
      `%${r.benim.duraklama.toFixed(0)}`.padStart(10)}   ${
      r.rakip.dalgalanma.toFixed(2).padStart(10)} ${
      `%${r.rakip.duraklama.toFixed(0)}`.padStart(10)}`,
  );
});

if (gecersiz) {
  console.log('\nEN AZ BİR SATIRDA HAREKET YOKTU — yukarıdaki sayılara güvenme.');
  process.exit(1);
}

console.log(`
OKUMA: iki sütun birbirine yakın olmalı. "Kendi oyuncum" sütunu ekran
hızı arttıkça bozuluyorsa, tahmin sabit 60 Hz adımda kalırken ara
değerleme kare hızında çalışıyor demektir — yani 120/144 Hz ekranda
kontrol ettiğin şey, sahnenin geri kalanından daha kesikli akar.

60 Hz'de fark görünmez (her karede tam bir adım atılıyor); bu yüzden
masaüstü tarayıcıyla yapılan sınamalar bunu yakalamaz.`);
