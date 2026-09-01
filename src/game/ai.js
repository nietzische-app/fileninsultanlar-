/**
 * Yapay zekâ — rakip oyuncular ve 2v2 modundaki takım arkadaşı.
 *
 * Yaklaşım: topun düşeceği noktayı ileri simülasyonla tahmin et, oraya
 * yürü, temas mesafesine girince vuruş tuşunu bas. Zorluk kademesi
 * tepki gecikmesi, hata payı ve hız çarpanıyla ayarlanır.
 *
 * Yapay zekâ oyuncunun kullandığı `input` nesnesinin aynısını doldurur —
 * yani motor açısından AI ile insan oyuncu arasında fark yoktur.
 */

import {
  DIVE,
  GAME_WIDTH,
  GROUND_Y,
  NET,
  PHYSICS,
  WALL_PAD,
  xToSpread,
} from './constants.js';
import { contactDistance } from './reach.js';

/** Vuruş tuşuna temas eşiğinden bu kadar px önce basılır. */
const PRESS_LEAD = 20;

/** Görevli takım arkadaşı bu payla yetişiyorsa top onundur. */
const YIELD_MARGIN = 30;

/** Yol veren oyuncunun düşüş noktasına bırakacağı boşluk (px). */
const CLEAR_RADIUS = 110;

/** İnsan oyuncunun topa uzaklığı bu çarpanla kısaltılır (top onun sayılır). */
const HUMAN_PRIORITY = 0.5;

/**
 * Topun verilen yüksekliğe ineceği x koordinatını tahmin eder.
 * Duvar sekmelerini de hesaba katar.
 *
 * @param {object} ball
 * @param {number} targetY Tahminin durduğu yükseklik
 * @returns {{x: number, t: number}}
 */
export function predictLanding(ball, targetY = GROUND_Y - PHYSICS.ballRadius) {
  let { x, y, vx, vy } = ball;
  const r = ball.radius;
  const step = 1 / 120;
  const maxSteps = 480; // ~4 saniye

  for (let i = 0; i < maxSteps; i += 1) {
    vy += PHYSICS.ballGravity * step;
    x += vx * step;
    y += vy * step;

    // Yan duvarlar
    if (x - r <= WALL_PAD) {
      x = WALL_PAD + r;
      vx = -vx * PHYSICS.wallRestitution;
    } else if (x + r >= GAME_WIDTH - WALL_PAD) {
      x = GAME_WIDTH - WALL_PAD - r;
      vx = -vx * PHYSICS.wallRestitution;
    }

    if (vy > 0 && y >= targetY) {
      return { x, t: i * step };
    }
  }

  return { x, t: maxSteps * step };
}

/**
 * Topun KARŞILANACAĞI nokta — düşeceği nokta değil.
 *
 * Fark kritik. `predictLanding` topun ZEMİNE değeceği x'i verir; oysa
 * temas dairesinin merkezi yerden `hitOffsetY` (44px) yukarıdadır ve top
 * o yüksekliği daha ERKEN, dolayısıyla daha GERİDE geçer. Aradaki fark
 * topun yatay hızıyla orantılı: sert bir serviste 30–45px, yani temas
 * yarıçapının neredeyse tamamı.
 *
 * Rakip zemin noktasına gidip beklediği için top hep bir adım ötesinden
 * geçiyordu. Bu sistematik bir kayma, rastgele bir sapma değil — `error`
 * kolunu kısmanın neden hiçbir şeyi düzeltmediğini de bu açıklıyor:
 * nişanı hatasız alsanız da yanlış noktayı nişanlıyordunuz.
 *
 * @param {object} player
 * @param {object} ball
 */
export function interceptPoint(player, ball) {
  const contactY = GROUND_Y - (player.hitOffsetY ?? 44);

  // Top zaten temas yüksekliğinin altındaysa (dibe inmiş) zemine bak
  if (ball.y >= contactY) return predictLanding(ball);

  return predictLanding(ball, contactY);
}

/**
 * Top oyuncunun x'ine vardığında hangi yükseklikte olacak?
 *
 * Sıçrama kararı için gerekli: sıçramak ancak top ayakta erişilebilecek
 * bandın ÜSTÜNDE kalıyorsa kazanç sağlar, aksi hâlde temas merkezini
 * yükseltip topun altından geçmesine yol açar.
 *
 * @param {object} player
 * @param {object} ball
 * @returns {number|null} y koordinatı, top oyuncuya hiç ulaşmıyorsa null
 */
export function arrivalHeight(player, ball) {
  let { x, y, vx, vy } = ball;
  const r = ball.radius;
  const step = 1 / 120;
  const maxSteps = 240; // ~2 saniye

  const startGap = Math.abs(x - player.x);
  let bestGap = startGap;
  let bestY = null;

  for (let i = 0; i < maxSteps; i += 1) {
    vy += PHYSICS.ballGravity * step;
    x += vx * step;
    y += vy * step;

    // Duvardan sekip geri gelebilir; o yüzden ilk uzaklaşmada durmuyoruz
    if (x - r <= WALL_PAD) {
      x = WALL_PAD + r;
      vx = -vx * PHYSICS.wallRestitution;
    } else if (x + r >= GAME_WIDTH - WALL_PAD) {
      x = GAME_WIDTH - WALL_PAD - r;
      vx = -vx * PHYSICS.wallRestitution;
    }

    const gap = Math.abs(x - player.x);
    if (gap < bestGap) {
      bestGap = gap;
      bestY = y;
    }

    // Yere değdiyse artık gelmiyor
    if (y + r >= GROUND_Y) break;
  }

  // Hiç yaklaşmadıysa bu top bize gelmiyor
  return bestY;
}

/**
 * Bir dalışın verilen süre içinde kapatabileceği yatay mesafe.
 *
 * Dalış sabit hızla değil, sürtünmeyle yavaşlayarak ilerler. Bunu
 * hesaplamadan "yetişemiyorsam dalayım" demek, yetişilemeyecek topa
 * dalıp yerde kilitli kalmak demek oluyordu — dalış oyuncuyu
 * kurtaracağına cezalandırıyordu.
 *
 * @param {number} t Topun yere inmesine kalan süre
 */
export function diveDistance(t) {
  const capped = Math.min(t, DIVE.duration);
  return Math.max(0, DIVE.speed * capped - 0.5 * DIVE.friction * capped * capped);
}

/**
 * Bir AI oyuncusunun girdilerini günceller.
 *
 * @param {object} player  Motor içindeki oyuncu nesnesi
 * @param {object} ball
 * @param {object} opts
 * @param {object} opts.difficulty DIFFICULTY kademesi
 * @param {boolean} opts.chasing   Bu oyuncu topu kovalamakla görevli mi
 * @param {number} opts.homeX      Görevli değilken duracağı nokta
 * @param {number} opts.slowFactor Alevli top vb. durumlarda tepki cezası
 * @param {object[]} opts.foes     Karşı taraftaki oyuncular (nişan için)
 * @param {number} dt
 */
export function updateAI(player, ball, opts, dt) {
  const {
    difficulty,
    chasing,
    homeX,
    slowFactor = 1,
    foes = [],
    yieldTo = null,
  } = opts;
  const input = player.input;

  input.left = false;
  input.right = false;
  input.up = false;
  input.action = false;
  input.dive = false;

  // --- Tepki gecikmesi: hedefi belirli aralıklarla yenile ---
  player.aiTimer -= dt;
  if (player.aiTimer <= 0) {
    player.aiTimer = difficulty.reaction / slowFactor;

    if (chasing) {
      const landing = interceptPoint(player, ball);
      const error = (Math.random() * 2 - 1) * difficulty.error;
      player.aiTargetX = landing.x + error;
    } else {
      player.aiTargetX = coverSpot(player, ball, homeX, yieldTo);
    }

    // Bir sonraki vuruşun nişanını da bu anda seç
    player.aimSpread = chooseAim(player, foes, difficulty);
  }

  // Hedefi kendi yarı sahasına sıkıştır
  const bounds = sideBounds(player.side, player.hitRadius * 0.5);
  const target = clamp(player.aiTargetX, bounds.min, bounds.max);

  // --- Yatay hareket ---
  const deadZone = 12;
  const delta = target - player.x;

  if (delta < -deadZone) {
    input.left = true;
  } else if (delta > deadZone) {
    input.right = true;
  }

  // Zorluk hızı: motor bu çarpanı okuyup hareketi ölçekler
  player.aiSpeedScale = difficulty.speed * slowFactor;

  /*
   * --- Topa temas kararı ---
   *
   * Bu kapı bilerek GEVŞEK: file düzleminin 40px ötesindeki topa da
   * hazırlanılır. Kuralı motor uyguluyor (`mayTouch`), burası yalnızca
   * "hazırlan" sezgisi — erken tuşa basmanın bedeli yok, çünkü motor
   * yasal olmayan temasa zaten izin vermiyor.
   *
   * Kapıyı `mayTouch` ile birebir sıkılaştırmayı denedim ve ölçüm
   * reddetti: rakip file üstünde blok/hücum için hazırlanamıyor, topun
   * düzlemi geçmesini bekleyip geç kalıyordu. Sayı payı (ev) zorda
   * %43'ten %69'a fırladı, ralli teması 9.2'den 6.1'e düştü — yani
   * rakip oyundan düştü.
   */
  const onOwnSide =
    player.side === 'home' ? ball.x < NET.x + 40 : ball.x > NET.x - 40;

  const dx = Math.abs(ball.x - player.x);
  const ballHeight = GROUND_Y - ball.y;

  /*
   * Takım arkadaşına yol ver.
   *
   * 2v2'de görevli olmayan oyuncu da menzile giren her topa vuruyordu.
   * Yapay zekâ insandan hızlı karar verdiği için top pratikte hiç
   * oyuncuya gelmiyor, partner maçı tek başına oynuyordu — oyuncu
   * seyirciye dönüyordu.
   *
   * Artık görevli olmayan oyuncu, görevli olan topa YETİŞEBİLECEKSE
   * elini çeker: vurmaz, sıçramaz, dalmaz. Yetişemeyecekse (ör. insan
   * oyuncu geç kaldı) devreye girer — yol vermek, topu yere bırakmak
   * demek değil.
   */
  const standDown = !chasing && shouldYield(player, ball, yieldTo);

  if (onOwnSide && !standDown) {
    /*
     * Sıçramanın ölçütü "top yüksek mi" değil, "sıçramak ERİŞİM
     * KAZANDIRIYOR mu".
     *
     * Eskiden "yakın ve yüksek top" yetiyordu, servis de bu tanıma
     * uyuyordu: rakip her servise sıçrıyor, sıçrayınca temas merkezi
     * yükseliyor ve top tam altından geçiyordu. Ölçümde as olan
     * servislerin %60–95'inde rakip havadaydı ve topa hiç menzile
     * girememişti (62px, erişim 54px) — yani sıçramak topu KAÇIRMA
     * sebebiydi.
     *
     * Bunu "sert gelen topa sıçrama" diye yazmak fazla genişti: ralli
     * içindeki her vuruş da sert geliyor, rakip hiç hücuma kalkamayıp
     * her seviyede maçı kaybediyordu (ralli teması 8 → 3.1).
     *
     * Doğru ölçüt geometrik: top bize ulaştığında AYAKTA erişimin
     * üstünde kalıyorsa sıçra, kalmıyorsa ayakta karşıla.
     */
    const standingTop =
      player.y - player.hitOffsetY - contactDistance(player, ball, { acting: true });
    const arriveY = arrivalHeight(player, ball);
    const jumpGainsReach = arriveY !== null && arriveY < standingTop;

    const shouldJump =
      player.onGround &&
      dx < 95 &&
      ballHeight > 120 &&
      ball.vy > -40 &&
      jumpGainsReach &&
      player.aiJumpCooldown <= 0;

    if (shouldJump) {
      input.up = true;
      player.aiJumpCooldown = 0.5;
    }

    /*
     * Temas mesafesinde vuruş tuşuna bas.
     *
     * Eşik motorunkiyle AYNI fonksiyondan gelir (`reach.js`). Burada
     * sabit bir sayı kullanıldığında rakip, hızlı toplarda gerçekte
     * menzil dışındayken menzilde sanıp boşa vuruyordu — servislerin
     * üçte biri as oluyordu.
     *
     * `acting: true` ile hesaplanır: tuşa basacağımız için erişim
     * bonusu zaten uygulanacak.
     */
    const reach = contactDistance(player, ball, { acting: true });
    const dist = Math.hypot(ball.x - player.x, ball.y - (player.y - player.hitOffsetY));
    /*
     * Tuşa tam eşikte değil, biraz erken basılır. Basmak erişimi
     * ARTIRDIĞI için erken basmanın bedeli yok; geç basmanın bedeli ise
     * bonusun temas karesinde henüz uygulanmamış olması. İnsan oyuncu da
     * tuşu topa yaklaşırken basılı tutuyor.
     */
    if (dist < reach + PRESS_LEAD) {
      input.action = true;

      /*
       * Havadayken bazen smaç yerine plase. İnsana verilip yapay zekâya
       * verilmeseydi hücum dengesi tek taraflı bozulurdu: oyuncu her
       * blokta plaseye kaçarken rakip hep dip çizgiye smaç atardı.
       *
       * Karar bilinçli: rakip savunması file dibini boş bıraktıysa
       * plase mantıklı, dipte kimse yoksa smaç. `placement` becerisi
       * arttıkça bu ayrımı daha sık doğru yapar.
       */
      if (!player.onGround && shouldTip(player, foes, difficulty)) {
        input.dive = true;
      }
    }

    // Koşarak yetişemeyeceği topa dal.
    // İnsan oyuncuya bu hamle verilip yapay zekâya verilmeseydi
    // savunma dengesi tek taraflı bozulurdu.
    if (chasing && player.diveCooldown <= 0 && player.onGround) {
      const landing = predictLanding(ball);
      const gap = Math.abs(landing.x - player.x);
      const runReach =
        player.hitRadius + PHYSICS.playerSpeed * difficulty.speed * landing.t;

      // Yapay zekâ da insan gibi mesafeyi yanlış ölçebilir
      const misjudge = (Math.random() * 2 - 1) * difficulty.error * 0.4;

      // Dalış yalnızca son çaredir. Belirgin bir fark yoksa koşmak
      // her zaman daha iyidir: ıskalanan dalış oyuncuyu yarım saniye
      // yerde kilitler. Bu pay olmadan koşarak yetişilecek toplara da
      // dalınıyor ve dalış kazandırmaktan çok kaybettiriyordu.
      const tooFarToRun = gap > runReach + 25;
      const withinDiveRange =
        gap + misjudge < runReach + diveDistance(landing.t);
      const soon = landing.t < 0.45;
      // Dalış alçak toplar içindir; yüksek topu ayakta karşılarsın
      const lowBall = ball.y > GROUND_Y - 150 || ball.vy > 0;

      if (
        tooFarToRun &&
        withinDiveRange &&
        soon &&
        lowBall &&
        Math.random() < difficulty.diveSkill
      ) {
        input.dive = true;
        if (landing.x < player.x) input.left = true;
        else input.right = true;
      }
    }
  }

  player.aiJumpCooldown = Math.max(0, player.aiJumpCooldown - dt);
}

/**
 * Görevli olmayan oyuncu topa karışmalı mı?
 *
 * Ölçüt: görevli olan (`yieldTo`) topun düşeceği noktaya kendi koşu
 * menzili içinde varabiliyor mu? Varabiliyorsa bu top onun.
 *
 * `yieldTo` yoksa (1v1, ya da görevli zaten bu oyuncu) yol verilmez —
 * yoksa kimsenin dokunmadığı toplar yere düşerdi.
 *
 * @param {object} player Yol vermeyi düşünen oyuncu
 * @param {object} ball
 * @param {object|null} yieldTo Topu kovalamakla görevli takım arkadaşı
 * @returns {boolean}
 */
export function shouldYield(player, ball, yieldTo) {
  if (!yieldTo || yieldTo === player) return false;

  const landing = predictLanding(ball);
  const ownerGap = Math.abs(yieldTo.x - landing.x);
  const ownerReach =
    yieldTo.hitRadius +
    PHYSICS.playerSpeed * (yieldTo.aiSpeedScale ?? 1) * landing.t;

  // Görevli kıl payı yetişiyorsa da yol ver: iki oyuncunun aynı topa
  // gitmesi 2v2'de en sık çarpışma sebebi.
  return ownerGap < ownerReach + YIELD_MARGIN;
}

/**
 * Görevli olmayan oyuncunun duracağı nokta.
 *
 * Sadece `homeX`'te beklemek yetmiyordu: top tam oraya düştüğünde
 * görevlinin önünü kesiyordu. Topun düşeceği noktaya çok yakınsa
 * kenara çekilir, değilse kendi bölgesini kapatır.
 */
function coverSpot(player, ball, homeX, yieldTo) {
  const jitter = (Math.random() * 2 - 1) * 20;
  if (!yieldTo || yieldTo === player) return homeX + jitter;

  const landing = predictLanding(ball);
  const bounds = sideBounds(player.side, player.hitRadius * 0.5);
  if (Math.abs(homeX - landing.x) > CLEAR_RADIUS) return homeX + jitter;

  // Düşüş noktasının ters tarafına açıl
  const away = homeX <= landing.x ? -1 : 1;
  return clamp(landing.x + away * CLEAR_RADIUS, bounds.min, bounds.max);
}

/**
 * Vuruşun rakip sahada nereye gideceğini seçer (0 = file dibi, 1 = dip çizgi).
 *
 * Bu olmadan yapay zekânın nişanı, topa gövdesinin neresiyle dokunduğuna
 * bağlı kalıyor: isabetli AI topun tam altına gittiği için hep aynı
 * noktadan vuruyor, dolayısıyla hep aynı yere atıyor ve tahmin edilebilir
 * oluyordu — yani "zor" seviye "kolay"dan daha kolay oynuyordu.
 *
 * Artık nişan bilinçli: rakibin en uzak olduğu boşluk hedeflenir,
 * `placement` becerisi arttıkça rastgelelik azalır.
 *
 * @param {object} player
 * @param {object[]} foes Karşı taraftaki oyuncular
 * @param {object} difficulty
 * @returns {number} 0–1 aralığında nişan oranı
 */
export function chooseAim(player, foes, difficulty) {
  const random = Math.random() * 0.86 + 0.07;
  if (foes.length === 0) return random;

  const toOpponent = player.side === 'home' ? 1 : -1;

  // Adayların içinden savunmacılara en uzak olanı seç
  const candidates = [0.1, 0.28, 0.5, 0.72, 0.92];
  let best = random;
  let bestGap = -Infinity;

  candidates.forEach((spread) => {
    const gap = Math.min(
      ...foes.map((foe) => Math.abs(xToSpread(foe.x, toOpponent) - spread))
    );
    if (gap > bestGap) {
      bestGap = gap;
      best = spread;
    }
  });

  // Beceri arttıkça bilinçli nişan ağır basar
  const skill = difficulty.placement ?? 0.5;
  return clamp(best * skill + random * (1 - skill), 0.07, 0.95);
}

/**
 * Havadaki AI smaç yerine plase mi yapmalı?
 *
 * Ölçüt basit ve okunur: rakip savunması fileden uzaktaysa file dibi
 * boştur, plase oraya düşer. Beceri düştükçe karar rastgeleleşir, yani
 * "kolay" rakip bazen boşuna plase yapar — bu kasıtlı.
 *
 * @param {object} player
 * @param {object[]} foes
 * @param {object} difficulty
 */
export function shouldTip(player, foes, difficulty) {
  if (foes.length === 0) return false;

  // Rakip sahanın file dibine en yakın savunmacısı nerede?
  const nearestDepth = Math.min(
    ...foes.map((foe) => Math.abs(foe.x - NET.x))
  );

  const skill = difficulty.placement ?? 0.4;
  // Savunma file dibinden uzaksa plase kazançlı
  const gapIsOpen = nearestDepth > 150;
  const chance = gapIsOpen ? 0.15 + skill * 0.4 : 0.04;

  return Math.random() < chance;
}

/**
 * Bir takımdaki AI oyuncuları arasında topu kimin kovalayacağını seçer.
 * Tahmini düşüş noktasına en yakın olan görevlendirilir; insan oyuncu
 * daha yakınsa AI geri çekilir (topunu çalmaz).
 *
 * @param {object[]} teamPlayers
 * @param {object} ball
 * @returns {string | null} Kovalayacak oyuncunun id'si
 */
export function pickChaser(teamPlayers, ball) {
  if (teamPlayers.length === 0) return null;

  const landing = predictLanding(ball);
  let best = null;
  let bestDist = Infinity;

  teamPlayers.forEach((p) => {
    const dist = Math.abs(p.x - landing.x);
    /*
     * İnsan oyuncuya belirgin bir öncelik payı.
     *
     * Pay 0.8 iken yeterli değildi: yapay zekâ tepki gecikmesi yaşamadan
     * ve hatasız koştuğu için topların çoğunu o kapıyordu, oyuncu 2v2'de
     * kendi maçını seyrediyordu. `HUMAN_PRIORITY` insanın mesafesini
     * yapay olarak kısaltır — yani "eşit uzaklıktaysanız top senin,
     * hatta biraz uzaktaysan bile senin".
     */
    const weighted = p.controlled ? dist * HUMAN_PRIORITY : dist;
    if (weighted < bestDist) {
      bestDist = weighted;
      best = p;
    }
  });

  return best ? best.id : null;
}

/** Bir tarafın oyuncusunun kalabileceği x aralığı. */
export function sideBounds(side, pad = 0) {
  const netEdge = NET.width / 2 + pad;
  if (side === 'home') {
    return { min: WALL_PAD + pad, max: NET.x - netEdge };
  }
  return { min: NET.x + netEdge, max: GAME_WIDTH - WALL_PAD - pad };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
