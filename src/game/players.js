/**
 * Filenin Sultanları kadro verisi.
 *
 * Oyunun veri katmanı — motor (Game.js) ve React ekranları buradaki
 * nesneleri okur. Yeni oyuncu eklemek için ROSTER dizisine aynı
 * şekilde bir nesne eklemek yeterli.
 *
 * Statlar 0–100 arası, oyun dengesi içindir; gerçek sporcu
 * performansının ölçüsü değildir. Forma numaraları da örnek
 * değerlerdir, güncel kadroya göre düzenlenebilir.
 */

/** Oyun içi mevkiler. */
export const POSITIONS = {
  ORTA: 'Orta Oyuncu',
  PASOR: 'Pasör',
  PASOR_CAPRAZI: 'Pasör Çaprazı',
  SMACOR: 'Smaçör',
  LIBERO: 'Libero',
};

/**
 * Motorun okuduğu çarpan anahtarları. Tanımlı olmayan her anahtar
 * için varsayılan 1 kullanılır (bkz. getModifier).
 *
 *   spikePower  → smaç çıkış hızı
 *   bumpPower   → manşet / normal temas gücü
 *   blockPower  → file üstünde karşılama gücü
 *   reach       → çarpışma dairesi yarıçapı
 *   speed       → yatay hareket hızı
 *   jump        → zıplama yüksekliği
 *   charge      → Sultan Gücü barının dolum hızı
 */

/**
 * Görünüm (appearance) sözleşmesi.
 *
 * Oyunda tek bir harici görsel dosyası yoktur — her karakter
 * `src/game/sprites.js` içinde Canvas API ile piksel piksel çizilir.
 * Aşağıdaki alanlar o çizimi kod seviyesinde özelleştirir:
 *
 *   hairStyle  Saç modeli: 'short' | 'ponytail' | 'bun' | 'long' | 'braid'
 *   headband   Kafa bandı rengi — null ise takılmaz
 *   wristband  Bileklik rengi — null ise takılmaz
 *   kneePads   Dizlik rengi — null ise takılmaz
 *
 * Saç rengi `colors.hair`, forma numarası `number` alanından gelir.
 * Kaptan pazıbandı `captain: true` olan oyuncuya otomatik çizilir
 * (rengi `colors.accent`).
 *
 * @typedef {Object} Appearance
 * @property {'short'|'ponytail'|'bun'|'long'|'braid'} hairStyle
 * @property {string|null} headband
 * @property {string|null} wristband
 * @property {string|null} kneePads
 */

/**
 * @typedef {Object} Player
 * @property {string} id
 * @property {string} name
 * @property {number} number Forma numarası (sprite üzerine çizilir)
 * @property {string} position
 * @property {boolean} captain
 * @property {number} height
 * @property {{attack:number, block:number, serve:number, defense:number, speed:number, stamina:number}} stats
 * @property {{primary:string, secondary:string, skin:string, hair:string, accent:string}} colors
 * @property {Appearance} appearance
 * @property {{name:string, description:string}} bonus
 * @property {Record<string, number>} modifiers
 */

/** Seçilebilir saç modelleri — yeni model eklerken sprites.js'i de güncelle. */
export const HAIR_STYLES = ['short', 'ponytail', 'bun', 'long', 'braid'];

/** Görünüm alanı eksikse kullanılan varsayılan. */
export const DEFAULT_APPEARANCE = {
  hairStyle: 'ponytail',
  headband: null,
  wristband: null,
  kneePads: '#FFFFFF',
};

/**
 * Bir oyuncunun görünüm ayarlarını varsayılanlarla birleştirir.
 * @param {Player} data
 * @returns {Appearance}
 */
export function getAppearance(data) {
  return { ...DEFAULT_APPEARANCE, ...(data?.appearance ?? {}) };
}

/** @type {Player[]} */
export const ROSTER = [
  {
    id: 'eda-erdem',
    name: 'Eda Erdem',
    number: 4,
    position: POSITIONS.ORTA,
    captain: true,
    height: 187,
    stats: { attack: 84, block: 93, serve: 80, defense: 82, speed: 74, stamina: 88 },
    colors: {
      primary: '#E30A17',
      secondary: '#FFFFFF',
      skin: '#E8B48C',
      hair: '#2B1B14',
      accent: '#FFD24A',
    },
    appearance: {
      hairStyle: 'ponytail',
      headband: '#FFD24A',
      wristband: '#FFFFFF',
      kneePads: '#FFFFFF',
    },
    bonus: {
      name: 'Kaptan Duruşu',
      description: 'Dengeli stat dağılımı, blokta %20 ek güç.',
    },
    modifiers: { blockPower: 1.2, bumpPower: 1.08, reach: 1.05 },
  },
  {
    id: 'melissa-vargas',
    name: 'Melissa Vargas',
    number: 99,
    position: POSITIONS.PASOR_CAPRAZI,
    captain: false,
    height: 193,
    stats: { attack: 98, block: 85, serve: 95, defense: 74, speed: 76, stamina: 86 },
    colors: {
      primary: '#E30A17',
      secondary: '#FFD24A',
      skin: '#C98A5E',
      hair: '#1A1008',
      accent: '#FFD24A',
    },
    appearance: {
      hairStyle: 'bun',
      headband: null,
      wristband: '#FFD24A',
      kneePads: '#1B1B2E',
    },
    bonus: {
      name: 'Top Sallama',
      description: 'Smaç çıkış hızı %25 daha yüksek.',
    },
    modifiers: { spikePower: 1.25, bumpPower: 1.05, speed: 0.96 },
  },
  {
    id: 'zehra-gunes',
    name: 'Zehra Güneş',
    number: 16,
    position: POSITIONS.ORTA,
    captain: false,
    height: 197,
    stats: { attack: 86, block: 95, serve: 78, defense: 76, speed: 72, stamina: 84 },
    colors: {
      primary: '#E30A17',
      secondary: '#FFFFFF',
      skin: '#EAC0A0',
      hair: '#3A2418',
      accent: '#9BE7FF',
    },
    appearance: {
      hairStyle: 'long',
      headband: '#9BE7FF',
      wristband: '#FFFFFF',
      kneePads: '#FFFFFF',
    },
    bonus: {
      name: 'Duvar',
      description: 'Geniş erişim alanı — file üstünde daha yüksek kademe.',
    },
    modifiers: { reach: 1.18, blockPower: 1.15, jump: 1.06, speed: 0.94 },
  },
  {
    id: 'ebrar-karakurt',
    name: 'Ebrar Karakurt',
    number: 10,
    position: POSITIONS.SMACOR,
    captain: false,
    height: 192,
    stats: { attack: 94, block: 82, serve: 88, defense: 78, speed: 84, stamina: 85 },
    colors: {
      primary: '#E30A17',
      secondary: '#00BFFF',
      skin: '#EFC7A6',
      hair: '#5FC2E8',
      accent: '#5FC2E8',
    },
    appearance: {
      hairStyle: 'short',
      headband: '#FFFFFF',
      wristband: '#00BFFF',
      kneePads: '#1B1B2E',
    },
    bonus: {
      name: 'Enerji Patlaması',
      description: 'Sultan Gücü barı %30 daha hızlı dolar.',
    },
    modifiers: { charge: 1.3, spikePower: 1.12, speed: 1.05 },
  },
  {
    id: 'cansu-ozbay',
    name: 'Cansu Özbay',
    number: 2,
    position: POSITIONS.PASOR,
    captain: false,
    height: 180,
    stats: { attack: 70, block: 74, serve: 82, defense: 86, speed: 92, stamina: 90 },
    colors: {
      primary: '#E30A17',
      secondary: '#FFFFFF',
      skin: '#E8B48C',
      hair: '#2B1B14',
      accent: '#B7F5C6',
    },
    appearance: {
      hairStyle: 'ponytail',
      headband: '#FFFFFF',
      wristband: '#FFFFFF',
      kneePads: null,
    },
    bonus: {
      name: 'Hızlı Tempo',
      description: 'En hızlı saha içi hareket ve yüksek sıçrama.',
    },
    modifiers: { speed: 1.22, jump: 1.1, spikePower: 0.9, bumpPower: 1.1 },
  },
  {
    id: 'gizem-orge',
    name: 'Gizem Örge',
    number: 7,
    position: POSITIONS.LIBERO,
    captain: false,
    height: 170,
    stats: { attack: 40, block: 45, serve: 72, defense: 97, speed: 95, stamina: 93 },
    colors: {
      primary: '#1B1B3A',
      secondary: '#FFD24A',
      skin: '#E8B48C',
      hair: '#241812',
      accent: '#FFD24A',
    },
    appearance: {
      hairStyle: 'braid',
      headband: '#FFD24A',
      wristband: '#FFD24A',
      kneePads: '#FFD24A',
    },
    bonus: {
      name: 'Kurtarış',
      description: 'Manşette üstün savunma; alçak toplara geniş erişim.',
    },
    modifiers: { bumpPower: 1.3, speed: 1.18, reach: 1.12, spikePower: 0.78, jump: 0.94 },
  },
  {
    id: 'hande-baladin',
    name: 'Hande Baladın',
    number: 11,
    position: POSITIONS.SMACOR,
    captain: false,
    height: 186,
    stats: { attack: 89, block: 80, serve: 86, defense: 84, speed: 86, stamina: 87 },
    colors: {
      primary: '#E30A17',
      secondary: '#FFFFFF',
      skin: '#EAC0A0',
      hair: '#4A2F1E',
      accent: '#FF9ED2',
    },
    appearance: {
      hairStyle: 'ponytail',
      headband: null,
      wristband: '#FF9ED2',
      kneePads: '#FFFFFF',
    },
    bonus: {
      name: 'Çapraz Plase',
      description: 'Dengeli hücum; vuruşlarda daha keskin açı.',
    },
    modifiers: { spikePower: 1.14, angle: 1.25, speed: 1.06 },
  },
];

/** Rakip takım — jenerik piksel görünüm, isimsiz. */
export const OPPONENT_TEMPLATE = {
  id: 'rakip',
  name: 'Rakip',
  number: 1,
  position: POSITIONS.SMACOR,
  captain: false,
  height: 188,
  stats: { attack: 86, block: 86, serve: 84, defense: 84, speed: 84, stamina: 86 },
  colors: {
    primary: '#2B3A8F',
    secondary: '#E8ECFF',
    skin: '#D9A57C',
    hair: '#22303F',
    accent: '#9BB0FF',
  },
  appearance: {
    hairStyle: 'short',
    headband: null,
    wristband: '#9BB0FF',
    kneePads: '#1B1B2E',
  },
  bonus: { name: '—', description: '—' },
  modifiers: {},
};

/**
 * Bir oyuncunun çarpan değerini döndürür; tanımlı değilse 1.
 * @param {Player} data
 * @param {string} key
 */
export function getModifier(data, key) {
  return data?.modifiers?.[key] ?? 1;
}

/**
 * id ile oyuncu bulur.
 * @param {string} id
 * @returns {Player | undefined}
 */
export function getPlayerById(id) {
  return ROSTER.find((player) => player.id === id);
}

/**
 * Mevkiye göre oyuncuları filtreler.
 * @param {string} position
 */
export function getPlayersByPosition(position) {
  return ROSTER.filter((player) => player.position === position);
}

/** Takım kaptanı. */
export function getCaptain() {
  return ROSTER.find((player) => player.captain);
}

export default ROSTER;
