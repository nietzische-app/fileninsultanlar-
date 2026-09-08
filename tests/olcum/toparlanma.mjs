/**
 * ÇİZİM SAATİ GERİ KALIYOR MU? — kare hızının ekran gecikmesine etkisi.
 *
 * Bu ölçüm bir teşhis kaydından doğdu. 40 saniyelik bir maçta katman
 * şunu gösterdi:
 *
 *     00:34 → ping 158ms · seğirme 76ms · GERİLİK 323ms
 *
 * 323 ms'i anlamlı kılan şey, tamponun TAVANININ 200 ms olması
 * (`AG.tamponAzami`). Yani ekran, tamponun izin verdiğinden 120 ms
 * daha geride çiziliyordu ve tampon o farkı AÇIKLAYAMAZ.
 *
 * İLK ŞÜPHE YANLIŞ ÇIKTI. Tökezlemeden sonra toparlanmanın sürdüğünü
 * sanmıştım (hizalama eşiği tampona oranlı olduğu için). Ölçtüm:
 * 133 ms'lik bir tökezlemenin bıraktığı fazlalık 46 ms ve 33 ms'de
 * kapanıyor. Sebep o değil.
 *
 * İKİNCİ ŞÜPHE — ve kaydın asıl ipucu: aynı ekranda `kare 33 ms`,
 * `uzun kare %97.6` yazıyordu. `PHYSICS.maxCatchUp` tam olarak 1/30,
 * yani 33.3 ms. O cihazda neredeyse HER kare kırpma sınırında ya da
 * üstünde ve sınırın üstündeki gerçek zaman ATILIYOR.
 *
 * Çizim saati (`agCizimSaati`) o kırpılmış zamanla yürüyor, sunucunun
 * damgaları ise gerçek zamanla. Yani saat sunucudan yavaş akıyor,
 * geride kalıyor, ve kare başına %5'lik yumuşak çekiş onu geri
 * getirmiyor — bir DENGE HATASINDA tutuyor. Fizik için kırpma doğru
 * (yoksa sekmeden dönünce top fileden geçer); ara değerleme saati için
 * karşılıksız gecikme.
 *
 * ÖLÇÜLEN ŞEY: `gerilik - tampon`, yani ekranın tamponla açıklanamayan
 * gecikmesi — farklı kare hızı profillerinde.
 *
 * Kullanım: npm run olcum:toparlanma
 */
import Game from '../../src/game/Game.js';
import { PHYSICS } from '../../src/game/constants.js';

const MS = PHYSICS.step * 1000;

/** Taban tek yön gecikme (sn). */
const TABAN = 0.05;
/** Ölçümün uzunluğu (sn). */
const SURE = 20;
/** Duvar saatinin çözünürlüğü (sn) — hem sunucuyu hem kareleri sürüyor. */
const TIK = 0.001;

const AYAR = { mode: 'quick', playMode: 'vs', format: 'kisa', difficulty: 'orta' };

/** Gecikmeli kanal — varış DUVAR SAATİNDE. */
class Kanal {
  constructor(taban) { this.taban = taban; this.k = []; }

  yolla(paket, saat, segirme = 0) {
    this.k.push({ v: saat + this.taban + segirme, d: JSON.stringify(paket) });
  }

  al(saat) {
    const c = [];
    while (this.k.length && this.k[0].v <= saat) c.push(JSON.parse(this.k.shift().d));
    return c;
  }
}

/**
 * KARE PROFİLLERİ — cihazın bir kareyi çizmesi kaç sn sürüyor.
 *
 * Hepsi GERÇEK zaman üretiyor; motorun içindeki kırpma bu zamanın ne
 * kadarını görebildiğine karar veriyor. Ölçmek istediğimiz tam olarak
 * o fark.
 */
const PROFIL = {
  '60 fps düzgün': () => 1 / 60,
  '30 fps düzgün': () => 1 / 30,
  '30 fps titrek': (r) => (1 / 30) + (r() * 2 - 1) * 0.008,
  '30 fps + takılma': (r) => (r() < 0.1 ? 0.09 : 1 / 30),
};

function olc(profilAdi) {
  let tohum = 20260908;
  const rast = () => { tohum = (tohum * 1103515245 + 12345) & 0x7fffffff; return tohum / 0x7fffffff; };
  const kareSuresi = PROFIL[profilAdi];

  const yukari = new Kanal(TABAN);
  const asagi = new Kanal(TABAN);
  let saat = 0;

  const sunucu = new Game(null, {
    ...AYAR,
    bassiz: true,
    agRol: 'ev',
    // ±4 ms varış oynaması — tampon tabana çakılı kalmasın, gerçek gibi
    agGonder: (p) => asagi.yolla(p, saat, (rast() * 2 - 1) * 0.004),
  });
  sunucu.start();
  const istemci = new Game(null, {
    ...AYAR,
    opponentId: sunucu.opponent.id,
    homeIds: [...sunucu.homeIds],
    bassiz: true,
    agRol: 'misafir',
    agYuvam: 'p1',
    agGonder: (p) => yukari.yolla(p, saat),
    // Varış saati DUVAR saatinden — motorun kendi kırpılmış zamanından değil
    agSaat: () => saat,
  });
  istemci.start();

  let sonrakiSunucuTik = 0;
  let sonrakiKare = 0;
  let sonKare = 0;
  let kareAdet = 0;
  const seyir = [];

  for (let n = 0; n * TIK < SURE; n += 1) {
    saat = n * TIK;

    // --- SUNUCU: 60 Hz, kırpmadan etkilenmiyor ---
    if (saat >= sonrakiSunucuTik) {
      yukari.al(saat).forEach((p) => sunucu.agPaketAl(p, 'p1'));
      sunucu.phase = 'rally'; sunucu.phaseTimer = 99;
      sunucu.inputs.p2.right = (Math.floor(saat * 2) % 2) === 0;
      sunucu.ilerlet(PHYSICS.step);
      sunucu.agAkis();
      sonrakiSunucuTik += PHYSICS.step;
    }

    // --- İSTEMCİ: kendi kare hızında ---
    if (saat >= sonrakiKare) {
      asagi.al(saat).forEach((p) => istemci.agPaketAl(p, 'p2'));
      const gercek = saat - sonKare;
      sonKare = saat;
      istemci.ilerlet(gercek);
      istemci.agAkis();
      kareAdet += 1;
      sonrakiKare = saat + kareSuresi(rast);

      const t = istemci.agTaniOzeti();
      if (t.gerilik !== null && saat > 5) {
        seyir.push({
          saat, tampon: t.tampon, gerilik: t.gerilik, fazla: t.gerilik - t.tampon, ping: t.ping,
        });
      }
    }
  }

  const ort = (f) => Math.round(seyir.reduce((a, s) => a + f(s), 0) / seyir.length);
  return {
    kareAdet,
    gercekFps: Math.round(kareAdet / SURE),
    tampon: ort((s) => s.tampon),
    gerilik: ort((s) => s.gerilik),
    fazla: ort((s) => s.fazla),
    enFazla: Math.max(...seyir.map((s) => s.fazla)),
    ping: ort((s) => s.ping ?? 0),
  };
}

console.log('\nÇİZİM SAATİ — kare hızı ekran gecikmesini etkiliyor mu?\n');
console.log('Ağ HER SATIRDA AYNI: 50 ms tek yön, ±4 ms seğirme. Değişen tek');
console.log('şey istemcinin kare hızı. Ağ aynıysa "fazla" da aynı olmalı.\n');
console.log('kare profili        fps   tampon  gerilik   FAZLA  en fazla   ping');
console.log('-'.repeat(68));

const sonuc = {};
Object.keys(PROFIL).forEach((ad) => {
  const r = olc(ad);
  sonuc[ad] = r;
  console.log(
    `${ad.padEnd(20)}${String(r.gercekFps).padStart(3)}   ${
      String(r.tampon).padStart(5)}ms  ${String(r.gerilik).padStart(6)}ms ${
      String(r.fazla).padStart(6)}ms ${String(r.enFazla).padStart(8)}ms ${
      String(r.ping).padStart(5)}ms`,
  );
});

const taban = sonuc['60 fps düzgün'].fazla;
const enKotu = Math.max(...Object.values(sonuc).map((r) => r.fazla));
console.log(`
OKUMA: "FAZLA" = gerilik - tampon, yani ekranın TAMPONUN İZİN
VERDİĞİNDEN ne kadar geride olduğu. Tamponun karşılığı var (seğirmeyi
yutuyor); bu farkın yok.

Ağ dört satırda da birebir aynı. Sayı satırdan satıra büyüyorsa
gecikmeyi üreten şey AĞ DEĞİL, cihazın kare hızı: \`PHYSICS.maxCatchUp\`
(${Math.round((1 / 30) * 1000)} ms) uzun karelerdeki gerçek zamanı atıyor ve çizim saati
sunucudan yavaş akıyor.

60 fps tabanı ${taban} ms, en kötü profil ${enKotu} ms.`);
