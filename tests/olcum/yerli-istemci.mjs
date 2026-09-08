/**
 * TARAYICISIZ İSTEMCİ — "sorun tarayıcıda mı?" sorusunun deneyi.
 *
 * Bir oyuncu ısrarla şunu düşündü: "bu sorunları tarayıcı dışında bir
 * platformda denesem çözülecek gibi." Tartışmak yerine ölçmenin yolu,
 * AYNI motoru tarayıcı olmadan koşturup aynı sayıları okumak.
 *
 * Bu istemci gerçek röleye gerçek WebSocket ile bağlanıyor, gerçek
 * `Game`i misafir rolünde çalıştırıyor ve teşhis katmanının okuduğu
 * sayıların aynısını basıyor. Değişen TEK şey çalışma ortamı:
 * tarayıcı yerine Node.
 *
 * DENEYİN OKUNUŞU
 *   · Sayılar tarayıcıdakine YAKINSA → tarayıcı suçlu değil. Gecikme
 *     ağdan ve/veya bizim netcode'umuzdan geliyor; platform değiştirmek
 *     onu yanında taşır.
 *   · Sayılar belirgin biçimde İYİYSE → tarayıcı gerçekten bir şey
 *     ekliyor ve yerli bir istemci konuşmaya değer.
 *
 * NE ÖLÇMÜYOR, dürüstçe: ekrana basma gecikmesini. Node'da çizim yok,
 * yani "tarayıcının kareyi ne kadar geç gösterdiği" burada görünmez.
 * Bu deney AĞ VE MOTOR yolunu izole ediyor — zaten şüphenin asıl
 * adresi orası, çünkü çizim ölçüldü ve 16.7 ms'lik bütçenin yirmide
 * birini kullanıyor.
 *
 * ÖNEMLİ: Capacitor paketi de bir WebView. Yani "Android'e çıkmak"
 * bu deneydeki değişkeni DEĞİŞTİRMİYOR — aynı Chromium, aynı soket.
 *
 * Kullanım:
 *   node tests/olcum/yerli-istemci.mjs
 *   RELE=wss://rele.retrovoleybol.online node tests/olcum/yerli-istemci.mjs
 *   SURE=60 RELE=... node tests/olcum/yerli-istemci.mjs
 *
 * Karşı taraf: aynı anda tarayıcıdan ÇEVRİMİÇİ → HEMEN OYNA ile
 * eşleşmen gerekiyor (bu istemci hızlı eşleşme sırasına giriyor).
 */
import WebSocket from 'ws';
import Game from '../../src/game/Game.js';
import { PHYSICS, PHASE } from '../../src/game/constants.js';
import { PAKET_SURUM } from '../../src/game/snapshot.js';

const RELE = process.env.RELE ?? 'ws://localhost:8787';
/** Ölçüm uzunluğu (sn) — maç kurulduktan sonra. */
const SURE = Number(process.env.SURE ?? 45);
/** Örnek basma aralığı (sn). */
const YAZ = Number(process.env.YAZ ?? 3);

const soket = new WebSocket(RELE);
let oyun = null;
let macBasladi = 0;
const seri = [];

/** Rastgele kimlik — her koşumda yeni oyuncu gibi davran. */
const rastgeleId = () => Array.from(
  { length: 16 },
  () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)],
).join('');

const yolla = (o) => soket.readyState === WebSocket.OPEN && soket.send(JSON.stringify(o));

soket.on('open', () => {
  console.log(`bağlandı: ${RELE}`);
  yolla({
    t: 'kimlik', id: rastgeleId(), gizli: rastgeleId(), ad: 'NODE', surum: PAKET_SURUM,
  });
});

soket.on('error', (e) => {
  console.error('SOKET HATASI:', e.message);
  process.exit(1);
});

soket.on('close', () => {
  if (!oyun) console.log('bağlantı kapandı (maç kurulmadan)');
  ozet();
  process.exit(0);
});

soket.on('message', (ham) => {
  let m;
  try { m = JSON.parse(ham.toString()); } catch { return; }
  if (!m || typeof m !== 'object') return;

  if (m.t === 'kimlik') {
    console.log(`kimlik alındı · sıraya giriliyor (karşı taraftan HEMEN OYNA'ya bas)`);
    yolla({ t: 'hizli-esles' });
    return;
  }

  if (m.t === 'hata') {
    console.error('RÖLE HATASI:', m.kod ?? JSON.stringify(m));
    process.exit(1);
  }

  if (m.t === 'mac') {
    macKur(m);
    return;
  }

  if (m.t === 'bitis') {
    console.log('\nmaç bitti');
    ozet();
    process.exit(0);
  }

  // Oyun paketleri motora — motor tanımadığını yok sayıyor
  if (oyun) oyun.agPaketAl(m);
});

/** @param {object} mesaj Rölenin `mac` mesajı */
function macKur(mesaj) {
  const cfg = mesaj.cfg ?? {};
  oyun = new Game(null, {
    ...cfg,
    playMode: 'vs',
    bassiz: true,
    agRol: 'misafir',
    agYuvam: mesaj.yuva ?? 'p1',
    agGonder: (paket) => yolla(paket),
    /*
     * `agSaat` burada VARSAYILAN kalıyor (performance.now). Node'da da
     * gerçek duvar saati o — ölçümün anlamı bu: motorun tarayıcıda
     * kullandığı saatin aynısı.
     */
  });
  oyun.emitState = () => {};
  oyun.start();
  macBasladi = Date.now();

  console.log(`\nmaç kuruldu · yuva=${mesaj.yuva} · rakip=${mesaj.rakip?.ad ?? '?'}`);
  console.log('\n  sn   ping  seğirme  paket  sessizlik  tampon  gerilik  FAZLA   kare');
  console.log('-'.repeat(74));

  /*
   * KARE DÖNGÜSÜ. Tarayıcıda bunu `requestAnimationFrame` sürüyor;
   * burada 60 Hz'lik bir zamanlayıcı. Motorun gördüğü şey aynı:
   * geçen GERÇEK süreyi alıp sabit adımlara çeviriyor.
   */
  let sonKare = process.hrtime.bigint();
  const dongu = setInterval(() => {
    const simdi = process.hrtime.bigint();
    const gecen = Number(simdi - sonKare) / 1e9;
    sonKare = simdi;

    // Ralliye sabitleme YOK: sunucu ne diyorsa o. Gerçek maç ölçülüyor.
    oyun.ilerlet(gecen);
    oyun.agAkis();

    // Hafif hareket — ileri sarma ve uzlaştırma yolları çalışsın
    const t = (Date.now() - macBasladi) / 1000;
    const sag = Math.floor(t / 1.2) % 2 === 0;
    oyun.inputs.p1.right = sag;
    oyun.inputs.p1.left = !sag;

    const o = oyun.agTaniOzeti();
    if (o && o.gerilik !== null) seri.push(o);

    if (t > SURE) { clearInterval(dongu); soket.close(); }
  }, 1000 / 60);

  // Ekrana periyodik özet
  const yazici = setInterval(() => {
    if (!seri.length) return;
    const o = seri[seri.length - 1];
    const t = Math.round((Date.now() - macBasladi) / 1000);
    console.log(
      `${String(t).padStart(4)} ${String(o.ping ?? '-').padStart(6)} ${
        String(o.segirme ?? '-').padStart(8)} ${String(o.paketAralik ?? '-').padStart(6)} ${
        String(o.sessizlik ?? '-').padStart(10)} ${String(o.tampon).padStart(7)} ${
        String(o.gerilik).padStart(8)} ${String(o.gerilik - o.tampon).padStart(6)} ${
        String(o.kare ?? '-').padStart(6)}`,
    );
    if ((Date.now() - macBasladi) / 1000 > SURE) clearInterval(yazici);
  }, YAZ * 1000);
}

function ozet() {
  if (seri.length < 5) {
    console.log('\nyeterli örnek toplanmadı — maç kurulmamış olabilir.');
    return;
  }
  const ort = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
  const p95 = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.95)];
  const al = (k) => seri.map((s) => s[k] ?? 0);

  console.log(`\n${'='.repeat(74)}`);
  console.log(`TARAYICISIZ İSTEMCİ ÖZETİ — ${seri.length} örnek\n`);
  console.log(`  ping        ort ${ort(al('ping'))} ms · p95 ${p95(al('ping'))} ms`);
  console.log(`  seğirme     ort ${ort(al('segirme'))} ms · p95 ${p95(al('segirme'))} ms`);
  console.log(`  paket       ort ${ort(al('paketAralik'))} ms   (60 Hz role -> ~17, 30 Hz -> ~33)`);
  console.log(`  tampon      ort ${ort(al('tampon'))} ms`);
  console.log(`  gerilik     ort ${ort(al('gerilik'))} ms · p95 ${p95(al('gerilik'))} ms`);
  const fazla = seri.map((s) => s.gerilik - s.tampon);
  console.log(`  FAZLA       ort ${ort(fazla)} ms · p95 ${p95(fazla)} ms  ← tamponun açıklamadığı`);
  console.log(`  kare        ort ${ort(al('kare'))} ms`);
  console.log(`
KARŞILAŞTIR: aynı ağda tarayıcıdan ?tani=1 ile okuduğun sayılarla.
Yakınsa tarayıcı suçlu değil — gecikme ağdan ve netcode'dan geliyor,
platform değiştirmek onu yanında taşır. Belirgin farklıysa tarayıcı
gerçekten bir şey ekliyor demektir.`);
}
