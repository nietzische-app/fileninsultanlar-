/**
 * HİSSEDİLEN GECİKME — rakip kıpırdadıktan kaç ms sonra ekranımda kıpırdıyor?
 *
 * Bu dosya bir kullanıcı bildiriminden doğdu: "bence ping gözüktüğünden
 * çok daha yüksek, bu şekilde oynanılacak vaziyette değil". Ping
 * göstergesi bir önceki ölçümle (olcum:ping) doğrulanmıştı — sapması
 * ±2 adım ve sistematik değil. Yani gösterge doğruydu AMA kullanıcı da
 * haklıydı: gösterge oyuncunun HİSSETTİĞİ şeyi ölçmüyor.
 *
 * GÖSTERGE NEYİ ÖLÇÜYOR: kendi girdimin sunucuya gidip onayının geri
 * gelmesi (gidiş-dönüş). Bu, tahmin penceresi için doğru sayı.
 *
 * OYUNCU NEYİ HİSSEDİYOR: rakibin ve topun ekranda ne kadar geç
 * göründüğünü. O yol daha uzun ve göstergenin ölçtüğü şeyi İÇERMİYOR:
 *
 *   sunucuda olay → anlık görüntü kuyruğu (1/durumHz)
 *                 → ağ (tek yön)
 *                 → ara değerleme tamponu (agTamponBoyu)
 *                 → ekran
 *
 * Ölçüm, rakibi SUNUCUDA bilinen bir adımda yürütüp istemcinin ÇİZDİĞİ
 * rakibin kaç ms sonra kıpırdadığına bakıyor. Ağ gecikmesi sıfırken
 * bile kalan bir taban var — asıl bulgu o.
 *
 * İLK KOŞUM (20 Hz durum, sabit 100 ms tampon):
 *     ağ 0ms → 117ms      ağ  67ms → 133ms
 *     ağ 100ms → 150ms    ağ 200ms → 200ms
 *
 * SONRASI (30 Hz durum, seğirmeye göre uyarlanan tampon):
 *     ağ 0ms →  67ms      ağ  67ms →  83ms
 *     ağ 100ms → 100ms    ağ 200ms → 150ms
 *
 * Yani ağda hiçbir şey değişmeden hissedilen gecikme yarıya indi.
 * Bedeli bant genişliği (%49, bkz. olcum:kapasite); akıcılıkta kayıp
 * yok, tersine iyileşme var (olcum:akicilik, dalgalanma 0.12-0.14 →
 * 0.07-0.08, duraklama %0).
 *
 * Yol boyunca üçüncü bir arıza da bu ölçümle çıktı: gönderme kapısı
 * süre karşılaştırdığı için 30 Hz ayarı GERÇEKTE 22.5 Hz'di ve
 * aralıklar düzensizdi (bkz. `agAkis`).
 *
 * Kullanım: npm run olcum:hissedilen
 */
import Game from '../../src/game/Game.js';
import { PHYSICS } from '../../src/game/constants.js';

const MS = PHYSICS.step * 1000;
const KIPIRTI = 1.5; // px — ölçüm eşiği; ara değerleme kesirli piksel yazıyor

class Kanal {
  constructor(g) { this.g = g; this.k = []; }
  yolla(p, a) { this.k.push({ v: a + this.g, d: JSON.stringify(p) }); }
  al(a) { const c = []; while (this.k.length && this.k[0].v <= a) c.push(JSON.parse(this.k.shift().d)); return c; }
}

const AYAR = { mode: 'quick', playMode: 'vs', format: 'kisa', difficulty: 'orta' };
const BASLA = 120; // rakibin yürümeye başladığı adım — tampon dolsun diye geç

/** @param {number} tekYonMs Enjekte edilecek TEK YÖN gecikme */
function olc(tekYonMs) {
  const gAdim = Math.round(tekYonMs / MS);
  const yukari = new Kanal(gAdim);
  const asagi = new Kanal(gAdim);
  let adim = 0;

  const sunucu = new Game(null, {
    ...AYAR, bassiz: true, agRol: 'ev', agGonder: (p) => asagi.yolla(p, adim),
  });
  sunucu.start();
  const istemci = new Game(null, {
    ...AYAR,
    opponentId: sunucu.opponent.id,
    homeIds: [...sunucu.homeIds],
    bassiz: true,
    agRol: 'misafir',
    agYuvam: 'p1',
    agGonder: (p) => yukari.yolla(p, adim),
  });
  istemci.start();

  const rakipI = istemci.players.find((p) => p.controlSlot === 'p2');
  let baslangicX = null;
  let ekranaGeldi = null;

  for (adim = 0; adim < BASLA + 120; adim += 1) {
    yukari.al(adim).forEach((p) => sunucu.agPaketAl(p, 'p1'));
    asagi.al(adim).forEach((p) => istemci.agPaketAl(p, 'p2'));

    // Maçı ralli aşamasında tut — servis akışı ölçümü bulandırmasın
    sunucu.phase = 'rally'; sunucu.phaseTimer = 99;

    if (adim === BASLA) {
      baslangicX = rakipI.x;
      sunucu.inputs.p2.right = true; // RAKİP SUNUCUDA tam bu adımda yürüdü
    }

    sunucu.ilerlet(PHYSICS.step); sunucu.agAkis();
    istemci.ilerlet(PHYSICS.step); istemci.agAkis();

    if (adim > BASLA && ekranaGeldi === null
      && baslangicX !== null && Math.abs(rakipI.x - baslangicX) > KIPIRTI) {
      ekranaGeldi = (adim - BASLA) * MS;
    }
  }

  return {
    gercekRtt: Math.round(gAdim * MS * 2),
    gosterge: istemci.agGidisDonus(),
    ekran: ekranaGeldi === null ? null : Math.round(ekranaGeldi),
  };
}

console.log('HİSSEDİLEN GECİKME — rakip sunucuda yürüdü, ekranımda kaç ms sonra yürüdü?\n');
console.log('ağ RTT | GÖSTERGE | rakip ekranıma kaç ms sonra geliyor');
console.log('-'.repeat(60));
const satirlar = [];
for (const t of [0, 33, 50, 100]) {
  const r = olc(t);
  satirlar.push(r);
  console.log(
    String(r.gercekRtt).padStart(5) + 'ms | '
    + String(r.gosterge ?? '?').padStart(6) + 'ms | '
    + String(r.ekran ?? 'GÖRÜNMEDİ').padStart(6) + 'ms',
  );
}

const taban = satirlar[0];
console.log(`
TABAN: ağda 0 ms gecikme varken bile rakip ekrana ${taban.ekran} ms geç geliyor.
Bu sayının ağla ilgisi yok; iki bileşenden oluşuyor:
  · ara değerleme tamponu (agTamponBoyu) — seğirmeyi yutmak için bilerek eklenen
  · anlık görüntü kuyruğu (1/AG.durumHz) — sunucu ne sıklıkta paket yolluyor
Ağ gecikmesi bu tabanın ÜSTÜNE biniyor.

Göstergenin bunu göstermemesi hata değil: gösterge kendi girdimin
gidiş-dönüşünü ölçüyor ve tahmin penceresi için doğru sayı o. Ama
oyuncunun "ping çok yüksek" dediği şey bu sütun.`);
