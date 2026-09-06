/**
 * PING GÖSTERGESİNİN DOĞRULUĞU.
 *
 * Bu dosya bir kullanıcı bildiriminden doğdu: "online oynarken 2ms
 * yazıyor ama inandırıcı değil". Haklıydı — Türkiye'den Almanya'ya
 * 2 ms fiziksel olarak mümkün değil.
 *
 * Sebep: gösterge `clientNow - damga - sunucuBekleme` hesaplıyordu.
 * O çıkarma TAHMİN için doğru (sunucu o süreyi zaten ilerletmiş) ama
 * oyuncunun HİSSETTİĞİ gecikme beklemeyi içeriyor. Sunucu 20 Hz
 * gönderdiği için kuyruk ortalama ~34 ms ve göstergeden tam o kadar
 * eksiliyordu: gerçek gidiş-dönüşü 36 ms olan biri ekranda 2 ms
 * görüyordu.
 *
 * Düzeltmeden önce (sistematik EKSİK):
 *   gerçek  50ms → 33ms      gerçek 100ms →  67ms
 *   gerçek 200ms → 166ms     gerçek 300ms → 266ms
 *
 * Sonra (sapma ±2 adım, sistematik değil):
 *   gerçek  67ms → 100ms     gerçek 100ms → 117ms
 *   gerçek 200ms → 233ms     gerçek 400ms → 400ms
 *
 * ARACIN KENDİSİ de bir kez yanılttı: `gecikmeAdim` yuvarlandığı için
 * "50 ms" derken aslında 67 ms enjekte ediyordum ve aradaki farkı kodun
 * hatası sanıyordum. Artık gerçekte enjekte edilen değer yazdırılıyor.
 *
 * Kullanım: npm run olcum:ping
 */
import Game from '../../src/game/Game.js';
import { PHYSICS } from '../../src/game/constants.js';

const MS = PHYSICS.step * 1000;
class Kanal {
  constructor(g) { this.g = g; this.k = []; }
  yolla(p, a) { this.k.push({ v: a + this.g, d: JSON.stringify(p) }); }
  al(a) { const c = []; while (this.k.length && this.k[0].v <= a) c.push(JSON.parse(this.k.shift().d)); return c; }
}
const AYAR = { mode: 'quick', playMode: 'vs', format: 'kisa', difficulty: 'orta' };

function olc(tekYonMs) {
  const gAdim = Math.round(tekYonMs / MS);
  const yukari = new Kanal(gAdim), asagi = new Kanal(gAdim);
  let adim = 0;
  const sunucu = new Game(null, { ...AYAR, bassiz: true, agRol: 'ev', agGonder: (p) => asagi.yolla(p, adim) });
  sunucu.start();
  const istemci = new Game(null, {
    ...AYAR, opponentId: sunucu.opponent.id, homeIds: [...sunucu.homeIds],
    bassiz: true, agRol: 'misafir', agYuvam: 'p1', agGonder: (p) => yukari.yolla(p, adim),
  });
  istemci.start();
  const ben = istemci.players.find((p) => p.controlSlot === 'p1');
  for (adim = 0; adim < 400; adim += 1) {
    yukari.al(adim).forEach((p) => sunucu.agPaketAl(p, 'p1'));
    asagi.al(adim).forEach((p) => istemci.agPaketAl(p, 'p2'));
    // Tuşu ara sıra değiştir — girdi akışı sürsün
    if (adim % 40 === 0) istemci.inputs.p1.right = !istemci.inputs.p1.right;
    sunucu.phase = 'rally'; sunucu.phaseTimer = 99;
    sunucu.ilerlet(PHYSICS.step); sunucu.agAkis();
    istemci.ilerlet(PHYSICS.step); istemci.agAkis();
  }
  // GERÇEK enjekte edilen gecikme: adım sayısı yuvarlandığı için
  // istenen değerle aynı değil. İlk koşumda "50ms" derken aslında
  // 67ms enjekte ediyordum ve sapmayı koda yazıyordum.
  return { gercekRtt: Math.round(gAdim * MS * 2), gosterilen: istemci.agGidisDonus() };
}

console.log('PING GÖSTERGESİ — yapay gecikme biliniyor, gösterge onu göstermeli\n');
console.log('gerçek RTT | gösterilen | fark');
console.log('-'.repeat(40));
const farklar = [];
for (const t of [0, 17, 33, 50, 83, 100, 150, 200]) {
  const r = olc(t);
  const fark = r.gosterilen === null ? null : (r.gosterilen - r.gercekRtt);
  if (fark !== null) farklar.push(fark);
  console.log(
    String(r.gercekRtt).padStart(9) + 'ms | '
    + String(r.gosterilen).padStart(9) + 'ms | '
    + String(fark ?? '?').padStart(5),
  );
}
const ortalama = farklar.reduce((a, b) => a + b, 0) / farklar.length;
console.log(
  `\nortalama sapma: ${ortalama.toFixed(1)} ms  ·  en büyük: ${Math.max(...farklar.map(Math.abs))} ms`,
);
console.log(
  'Sapmanın SİSTEMATİK olmaması önemli: hep aynı yöne kayan bir gösterge'
  + '\ngüvenilmez olur. Kalan salınım adım kuantizasyonu (60 Hz döngü,'
  + '\n30 Hz anlık görüntü).',
);
