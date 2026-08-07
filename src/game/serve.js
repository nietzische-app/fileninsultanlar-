import { GAME_WIDTH, GROUND_Y, NET, PHYSICS } from './constants.js';
import { onGround, stepBall } from './ballstep.js';

/**
 * Servis gücü / nişan — saf yardımcılar (Game.js'ten bağımsız).
 *
 * İki aşamalı bar:
 *  1) power — metre salınır, ilk basış gücü kilitler
 *  2) aim   — metre salınır, ikinci basış nişanı kilitler ve servisi atar
 *
 * ## Barın bir bedeli olmalı
 *
 * İlk sürümde bar tamamen süstü: `computeServeVelocity` önce fileyi aşan
 * EN KISA uçuşu arıyor, gücü ondan sonra bindiriyordu. Daha az güç = daha
 * uzun uçuş = daha yüksek kavis, yani fileyi daha da rahat aşıyordu. Üstüne
 * `meterToPower` tabanı `minPower`'a kırpıyordu; metre sıfırda bile güç
 * 0.35 çıkıyordu. Sonuç: metre nerede yakalanırsa yakalansın servis
 * geçiyordu, oyuncunun bildirdiği şey de buydu.
 *
 * Yeni model tersine kurulu — fizik karar veriyor:
 *
 *   1. Nişan bir hedef derinlik seçer.
 *   2. O derinliğe düşen ve fileyi `refMargin` payla aşan atış bulunur:
 *      "referans atış".
 *   3. Güç bu vektörü ölçekler.
 *
 * Vektörü ölçeklemek nişanı bozar — burada bozması istenen şeydir:
 *
 *   çarpan belirgin küçük → top fileye takılır  → sayı rakibe
 *   çarpan ~ 1            → hedefe düşer
 *   çarpan belirgin büyük → dip çizgiyi aşar    → AUT, sayı rakibe
 *
 * Ölçümde file eşiği nişandan neredeyse bağımsız çıktı (0.93 civarı,
 * yayılım 0.08), aut eşiği ise derinlikle sertçe değişiyor: en kısa
 * nişanda 1.30, en derin nişanda 1.03. Yani derin servis hızlı ama
 * riskli, kısa servis güvenli ama karşılaması kolay. Barın iki ucu da
 * artık gerçek bir karar.
 */

export const SERVE = {
  /** Servis çizgisi x oranı (kendi sahasında) */
  backLineHome: 0.12,
  backLineAway: 0.88,
  /**
   * Top el yüksekliği (GROUND_Y'den yukarı).
   *
   * Dikkat: bu yükseklikte top file üstünün 54 piksel ALTINDA doğuyor.
   * Servisin yukarı doğru kavis çizmek zorunda olmasının sebebi bu, ve
   * düşük güçte fileye takılmasının da.
   */
  holdHeight: 96,
  /** Metre salınım hızı (birim/sn) */
  meterSpeed: 1.55,
  /** İlk basış sonrası nişan aşaması hızı */
  aimMeterSpeed: 1.35,
  /**
   * İnsan servis atanın en fazla bekleyebileceği süre (sn).
   *
   * Bu olmadan tuşu basılı tutan oyuncu kilitleniyordu: güç aşaması
   * ilk karede geçiliyor, nişan aşaması ise ikinci bir basış beklediği
   * için tuş bırakılmadıkça asla gelmiyor ve maç servis aşamasında
   * sonsuza kadar donuyordu. Süre dolunca servis kendiliğinden atılır.
   */
  autoAfter: 4,
  /**
   * Servis atanın kendi topuna tekrar vuramayacağı süre (sn).
   * Top el yüksekliğinde, oyuncunun temas dairesinin içinde doğuyor.
   */
  recontactLock: 0.35,
  /** AI servis gecikmesi aralığı (sn) */
  aiDelayMin: 0.45,
  aiDelayMax: 1.35,

  /** Metrenin ürettiği ham güç aralığı (arayüz ve testler için). */
  minPower: 0,
  maxPower: 1,

  /**
   * Gücün referans atışa uyguladığı hız çarpanı aralığı.
   *
   * Alt uç 0.86'dan 0.82'ye indirildi. Sebebi file üstü bandı: motorda
   * banda değen top yukarı sekip karşı sahaya dökülebiliyor ve 0.86'da
   * zayıf servislerin %22'si bu şekilde kurtuluyordu — yani barın altı
   * yine cezasızdı, şikâyetin ta kendisi. 0.82'de güç 0.15'in altında
   * sahada kalma oranı %2; kör basışta dağılım sahada %63 / file %21 /
   * aut %16, tatlı nokta hâlâ güvenli.
   */
  speedScaleMin: 0.82,
  speedScaleMax: 1.22,

  /**
   * Referans atışın file üstünden bırakacağı pay (px).
   *
   * Analitik çözüm ile motorun kare kare Euler entegrasyonu arasında
   * birkaç piksel fark var; pay bunun üstünde tutulur ki çarpan 1'ken
   * servis her zaman geçsin.
   */
  refMargin: 34,

  /** Referans atış için taranan uçuş süresi aralığı (sn). */
  minFlight: 0.55,
  maxFlight: 2.2,

  /**
   * Dip çizgi oranı — dokunulmamış servis bunu aşarsa AUT.
   *
   * Sahada ralli için aut kuralı yok (yan duvarlar topu geri sektiriyor);
   * bu kural yalnızca kimsenin dokunmadığı servise işler. Voleybolun
   * gerçek kuralı da bu: rakip dokunduysa top oyundadır.
   */
  outLine: 0.9,

  /** Nişanın rakip sahada hedefleyebildiği derinlik (fileden px). */
  minDepth: 90,
  maxDepth: 330,

  /**
   * Metrenin önerilen noktası — hızlı ama çoğu nişanda güvenli çarpan
   * (~1.08). Göstergedeki beyaz çizgi buradan okur.
   */
  sweetSpot: 0.62,

  /**
   * Servis istatistiği hatayı ne kadar bastırır.
   *
   * İyi servis atan barı ıskaladığında sapması küçük kalır: çarpan 1'e
   * doğru çekilir. 100 statta aralık %12 daralır.
   */
  statForgiveness: 0.12,

  /**
   * AI'ın güvenli aralığın derin ucuna yanaşma eğilimi (beceriyle çarpılır).
   *
   * Derin servis karşılaması en zor olanı. 0.7'de zor rakip neredeyse her
   * servisi dip çizgiye atıyordu ve ölçümde 1v1 zor kazanma oranı %0'a
   * düştü — servis öncesi taban %33'tü. Rakibin servisi bir üstünlük
   * olmalı, tek başına maçı bitiren şey değil.
   */
  aiDepthBias: 0.35,
};

/**
 * @param {number} meter 0–1
 * @param {1|-1} dir
 * @param {number} speed
 * @param {number} dt
 * @returns {{ meter: number, dir: 1|-1 }}
 */
export function advanceServeMeter(meter, dir, speed, dt) {
  let next = meter + dir * speed * dt;
  let nextDir = dir;
  if (next >= 1) {
    next = 1;
    nextDir = -1;
  } else if (next <= 0) {
    next = 0;
    nextDir = 1;
  }
  return { meter: next, dir: nextDir };
}

/**
 * Metre → ham güç. Doğrusal: metrenin her yeri farklı bir sonuç versin.
 *
 * Eskiden burada `Math.max(minPower, …)` vardı ve barın alt yarısını
 * tek bir değere eziyordu.
 * @param {number} meter
 * @returns {number} 0–1
 */
export function meterToPower(meter) {
  return clampRange(meter, 0, 1);
}

/**
 * İkinci metre → yatay nişan (-1 file yakını / +1 dip çizgi).
 * @param {number} meter
 * @returns {number} -1..1
 */
export function meterToAim(meter) {
  return clampRange(meter * 2 - 1, -1, 1);
}

/**
 * Servisin çıkış noktası.
 *
 * Motor topu `server.x + server.facing * 10` noktasında tutuyor; buradaki
 * 10 piksel de sayılmalı, yoksa tahmin ile gerçek uçuş baştan kayar.
 */
export function serveOrigin(toOpponent) {
  const ratio = toOpponent > 0 ? SERVE.backLineHome : SERVE.backLineAway;
  return {
    x: GAME_WIDTH * ratio + toOpponent * 10,
    y: GROUND_Y - SERVE.holdHeight,
  };
}

/** Nişan → hedef x. */
function aimTarget(aim, toOpponent) {
  const a = clampRange(aim, -1, 1);
  const depth =
    SERVE.minDepth + ((a + 1) / 2) * (SERVE.maxDepth - SERVE.minDepth);
  return NET.x + toOpponent * depth;
}

/**
 * Atışı motorun kare adımıyla uçurur.
 *
 * Hem referans atış hem sonuç tahmini buradan okur. Ayrı ayrı
 * hesaplanırlardı: referans analitik çözülüyor, sonuç Euler ile
 * ölçülüyordu. Euler yerçekimini biraz fazla uyguladığı için analitikte
 * fileyi aşan atış oyunda takılıyor, güvenli bant da barın yanlış
 * yerinde çıkıyordu. Tek entegratör = gösterilen ile olan aynı.
 *
 * @returns {{ netY: number, landX: number, hitNet: boolean, crossedOut: boolean }}
 */
function simulate(start, shot, toOpponent) {
  const ball = {
    x: start.x,
    y: start.y,
    vx: shot.vx,
    vy: shot.vy,
    radius: PHYSICS.ballRadius,
  };
  const step = 1 / 60;
  const outX =
    toOpponent > 0
      ? GAME_WIDTH * SERVE.outLine
      : GAME_WIDTH * (1 - SERVE.outLine);

  let netY = Infinity;
  let touchedNet = false;
  let crossedOut = false;

  for (let i = 0; i < 60 * 6; i += 1) {
    const prevX = ball.x;
    const event = stepBall(ball, step);

    const crossed =
      (prevX < NET.x && ball.x >= NET.x) || (prevX > NET.x && ball.x <= NET.x);
    if (crossed && netY === Infinity) netY = ball.y;

    if (event.net) touchedNet = true;
    if (toOpponent > 0 ? ball.x > outX : ball.x < outX) crossedOut = true;
    if (onGround(ball)) break;
  }

  return { netY, landX: ball.x, touchedNet, crossedOut };
}

/**
 * Hedefe düşen ve fileyi `refMargin` payla aşan EN KISA atış.
 *
 * En kısayı seçmek servisi olabildiğince düz ve hızlı tutar; kavis
 * gücün altına düşmenin sonucu olsun diye, seçim değil.
 *
 * Arama simülasyon çalıştırdığı için sonuç önbelleğe alınır: referans
 * yalnızca nişana ve tarafa bağlı, güçten ve statten bağımsız. Önbellek
 * olmadan `safeAimRange` çizim döngüsünde binlerce simülasyon demekti.
 */
const refCache = new Map();

function referenceShot(aim, toOpponent) {
  const key = `${Math.round(clampRange(aim, -1, 1) * 200)}:${toOpponent}`;
  const cached = refCache.get(key);
  if (cached) return cached;

  const start = serveOrigin(toOpponent);
  const targetX = aimTarget(aim, toOpponent);
  const targetY = GROUND_Y - PHYSICS.ballRadius;

  const solve = (flight) => ({
    vx: (targetX - start.x) / flight,
    vy:
      (targetY - start.y - 0.5 * PHYSICS.ballGravity * flight * flight) /
      flight,
  });

  const good = (shot) => {
    const flight = simulate(start, shot, toOpponent);
    return !flight.touchedNet && flight.netY < NET.topY - SERVE.refMargin;
  };

  // Kaba tarama ile ilk geçerli uçuşu bul, sonra aralığı inceden daralt
  let shot = solve(SERVE.maxFlight);
  let coarse = null;
  for (let t = SERVE.minFlight; t <= SERVE.maxFlight; t += 0.05) {
    if (good(solve(t))) {
      coarse = t;
      break;
    }
  }
  if (coarse !== null) {
    let best = coarse;
    for (let t = Math.max(SERVE.minFlight, coarse - 0.05); t < coarse; t += 0.01) {
      if (good(solve(t))) {
        best = t;
        break;
      }
    }
    shot = solve(best);
  }

  refCache.set(key, shot);
  return shot;
}

/**
 * Güç → hız çarpanı. Servis istatistiği sapmayı 1'e doğru çeker.
 * @param {number} power 0–1
 * @param {number} serveStat 0–100
 */
export function powerScale(power, serveStat = 70) {
  const p = clampRange(power, 0, 1);
  const raw =
    SERVE.speedScaleMin + p * (SERVE.speedScaleMax - SERVE.speedScaleMin);
  const stat = clampRange(serveStat, 0, 100) / 100;
  const spread = 1 - stat * SERVE.statForgiveness;
  return 1 + (raw - 1) * spread;
}

/**
 * Servis hız vektörü.
 * @param {{ power: number, aim: number, toOpponent: 1|-1, serveStat?: number }} opts
 * @returns {{ vx: number, vy: number }}
 */
export function computeServeVelocity({ power, aim, toOpponent, serveStat = 70 }) {
  const ref = referenceShot(aim, toOpponent);
  const scale = powerScale(power, serveStat);
  return { vx: ref.vx * scale, vy: ref.vy * scale };
}

/**
 * Servisin sonucunu önceden söyler: 'net' | 'in' | 'out'.
 *
 * Arayüz nişan barının güvenli bölgesini bununla boyar — oyuncu barın
 * neresinin cezalı olduğunu görmeden bunun adı "şans" olurdu. Testler de
 * aynı fonksiyonu kullanır ki gösterilen ile olan aynı kalsın.
 *
 * Motorun kare adımıyla (1/60) entegre eder; analitik çözüm birkaç piksel
 * saparak göstergeyi yalancı çıkarabilir.
 * @returns {'net' | 'in' | 'out'}
 */
export function serveOutcome({ power, aim, toOpponent, serveStat = 70 }) {
  const start = serveOrigin(toOpponent);
  const shot = computeServeVelocity({ power, aim, toOpponent, serveStat });
  const flight = simulate(start, shot, toOpponent);

  /*
   * Fileye değmek tek başına faul DEĞİL.
   *
   * Motorda üst banda çarpan top yukarı sekip karşı sahaya düşebiliyor —
   * voleyboldaki "file kenarı" servisi, kurallara göre oyunda. Önce
   * "değdi mi" diye bakılıyordu ve düşük güçlü servislerin bir kısmı
   * yanlışlıkla faul gösteriliyordu. Karar topun NEREYE düştüğüne ait,
   * tıpkı motordaki gibi.
   */
  if (flight.crossedOut) return 'out';

  const landedOwnSide =
    toOpponent > 0 ? flight.landX < NET.x : flight.landX > NET.x;
  return landedOwnSide ? 'net' : 'in';
}

/**
 * Kilitlenmiş güç için sahada kalan nişan aralığı (metre değeri olarak).
 *
 * Nişan barında yeşil bölgeyi çizmek için. Aralık bulunamazsa null.
 * @returns {{ min: number, max: number } | null}
 */
export function safeAimRange({ power, toOpponent, serveStat = 70 }) {
  /*
   * En uzun KESİNTİSİZ güvenli koşu döndürülür, uçlar değil.
   *
   * Uçları döndürmek yanlıştı: file üstü bandı yüzünden bazı güçlerde
   * güvenli bölgenin ortasında aut adacıkları oluşuyor ve yeşil bant
   * onları da içine alıyordu — yani gösterge güvenli dediği bir noktada
   * sayı kaybettirebilirdi.
   */
  let best = null;
  let runStart = null;
  let prev = null;

  const close = (end) => {
    if (runStart === null) return;
    const run = { min: runStart, max: end };
    if (!best || run.max - run.min > best.max - best.min) best = run;
    runStart = null;
  };

  for (let m = 0; m <= 1.0001; m += 0.02) {
    const safe =
      serveOutcome({ power, aim: meterToAim(m), toOpponent, serveStat }) === 'in';
    if (safe && runStart === null) runStart = m;
    if (!safe) close(prev);
    prev = m;
  }
  close(prev);

  return best;
}

function clampRange(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * AI için güç/nişan — zorluk `serveSkill` (0–1).
 *
 * Zayıf AI artık gerçekten faul yapabilir: güvenli aralığın ortasını
 * hedefler ama sapması beceriyle ters orantılı. Oyuncu barı ıskaladığında
 * ceza ödüyorsa rakip de ödemeli.
 * @param {number} serveSkill
 * @param {1|-1} toOpponent
 * @param {number} serveStat
 * @returns {{ power: number, aim: number }}
 */
export function aiServeChoice(serveSkill = 0.5, toOpponent = 1, serveStat = 70) {
  const skill = clampRange(serveSkill, 0, 1);

  // Beceri arttıkça daha sert vurur
  const wantPower = 0.42 + skill * 0.26;
  const jitter = (1 - skill) * 0.3;
  const power = clampRange(wantPower + (Math.random() * 2 - 1) * jitter, 0, 1);

  const safe = safeAimRange({ power, toOpponent, serveStat });
  if (!safe) return { power, aim: meterToAim(Math.random()) };

  /*
   * AI de servis kaçırabilmeli.
   *
   * Güvenli aralığı hesaplayıp içine nişan alan bir rakip asla faul
   * yapmıyordu — ölçümde normal ve zor için faul oranı tam %0 çıktı.
   * Oyuncu barı ıskaladığında sayı veriyorsa rakibin kusursuz servis
   * atması hem haksız hem de gerçek voleybola aykırı: en üst seviyede
   * bile servis hatası olur. Bilerek dışarı nişan alınır.
   */
  const faultChance = 0.16 - skill * 0.13;
  if (Math.random() < faultChance) {
    /*
     * Faul, güvenli aralığın TÜMLEYENİNDEN örneklenir.
     *
     * Önce sınırın biraz ötesine nişan alınıyordu, ama yumuşak servisin
     * güvenli aralığı barın tepesine dayandığı için "biraz ötesi" 1.0'a
     * kırpılıp güvenli bölgeye geri düşüyordu; kasıtlı faullerin çoğu
     * sahada bitiyor, faul oranı %11 yerine %4 çıkıyordu. Tümleyenden
     * seçmek her zaman dışarı çıkar. Segmentler uzunluklarıyla orantılı
     * seçilir ki faulün türü aralığın yerine göre doğal dağılsın.
     */
    const below = safe.min;
    const above = 1 - safe.max;
    if (below + above > 0.01) {
      const pickLow = Math.random() * (below + above) < below;
      const aimMeter = pickLow
        ? Math.random() * below
        : safe.max + Math.random() * above;
      return { power, aim: meterToAim(clampRange(aimMeter, 0, 1)) };
    }
  }

  // İyi AI güvenli aralığın derin ucuna yanaşır, zayıf AI ortalıkta gezinir
  const center = (safe.min + safe.max) / 2;
  const reach = (safe.max - safe.min) / 2;
  const aimMeter = clampRange(
    center +
      reach * skill * SERVE.aiDepthBias +
      (Math.random() * 2 - 1) * reach * (1 - skill),
    safe.min,
    safe.max
  );

  return { power, aim: meterToAim(aimMeter) };
}

/**
 * @param {number} serveSkill
 * @returns {number}
 */
export function aiServeDelay(serveSkill = 0.5) {
  const skill = clampRange(serveSkill, 0, 1);
  const t = SERVE.aiDelayMax - (SERVE.aiDelayMax - SERVE.aiDelayMin) * skill;
  return t * (0.85 + Math.random() * 0.3);
}
