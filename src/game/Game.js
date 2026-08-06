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
  HITSTOP,
  PERFECT,
  TIP,
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
  SURVIVAL,
  WALL_PAD,
  scaleDifficulty,
} from './constants.js';
import {
  survivalDifficulty,
  waveForPoints,
  waveLabel,
  waveOpponent,
} from './survival.js';
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
import {
  SERVE,
  advanceServeMeter,
  aiServeChoice,
  aiServeDelay,
  computeServeVelocity,
  meterToAim,
  meterToPower,
} from './serve.js';
import {
  comboChargeMultiplier,
  comboPowerMultiplier,
  comboTierAt,
  currentComboTier,
  isPerfectTiming,
} from './combo.js';
import { drawBall, drawSultan } from './sprites.js';
import { drawArena, drawFloor, drawNet } from './arena.js';
import {
  clearsNet as shotClearsNet,
  computeAttackVelocity,
  computeSetVelocity,
  computeTipVelocity,
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
import {
  drawBallTrail as fxDrawBallTrail,
  drawParticles as fxDrawParticles,
  drawRings as fxDrawRings,
  spawnBurst as fxSpawnBurst,
  spawnDust as fxSpawnDust,
  spawnFlame as fxSpawnFlame,
  spawnRing as fxSpawnRing,
  updateBallTrail as fxUpdateBallTrail,
  updateParticles as fxUpdateParticles,
  updateRings as fxUpdateRings,
} from './effects.js';
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
    /** 'match' | 'tournament' | 'survival' */
    this.campaign = options.campaign ?? 'match';
    this.survivalMode = this.campaign === 'survival';

    /**
     * İki ayrı zorluk: `difficulty` 2v2'deki AI takım arkadaşını,
     * `opponentDifficulty` karşı takımı sürer. Turnuva/hayatta kalma
     * rampası yalnızca rakibi sertleştirmeli — tek alan kullanılsaydı
     * dalga yükseldikçe kendi takım arkadaşın da güçlenirdi.
     */
    this.difficulty = DIFFICULTY[options.difficulty] ?? DIFFICULTY.normal;
    this.difficultyRamp = options.difficultyRamp ?? 0;
    this.opponentDifficulty = this.survivalMode
      ? survivalDifficulty(this.difficulty, 1)
      : scaleDifficulty(this.difficulty, this.difficultyRamp);

    this.format = FORMATS[options.format] ?? FORMATS.classic;
    // Turnuva turları kendi set/sayı ayarını taşır (options.rules)
    this.rules = { ...RULES, ...this.format.rules, ...(options.rules ?? {}) };

    this.opponent = this.survivalMode
      ? waveOpponent(1)
      : getOpponentTeam(options.opponentId) ?? pickRandomOpponent();

    /** Turnuva turu bilgisi — HUD ve sonuç ekranı için taşınır. */
    this.roundLabel = options.roundLabel ?? null;
    this.roundNumber = options.roundNumber ?? null;
    this.roundCount = options.roundCount ?? null;

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

    /**
     * Vuruş tuşuna basış sayacı.
     *
     * Girdi her karede yoklanıyordu; iki kare arasına sıkışan hızlı bir
     * basış (bas–bırak < 16 ms) hiç görülmeden kayboluyordu. Tam vuruş
     * mekaniği oyuncuyu tam da böyle hızlı tıklamaya ittiği için bu
     * "tuşa bastım ama vurmadı" hissi veriyordu. Sayaç, basışın hangi
     * kareye denk geldiğinden bağımsız olarak bir kez işlenmesini
     * garanti eder.
     */
    this.actionPresses = 0;
    this.lastActionPresses = 0;
    /** Bu karede yeni bir basış görüldü mü. */
    this.actionEdge = false;

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

    // Hayatta kalma durumu — diğer modlarda kullanılmaz
    this.lives = SURVIVAL.lives;
    this.wave = 1;

    /**
     * Servis durumu — yalnızca PHASE.SERVE sırasında dolu.
     * @type {null | {stage:'power'|'aim', meter:number, dir:1|-1,
     *   power:number, aim:number, serverId:string, aiTimer:number,
     *   actionLatch:boolean}}
     */
    this.serve = null;

    /** Kombo: üst üste tam vuruş / blok / kurtarış. Sayı kaybında sıfırlanır. */
    this.combo = 0;
    this.bestCombo = 0;
    /** Son tam vuruşun ekranda kalan süresi (HUD parlaması). */
    this.perfectFlash = 0;
    /** Simülasyonu kısa süre donduran vuruş etkisi. */
    this.hitStop = 0;

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
    /** Hayatta kalmada bir koşuda ulaşılan en yüksek dalga. */
    this.stats.bestWave = 1;
    this.stats.bestCombo = 0;
    this.stats.perfects = 0;
    this.stats.tips = 0;
    /** Plase ile doğrudan kazanılan sayılar (rozetler için). */
    this.stats.tipPoints = 0;

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleWindowBlur = this.handleWindowBlur.bind(this);
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
    this.clearInput();
    this.running = true;
    this.lastTime = performance.now();

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);

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
    window.removeEventListener('blur', this.handleWindowBlur);

    // Duraklatınca basılı kalan tuş/dokunuş devam etmesin
    this.clearInput();

    // Duraklatınca tribün de sussun
    Sfx.hushAtmosphere();

    // Duraklatınca son kare ekranda kalsın
    this.render();
    this.emitState(true);
  }

  destroy() {
    this.stop();
    this.clearInput();
    Sfx.hushAtmosphere();
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
      /**
       * Vuruş tuşunun basılma anı (motor zamanı) ve bir önceki karedeki
       * hâli. Tam vuruş penceresi bu ana göre ölçülür; tuşu basılı
       * tutmak pencereyi geçirir.
       */
      actionPressedAt: null,
      actionWasDown: false,
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

    if (action === 'action' && !this.input.action) this.actionPresses += 1;
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
   * @param {'left'|'right'|'up'|'action'|'dive'|'sultan'} name
   * @param {boolean} pressed
   */
  setInput(name, pressed) {
    if (name === 'sultan') {
      if (pressed) this.activateSultan();
      return;
    }
    if (name in this.input) {
      if (name === 'action' && pressed && !this.input.action) this.actionPresses += 1;
      this.input[name] = pressed;
    }
  }

  /**
   * Tüm insan girdilerini sıfırlar.
   * Duraklatma / sekme değişimi / pencere blur sonrası yapışmayı önler.
   */
  clearInput() {
    this.input.left = false;
    this.input.right = false;
    this.input.up = false;
    this.input.down = false;
    this.input.action = false;
    this.input.dive = false;
    this.input.sultan = false;
    this.sultanKeyLatch = false;
    // Duraklatma/odak kaybı sonrası eski basış tetiklenmesin
    this.lastActionPresses = this.actionPresses;

    this.players?.forEach((player) => {
      if (!player.controlled) return;
      player.input.left = false;
      player.input.right = false;
      player.input.up = false;
      player.input.action = false;
      player.input.dive = false;
    });
  }

  /** Pencere odağını kaybedince basılı tuşlar takılı kalmasın. */
  handleWindowBlur() {
    this.clearInput();
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
    // Bu karede yeni bir vuruş basışı geldi mi (kare arasına sıkışsa bile)
    this.actionEdge = this.actionPresses !== this.lastActionPresses;
    this.lastActionPresses = this.actionPresses;

    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 60);
    this.hype = Math.max(0, this.hype - dt * 0.9);
    this.perfectFlash = Math.max(0, this.perfectFlash - dt);

    /*
     * Vuruş donması: fizik ve aşama sayaçları birkaç kare durur, ama
     * parçacıklar ve sarsıntı akmaya devam eder — donan bir kare değil,
     * ağırlaşan bir darbe izlenimi verir.
     */
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - dt);
      this.updateParticles(dt);
      this.updateRings(dt);
      return;
    }

    this.updateParticles(dt);
    this.updateRings(dt);
    this.updateBallTrail();

    switch (this.phase) {
      case PHASE.READY:
        this.updatePlayers(dt, false);
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) {
          this.message = null;
          this.beginServe();
        }
        break;

      case PHASE.SERVE:
        this.updateServe(dt);
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

    this.updateAtmosphere();
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
        /*
         * Kare arasına sıkışan basış da bir kare boyunca "basılı"
         * sayılır: yoksa hızlı tıklayan oyuncunun vuruşu hiç
         * gerçekleşmiyor, tuş çalışmamış gibi hissediliyordu.
         */
        player.input.action = active && (this.input.action || this.actionEdge);
        player.input.dive = active && this.input.dive;
        player.aiSpeedScale = 1;
      } else if (active) {
        const isAway = player.side === 'away';
        updateAI(
          player,
          ball,
          {
            difficulty: isAway ? this.opponentDifficulty : this.difficulty,
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

      // Vuruş tuşunun yükselen kenarı — tam vuruş penceresi buradan başlar
      const down = player.input.action;
      if (down && !player.actionWasDown) {
        player.actionPressedAt = this.time;
      } else if (!down) {
        player.actionPressedAt = null;
      }
      player.actionWasDown = down;

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
    let type = resolveHitType({
      diving,
      acting,
      airborne,
      controlled: attackReady,
    });

    /*
     * Plase: havada, hücuma kalkabilecek durumdayken `dive` tuşu.
     * Smaç yerine filenin hemen ötesine yumuşak bırakış yapılır.
     * Yerdeyken `dive` zaten dalış demek, o yüzden yalnızca havada.
     */
    const wantsTip = airborne && player.input.dive && !diving;
    if (type === 'spike' && wantsTip) {
      type = 'tip';
    }

    /*
     * Tam vuruş: temas, tuşa basıldıktan sonraki dar pencerede mi?
     * Yapay zekâ tuşu "an"ında bastığı için her vuruşu tam olurdu;
     * onun isabeti zorluk kademesinden gelen bir olasılıkla verilir.
     */
    const attacking = type === 'spike' || type === 'hit' || type === 'tip';
    let perfect = false;
    if (attacking) {
      perfect = player.controlled
        ? isPerfectTiming(this.time, player.actionPressedAt)
        : Math.random() < (this.difficultyFor(player).placement ?? 0) * 0.5;
    }

    let power;
    if (type === 'spike' || type === 'tip') {
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
      power *= this.opponentDifficulty.power;
    }

    // Tam vuruş ve kombo ödülü — yalnızca hücum temaslarında
    if (perfect) power *= PERFECT.power;
    if (attacking && player.side === 'home') {
      power *= comboPowerMultiplier(this.combo);
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
    } else if (type === 'tip') {
      // Plase: filenin hemen ötesine yumuşak, kavisli bırakış
      const shot = computeTipVelocity({
        ball,
        toOpponent,
        aim: player.controlled ? Math.random() : (player.aimSpread ?? 0.5),
      });
      vx = shot.vx;
      vy = shot.vy;
      this.stats.tips += 1;
      this.lastTipSide = player.side;
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

    // Sultan barı dolumu ve kombo (yalnızca insan oyuncunun tarafı)
    if (player.side === 'home') {
      const chargeMod =
        getModifier(this.getControlledPlayer()?.data ?? data, 'charge') *
        comboChargeMultiplier(this.combo);

      // Komboyu büyüten hamleler: tam vuruş, blok, dalış kurtarışı
      const scoringMove = perfect || isBlock || type === 'dive';

      if (type === 'dive') {
        this.addSultanCharge(DIVE.chargeBonus * chargeMod);
        this.stats.saves += 1;
        this.message = { text: 'KURTARIŞ!', timer: 0.8, color: '#9BE7FF' };
      } else if (isBlock) {
        this.addSultanCharge(SULTAN.onBlock * chargeMod);
        this.stats.blocks += 1;
        this.message = { text: 'BLOK!', timer: 0.7, color: PALETTE.gold };
      } else {
        this.addSultanCharge(
          (type === 'tip' ? TIP.charge : SULTAN.onRally) * chargeMod
        );
      }

      if (perfect) {
        this.addSultanCharge(PERFECT.charge * chargeMod);
        this.stats.perfects += 1;
        this.perfectFlash = PERFECT.flash;
        this.spawnRing(ball.x, ball.y, PALETTE.gold, 62);
        Sfx.perfect();
      }

      if (scoringMove) this.bumpCombo();
    }

    // Ses ve parçacık
    if (!sultanFired) {
      if (type === 'dive') Sfx.save();
      else if (isBlock) Sfx.block();
      else if (type === 'tip') Sfx.tip();
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

    // Vuruş donması — darbenin ağırlığını hissettirir
    if (sultanFired) this.addHitStop(HITSTOP.sultan);
    else if (isBlock) this.addHitStop(HITSTOP.block);
    else if (type === 'spike') this.addHitStop(HITSTOP.spike);
    if (perfect) this.addHitStop(HITSTOP.perfect);
  }

  // ===================================================================
  // Servis
  // ===================================================================

  /** Servis atacak oyuncu. */
  getServer() {
    return this.players.find((p) => p.side === this.servingSide) ?? null;
  }

  /** Servis atanı dip çizgiye çeker. */
  placeServer(servingSide) {
    const server = this.players.find((p) => p.side === servingSide);
    if (!server) return;

    const ratio = servingSide === 'home' ? SERVE.backLineHome : SERVE.backLineAway;
    server.x = GAME_WIDTH * ratio;
    server.y = GROUND_Y;
    server.vx = 0;
    server.vy = 0;
    server.onGround = true;
    server.facing = servingSide === 'home' ? 1 : -1;
    server.pose = 'idle';
  }

  /** Servis atanın elinde bekleyen top. */
  createHeldBall(side) {
    const server = this.players.find((p) => p.side === side) ?? null;
    const x =
      server?.x ??
      GAME_WIDTH * (side === 'home' ? SERVE.backLineHome : SERVE.backLineAway);

    return {
      ...this.createBall(side),
      x,
      y: GROUND_Y - SERVE.holdHeight,
      vx: 0,
      vy: 0,
      held: true,
    };
  }

  /**
   * Servis aşamasını başlatır.
   *
   * Ralliler önce topun havada belirip düşmesiyle başlıyordu — maçın en
   * kontrollü anı olan servis oyunda hiç yoktu. Artık iki aşamalı bir
   * gösterge var: önce güç, sonra nişan.
   */
  beginServe() {
    this.phase = PHASE.SERVE;
    this.placeServer(this.servingSide);
    this.ball = this.createHeldBall(this.servingSide);
    this.ballTrail.length = 0;
    this.touch = { side: null, count: 0 };

    const server = this.getServer();
    const human = Boolean(server?.controlled);

    this.serve = {
      stage: 'power',
      meter: 0.15,
      dir: 1,
      power: 0,
      aim: 0,
      serverId: server?.id ?? '',
      aiTimer: human ? 0 : aiServeDelay(this.difficultyFor(server ?? {}).serveSkill ?? 0.5),
      actionLatch: false,
      /** İnsan servisinde otomatik atış sayacı. */
      elapsed: 0,
    };

    this.message = { text: 'SERVİS', timer: 1, color: PALETTE.gold };
    Sfx.whistle();
    this.emitState(true);
  }

  updateServe(dt) {
    const serve = this.serve;
    if (!serve) {
      this.phase = PHASE.RALLY;
      return;
    }

    // Servis sırasında kimse koşamaz; yalnızca duruş güncellenir
    this.updatePlayers(dt, false);

    const server = this.players.find((p) => p.id === serve.serverId) ?? this.getServer();
    if (server) {
      const ratio = this.servingSide === 'home' ? SERVE.backLineHome : SERVE.backLineAway;
      server.x = GAME_WIDTH * ratio;
      server.y = GROUND_Y;
      server.vx = 0;
      server.vy = 0;
      server.onGround = true;
      server.pose = 'idle';

      // Top elde bekler
      this.ball.x = server.x + server.facing * 10;
      this.ball.y = GROUND_Y - SERVE.holdHeight;
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.ball.held = true;
    }

    const speed = serve.stage === 'power' ? SERVE.meterSpeed : SERVE.aimMeterSpeed;
    const next = advanceServeMeter(serve.meter, serve.dir, speed, dt);
    serve.meter = next.meter;
    serve.dir = next.dir;

    if (server?.controlled) {
      /*
       * Basışın yükselen kenarı: tuşu basılı tutmak iki aşamayı da
       * geçmesin. Kenar sayaçtan okunur, böylece iki kare arasına
       * sıkışan hızlı basış da kaybolmaz.
       */
      if (this.actionEdge) {
        this.handleServePress();
      }
      serve.actionLatch = this.input.action;

      /*
       * Kaçış kapısı. İkinci aşama yeni bir basış beklediği için tuşunu
       * bırakmayan (ya da hiç basmayan) oyuncu servis aşamasında
       * sonsuza kadar kilitli kalıyordu. Süre dolunca servis olduğu
       * güçle atılır — oyun asla durmaz.
       */
      serve.elapsed += dt;
      if (this.serve && serve.elapsed >= SERVE.autoAfter) {
        if (serve.stage === 'power') serve.power = meterToPower(serve.meter);
        serve.aim = meterToAim(serve.meter);
        this.launchServe();
      }
    } else {
      serve.aiTimer -= dt;
      if (serve.aiTimer <= 0) {
        const choice = aiServeChoice(
          this.difficultyFor(server ?? {}).serveSkill ?? 0.5
        );
        serve.power = choice.power;
        serve.aim = choice.aim;
        this.launchServe();
      }
    }

    this.emitState();
  }

  /** Oyuncunun vuruş tuşuna basması: önce gücü, sonra nişanı kilitler. */
  handleServePress() {
    const serve = this.serve;
    if (!serve) return;

    if (serve.stage === 'power') {
      serve.power = meterToPower(serve.meter);
      serve.stage = 'aim';
      serve.meter = 0.5;
      serve.dir = 1;
      Sfx.select();
      this.message = { text: 'NİŞAN', timer: 0.8, color: '#9BE7FF' };
      this.emitState(true);
      return;
    }

    serve.aim = meterToAim(serve.meter);
    this.launchServe();
  }

  /** Servisi atar ve ralliyi başlatır. */
  launchServe() {
    const serve = this.serve;
    const server =
      this.players.find((p) => p.id === serve?.serverId) ?? this.getServer();

    if (!serve || !server) {
      this.serve = null;
      this.phase = PHASE.RALLY;
      return;
    }

    const toOpponent = this.servingSide === 'home' ? 1 : -1;
    const shot = computeServeVelocity({
      power: serve.power || meterToPower(0.7),
      aim: serve.aim || 0,
      toOpponent,
      serveStat: server.data?.stats?.serve ?? 70,
    });

    this.ball.held = false;
    this.ball.vx = shot.vx;
    this.ball.vy = shot.vy;
    this.ball.lastHitBy = server.id;
    this.ball.lastHitSide = server.side;

    // Servis ilk temastır: üç temas sayacı buradan başlar
    this.touch = { side: server.side, count: 1 };
    this.stats.rallyTouches = 1;

    /*
     * Servis atan kendi topuna anında tekrar vuramaz.
     *
     * Top el yüksekliğinde ve oyuncunun temas dairesinin tam içinde
     * doğuyor; bekleme konmayınca ralli başlar başlamaz sunucu bir
     * sonraki karede kendi servisine ikinci kez vuruyor, top saçma bir
     * yöne gidiyordu. Ölçümde birinci karede tekrar temas görüldü.
     */
    server.hitCooldown = SERVE.recontactLock;

    this.spawnDust(server.x, GROUND_Y, 8);
    this.spawnRing(this.ball.x, this.ball.y, PALETTE.gold, 36);
    Sfx.hit();

    this.serve = null;
    this.phase = PHASE.RALLY;
    this.message = null;
    this.emitState(true);
  }

  /**
   * Komboyu bir artırır ve kademe geçildiyse duyurur.
   *
   * Kombo ralli değil **sayı** boyunca yaşar: sayıyı kaybedene kadar
   * biriken bir momentum ödülüdür.
   */
  bumpCombo() {
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.stats.bestCombo = this.bestCombo;

    const tier = comboTierAt(this.combo);
    if (tier) {
      this.message = { text: tier.label, timer: 1, color: tier.color };
      this.hype = Math.max(this.hype, 0.7);
      Sfx.combo(this.combo);
    }
  }

  /**
   * Simülasyonu kısa süre dondurur (hit-stop).
   * Birikmeyi engellemek için üst sınır uygulanır.
   * @param {number} seconds
   */
  addHitStop(seconds) {
    this.hitStop = Math.min(HITSTOP.max, this.hitStop + seconds);
  }

  /**
   * Bir oyuncuyu süren zorluk kademesi.
   * Rakip rampalı, kendi takım arkadaşın seçilen kademede kalır.
   * @param {object} player
   */
  difficultyFor(player) {
    return player.side === 'away' ? this.opponentDifficulty : this.difficulty;
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
    this.hitStop = 0;

    /*
     * Kombo her sayıda sıfırlanır — kazansan da kaybetsen de.
     *
     * Önce yalnızca sayı kaybında sıfırlanıyordu; ölçümde kombo 16–30'a
     * çıkıyor, kademeler (en üstü 15) anlamsızlaşıyor ve bar sürekli
     * dolduğu için "normal" kazanma oranı %57'den %86'ya fırlıyordu.
     * Ralli başına sayınca kombo hem okunur hem kaybedilebilir oluyor:
     * "bu rallide kaç iyi temas zincirledim".
     */
    this.combo = 0;

    if (side === 'home' && this.lastTipSide === 'home' && this.ball.lastHitSide === 'home') {
      // Plaseyle doğrudan kazanılan sayı (rozet takibi)
      this.stats.tipPoints += 1;
    }
    this.lastTipSide = null;

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
      if (this.streak.count >= 3) Sfx.streak(this.streak.count);
      else Sfx.point();
    } else if (this.survivalMode) {
      // Kaybedilen sayı bir can demek. Can burada düşülüyor ki HUD ve
      // ekrandaki mesaj aynı anı göstersin — sayı donmasının sonunda
      // düşülseydi tabelada hâlâ eski can sayısı duruyor olurdu.
      this.lives = Math.max(0, this.lives - 1);
      this.message = {
        text: this.lives > 0 ? `CAN GİTTİ · ${this.lives} KALDI` : 'SON CAN',
        timer: this.rules.servePause,
        color: this.opponent.colors.accent,
      };
      Sfx.pointLost();
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

    if (this.survivalMode) {
      this.afterSurvivalPoint();
      return;
    }

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
      else Sfx.setLost();
      this.emitState(true);
      return;
    }

    // Yeni sayı servisle başlar
    this.message = null;
    this.resetRally(this.servingSide);
    this.beginServe();
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
      this.emitFinish(winner);
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

  /**
   * Sonuç nesnesini dışarı verir. Üç mod da aynı gövdeyi paylaşır;
   * moda özgü alanlar `extra` ile eklenir.
   * @param {'home'|'away'|null} winner
   * @param {object} [extra]
   */
  emitFinish(winner, extra = {}) {
    this.onFinish({
      winner,
      campaign: this.campaign,
      sets: { ...this.sets },
      setHistory: [...this.setHistory],
      stats: { ...this.stats },
      mode: this.mode,
      format: this.format.id,
      homeIds: [...this.homeIds],
      difficulty: this.difficulty.label,
      roundLabel: this.roundLabel,
      roundNumber: this.roundNumber,
      roundCount: this.roundCount,
      opponent: {
        id: this.opponent.id,
        name: this.opponent.name,
        shortName: this.opponent.shortName,
      },
      ...extra,
    });
  }

  // ===================================================================
  // Hayatta kalma
  // ===================================================================

  /**
   * Hayatta kalmada sayı donması bitti.
   *
   * Set/maç yok: canlar bittiyse koşu biter, bitmediyse yeni ralli.
   * Kazanılan puan sayısı dalga eşiğini geçtiyse rakip değişir.
   */
  afterSurvivalPoint() {
    if (this.lives <= 0) {
      this.finishSurvival();
      return;
    }

    const nextWave = waveForPoints(this.score.home);
    if (nextWave !== this.wave) {
      this.startWave(nextWave);
      return;
    }

    // Yeni sayı servisle başlar
    this.message = null;
    this.resetRally(this.servingSide);
    this.beginServe();
  }

  /**
   * Yeni dalga: rakip takım değişir, zorluk bir tık artar.
   * @param {number} wave
   */
  startWave(wave) {
    this.wave = wave;
    this.stats.bestWave = Math.max(this.stats.bestWave, wave);
    this.opponentDifficulty = survivalDifficulty(this.difficulty, wave);
    this.setOpponentTeam(waveOpponent(wave));

    // Dalga başında servis oyuncuda: yeni rakibi görmeden sayı yemesin
    this.servingSide = 'home';
    this.streak = { side: null, count: 0 };
    this.resetRally('home');

    this.phase = PHASE.READY;
    this.phaseTimer = SURVIVAL.waveAnnounce;
    this.message = {
      text: `${waveLabel(wave)} · ${upper(this.opponent.shortName)}`,
      timer: SURVIVAL.waveAnnounce,
      color: PALETTE.gold,
    };
    Sfx.setWon();
    this.emitState(true);
  }

  /**
   * Karşı takımı maç ortasında değiştirir.
   *
   * Oyuncu nesneleri yeniden yaratılmaz — yalnızca `data` alanı ve
   * ondan türeyen erişim yarıçapı tazelenir. Yeniden yaratmak konum,
   * dalış ve cooldown durumlarını sıfırlar; dalga geçişinde bunu
   * `resetRally` zaten yapıyor, iki kez yapmaya gerek yok.
   * @param {object} team
   */
  setOpponentTeam(team) {
    if (!team) return;
    this.opponent = team;

    const roster = buildAwayPlayers(team, this.perSide);
    let index = 0;
    this.players.forEach((player) => {
      if (player.side !== 'away') return;
      const data = roster[index++] ?? roster[0];
      player.data = data;
      player.hitRadius = PLAYER.hitRadius * getModifier(data, 'reach');
    });
  }

  /** Canlar bitti — koşuyu kapat. */
  finishSurvival() {
    this.phase = PHASE.MATCH_END;
    this.message = null;
    this.finished = true;
    Sfx.defeat();

    this.emitState(true);
    // Hayatta kalmada "galip" yok: koşu her zaman biter. `winner: null`
    // sonuç ekranına ve rekor kaydına "bu bir maç değil" diyor.
    this.emitFinish(null, {
      survival: {
        points: this.score.home,
        wave: this.wave,
        bestWave: this.stats.bestWave,
        lives: 0,
      },
    });
  }

  // ===================================================================
  // Parçacıklar (effects.js)
  // ===================================================================

  spawnBurst(x, y, count, color) {
    fxSpawnBurst(this.particles, x, y, count, color);
  }

  spawnFlame(x, y) {
    fxSpawnFlame(this.particles, x, y);
  }

  spawnDust(x, y, count = 7) {
    fxSpawnDust(this.particles, x, y, count);
  }

  /** Vuruş anında genişleyen darbe halkası. */
  spawnRing(x, y, color, maxRadius = 46) {
    fxSpawnRing(this.rings, x, y, color, maxRadius);
  }

  updateRings(dt) {
    fxUpdateRings(this.rings, dt);
  }

  drawRings() {
    fxDrawRings(this.ctx, this.rings);
  }

  /** Hızlı topun arkasında kalan iz — hareketi okutur. */
  updateBallTrail() {
    fxUpdateBallTrail(this.ballTrail, this.ball, this.phase);
  }

  drawBallTrail() {
    fxDrawBallTrail(this.ctx, this.ballTrail, this.ball);
  }

  updateParticles(dt) {
    fxUpdateParticles(this.particles, dt);

    if (this.message && this.message.timer > 0) {
      this.message.timer -= dt;
      if (this.message.timer <= 0) this.message = null;
    }
  }

  /**
   * Tribün yatağı — ralli ve coşkuyla şişer.
   *
   * Sürekli çalan hafif bir uğultu, salonun dolu olduğunu tek bir efekt
   * çalmadan hissettiriyor; sayı sonrası coşku onu geçici olarak
   * yükseltiyor.
   */
  updateAtmosphere() {
    let level = this.hype * 0.55;

    if (this.phase === PHASE.RALLY) level = Math.max(level, 0.22 + this.hype * 0.45);
    else if (this.phase === PHASE.SERVE) level = Math.max(level, 0.18);
    else if (this.phase === PHASE.POINT) level = Math.max(level, 0.35);
    else if (this.phase === PHASE.READY) level = Math.max(level, 0.12);
    else if (this.phase === PHASE.MATCH_END) level = this.hype * 0.4;
    else level = Math.max(level, 0.08);

    Sfx.setAtmosphere(level);
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
      this.lives,
      this.wave,
      this.combo,
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
      combo: this.combo,
      comboTier: currentComboTier(this.combo),
      campaign: this.campaign,
      roundLabel: this.roundLabel,
      roundNumber: this.roundNumber,
      roundCount: this.roundCount,
      survival: this.survivalMode
        ? {
            points: this.score.home,
            lives: this.lives,
            maxLives: SURVIVAL.lives,
            wave: this.wave,
          }
        : null,
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
    this.drawServeMeter();

    ctx.restore();

    this.drawMessages();
  }

  /**
   * Servis göstergesi — servis atanın yanında dikey bar.
   *
   * İki aşama tek barla anlatılır: güç aşamasında kırmızı ve üzerinde
   * "tatlı nokta" çizgisi, nişan aşamasında mavi. Sahanın ortasına değil
   * oyuncunun yanına konur ki gözün topu bıraktığı yerde kalsın.
   */
  drawServeMeter() {
    if (this.phase !== PHASE.SERVE || !this.serve) return;

    const { ctx, serve } = this;
    const server =
      this.players.find((p) => p.id === serve.serverId) ?? this.getServer();
    if (!server) return;

    const barW = 14;
    const barH = 70;
    const x = server.x + (server.side === 'home' ? 28 : -28 - barW);
    const y = server.y - 110;
    const aiming = serve.stage === 'aim';

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(x - 2, y - 2, barW + 4, barH + 4);
    ctx.strokeStyle = aiming ? '#9BE7FF' : PALETTE.gold;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 2, y - 2, barW + 4, barH + 4);

    const fillH = Math.max(2, serve.meter * barH);
    ctx.fillStyle = aiming ? '#9BE7FF' : PALETTE.turkishRed;
    ctx.fillRect(x, y + barH - fillH, barW, fillH);

    // Güç aşamasında en verimli noktayı göster
    if (!aiming) {
      const sweetY = y + barH - SERVE.sweetSpot * barH;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x - 3, sweetY - 1, barW + 6, 2);
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(aiming ? 'NİŞAN' : 'GÜÇ', server.x, y - 10);
    ctx.textAlign = 'left';
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
    fxDrawParticles(this.ctx, this.particles);
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
