/**
 * Filenin Sultanları — arcade voleybol motoru.
 *
 * Slime Volleyball tarzı akıcı fizik: her oyuncunun bir "temas dairesi"
 * vardır, top bu daireye çarptığı noktanın normaline göre sekerek yön
 * alır. Vuruş tuşu erişimi ve gücü artırır; havada basılırsa smaç olur.
 *
 * Motor React'ten bağımsızdır — bir <canvas> alır, kendi
 * requestAnimationFrame döngüsünü kurar ve dışarıya yalnızca
 * `onState` / `onFinish` callback'leriyle konuşur.
 */

import {
  DIFFICULTY,
  DIVE,
  FORMATS,
  GAME_HEIGHT,
  GAME_WIDTH,
  GROUND_Y,
  NET,
  PALETTE,
  PHASE,
  PHYSICS,
  PLAYER,
  RULES,
  SULTAN,
  WALL_PAD,
} from './constants.js';
import {
  DEFAULT_PLAYER_ID,
  getModifier,
  getPlayerById,
} from './players.js';
import {
  buildAwayPlayers,
  getOpponentTeam,
  pickRandomOpponent,
} from './opponents.js';
import { pickChaser, sideBounds, updateAI } from './ai.js';
import { drawBall, drawSultan } from './sprites.js';
import { drawArena, drawFloor, drawNet } from './arena.js';
import {
  clearsNet as shotClearsNet,
  computeAttackVelocity,
  computeSetVelocity,
} from './ballistics.js';
import { clamp } from './math.js';
import {
  applyTouch,
  canAttackOnTouch,
  isMatchOver,
  isSetOver,
  matchWinner,
  resolveHitType,
  setWinner,
} from './rules.js';
import Sfx from './audio.js';
import { upper } from '../utils/text.js';

/** Klavye tuşu → mantıksal girdi eşlemesi. */
const KEY_MAP = {
  ArrowLeft: 'left',
  a: 'left',
  A: 'left',
  ArrowRight: 'right',
  d: 'right',
  D: 'right',
  ArrowUp: 'up',
  w: 'up',
  W: 'up',
  ArrowDown: 'dive',
  s: 'dive',
  S: 'dive',
  ' ': 'action',
  z: 'action',
  Z: 'action',
  x: 'sultan',
  X: 'sultan',
};

export default class Game {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} options
   * @param {'1v1'|'2v2'} options.mode
   * @param {string[]} options.homeIds Seçilen sultanların id'leri
   * @param {'kolay'|'normal'|'zor'} [options.difficulty]
   * @param {'classic'|'single'|'practice'} [options.format]
   * @param {string} [options.opponentId] Rakip takım id — yoksa rastgele
   * @param {(state: object) => void} [options.onState]
   * @param {(result: object) => void} [options.onFinish]
   */
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.mode = options.mode === '2v2' ? '2v2' : '1v1';
    this.perSide = this.mode === '2v2' ? 2 : 1;
    this.difficulty = DIFFICULTY[options.difficulty] ?? DIFFICULTY.normal;
    this.format = FORMATS[options.format] ?? FORMATS.classic;
    this.rules = { ...RULES, ...this.format.rules };
    this.opponent =
      getOpponentTeam(options.opponentId) ?? pickRandomOpponent();
    this.onState = options.onState ?? (() => {});
    this.onFinish = options.onFinish ?? (() => {});

    this.homeIds = (options.homeIds ?? [DEFAULT_PLAYER_ID]).slice(0, this.perSide);
    while (this.homeIds.length < this.perSide) {
      this.homeIds.push(DEFAULT_PLAYER_ID);
    }

    this.running = false;
    this.rafId = null;
    this.lastTime = 0;
    this.time = 0;

    /** İnsan oyuncunun girdileri (klavye + dokunmatik ortak). */
    this.input = {
      left: false,
      right: false,
      up: false,
      down: false,
      action: false,
      dive: false,
      sultan: false,
    };
    this.sultanKeyLatch = false;

    // Maç durumu
    this.score = { home: 0, away: 0 };
    this.sets = { home: 0, away: 0 };
    this.setHistory = [];
    this.setNumber = 1;
    this.servingSide = 'home';
    this.streak = { side: null, count: 0 };

    /** Üç temas kuralı takibi — hangi taraf kaç kez dokundu. */
    this.touch = { side: null, count: 0 };

    // Sultan Gücü
    this.sultanCharge = 0;
    this.sultanArmed = false;
    this.sultanWasReady = false;

    this.phase = PHASE.READY;
    this.phaseTimer = this.rules.readyPause;
    this.message = null;

    this.particles = [];
    /** Vuruş anında genişleyen darbe halkaları. */
    this.rings = [];
    /** Topun son konumları — hızlıyken iz bırakır. */
    this.ballTrail = [];
    /** Sayı sonrası tribün coşkusu (0–1, zamanla söner). */
    this.hype = 0;
    this.shake = 0;
    this.finished = false;

    this.stats = { spikes: 0, blocks: 0, saves: 0, longestRally: 0, rallyTouches: 0 };

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.loop = this.loop.bind(this);

    this.players = this.createPlayers();
    this.ball = this.createBall('home');
    this.resetPositions();

    this.lastSignature = '';
  }

  // ===================================================================
  // Yaşam döngüsü
  // ===================================================================

  start() {
    if (this.running || this.finished) return;
    this.running = true;
    this.lastTime = performance.now();

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    this.rafId = requestAnimationFrame(this.loop);
    this.emitState(true);
  }

  stop() {
    if (!this.running) return;
    this.running = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);

    // Duraklatınca son kare ekranda kalsın
    this.render();
    this.emitState(true);
  }

  destroy() {
    this.stop();
    this.particles.length = 0;
    this.rings.length = 0;
    this.ballTrail.length = 0;
  }

  // ===================================================================
  // Varlıklar
  // ===================================================================

  createPlayers() {
    const players = [];

    this.homeIds.forEach((id, index) => {
      const data = getPlayerById(id) ?? getPlayerById(DEFAULT_PLAYER_ID);
      players.push(this.makePlayer(`home-${index}`, data, 'home', index === 0));
    });

    const awayRoster = buildAwayPlayers(this.opponent, this.perSide);
    awayRoster.forEach((data, i) => {
      players.push(this.makePlayer(`away-${i}`, data, 'away', false));
    });

    return players;
  }

  makePlayer(id, data, side, controlled) {
    return {
      id,
      data,
      side,
      controlled,
      x: 0,
      y: GROUND_Y,
      vx: 0,
      vy: 0,
      onGround: true,
      facing: side === 'home' ? 1 : -1,
      pose: 'idle',
      runFrame: 0,
      hitCooldown: 0,
      hitRadius: PLAYER.hitRadius * getModifier(data, 'reach'),
      hitOffsetY: PLAYER.hitOffsetY,
      input: { left: false, right: false, up: false, action: false, dive: false },
      // Dalış durumu
      diveTimer: 0,
      recoverTimer: 0,
      diveCooldown: 0,
      diveDir: 1,
      // AI durumu
      aiTimer: 0,
      aiTargetX: 0,
      aiJumpCooldown: 0,
      aiSpeedScale: 1,
      aimSpread: 0.5,
      squash: 0,
    };
  }

  createBall(side) {
    return {
      x: side === 'home' ? GAME_WIDTH * 0.25 : GAME_WIDTH * 0.75,
      y: 130,
      vx: 0,
      vy: 0,
      radius: PHYSICS.ballRadius,
      rotation: 0,
      flaming: 0,
      lastHitBy: null,
      lastHitSide: null,
    };
  }

  /** Oyuncuları set/sayı başı dizilişine yerleştirir. */
  resetPositions() {
    const homeSpots =
      this.perSide === 1 ? [0.26] : [0.14, 0.36];
    const awaySpots =
      this.perSide === 1 ? [0.74] : [0.64, 0.86];

    let homeIndex = 0;
    let awayIndex = 0;

    this.players.forEach((player) => {
      const spots = player.side === 'home' ? homeSpots : awaySpots;
      const index = player.side === 'home' ? homeIndex++ : awayIndex++;

      player.x = GAME_WIDTH * spots[index];
      player.homeX = player.x;
      player.y = GROUND_Y;
      player.vx = 0;
      player.vy = 0;
      player.onGround = true;
      player.pose = 'idle';
      player.hitCooldown = 0;
      player.diveTimer = 0;
      player.recoverTimer = 0;
      player.diveCooldown = 0;
      player.aiTimer = 0;
      player.aiJumpCooldown = 0;
      player.facing = player.side === 'home' ? 1 : -1;
    });
  }

  /** Yeni ralli — top servis atan tarafın üstünde belirir. */
  resetRally(servingSide) {
    this.resetPositions();
    this.ball = this.createBall(servingSide);
    this.ballTrail.length = 0;
    this.touch = { side: null, count: 0 };
    this.stats.rallyTouches = 0;
  }

  /** İnsan oyuncunun kontrol ettiği sultan. */
  getControlledPlayer() {
    return this.players.find((p) => p.controlled);
  }

  // ===================================================================
  // Girdi
  // ===================================================================

  handleKeyDown(event) {
    const action = KEY_MAP[event.key];
    if (!action) return;
    event.preventDefault();

    if (action === 'sultan') {
      // Tek basışta bir kez tetiklensin (tuş basılı tutulunca tekrarlamasın)
      if (!this.sultanKeyLatch) {
        this.sultanKeyLatch = true;
        this.activateSultan();
      }
      return;
    }

    this.input[action] = true;
  }

  handleKeyUp(event) {
    const action = KEY_MAP[event.key];
    if (!action) return;
    event.preventDefault();

    if (action === 'sultan') {
      this.sultanKeyLatch = false;
      return;
    }

    this.input[action] = false;
  }

  /**
   * Dokunmatik butonlar için dışarıdan girdi ayarlar.
   * @param {'left'|'right'|'up'|'action'|'sultan'} name
   * @param {boolean} pressed
   */
  setInput(name, pressed) {
    if (name === 'sultan') {
      if (pressed) this.activateSultan();
      return;
    }
    if (name in this.input) {
      this.input[name] = pressed;
    }
  }

  /** Sultan Gücü'nü kurar — bir sonraki temasta alevli top. */
  activateSultan() {
    if (this.sultanCharge < SULTAN.max || this.sultanArmed) return;
    if (this.phase !== PHASE.RALLY) return;

    this.sultanArmed = true;
    Sfx.sultanFire();
    this.spawnBurst(
      this.getControlledPlayer()?.x ?? GAME_WIDTH * 0.25,
      GROUND_Y - 60,
      18,
      PALETTE.gold
    );
    this.emitState(true);
  }

  // ===================================================================
  // Ana döngü
  // ===================================================================

  loop(timestamp) {
    if (!this.running) return;

    const delta = Math.min((timestamp - this.lastTime) / 1000, PHYSICS.maxDelta);
    this.lastTime = timestamp;

    this.update(delta);
    this.render();
    this.emitState();

    this.rafId = requestAnimationFrame(this.loop);
  }

  update(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 60);
    this.hype = Math.max(0, this.hype - dt * 0.9);
    this.updateParticles(dt);
    this.updateRings(dt);
    this.updateBallTrail();

    switch (this.phase) {
      case PHASE.READY:
        this.updatePlayers(dt, false);
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) {
          this.phase = PHASE.RALLY;
          this.message = null;
          Sfx.whistle();
        }
        break;

      case PHASE.RALLY:
        this.updatePlayers(dt, true);
        this.updateBall(dt);
        this.resolveCollisions();
        break;

      case PHASE.POINT:
        this.updatePlayers(dt, false);
        this.updateBall(dt, true);
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) this.afterPoint();
        break;

      case PHASE.SET_END:
        this.updatePlayers(dt, false);
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) this.afterSet();
        break;

      case PHASE.MATCH_END:
      default:
        this.updatePlayers(dt, false);
        break;
    }
  }

  // ===================================================================
  // Oyuncu hareketi
  // ===================================================================

  updatePlayers(dt, active) {
    const ball = this.ball;

    // 2v2'de her takımda topu kovalayacak oyuncuyu seç
    const homeAI = this.players.filter((p) => p.side === 'home' && !p.controlled);
    const awayAI = this.players.filter((p) => p.side === 'away');

    const homeChaser = active ? pickChaser([...homeAI, this.getControlledPlayer()].filter(Boolean), ball) : null;
    const awayChaser = active ? pickChaser(awayAI, ball) : null;

    // Alevli top rakibin tepkisini yavaşlatır
    const slow = ball.flaming > 0 ? SULTAN.aiPenalty : 1;

    this.players.forEach((player) => {
      if (player.controlled) {
        // İnsan girdisi doğrudan aktarılır
        player.input.left = active && this.input.left;
        player.input.right = active && this.input.right;
        player.input.up = active && this.input.up;
        player.input.action = active && this.input.action;
        player.input.dive = active && this.input.dive;
        player.aiSpeedScale = 1;
      } else if (active) {
        const isAway = player.side === 'away';
        updateAI(
          player,
          ball,
          {
            difficulty: this.difficulty,
            chasing: player.id === (isAway ? awayChaser : homeChaser),
            homeX: player.homeX,
            slowFactor: isAway ? slow : 1,
            foes: this.players.filter((p) => p.side !== player.side),
          },
          dt
        );
      } else {
        player.input.left = false;
        player.input.right = false;
        player.input.up = false;
        player.input.action = false;
        player.input.dive = false;
      }

      this.movePlayer(player, dt);
    });
  }

  /** Dalışı başlatır: oyuncu yatay olarak fırlar. */
  startDive(player, input) {
    const dir = input.left ? -1 : input.right ? 1 : player.facing;

    player.diveTimer = DIVE.duration;
    player.diveCooldown = DIVE.cooldown;
    player.diveDir = dir;
    player.facing = dir;
    player.vx = dir * DIVE.speed * getModifier(player.data, 'speed');
    player.vy = 0;
    player.onGround = true;
    player.pose = 'dive';
    player.squash = 0;

    this.spawnDust(player.x - dir * 12, GROUND_Y, 6);
    Sfx.dive();
  }

  /**
   * Kayma ve kalkma aşaması. Bu sırada oyuncu yönlendirilemez —
   * dalışın bedeli budur.
   */
  updateDiving(player, dt) {
    if (player.diveTimer > 0) {
      player.diveTimer -= dt;

      // Sürtünmeyle yavaşla, ters yöne geçme
      const dir = Math.sign(player.vx) || player.diveDir;
      player.vx -= dir * DIVE.friction * dt;
      if (Math.sign(player.vx) !== dir) player.vx = 0;

      player.x += player.vx * dt;

      // Kayma tozu
      if (Math.abs(player.vx) > 140 && Math.random() < 0.55) {
        this.spawnDust(player.x - dir * 16, GROUND_Y, 1);
      }

      if (player.diveTimer <= 0) {
        player.recoverTimer = DIVE.recovery;
        player.vx = 0;
      }
    } else {
      player.recoverTimer -= dt;
    }

    player.y = GROUND_Y;
    player.vy = 0;
    player.onGround = true;
    player.pose = 'dive';

    const bounds = sideBounds(player.side, 22);
    player.x = clamp(player.x, bounds.min, bounds.max);

    player.hitCooldown = Math.max(0, player.hitCooldown - dt);
  }

  movePlayer(player, dt) {
    const { data, input } = player;

    player.diveCooldown = Math.max(0, player.diveCooldown - dt);

    // --- Dalış: kayma ve kalkma hareket kontrolünü devralır ---
    if (player.diveTimer > 0 || player.recoverTimer > 0) {
      this.updateDiving(player, dt);
      return;
    }

    // Dalışı başlat — yerdeyken ve bekleme dolmuşken
    if (input.dive && player.onGround && player.diveCooldown <= 0) {
      this.startDive(player, input);
      return;
    }

    const speed =
      PHYSICS.playerSpeed * getModifier(data, 'speed') * (player.aiSpeedScale ?? 1);
    const control = player.onGround ? 1 : PHYSICS.airControl;

    let dir = 0;
    if (input.left) dir -= 1;
    if (input.right) dir += 1;

    player.vx = dir * speed * control;
    if (dir !== 0) player.facing = dir;

    if (input.up && player.onGround) {
      player.vy = PHYSICS.jumpVelocity * getModifier(data, 'jump');
      player.onGround = false;
    }

    player.vy += PHYSICS.playerGravity * dt;
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    if (player.y >= GROUND_Y) {
      if (!player.onGround) {
        this.spawnDust(player.x, GROUND_Y);
        // Sert inişte ezilme animasyonu
        player.squash = Math.min(0.16, Math.abs(player.vy) / 5000 + 0.06);
      }
      player.y = GROUND_Y;
      player.vy = 0;
      player.onGround = true;
    }

    // Kendi yarı sahasında kal
    const bounds = sideBounds(player.side, 22);
    player.x = Math.max(bounds.min, Math.min(bounds.max, player.x));

    // Poz seçimi
    if (!player.onGround) {
      player.pose = input.action ? 'spike' : 'jump';
    } else if (input.action) {
      player.pose = 'bump';
    } else if (dir !== 0) {
      player.pose = 'run';
      player.runFrame = (player.runFrame + dt * 6) % 1;
    } else {
      player.pose = 'idle';
    }

    player.hitCooldown = Math.max(0, player.hitCooldown - dt);
    player.squash = Math.max(0, (player.squash ?? 0) - dt);
  }

  // ===================================================================
  // Top fiziği
  // ===================================================================

  updateBall(dt, frozen = false) {
    const ball = this.ball;

    ball.flaming = Math.max(0, ball.flaming - dt);

    if (frozen) {
      // Sayı anında top yerinde döner, sahne donar
      ball.rotation += dt * 2;
      return;
    }

    ball.vy += PHYSICS.ballGravity * dt;
    ball.vx *= PHYSICS.ballAirDrag;

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.rotation += ball.vx * dt * 0.03;

    // Alev izi
    if (ball.flaming > 0) {
      this.spawnFlame(ball.x, ball.y);
    }

    // Yan duvarlar
    if (ball.x - ball.radius <= WALL_PAD) {
      ball.x = WALL_PAD + ball.radius;
      ball.vx = Math.abs(ball.vx) * PHYSICS.wallRestitution;
    } else if (ball.x + ball.radius >= GAME_WIDTH - WALL_PAD) {
      ball.x = GAME_WIDTH - WALL_PAD - ball.radius;
      ball.vx = -Math.abs(ball.vx) * PHYSICS.wallRestitution;
    }

    // Tavan
    if (ball.y - ball.radius <= 0) {
      ball.y = ball.radius;
      ball.vy = Math.abs(ball.vy) * 0.5;
    }

    this.resolveNet();

    // Zemin → sayı
    if (ball.y + ball.radius >= GROUND_Y) {
      ball.y = GROUND_Y - ball.radius;
      const landedSide = ball.x < NET.x ? 'home' : 'away';
      this.awardPoint(landedSide === 'home' ? 'away' : 'home', landedSide);
    }
  }

  /** File çarpışması — yan yüzey ve üst bant. */
  resolveNet() {
    const ball = this.ball;
    const netLeft = NET.x - NET.width / 2;
    const netRight = NET.x + NET.width / 2;

    const withinColumn =
      ball.x + ball.radius > netLeft && ball.x - ball.radius < netRight;

    if (!withinColumn) return;

    // Üst bandın üstünden geçiyor
    if (ball.y + ball.radius < NET.topY) return;

    // Bandın hemen üstüne düşerse hafifçe seker
    if (ball.vy > 0 && ball.y < NET.topY && ball.y + ball.radius >= NET.topY) {
      ball.y = NET.topY - ball.radius;
      ball.vy = -Math.abs(ball.vy) * 0.45;
      ball.vx *= 1.1;
      Sfx.net();
      return;
    }

    // Yan yüzeye çarptı
    if (ball.x < NET.x) {
      ball.x = netLeft - ball.radius;
      ball.vx = -Math.abs(ball.vx) * PHYSICS.netRestitution;
    } else {
      ball.x = netRight + ball.radius;
      ball.vx = Math.abs(ball.vx) * PHYSICS.netRestitution;
    }
    Sfx.net();
  }

  /** Top–oyuncu temasları. */
  resolveCollisions() {
    const ball = this.ball;

    // Hızlı topa temiz dokunmak zordur: temas alanı topun hızıyla daralır.
    // Bu olmadan sert smaç ile yavaş pas aynı kolaylıkta kurtarılıyor ve
    // özellikle 2v2'de ralliler hiç bitmiyor.
    const ballSpeed = Math.hypot(ball.vx, ball.vy);
    const speedPenalty = clamp(
      1 - (ballSpeed - PHYSICS.cleanTouchSpeed) / 1600,
      PLAYER.minReachFactor,
      1
    );

    this.players.forEach((player) => {
      if (player.hitCooldown > 0) return;

      const diving = player.diveTimer > 0 || player.recoverTimer > 0;

      // Dalışta gövde yere yakın ve uzanmış: temas merkezi alçalır,
      // erişim artar. Yere düşmek üzere olan topu bu yakalar.
      const cx = player.x;
      const cy = player.y - (diving ? DIVE.hitOffsetY : player.hitOffsetY);
      const bonus = diving
        ? DIVE.reachBonus
        : player.input.action
          ? PLAYER.reachBonus
          : 0;
      const reach = (player.hitRadius + bonus) * speedPenalty;

      const dx = ball.x - cx;
      const dy = ball.y - cy;
      const dist = Math.hypot(dx, dy) || 0.001;

      if (dist > reach + ball.radius) return;

      this.hitBall(player, dx / dist, dy / dist, cx, cy, reach);
    });
  }

  /**
   * Temas çözümü — çarpma noktasının normali yönü belirler.
   *
   * @param {object} player
   * @param {number} nx Normal x
   * @param {number} ny Normal y
   */
  hitBall(player, nx, ny, cx, cy, reach) {
    const ball = this.ball;
    const { data } = player;

    // --- Üç temas kuralı ---
    const touchResult = applyTouch(this.touch, player.side, this.rules);
    this.touch = touchResult.touch;

    if (touchResult.foul) {
      const opponent = player.side === 'home' ? 'away' : 'home';
      this.awardPoint(opponent, player.side, 'ÜÇ TEMAS!');
      return;
    }

    // Topu daireden dışarı it (iç içe geçmeyi engeller)
    ball.x = cx + nx * (reach + ball.radius + 1);
    ball.y = cy + ny * (reach + ball.radius + 1);

    const airborne = !player.onGround;
    const acting = player.input.action;
    const toOpponent = player.side === 'home' ? 1 : -1;

    // Topun geldiği yön — blok tespiti için
    const cameFromOpponent =
      player.side === 'home' ? ball.vx < 0 : ball.vx > 0;

    // Sert gelen topa ilk temasta hücum yapılamaz — önce manşetle
    // karşılanır. Bu kural olmadan her ralli ilk dokunuşta smaçla
    // bitiyor ve karşı taraf hiçbir topu döndüremiyor.
    const incomingSpeed = Math.hypot(ball.vx, ball.vy);
    const attackReady = canAttackOnTouch(
      incomingSpeed,
      this.touch.count,
      PHYSICS.attackControlSpeed
    );

    // Dalış her zaman savunma temasıdır: topu kendi sahanda yükseğe
    // kaldırır, hücuma kalkma hakkını sana bırakır.
    const diving = player.diveTimer > 0 || player.recoverTimer > 0;
    const type = resolveHitType({
      diving,
      acting,
      airborne,
      controlled: attackReady,
    });

    let power;
    if (type === 'spike') {
      power =
        PHYSICS.spikePower *
        getModifier(data, 'spikePower') *
        (0.85 + (data.stats.attack / 100) * 0.3);
    } else if (type === 'hit') {
      power =
        PHYSICS.hitPower *
        getModifier(data, 'bumpPower') *
        (0.85 + (data.stats.defense / 100) * 0.25);
    } else {
      power =
        PHYSICS.bumpPower *
        getModifier(data, 'bumpPower') *
        (0.85 + (data.stats.defense / 100) * 0.25);

      if (type === 'dive') power *= DIVE.liftBoost;
    }

    // Blok: file önünde havada karşılama
    const isBlock =
      airborne && cameFromOpponent && Math.abs(player.x - NET.x) < 120;
    if (isBlock) {
      power *= getModifier(data, 'blockPower');
    }

    // AI zorluk gücü
    if (!player.controlled && player.side === 'away') {
      power *= this.difficulty.power;
    }

    let vx;
    let vy;

    if (type === 'spike') {
      // Havada + vuruş tuşu: rakip sahaya inen sert smaç
      const shot = computeAttackVelocity({
        ball,
        player,
        power,
        toOpponent,
        nx,
        arc: 1,
      });
      vx = shot.vx;
      vy = shot.vy;
      this.stats.spikes += 1;
    } else if (type === 'hit') {
      // Yerde + vuruş tuşu: kavisli, karşı sahaya gönderen vuruş
      const shot = computeAttackVelocity({
        ball,
        player,
        power,
        toOpponent,
        nx,
        arc: 1.5,
      });
      vx = shot.vx;
      vy = shot.vy;
    } else {
      // Manşet ve dalış: savunma teması. Temas noktasının normali yönü
      // verir, top kendi sahanda kalır — sonraki temasta hücuma kalkarsın.
      vx = nx * power + player.vx * 0.3;
      vy = ny * power;

      // Dalış kurtarışı topu daha dik ve yükseğe kaldırır ki yerden
      // aldığın topu toparlayacak zamanın olsun.
      const minLift = type === 'dive' ? DIVE.saveLift : 260;
      if (vy > -minLift) {
        vy = -minLift - Math.random() * 70;
      }
      if (type === 'dive') {
        // Kurtarış yakına kalksın: dalan oyuncunun kalkıp topa
        // yetişebilmesi için top hem yüksek hem yakın olmalı.
        vx = clamp(vx, -DIVE.maxDrift, DIVE.maxDrift);
      }
    }

    // Sultan Gücü — kurulmuşsa bu temasta patlar
    let sultanFired = false;
    if (this.sultanArmed && player.controlled) {
      vx *= SULTAN.speedMultiplier;
      vy *= SULTAN.speedMultiplier;
      ball.flaming = SULTAN.duration;
      this.sultanArmed = false;
      this.sultanCharge = 0;
      this.sultanWasReady = false;
      sultanFired = true;
      this.shake = 14;
      this.spawnBurst(ball.x, ball.y, 26, PALETTE.flame[2]);
    }

    // Mutlak hız tavanı — yalnızca güvenlik amaçlı.
    // Hedefli vuruşlar zaten computeAttackVelocity içinde sınırlanır;
    // burada asıl amaç Sultan Gücü çarpanının kontrolden çıkmaması.
    const speed = Math.hypot(vx, vy);
    if (speed > PHYSICS.ballSpeedCeiling) {
      const scale = PHYSICS.ballSpeedCeiling / speed;
      vx *= scale;
      vy *= scale;
    }

    ball.vx = vx;
    ball.vy = vy;
    ball.lastHitBy = player.id;
    ball.lastHitSide = player.side;

    player.hitCooldown = PHYSICS.hitCooldown;
    this.stats.rallyTouches += 1;
    this.stats.longestRally = Math.max(this.stats.longestRally, this.stats.rallyTouches);

    // Sultan barı dolumu (yalnızca insan oyuncunun tarafı)
    if (player.side === 'home') {
      const chargeMod = getModifier(this.getControlledPlayer()?.data ?? data, 'charge');
      if (type === 'dive') {
        this.addSultanCharge(DIVE.chargeBonus * chargeMod);
        this.stats.saves += 1;
        this.message = { text: 'KURTARIŞ!', timer: 0.8, color: '#9BE7FF' };
      } else if (isBlock) {
        this.addSultanCharge(SULTAN.onBlock * chargeMod);
        this.stats.blocks += 1;
        this.message = { text: 'BLOK!', timer: 0.7, color: PALETTE.gold };
      } else {
        this.addSultanCharge(SULTAN.onRally * chargeMod);
      }
    }

    // Ses ve parçacık
    if (!sultanFired) {
      if (type === 'dive') Sfx.save();
      else if (isBlock) Sfx.block();
      else if (type === 'spike') Sfx.spike();
      else if (type === 'hit') Sfx.hit();
      else Sfx.bump();
    }

    if (type === 'dive') {
      this.spawnRing(ball.x, ball.y, '#9BE7FF', 44);
      this.spawnBurst(ball.x, ball.y, 10, '#9BE7FF');
    }

    if (type === 'spike' || isBlock) {
      this.shake = Math.max(this.shake, 8);
      this.spawnBurst(ball.x, ball.y, 12, isBlock ? PALETTE.gold : '#FFFFFF');
      this.spawnRing(ball.x, ball.y, isBlock ? PALETTE.gold : '#FFFFFF', 54);
    }
  }

  /** @deprecated Geliştirme konsolu — ballistics.computeAttackVelocity */
  computeAttackVelocity(player, power, toOpponent, nx, arc = 1) {
    return computeAttackVelocity({
      ball: this.ball,
      player,
      power,
      toOpponent,
      nx,
      arc,
    });
  }

  /** @deprecated Geliştirme konsolu — ballistics.computeSetVelocity */
  computeSetVelocity(toOpponent) {
    return computeSetVelocity(this.ball, toOpponent);
  }

  /** @deprecated Geliştirme konsolu — ballistics.clearsNet */
  clearsNet(shot, flight) {
    return shotClearsNet(this.ball, shot, flight);
  }

  // ===================================================================
  // Skor / maç akışı
  // ===================================================================

  addSultanCharge(amount) {
    if (this.sultanArmed) return;

    this.sultanCharge = Math.min(SULTAN.max, this.sultanCharge + amount);

    if (this.sultanCharge >= SULTAN.max && !this.sultanWasReady) {
      this.sultanWasReady = true;
      Sfx.sultanReady();
      this.message = { text: 'SULTAN GÜCÜ HAZIR!', timer: 1.2, color: PALETTE.gold };
    }
  }

  /**
   * @param {'home'|'away'} side Sayıyı alan taraf
   * @param {'home'|'away'} landedSide Topun düştüğü yarı saha
   * @param {string} [reason] Faul mesajı (ör. "ÜÇ TEMAS!")
   */
  awardPoint(side, landedSide, reason) {
    this.score[side] += 1;
    this.servingSide = side;
    this.phase = PHASE.POINT;
    this.phaseTimer = this.rules.servePause;
    this.shake = 10;

    this.spawnDust(this.ball.x, GROUND_Y, 16);
    this.hype = 1;
    Sfx.ground();

    // Sayı serisi
    if (this.streak.side === side) {
      this.streak.count += 1;
    } else {
      this.streak = { side, count: 1 };
    }

    if (side === 'home') {
      const chargeMod = getModifier(this.getControlledPlayer()?.data, 'charge');
      let gain = SULTAN.onPoint;
      if (this.streak.count > 1) gain += SULTAN.streakBonus;
      this.addSultanCharge(gain * chargeMod);

      this.message = {
        text:
          reason ??
          (this.streak.count > 2 ? `${this.streak.count} SAYI ÜST ÜSTE!` : 'SAYI!'),
        timer: this.rules.servePause,
        color: reason ? PALETTE.gold : PALETTE.turkishRed,
      };
      Sfx.point();
    } else {
      this.message = {
        text: reason ?? `${this.opponent.shortName} SAYI`,
        timer: this.rules.servePause,
        color: reason ? PALETTE.gold : this.opponent.colors.accent,
      };
      Sfx.pointLost();
    }

    // Konsol dışı bir amaç için tutulur (istatistik ekranı)
    this.lastLandedSide = landedSide;
    this.emitState(true);
  }

  /** Sayı donması bitti — set bitti mi diye bak. */
  afterPoint() {
    const { home, away } = this.score;

    if (isSetOver(home, away, this.rules)) {
      const winner = setWinner(home, away);
      this.sets[winner] += 1;
      this.setHistory.push({ home, away, winner });

      this.phase = PHASE.SET_END;
      this.phaseTimer = 2.6;
      this.message = {
        text:
          winner === 'home'
            ? `${this.setNumber}. SET TÜRKİYE'NİN!`
            : `${this.setNumber}. SET ${this.opponent.shortName}`,
        timer: 2.6,
        color: winner === 'home' ? PALETTE.gold : this.opponent.colors.accent,
      };

      if (winner === 'home') Sfx.setWon();
      this.emitState(true);
      return;
    }

    this.phase = PHASE.RALLY;
    this.message = null;
    this.resetRally(this.servingSide);
  }

  /** Set bitti — maç bitti mi, yoksa yeni set mi? */
  afterSet() {
    if (isMatchOver(this.sets, this.rules)) {
      this.phase = PHASE.MATCH_END;
      this.message = null;
      this.finished = true;

      const winner = matchWinner(this.sets);
      if (winner === 'home') Sfx.victory();
      else Sfx.defeat();

      this.emitState(true);
      this.onFinish({
        winner,
        sets: { ...this.sets },
        setHistory: [...this.setHistory],
        stats: { ...this.stats },
        mode: this.mode,
        format: this.format.id,
        homeIds: [...this.homeIds],
        difficulty: this.difficulty.label,
        opponent: {
          id: this.opponent.id,
          name: this.opponent.name,
          shortName: this.opponent.shortName,
        },
      });
      return;
    }

    // Yeni set
    this.setNumber += 1;
    this.score = { home: 0, away: 0 };
    this.streak = { side: null, count: 0 };
    this.resetRally(this.servingSide);

    this.phase = PHASE.READY;
    this.phaseTimer = this.rules.readyPause;
    this.message = {
      text: `${this.setNumber}. SET`,
      timer: this.rules.readyPause,
      color: '#FFFFFF',
    };
    this.emitState(true);
  }

  // ===================================================================
  // Parçacıklar
  // ===================================================================

  spawnBurst(x, y, count, color) {
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = 90 + Math.random() * 210;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.45 + Math.random() * 0.3,
        maxLife: 0.75,
        size: 3 + Math.random() * 3,
        color,
        gravity: 420,
      });
    }
  }

  spawnFlame(x, y) {
    const colors = PALETTE.flame;
    this.particles.push({
      x: x + (Math.random() * 8 - 4),
      y: y + (Math.random() * 8 - 4),
      vx: (Math.random() * 2 - 1) * 40,
      vy: (Math.random() * 2 - 1) * 40 - 30,
      life: 0.3 + Math.random() * 0.2,
      maxLife: 0.5,
      size: 4 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      gravity: -60,
    });
  }

  spawnDust(x, y, count = 7) {
    for (let i = 0; i < count; i += 1) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() * 2 - 1) * 130,
        vy: -Math.random() * 120,
        life: 0.3 + Math.random() * 0.25,
        maxLife: 0.55,
        size: 2 + Math.random() * 3,
        color: 'rgba(255,255,255,0.75)',
        gravity: 500,
      });
    }
  }

  /**
   * Vuruş anında genişleyen darbe halkası.
   * Küçük parçacıklardan farklı olarak temasın nerede olduğunu
   * tek bakışta okutur.
   */
  spawnRing(x, y, color, maxRadius = 46) {
    this.rings.push({ x, y, r: 6, maxRadius, life: 0.26, maxLife: 0.26, color });
  }

  updateRings(dt) {
    for (let i = this.rings.length - 1; i >= 0; i -= 1) {
      const ring = this.rings[i];
      ring.life -= dt;
      if (ring.life <= 0) {
        this.rings.splice(i, 1);
        continue;
      }
      const t = 1 - ring.life / ring.maxLife;
      ring.r = 6 + (ring.maxRadius - 6) * t;
    }
  }

  drawRings() {
    const { ctx } = this;
    this.rings.forEach((ring) => {
      ctx.globalAlpha = Math.max(0, ring.life / ring.maxLife) * 0.85;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  /** Hızlı topun arkasında kalan iz — hareketi okutur. */
  updateBallTrail() {
    const ball = this.ball;
    const speed = Math.hypot(ball.vx, ball.vy);

    if (this.phase !== PHASE.RALLY || speed < 420) {
      if (this.ballTrail.length > 0) this.ballTrail.shift();
      return;
    }

    this.ballTrail.push({ x: ball.x, y: ball.y });
    if (this.ballTrail.length > 5) this.ballTrail.shift();
  }

  drawBallTrail() {
    const { ctx } = this;
    const count = this.ballTrail.length;
    if (count === 0) return;

    const flaming = this.ball.flaming > 0;

    this.ballTrail.forEach((point, i) => {
      const t = (i + 1) / count;
      ctx.globalAlpha = t * 0.26;
      ctx.fillStyle = flaming ? PALETTE.flame[1] : '#FFFFFF';
      const size = this.ball.radius * 1.1 * t;
      ctx.fillRect(point.x - size / 2, point.y - size / 2, size, size);
    });

    ctx.globalAlpha = 1;
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    if (this.message && this.message.timer > 0) {
      this.message.timer -= dt;
      if (this.message.timer <= 0) this.message = null;
    }
  }

  // ===================================================================
  // React'e durum bildirimi
  // ===================================================================

  /**
   * Durum değiştiyse React'e bildirir.
   * Her karede setState çağırmamak için imza karşılaştırması yapılır.
   * @param {boolean} [force]
   */
  emitState(force = false) {
    const chargeBucket = Math.round(this.sultanCharge / 4);
    const signature = [
      this.score.home,
      this.score.away,
      this.sets.home,
      this.sets.away,
      this.setNumber,
      this.phase,
      chargeBucket,
      this.sultanArmed ? 1 : 0,
      this.running ? 1 : 0,
    ].join('|');

    if (!force && signature === this.lastSignature) return;
    this.lastSignature = signature;

    this.onState({
      score: { ...this.score },
      sets: { ...this.sets },
      setNumber: this.setNumber,
      setHistory: [...this.setHistory],
      phase: this.phase,
      sultanCharge: this.sultanCharge,
      sultanReady: this.sultanCharge >= SULTAN.max,
      sultanArmed: this.sultanArmed,
      running: this.running,
      streak: { ...this.streak },
      pointsPerSet: this.rules.pointsPerSet,
      formatId: this.format.id,
      opponentName: this.opponent.shortName,
      opponentAccent: this.opponent.colors.accent,
    });
  }

  // ===================================================================
  // Çizim
  // ===================================================================

  render() {
    const { ctx } = this;
    if (!ctx) return;

    ctx.save();

    // Ekran sarsıntısı
    if (this.shake > 0) {
      ctx.translate(
        (Math.random() * 2 - 1) * this.shake * 0.5,
        (Math.random() * 2 - 1) * this.shake * 0.5
      );
    }

    drawArena(ctx, this.time, this.hype, this.score, this.touch);
    drawFloor(ctx);

    // Gölgeler önce
    this.players.forEach((p) => {
      const isDiving = p.diveTimer > 0 || p.recoverTimer > 0;
      if (isDiving) {
        // Yatan gövde geniş ve yakın bir gölge bırakır
        this.drawShadow(p.x - p.facing * 8, GROUND_Y, 44);
        return;
      }
      // Havadayken gölge küçülür — yükseklik hissi verir
      const lift = clamp((GROUND_Y - p.y) / 170, 0, 1);
      this.drawShadow(p.x, GROUND_Y, 30 * (1 - lift * 0.45));
    });
    this.drawShadow(this.ball.x, GROUND_Y, 16 * this.ballShadowScale());

    this.players.forEach((player) => this.drawPlayer(player));

    drawNet(ctx, GROUND_Y);
    this.drawBallTrail();
    drawBall(ctx, this.ball, this.ball.flaming > 0);
    this.drawRings();
    this.drawParticles();

    ctx.restore();

    this.drawMessages();
  }

  ballShadowScale() {
    const height = GROUND_Y - this.ball.y;
    return Math.max(0.35, 1 - height / 500);
  }

  drawShadow(x, y, radius) {
    const { ctx } = this;
    ctx.fillStyle = PALETTE.shadow;
    ctx.beginPath();
    ctx.ellipse(x, y + 2, radius, radius * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawPlayer(player) {
    const glow =
      player.controlled && (this.sultanArmed || this.sultanCharge >= SULTAN.max);

    const { ctx } = this;

    // Squash & stretch: inişte ezilir, yükselirken uzar.
    // Ölçekleme ayakların değdiği noktadan yapılır ki figür yere basılı kalsın.
    let scaleX = 1;
    let scaleY = 1;

    const diving = player.diveTimer > 0 || player.recoverTimer > 0;

    if (diving) {
      // Dalış sprite'ı zaten yatay — ölçekleme bozar
      scaleX = 1;
      scaleY = 1;
    } else if (player.squash > 0) {
      const t = player.squash / 0.16;
      scaleY = 1 - 0.24 * t;
      scaleX = 1 + 0.2 * t;
    } else if (!player.onGround) {
      const rise = clamp(-player.vy / 700, 0, 1);
      scaleY = 1 + 0.12 * rise;
      scaleX = 1 - 0.09 * rise;
    }

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-player.x, -player.y);

    drawSultan(ctx, player.data, {
      x: player.x,
      y: player.y,
      scale: PLAYER.spriteScale,
      pose: player.pose,
      facing: player.facing,
      frame: player.runFrame,
      glow,
    });

    ctx.restore();

    // Kontrol edilen oyuncunun göstergesi
    if (player.controlled) {
      const top = player.y - 22 * PLAYER.spriteScale;
      const bounce = Math.sin(this.time * 6) * 3;

      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.moveTo(player.x, top - 12 + bounce);
      ctx.lineTo(player.x - 7, top - 24 + bounce);
      ctx.lineTo(player.x + 7, top - 24 + bounce);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(upper(player.data.name), player.x, top - 34 + bounce);
    }
  }

  drawParticles() {
    const { ctx } = this;
    this.particles.forEach((p) => {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    });
    ctx.globalAlpha = 1;
  }

  /** Aşama mesajları ve geri sayım. */
  drawMessages() {
    const { ctx } = this;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Set başı geri sayım
    if (this.phase === PHASE.READY) {
      const count = Math.ceil(this.phaseTimer);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, GAME_HEIGHT / 2 - 60, GAME_WIDTH, 120);

      ctx.fillStyle = PALETTE.gold;
      ctx.font = '48px "Press Start 2P", monospace';
      ctx.fillText(String(count), GAME_WIDTH / 2, GAME_HEIGHT / 2 - 6);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '12px "Press Start 2P", monospace';
      ctx.fillText(
        this.message?.text ?? 'HAZIR OL',
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 38
      );
      return;
    }

    if (!this.message) return;

    const alpha = Math.min(1, this.message.timer * 3);
    ctx.globalAlpha = alpha;

    const text = this.message.text;
    ctx.font = '20px "Press Start 2P", monospace';

    // Retro font geç yüklenirse ölçüm değişir — bol iç boşluk bırakılır
    const width = ctx.measureText(text).width;
    const padX = 26;
    const boxW = width + padX * 2;
    const boxX = GAME_WIDTH / 2 - boxW / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(boxX, 218, boxW, 44);

    ctx.strokeStyle = this.message.color;
    ctx.lineWidth = 3;
    ctx.strokeRect(boxX, 218, boxW, 44);

    ctx.fillStyle = this.message.color;
    ctx.fillText(text, GAME_WIDTH / 2, 241);

    ctx.globalAlpha = 1;
  }
}
