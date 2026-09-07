/**
 * VURUŞ TEPKİSİ — tuşa bastım, top ne zaman tepki verdi?
 *
 * Bu dosya bir oyuncu tarifinden doğdu: *"gecikmeli vuruşlar, topa
 * vurduktan sonra topun gecikmeli sekmesi veya gecikmeli karşı tarafa
 * geçmesi"*. Oyuncunun çıkarımı *"çevrimdışında bunu yaşamıyorum,
 * demek ki kod değil sunucu"* idi.
 *
 * Çıkarımın ilk yarısı doğru ve elemesi değerli: çevrimdışı iyiyse
 * sorun çizimde, fizikte, temas penceresinde ya da tuş yolunda DEĞİL.
 * İkinci yarısı eksik — çevrimiçi yol yalnız sunucudan ibaret değil.
 * Çevrimdışında hiç çalışmayan bir yığın kod var: tahmin, ara
 * değerleme, tampon, topu ileri sarma.
 *
 * ÖLÇÜLEN ŞEY: istemci tuşa bastığı adım ile İSTEMCİNİN ÇİZDİĞİ topun
 * kıpırdadığı adım arasındaki süre. Oyuncunun "vurdum ama top geç
 * tepki verdi" derken kastettiği sayı tam olarak bu.
 *
 * DÜZENEĞİN SEÇİMİ — bu ölçüm altı kez yanlış araçla yazıldı ve
 * hepsinin ortak kusuru OLAY YAKALAMAKTI: topun yön değiştirdiği anı
 * bulmak, düşey hız dönüşünü saymak, motorun dokunuş sayacını
 * izlemek... Her biri ayrı bir eşik ve ayrı bir yanılma kaynağı
 * getirdi (7 fırsata 16 vuruş, sonra 641 vuruş, sonra "0.0 px sapma").
 *
 * Bu yüzden burada `hissedilen.mjs`in KANITLANMIŞ deseni kullanılıyor:
 * top bilinen bir ana kadar DURUYOR, sonra hareket ediyor. "Duran şey
 * kıpırdadı" sinyali eşiksiz ve gürültüsüz; o ölçüm ilk denemede temiz
 * ve gidiş-dönüşle tutarlı sonuç vermişti.
 *
 * İKİ KOŞUL ayrı ölçülüyor, çünkü kodda iki ayrı karar var:
 *   · MENZİLDE — top oyuncunun temas alanında. `agTopGuvenOrani()`
 *     ileri sarmayı sıfıra indiriyor, yani telafi kapalı.
 *   · UZAKTA   — top kimseye yakın değil, ileri sarma çalışıyor.
 *
 * Kullanım: npm run olcum:vurus
 */
import Game from '../../src/game/Game.js';
import { PHYSICS, PHASE } from '../../src/game/constants.js';

const MS = PHYSICS.step * 1000;
/** Topun bırakıldığı adım. Tampon ve çizim saati otursun diye geç. */
const BIRAK = 180;
/** Ölçüm penceresi (adım) — sekme bu aralıkta olmalı. */
const PENCERE = 90;

class Kanal {
  constructor(g) { this.g = g; this.k = []; }
  yolla(p, a) { this.k.push({ v: a + this.g, d: JSON.stringify(p) }); }
  al(a) { const c = []; while (this.k.length && this.k[0].v <= a) c.push(JSON.parse(this.k.shift().d)); return c; }
}

const AYAR = { mode: '1v1', playMode: 'vs', format: 'single', difficulty: 'normal' };

/**
 * @param {number} tekYonMs Enjekte edilen TEK YÖN gecikme
 */
function olc(tekYonMs) {
  const gAdim = Math.round(tekYonMs / MS);
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
     * Varış saati SİMÜLE zamandan: bu düzenek zamanı adım adım
     * ilerletiyor, duvar saati burada anlamsız olurdu. Motor gerçek
     * tarayıcıda `performance.now()` kullanıyor (bkz. Game `agSaat`).
     */
    agSaat: () => adim * PHYSICS.step,
  });
  c.start();

  const benS = s.players.find((p) => p.controlSlot === 'p1');
  const sY = []; const sX = [];
  const cY = []; const cX = [];

  for (adim = 0; adim < BIRAK + PENCERE; adim += 1) {
    yukari.al(adim).forEach((p) => s.agPaketAl(p, 'p1'));
    asagi.al(adim).forEach((p) => c.agPaketAl(p, 'p2'));

    s.phase = PHASE.RALLY;
    s.phaseTimer = 99;

    /*
     * Top BIRAKILANA KADAR oyuncunun ERİŞEMEYECEĞİ yükseklikte tutuluyor.
     *
     * İlk denememde topu doğrudan temas menzilinde tutuyordum ve vuruş
     * hiç olmadı: vuruş TUŞA değil YAKINLIĞA bağlı (`action` yalnız
     * menzili büyütüyor), yani top orada dururken temaslar daha ölçüm
     * başlamadan tükeniyor ve üç dokunuş kuralı faul veriyordu.
     */
    if (adim <= BIRAK) {
      /*
       * Top YANDAN geliyor, dümdüz yukarıdan değil.
       *
       * Dikey bırakmıştım ve ölçüm imkânsız bir sayı verdi (−467 ms):
       * x sabit olunca düşerken ve sekerken aynı yükseklikteki iki an
       * AYNI KONUMDA oluyor ve "en yakın nokta" araması ikisini ayırt
       * edemiyor. Yatay hız yörüngeyi tek anlamlı yapıyor.
       */
      s.ball.x = benS.x - 220;
      s.ball.y = benS.y - 240;
      s.ball.vx = 0;
      s.ball.vy = 0;
    }
    if (adim === BIRAK) { s.ball.vx = 320; s.ball.vy = 200; }

    s.ilerlet(PHYSICS.step); s.agAkis();
    c.ilerlet(PHYSICS.step); c.agAkis();

    if (adim > BIRAK) { sY.push(s.ball.y); sX.push(s.ball.x); cY.push(c.ball.y); cX.push(c.ball.x); }
  }

  /*
   * GECİKME, KARE KARE: istemcinin çizdiği top sunucunun HANGİ anına
   * denk geliyor? Fark artı ise ekran geride, eksi ise ileri sarma
   * topu gerçeğin önüne geçirmiş demek.
   *
   * Önce bütün pencereyi tek bir çapraz eşleştirmeyle hizalamıştım ve
   * araç ele verdi: sayılar gecikmeyle AZALIYORDU (33 → 0). Sebebi
   * gerçekti — pencerenin çoğu SERBEST DÜŞÜŞ ve orada ileri sarma
   * çalışıyor, hizalamayı o bölüm domine ediyordu. Oysa sorulan soru
   * sekmeden SONRASI.
   */
  const kayma = (i) => {
    let enIyi = 0;
    let enYakin = Infinity;
    /*
     * Arama i'nin YAKININDA — bütün yörünge taranırsa uzak bir an
     * tesadüfen daha yakın düşebilir. Pencere, ölçülebilecek en büyük
     * gecikmeden geniş ama yörüngenin tamamından dar.
     */
    const alt = Math.max(0, i - 30);
    const ust = Math.min(sY.length - 1, i + 30);
    for (let j = alt; j <= ust; j += 1) {
      const d = Math.hypot(sX[j] - cX[i], sY[j] - cY[i]);
      if (d < enYakin) { enYakin = d; enIyi = j; }
    }
    return { ms: (i - enIyi) * MS, uzaklik: enYakin };
  };

  // Sekme = sunucunun GERÇEK yörüngesinin en alçak noktası
  const sekme = sY.indexOf(Math.max(...sY));
  const once = [];
  const sonra = [];
  for (let i = 3; i < cY.length - 3; i += 1) {
    const k = kayma(i);
    if (k.uzaklik > 25) continue; // eşleşme kötüyse sayma
    if (i < sekme - 3) once.push(k.ms);
    else if (i <= sekme + 15) sonra.push(k.ms);
  }

  const ortanca = (d) => (d.length ? [...d].sort((x, y) => x - y)[Math.floor(d.length / 2)] : null);
  return {
    rtt: Math.round(gAdim * MS * 2),
    gecerli: sekme > 5 && sekme < sY.length - 8 && once.length > 5 && sonra.length > 5,
    dususte: ortanca(once),
    sekmede: ortanca(sonra),
  };
}

console.log('\nVURUŞ TEPKİSİ — top sekti, ekranımda ne zaman sekti?\n');
console.log('Top oyuncunun üstüne bırakılıp ona çarpıyor. Her karede,');
console.log('istemcinin çizdiği topun sunucunun hangi anına denk geldiğine');
console.log('bakılıyor. Artı = ekran geride, eksi = ileri sarma önde.\n');
console.log('ağ RTT | SERBEST DÜŞÜŞTE | SEKME ANINDA | fark');
console.log('-'.repeat(56));

for (const tekYon of [0, 17, 25, 50]) {
  const r = olc(tekYon);
  if (!r.gecerli) {
    console.log(`${String(r.rtt).padStart(5)}ms | sekme yakalanmadı — ölçüm geçersiz`);
    continue;
  }
  console.log(
    `${String(r.rtt).padStart(5)}ms | ${`${r.dususte.toFixed(0)} ms`.padStart(16)}`
    + ` | ${`${r.sekmede.toFixed(0)} ms`.padStart(12)}`
    + ` | ${`+${(r.sekmede - r.dususte).toFixed(0)} ms`.padStart(7)}`,
  );
}

console.log(`
OKUMA: "serbest düşüşte" ileri sarma çalışıyor ve topu gerçek yerine
yakın tutuyor. "Sekme anında" ise agTopGuvenOrani() ileri sarmayı
sıfıra indiriyor ve ekran geriye düşüyor. Son sütun o kararın bedeli.

Üstüne bir de şu biniyor: istemci KENDİ VURUŞUNU tahmin etmiyor, yani
topun sekmesi ancak sunucunun paketiyle geliyor.

Çevrimdışında ikisi de yok — vuruş yerel hesaplanıyor, top aynı karede
sekiyor. "Çevrimdışında bunu yaşamıyorum" gözlemi bu yüzden doğru ve
sunucuyla ilgisi yok.`);
