/**
 * KAPASİTE ölçümü — bir sunucu kaç eşzamanlı maç koşturabilir.
 *
 * Neden bu soru önemli: sunucu artık maçları KENDİ koşturuyor. Her maç
 * saniyede 60 kez tam bir oyun simülasyonu demek — fizik, kurallar,
 * yapay zekâ, çarpışma. Röle sadece mesaj taşısaydı yüzlerce maç
 * umursanmazdı; hakem olunca sınırı bilmek gerekiyor.
 *
 * Sınırı bilmeden yazılan her operasyon kararı tahmin olur: konteynere
 * kaç MB bellek vereceğiz, kaç bağlantıya izin vereceğiz, "sunucu
 * dolu" ne zaman denecek. Bu ölçüm o sayıları veriyor.
 *
 * ÖLÇÜLEN ŞEY: tik gecikmesi, simülasyon hızı ve BANT GENİŞLİĞİ.
 *
 * İlk yazışımda yalnız işlemciye bakıyordum ve sonuç yanıltıcıydı:
 * 32 maçta CPU %4 çıkıyordu. Doğrulayınca sebebi ortaya çıktı —
 * maçlar SERVİS fazında takılıp kalmıştı. Servis ucuz; asıl iş
 * rallide (top fizigi, çarpışmalar, parçacıklar). Ölçüm boşta duran
 * maçları ölçüyordu.
 *
 * Düzeltilmiş hâliyle sonuç şu: simülasyon zaten UCUZ (ralli fazında
 * update başına ~3.6 µs, yani 100 maç tek çekirdeğin %2'si).
 * Darboğaz işlemci değil, PAKET: her maç saniyede 20 anlık görüntü
 * üretiyor ve bunlar iki sokete birden yazılıyor. Tablodaki KB/sn
 * sütunu bu yüzden en önemli sütun.
 *
 * Gerçek soket YOK — bu ölçümün sınırı ve bilerek böyle. Paketler
 * JSON'a çevrilip (gerçek maliyet) sayaca yazılıyor ama sokete
 * yazılmıyor. Yani buradaki sayılar ALT SINIR: gerçek dağıtımda
 * TLS, TCP ve `ws` çerçeveleme bunun üstüne biniyor.
 *
 * Kullanım:
 *   node tests/olcum/kapasite.mjs
 *   MACLAR=1,5,10,20,40 SANIYE=8 node tests/olcum/kapasite.mjs
 */

import { Mac } from '../../sunucu/mac.js';
import { PHASE, GAME_WIDTH } from '../../src/game/constants.js';

/** Kaç eşzamanlı maçla denenecek. */
const MACLAR = (process.env.MACLAR ?? '1,4,8,16,32').split(',').map(Number);
/** Her ölçümün süresi (sn). */
const SANIYE = Number(process.env.SANIYE ?? 6);
/** Tik aralığı (ms) — mac.js ile aynı olmalı. */
const TIK_MS = 1000 / 60;

/**
 * Maçı RALLİDE tutar.
 *
 * Bu satırlar olmadan ölçüm yalan söylüyor ve ilk sürümde tam olarak
 * öyle oldu: maçlar servis fazında takılıyor, servis fazı ucuz
 * olduğu için CPU düşük çıkıyor ve "32 maç hiçbir şey değil" gibi bir
 * sonuç veriyordu. Aynı tuzağa gecikme ölçümünde de düşmüştük —
 * oyuncu girdisi yalnız rallide işleniyor.
 *
 * Top da havada tutuluyor: yere düşerse sayı olur, aşama değişir ve
 * ölçüm yine servise kayar.
 */
function ralliyeSabitle(oyun) {
  oyun.phase = PHASE.RALLY;
  oyun.phaseTimer = 99;
  if (oyun.ball.y > 400 || Math.abs(oyun.ball.vx) < 1) {
    oyun.ball.x = GAME_WIDTH / 2;
    oyun.ball.y = 150;
    oyun.ball.vx = 260;
    oyun.ball.vy = -120;
  }
}

/**
 * Girdi üreteci — maçlar boş durmasın.
 *
 * Boşta duran maç gerçekçi değil: oyuncu yoksa fizik de sakin akıyor
 * ve ölçüm iyimser çıkıyor. Tuşlar rastgele değiştiriliyor ki
 * oyuncular koşsun, zıplasın, vursun.
 */
function girdiUret(mac, sayac) {
  ['p1', 'p2'].forEach((yuva, i) => {
    const t = sayac + i * 17;
    mac.girdi(yuva, {
      t: 'girdi',
      v: 2,
      k: {
        left: t % 37 < 12,
        right: t % 37 >= 12 && t % 37 < 24,
        up: t % 53 === 0,
        down: false,
        action: t % 29 === 0,
        dive: t % 211 === 0,
      },
      b: Math.floor(t / 29),
      z: t / 60,
    });
  });
}

/**
 * N maçı aynı anda koşturur ve tik gecikmesini ölçer.
 *
 * Zamanlayıcıları maçların kendisi kuruyor (`mac.baslat`), yani
 * ölçülen şey gerçek dağıtımdaki düzenin ta kendisi — ayrı bir
 * döngü yazıp "muhtemelen böyle davranır" demiyoruz.
 */
async function olc(macSayisi) {
  const maclar = [];
  let paket = 0;
  let bayt = 0;

  for (let i = 0; i < macSayisi; i += 1) {
    const mac = new Mac({
      ayar: { mode: '1v1', format: 'single', difficulty: 'normal' },
      /*
       * Paketler sayılıp atılıyor. İKİYLE ÇARPILIYOR ve bu düzeltme
       * ölçümün ilk hâlindeki bir hataydı: `Mac.yolla` odaya BİR kez
       * çağrılıyor ama röle onu İKİ sokete birden yazıyor
       * (`odayaYolla`). Bir kez saymak telde gerçekten geçen trafiği
       * yarı yarıya eksik gösteriyordu — ve o eksik sayıyla
       * "500 oda ≈ 23 Mbit/sn" diye yazmıştım, gerçeği bunun iki katı.
       */
      yolla: (p) => {
        paket += 2;
        bayt += JSON.stringify(p).length * 2;
      },
      bitince: () => {},
    });
    maclar.push(mac);
  }

  /*
   * Bellek ölçümünden önce çöp topla. Yoksa ölçüm bir önceki
   * koşumun artıklarını da sayıyor ve maç başına bellek olduğundan
   * büyük görünüyor — konteyner sınırını bu sayıya göre koyacağımız
   * için doğru olması gerekiyor. `--expose-gc` yoksa atlanıyor.
   */
  global.gc?.();
  const bellekBas = process.memoryUsage().rss;

  const baslangic = process.hrtime.bigint();
  const kullanimBas = process.cpuUsage();
  maclar.forEach((m) => m.baslat());

  /*
   * Tik gecikmesi AYRI bir zamanlayıcıyla ölçülüyor, maçların
   * içinden değil: maçın kendi tikini ölçmek, ölçüm işini de o
   * tikin içine koymak olurdu ve sonucu şişirirdi.
   */
  const gecikmeler = [];
  let sonBeklenen = Date.now() + TIK_MS;
  const olcer = setInterval(() => {
    const simdi = Date.now();
    gecikmeler.push(simdi - sonBeklenen);
    sonBeklenen = simdi + TIK_MS;
  }, TIK_MS);

  let sayac = 0;
  const girdiSaati = setInterval(() => {
    sayac += 1;
    maclar.forEach((m) => {
      ralliyeSabitle(m.oyun);
      girdiUret(m, sayac);
    });
  }, TIK_MS);

  await new Promise((coz) => {
    setTimeout(coz, SANIYE * 1000);
  });

  clearInterval(olcer);
  clearInterval(girdiSaati);
  const bellekSon = process.memoryUsage().rss;
  const kullanim = process.cpuUsage(kullanimBas);
  const gercekSure = Number(process.hrtime.bigint() - baslangic) / 1e9;

  // Motorların gerçekten kaç adım attığını topla — beklenenle karşılaştır
  const adimlar = maclar.map((m) => m.oyun.adim);
  maclar.forEach((m) => m.durdur());

  gecikmeler.sort((a, b) => a - b);
  const p50 = gecikmeler[Math.floor(gecikmeler.length * 0.5)] ?? 0;
  const p95 = gecikmeler[Math.floor(gecikmeler.length * 0.95)] ?? 0;
  const enKotu = gecikmeler[gecikmeler.length - 1] ?? 0;

  /*
   * Simülasyon HIZI: motor sabit adım kullandığı için sunucu
   * yavaşlasa bile saha aynı hızda akmalı. Bu oran 1.0'dan düşerse
   * maçlar ağır çekime düşmüş demektir — asıl kırmızı çizgi bu,
   * gecikme değil.
   */
  const beklenenAdim = gercekSure * 60;
  const ortalamaAdim = adimlar.reduce((a, b) => a + b, 0) / adimlar.length;
  const hiz = ortalamaAdim / beklenenAdim;

  const cpuSaniye = (kullanim.user + kullanim.system) / 1e6;

  return {
    macSayisi,
    p50: Math.round(p50),
    p95: Math.round(p95),
    enKotu: Math.round(enKotu),
    hiz: Number(hiz.toFixed(3)),
    cpuYuzde: Math.round((cpuSaniye / gercekSure) * 100),
    kbSaniye: Number((bayt / 1024 / gercekSure).toFixed(1)),
    paketSaniye: Math.round(paket / gercekSure),
    rssMb: Math.round(bellekSon / 1024 / 1024),
    macBasiKb: Math.round((bellekSon - bellekBas) / 1024 / Math.max(1, macSayisi)),
  };
}

const satirlar = [];
for (const n of MACLAR) {
  // Ölçümler SIRAYLA koşmalı: paralel koşsalar birbirlerinin CPU'sunu
  // yer ve her satır ötekinin gürültüsünü ölçerdi
  satirlar.push(await olc(n));
}

console.log('\nKAPASİTE ÖLÇÜMÜ');
console.log(`her ölçüm ${SANIYE} sn · tik ${TIK_MS.toFixed(1)} ms · çekirdek: ${
  (await import('node:os')).cpus().length
}\n`);
console.log(
  'maç   tik p95   sim hızı   CPU    KB/sn   paket/sn   RSS    maç başı',
);
console.log('-'.repeat(74));
for (const s of satirlar) {
  console.log(
    `${String(s.macSayisi).padStart(3)}` +
      `${`${s.p95} ms`.padStart(10)}` +
      `${String(s.hiz).padStart(11)}` +
      `${`%${s.cpuYuzde}`.padStart(7)}` +
      `${String(s.kbSaniye).padStart(9)}` +
      `${String(s.paketSaniye).padStart(11)}` +
      `${`${s.rssMb} MB`.padStart(8)}` +
      `${`${s.macBasiKb} KB`.padStart(11)}`,
  );
}
console.log(
  '\nsim hızı 1.000 olmalı: sabit adım sayesinde sunucu yavaşlasa bile',
);
console.log("saha aynı hızda akar. 1.000'in altı = maçlar ağır çekimde.");
console.log(
  '\nKB/sn en önemli sütun: darboğaz işlemci değil paket. Ve bu sayı',
);
console.log('ALT SINIR — gerçek dağıtımda TLS/TCP/ws yükü üstüne biniyor.\n');
