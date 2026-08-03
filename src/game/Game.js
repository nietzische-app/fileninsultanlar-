import { ROSTER, STARTING_SIX, FORMATION, getPlayerById } from './players.js';

/**
 * Oyun motoru — Filenin Sultanları retro voleybol.
 *
 * Yan görünüş (side-view) arcade voleybol düzeni:
 *   - Sol yarı saha: Türkiye (oyuncunun kontrol ettiği taraf)
 *   - Sağ yarı saha: rakip
 *   - Ortada file, altta kırmızı/beyaz saha zemini
 *
 * Motor React'ten tamamen bağımsızdır: bir <canvas> alır, kendi
 * requestAnimationFrame döngüsünü kurar ve dışarıya sadece
 * `onStateChange` callback'i ile skor/durum bilgisi yollar.
 *
 * Genişletme noktaları (Cursor için TODO'lar dosya içinde işaretli):
 *   update()      → çarpışma, sayı kuralları, rakip yapay zekâsı
 *   drawPlayer()  → sprite / animasyon karesi
 */

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

/** Sahaya ait sabitler (piksel). */
export const COURT = {
  floorY: 400, // saha zemininin üst (uzak) kenarı
  backY: 500, // saha zemininin alt (yakın) kenarı
  marginX: 60, // saha kenar boşluğu
  netWidth: 8,
  netHeight: 190,
  lineWidth: 4,
};

/** Topun düştüğü zemin düzlemi — sahanın orta derinliği. */
export const BALL_FLOOR_Y = (COURT.floorY + COURT.backY) / 2;

/** Basit fizik sabitleri. */
export const PHYSICS = {
  gravity: 1400, // px / s²
  ballRestitution: 0.72, // zıplama kaybı
  ballRadius: 14,
  playerSpeed: 300, // px / s
  jumpVelocity: -640, // px / s
  maxDelta: 1 / 30, // sekme (frame spike) koruması
};

/**
 * Renk paleti — Tailwind config'indeki değerlerle aynı.
 *
 * Not: saha zemini formalardan (parlak #E30A17) belirgin biçimde koyu
 * tutulur, yoksa kırmızı forma kırmızı zeminde kayboluyor.
 */
export const PALETTE = {
  sky: '#0b0b12',
  crowd: '#16162a',
  courtIn: '#8E1018', // saha içi (koyu kırmızı)
  courtOut: '#5C070D', // serbest bölge (daha koyu)
  line: '#FFFFFF',
  net: '#F5F5F5',
  netPost: '#DDDDDD',
  ballA: '#FFFFFF',
  ballB: '#E30A17',
  ballC: '#1B4FE0',
  outline: '#17141A', // piksel figür dış hattı
  shadow: 'rgba(0, 0, 0, 0.35)',
};

export default class Game {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ onStateChange?: (state: object) => void }} [options]
   */
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onStateChange = options.onStateChange ?? (() => {});

    this.running = false;
    this.rafId = null;
    this.lastTime = 0;

    /** Basılı tuşlar. */
    this.keys = new Set();

    /** Skor / maç durumu. */
    this.score = { home: 0, away: 0 };
    this.set = 1;

    /** Kontrol edilen oyuncu — varsayılan kaptan Eda Erdem. */
    this.activePlayerId = 'eda-erdem';

    this.entities = { ball: null, players: [] };

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.loop = this.loop.bind(this);

    this.reset();
  }

  // ---------------------------------------------------------------------
  // Yaşam döngüsü
  // ---------------------------------------------------------------------

  /** Oyun döngüsünü başlatır ve klavye dinleyicilerini bağlar. */
  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    this.rafId = requestAnimationFrame(this.loop);
    this.emitState();
  }

  /** Döngüyü duraklatır (durum korunur). */
  stop() {
    if (!this.running) return;
    this.running = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);

    this.emitState();
    // Duraklatınca son kare ekranda kalsın
    this.render();
  }

  /** Döngüyü durdurur ve kaynakları serbest bırakır (React unmount). */
  destroy() {
    this.stop();
    this.keys.clear();
    this.entities = { ball: null, players: [] };
  }

  /** Topu ve oyuncuları başlangıç konumuna alır, skoru sıfırlar. */
  reset() {
    this.score = { home: 0, away: 0 };
    this.set = 1;
    this.entities.ball = this.createBall();
    this.entities.players = this.createPlayers();
    this.emitState();
    this.render();
  }

  /** Sadece rallyi yeniden başlatır (skor korunur). */
  resetRally() {
    this.entities.ball = this.createBall();
    this.entities.players = this.createPlayers();
  }

  // ---------------------------------------------------------------------
  // Varlıkların oluşturulması
  // ---------------------------------------------------------------------

  /** Servis pozisyonundaki top. */
  createBall() {
    return {
      x: COURT.marginX + 120,
      y: 160,
      vx: 180,
      vy: 0,
      radius: PHYSICS.ballRadius,
      rotation: 0,
    };
  }

  /**
   * Sahadaki altılıyı oluşturur.
   *
   * FORMATION.x sol yarı sahaya, FORMATION.y ise sahte derinlik
   * (uzaktaki oyuncu daha küçük ve daha yukarıda) olarak kullanılır.
   */
  createPlayers() {
    return STARTING_SIX.map((id) => {
      const data = getPlayerById(id) ?? ROSTER[0];
      const spot = FORMATION[id] ?? { x: 0.4, y: 0.5 };

      // Derinlik: y 0 → uzak (küçük ve yukarıda), y 1 → yakın (büyük ve aşağıda)
      const depth = 0.8 + spot.y * 0.35;

      return {
        id,
        data,
        x: COURT.marginX + spot.x * this.halfCourtWidth(),
        y: this.groundYFor(spot.y), // ayakların değdiği çizgi
        groundY: this.groundYFor(spot.y),
        vx: 0,
        vy: 0,
        width: 26 * depth,
        height: 76 * depth,
        depth,
        onGround: true,
        facing: 1, // 1 = sağa (filenin olduğu yön)
      };
    });
  }

  /** Sol yarı sahanın dip çizgiden fileye kadar piksel genişliği. */
  halfCourtWidth() {
    return GAME_WIDTH / 2 - COURT.netWidth / 2 - COURT.marginX;
  }

  /**
   * Derinlik oranını (0 uzak, 1 yakın) zemindeki piksel Y'sine çevirir.
   * @param {number} depthRatio
   */
  groundYFor(depthRatio) {
    return COURT.floorY + 8 + depthRatio * (COURT.backY - COURT.floorY - 16);
  }

  /** Şu an kontrol edilen oyuncu nesnesi. */
  getActivePlayer() {
    return this.entities.players.find((p) => p.id === this.activePlayerId);
  }

  // ---------------------------------------------------------------------
  // Girdi
  // ---------------------------------------------------------------------

  handleKeyDown(event) {
    // Boşluk sayfayı kaydırmasın
    if ([' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
    }
    this.keys.add(event.key);
  }

  handleKeyUp(event) {
    this.keys.delete(event.key);
  }

  // ---------------------------------------------------------------------
  // Ana döngü
  // ---------------------------------------------------------------------

  /**
   * requestAnimationFrame döngüsü.
   * @param {number} timestamp
   */
  loop(timestamp) {
    if (!this.running) return;

    // Saniye cinsinden delta; sekmeye karşı üst sınırlanır
    const delta = Math.min((timestamp - this.lastTime) / 1000, PHYSICS.maxDelta);
    this.lastTime = timestamp;

    this.update(delta);
    this.render();

    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Oyun mantığını bir kare ilerletir.
   * @param {number} dt Saniye cinsinden geçen süre
   */
  update(dt) {
    this.updateActivePlayer(dt);
    this.updateBall(dt);

    // TODO(cursor): top–oyuncu çarpışması ve vuruş (manşet / smaç) mekaniği
    // TODO(cursor): sayı kuralları — top zeminde kalan tarafın rakibine sayı
    // TODO(cursor): rakip takım yapay zekâsı
    // TODO(cursor): rotasyon ve servis sırası
  }

  /** Klavye girdisine göre aktif oyuncuyu hareket ettirir. */
  updateActivePlayer(dt) {
    const player = this.getActivePlayer();
    if (!player) return;

    const left = this.keys.has('ArrowLeft') || this.keys.has('a');
    const right = this.keys.has('ArrowRight') || this.keys.has('d');
    const jump = this.keys.has(' ') || this.keys.has('ArrowUp') || this.keys.has('w');

    // Yatay hareket — statlardaki hız değeri ivmeyi ölçekler
    const speedScale = 0.7 + (player.data.stats.speed / 100) * 0.6;
    player.vx = 0;
    if (left) {
      player.vx = -PHYSICS.playerSpeed * speedScale;
      player.facing = -1;
    }
    if (right) {
      player.vx = PHYSICS.playerSpeed * speedScale;
      player.facing = 1;
    }

    // Zıplama — sadece yerdeyken
    if (jump && player.onGround) {
      player.vy = PHYSICS.jumpVelocity;
      player.onGround = false;
    }

    player.vy += PHYSICS.gravity * dt;
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // Zemine oturt
    if (player.y >= player.groundY) {
      player.y = player.groundY;
      player.vy = 0;
      player.onGround = true;
    }

    // Kendi yarı sahasının dışına çıkamaz (fileyi geçemez)
    const minX = COURT.marginX + player.width / 2;
    const maxX = GAME_WIDTH / 2 - COURT.netWidth - player.width / 2;
    player.x = Math.max(minX, Math.min(maxX, player.x));
  }

  /** Topun fiziği: yerçekimi, zemin sekmesi, duvar ve file teması. */
  updateBall(dt) {
    const ball = this.entities.ball;
    if (!ball) return;

    ball.vy += PHYSICS.gravity * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.rotation += ball.vx * dt * 0.02;

    // Zemin
    if (ball.y + ball.radius >= BALL_FLOOR_Y) {
      ball.y = BALL_FLOOR_Y - ball.radius;
      ball.vy *= -PHYSICS.ballRestitution;
      ball.vx *= 0.98;

      // Çok yavaşladıysa rally biter
      if (Math.abs(ball.vy) < 60) {
        this.handlePointScored(ball.x < GAME_WIDTH / 2 ? 'away' : 'home');
      }
    }

    // Yan duvarlar
    if (ball.x - ball.radius <= COURT.marginX) {
      ball.x = COURT.marginX + ball.radius;
      ball.vx *= -1;
    }
    if (ball.x + ball.radius >= GAME_WIDTH - COURT.marginX) {
      ball.x = GAME_WIDTH - COURT.marginX - ball.radius;
      ball.vx *= -1;
    }

    // Tavan
    if (ball.y - ball.radius <= 0) {
      ball.y = ball.radius;
      ball.vy *= -0.6;
    }

    // File — üstünden geçemezse geri seker
    const netX = GAME_WIDTH / 2;
    const netTop = BALL_FLOOR_Y - COURT.netHeight;
    const touchesNetBand = ball.y + ball.radius > netTop;
    const touchesNetColumn =
      Math.abs(ball.x - netX) < COURT.netWidth / 2 + ball.radius;

    if (touchesNetBand && touchesNetColumn) {
      ball.x = ball.x < netX
        ? netX - COURT.netWidth / 2 - ball.radius
        : netX + COURT.netWidth / 2 + ball.radius;
      ball.vx *= -0.5;
    }
  }

  /**
   * Sayıyı işler ve rallyi yeniden başlatır.
   * @param {'home'|'away'} side Sayıyı alan taraf
   */
  handlePointScored(side) {
    this.score[side] += 1;
    this.resetRally();
    this.emitState();
  }

  /** Güncel durumu React tarafına bildirir. */
  emitState() {
    this.onStateChange({
      score: { ...this.score },
      set: this.set,
      running: this.running,
      activePlayer: this.activePlayerId,
    });
  }

  // ---------------------------------------------------------------------
  // Çizim
  // ---------------------------------------------------------------------

  /** Bir kareyi baştan çizer. */
  render() {
    const { ctx } = this;
    if (!ctx) return;

    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.drawBackground();
    this.drawCourt();
    this.drawNet();

    // Arka sıradakiler önce çizilsin (sahte derinlik sıralaması)
    const ordered = [...this.entities.players].sort((a, b) => a.depth - b.depth);
    ordered.forEach((player) => this.drawPlayer(player));

    this.drawBall();
  }

  /** Salon zemini üstü: tribün ve arka fon. */
  drawBackground() {
    const { ctx } = this;
    const crowdBottom = BALL_FLOOR_Y - COURT.netHeight - 30;

    ctx.fillStyle = PALETTE.sky;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Tribün bandı
    ctx.fillStyle = PALETTE.crowd;
    ctx.fillRect(0, 0, GAME_WIDTH, crowdBottom);

    // Piksel seyirci noktaları
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    for (let x = 12; x < GAME_WIDTH; x += 24) {
      for (let y = 20; y < crowdBottom - 20; y += 22) {
        const offset = (x / 24) % 2 === 0 ? 0 : 8;
        ctx.fillRect(x, y + offset, 8, 8);
      }
    }
  }

  /** Kırmızı/beyaz saha zemini ve çizgileri. */
  drawCourt() {
    const { ctx } = this;
    const { floorY, backY, marginX, lineWidth } = COURT;
    const courtHeight = backY - floorY;

    // Serbest bölge (koyu kırmızı) — sahanın çevresi
    ctx.fillStyle = PALETTE.courtOut;
    ctx.fillRect(0, floorY - 24, GAME_WIDTH, GAME_HEIGHT - floorY + 24);

    // Saha içi (canlı kırmızı)
    ctx.fillStyle = PALETTE.courtIn;
    ctx.fillRect(marginX, floorY, GAME_WIDTH - marginX * 2, courtHeight);

    // Dış çizgi
    ctx.strokeStyle = PALETTE.line;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(marginX, floorY, GAME_WIDTH - marginX * 2, courtHeight);

    // Orta çizgi (filenin altı)
    ctx.beginPath();
    ctx.moveTo(GAME_WIDTH / 2, floorY);
    ctx.lineTo(GAME_WIDTH / 2, backY);
    ctx.stroke();

    // Hücum çizgileri (3 metre)
    [GAME_WIDTH / 2 - 130, GAME_WIDTH / 2 + 130].forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(x, floorY);
      ctx.lineTo(x, backY);
      ctx.stroke();
    });
  }

  /** File ve direkler. */
  drawNet() {
    const { ctx } = this;
    const netX = GAME_WIDTH / 2 - COURT.netWidth / 2;
    const netTop = BALL_FLOOR_Y - COURT.netHeight;

    // Direk
    ctx.fillStyle = PALETTE.netPost;
    ctx.fillRect(netX, netTop, COURT.netWidth, COURT.netHeight);

    // File örgüsü
    ctx.strokeStyle = PALETTE.net;
    ctx.lineWidth = 2;
    for (let y = netTop; y < netTop + 70; y += 10) {
      ctx.beginPath();
      ctx.moveTo(netX - 18, y);
      ctx.lineTo(netX + COURT.netWidth + 18, y);
      ctx.stroke();
    }
    for (let x = netX - 18; x <= netX + COURT.netWidth + 18; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, netTop);
      ctx.lineTo(x, netTop + 70);
      ctx.stroke();
    }

    // Üst bant
    ctx.fillStyle = PALETTE.line;
    ctx.fillRect(netX - 20, netTop - 6, COURT.netWidth + 40, 8);
  }

  /**
   * Voleybol topu — beyaz gövde, kırmızı/mavi panel şeritleri.
   */
  drawBall() {
    const { ctx } = this;
    const ball = this.entities.ball;
    if (!ball) return;

    // Zemin gölgesi
    const shadowScale = Math.max(0.3, 1 - (BALL_FLOOR_Y - ball.y) / 400);
    ctx.fillStyle = PALETTE.shadow;
    ctx.beginPath();
    ctx.ellipse(
      ball.x,
      BALL_FLOOR_Y + 4,
      ball.radius * shadowScale,
      ball.radius * 0.35 * shadowScale,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(ball.rotation);

    // Gövde
    ctx.fillStyle = PALETTE.ballA;
    ctx.beginPath();
    ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    // Paneller
    ctx.lineWidth = 3;
    ctx.strokeStyle = PALETTE.ballB;
    ctx.beginPath();
    ctx.arc(0, 0, ball.radius * 0.62, Math.PI * 0.15, Math.PI * 0.95);
    ctx.stroke();

    ctx.strokeStyle = PALETTE.ballC;
    ctx.beginPath();
    ctx.arc(0, 0, ball.radius * 0.62, Math.PI * 1.15, Math.PI * 1.95);
    ctx.stroke();

    // Dış hat
    ctx.strokeStyle = '#20202a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Oyuncuyu basit piksel bloklarıyla çizer.
   *
   * Renkler players.js'teki `colors` alanından gelir, böylece her
   * sporcu kendi forma/saç rengiyle görünür.
   *
   * TODO(cursor): burayı sprite sheet + animasyon karesiyle değiştir.
   *
   * @param {object} player
   */
  drawPlayer(player) {
    const { ctx } = this;
    const { data, x, y, width: w, height: h } = player;
    const { primary, secondary, skin, hair } = data.colors;

    const left = x - w / 2;
    const top = y - h;

    /** Blokları koyu dış hatla çizer — figürün zeminden ayrışması için. */
    const block = (bx, by, bw, bh, color) => {
      ctx.fillStyle = PALETTE.outline;
      ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = color;
      ctx.fillRect(bx, by, bw, bh);
    };

    // Zemin gölgesi
    ctx.fillStyle = PALETTE.shadow;
    ctx.beginPath();
    ctx.ellipse(x, player.groundY + 2, w * 0.55, w * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bacaklar
    block(left + w * 0.15, top + h * 0.62, w * 0.25, h * 0.38, secondary);
    block(left + w * 0.6, top + h * 0.62, w * 0.25, h * 0.38, secondary);

    // Kollar (gövdenin arkasında kalsın)
    block(left - w * 0.18, top + h * 0.32, w * 0.18, h * 0.26, skin);
    block(left + w, top + h * 0.32, w * 0.18, h * 0.26, skin);

    // Forma (gövde)
    block(left, top + h * 0.3, w, h * 0.34, primary);

    // Baş
    block(left + w * 0.2, top + h * 0.08, w * 0.6, h * 0.22, skin);

    // Saç
    block(left + w * 0.16, top + h * 0.04, w * 0.68, h * 0.1, hair);

    // Forma numarası
    ctx.fillStyle = secondary;
    ctx.font = `${Math.round(h * 0.12)}px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(data.number), x, top + h * 0.46);

    // Aktif oyuncu göstergesi
    if (player.id === this.activePlayerId) {
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.moveTo(x, top - 14);
      ctx.lineTo(x - 8, top - 26);
      ctx.lineTo(x + 8, top - 26);
      ctx.closePath();
      ctx.fill();

      // İsim etiketi
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText(data.name.toUpperCase(), x, top - 36);
    }
  }
}
