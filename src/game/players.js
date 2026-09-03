/**
 * Filenin Sultanları kadro verisi.
 *
 * Oyunun veri katmanı — motor (Game.js) ve React ekranları buradaki
 * nesneleri okur. Yeni oyuncu eklemek için ROSTER dizisine aynı
 * şekilde bir nesne eklemek yeterli.
 *
 * Forma numarası, mevki, doğum tarihi, boy ve kilo gerçek kadro
 * bilgisidir. Statlar ve bonuslar ise OYUN DENGESİ İÇİNDİR: mevki ve
 * fiziksel özelliklerden türetilmiş kurgusal değerlerdir, gerçek sporcu
 * performansının ölçüsü değildir.
 *
 * Stat türetme yaklaşımı (bkz. tablo aşağıda):
 *   - Mevki taban profili belirler (libero savunma, orta oyuncu blok...)
 *   - Boy blok ve erişimi yukarı, yatay hızı aşağı çeker
 *   - Hafif oyuncular hız/sıçrama, ağır oyuncular güç tarafında
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
 *   angle       → hücum vuruşunun açı genişliği
 */

/**
 * Görünüm (appearance) sözleşmesi.
 *
 * Oyunda tek bir harici görsel dosyası yoktur — her karakter
 * `src/game/sprites.js` içinde Canvas API ile piksel piksel çizilir.
 * Aşağıdaki alanlar o çizimi kod seviyesinde özelleştirir:
 *
 *   hairStyle  Saç modeli — bkz. HAIR_STYLES
 *   headband   Kafa bandı rengi — null ise takılmaz
 *   wristband  Bileklik rengi — null ise takılmaz
 *   kneePads   Dizlik rengi — null ise takılmaz
 *   necklace   Kolye rengi — null ise takılmaz
 *   earring    Küpe rengi — null ise takılmaz
 *   tattoos    Kol dövmeleri (piksel lekeler)
 *
 * Saç rengi `colors.hair`, forma numarası `number` alanından gelir.
 * Kaptan pazıbandı `captain: true` olan oyuncuya otomatik çizilir
 * (rengi `colors.accent`).
 *
 * Not: saç modeli/rengi ve aksesuarlar stilize tercihlerdir, gerçek
 * görünümü yansıtma iddiası taşımaz — istediğin gibi değiştirebilirsin.
 *
 * @typedef {Object} Appearance
 * @property {string} hairStyle
 * @property {string|null} headband
 * @property {string|null} wristband
 * @property {string|null} kneePads
 * @property {string|null} [necklace]
 * @property {string|null} [earring]
 * @property {boolean} [tattoos]
 */

/**
 * @typedef {Object} Player
 * @property {string} id
 * @property {string} name
 * @property {number} number Forma numarası (sprite üzerine çizilir)
 * @property {string} position
 * @property {boolean} captain
 * @property {boolean} [guest] Bonus kadro — özel eklenti oyuncular için
 *   ayrılmış bayrak. Şu an kimsede yok: Eda Erdem ve Ebrar Karakurt
 *   asıl kadroya alındı.
 * @property {string|null} birthDate ISO 'YYYY-MM-DD' — bilinmiyorsa null
 * @property {number|null} height cm — bilinmiyorsa null
 * @property {number|null} weight kg — bilinmiyorsa null
 * @property {{attack:number, block:number, serve:number, defense:number, speed:number, stamina:number}} stats
 * @property {{primary:string, secondary:string, skin:string, hair:string, accent:string}} colors
 * @property {Appearance} appearance
 * @property {{name:string, description:string}} bonus
 * @property {Record<string, number>} modifiers
 */

/** Seçilebilir saç modelleri — yeni model eklerken sprites.js'i de güncelle. */
export const HAIR_STYLES = [
  'short',
  'short-spiky',
  'short-fade',
  'ponytail',
  'high-ponytail',
  'half-ponytail',
  'bun',
  'sleek-bun',
  'high-bun',
  'braided-bun',
  'long',
  'curly-long',
  'half-up',
  'braid',
];

/** Görünüm alanı eksikse kullanılan varsayılan. */
export const DEFAULT_APPEARANCE = {
  hairStyle: 'ponytail',
  headband: null,
  wristband: null,
  kneePads: '#FFFFFF',
  necklace: null,
  earring: null,
  tattoos: false,
};

/** Millî takım forması. */
const KIT = {
  primary: '#E30A17',
  secondary: '#FFFFFF',
};

/** Libero forması — kural gereği takım arkadaşlarından farklı renkte. */
const LIBERO_KIT = {
  primary: '#1B1B3A',
  secondary: '#FFD24A',
};

/** @type {Player[]} */
export const ROSTER = [
  {
    id: 'gizem-orge',
    name: 'Gizem Örge',
    number: 1,
    position: POSITIONS.LIBERO,
    captain: true,
    birthDate: '1993-04-26',
    height: 170,
    weight: 59,
    stats: { attack: 38, block: 42, serve: 72, defense: 97, speed: 95, stamina: 93 },
    colors: {
      ...LIBERO_KIT,
      skin: '#F8D5C2',
      hair: '#3D2314',
      accent: '#FFD24A',
    },
    appearance: {
      hairStyle: 'sleek-bun',
      headband: null,
      wristband: null,
      kneePads: '#FFD24A',
      necklace: null,
      earring: null,
      tattoos: false,
    },
    bonus: {
      name: 'Kurtarış',
      description: 'Manşette üstün savunma; alçak toplara geniş erişim.',
    },
    modifiers: { bumpPower: 1.3, speed: 1.18, reach: 1.12, spikePower: 0.78, jump: 0.94 },
  },
  {
    id: 'cansu-ozbay',
    name: 'Cansu Özbay',
    number: 3,
    position: POSITIONS.PASOR,
    captain: false,
    birthDate: '1996-10-17',
    height: 182,
    weight: 78,
    stats: { attack: 70, block: 76, serve: 82, defense: 86, speed: 92, stamina: 90 },
    colors: {
      ...KIT,
      skin: '#F8D5C2',
      hair: '#2B1D0C',
      accent: '#B7F5C6',
    },
    appearance: {
      hairStyle: 'sleek-bun',
      headband: null,
      wristband: null,
      kneePads: null,
      necklace: null,
      earring: null,
      tattoos: false,
    },
    bonus: {
      name: 'Hızlı Tempo',
      description: 'En hızlı saha içi hareket ve yüksek sıçrama.',
    },
    modifiers: { speed: 1.22, jump: 1.1, spikePower: 0.9, bumpPower: 1.1 },
  },
  {
    id: 'saliha-sahin',
    name: 'Saliha Şahin',
    number: 6,
    position: POSITIONS.SMACOR,
    captain: false,
    birthDate: '1998-11-05',
    height: 186,
    weight: 72,
    stats: { attack: 87, block: 80, serve: 84, defense: 82, speed: 85, stamina: 86 },
    colors: {
      ...KIT,
      skin: '#F8D5C2',
      hair: '#3B2219',
      accent: '#9BE7FF',
    },
    appearance: {
      hairStyle: 'bun',
      headband: null,
      wristband: null,
      kneePads: '#FFFFFF',
      necklace: null,
      earring: null,
      tattoos: false,
    },
    bonus: {
      name: 'Çift Yönlü',
      description: 'Hücum ve savunmada dengeli; manşette ek güç.',
    },
    modifiers: { spikePower: 1.08, bumpPower: 1.12, speed: 1.04 },
  },
  {
    id: 'hande-baladin',
    name: 'Hande Baladın',
    number: 7,
    position: POSITIONS.SMACOR,
    captain: false,
    birthDate: '1997-09-01',
    height: 190,
    weight: 78,
    stats: { attack: 90, block: 82, serve: 86, defense: 84, speed: 84, stamina: 87 },
    colors: {
      ...KIT,
      skin: '#F8D5C2',
      hair: '#2A1B0E',
      accent: '#FF9ED2',
    },
    appearance: {
      hairStyle: 'sleek-bun',
      headband: null,
      wristband: null,
      kneePads: '#FFFFFF',
      necklace: null,
      earring: null,
      tattoos: false,
    },
    bonus: {
      name: 'Çapraz Plase',
      description: 'Dengeli hücum; vuruşlarda daha keskin açı.',
    },
    modifiers: { spikePower: 1.14, angle: 1.25, speed: 1.04 },
  },
  {
    id: 'sinead-jack-kisal',
    name: 'Sinead Jack-Kısal',
    number: 8,
    position: POSITIONS.ORTA,
    captain: false,
    birthDate: '1993-11-08',
    height: 190,
    weight: 83,
    stats: { attack: 85, block: 92, serve: 78, defense: 76, speed: 74, stamina: 85 },
    colors: {
      ...KIT,
      skin: '#4A2E1B',
      hair: '#1A1A1A',
      accent: '#FFD24A',
    },
    appearance: {
      hairStyle: 'curly-long',
      headband: null,
      wristband: null,
      kneePads: '#1B1B2E',
      necklace: '#FFD24A',
      earring: null,
      tattoos: false,
    },
    bonus: {
      name: 'Tecrübeli Duvar',
      description: 'Blokta %22 ek güç ve geniş erişim.',
    },
    modifiers: { blockPower: 1.22, reach: 1.1, speed: 0.94 },
  },
  {
    id: 'eylul-akarcesme-yatgin',
    name: 'Eylül Akarçeşme Yatgın',
    number: 10,
    position: POSITIONS.LIBERO,
    captain: false,
    birthDate: '1999-10-01',
    height: 173,
    weight: 55,
    stats: { attack: 36, block: 40, serve: 70, defense: 94, speed: 96, stamina: 92 },
    colors: {
      ...LIBERO_KIT,
      skin: '#F8D5C2',
      hair: '#B8860B',
      accent: '#FFD24A',
    },
    appearance: {
      hairStyle: 'ponytail',
      headband: null,
      wristband: null,
      kneePads: '#FFD24A',
      necklace: null,
      earring: null,
      tattoos: false,
    },
    bonus: {
      name: 'Seri Refleks',
      description: 'Sahanın en hızlısı; dalışta geniş erişim.',
    },
    modifiers: { speed: 1.24, bumpPower: 1.2, reach: 1.08, spikePower: 0.75, jump: 0.96 },
  },
  {
    id: 'elif-sahin',
    name: 'Elif Şahin',
    number: 12,
    position: POSITIONS.PASOR,
    captain: false,
    birthDate: '2000-01-19',
    height: 189,
    weight: 68,
    stats: { attack: 74, block: 82, serve: 80, defense: 80, speed: 86, stamina: 88 },
    colors: {
      ...KIT,
      skin: '#F8D5C2',
      hair: '#3B2219',
      accent: '#C8B7FF',
    },
    appearance: {
      hairStyle: 'high-bun',
      headband: null,
      wristband: null,
      kneePads: '#FFFFFF',
      necklace: null,
      earring: null,
      tattoos: false,
    },
    bonus: {
      name: 'Uzun Pasör',
      description: 'Pasör hızı ile orta oyuncu erişimi bir arada.',
    },
    modifiers: { speed: 1.12, reach: 1.08, blockPower: 1.1, spikePower: 0.94 },
  },
  {
    id: 'dilay-ozdemir',
    name: 'Dilay Özdemir',
    number: 13,
    position: POSITIONS.PASOR,
    captain: false,
    birthDate: '2005-08-15',
    height: 188,
    weight: 58,
    stats: { attack: 68, block: 72, serve: 78, defense: 82, speed: 88, stamina: 86 },
    colors: {
      ...KIT,
      skin: '#F8D5C2',
      hair: '#4A311E',
      accent: '#A8E6CF',
    },
    appearance: {
      hairStyle: 'high-bun',
      headband: null,
      wristband: null,
      kneePads: '#FFFFFF',
      necklace: null,
      earring: null,
      tattoos: false,
    },
    bonus: {
      name: 'Sakin Dağıtım',
      description: 'İstikrarlı pas; manşette ve hızda dengeli.',
    },
    modifiers: { speed: 1.14, bumpPower: 1.08, spikePower: 0.9 },
  },
  {
    id: 'eda-erdem',
    name: 'Eda Erdem Dündar',
    number: 14,
    position: POSITIONS.ORTA,
    captain: false,
    birthDate: '1987-06-22',
    height: 188,
    weight: 75,
    stats: { attack: 88, block: 97, serve: 84, defense: 82, speed: 74, stamina: 90 },
    colors: {
      ...KIT,
      skin: '#F8D5C2',
      hair: '#7A5230',
      accent: '#FFD24A',
    },
    appearance: {
      hairStyle: 'long',
      headband: null,
      wristband: null,
      kneePads: '#1B1B2E',
      necklace: '#C0C0C0',
      earring: null,
      tattoos: false,
    },
    bonus: {
      name: 'Efsane Duvar',
      description: 'Blokta %24 güç; tecrübeyle geniş file erişimi.',
    },
    modifiers: { blockPower: 1.24, reach: 1.14, jump: 1.04, speed: 0.94 },
  },
  {
    id: 'deniz-uyanik',
    name: 'Deniz Uyanık',
    number: 15,
    position: POSITIONS.ORTA,
    captain: false,
    birthDate: '2001-06-25',
    height: 195,
    weight: 70,
    stats: { attack: 86, block: 93, serve: 76, defense: 74, speed: 76, stamina: 84 },
    colors: {
      ...KIT,
      skin: '#F8D5C2',
      hair: '#2B1B10',
      accent: '#FFB86B',
    },
    appearance: {
      hairStyle: 'high-ponytail',
      headband: null,
      wristband: null,
      kneePads: '#1B1B2E',
      necklace: '#E8E8E8',
      earring: null,
      tattoos: false,
    },
    bonus: {
      name: 'Yüksek Kademe',
      description: 'Uzun boyla file üstünde erişim ve blok üstünlüğü.',
    },
    modifiers: { blockPower: 1.18, reach: 1.14, jump: 1.06, speed: 0.94 },
  },
  {
    id: 'berka-buse-ozden',
    name: 'Berka Buse Özden',
    number: 16,
    position: POSITIONS.ORTA,
    captain: false,
    birthDate: '2004-04-16',
    height: 187,
    weight: 65,
    stats: { attack: 82, block: 88, serve: 74, defense: 76, speed: 82, stamina: 82 },
    colors: {
      ...KIT,
      skin: '#F8D5C2',
      hair: '#3D2314',
      accent: '#FFE066',
    },
    appearance: {
      hairStyle: 'high-ponytail',
      headband: null,
      wristband: null,
      kneePads: '#FFFFFF',
      necklace: null,
      earring: null,
      tattoos: false,
    },
    bonus: {
      name: 'Genç Enerji',
      description: 'Diri blok; file önünde toparlanması hızlı.',
    },
    /*
     * Sultan Gücü kaldırılınca `charge: 1.2` boşa düştü ve bu oyuncu
     * tek modifikatörle kalıyordu. Blok gücü telafi olarak yükseltildi
     * — kaldırılan bonusun yerine yenisi uydurulmadı, mevcut yönü
     * güçlendirildi.
     */
    modifiers: { blockPower: 1.24, jump: 1.06 },
  },
  {
    id: 'zehra-gunes',
    name: 'Zehra Güneş',
    number: 18,
    position: POSITIONS.ORTA,
    captain: false,
    birthDate: '1999-07-07',
    height: 198,
    weight: 80,
    stats: { attack: 87, block: 96, serve: 78, defense: 76, speed: 72, stamina: 85 },
    colors: {
      ...KIT,
      skin: '#F8D5C2',
      hair: '#3B2219',
      accent: '#E30A17',
    },
    appearance: {
      hairStyle: 'half-up',
      headband: null,
      wristband: '#E30A17',
      kneePads: '#FFFFFF',
      necklace: null,
      earring: null,
      tattoos: false,
    },
    bonus: {
      name: 'Duvar',
      description: 'Kadronun en uzunu — en geniş erişim, en sert blok.',
    },
    modifiers: { reach: 1.18, blockPower: 1.15, jump: 1.06, speed: 0.92 },
  },
  {
    id: 'yaprak-erkek',
    name: 'Yaprak Erkek',
    number: 20,
    position: POSITIONS.SMACOR,
    captain: false,
    birthDate: '2001-09-02',
    height: 182,
    weight: 60,
    stats: { attack: 84, block: 76, serve: 82, defense: 84, speed: 92, stamina: 86 },
    colors: {
      ...KIT,
      skin: '#F8D5C2',
      hair: '#2A1B0E',
      accent: '#B7F5C6',
    },
    appearance: {
      hairStyle: 'high-bun',
      headband: null,
      wristband: null,
      kneePads: '#FFFFFF',
      necklace: null,
      earring: null,
      tattoos: false,
    },
    bonus: {
      name: 'Hafif Ayak',
      description: 'Kadronun en çevik smaçörü; hızlı ve yüksek sıçrar.',
    },
    modifiers: { speed: 1.18, jump: 1.08 },
  },
  {
    id: 'ilkin-aydin',
    name: 'İlkin Aydın',
    number: 22,
    position: POSITIONS.SMACOR,
    captain: false,
    birthDate: '2000-01-05',
    height: 183,
    weight: 67,
    stats: { attack: 89, block: 78, serve: 88, defense: 82, speed: 88, stamina: 85 },
    colors: {
      ...KIT,
      skin: '#F8D5C2',
      hair: '#2B1D0C',
      accent: '#FF7A18',
    },
    appearance: {
      hairStyle: 'braided-bun',
      headband: null,
      wristband: null,
      kneePads: '#1B1B2E',
      necklace: null,
      earring: null,
      tattoos: false,
    },
    bonus: {
      name: 'Servis Ateşi',
      description: 'Sert servis ve smaç; bar hızlı dolar.',
    },
    modifiers: { spikePower: 1.16, speed: 1.08 },
  },
  {
    id: 'melissa-vargas',
    name: 'Melissa Vargas',
    number: 44,
    position: POSITIONS.PASOR_CAPRAZI,
    captain: false,
    birthDate: '1999-10-16',
    height: 194,
    weight: 76,
    stats: { attack: 98, block: 86, serve: 96, defense: 74, speed: 76, stamina: 86 },
    colors: {
      ...KIT,
      secondary: '#FFD24A',
      skin: '#7C5035',
      hair: '#111111',
      accent: '#FFD24A',
    },
    appearance: {
      hairStyle: 'short-fade',
      headband: null,
      wristband: null,
      kneePads: '#1B1B2E',
      necklace: '#FFD24A',
      earring: '#FFD24A',
      tattoos: true,
    },
    bonus: {
      name: 'Top Sallama',
      description: 'Smaç çıkış hızı %25 daha yüksek.',
    },
    modifiers: { spikePower: 1.25, bumpPower: 1.05, speed: 0.96 },
  },
  {
    id: 'defne-basyolcu',
    name: 'Defne Başyolcu',
    number: 91,
    position: POSITIONS.SMACOR,
    captain: false,
    birthDate: '2006-08-09',
    height: 193,
    weight: 71,
    stats: { attack: 82, block: 76, serve: 80, defense: 80, speed: 86, stamina: 84 },
    colors: {
      ...KIT,
      skin: '#F8D5C2',
      hair: '#4A3222',
      accent: '#FF9ED2',
    },
    appearance: {
      hairStyle: 'half-ponytail',
      headband: null,
      wristband: null,
      kneePads: '#FFFFFF',
      necklace: '#E8E8E8',
      earring: null,
      tattoos: false,
    },
    bonus: {
      name: 'Taze Kan',
      description: 'Çevik ve hevesli; bar biraz daha hızlı dolar.',
    },
    modifiers: { speed: 1.1, spikePower: 1.04 },
  },
  {
    id: 'ebrar-karakurt',
    name: 'Ebrar Karakurt',
    number: 99,
    position: POSITIONS.PASOR_CAPRAZI,
    captain: false,
    birthDate: '2000-01-17',
    height: 195,
    weight: 72,
    stats: { attack: 96, block: 80, serve: 90, defense: 72, speed: 80, stamina: 88 },
    colors: {
      ...KIT,
      skin: '#F8D5C2',
      hair: '#4A3525',
      accent: '#FF7A18',
    },
    appearance: {
      hairStyle: 'short-spiky',
      headband: null,
      wristband: null,
      kneePads: '#1B1B2E',
      necklace: null,
      earring: null,
      tattoos: true,
    },
    bonus: {
      name: 'Kara Kurt',
      description: 'Sert smaç; açılı bitiriş.',
    },
    modifiers: { spikePower: 1.22, angle: 1.12, bumpPower: 0.95 },
  },
];

/** Rakip takım — jenerik piksel görünüm, isimsiz. */
export const OPPONENT_TEMPLATE = {
  id: 'rakip',
  name: 'Rakip',
  number: 1,
  position: POSITIONS.SMACOR,
  captain: false,
  birthDate: null,
  height: 188,
  weight: 75,
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

/** Oyunun varsayılan olarak seçili getirdiği sultan — kaptan. */
export const DEFAULT_PLAYER_ID = 'gizem-orge';

/** Giriş ekranındaki vitrin kadrosu. */
export const SHOWCASE_IDS = ['gizem-orge', 'zehra-gunes', 'melissa-vargas'];

/**
 * Aktif kadro (bonus işaretli oyuncular hariç).
 *
 * Şu an tüm kadro aktif; bayrak ileride özel bir eklenti oyuncu
 * gerekirse diye duruyor.
 */
export function getActiveRoster() {
  return ROSTER.filter((player) => !player.guest);
}

/** Bonus kadro — şu an boş; `guest: true` işaretli oyuncu yok. */
export function getBonusRoster() {
  return ROSTER.filter((player) => player.guest);
}

/**
 * Bir oyuncunun görünüm ayarlarını varsayılanlarla birleştirir.
 * @param {Player} data
 * @returns {Appearance}
 */
export function getAppearance(data) {
  return { ...DEFAULT_APPEARANCE, ...(data?.appearance ?? {}) };
}

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

/** Takım kaptanı — kadro verisinde işaretli değilse undefined. */
export function getCaptain() {
  return ROSTER.find((player) => player.captain);
}

/**
 * Doğum tarihinden yaş hesaplar.
 * @param {Player} player
 * @param {Date} [now]
 * @returns {number | null} Tarih bilinmiyorsa null
 */
export function getAge(player, now = new Date()) {
  if (!player?.birthDate) return null;

  const born = new Date(player.birthDate);
  if (Number.isNaN(born.getTime())) return null;

  let age = now.getFullYear() - born.getFullYear();
  const monthDiff = now.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < born.getDate())) {
    age -= 1;
  }
  return age;
}

/**
 * Doğum tarihini Türkçe biçimde döndürür (GG.AA.YYYY).
 * @param {Player} player
 * @returns {string} Bilinmiyorsa '—'
 */
export function formatBirthDate(player) {
  if (!player?.birthDate) return '—';

  const [year, month, day] = player.birthDate.split('-');
  if (!year || !month || !day) return '—';
  return `${day}.${month}.${year}`;
}

export default ROSTER;
