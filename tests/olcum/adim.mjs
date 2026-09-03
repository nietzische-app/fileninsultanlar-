import { chromium } from 'playwright';

/**
 * SABİT ADIM ölçümü.
 *
 * İddia: simülasyon artık ekranın tazeleme hızından bağımsız. Ölçmeden
 * inanmıyoruz — aynı oyun aynı tohumla farklı kare hızlarında koşturulup
 * sonuç durumları karşılaştırılıyor.
 *
 * Eski döngü de burada yeniden kuruluyor (`eskiAdim`), böylece "önce
 * böyleydi" iddiası analitik değil ölçülmüş oluyor.
 *
 * Bakılan üç şey:
 *   1. sim/gerçek — 1 sn gerçek zamanda kaç sn simülasyon ilerledi.
 *      1.000 olmalı; eskisinde düşük FPS'te ağır çekim vardı.
 *   2. top/skor — 60 Hz koşumuyla birebir aynı mı (aynı tohum, aynı sonuç).
 *   3. boş/çift kare — sabit adımın klasik takılma kaynağı: bir kare hiç
 *      ilerlemez, sonraki iki adım atar. Tolerans bunu kesmeli.
 */

const URL = process.env.OYUN_URL ?? 'http://localhost:5173/';
const SANIYE = Number(process.env.SANIYE ?? 6);
/*
 * 59.94 ve 61 kasten burada. Tazeleme hızı adımla TAM eşleştiğinde
 * (60.000) sapmanın yönü tek taraflı olmuyor. Gerçek cihazlar tam
 * 60.000 değil; tazeleme adımdan azıcık uzun ya da kısa olduğunda
 * biriken artık kayar ve boş/çift kare asıl orada doğar.
 */
const HIZLAR = (process.env.HIZLAR ?? '20,30,59.94,60,61,90,120,144').split(',').map(Number);
/** rAF zaman damgası oynaması (ms) — gerçek cihazda kare süresi sabit değil. */
const TITREME = Number(process.env.TITREME ?? 1);

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('HATA', String(e).slice(0, 200)));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(1500);

const sonuc = await page.evaluate(async ({ saniye, hizlar, titreme }) => {
  const { default: Game } = await import('/src/game/Game.js');
  const { PHYSICS } = await import('/src/game/constants.js');

  const stub = new Proxy({}, { get: (_t, k) => {
    if (k === 'canvas') return { width: 900, height: 500 };
    if (k === 'measureText') return () => ({ width: 10 });
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop(){} });
    return () => {}; }, set: () => true });
  const canvas = { width:900,height:500,getContext:()=>stub,addEventListener(){},removeEventListener(){},
    getBoundingClientRect:()=>({x:0,y:0,width:900,height:500}),style:{} };

  /*
   * Tohumlu üreteç. Oyun simülasyonu Math.random kullanıyor; iki koşumu
   * karşılaştırabilmek için rastgeleliği sabitlemek şart. Ölçtüğümüz şey
   * zamanlama, rastgelelik değil.
   */
  const gercekRandom = Math.random;
  let tohum = 0;
  const tohumla = () => { tohum = 123456789; };
  Math.random = () => {
    tohum = (tohum * 1103515245 + 12345) & 0x7fffffff;
    return tohum / 0x7fffffff;
  };

  // Döngü kendini rAF ile yeniden kurmasın — kareleri elle sürüyoruz
  const gercekRaf = window.requestAnimationFrame;
  window.requestAnimationFrame = () => 0;

  /*
   * Karşılaştırılan döngüler burada yeniden kuruluyor — sabit değeri
   * çalışma anında değiştirip Game.js'in görmesini beklemiyoruz.
   *
   * İlk denemem tam olarak buydu: sabiti çalışma anında sıfırlayıp
   * koştum, toleranslı ve toleranssız satırlar birebir aynı çıktı ve az
   * kalsın "tolerans bir işe yaramıyor" diye rapor edecektim. Sebebi şu:
   * Vite düzenlenen modülü `?t=...` sorgusuyla yeniden servis ediyor,
   * Game.js'in tuttuğu constants örneği ile testin içe aktardığı örnek
   * ayrı nesneler oluyor. Değerleri okumak güvenli, yazmak değil.
   */
  const STEP = PHYSICS.step;
  const CATCH = PHYSICS.maxCatchUp;

  /** Değişiklikten önceki döngü gövdesi, birebir. */
  function eskiAdim(g, timestamp) {
    const delta = Math.min((timestamp - g.lastTime) / 1000, 1 / 30);
    g.lastTime = timestamp;
    g.update(delta);
  }

  /** Yeni döngü, tolerans çıkarılmış hâli — toleransın ne kazandırdığını görmek için. */
  function toleranssizAdim(g, timestamp) {
    const elapsed = Math.min((timestamp - g.lastTime) / 1000, CATCH);
    g.lastTime = timestamp;
    g.accumulator += elapsed;
    while (g.accumulator >= STEP) {
      g.accumulator -= STEP;
      g.update(STEP);
    }
  }

  function kos(hz, eski, tolerans = true) {
    tohumla();
    const g = new Game(canvas, { mode: '1v1', difficulty: 'normal', homeIds: ['gizem-orge'],
      format: 'single', opponentId: 'atlas', onState(){}, onFinish(){} });
    g.emitState = () => {};
    g.render = () => {};
    g.running = true;
    g.lastTime = 0;
    g.accumulator = 0;

    let adim = 0;
    let bos = 0;
    let cift = 0;
    const orijinalUpdate = g.update.bind(g);
    let kareAdim = 0;
    g.update = (dt) => { adim += 1; kareAdim += 1; return orijinalUpdate(dt); };

    const kareSure = 1000 / hz;
    const kare = Math.round(saniye * hz);
    /*
     * Durum karşılaştırması aynı adım sayısında yapılmalı. Sabit gerçek
     * zamanda durdurunca 120 Hz koşumu 359, 60 Hz koşumu 360 adımda
     * kalıyordu; ilk sürümde bunu "sapma" diye raporladım, oysa tek
     * adımlık gecikmeydi. Zaman ölçüsü `kare` karede alınır, durum
     * ölçüsü hedef adıma varınca.
     */
    const hedefAdim = Math.round(saniye / PHYSICS.step);
    let gecen = 0;
    for (let i = 1; i <= kare + 20; i += 1) {
      if (i > kare && (eski || adim >= hedefAdim)) break;
      kareAdim = 0;
      // Titreme gerçek rAF'ı taklit eder; tohumlu üreteci kirletmesin diye gerçek random
      const t = i * kareSure + (titreme ? (gercekRandom() - 0.5) * 2 * titreme : 0);
      if (eski) eskiAdim(g, t);
      else if (!tolerans) toleranssizAdim(g, t);
      else g.loop(t); // gerçek kod yolu — en az bir satır onu koşturmalı
      if (i <= kare) {
        gecen = i * kareSure / 1000;
        if (kareAdim === 0) bos += 1;
        else if (kareAdim >= 2) cift += 1;
      }
    }

    const cikti = {
      hz,
      döngü: eski ? 'eski' : tolerans ? 'yeni' : 'yeni (toleranssız)',
      'sim/gerçek': +(g.time / gecen).toFixed(3),
      adım: adim,
      'boş kare': bos,
      'çift kare': cift,
      top: `${g.ball.x.toFixed(1)},${g.ball.y.toFixed(1)}`,
      skor: `${g.score.home}-${g.score.away}`,
    };
    g.destroy?.();
    return cikti;
  }

  const satirlar = [];
  for (const hz of hizlar) satirlar.push(kos(hz, false));
  // Tolerans gerçekten iş görüyor mu — kapatıp aynı kare hızını tekrar koş
  for (const hz of hizlar) satirlar.push(kos(hz, false, false));
  for (const hz of hizlar) satirlar.push(kos(hz, true));

  Math.random = gercekRandom;
  window.requestAnimationFrame = gercekRaf;
  return { satirlar, adimSn: 1 / PHYSICS.step };
}, { saniye: SANIYE, hizlar: HIZLAR, titreme: TITREME });

await browser.close();

const { satirlar, adimSn } = sonuc;
console.log(`Sabit adım: ${adimSn.toFixed(1)} Hz · ${SANIYE} sn · titreme ±${TITREME} ms\n`);
console.table(satirlar);

const yeni = satirlar.filter((s) => s.döngü === 'yeni');
const referans = yeni.find((s) => s.hz === 60) ?? yeni[0];
const hedef = Math.round(SANIYE * adimSn);

/*
 * Telafi tavanına takılan kare hızları ayrı raporlanır. Hedef adıma
 * varamamış bir koşumun 60 Hz'den farklı durumda olması beklenen şey —
 * onu "sapma" diye saymak aracın oyuna iftirası olur.
 */
const yavas = yeni.filter((s) => s.adım < hedef);
const sapan = yeni.filter(
  (s) => s.adım >= hedef && (s.top !== referans.top || s.skor !== referans.skor),
);

console.log(
  sapan.length === 0
    ? `\nTam adıma varan tüm kare hızları ${referans.hz} Hz ile birebir aynı durumu üretti.`
    : `\nSAPMA — aynı adım sayısında farklı sonuç: ${sapan.map((s) => `${s.hz} Hz`).join(', ')}`,
);
if (yavas.length) {
  console.log(
    `Telafi tavanına takılan (ağır çekim, beklenen): ${yavas
      .map((s) => `${s.hz} Hz → ${s['sim/gerçek']}x`)
      .join(', ')}`,
  );
}
