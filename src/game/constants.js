/**
 * Oyun geneli sabitler.
 *
 * Tüm ölçüler "tasarım pikseli" cinsindendir. Canvas her zaman
 * GAME_WIDTH × GAME_HEIGHT çözünürlüğünde çizilir, CSS ile ölçeklenir.
 */

export const GAME_WIDTH = 900;
export const GAME_HEIGHT = 500;

/** Sahanın zemin çizgisi (topun ve oyuncuların değdiği y). */
export const GROUND_Y = 420;

/** Saha kenar boşluğu (duvarlar). */
export const WALL_PAD = 30;

/** File ölçüleri. */
export const NET = {
  x: GAME_WIDTH / 2,
  width: 12,
  height: 150,
  get topY() {
    return GROUND_Y - this.height;
  },
};

/** Fizik sabitleri — hepsi saniye tabanlı (px/s, px/s²). */
export const PHYSICS = {
  ballGravity: 1150,
  playerGravity: 2300,
  jumpVelocity: -770,
  playerSpeed: 340,
  airControl: 0.75, // havadayken yatay kontrol çarpanı
  ballRadius: 13,
  /** Hedefli vuruşların hedefleyebileceği azami hız. */
  ballMaxSpeed: 1000,
  /** Mutlak tavan — Sultan Gücü çarpanı dahil hiçbir top bunu aşamaz. */
  ballSpeedCeiling: 1700,
  ballAirDrag: 0.999,
  wallRestitution: 0.9,
  netRestitution: 0.65,
  bumpPower: 500, // normal temas
  hitPower: 640, // vuruş tuşuyla temas
  spikePower: 810, // havada + vuruş tuşu
  hitCooldown: 0.14, // saniye — aynı oyuncunun ard arda vurmasını engeller
  /** Bu hızın üstündeki toplarda temas alanı daralmaya başlar. */
  cleanTouchSpeed: 520,
  /**
   * Bu hızın üstünde gelen top ilk temasta smaçlanamaz, manşetle
   * karşılanır. Dig → pas → smaç ritmini kuran eşik budur.
   */
  attackControlSpeed: 620,
  maxDelta: 1 / 30,
};

/**
 * Salon katmanları — arka planın derinlik düzeni (piksel, yukarıdan aşağı).
 *
 * Kalabalık üstte yoğun, oyun hacminin arkası (panoların altı) kasıtlı
 * olarak sade ve koyu tutulur: top oradan geçiyor ve okunur kalmalı.
 */
export const ARENA = {
  roofH: 22,
  upperTierY: 24,
  upperTierH: 68,
  ribbonY: 96,
  ribbonH: 18,
  lowerTierY: 118,
  lowerTierH: 66,
  boardsY: 188,
  boardsH: 24,
  /**
   * Panoların altı oyun hacmidir. Zıplayan oyuncunun kafası ~y228'e
   * kadar çıkıyor; panolar bundan yukarıda kalmalı, yoksa oyuncular
   * tribünün içinde duruyormuş gibi görünüyor.
   */
  backWallY: 212,
};

/**
 * Zeminin sahte perspektifi: yakın kenar bu oranda genişler, saha
 * çizgileri kaçış noktasına doğru yakınsar.
 */
export const FLOOR = {
  spread: 1.7,
  nearY: GAME_HEIGHT - 10,
};

/** Oyuncu gövde ölçüleri (çarpışma dairesi). */
export const PLAYER = {
  hitRadius: 40, // gövde + kollar
  hitOffsetY: 44, // ayaklardan gövde merkezine
  reachBonus: 12, // vuruş tuşu basılıyken erişim artışı
  minReachFactor: 0.55, // hızlı toplarda temas alanının inebileceği alt sınır
  spriteScale: 3.4,
};

/**
 * Dalış kurtarışı (plonjon).
 *
 * Yere düşmek üzere olan topa son anda uzanmak için: oyuncu yatay
 * olarak fırlar, yerde kayar ve bu sırada temas dairesi alçalıp
 * genişler. Bedeli, kaymadan sonraki kalkma süresidir — o sırada
 * hareket edilemez, yani ıskalayan dalış pahalıdır.
 */
export const DIVE = {
  speed: 660, // fırlama hızı (px/s)
  duration: 0.42, // kayma süresi (sn)
  recovery: 0.24, // yerden kalkma — hareket kilitli
  cooldown: 0.85, // ard arda dalışı engeller
  friction: 950, // kaymadaki yavaşlama (px/s²)
  hitOffsetY: 17, // dalışta temas merkezinin yerden yüksekliği
  reachBonus: 18, // dalışta erişim artışı
  liftBoost: 1.3, // kurtarılan topun kaldırma gücü çarpanı
  /**
   * Kurtarılan top bu hızla yükselir ve yatayda en fazla `maxDrift`
   * kadar kayar. Yüksek ve yakın kalkmazsa dalan oyuncu kalkıp topa
   * yetişemiyor; kurtarış sayıyı kurtarmıyor, yalnızca erteliyordu.
   */
  saveLift: 520,
  maxDrift: 150,
  chargeBonus: 10, // başarılı kurtarışta Sultan barı dolumu
};

/** Maç kuralları. */
export const RULES = {
  /**
   * Bir tarafın topu karşıya göndermeden yapabileceği azami temas.
   * Gerçek voleybol kuralı olmasının yanında oyun açısından da şart:
   * sınır olmayınca oyuncular topu sonsuza kadar havada tutabiliyor.
   */
  maxTouches: 3,
  pointsPerSet: 15,
  winBy: 2,
  pointCap: 21, // sonsuz uzamayı engeller
  setsToWin: 2,
  servePause: 1.1, // sayı sonrası bekleme (sn)
  readyPause: 1.6, // set başı geri sayım (sn)
};

/** Sultan Gücü barı. */
export const SULTAN = {
  max: 100,
  onPoint: 18,
  onBlock: 14,
  onRally: 6, // fileyi geçen her başarılı vuruş
  streakBonus: 10, // üst üste sayıda ek dolum
  speedMultiplier: 1.55,
  aiPenalty: 0.45, // aktifken rakip AI tepkisi bu oranda yavaşlar
  duration: 1.8, // alevli topun etkisi (sn)
};

/** Renk paleti — tailwind.config.js ile aynı tutulmalı. */
export const PALETTE = {
  night: '#0b0b12',
  hallWall: '#141428',
  hallWallDark: '#0e0e1d',
  standRow: '#1d1d38',
  courtIn: '#8E1018',
  courtOut: '#5C070D',
  courtLine: '#FFFFFF',
  net: '#F2F2F2',
  netPost: '#C9CBD6',
  ballWhite: '#FFFFFF',
  ballRed: '#E30A17',
  ballBlue: '#1B4FE0',
  flame: ['#FFF3A0', '#FFC633', '#FF7A18', '#E30A17'],
  outline: '#15121A',
  shadow: 'rgba(0, 0, 0, 0.38)',
  turkishRed: '#E30A17',
  gold: '#FFD24A',
  // Salon katmanları
  roof: '#0a0a14',
  truss: '#242440',
  tierBack: '#12122a',
  tierStep: '#1b1b38',
  ribbonDark: '#0d0d1c',
  ribbonOn: '#FFD24A',
  adBoard: '#101024',
  backWall: '#0e0e1c',
  backWallPanel: '#14142c',
  lightWarm: 'rgba(255, 244, 205,',
  floorSheen: 'rgba(255, 255, 255, 0.05)',
  awayPrimary: '#2B3A8F',
  awaySecondary: '#E8ECFF',
  awaySkin: '#D9A57C',
  awayHair: '#22303F',
};

/**
 * Zorluk kademeleri — karakter seçim ekranından ayarlanır.
 *
 * `error`, yapay zekânın tahmini düşüş noktasına eklediği sapmadır ve
 * asıl zorluk kolu budur: temas dairesinin yarıçapı ~53px olduğu için
 * bu değerin altındaki sapmalar ıskaya dönüşmez, rakip hiç sayı vermez.
 */
export const DIFFICULTY = {
  // placement: vuruşu rakibin boş bıraktığı alana yerleştirme becerisi
  //            (0 = tamamen rastgele, 1 = her zaman en uzak boşluğa)
  // diveSkill: yetişemeyeceği topa dalma olasılığı
  kolay: { label: 'KOLAY', speed: 0.68, reaction: 0.4, error: 130, power: 0.85, placement: 0.12, diveSkill: 0.12 },
  normal: { label: 'NORMAL', speed: 0.82, reaction: 0.29, error: 98, power: 0.97, placement: 0.4, diveSkill: 0.48 },
  zor: { label: 'ZOR', speed: 0.94, reaction: 0.2, error: 82, power: 1.06, placement: 0.62, diveSkill: 0.6 },
};

/**
 * Hücum vuruşlarının hedefleyebileceği aralık.
 *
 * Hem motor (vuruş çözümü) hem de yapay zekâ (nişan seçimi) aynı
 * eşlemeyi kullanmalı, yoksa AI'ın nişanladığı yer ile topun gittiği
 * yer birbirini tutmaz.
 *
 * @param {1|-1} toOpponent Rakip sahanın yönü
 * @returns {{near: number, far: number}}
 */
export function attackRange(toOpponent) {
  return {
    near: NET.x + toOpponent * 70,
    far: toOpponent > 0 ? GAME_WIDTH - WALL_PAD - 35 : WALL_PAD + 35,
  };
}

/** Saha x koordinatını 0–1 aralığındaki nişan oranına çevirir. */
export function xToSpread(x, toOpponent) {
  const { near, far } = attackRange(toOpponent);
  return (x - near) / (far - near);
}

/** Oyun akış aşamaları. */
export const PHASE = {
  READY: 'ready', // set başı geri sayım
  RALLY: 'rally', // top oyunda
  POINT: 'point', // sayı oldu, kısa donma
  SET_END: 'setEnd',
  MATCH_END: 'matchEnd',
};
