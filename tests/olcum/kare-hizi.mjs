/**
 * KARE HIZI GECİKMEYE DÖNÜŞÜYOR MU?
 *
 * Bu ölçüm bir oyuncunun ekran görüntüsünden doğdu. Teşhis katmanı
 * (`?tani=1`) telefonunda şunu gösteriyordu:
 *
 *     kare 33ms · uzun kare %97.6 · tampon 170ms · gerilik 193ms
 *
 * Telefon 30 fps çiziyordu — ve tampon olması gerekenin (~50-70 ms)
 * üç katına çıkmıştı. İkisi bağlantısız değil: seğirme ölçümü
 * istemcinin KENDİ KARE SAATİNİ kullanıyordu (`this.time`), o saat de
 * yalnız kare başına ilerliyor. 33 ms'lik kareler paket varışlarını
 * 33 ms'lik kutulara yuvarlıyor, kod bunu ağ seğirmesi sanıyor ve
 * tamponu şişiriyordu.
 *
 * Yani DÜŞÜK KARE HIZI, koda gecikme olarak geri dönüyordu — ağda
 * hiçbir şey değişmeden.
 *
 * DÜZENEK: ağ tamamen sabit (tek yön 40 ms, sıfır ağ seğirmesi).
 * Değişen tek şey istemcinin kare hızı ve karelerin düzensizliği.
 * Çıkan her fark, ağın değil kodun ürettiği gecikmedir.
 *
 * ARACIN İNCE NOKTASI: gerçek zaman simülasyondan okunuyor
 * (`agSaat: () => adim * PHYSICS.step`) ama istemci yalnız kendi kare
 * hızında ilerliyor. Tarayıcıdaki durumun aynısı: soket olayı kareyi
 * beklemiyor, çizim bekliyor. Bu ayrım olmadan ölçüm sorusunu hiç
 * soramaz — ilk yazışta ikisini de kare saatine bağlamıştım ve
 * seğirme her hızda 0 çıkıyordu.
 *
 * ÖLÇÜLEN (düzeltmeden önce → sonra):
 *   60 fps ±%30  seğirme   6 → 8 ms · tampon  66 → 70 ms
 *   30 fps ±%30  seğirme 146 → 10 ms · tampon 200 → 77 ms
 *
 * Kullanım: npm run olcum:kare-hizi
 */
import Game from '../../src/game/Game.js';
import { PHYSICS, PHASE } from '../../src/game/constants.js';

const MS = PHYSICS.step * 1000;
/** Ağ sabit tutuluyor — değişkenimiz yalnız kare hızı. */
const AG_TEK_YON_MS = Number(process.env.GECIKME ?? 40);
const ADIM = Number(process.env.ADIM ?? 1200);

class Kanal {
  constructor(g) { this.g = g; this.k = []; }
  yolla(p, a) { this.k.push({ v: a + this.g, d: JSON.stringify(p) }); }
  al(a) { const c = []; while (this.k.length && this.k[0].v <= a) c.push(JSON.parse(this.k.shift().d)); return c; }
}

const AYAR = { mode: '1v1', playMode: 'vs', format: 'single', difficulty: 'normal' };

/**
 * @param {number} fps İstemcinin kare hızı
 * @param {number} kareSegirme Kare süresinin oransal düzensizliği (0-1)
 */
function olc(fps, kareSegirme) {
  /** Tohumlu üreteç — koşumlar karşılaştırılabilir olsun. */
  let tohum = 20260907;
  const rast = () => { tohum = (tohum * 1103515245 + 12345) & 0x7fffffff; return tohum / 0x7fffffff; };

  const gAdim = Math.round(AG_TEK_YON_MS / MS);
  const asagi = new Kanal(gAdim);
  const yukari = new Kanal(gAdim);
  let adim = 0;

  const s = new Game(null, {
    ...AYAR, bassiz: true, agRol: 'ev', agGonder: (p) => asagi.yolla(p, adim),
  });
  s.start();
  const c = new Game(null, {
    ...AYAR,
    opponentId: s.opponent.id,
    homeIds: [...s.homeIds],
    bassiz: true,
    agRol: 'misafir',
    agYuvam: 'p1',
    agGonder: (p) => yukari.yolla(p, adim),
    /*
     * GERÇEK zaman simülasyondan. İstemcinin `this.time`ı yalnız kare
     * başına ilerlerken bu saat sürekli akıyor — tarayıcıdaki durumun
     * aynısı, çünkü soket olayı kareyi beklemiyor.
     */
    agSaat: () => adim * PHYSICS.step,
  });
  c.start();

  const kareDt = 1 / fps;
  let birikim = 0;

  for (adim = 0; adim < ADIM; adim += 1) {
    yukari.al(adim).forEach((p) => s.agPaketAl(p, 'p1'));
    s.phase = PHASE.RALLY;
    s.phaseTimer = 99;
    s.ilerlet(PHYSICS.step);
    s.agAkis();

    /*
     * İSTEMCİ YALNIZ KENDİ KARE HIZINDA ilerliyor ve kareler DÜZENSİZ.
     * Düzenli kareyle ölçtüğümde seğirme her hızda 0 çıkıyordu; gerçek
     * telefonun kareleri eşit aralıklı değil ve etki oradan geliyor.
     */
    birikim += PHYSICS.step;
    const hedefDt = kareSegirme ? kareDt * (1 + (rast() * 2 - 1) * kareSegirme) : kareDt;
    if (birikim >= hedefDt - 1e-9) {
      asagi.al(adim).forEach((p) => c.agPaketAl(p, 'p2'));
      c.ilerlet(birikim);
      c.agAkis();
      birikim = 0;
    }
  }

  const t = c.agTaniOzeti();
  return { segirme: t.segirme, tampon: t.tampon, gerilik: t.gerilik };
}

console.log('\nKARE HIZI GECİKMEYE DÖNÜŞÜYOR MU?\n');
console.log(`Ağ SABİT: tek yön ${AG_TEK_YON_MS} ms, sıfır ağ seğirmesi.`);
console.log('Değişen tek şey istemcinin kare hızı — çıkan fark kodun ürettiği gecikme.\n');
console.log(' fps | kare düzensizliği | ÖLÇÜLEN seğirme | tampon | gerilik');
console.log('-'.repeat(66));

for (const [fps, ks] of [[60, 0], [60, 0.3], [30, 0], [30, 0.3], [30, 0.5], [20, 0.3]]) {
  const r = olc(fps, ks);
  console.log(
    `${String(fps).padStart(4)} | ${`±%${Math.round(ks * 100)}`.padStart(17)}`
    + ` | ${`${r.segirme} ms`.padStart(15)}`
    + ` | ${`${r.tampon} ms`.padStart(6)}`
    + ` | ${`${r.gerilik} ms`.padStart(7)}`,
  );
}

console.log(`
OKUMA: "ölçülen seğirme" sütunu ağda OLMAYAN bir seğirmedir — ağ bu
tablonun tamamında sabit. Sıfıra yakın olmalı; büyükse kod, istemcinin
kendi kare düzensizliğini ağ sorunu sanıyor ve tamponu (yani gecikmeyi)
karşılıksız büyütüyor demektir.

Bu, gerçek bir oyuncunun ekran görüntüsüyle bulundu: telefonu 30 fps
çiziyordu ve tampon 170 ms'e çıkmıştı. Varış saati kare döngüsünden
ayrıldıktan sonra aynı koşulda 77 ms.`);
