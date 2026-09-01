/**
 * Piksel sprite çizimleri — tamamı kod, tek bir görsel dosyası yok.
 *
 * Oyundaki her şey (sultanlar, top, file, bayrak, kupa, rakamlar)
 * burada Canvas 2D API'siyle blok blok çizilir: `ctx.fillRect`,
 * `ctx.arc`, `ctx.fillText` yerine kendi piksel rakam fontumuz.
 * PNG/JPG yüklenmez, `drawImage` kullanılmaz.
 *
 * Hem oyun motoru hem de React karakter seçim ekranı bu fonksiyonları
 * kullanır — sahadaki figürle avatardaki figür birebir aynıdır.
 *
 * Sultan figürü 14 birim genişlik × 22 birim yükseklik bir ızgaraya
 * çizilir; `scale` bir ızgara biriminin ekrandaki piksel boyutudur.
 */

import { PALETTE } from './constants.js';
import { getAppearance } from './players.js';

export const SPRITE_UNITS_W = 14;
export const SPRITE_UNITS_H = 22;

// =====================================================================
// Piksel rakam fontu
// =====================================================================

/**
 * 3×5 piksel rakamlar.
 *
 * Forma numaraları önce "Press Start 2P" ile yazılıyordu; font geç
 * yüklendiğinde ölçüm ve görünüm kayıyordu. Kendi bitmap fontumuz
 * hem font yüklemesinden bağımsız hem de gerçek piksel-art.
 */
const DIGITS = {
  0: ['111', '101', '101', '101', '111'],
  1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'],
  4: ['101', '101', '111', '001', '001'],
  5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'],
  7: ['111', '001', '001', '001', '001'],
  8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
};

const DIGIT_W = 3;
const DIGIT_H = 5;
const DIGIT_GAP = 1;

/**
 * Bir sayıyı piksel rakamlarla, verilen noktada ortalayarak çizer.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} value
 * @param {number} cx Yatay merkez
 * @param {number} cy Dikey merkez
 * @param {number} dot Bir rakam pikselinin boyutu
 * @param {string} color
 * @param {string} [outline] Verilirse rakamın arkasına kontur çizilir
 */
export function drawPixelNumber(ctx, value, cx, cy, dot, color, outline) {
  const text = String(value);
  const totalW = text.length * DIGIT_W * dot + (text.length - 1) * DIGIT_GAP * dot;
  const startX = cx - totalW / 2;
  const startY = cy - (DIGIT_H * dot) / 2;

  text.split('').forEach((char, index) => {
    const glyph = DIGITS[char];
    if (!glyph) return;

    const gx = startX + index * (DIGIT_W + DIGIT_GAP) * dot;

    for (let row = 0; row < DIGIT_H; row += 1) {
      for (let col = 0; col < DIGIT_W; col += 1) {
        if (glyph[row][col] !== '1') continue;

        const x = Math.round(gx + col * dot);
        const y = Math.round(startY + row * dot);
        const size = Math.max(1, Math.ceil(dot));

        if (outline) {
          ctx.fillStyle = outline;
          ctx.fillRect(x - 1, y - 1, size + 2, size + 2);
        }
        ctx.fillStyle = color;
        ctx.fillRect(x, y, size, size);
      }
    }
  });
}

// =====================================================================
// Sultan figürü
// =====================================================================

/**
 * Izgara birimiyle, koyu dış hatlı blok çizer.
 * Dış hat figürün zeminden ayrışmasını sağlar.
 */
function blockPainter(ctx, originX, originY, u) {
  return (gx, gy, gw, gh, color, outline = true) => {
    if (!color) return; // null renk = o parça çizilmez (ör. takılmayan aksesuar)

    const x = originX + gx * u;
    const y = originY + gy * u;
    const w = gw * u;
    const h = gh * u;

    if (outline) {
      ctx.fillStyle = PALETTE.outline;
      ctx.fillRect(
        Math.round(x - 1),
        Math.round(y - 1),
        Math.round(w + 2),
        Math.round(h + 2)
      );
    }
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));

    // Hacim: üstten ışık, altta gölge. Düz renk bloklar karton gibi
    // duruyordu; bu iki şerit figüre derinlik veriyor.
    // Küçük parçalarda (aksesuar şeritleri) atlanır, yoksa ezilirler.
    if (h >= u * 1.6 && w >= u * 1.2) {
      const band = Math.max(1, Math.round(h * 0.24));
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), band);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.20)';
      ctx.fillRect(
        Math.round(x),
        Math.round(y + h - band),
        Math.round(w),
        band
      );
    }
  };
}

/**
 * Üst üste duran, genişlikleri farklı blokları TEK bir siluet gibi çizer.
 *
 * Blokları tek tek `px` ile basmak işe yaramıyor: her blok kendi dış
 * hattını ve kendi ışık/gölge şeridini alıyor, gövde çizgili bir yığına
 * dönüşüyor. Burada önce bütün dış hatlar, sonra bütün dolgular basılır
 * — iç kenarlar komşu dolgunun altında kalır — ve hacim şeridi yığının
 * tamamına yalnızca bir kez uygulanır.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} originX Izgara sol üst köşesi
 * @param {number} originY
 * @param {number} u Birim boyutu
 * @param {Array<{y:number, h:number, w:number, color:string}>} bands
 * @param {{ shade?: boolean, centerX?: number }} [opts]
 */
function drawTaperedStack(ctx, originX, originY, u, bands, opts = {}) {
  const { shade = true, centerX = SPRITE_UNITS_W / 2 } = opts;

  const box = (b) => [
    Math.round(originX + (centerX - b.w / 2) * u),
    Math.round(originY + b.y * u),
    Math.round(b.w * u),
    Math.round(b.h * u),
  ];

  ctx.fillStyle = PALETTE.outline;
  bands.forEach((b) => {
    const [x, y, w, h] = box(b);
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  });

  bands.forEach((b) => {
    const [x, y, w, h] = box(b);
    ctx.fillStyle = b.color;
    ctx.fillRect(x, y, w, h);
  });

  if (!shade) return;

  const strip = Math.max(1, Math.round(u * 0.36));
  const [fx, fy, fw] = box(bands[0]);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.13)';
  ctx.fillRect(fx, fy, fw, strip);

  const [lx, ly, lw, lh] = box(bands[bands.length - 1]);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.20)';
  ctx.fillRect(lx, ly + lh - strip, lw, strip);
}

/**
 * Gövde silueti: omuz → göğüs → bel → kalça.
 *
 * Figürün "erkek gibi" okunmasının asıl sebebi buranın tek parça, 8
 * birim genişliğinde düz bir dikdörtgen olmasıydı — omuz, bel ve kalça
 * aynı genişlikteydi. Bel içeri girip kalça omuzdan biraz genişleyince
 * siluet bu çözünürlükte bile kadın figürü olarak okunuyor.
 *
 * Omuzun kalçadan DAR olması bilinçli: oran tersine döndüğünde figür
 * yeniden erkekleşiyor.
 */
const TORSO_BANDS = [
  { y: 8.0, h: 1.3, w: 7.1 },
  { y: 9.3, h: 2.2, w: 6.8 },
  { y: 11.5, h: 1.4, w: 6.0 },
  { y: 12.9, h: 1.4, w: 7.4 },
];

/** Gövdenin en geniş noktası — kolların nereye yaslanacağını belirler. */
const TORSO_MAX_W = Math.max(...TORSO_BANDS.map((b) => b.w));

/**
 * Saç modelini çizer. Kafa 4.2–9.8, saç tepesi 0.7–2.9 birimleri arasında.
 *
 * Desteklenen stiller:
 *   short | short-spiky | short-fade | ponytail | high-ponytail |
 *   half-ponytail | bun | sleek-bun | high-bun | braided-bun |
 *   long | curly-long | half-up | braid
 *
 * @param {(gx:number, gy:number, gw:number, gh:number, color:string, outline?:boolean) => void} px
 * @param {string} style
 * @param {string} hair Saç rengi
 * @param {number} facing
 */
function drawHair(px, style, hair, facing) {
  const HAIR_L = 3.6;
  const HAIR_R = 10.4;
  const OVERLAP = 1.0;

  /**
   * Arkaya dökülen tutam — bakışın TERSİ yönde, saç kenarına yaslanır.
   *
   * Eskiden bunlar sabit x sayılarıydı; tutam genişliği ya da bakış
   * yönü değişince tutam ya kafadan kopuyor ya da yüzü kapatıyordu.
   * Ölçekte bakınca uzun saç iki yana sarkan perde gibi duruyordu.
   * Kenara yaslamak iki yönde de simetrik sonuç veriyor.
   */
  const back = (gy, gw, gh, outline = true) =>
    px(
      facing > 0 ? HAIR_L - gw + OVERLAP : HAIR_R - OVERLAP,
      gy,
      gw,
      gh,
      hair,
      outline
    );

  /** Omzun önüne düşen tutam — bakış yönünde. */
  const front = (gy, gw, gh, outline = false) =>
    px(
      facing > 0 ? HAIR_R - OVERLAP : HAIR_L - gw + OVERLAP,
      gy,
      gw,
      gh,
      hair,
      outline
    );

  /*
   * 1) TEPE PARÇALARI (topuz, dikenler) — ortak saç tepesinden ÖNCE.
   *
   * Sonra çizildiklerinde kendi dış hatlarını ve alt gölge şeritlerini
   * de getiriyorlar; ölçekte topuz saçtan kopmuş, havada duran ayrı bir
   * kutu gibi görünüyordu. Önce çizilince ortak tepe onların alt
   * kenarını kapatıyor ve parçalar tek siluete bağlanıyor.
   *
   * `crown` tepe parçasının yatay aralığı — ortak tepenin dış hattı
   * tam onun içinden geçtiği için o aralık sonradan kapatılır.
   */
  let crown = null;

  switch (style) {
    case 'short-spiky':
      // Dik kısa uçlar (Ebrar)
      px(4.3, 0.1, 1.3, 1.3, hair);
      px(6.1, -0.3, 1.5, 1.7, hair);
      px(8.1, 0.1, 1.3, 1.3, hair);
      crown = [4.3, 5.1];
      break;

    case 'short-fade':
      // Üstte küçük örgüler (Melissa)
      px(5.4, -0.2, 1.2, 1.7, hair);
      px(7.0, -0.4, 1.2, 1.9, hair);
      crown = [5.4, 2.8];
      break;

    case 'bun':
      px(5.6, -0.7, 2.8, 2.1, hair);
      px(6.3, -1.2, 1.4, 0.9, hair, false);
      crown = [5.6, 2.8];
      break;

    case 'sleek-bun':
      // Yatık sıkı topuz — daha alçak ve düz
      px(5.9, -0.4, 2.2, 1.8, hair);
      px(6.3, -0.8, 1.4, 0.7, hair, false);
      crown = [5.9, 2.2];
      break;

    case 'high-bun':
      // Yüksek topuz (Elif, Dilay)
      px(5.2, -1.3, 3.6, 2.7, hair);
      px(5.8, -1.9, 2.4, 1.0, hair, false);
      crown = [5.2, 3.6];
      break;

    case 'braided-bun':
      px(5.7, -0.9, 2.6, 2.3, hair);
      crown = [5.7, 2.6];
      break;

    case 'half-up':
      // Yarı bağlı (Zehra)
      px(5.5, -0.7, 3.0, 1.9, hair);
      crown = [5.5, 3.0];
      break;

    case 'high-ponytail':
      px(5.9, -0.5, 2.2, 1.6, hair);
      crown = [5.9, 2.2];
      break;

    case 'half-ponytail':
      px(5.9, -0.2, 2.0, 1.4, hair);
      crown = [5.9, 2.0];
      break;

    default:
      break;
  }

  /*
   * 2) ORTAK TEPE VE YAN ÇERÇEVE.
   *
   * Yanlar kafadan (4.4–9.6) bilerek taşar. Saç yüzden dar kaldığında
   * figür kepli gibi duruyordu; yüzü çerçeveleyen saç hem modeli önden
   * okunur kılıyor hem de siluete katkı veriyor.
   */
  px(3.7, 0.8, 6.6, 2.2, hair);
  px(3.6, 1.6, 1.15, 3.9, hair, false);
  px(9.25, 1.6, 1.15, 3.9, hair, false);

  // Ortak tepenin dış hattı tepe parçasının içinden geçiyor; yalnızca
  // o aralıkta konturusuz saç basıp dikişi kapat.
  if (crown) px(crown[0] + 0.15, 0.7, crown[1] - 0.3, 0.85, hair, false);

  /* 3) SIRTA VE OMZA DÖKÜLEN TUTAMLAR. */
  switch (style) {
    case 'short':
      px(3.5, 5.2, 1.35, 1.2, hair, false);
      px(9.15, 5.2, 1.35, 1.2, hair, false);
      break;

    case 'short-spiky':
      px(3.5, 5.0, 1.25, 1.0, hair, false);
      px(9.25, 5.0, 1.25, 1.0, hair, false);
      break;

    case 'short-fade':
      // Yandan kısa
      px(3.35, 2.0, 0.9, 3.2, hair, false);
      px(9.75, 2.0, 0.9, 3.2, hair, false);
      back(2.8, 1.4, 2.6);
      back(5.0, 1.5, 1.8, false);
      break;

    case 'sleek-bun':
      px(4.2, 1.2, 5.6, 1.0, hair, false);
      break;

    case 'braided-bun':
      back(2.8, 1.5, 2.0);
      back(4.6, 1.7, 1.6);
      break;

    case 'long':
      // İki parça: aşağı doğru incelir. Tek kalın blok kolu tamamen
      // kapatıp tahta gibi duruyordu.
      back(2.6, 1.8, 5.6);
      back(7.8, 1.45, 4.2, false);
      front(2.8, 1.2, 5.0);
      break;

    case 'curly-long':
      // Hacimli kıvırcık — boblar birbirine biner ki aralarında
      // dış hat izi kalmasın.
      back(2.4, 2.0, 3.2);
      back(4.6, 2.2, 3.0);
      back(6.8, 1.9, 3.0);
      front(2.9, 1.3, 2.6);
      front(4.8, 1.4, 2.4);
      break;

    case 'half-up':
      back(2.6, 1.8, 5.8);
      back(8.0, 1.45, 4.4, false);
      front(3.0, 1.2, 5.4);
      break;

    case 'high-ponytail':
      back(1.7, 1.5, 5.8);
      back(7.3, 1.8, 1.9, false);
      break;

    case 'half-ponytail':
      back(2.8, 1.3, 3.4);
      front(3.2, 1.2, 4.0);
      break;

    case 'braid':
      back(2.5, 1.5, 2.3);
      back(4.6, 1.8, 2.0);
      back(6.4, 1.5, 2.0);
      back(8.2, 1.2, 1.6);
      break;

    case 'bun':
    case 'high-bun':
      break;

    case 'ponytail':
    default:
      back(2.7, 1.4, 4.4);
      back(6.9, 1.7, 1.6, false);
      break;
  }
}

/**
 * Kolye, küpe ve kol dövmeleri.
 * @param {(gx:number, gy:number, gw:number, gh:number, color:string, outline?:boolean) => void} px
 * @param {object} look
 * @param {number} facing
 * @param {string} skin
 */
function drawExtras(px, look, facing, skin) {
  // Kolye — boyun altı ince halka
  if (look.necklace) {
    px(5.6, 8.5, 2.8, 0.45, look.necklace, false);
    px(6.4, 8.8, 1.2, 0.4, look.necklace, false);
  }

  // Küpe — kulak hizası
  if (look.earring) {
    const earX = facing > 0 ? 9.3 : 4.0;
    px(earX, 4.7, 0.7, 0.9, look.earring, false);
  }

  // Kol dövmeleri — koyu piksel lekeleri
  if (look.tattoos) {
    const ink = '#2A1810';
    if (facing > 0) {
      px(10.6, 10.2, 1.3, 0.5, ink, false);
      px(10.75, 11.2, 0.95, 0.42, ink, false);
      px(2.1, 10.6, 1.1, 0.45, ink, false);
    } else {
      px(2.1, 10.2, 1.3, 0.5, ink, false);
      px(2.25, 11.2, 0.95, 0.42, ink, false);
      px(10.6, 10.6, 1.1, 0.45, ink, false);
    }
    // skin üstüne çok koyu olmasın diye ince tutuyoruz
    void skin;
  }
}

/**
 * Filenin Sultanı figürünü çizer.
 *
 * Saç rengi ve modeli, forma numarası, kafa bandı, bileklik, dizlik ve
 * kaptan pazıbandı `players.js` içindeki `colors` / `appearance` /
 * `number` / `captain` alanlarından okunur.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} data players.js'teki oyuncu nesnesi
 * @param {object} opts
 * @param {number} opts.x      Ayakların yatay merkezi
 * @param {number} opts.y      Ayakların değdiği zemin çizgisi
 * @param {number} [opts.scale] Birim boyutu (px)
 * @param {'idle'|'run'|'jump'|'spike'|'bump'|'cheer'} [opts.pose]
 * @param {number} [opts.facing] 1 sağa, -1 sola
 * @param {number} [opts.frame]  Koşu animasyon fazı (0..1)
 * @param {boolean} [opts.showNumber]
 */
export function drawSultan(ctx, data, opts) {
  const {
    x,
    y,
    scale: u = 3,
    pose = 'idle',
    facing = 1,
    frame = 0,
    showNumber = true,
  } = opts;

  const { primary, secondary, skin, hair, accent } = data.colors;
  const look = getAppearance(data);

  const originX = x - (SPRITE_UNITS_W / 2) * u;
  const originY = y - SPRITE_UNITS_H * u;
  const px = blockPainter(ctx, originX, originY, u);

  ctx.save();

  // Dalış tamamen farklı bir düzen: figür yatay uzanır.
  // Ayakta duran iskeleti döndürmek yerine kendi çizimi var.
  if (pose === 'dive') {
    drawDivingSultan(ctx, data, look, { x, y, u, facing });
    ctx.restore();
    return;
  }

  // --- Bacaklar (koşu fazına göre açılır) ---
  const stride = pose === 'run' ? Math.sin(frame * Math.PI * 2) * 1.1 : 0;
  const legSpread = pose === 'jump' || pose === 'spike' ? 1.2 : 0;
  /*
   * Duruş bilerek daraltıldı ve bacaklar inceltildi: iki yana açılmış
   * kalın bacaklar siluetin alt yarısına ağırlık verip figürü
   * erkekleştiren ikinci etkendi.
   */
  const legW = 1.85;
  const legL = 4.45 - legSpread + stride;
  const legR = 7.7 + legSpread - stride;

  px(legL, 16.1, legW, 4.4, skin);
  px(legR, 16.1, legW, 4.4, skin);

  // Dizlikler (aksesuar — null ise çizilmez)
  px(legL - 0.25, 17.5, legW + 0.5, 1.25, look.kneePads, false);
  px(legR - 0.25, 17.5, legW + 0.5, 1.25, look.kneePads, false);

  // Çoraplar ve ayakkabılar
  px(legL - 0.1, 20.1, legW + 0.2, 0.95, '#FFFFFF', false);
  px(legR - 0.1, 20.1, legW + 0.2, 0.95, '#FFFFFF', false);
  px(legL - 0.5, 20.9, legW + 1.0, 1.2, '#F5F5F5');
  px(legR - 0.5, 20.9, legW + 1.0, 1.2, '#F5F5F5');

  // --- Kollar (poza göre) ---
  // Her kol gövdenin üst kenarına (y=8) kadar uzatılır, yoksa
  // kaldırılmış kollar figürden kopuk görünür.
  // wrist* değerleri bilekliğin nereye çizileceğini tutar.
  let wristL = null;
  let wristR = null;

  // Kollar inceltildi (2.1 → 1.7) ve gövdenin en geniş noktasına
  // yaslandı; daralan gövdeyle birlikte hesaplanıyor ki taper
  // değiştiğinde kollar havada kalmasın.
  const armW = 1.7;
  const armL = SPRITE_UNITS_W / 2 - TORSO_MAX_W / 2 - armW + 0.15;
  const armR = SPRITE_UNITS_W / 2 + TORSO_MAX_W / 2 - 0.15;

  if (pose === 'jump' || pose === 'spike') {
    const hitArmY = pose === 'spike' ? 1.4 : 3.2;
    const hitArmH = pose === 'spike' ? 7.2 : 5.6;
    const hitX = facing > 0 ? armR : armL;
    const offX = facing > 0 ? armL : armR;

    px(hitX, hitArmY, armW, hitArmH, skin);
    px(offX, 4.4, armW, 5.4, skin);

    wristL = [hitX - 0.2, hitArmY + 0.5, armW + 0.4, 1.05];
    wristR = [offX - 0.2, 4.9, armW + 0.4, 1.05];
  } else if (pose === 'bump') {
    const armX = facing > 0 ? 9.2 : 3.0;
    px(armX, 10.4, 3.6, 2.1, skin);
    px(facing > 0 ? 11.9 : 0.4, 11.4, 1.7, 1.75, skin);

    wristL = [facing > 0 ? 11.3 : 1.5, 10.6, 1.2, 1.85];
    wristR = null;
  } else if (pose === 'cheer') {
    px(armL + 0.3, 2.4, armW, 6.4, skin);
    px(armR - 0.3, 2.4, armW, 6.4, skin);

    wristL = [armL + 0.1, 3, armW + 0.4, 1.05];
    wristR = [armR - 0.5, 3, armW + 0.4, 1.05];
  } else {
    px(armL, 8.9, armW, 5.4, skin);
    px(armR, 8.9, armW, 5.4, skin);

    wristL = [armL - 0.2, 13, armW + 0.4, 1.05];
    wristR = [armR - 0.2, 13, armW + 0.4, 1.05];
  }

  // Bileklikler (aksesuar)
  if (look.wristband) {
    if (wristL) px(...wristL, look.wristband, false);
    if (wristR) px(...wristR, look.wristband, false);
  }

  // --- Forma (gövde) ---
  // Omuz bandı ikincil renkte; yaka/omuz şeridi etkisini o veriyor.
  drawTaperedStack(
    ctx,
    originX,
    originY,
    u,
    TORSO_BANDS.map((b, i) => ({ ...b, color: i === 0 ? secondary : primary }))
  );

  // Yan şeritler bant bant çizilir ki daralan gövdeyi takip etsinler;
  // tek dikey şerit belde gövdenin dışında kalırdı.
  const mid = SPRITE_UNITS_W / 2;
  TORSO_BANDS.slice(1).forEach((b) => {
    px(mid - b.w / 2, b.y, 0.5, b.h, secondary, false);
    px(mid + b.w / 2 - 0.5, b.y, 0.5, b.h, secondary, false);
  });

  // Etek ucu şeridi
  const hem = TORSO_BANDS[TORSO_BANDS.length - 1];
  px(mid - hem.w / 2, hem.y + hem.h - 0.5, hem.w, 0.5, secondary, false);

  // Kaptan pazıbandı — sadece kaptanda
  if (data.captain) {
    px(facing > 0 ? armL - 0.2 : armR - 0.2, 9.4, armW + 0.4, 1.25, accent, false);
  }

  // --- Şort ---
  px(3.3, 14.1, 7.4, 2.3, '#1B1B2E');

  // --- Boyun ve yaka ---
  // Boyun gövdeden SONRA çizilir; formanın içine sarkan ikinci blok
  // yuvarlak yaka etkisi veriyor.
  px(6.05, 6.7, 1.9, 1.7, skin);
  px(5.75, 7.9, 2.5, 0.65, skin, false);

  // --- Baş (çeneye doğru daralır) ---
  // Düz 6×5 blok kafa figürün erkek okunmasına katkı veriyordu;
  // çene bandı yüzü sivriltiyor.
  drawTaperedStack(ctx, originX, originY, u, [
    { y: 2.3, h: 4.0, w: 5.2, color: skin },
    { y: 6.3, h: 0.8, w: 4.2, color: skin },
  ]);

  // Gözler ve kirpikler
  const eyeSize = Math.max(1, Math.round(u * 0.8));
  const eyeY = Math.round(originY + 4.3 * u);
  const eyeAX = Math.round(originX + (facing > 0 ? 6.6 : 5.25) * u);
  const eyeBX = Math.round(originX + (facing > 0 ? 8.15 : 6.8) * u);

  ctx.fillStyle = PALETTE.outline;
  ctx.fillRect(eyeAX, eyeY, eyeSize, eyeSize);
  ctx.fillRect(eyeBX, eyeY, eyeSize, eyeSize);

  // Kirpik: gözün üstünde, bakış yönüne doğru uzayan ince çizgi.
  // Bu çözünürlükte tek piksel sıra bile yüzü belirgin biçimde
  // yumuşatıyor.
  const lashH = Math.max(1, Math.round(u * 0.24));
  const lashW = Math.max(1, Math.round(eyeSize * 1.15));
  const lashShift = Math.round(u * 0.18) * (facing > 0 ? 1 : -1);
  ctx.fillRect(eyeAX + lashShift, eyeY - lashH, lashW, lashH);
  ctx.fillRect(eyeBX + lashShift, eyeY - lashH, lashW, lashH);

  // --- Saç ---
  // Her model baştan SONRA çizilir. Daha önce uzun saç ve örgü
  // gövdeden önce çiziliyordu; kollar üstünü kapattığı için hiç
  // görünmüyorlardı. Uzun saçın omzun önüne dökülmesi doğal görünüyor.
  drawHair(px, look.hairStyle, hair, facing);

  // --- Kafa bandı (aksesuar) ---
  px(3.6, 2.3, 6.8, 0.85, look.headband, false);

  // Kolye / küpe / dövme
  drawExtras(px, look, facing, skin);

  // --- Forma numarası (piksel font) ---
  // Rakam pikseli tam sayıya yuvarlanır, yoksa alt piksel kaymaları
  // glifi bulanıklaştırıyor. Kontur da çizilmez: küçük ölçeklerde
  // her pikselin etrafındaki çerçeve rakamı yutuyor — okunurluk
  // formanın rengiyle kontrasttan gelir.
  if (showNumber) {
    // Rakam göğüs bandına taşındı: bel artık 5.9 birim ve iki haneli
    // numaralar orada kenarlara değiyordu.
    const dot = Math.max(1, Math.round(u * 0.56));
    drawPixelNumber(
      ctx,
      data.number,
      originX + mid * u,
      originY + 10.4 * u,
      dot,
      secondary === primary ? '#FFFFFF' : secondary
    );
  }

  ctx.restore();
}

/**
 * Dalan sultan — yere paralel uzanmış figür.
 *
 * Koordinatlar (x, y) ikilisine göre birim cinsinden verilir:
 * x ayakların değil gövdenin yatay merkezi, y zemin çizgisidir.
 * `facing` yönünde baş ve uzanan kol öndedir.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} data
 * @param {object} look getAppearance sonucu
 * @param {{x:number, y:number, u:number, facing:number}} opts
 */
function drawDivingSultan(ctx, data, look, { x, y, u, facing }) {
  const { primary, secondary, skin, hair, accent } = data.colors;
  const f = facing >= 0 ? 1 : -1;

  /** Birim cinsinden, yöne göre aynalanan blok. */
  const px = (gx, gy, gw, gh, color, outline = true) => {
    if (!color) return;
    // gx figürün merkezine göre; negatif yön aynalanır
    const left = x + (f > 0 ? gx : -gx - gw) * u;
    const top = y + gy * u;
    const w = gw * u;
    const h = gh * u;

    if (outline) {
      ctx.fillStyle = PALETTE.outline;
      ctx.fillRect(
        Math.round(left - 1),
        Math.round(top - 1),
        Math.round(w + 2),
        Math.round(h + 2)
      );
    }
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(left), Math.round(top), Math.round(w), Math.round(h));
  };

  // Arkada sürüklenen bacaklar
  px(-11, -6.5, 6, 2.6, skin);
  px(-9.4, -7, 2.6, 1.3, look.kneePads, false);
  px(-12.6, -6.6, 2, 2.4, '#F5F5F5'); // ayakkabı

  // Şort
  px(-6.5, -8.6, 4.6, 4.2, '#1B1B2E');

  // Gövde (forma)
  px(-2.6, -9.6, 6.8, 5.4, primary);
  px(-2.6, -9.6, 6.8, 1, secondary, false); // omuz şeridi
  px(-2.6, -4.8, 6.8, 0.8, secondary, false);

  // Kaptan pazıbandı
  if (data.captain) {
    px(2.2, -9.2, 1.6, 1.2, accent, false);
  }

  // Uzanan kol — topa yetişen
  px(6.6, -7.6, 6, 2.4, skin);
  px(11.4, -7.9, 1.6, 3, look.wristband, false);

  // Baş
  px(3.4, -10.6, 5, 4.8, skin);

  // Göz
  ctx.fillStyle = PALETTE.outline;
  const eye = Math.max(1, Math.round(u * 0.8));
  ctx.fillRect(
    Math.round(x + (f > 0 ? 6.4 : -7.2) * u),
    Math.round(y - 9.2 * u),
    eye,
    eye
  );

  // Saç — dalışta arkaya savrulur
  px(3.2, -11.4, 5.2, 1.8, hair);
  px(0.6, -11.2, 3, 1.6, hair, false);
  const trailing =
    look.hairStyle !== 'short' &&
    look.hairStyle !== 'short-spiky' &&
    look.hairStyle !== 'short-fade';
  if (trailing) {
    px(-1.8, -11, 2.6, 1.4, hair, false);
    if (
      look.hairStyle === 'long' ||
      look.hairStyle === 'curly-long' ||
      look.hairStyle === 'half-up'
    ) {
      px(-4.0, -10.6, 2.4, 1.2, hair, false);
    }
  }

  // Kafa bandı
  px(3.4, -10.6, 5, 0.9, look.headband, false);

  if (look.necklace) {
    px(4.2, -6.2, 2.4, 0.5, look.necklace, false);
  }

  // Forma numarası
  drawPixelNumber(
    ctx,
    data.number,
    x + (f > 0 ? 0.8 : -0.8) * u,
    y - 7 * u,
    Math.max(1, Math.round(u * 0.5)),
    secondary === primary ? '#FFFFFF' : secondary
  );
}

// =====================================================================
// Voleybol topu
// =====================================================================

/**
 * Voleybol topu — piksel ızgarasına çizilmiş disk.
 *
 * Pürüzsüz `arc` yerine hücre hücre `fillRect` kullanılır ki top da
 * sahanın geri kalanıyla aynı piksel diliyle konuşsun.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x:number, y:number, radius:number, rotation:number}} ball
 */
export function drawBall(ctx, ball) {
  const { x, y, radius: r, rotation } = ball;

  const cell = Math.max(2, r / 5.5);
  const steps = Math.ceil(r / cell) + 1;

  const base = PALETTE.ballWhite;
  const stripeA = PALETTE.ballRed;
  const stripeB = PALETTE.ballBlue;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  for (let i = -steps; i <= steps; i += 1) {
    for (let j = -steps; j <= steps; j += 1) {
      const cx = i * cell;
      const cy = j * cell;
      const dist = Math.hypot(cx, cy);
      if (dist > r) continue;

      const ratio = dist / r;
      let color = base;

      // Dış hat halkası
      if (ratio > 0.82) {
        color = PALETTE.outline;
      } else if (ratio > 0.34 && ratio < 0.74) {
        // Panel şeritleri — üst yarı ve alt yarı farklı renk
        const angle = Math.atan2(cy, cx);
        if (angle > 0.25 && angle < 2.85) color = stripeA;
        else if (angle < -0.25 && angle > -2.85) color = stripeB;
      }

      ctx.fillStyle = color;
      ctx.fillRect(
        Math.round(cx - cell / 2),
        Math.round(cy - cell / 2),
        Math.ceil(cell),
        Math.ceil(cell)
      );
    }
  }

  ctx.restore();

  // Işık vurgusu — dönmeyle birlikte kaymasın diye rotasyon dışında
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.fillRect(
    Math.round(x - r * 0.55),
    Math.round(y - r * 0.62),
    Math.ceil(cell),
    Math.ceil(cell)
  );
}

// =====================================================================
// Türk bayrağı
// =====================================================================

/**
 * Türk bayrağı — piksel hilal ve yıldız.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x Sol üst köşe
 * @param {number} y Sol üst köşe
 * @param {number} u Birim boyutu
 * @param {number} [wave] Dalgalanma fazı (radyan)
 */
export function drawTurkishFlag(ctx, x, y, u, wave = 0) {
  const cols = 12;
  const rows = 8;
  const cell = Math.ceil(u);

  // Kırmızı zemin sütun sütun çizilir: dalgalanma sütun bazlı olduğu
  // için her sütun tek dikdörtgen yeter. (Hücre hücre çizmek kare
  // başına 96 çağrı demekti; tribünde 20+ bayrak varken bu ağır.)
  const offsets = new Array(cols);
  ctx.fillStyle = PALETTE.turkishRed;

  for (let c = 0; c < cols; c += 1) {
    const offset = Math.sin(wave + c * 0.55) * u * 0.5;
    offsets[c] = offset;
    ctx.fillRect(
      Math.round(x + c * u),
      Math.round(y + offset),
      cell,
      Math.ceil(rows * u)
    );
  }

  // Beyaz hilal ve yıldız pikselleri
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < FLAG_WHITE.length; i += 1) {
    const [c, r] = FLAG_WHITE[i];
    ctx.fillRect(
      Math.round(x + c * u),
      Math.round(y + r * u + offsets[c]),
      cell,
      cell
    );
  }
}

/** 12×8 bayrak ızgarasındaki beyaz hücreler: hilal + yıldız. */
export const FLAG_WHITE = [
  // Hilal
  [3, 3], [3, 4],
  [4, 2], [4, 5],
  [5, 1], [5, 6],
  [6, 1], [6, 6],
  [7, 2], [7, 5],
  // Yıldız
  [9, 3], [9, 4], [10, 4],
];

// =====================================================================
// Kupa
// =====================================================================

/**
 * Piksel şampiyonluk kupası.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x Merkez
 * @param {number} y Taban
 * @param {number} u Birim boyutu
 */
export function drawTrophy(ctx, x, y, u) {
  const px = (gx, gy, gw, gh, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(
      Math.round(x + gx * u),
      Math.round(y + gy * u),
      Math.ceil(gw * u),
      Math.ceil(gh * u)
    );
  };

  const gold = PALETTE.gold;
  const goldDark = '#C99A1F';
  const goldLight = '#FFF0B0';

  // Kase
  px(-4, -12, 8, 6, gold);
  px(-3, -6, 6, 2, goldDark);
  px(-3, -11, 2, 4, goldLight); // parlama

  // Kulplar
  px(-6, -11, 2, 4, goldDark);
  px(4, -11, 2, 4, goldDark);

  // Gövde
  px(-1.5, -4, 3, 3, goldDark);

  // Taban
  px(-4, -1, 8, 1.6, gold);
  px(-5, 0.6, 10, 1.6, goldDark);
}

// =====================================================================
// Favicon
// =====================================================================

/**
 * Sekme / PWA ikonunu çalışma anında üretir — repoda PNG tutulmaz.
 * @param {number} [size=32]
 * @returns {string} data: URL
 */
export function createAppIconDataUrl(size = 32) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = PALETTE.turkishRed;
  ctx.fillRect(0, 0, size, size);

  // Hafif koyu çerçeve
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(0, 0, size, Math.max(2, size * 0.06));
  ctx.fillRect(0, size - Math.max(2, size * 0.06), size, Math.max(2, size * 0.06));

  const radius = size * 0.36;
  drawBall(ctx, { x: size / 2, y: size / 2, radius, rotation: 0.35 });

  return canvas.toDataURL('image/png');
}

/** @returns {string} data: URL */
export function createFaviconDataUrl() {
  return createAppIconDataUrl(32);
}
