import { GAME_WIDTH, GROUND_Y, NET, PHYSICS, WALL_PAD } from './constants.js';

/**
 * Topun serbest uçuş fiziği — bir karelik adım.
 *
 * ## Neden ayrı bir modül
 *
 * Bu fizik iki yerden okunuyor: motor topu gerçekten uçururken, servis
 * göstergesi ise "bu güç ve nişanla ne olur" diye önden hesaplarken.
 * İkisi ayrı ayrı yazılmıştı ve kaçınılmaz olarak ayrıştılar — ölçümde
 * tahmin ile gerçek sonuç yalnızca %79 uyuşuyordu. Fark file üstü
 * bandındaydı: motorda banda çarpan top yukarı sekip oyunda kalabiliyor,
 * tahminde ise doğrudan "file faulü" sayılıyordu. Yani bardaki yeşil
 * bölge oyuncuya yalan söylüyordu.
 *
 * Tek fonksiyon = ikisi ayrışamaz.
 *
 * Ses ve parçacık gibi sunum işleri burada yok; çağıran taraf dönen
 * olaya bakıp kendi efektini oynatır.
 *
 * @param {{ x:number, y:number, vx:number, vy:number, radius:number }} ball
 * @param {number} dt
 * @returns {{ net: 'tape' | 'side' | null, wall: boolean }}
 */
export function stepBall(ball, dt) {
  ball.vy += PHYSICS.ballGravity * dt;
  ball.vx *= PHYSICS.ballAirDrag;

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  let wall = false;

  // Yan duvarlar
  if (ball.x - ball.radius <= WALL_PAD) {
    ball.x = WALL_PAD + ball.radius;
    ball.vx = Math.abs(ball.vx) * PHYSICS.wallRestitution;
    wall = true;
  } else if (ball.x + ball.radius >= GAME_WIDTH - WALL_PAD) {
    ball.x = GAME_WIDTH - WALL_PAD - ball.radius;
    ball.vx = -Math.abs(ball.vx) * PHYSICS.wallRestitution;
    wall = true;
  }

  // Tavan
  if (ball.y - ball.radius <= 0) {
    ball.y = ball.radius;
    ball.vy = Math.abs(ball.vy) * 0.5;
  }

  return { net: resolveNet(ball), wall };
}

/**
 * File çarpışması — yan yüzey ve üst bant.
 * @returns {'tape' | 'side' | null}
 */
export function resolveNet(ball) {
  const netLeft = NET.x - NET.width / 2;
  const netRight = NET.x + NET.width / 2;

  const withinColumn =
    ball.x + ball.radius > netLeft && ball.x - ball.radius < netRight;

  if (!withinColumn) return null;

  // Üst bandın üstünden geçiyor
  if (ball.y + ball.radius < NET.topY) return null;

  /*
   * Bandın hemen üstüne düşerse hafifçe seker.
   *
   * Voleyboldaki "file kenarı" topu: kurallara göre oyundadır. Servis
   * tahmini bunu hesaba katmazsa düşük güçlü servislerin bir kısmı
   * yanlışlıkla faul gösterilir.
   */
  if (ball.vy > 0 && ball.y < NET.topY && ball.y + ball.radius >= NET.topY) {
    ball.y = NET.topY - ball.radius;
    ball.vy = -Math.abs(ball.vy) * 0.45;
    ball.vx *= 1.1;
    return 'tape';
  }

  // Yan yüzeye çarptı
  if (ball.x < NET.x) {
    ball.x = netLeft - ball.radius;
    ball.vx = -Math.abs(ball.vx) * PHYSICS.netRestitution;
  } else {
    ball.x = netRight + ball.radius;
    ball.vx = Math.abs(ball.vx) * PHYSICS.netRestitution;
  }
  return 'side';
}

/** Top yere değdi mi? */
export function onGround(ball) {
  return ball.y + ball.radius >= GROUND_Y;
}
