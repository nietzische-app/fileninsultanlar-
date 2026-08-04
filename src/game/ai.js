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
  const { difficulty, chasing, homeX, slowFactor = 1, foes = [] } = opts;
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
      const landing = predictLanding(ball);
      const error = (Math.random() * 2 - 1) * difficulty.error;
      player.aiTargetX = landing.x + error;
    } else {
      player.aiTargetX = homeX + (Math.random() * 2 - 1) * 20;
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

  // --- Topa temas kararı ---
  const onOwnSide =
    player.side === 'home' ? ball.x < NET.x + 40 : ball.x > NET.x - 40;

  const dx = Math.abs(ball.x - player.x);
  const ballHeight = GROUND_Y - ball.y;

  if (onOwnSide) {
    // Yakın ve yüksek toplarda sıçra
    const shouldJump =
      player.onGround &&
      dx < 95 &&
      ballHeight > 120 &&
      ball.vy > -40 &&
      player.aiJumpCooldown <= 0;

    if (shouldJump) {
      input.up = true;
      player.aiJumpCooldown = 0.5;
    }

    // Temas mesafesinde vuruş tuşuna bas
    const reach = player.hitRadius + ball.radius + 26;
    const dist = Math.hypot(ball.x - player.x, ball.y - (player.y - player.hitOffsetY));
    if (dist < reach) {
      input.action = true;
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
    // İnsan oyuncuya küçük bir öncelik payı — AI onun topunu kesmesin
    const weighted = p.controlled ? dist * 0.8 : dist;
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
