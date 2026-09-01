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
  /** Mutlak tavan — çarpanlar üst üste binse de hiçbir top bunu aşamaz. */
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

/**
 * Maç formatları — set sayısı / set uzunluğu.
 * `rules` alanları RULES üzerine yazılır.
 */
export const FORMATS = {
  classic: {
    id: 'classic',
    label: 'KLASİK',
    description: '15 sayı · 3 sette 2 — turnuva temposu.',
    rules: {},
  },
  single: {
    id: 'single',
    label: 'TEK SET',
    description: 'Tek set 15 sayı (2 fark). Hızlı düello.',
    rules: { setsToWin: 1 },
  },
  practice: {
    id: 'practice',
    label: 'ANTRENMAN',
    description: 'Tek set 7 sayı. Kısa tempo, deneme için.',
    rules: { setsToWin: 1, pointsPerSet: 7, winBy: 1, pointCap: 7 },
  },
};

/**
 * Tam Vuruş — zamanlama ödülü.
 *
 * Vuruş tuşunu basılı tutmak her zaman en iyi strateji olduğu için
 * oyunda ustalaşılacak bir zamanlama yoktu: tuşu bas, bırakma, her topa
 * vur. Artık temas, tuşa **basıldığı andan** itibaren `window` saniye
 * içinde gerçekleşirse "tam vuruş" sayılır. Tuşu basılı tutan oyuncu
 * bunu asla yakalayamaz — düzeltilen asıl şey bu.
 */
export const PERFECT = {
  /** Basıştan sonra tam vuruş sayılan süre (sn). */
  window: 0.17,
  /** Tam vuruşun güç çarpanı. */
  power: 1.14,
  /** Tam vuruşta Sultan barına eklenen fazladan dolum. */
  /** Ekranda kalan "TAM VURUŞ" yazısının süresi (sn). */
  flash: 0.55,
};

/**
 * Kombo — üst üste iyi oynanan hamleler.
 *
 * Tam vuruş, blok ve dalış kurtarışı komboyu büyütür; sayı kaybedince
 * sıfırlanır. Ralli boyunca değil sayı boyunca yaşar, yani momentum
 * ödülüdür.
 */
export const COMBO = {
  /** Kombo çarpanının Sultan dolumuna etkisi (kombo başına). */
  /**
   * Hücum gücüne kombo katkısı (kombo başına) ve tavanı.
   *
   * Sultan Gücü kaldırılınca kombonun tek karşılığı bu kaldı; eskiden
   * asıl ödül bar dolumuydu ve güç katkısı bilerek zayıf tutulmuştu
   * (0.012 / 1.16). Tavan yükseltildi ama ölçümle sınırlandı.
   */
  powerStep: 0.022,
  maxPowerMultiplier: 1.3,
  /** Kademeler: `at` komboya ulaşınca `label` duyurulur. */
  tiers: [
    { at: 3, label: 'SÜPER!', color: '#9BE7FF' },
    { at: 6, label: 'MÜKEMMEL!', color: '#FFD24A' },
    { at: 10, label: 'SULTAN SERİSİ!', color: '#FF7A18' },
    { at: 15, label: 'DURDURULAMAZ!', color: '#E30A17' },
  ],
};

/**
 * Plase (dink) — file üstünden yumuşak bırakış.
 *
 * Havada `dive` tuşuyla yapılır. Smaç tek hücum seçeneğiyken oyun
 * tahmin edilebilirdi: rakip hep dip çizgiyi savunuyordu. Plase, blok
 * zıpladığında bedava sayı; savunma geride durduğunda ise kolay lokma —
 * yani risk/ödül seçimi getiriyor.
 */
export const TIP = {
  /** Hedefin fileye uzaklık aralığı (px). */
  minDepth: 55,
  maxDepth: 165,
  /** Uçuş süresi — yavaş ve kavisli. */
  flight: 0.72,
};

/**
 * Vuruş donması (hit-stop).
 *
 * Sert temaslarda simülasyon birkaç kare durur. Fizik değişmez, yalnızca
 * darbenin ağırlığı hissedilir — arcade oyunlarının en ucuz "tokluk"
 * hilesi.
 */
export const HITSTOP = {
  spike: 0.055,
  block: 0.07,
  perfect: 0.045,
  sultan: 0.1,
  /** Üst sınır — birikip oyunu dondurmasın. */
  max: 0.12,
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
  // serveSkill: servis gücü ve nişan tutarlılığı
  kolay: { label: 'KOLAY', speed: 0.68, reaction: 0.4, error: 130, power: 0.85, placement: 0.12, diveSkill: 0.12, serveSkill: 0.25 },
  normal: { label: 'NORMAL', speed: 0.82, reaction: 0.29, error: 98, power: 0.97, placement: 0.4, diveSkill: 0.48, serveSkill: 0.55 },
  zor: { label: 'ZOR', speed: 0.94, reaction: 0.2, error: 82, power: 1.06, placement: 0.62, diveSkill: 0.6, serveSkill: 0.88 },
};

/**
 * Zorluk kademesini kademesiz olarak sertleştirir/yumuşatır.
 *
 * Turnuvada tur ilerledikçe, hayatta kalmada dalga yükseldikçe rakip
 * güçlenmeli; ama üç sabit kademe arasında zıplamak kaba duruyor.
 * Bunun yerine her kolu ayrı ayrı, kendi doğal yönünde kaydırıyoruz:
 * `error` ve `reaction` küçüldükçe, `speed`/`power`/`placement` büyüdükçe
 * rakip zorlaşır.
 *
 * Adım negatif olabilir: hayatta kalma seçilen kademenin altından
 * başlayıp yukarı tırmanır, yoksa ilk ralliden itibaren tam güçte bir
 * rakiple üç can harcanıyor ve mod on beş saniyede bitiyordu.
 *
 * @param {typeof DIFFICULTY.normal} base
 * @param {number} step 0 = değişiklik yok, +1 ≈ bir kademe sertleşme
 * @returns {typeof DIFFICULTY.normal}
 */
export function scaleDifficulty(base, step = 0) {
  if (!step) return { ...base };

  const t = clampRange(step, -2.5, 4);
  return {
    ...base,
    speed: clampRange(base.speed * (1 + 0.075 * t), 0.4, 1.12),
    reaction: clampRange(base.reaction * (1 - 0.18 * t), 0.13, 0.75),
    error: clampRange(base.error * (1 - 0.16 * t), 52, 230),
    power: clampRange(base.power * (1 + 0.04 * t), 0.6, 1.22),
    placement: clampRange(base.placement + 0.14 * t, 0.02, 0.92),
    diveSkill: clampRange(base.diveSkill + 0.12 * t, 0, 0.9),
  };
}

function clampRange(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Hayatta kalma modu.
 *
 * Set yok, maç yok: tek uzun ralli zinciri. Kaybedilen her sayı bir can
 * götürür, kazanılan her sayı puandır. `waveLength` puanda bir dalga
 * yükselir — rakip takım değişir ve bir tık sertleşir.
 */
export const SURVIVAL = {
  lives: 5,
  waveLength: 3,
  /**
   * 1. dalgada seçilen kademeden bu kadar yumuşak başlanır.
   *
   * Bu değerler headless örneklemeyle bulundu. Rampasız ilk hâlde
   * ("normal", 3 can, yumuşama yok) ortalama bir oyuncu 0–1 puanda
   * eleniyordu: rakip ilk ralliden itibaren tam güçte olduğu için üç
   * can ~15 saniyede bitiyor, mod dalga bile göstermeye fırsat
   * bulamadan kapanıyordu. Yumuşak başlangıç + beş canla ortalama
   * oyuncu artık 3–4. dalgaya, ~60–90 saniyelik bir koşuya ulaşıyor.
   * "Zor" kademesi kasıtlı olarak acımasız kalır.
   */
  startEase: 1.8,
  /** Dalga başına `scaleDifficulty` adımı. */
  rampPerWave: 0.32,
  /** Sertleşmenin durduğu dalga — sonsuza kadar büyümesin. */
  maxRampWave: 14,
  /** Dalga değişiminde ekranda kalan duyuru süresi (sn). */
  waveAnnounce: 1.9,
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
  SERVE: 'serve', // servis gücü / nişan
  RALLY: 'rally', // top oyunda
  POINT: 'point', // sayı oldu, kısa donma
  SET_END: 'setEnd',
  MATCH_END: 'matchEnd',
};
