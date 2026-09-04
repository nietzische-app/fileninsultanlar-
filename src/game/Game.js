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
  GAME_HEIGHT,
  GAME_WIDTH,
  GROUND_Y,
  NET,
  PALETTE,
  PHASE,
  PHYSICS,
  PLAYER,
  RULES,
  SURVIVAL,
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
import { stepBall } from './ballstep.js';
import { contactCenterY, contactRadius, mayTouch } from './reach.js';
import {
  SERVE,
  advanceServeMeter,
  aiServeChoice,
  aiServeDelay,
  computeServeVelocity,
  meterToAim,
  meterToPower,
  safeAimRange,
} from './serve.js';
import {
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
import { paketle, uygula, girdiPaketle, oyuncuFizikUygula } from './snapshot.js';
import { ilgiEki, upper } from '../utils/text.js';

/**
 * Klavye eşlemeleri.
 *
 * Tek kişilik oyunda her iki set de aynı oyuncuyu sürer (WASD ya da ok
 * tuşları, hangisi alışkınsa). Co-Op / VS'te ikinci set ikinci oyuncuya
 * gider — tek klavyede iki kişi oynayabilsin diye.
 */
/**
 * Arka planın tazelenme aralığı (saniye).
 *
 * 1/14 sn: tribün ve ışıklar bu hızda kıpırdıyor. Daha yükseği gözle
 * fark edilmiyor, daha düşüğünde kalabalık kesikli görünmeye başlıyor.
 */
const BG_REFRESH = 1 / 10;

/**
 * Ağ ayarları.
 *
 * 20 Hz durum: 60 Hz göndermek bant genişliğini üç katına çıkarıp
 * hissedilir bir şey kazandırmıyor — top zaten karelerin arasında
 * yumuşak görünecek kadar yavaş yer değiştiriyor. Tuşlar ise
 * değiştiği anda gidiyor, orada gecikme doğrudan hissediliyor.
 */
const AG = {
  durumHz: 20,

  /**
   * Girdinin EN AZ bu sıklıkta yollanması (Hz).
   *
   * Girdi normalde yalnız değiştiğinde gidiyor. Tahmin gelince bu tek
   * başına yetmez oldu: istemci "sunucu benim hangi anımı işledi"
   * sorusunu kendi girdi damgasının geri dönmesinden okuyor, tuşa
   * dokunmadığında damga tazelenmiyor ve tahmin penceresi durmadan
   * büyüyordu — 3 saniye kıpırdamayan oyuncu 180 adım geri sarılıyordu.
   * Değişmese de saniyede 20 kez damga gitmesi bunu kesiyor.
   */
  onayHz: 20,

  /**
   * Tahminde ileri sarılacak EN FAZLA süre (sn).
   *
   * Bağlantı kopunca son onay eskir ve pencere sınırsız büyür: istemci
   * her pakette yüzlerce adım koşturmaya çalışır, kare süresi patlar ve
   * "donma"nın üstüne bir de ısınan telefon gelir. 0.5 sn = 30 adım;
   * bunun ötesindeki gecikmede zaten oynanabilir bir maç yok.
   */
  azamiTahmin: 0.5,

  /**
   * Uzlaştırma düzeltmesinin ekrana yedirilme hızı (1/sn).
   *
   * Sunucu tahmini düzelttiğinde oyuncuyu doğrudan yeni yere yazmak
   * ışınlanma gibi görünüyor. Fark bunun yerine bir SAPMA olarak
   * tutuluyor ve her karede bu oranda eritiliyor: 12 ≈ 80 ms'de
   * neredeyse kapanıyor, yani düzeltme görünür ama sıçrama değil.
   */
  duzeltmeHizi: 12,

  /**
   * Bu mesafenin üstündeki düzeltme YEDİRİLMEZ, anında uygulanır (px).
   *
   * Sayı arası, dalış ya da bir paket kaybı sonrası tahmin gerçekten
   * uzağa düşebiliyor. Böyle bir farkı yumuşatmak oyuncuyu saniyelerce
   * yanlış yerde gösterirdi; büyük farkta doğruluk, küçük farkta
   * yumuşaklık isteniyor.
   */
  anindaDuzeltme: 60,
};

const P1_KEYS = {
  a: 'left',
  A: 'left',
  d: 'right',
  D: 'right',
  w: 'up',
  W: 'up',
  s: 'dive',
  S: 'dive',
  ' ': 'action',
  z: 'action',
  Z: 'action',
};

/**
 * Misafir tarafta ters çevrilen sesler.
 *
 * Motorun sesleri ev sahibinin gözünden: `point` ev sahibi sayı
 * yapınca çalıyor. Online maçta misafir karşı takımı oynuyor, yani
 * ev sahibinin sayısı onun için kayıp. Ekran ikisinde de aynı sahayı
 * gösteriyor ama zafer sesi tarafa göre değişmeli — yoksa misafir
 * yenilirken kutlama sesi duyar.
 */
const MISAFIR_SES = {
  point: 'pointLost',
  pointLost: 'point',
  streak: 'pointLost',
  setWon: 'setLost',
  setLost: 'setWon',
  victory: 'defeat',
  defeat: 'victory',
};

const P2_KEYS = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'dive',
  Enter: 'action',
};

/** Boş bir girdi durumu. */
function createInputState() {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    action: false,
    dive: false,
  };
}

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
    /**
     * Başsız mod — motor sunucuda, tarayıcısız çalışır.
     *
     * Simülasyonun kendisi (fizik, yapay zekâ, kurallar, servis) zaten
     * DOM'a dokunmuyor; tarayıcıya bağlı olan üç şey var ve üçü de
     * `update()` dışında: arka plan önbelleği (canvas), klavye
     * dinleyicileri ve `requestAnimationFrame` döngüsü. Başsız modda
     * üçü de atlanır, döngüyü çağıran taraf sürer (bkz. `ilerlet`).
     *
     * Sunucunun maçı koşturması bunun için gerekli: ev sahibi
     * yetkili mimaride maçı bir oyuncunun cihazı yönetiyor — arkadaş
     * maçında sorun değil, yabancıyla oynarken hem hile açık hem de
     * gecikme avantajı tamamen ev sahibinde.
     */
    this.bassiz = Boolean(options.bassiz);

    this.canvas = canvas ?? null;
    this.ctx = this.bassiz ? null : canvas.getContext('2d');

    this.playMode = ['solo', 'coop', 'vs'].includes(options.playMode)
      ? options.playMode
      : 'solo';

    // Co-Op iki sultanı aynı takımda oynatır, yani 2v2 zorunludur
    const requested = options.mode === '2v2' ? '2v2' : '1v1';
    this.mode = this.playMode === 'coop' ? '2v2' : requested;
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
    /** Henüz adıma dönüşmemiş gerçek zaman artığı (sn). */
    this.accumulator = 0;
    /**
     * Atılan sabit adım sayısı.
     *
     * Anlık görüntülerin sırasını bu belirliyor: misafir, numarası
     * geride kalan bir paketi atıyor. Sabit adım olmadan böyle bir
     * numara tanımlanamazdı — ağ tarafının ona dayanmasının sebebi bu.
     */
    this.adim = 0;

    /**
     * Ağ rolü: 'ev' simüle eder ve durumu yollar, 'misafir' yalnızca
     * çizer ve tuşlarını yollar. `null` çevrimdışı oyun.
     */
    this.agRol = options.agRol ?? null;
    /**
     * Çevrimiçi maçta BU istemcinin sürdüğü yuva ('p1' | 'p2').
     *
     * Sahada iki oyuncu da "kontrol ediliyor" (ikisi de insan), yani
     * ok göstergesi ikisinin üstünde birden çıkıyordu ve oyuncu hangisi
     * olduğunu ayırt edemiyordu. Bu alan doluysa yalnız kendi
     * oyuncusunun üstüne çiziliyor.
     */
    this.agYuvam = options.agYuvam ?? null;
    /**
     * Karşı oyuncunun takma adı — çevrimiçide sahada onun üstünde
     * yazıyor. Hızlı eşleşmede rakip bir yabancı; adsız bir sprite'a
     * karşı oynamak maçı kişisiz bırakıyordu.
     */
    this.agRakipAd = options.agRakipAd ?? null;
    this.agGonder = options.agGonder ?? null;
    /** Bir sonraki pakete binecek efekt/ses olayları. */
    this.agOlaylar = [];
    this.agSonDurum = -Infinity;
    this.agSonGirdi = '';
    /** Uygulanan son paketin adım numarası; -1 = henüz paket gelmedi. */
    this.agSonAdim = -1;
    /** Son durum paketinin geldiği an (motor zamanı); null = hiç gelmedi. */
    this.agSonPaketAn = null;
    /**
     * Misafir tarafın konum ara değerlemesi.
     *
     * Paketler saniyede 20 kez geliyor ama ekran 60 kez çiziliyor.
     * Konumları paket gelir gelmez yazarsak aradaki 40 karede hiçbir
     * şey kıpırdamaz — oyun 20 FPS'e düşmüş gibi görünür ("misafirin
     * oyunu çok donuyor" şikâyeti tam olarak buydu). Bunun yerine son
     * paketi HEDEF alıp, o ana kadarki konumdan hedefe doğru her karede
     * biraz ilerliyoruz.
     *
     * Bedeli: misafirin gördüğü görüntü bir paket kadar (~50 ms)
     * geriden gelir. Takas bilinçli — sıçrayan ama "anlık" bir görüntü,
     * akan ama 50 ms geriden gelen görüntüden daha kötü oynanıyor.
     */
    this.agAra = null;

    /**
     * Gecikme telafisi açık mı (istemci tarafı tahmin).
     *
     * Kapatılabilir olması ölçüm için: aynı koşumda açık ve kapalı
     * sayıları yan yana koyabilmek, iyileşmenin gerçekten tahminden
     * geldiğini gösteriyor.
     */
    this.agTahmin = options.agTahmin ?? true;

    /**
     * Girdi geçmişi (yalnız istemcide): [{ an, tuslar }].
     *
     * Uzlaştırma sırasında geri sarılan her adım için "o anda hangi
     * tuşlar basılıydı" sorusunun cevabı burada. Yalnız o anki tuşları
     * kullanıp tüm pencereyi onunla sarsaydık, tuşu yeni bırakmış
     * oyuncu geri sarımda hâlâ koşuyor sanılır ve her pakette geri
     * teperdi.
     */
    this.agGirdiGecmisi = [];
    /** İstemcide: en son girdi paketi yollanan an (motor saati). */
    this.agSonGirdiAn = -Infinity;
    /**
     * Sunucuda: yuva başına `{ z, geldi }` — istemcinin damgası ve o
     * paketin SUNUCU saatinde geldiği an. Bir de simülasyona katılmış
     * hâli ayrı tutuluyor.
     *
     * İkisi ayrı çünkü paket iki adımın arasında geliyor: alındığı an
     * onaylasaydık istemci daha işlenmemiş bir girdiyi işlenmiş sanıp
     * yarım adım fazla tahmin ederdi.
     *
     * `geldi` alanının sebebi daha ince. İstemci tahmin penceresini
     * "kendi saatim eksi geri dönen damgam" diye hesaplıyor; bu fark
     * gidiş-dönüş süresi DEĞİL, ona damganın sunucuda beklediği süre de
     * ekleniyor. Girdi her adımda yollanmadığı için (değişmedikçe
     * saniyede 20) bu bekleme 50 ms'i buluyordu ve istemci kendini üç
     * adım fazla ileri sürüyordu — ölçümde her pakette 27 px'lik bir
     * sıçrama olarak görünüyordu. Bekleme süresini sunucu ölçüp geri
     * yolluyor, istemci onu düşüyor.
     */
    this.agOnay = { p1: null, p2: null };
    this.agOnayIslenen = { p1: null, p2: null };
    /**
     * İstemcide: tahminle sunucu arasındaki, ekrana yedirilen sapma.
     *
     * Düzeltme oyuncunun konumuna doğrudan yazılmıyor; fark burada
     * tutulup her karede eritiliyor (bkz. AG.duzeltmeHizi).
     */
    this.agSapma = { x: 0, y: 0 };

    /**
     * Karşı taraf farklı paket sürümü konuşuyor mu.
     *
     * Site ile röle ayrı dağıtılıyor: biri güncellenip öbürü
     * güncellenmezse paketler gelir ama hiçbiri uygulanmaz. Belirtisi
     * "rakip bekleniyor" yazan donmuş bir ekran olurdu ve sebebi
     * görünmezdi. Bayrak maç ekranına gerçek sebebi söyletiyor.
     */
    this.agSurumUyusmazligi = false;

    /**
     * Ses çağrılarının tek kapısı.
     *
     * Motorun içindeki `Sfx.x()` çağrıları buradan geçiyor; ev sahibi
     * rolündeyken çağrı hem yerel çalınıyor hem de olay olarak
     * misafire yazılıyor. 27 çağrı yerini tek yerden yönetmenin sebebi
     * bu: aksi hâlde online maç sessiz olurdu ve her yeni ses
     * eklendiğinde biri onu ağa koymayı unuturdu.
     *
     * Salon uğultusu (`setAtmosphere`) bilerek dışarıda — o her karede
     * çağrılıyor ve misafir zaten aşama/coşku değerlerinden kendisi
     * hesaplıyor.
     */
    this.ses = new Proxy(
      {},
      {
        get: (_hedef, ad) => (...args) => {
          if (this.agRol === 'ev') this.agOlay('ses', ad, args);
          // Sunucuda hoparlör yok; olay yine de misafirlere gidiyor
          if (!this.bassiz) Sfx[ad]?.(...args);
        },
      },
    );

    /**
     * İnsan girdileri, oyuncu yuvası başına.
     * `this.input` p1'in takma adıdır: tek kişilik akıştaki tüm mevcut
     * kod (dokunmatik, servis, tam vuruş) değişmeden çalışsın diye.
     */
    this.inputs = { p1: createInputState(), p2: createInputState() };
    this.input = this.inputs.p1;

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
    this.actionPresses = { p1: 0, p2: 0 };
    this.lastActionPresses = { p1: 0, p2: 0 };
    /** Bu karede hangi yuvalarda yeni basış görüldü. */
    this.actionEdge = { p1: false, p2: false };

    // Maç durumu
    this.score = { home: 0, away: 0 };
    this.sets = { home: 0, away: 0 };
    this.setHistory = [];
    this.setNumber = 1;
    this.servingSide = 'home';
    this.streak = { side: null, count: 0 };

    /** Üç temas kuralı takibi — hangi taraf kaç kez dokundu. */
    this.touch = { side: null, count: 0 };


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

    /*
     * Arka plan önbelleği. Ayrı bir yüzeye çizilip her karede tek
     * `drawImage` ile kopyalanır.
     */
    // Başsızda çizim yok — önbelleğe de gerek yok (document da yok)
    this.bgCanvas = this.bassiz ? null : document.createElement('canvas');
    if (this.bgCanvas) {
      this.bgCanvas.width = GAME_WIDTH;
      this.bgCanvas.height = GAME_HEIGHT;
    }
    this.bgCtx = this.bgCanvas ? this.bgCanvas.getContext('2d') : null;
    this.bgTime = -Infinity;
    this.bgKey = '';
  }

  // ===================================================================
  // Yaşam döngüsü
  // ===================================================================

  start() {
    if (this.running || this.finished) return;
    this.clearInput();
    this.running = true;
    this.lastTime = performance.now();
    // Duraklatmada biriken artık, dönüşte tek karede boşalmasın
    this.accumulator = 0;

    /*
     * Başsızda klavye ve rAF yok: girdi ağdan geliyor, döngüyü de
     * çağıran taraf (sunucu) `ilerlet` ile sürüyor.
     */
    if (!this.bassiz) {
      window.addEventListener('keydown', this.handleKeyDown);
      window.addEventListener('keyup', this.handleKeyUp);
      window.addEventListener('blur', this.handleWindowBlur);
      this.rafId = requestAnimationFrame(this.loop);
    }

    this.emitState(true);
  }

  stop() {
    if (!this.running) return;
    this.running = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (!this.bassiz) {
      window.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('keyup', this.handleKeyUp);
      window.removeEventListener('blur', this.handleWindowBlur);
    }

    // Duraklatınca basılı kalan tuş/dokunuş devam etmesin
    this.clearInput();

    if (!this.bassiz) {
      // Duraklatınca tribün de sussun
      Sfx.hushAtmosphere();
      // Duraklatınca son kare ekranda kalsın
      this.render();
    }

    this.emitState(true);
  }

  destroy() {
    this.stop();
    this.clearInput();
    if (!this.bassiz) Sfx.hushAtmosphere();
    this.particles.length = 0;
    this.rings.length = 0;
    this.ballTrail.length = 0;
  }

  // ===================================================================
  // Varlıklar
  // ===================================================================

  createPlayers() {
    const players = [];

    /*
     * Yuva dağıtımı:
     *   solo → yalnızca ilk sultan insan (p1)
     *   coop → iki sultan da insan (p1 + p2), aynı takım
     *   vs   → p1 Türkiye'de, p2 rakip takımda
     */
    this.homeIds.forEach((id, index) => {
      const data = getPlayerById(id) ?? getPlayerById(DEFAULT_PLAYER_ID);
      let slot = null;
      if (index === 0) slot = 'p1';
      else if (this.playMode === 'coop' && index === 1) slot = 'p2';

      players.push(
        this.makePlayer(`home-${index}`, data, 'home', Boolean(slot), slot)
      );
    });

    const awayRoster = buildAwayPlayers(this.opponent, this.perSide);
    awayRoster.forEach((data, i) => {
      const slot = this.playMode === 'vs' && i === 0 ? 'p2' : null;
      players.push(this.makePlayer(`away-${i}`, data, 'away', Boolean(slot), slot));
    });

    return players;
  }

  makePlayer(id, data, side, controlled, controlSlot = null) {
    return {
      id,
      data,
      side,
      controlled,
      /** Hangi insan oyuncunun sürdüğü ('p1' | 'p2' | null). */
      controlSlot,
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
      /** Vuruş salınımında kalan süre (sn); 0 = vuruş kapalı. */
      swingTimer: 0,
      // Dalış durumu
      diveTimer: 0,
      recoverTimer: 0,
      diveCooldown: 0,
      diveDir: 1,
      // AI durumu
      aiTimer: 0,
      aiBlockChoice: null,
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
      lastHitBy: null,
      lastHitSide: null,
      /** Servis atıldı ve henüz kimse dokunmadı — aut kuralı bunda işler. */
      serveUntouched: false,
      /** Dokunulmamış servis dip çizgiyi aştı (duvardan geri sekse de kalır). */
      serveOut: false,
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
      player.swingTimer = 0;
      player.actionPressedAt = null;
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
  /**
   * 1. oyuncunun sultanı. HUD ve istatistikler buna bakar.
   * Co-Op/VS'te 2. oyuncunun kendi oyuncusu ayrıca `controlSlot` ile
   * bulunur.
   */
  getControlledPlayer() {
    return (
      this.players.find((p) => p.controlled && p.controlSlot === 'p1') ??
      this.players.find((p) => p.controlled) ??
      null
    );
  }

  // ===================================================================
  // Girdi
  // ===================================================================

  /**
   * Basılan tuş hangi oyuncuya ait?
   * Tek kişilik oyunda iki set de p1'i sürer.
   */
  resolveKeyBinding(key) {
    if (key in P1_KEYS) return { slot: 'p1', action: P1_KEYS[key] };
    if (key in P2_KEYS) {
      /*
       * İkinci tuş takımı yalnız TEK KLAVYEDE iki kişi oynarken ayrı
       * bir yuvaya gider. Çevrimiçide iki oyuncu ayrı cihazda ve her
       * biri kendi ekranında 1. oyuncu; ok tuşlarını 2. yuvaya
       * yazmak, misafirin tuşunun hiçbir yere gitmemesine yol
       * açıyordu (gönderilen yuva p1, yazılan p2).
       */
      const yerelIkinci = this.playMode !== 'solo' && !this.agRol;
      return { slot: yerelIkinci ? 'p2' : 'p1', action: P2_KEYS[key] };
    }
    return null;
  }

  handleKeyDown(event) {
    const binding = this.resolveKeyBinding(event.key);
    if (!binding) return;
    event.preventDefault();

    const { slot, action } = binding;

    if (action === 'action' && !this.inputs[slot].action) {
      this.actionPresses[slot] += 1;
    }
    this.inputs[slot][action] = true;
  }

  handleKeyUp(event) {
    const binding = this.resolveKeyBinding(event.key);
    if (!binding) return;
    event.preventDefault();

    const { slot, action } = binding;

    this.inputs[slot][action] = false;
  }

  /**
   * Bir tuşu doğrudan bir yuvaya yazar.
   *
   * Dokunmatik butonlar tek telefonda oynandığı için hep p1'e gider;
   * yuva yine de parametre çünkü girdinin tek giriş kapısı burası
   * olmalı. Ağdan gelen ikinci oyuncunun tuşları da p2 diyerek buradan
   * girecek — klavye/dokunmatik/ağ arasında ayrı yol yok.
   *
   * @param {'left'|'right'|'up'|'down'|'action'|'dive'} name
   * @param {boolean} pressed
   * @param {'p1'|'p2'} [slot]
   */
  setInput(name, pressed, slot = 'p1') {
    const input = this.inputs[slot];
    if (!input || !(name in input)) return;

    if (name === 'action' && pressed && !input.action) {
      this.actionPresses[slot] += 1;
    }
    input[name] = pressed;
  }

  /**
   * Bir yuvanın tüm tuşlarını tek seferde uygular.
   *
   * Ağ üzerinden gelen girdi kare kare bir paket hâlinde gelir; tuş
   * tuş `setInput` çağırmak yerine paketi olduğu gibi vermek hem daha
   * ucuz hem de eksik alanı "bırakıldı" saymayı garantiler — kayıp bir
   * "bıraktım" paketi yüzünden oyuncunun sağa doğru koşup gitmesinin
   * önüne geçen şey bu.
   *
   * @param {'p1'|'p2'} slot
   * @param {object} state Tuş adı → basılı mı
   */
  applyInput(slot, state = {}) {
    if (!this.inputs[slot]) return;
    Object.keys(this.inputs[slot]).forEach((name) => {
      this.setInput(name, Boolean(state[name]), slot);
    });
  }

  /** Tüm insan girdilerini sıfırlar. */
  clearInput() {
    ['p1', 'p2'].forEach((slot) => {
      const input = this.inputs[slot];
      input.left = false;
      input.right = false;
      input.up = false;
      input.down = false;
      input.action = false;
      input.dive = false;
      // Duraklatma/odak kaybı sonrası eski basış tetiklenmesin
      this.lastActionPresses[slot] = this.actionPresses[slot];
    });

    this.players?.forEach((player) => {
      if (!player.controlled) return;
      player.input.left = false;
      player.input.right = false;
      player.input.up = false;
      player.input.action = false;
      player.input.dive = false;
    });

    /*
     * Tahmin geçmişi de temizleniyor. Odak kaybı ya da duraklama
     * sonrası geri dönen oyuncunun geri sarımı, tuşlar bırakılmadan
     * ÖNCEKİ kayıtları kullanırdı: sunucu duran bir oyuncu gösterirken
     * istemci onu hâlâ koşturur, her pakette geri çekilirdi.
     */
    this.agGirdiGecmisi = [];
    this.agSonGirdi = '';
    this.agSapma = { x: 0, y: 0 };
  }

  handleWindowBlur() {
    this.clearInput();
  }

  // ===================================================================
  // Ağ
  // ===================================================================

  /**
   * Her karenin sonundaki ağ işi.
   *
   * Ev sahibi durum yollar, misafir tuş yollar. İkisinin de hızı
   * ayrı ayarlanıyor: durum saniyede ~20 kez yeter (çizim arada
   * yumuşatılıyor), tuş ise değiştiği anda gitmeli — gecikme oradan
   * hissediliyor.
   */
  agAkis() {
    if (!this.agRol || !this.agGonder) return;

    if (this.agRol === 'ev') {
      if (this.time - this.agSonDurum < 1 / AG.durumHz) return;
      this.agSonDurum = this.time;
      this.agGonder(paketle(this, this.agOlaylar));
      this.agOlaylar = [];
      return;
    }

    this.agGirdiGonder();
  }

  /**
   * Misafirin tuş durumunu ev sahibine yollar.
   *
   * Normalde yalnız DEĞİŞTİĞİNDE yollanır: tuşlar çoğu karede aynı, her
   * karede paket atmak röleyi ve pili boşuna yorar. Basış sayacı da
   * imzaya dahil, çünkü bas–bırak aynı kareye sıkışsa tuş durumu
   * değişmemiş görünür ama vuruş yapılmıştır.
   *
   * `zorla`, kare döngüsünün duracağı anlar için: sekme arka plana
   * geçince tarayıcı `requestAnimationFrame`i durduruyor, yani basılı
   * tuşu temizlesek bile onu YOLLAYACAK kare hiç gelmiyordu ve ev
   * sahibinde tuş sonsuza kadar basılı kalıyordu — oyuncu geri
   * döndüğünde kendini duvara koşarken buluyordu. Soket arka planda da
   * çalıştığı için doğrudan yollamak bunu çözüyor.
   *
   * @param {boolean} [zorla] Değişmemiş olsa da yolla
   */
  agGirdiGonder(zorla = false) {
    if (this.agRol !== 'misafir' || !this.agGonder) return;

    const tuslar = this.inputs.p1;
    const imza = `${tuslar.left}${tuslar.right}${tuslar.up}${tuslar.down}${tuslar.action}${tuslar.dive}|${this.actionPresses.p1}`;
    const degisti = imza !== this.agSonGirdi;

    /*
     * Değişmemiş girdi de arada bir gidiyor: paket yalnız tuş
     * bilgisi taşımıyor, istemcinin saat damgasını da taşıyor ve
     * tahmin penceresi o damganın tazeliğine bağlı (bkz. AG.onayHz).
     */
    const damgaEskidi = this.time - this.agSonGirdiAn >= 1 / AG.onayHz;
    if (!zorla && !degisti && !damgaEskidi) return;

    if (degisti) {
      this.agSonGirdi = imza;
      this.agGirdiGecmisiYaz(tuslar);
    }
    this.agSonGirdiAn = this.time;
    this.agGonder(girdiPaketle(tuslar, this.actionPresses.p1, this.time));
  }

  /**
   * Girdi geçmişine bir kayıt düşer ve eskiyenleri atar.
   *
   * Pencere `AG.azamiTahmin`in iki katı: geri sarım o kadar geriye
   * gidebiliyor, biraz da pay bırakıyoruz. Sınırsız büyüseydi uzun bir
   * maçta dizi on binlerce kayda çıkar ve her paket onu tararken kare
   * süresini yerdi.
   */
  agGirdiGecmisiYaz(tuslar) {
    this.agGirdiGecmisi.push({ an: this.time, tuslar: { ...tuslar } });
    const sinir = this.time - AG.azamiTahmin * 2;
    while (this.agGirdiGecmisi.length > 1 && this.agGirdiGecmisi[1].an < sinir) {
      this.agGirdiGecmisi.shift();
    }
  }

  /**
   * Verilen andaki tuş durumu — geri sarım için.
   *
   * "O andan önceki SON kayıt" aranıyor, en yakını değil: tuşlar bir
   * seviye, bir olay değil. `an`dan sonraki bir kayıt henüz olmamış bir
   * şeydir; onu kullanmak geleceği tahmine karıştırırdı.
   */
  agGirdiOku(an) {
    const gecmis = this.agGirdiGecmisi;
    let bulunan = null;
    for (let i = 0; i < gecmis.length; i += 1) {
      if (gecmis[i].an > an) break;
      bulunan = gecmis[i].tuslar;
    }
    return bulunan ?? gecmis[0]?.tuslar ?? this.inputs.p1;
  }

  /**
   * Misafirde son durum paketinden bu yana geçen süre (sn).
   *
   * Ev sahibinin sekmesi arka plana geçerse ya da bağlantısı takılırsa
   * paketler durur ama soket açık kalır: misafirin ekranı donar ve
   * hiçbir açıklama görünmez. Maç ekranı bu değere bakıp "rakip
   * bekleniyor" diyor.
   */
  agSessizlik() {
    if (this.agRol !== 'misafir' || this.agSonPaketAn === null) return 0;
    return Math.max(0, this.time - this.agSonPaketAn);
  }

  /**
   * Ağdan gelen paketi işler.
   *
   * @returns {boolean} Paket tanındıysa true
   */
  agPaketAl(paket, yuva = 'p2') {
    if (!paket || typeof paket !== 'object') return false;

    if (paket.t === 'durum' && this.agRol === 'misafir') {
      if (!uygula(this, paket)) return false;
      this.agSonPaketAn = this.time;
      (paket.o ?? []).forEach((olay) => this.agOlayUygula(olay));
      return true;
    }

    if (paket.t === 'girdi' && this.agRol === 'ev') {
      /*
       * Yuva parametre: ev sahibi bir oyuncunun cihazıyken tek bir
       * karşı taraf vardı ve p2 sabitti. Sunucu maçı koştururken İKİ
       * istemciden de girdi geliyor — hangisinin hangi yuvaya
       * yazılacağını çağıran biliyor (soket başına).
       */
      this.agGirdiUygula(paket, yuva);
      return true;
    }

    return false;
  }

  /**
   * Misafirin tuşlarını 2. yuvaya yazar.
   *
   * `setInput` yerine doğrudan yazılıyor çünkü basış sayacı ağdan
   * geliyor: `setInput` yükselen kenarda sayacı kendi artırır ve
   * misafirin sayacıyla çakışırdı. Sayacı olduğu gibi almak, iki kare
   * arasına sıkışan hızlı bir vuruşun ağ üzerinden de kaybolmamasını
   * sağlıyor — yerel oyunda bu sorunu çözen mekanizmanın aynısı.
   */
  agGirdiUygula(paket, yuvaAdi = 'p2') {
    const gelen = paket.k ?? {};
    const yuva = this.inputs[yuvaAdi];
    if (!yuva) return;
    Object.keys(yuva).forEach((ad) => {
      yuva[ad] = Boolean(gelen[ad]);
    });
    if (typeof paket.b === 'number' && paket.b >= this.actionPresses[yuvaAdi]) {
      this.actionPresses[yuvaAdi] = paket.b;
    }
    /*
     * Damga ALINDI olarak işaretleniyor, İŞLENDİ olarak değil —
     * aradaki fark `update`in başında kapanıyor. Burada işlenmiş
     * saysaydık, adımlar arasında gelen bir paket sayesinde istemci
     * bir adım fazla ileri tahmin ederdi.
     */
    if (typeof paket.z === 'number') {
      this.agOnay[yuvaAdi] = { z: paket.z, geldi: this.time };
    }
  }

  /**
   * Sunucudan gelen düzeltmeyi kendi oyuncusuna uygular ve aradaki
   * gecikmeyi tahminle kapatır.
   *
   * İşleyiş: paket, istemcinin `az` anındaki girdisine kadar olan
   * gerçeği taşıyor. O hâlden başlanıp aradaki adımlar YEREL girdi
   * geçmişiyle yeniden koşturuluyor — yani "geçmişi düzelt, bugüne
   * kadar tekrar oyna". Sonuç, oyuncunun sunucuda ŞU AN olduğu yerin
   * tahmini.
   *
   * @returns {number|null} Tahmin edilen oyuncunun sırası — ara
   *   değerlemeden çıkarılması için; tahmin kapalıysa null.
   */
  agUzlastir(paket) {
    if (!this.agTahmin || this.agRol !== 'misafir' || !this.agYuvam) return null;

    const sira = this.players.findIndex((p) => p.controlSlot === this.agYuvam);
    const veri = paket.p?.[sira];
    if (sira < 0 || !veri) return null;

    const player = this.players[sira];
    const oncekiX = player.x;
    const oncekiY = player.y;

    // 1) Sunucunun gerçeği
    oyuncuFizikUygula(player, veri);

    // 2) Aradaki adımları kendi girdimizle yeniden koştur
    const yuvaSira = this.agYuvam === 'p1' ? 0 : 1;
    const onay = paket.az?.[yuvaSira];
    if (typeof onay === 'number') {
      /*
       * Pencere = gidiş-dönüş. Ham fark buna eşit değil: damganın
       * sunucuda beklediği süre (`ay`) de içinde. Düşülmezse istemci
       * her pakette birkaç adım fazla ileri sarıp geri sıçrıyor.
       */
      const bekleme = paket.ay?.[yuvaSira] ?? 0;
      const pencere = Math.max(0, Math.min(AG.azamiTahmin, this.time - onay - bekleme));
      const adet = Math.round(pencere / PHYSICS.step);
      /*
       * Aşama pakettekinden okunuyor: girdinin işlenip işlenmediğini
       * (`active`) belirleyen o. Servis aşamasında sunucu oyuncuyu hiç
       * hareket ettirmiyor; orada tahmin etseydik istemci sunucunun
       * yapmadığı bir hareketi çizerdi.
       */
      const active = paket.f === PHASE.RALLY;
      for (let i = 1; i <= adet; i += 1) {
        this.insanOyuncuAdimla(player, this.agGirdiOku(onay + i * PHYSICS.step), active, PHYSICS.step);
      }
    }

    // 3) Farkı ekrana yedirmek üzere sapmaya al
    this.agSapmaAl(player, oncekiX, oncekiY);
    return sira;
  }

  /**
   * Düzeltme farkını görünür sapmaya çevirir.
   *
   * Oyuncu düzeltilmiş konuma YAZILDI; ama ekranda hemen oraya
   * atlamasın diye eski konumla arasındaki fark `agSapma`ya alınıyor.
   * Çizim `x + sapma` gösteriyor: düzeltme anında sapma tam olarak eski
   * konumu geri veriyor, sonra her karede eriyip gerçek konuma
   * yaklaşıyor. Yani simülasyon doğru yerde, göz kayarak takip ediyor.
   *
   * Büyük farkta yedirme yok: bkz. AG.anindaDuzeltme.
   */
  agSapmaAl(player, oncekiX, oncekiY) {
    const dx = oncekiX - player.x;
    const dy = oncekiY - player.y;
    if (Math.hypot(dx, dy) > AG.anindaDuzeltme) {
      this.agSapma.x = 0;
      this.agSapma.y = 0;
      return;
    }
    this.agSapma.x = dx;
    this.agSapma.y = dy;
  }

  /**
   * Bir oyuncunun ÇİZİM kaydırması — yoksa null.
   *
   * Yalnız tahmin edilen oyuncuda ve yalnız yedirilmemiş düzeltme
   * kaldığında dolu. Tek bir yerden okunmasının sebebi ölçüm: hem
   * çizim hem de gecikme ölçümü aynı fonksiyonu çağırıyor, yani
   * ölçtüğümüz sayı oyuncunun GÖRDÜĞÜ konum. Ayrı hesaplasalardı
   * ölçüm ekrandaki sıçramayı hiç göremezdi.
   */
  agCizimKaydirma(player) {
    if (!this.agTahmin || !this.agYuvam || player.controlSlot !== this.agYuvam) return null;
    if (this.agSapma.x === 0 && this.agSapma.y === 0) return null;
    return this.agSapma;
  }

  /**
   * İstemcinin kendi oyuncusunu bir adım ileri sürer.
   *
   * Paketler arasında çalışan kısım bu: tuşa basıldığı anda oyuncu
   * kıpırdıyor, sunucunun onayı beklenmiyor. Sunucu farklı düşünürse
   * bir sonraki pakette `agUzlastir` düzeltiyor.
   */
  agTahminAdimla(dt) {
    if (!this.agTahmin || !this.agYuvam) return;
    const player = this.players.find((p) => p.controlSlot === this.agYuvam);
    if (!player) return;

    /*
     * Kare arasına sıkışan basış tahminde de "basılı" sayılıyor —
     * sunucudaki `updatePlayers` ile aynı kural. Aksi hâlde hızlı
     * tıklanan vuruş yerel ekranda hiç görünmez, yalnızca sunucunun
     * düzeltmesiyle bir gidiş-dönüş sonra ortaya çıkardı.
     */
    const pad = this.inputs.p1;
    this.insanOyuncuAdimla(
      player,
      { ...pad, action: pad.action || this.actionEdge.p1 },
      this.phase === PHASE.RALLY,
      dt,
    );

    // Yedirilen düzeltme
    const erime = Math.max(0, 1 - AG.duzeltmeHizi * dt);
    this.agSapma.x *= erime;
    this.agSapma.y *= erime;
    if (Math.abs(this.agSapma.x) < 0.05) this.agSapma.x = 0;
    if (Math.abs(this.agSapma.y) < 0.05) this.agSapma.y = 0;
  }


  // ===================================================================
  // Ana döngü
  // ===================================================================

  /**
   * Kare döngüsü — çizim kare hızında, fizik sabit adımda.
   *
   * Geçen gerçek zaman biriktirilir ve `PHYSICS.step`lik tam adımlarla
   * tüketilir; artan kalır, bir sonraki kareye devreder. Bu yüzden
   * bazı karelerde hiç adım atılmaz (120 Hz ekran), bazılarında iki
   * adım atılır (30 Hz ekran) — ikisinde de saha aynı hızda akar.
   */
  loop(timestamp) {
    if (!this.running) return;

    const elapsed = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    this.ilerlet(elapsed);

    this.render();
    this.emitState();
    this.agAkis();

    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Geçen gerçek zamanı sabit adımlara çevirip simülasyonu ilerletir.
   *
   * Çizimden ayrı durması gerekiyor: sunucuda çizim yok ama zaman
   * aynı şekilde ilerlemeli. Tarayıcı `loop`tan, sunucu kendi
   * zamanlayıcısından çağırıyor — ikisi de aynı adım mantığını
   * kullanıyor, yani sahadaki fizik iki yerde de birebir aynı.
   *
   * @param {number} gercekSure Son çağrıdan bu yana geçen süre (sn)
   */
  ilerlet(gercekSure) {
    const elapsed = Math.min(gercekSure, PHYSICS.maxCatchUp);

    /*
     * Eşik tam adım değil, adım eksi tolerans — gerekçe ve ölçüm
     * PHYSICS.stepSlack'in yanında. Erken atılan adımın açığı
     * `accumulator`da eksi olarak kalır ve sonraki karelerde kapanır,
     * yani zaman kaybolmaz. Artık daima [-stepSlack, step) aralığında
     * olduğu için döngü sonsuza gitmez.
     */
    this.accumulator += elapsed;
    while (this.accumulator >= PHYSICS.step - PHYSICS.stepSlack) {
      this.accumulator -= PHYSICS.step;
      /*
       * Misafir simüle etmez. Fizik ev sahibinde (ya da sunucuda)
       * koşuyor; burada çalıştırmak iki farklı maç üretirdi ve gelen
       * her paket topu geri zıplatırdı. Yalnızca süslemeler (parçacık,
       * iz, uğultu) yerel akar — onlar sonucu değiştirmiyor.
       */
      if (this.agRol === 'misafir') this.misafirGuncelle(PHYSICS.step);
      else this.update(PHYSICS.step);
    }
  }

  /**
   * Misafir tarafın kare işi — simülasyon yok, yalnız süslemeler.
   *
   * Zaman ilerlemeli: parçacıkların ömrü, topun izi ve salon uğultusu
   * `dt` ile sönüyor. `this.time` ayrıca çizimdeki salınımları (isim
   * levhasının zıplaması gibi) sürüyor.
   */
  misafirGuncelle(dt) {
    this.basisKenariHesapla();
    this.time += dt;
    this.agAradegerle(dt);
    /*
     * Ara değerlemeden SONRA: tahmin edilen oyuncu hedef listesinde
     * yok, kendi adımını burada atıyor. Sıranın tersi olsaydı ara
     * değerleme bir sonraki karede onu geri çekerdi.
     */
    this.agTahminAdimla(dt);
    this.updateParticles(dt);
    this.updateRings(dt);
    this.updateBallTrail();
    this.updateAtmosphere();
  }

  /**
   * Gelen paketteki konumları ara değerleme hedefi yapar.
   *
   * Başlangıç noktası "paketteki bir önceki konum" değil, EKRANDA O AN
   * DURAN konum. Aradaki fark önemli: paket gecikirse ara değerleme
   * hedefe varıp durur, sonraki paket geldiğinde oradan devam eder —
   * geriye sıçrama olmaz.
   *
   * @param {number[]} top   [x, y, rotation]
   * @param {Array[]} oyuncular Her oyuncu için paket dizisi
   * @param {number|null} [disarida] Ara değerlemeye KATILMAYACAK oyuncunun
   *   sırası — tahmin edilen kendi oyuncumuz. Onu da yumuşatsaydık
   *   tahmin her pakette geri çekilir, tuş yine geç cevap verirdi.
   */
  agKonumHedefle(top, oyuncular, disarida = null) {
    const simdi = this.time;
    /*
     * Süre ölçülüyor, sabit 1/20 varsayılmıyor: ağ gecikmesi oynuyor ve
     * sabit varsayımda paket geç kalınca ara değerleme hedefe erken
     * varıp donuyordu. Alt sınır bir kare (aynı karede iki paket gelirse
     * sıfıra bölme olmasın), üst sınır 0.25 sn (bağlantı kopukluğunda
     * saatlerce sürecek bir ara değerlemeye düşmeyelim).
     */
    const olculen = this.agAra ? simdi - this.agAra.baslangic : 1 / AG.durumHz;
    const sure = Math.max(PHYSICS.step, Math.min(0.25, olculen));

    this.agAra = {
      baslangic: simdi,
      t: 0,
      sure,
      // Nereden: şu an çizilen konum
      oncekiTop: [this.ball.x, this.ball.y, this.ball.rotation],
      oncekiOyuncu: this.players.map((p) => [p.x, p.y, p.vy, p.runFrame, p.squash]),
      // Nereye: pakettekiler
      hedefTop: top,
      hedefOyuncu: oyuncular.map((d, i) => (i === disarida ? null : d)),
    };

    // İlk pakette geçiş yapacak bir "önceki" yok — anında yerleş
    if (this.agSonAdim <= 0) this.agAradegerle(sure);
  }

  /** Ara değerlemeyi bir kare ilerletir. */
  agAradegerle(dt) {
    const ara = this.agAra;
    if (!ara) return;

    ara.t = Math.min(ara.sure, ara.t + dt);
    const a = ara.sure > 0 ? ara.t / ara.sure : 1;
    const karis = (once, hedef) => once + (hedef - once) * a;

    this.ball.x = karis(ara.oncekiTop[0], ara.hedefTop[0]);
    this.ball.y = karis(ara.oncekiTop[1], ara.hedefTop[1]);
    this.ball.rotation = karis(ara.oncekiTop[2], ara.hedefTop[2]);

    ara.hedefOyuncu.forEach((hedef, i) => {
      const oyuncu = this.players[i];
      const once = ara.oncekiOyuncu[i];
      if (!oyuncu || !once || !hedef) return;
      oyuncu.x = karis(once[0], hedef[0]);
      oyuncu.y = karis(once[1], hedef[1]);
      oyuncu.vy = karis(once[2], hedef[2]);
      oyuncu.runFrame = karis(once[3], hedef[5]);
      oyuncu.squash = karis(once[4], hedef[6]);
    });
  }

  /**
   * Bu adımda yeni vuruş basışı geldi mi (kare arasına sıkışsa bile).
   *
   * Ayrı yöntem çünkü misafir `update`i hiç çağırmıyor ama tahmin
   * yaparken bu kenara ihtiyacı var: hızlı bir tık iki kare arasına
   * sıkıştığında tuş durumu hiç "basılı" görünmüyor, yalnız sayaç
   * artıyor. Kenar hesaplanmadan tahmin o vuruşu kaçırır, sunucu ise
   * yapardı — oyuncu kendi ekranında vurmadığını, skorda vurduğunu
   * görürdü.
   */
  basisKenariHesapla() {
    ['p1', 'p2'].forEach((slot) => {
      this.actionEdge[slot] = this.actionPresses[slot] !== this.lastActionPresses[slot];
      this.lastActionPresses[slot] = this.actionPresses[slot];
    });
  }

  update(dt) {
    this.adim += 1;

    /*
     * Bu adıma kadar ALINAN girdiler artık İŞLENMİŞ sayılıyor: adım
     * onları kullanacak. Onay damgası burada ilerliyor, paket geldiği
     * anda değil — istemcinin tahmin penceresi yarım adım kaymasın
     * diye. `update` içinde durmasının bir sebebi daha var: aşamadan
     * bağımsız, yani servis sırasında da (oyuncu hareket etmese bile)
     * onay tazeleniyor ve pencere büyümüyor.
     */
    if (this.agRol === 'ev') {
      this.agOnayIslenen.p1 = this.agOnay.p1;
      this.agOnayIslenen.p2 = this.agOnay.p2;
    }

    this.basisKenariHesapla();

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
    this.players.forEach((player) => {
      if (player.controlled) {
        // İnsan girdisi doğrudan aktarılır — her oyuncu kendi yuvasından
        const slot = player.controlSlot ?? 'p1';
        const pad = this.inputs[slot] ?? this.inputs.p1;
        /*
         * Kare arasına sıkışan basış da bir kare boyunca "basılı"
         * sayılır: yoksa hızlı tıklayan oyuncunun vuruşu hiç
         * gerçekleşmiyor, tuş çalışmamış gibi hissediliyordu.
         */
        this.insanOyuncuAdimla(
          player,
          { ...pad, action: pad.action || this.actionEdge[slot] },
          active,
          dt,
        );
        return;
      }

      if (active) {
        const isAway = player.side === 'away';
        const chaserId = isAway ? awayChaser : homeChaser;
        updateAI(
          player,
          ball,
          {
            difficulty: isAway ? this.opponentDifficulty : this.difficulty,
            chasing: player.id === chaserId,
            homeX: player.homeX,
            foes: this.players.filter((p) => p.side !== player.side),
            /*
             * Görevli takım arkadaşı — bu oyuncu ona yol verecek.
             * Özellikle 2v2'de önemli: yapay zekâ partner insandan hızlı
             * karar verdiği için topu kapıyordu.
             */
            yieldTo:
              chaserId && chaserId !== player.id
                ? this.players.find((p) => p.id === chaserId) ?? null
                : null,
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

      this.oyuncuAdimla(player, dt);
    });
  }

  /**
   * Bir oyuncunun tek adımı — girdisi ZATEN yazılmışken.
   *
   * Vuruş tuşunun yükselen kenarı bir SALINIM başlatır.
   *
   * `swingTimer <= 0` koşulu kasıtlı: salınım sürerken yeniden basmak
   * onu uzatmaz. Uzatsaydı tuşa hızlı hızlı basarak vuruşu sürekli açık
   * tutmak mümkün olurdu — düzeltmeye çalıştığımız "basılı tut, hep
   * vuruşta kal" davranışının aynısı.
   *
   * Basılı tutmak da yeni salınım başlatmaz: kenar bir kez olur, süre
   * dolunca vuruş kapanır ve tuşu bırakıp yeniden basmak gerekir.
   */
  oyuncuAdimla(player, dt) {
    const down = player.input.action;
    if (down && !player.actionWasDown && player.swingTimer <= 0) {
      player.swingTimer = PLAYER.swingDuration;
      player.actionPressedAt = this.time;
    }
    player.actionWasDown = down;

    this.movePlayer(player, dt);
  }

  /**
   * İnsan oyuncunun tek adımı: tuşları yaz, sonra adımla.
   *
   * Ayrı bir yöntem olmasının sebebi TAHMİN. İstemci kendi oyuncusunu
   * sunucudan önce hareket ettiriyor (bkz. agTahminAdimla) ve o kodun
   * sunucudakiyle BİREBİR aynı olması gerekiyor — kopyalasaydık iki
   * kopya zamanla ayrışır, oyuncu kendi ekranında bir yerde, sunucuda
   * başka bir yerde olurdu. Bu projede `reach.js`'te tam olarak bu
   * yaşanmıştı: aynı hesabın iki kopyası %79'a kadar ayrışmıştı.
   *
   * @param {object} tuslar Bu adımda basılı sayılan tuşlar
   * @param {boolean} active Aşama oyuncu girdisini kabul ediyor mu
   */
  insanOyuncuAdimla(player, tuslar, active, dt) {
    player.input.left = active && Boolean(tuslar.left);
    player.input.right = active && Boolean(tuslar.right);
    player.input.up = active && Boolean(tuslar.up);
    player.input.action = active && Boolean(tuslar.action);
    player.input.dive = active && Boolean(tuslar.dive);
    player.aiSpeedScale = 1;

    this.oyuncuAdimla(player, dt);
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
    this.ses.dive();
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

    /*
     * Salınımı ilerlet. Süre dolunca tam vuruş penceresinin başlangıcı
     * da temizlenir — yoksa bir sonraki temas, çoktan bitmiş bir
     * salınımın zamanlamasına göre değerlendirilirdi.
     */
    if (player.swingTimer > 0) {
      player.swingTimer = Math.max(0, player.swingTimer - dt);
      if (player.swingTimer === 0) player.actionPressedAt = null;
    }
    const vuruyor = player.swingTimer > 0;

    // Poz seçimi — tuşun basılı olmasına değil, salınıma bağlı
    if (!player.onGround) {
      player.pose = vuruyor ? 'spike' : 'jump';
    } else if (vuruyor) {
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

    if (frozen) {
      // Sayı anında top yerinde döner, sahne donar
      ball.rotation += dt * 2;
      return;
    }

    /*
     * Serbest uçuş fiziği `ballstep.js`'te — servis göstergesi de aynı
     * fonksiyonu çağırıyor. Ayrı ayrı yazıldıklarında ayrışmışlardı:
     * bardaki yeşil bölge ile gerçek sonuç yalnızca %79 uyuşuyordu.
     */
    const event = stepBall(ball, dt);
    ball.rotation += ball.vx * dt * 0.03;

    if (event.net) this.ses.net();

    /*
     * Dokunulmamış servis dip çizgiyi aştı mı?
     *
     * Sahada ralli için aut yok — yan duvarlar topu geri sektiriyor, o
     * yüzden "uzun" bir vuruşun bedeli olmuyor. Bu kural yalnızca
     * kimsenin dokunmadığı servise işler ve servis barının üst ucuna
     * gerçek bir risk veriyor: sertçe vurup derine nişan alırsan top
     * dışarı çıkar. Duvardan geri sekip içeri düşmesin diye çizgiyi
     * geçtiği an mandallanır.
     */
    if (ball.serveUntouched && !ball.serveOut) {
      const outX =
        ball.lastHitSide === 'home'
          ? GAME_WIDTH * SERVE.outLine
          : GAME_WIDTH * (1 - SERVE.outLine);
      if (ball.lastHitSide === 'home' ? ball.x > outX : ball.x < outX) {
        ball.serveOut = true;
      }
    }

    // Zemin → sayı
    if (ball.y + ball.radius >= GROUND_Y) {
      ball.y = GROUND_Y - ball.radius;
      const landedSide = ball.x < NET.x ? 'home' : 'away';
      const receiver = ball.lastHitSide === 'home' ? 'away' : 'home';

      if (ball.serveUntouched && ball.serveOut) {
        this.awardPoint(receiver, landedSide, 'AUT!');
        return;
      }
      if (ball.serveUntouched && landedSide === ball.lastHitSide) {
        // Fileyi aşamadan kendi sahasına düştü
        this.awardPoint(receiver, landedSide, 'FİLEDE!');
        return;
      }

      this.awardPoint(landedSide === 'home' ? 'away' : 'home', landedSide);
    }
  }

  /** Top–oyuncu temasları. */
  resolveCollisions() {
    const ball = this.ball;

    // Temas alanı topun hızıyla daralır; formül `reach.js` içinde ve
    // yapay zekâ da AYNI fonksiyonu okur (ayrı yazıldıklarında sessizce
    // ayrışıp rakibi menzil sanısıyla boşa vurdurmuşlardı).
    const ballSpeed = Math.hypot(ball.vx, ball.vy);

    this.players.forEach((player) => {
      if (player.hitCooldown > 0) return;
      // Filenin arkasından uzanıp rakip sahadaki topa vurulamaz
      if (!mayTouch(player, ball)) return;

      const diving = player.diveTimer > 0 || player.recoverTimer > 0;

      // Dalışta gövde yere yakın ve uzanmış: temas merkezi alçalır,
      // erişim artar. Yere düşmek üzere olan topu bu yakalar.
      const cx = player.x;
      const cy = contactCenterY(player, { diving, airborne: !player.onGround });
      const reach = contactRadius({
        hitRadius: player.hitRadius,
        acting: player.swingTimer > 0,
        diving,
        airborne: !player.onGround,
        ballSpeed,
      });

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
    const acting = player.swingTimer > 0;
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

    /*
     * Mutlak hız tavanı — yalnızca güvenlik amaçlı. Hedefli vuruşlar
     * zaten computeAttackVelocity içinde sınırlanıyor; bu tavan
     * çarpanların üst üste binip topu ışınlamasına karşı duruyor.
     */
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

    /*
     * Birisi dokunduysa servis artık "dokunulmamış" değil: aut kuralı
     * düşer. Voleybolun gerçek kuralı da bu — karşılamaya kalkıp
     * dokunduysan top oyundadır, dışarı gidecek olsa bile.
     */
    ball.serveUntouched = false;

    player.hitCooldown = PHYSICS.hitCooldown;
    this.stats.rallyTouches += 1;
    this.stats.longestRally = Math.max(this.stats.longestRally, this.stats.rallyTouches);

    // Kombo ve istatistikler (yalnızca insan oyuncunun tarafı)
    if (player.side === 'home') {
      // Komboyu büyüten hamleler: tam vuruş, blok, dalış kurtarışı
      const scoringMove = perfect || isBlock || type === 'dive';

      if (type === 'dive') {
        this.stats.saves += 1;
        this.message = { text: 'KURTARIŞ!', timer: 0.8, color: '#9BE7FF' };
      } else if (isBlock) {
        this.stats.blocks += 1;
        this.message = { text: 'BLOK!', timer: 0.7, color: PALETTE.gold };
      }

      if (perfect) {
        this.stats.perfects += 1;
        this.perfectFlash = PERFECT.flash;
        this.spawnRing(ball.x, ball.y, PALETTE.gold, 62);
        this.ses.perfect();
      }

      if (scoringMove) this.bumpCombo();
    }

    // Ses ve parçacık
    if (type === 'dive') this.ses.save();
    else if (isBlock) this.ses.block();
    else if (type === 'tip') this.ses.tip();
    else if (type === 'spike') this.ses.spike();
    else if (type === 'hit') this.ses.hit();
    else this.ses.bump();

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
    if (isBlock) this.addHitStop(HITSTOP.block);
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
    this.ses.whistle();
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
      const slot = server.controlSlot ?? 'p1';
      if (this.actionEdge[slot]) {
        this.handleServePress();
      }
      serve.actionLatch = (this.inputs[slot] ?? this.inputs.p1).action;

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
          this.difficultyFor(server ?? {}).serveSkill ?? 0.5,
          this.servingSide === 'home' ? 1 : -1,
          server?.data?.stats?.serve ?? 70
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

      /*
       * Kilitlenen güç için sahada kalan nişan aralığı bir kez hesaplanır
       * ve barda yeşil bölge olarak çizilir.
       *
       * Bu olmadan barın cezası şansa dönerdi: oyuncu gücü kilitliyor ama
       * o gücün hangi nişanlarla sahada kaldığını göremiyor. Artık
       * görüyor — düşük güç derin nişan ister, yüksek güç kısa. Her karede
       * yeniden hesaplanmaz, aramanın maliyeti var.
       */
      const server =
        this.players.find((p) => p.id === serve.serverId) ?? this.getServer();
      serve.safeAim = safeAimRange({
        power: serve.power,
        toOpponent: this.servingSide === 'home' ? 1 : -1,
        serveStat: server?.data?.stats?.serve ?? 70,
      });

      this.ses.select();
      this.message = {
        text: serve.safeAim ? 'NİŞAN' : 'GÜÇ YETMEDİ!',
        timer: 0.8,
        color: serve.safeAim ? '#9BE7FF' : PALETTE.turkishRed,
      };
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
    this.ball.serveUntouched = true;
    this.ball.serveOut = false;

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
    this.ses.hit();

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
      this.ses.combo(this.combo);
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
    this.ses.ground();

    // Sayı serisi
    if (this.streak.side === side) {
      this.streak.count += 1;
    } else {
      this.streak = { side, count: 1 };
    }

    if (side === 'home') {
      this.message = {
        text:
          reason ??
          (this.streak.count > 2 ? `${this.streak.count} SAYI ÜST ÜSTE!` : 'SAYI!'),
        timer: this.rules.servePause,
        color: reason ? PALETTE.gold : PALETTE.turkishRed,
      };
      if (this.streak.count >= 3) this.ses.streak(this.streak.count);
      else this.ses.point();
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
      this.ses.pointLost();
    } else {
      this.message = {
        text: reason ?? `SAYI ${ilgiEki(this.opponent.shortName)}`,
        timer: this.rules.servePause,
        color: reason ? PALETTE.gold : this.opponent.colors.accent,
      };
      this.ses.pointLost();
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
            : `${this.setNumber}. SET ${ilgiEki(this.opponent.shortName)}`,
        timer: 2.6,
        color: winner === 'home' ? PALETTE.gold : this.opponent.colors.accent,
      };

      if (winner === 'home') this.ses.setWon();
      else this.ses.setLost();
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
      if (winner === 'home') this.ses.victory();
      else this.ses.defeat();

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
      playMode: this.playMode,
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
    this.ses.setWon();
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
    this.ses.defeat();

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

  /**
   * Efekt olayını misafire iletilmek üzere kaydeder.
   *
   * Parçacıklar anlık görüntüye konmuyor: bir sayı sonrası sahada
   * onlarca parçacık oluyor ve her biri altı alan — paket on katına
   * çıkardı. Doğuş olayı ise nadir ve küçük; misafir kendi
   * parçacıklarını aynı çağrıyla üretip yerel olarak söndürüyor.
   */
  agOlay(...olay) {
    if (this.agRol !== 'ev') return;
    // Tek pakete sığmayacak kadar birikirse en yenileri kalsın
    if (this.agOlaylar.length < 40) this.agOlaylar.push(olay);
  }

  spawnBurst(x, y, count, color) {
    this.agOlay('burst', Math.round(x), Math.round(y), count, color);
    fxSpawnBurst(this.particles, x, y, count, color);
  }

  spawnFlame(x, y) {
    this.agOlay('flame', Math.round(x), Math.round(y));
    fxSpawnFlame(this.particles, x, y);
  }

  spawnDust(x, y, count = 7) {
    this.agOlay('dust', Math.round(x), Math.round(y), count);
    fxSpawnDust(this.particles, x, y, count);
  }

  /** Vuruş anında genişleyen darbe halkası. */
  spawnRing(x, y, color, maxRadius = 46) {
    this.agOlay('ring', Math.round(x), Math.round(y), color, maxRadius);
    fxSpawnRing(this.rings, x, y, color, maxRadius);
  }

  /** Misafirde gelen efekt olayını uygular. */
  agOlayUygula(olay) {
    const [tur, x, y, a, b] = olay;
    if (tur === 'burst') fxSpawnBurst(this.particles, x, y, a, b);
    else if (tur === 'flame') fxSpawnFlame(this.particles, x, y);
    else if (tur === 'dust') fxSpawnDust(this.particles, x, y, a);
    else if (tur === 'ring') fxSpawnRing(this.rings, x, y, a, b);
    else if (tur === 'ses') {
      const ad = MISAFIR_SES[x] ?? x;
      Sfx[ad]?.(...(y ?? []));
    }
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

    if (!this.bassiz) Sfx.setAtmosphere(level);
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
    const signature = [
      this.score.home,
      this.score.away,
      this.sets.home,
      this.sets.away,
      this.setNumber,
      this.phase,
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
      running: this.running,
      streak: { ...this.streak },
      pointsPerSet: this.rules.pointsPerSet,
      formatId: this.format.id,
      combo: this.combo,
      comboTier: currentComboTier(this.combo),
      campaign: this.campaign,
      playMode: this.playMode,
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

    /*
     * Arka plan her karede sıfırdan çizilmez, önbelleğe alınıp
     * kopyalanır. Ölçümde saha canvas'ında kare başına 2485 `fillRect`
     * sayıldı (saniyede ~150 bin): kalabalık, zemin dokusu ve panolar
     * 60fps'te yeniden çiziliyordu. Tribün arka plandır; 14fps'te
     * kıpırdaması fark edilmiyor ama maliyeti dörtte bire iniyor.
     */
    this.paintBackground();
    ctx.drawImage(this.bgCanvas, 0, 0);

    // Gölgeler önce
    this.players.forEach((p) => {
      const isDiving = p.diveTimer > 0 || p.recoverTimer > 0;
      if (isDiving) {
        // Yatan gövde geniş ve yakın bir gölge bırakır
        this.drawShadow(p.x - p.facing * 8 + (this.agCizimKaydirma(p)?.x ?? 0), GROUND_Y, 44);
        return;
      }
      // Havadayken gölge küçülür — yükseklik hissi verir
      const lift = clamp((GROUND_Y - p.y) / 170, 0, 1);
      // Gölge de kaydırmayı almalı — yoksa figür gölgesinden ayrılıyor
      this.drawShadow(p.x + (this.agCizimKaydirma(p)?.x ?? 0), GROUND_Y, 30 * (1 - lift * 0.45));
    });
    this.drawShadow(this.ball.x, GROUND_Y, 16 * this.ballShadowScale());

    this.players.forEach((player) => this.drawPlayer(player));

    drawNet(ctx, GROUND_Y);
    this.drawBallTrail();
    drawBall(ctx, this.ball);
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
  /**
   * Arka planı (salon + zemin) önbellek yüzeyine çizer.
   *
   * Yalnızca yeterince zaman geçtiyse ya da duvar skorbordlarını
   * etkileyen bir değer değiştiyse yeniden çizilir — skor gecikmeli
   * görünmesin diye imza da kontrol ediliyor.
   */
  paintBackground() {
    const imza = `${this.score.home}-${this.score.away}-${this.touch.side}-${this.touch.count}`;
    const eskidi = this.time - this.bgTime >= BG_REFRESH;

    if (!eskidi && imza === this.bgKey) return;

    this.bgTime = this.time;
    this.bgKey = imza;
    drawArena(this.bgCtx, this.time, this.hype, this.score, this.touch);
    drawFloor(this.bgCtx);
  }

  drawServeMeter() {
    if (this.phase !== PHASE.SERVE || !this.serve) return;

    const { ctx, serve } = this;
    const server =
      this.players.find((p) => p.id === serve.serverId) ?? this.getServer();
    if (!server) return;

    const barW = 14;
    const barH = 70;
    const x = server.x + (server.side === 'home' ? 28 : -28 - barW);
    /*
     * Barın tepesi isim levhasının ALTINDA başlamalı.
     *
     * Önce -110 idi (tepe y=310) ve üç şey birden çakışıyordu: isim
     * levhası y≈311'de barın soluna biniyordu ("GİZEM ÖRGE"nin sonu
     * barın altında kalıyordu), "GÜÇ" yazısı y=300'de yan skorbordun
     * (243-306) içine giriyordu. -100 ile bar 320'de başlıyor, isim
     * 307-315 bandında serbest kalıyor.
     */
    const y = server.y - 100;
    const aiming = serve.stage === 'aim';

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(x - 2, y - 2, barW + 4, barH + 4);
    ctx.strokeStyle = aiming ? '#9BE7FF' : PALETTE.gold;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 2, y - 2, barW + 4, barH + 4);

    /*
     * Nişan aşamasında sahada kalan aralık yeşil zemin olarak çizilir.
     *
     * Barın artık gerçek bir cezası var (fileye takılma / aut); nereye
     * basmanın güvenli olduğu görünmeseydi bu ceza şans olurdu. Yeşil
     * bant gücün sonucunu okunur kılıyor: sert vurduysan bant kısalır ve
     * aşağı iner, yumuşak vurduysan yukarı çıkar.
     */
    if (aiming && serve.safeAim) {
      const sMin = y + barH - serve.safeAim.max * barH;
      const sMax = y + barH - serve.safeAim.min * barH;
      ctx.fillStyle = 'rgba(90, 220, 120, 0.45)';
      ctx.fillRect(x, sMin, barW, Math.max(2, sMax - sMin));
    }

    const fillH = Math.max(2, serve.meter * barH);
    const inSafe =
      aiming &&
      serve.safeAim &&
      serve.meter >= serve.safeAim.min &&
      serve.meter <= serve.safeAim.max;
    ctx.fillStyle = aiming
      ? (inSafe ? '#5ADC78' : '#9BE7FF')
      : PALETTE.turkishRed;
    ctx.fillRect(x, y + barH - fillH, barW, fillH);

    // Güç aşamasında en verimli noktayı göster
    if (!aiming) {
      const sweetY = y + barH - SERVE.sweetSpot * barH;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x - 3, sweetY - 1, barW + 6, 2);
    }

    /*
     * Etiket barın ALTINDA ve BARIN üstünde ortalı — oyuncunun üstünde
     * değil. Oyuncuya ortalandığında isim levhasıyla aynı sütunda
     * kalıyor, barın üstüne konduğunda skorborda giriyordu.
     */
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(aiming ? 'NİŞAN' : 'GÜÇ', x + barW / 2, y + barH + 11);
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
    const { ctx } = this;

    /*
     * Uzlaştırma düzeltmesi ekrana YEDİRİLİYOR. Simülasyondaki konum
     * çoktan düzeltildi; burada kalan fark kadar geri kaydırılıp her
     * karede eritiliyor, böylece düzeltme ışınlanma değil kayma
     * oluyor. Bkz. agSapma / agSapmaAl.
     */
    const kaydir = this.agCizimKaydirma(player);
    if (kaydir) {
      ctx.save();
      ctx.translate(kaydir.x, kaydir.y);
    }

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
    });

    ctx.restore();

    /*
     * Kontrol edilen oyuncunun göstergesi.
     *
     * Servis atan oyuncuda GİZLENİR. Sebebi geometrik: servis noktası
     * x=108 (ve 792), duvar skorbordu ise 64-160 arası — oyuncu tam
     * onun altında duruyor. Üstüne elde bekleyen top y=311-337 bandında,
     * yani isim levhasının (307-315) tam üstünde. Ölçümde "GİZEM ÖRGE"
     * ortasından top geçiyordu, okunmuyordu.
     *
     * Servis anında levhanın işi zaten yok: topu tutan oyuncu kimse onu
     * kullanıyorsun. 2v2'de sıradaki oyuncu servis atmıyorsa levhası
     * duruyor.
     */
    const servingNow =
      this.phase === PHASE.SERVE && this.serve?.serverId === player.id;

    /*
     * Çevrimiçide iki oyuncu da insan: gösterge ikisinin üstünde
     * birden çıkarsa oyuncu hangisi olduğunu bilemez. Yuva biliniyorsa
     * yalnız kendi oyuncusuna çiziliyor.
     */
    const benim = this.agYuvam ? player.controlSlot === this.agYuvam : player.controlled;

    /*
     * Çevrimiçide karşıdaki oyuncunun TAKMA ADI da yazılıyor.
     *
     * Hızlı eşleşmede rakip bir yabancı: "RAKİP" yazan bir sprite'a
     * karşı oynamak kişisiz kalıyordu. Ok işareti yalnız kendi
     * oyuncunda kalıyor (o "sen buradasın" demek), rakibin adı ise
     * daha sönük yazılıyor — ikisi karışmasın.
     */
    const rakipAdi =
      !benim && this.agRakipAd && player.controlSlot && player.controlSlot !== this.agYuvam
        ? this.agRakipAd
        : null;

    if ((benim || rakipAdi) && !servingNow) {
      const top = player.y - 22 * PLAYER.spriteScale;
      const bounce = benim ? Math.sin(this.time * 6) * 3 : 0;

      if (benim) {
        ctx.fillStyle = PALETTE.gold;
        ctx.beginPath();
        ctx.moveTo(player.x, top - 12 + bounce);
        ctx.lineTo(player.x - 7, top - 24 + bounce);
        ctx.lineTo(player.x + 7, top - 24 + bounce);
        ctx.closePath();
        ctx.fill();
      }

      ctx.fillStyle = benim ? '#FFFFFF' : 'rgba(255,255,255,0.6)';
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        upper(rakipAdi ?? player.data.name),
        player.x,
        top - (benim ? 34 : 24) + bounce,
      );
    }

    if (kaydir) ctx.restore();
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
