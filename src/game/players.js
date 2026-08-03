/**
 * Filenin Sultanları kadro verisi.
 *
 * Bu dosya oyunun "veri katmanı"dır — motor (Game.js) buradaki
 * nesneleri okuyup sahaya çizer. Yeni oyuncu eklemek için ROSTER
 * dizisine aynı şekilde bir nesne eklemen yeterli.
 *
 * Statlar 0–100 arası ölçeklenmiştir ve oyun dengesi içindir;
 * gerçek sporcu performansının bir ölçüsü değildir. Forma numaraları
 * da örnek değerlerdir, güncel kadroya göre düzenleyebilirsin.
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
 * @typedef {Object} PlayerStats
 * @property {number} attack   Smaç gücü
 * @property {number} block    Blok
 * @property {number} serve    Servis
 * @property {number} defense  Savunma / manşet
 * @property {number} speed    Saha içi hareket hızı
 * @property {number} stamina  Dayanıklılık
 */

/**
 * @typedef {Object} Player
 * @property {string} id
 * @property {string} name
 * @property {number} number         Forma numarası
 * @property {string} position       POSITIONS değerlerinden biri
 * @property {boolean} captain
 * @property {number} height         cm
 * @property {PlayerStats} stats
 * @property {{primary: string, secondary: string, skin: string, hair: string}} colors
 * @property {string} signature      Oyuncuya özel hamle (ileride yetenek sistemi için)
 */

/** @type {Player[]} */
export const ROSTER = [
  {
    id: 'eda-erdem',
    name: 'Eda Erdem',
    number: 4,
    position: POSITIONS.ORTA,
    captain: true,
    height: 187,
    stats: {
      attack: 84,
      block: 93,
      serve: 80,
      defense: 82,
      speed: 74,
      stamina: 88,
    },
    colors: {
      primary: '#E30A17', // forma
      secondary: '#FFFFFF', // şort / detay
      skin: '#E8B48C',
      hair: '#2B1B14',
    },
    signature: 'Kaptan Blok',
  },
  {
    id: 'melissa-vargas',
    name: 'Melissa Vargas',
    number: 99,
    position: POSITIONS.PASOR_CAPRAZI,
    captain: false,
    height: 193,
    stats: {
      attack: 98,
      block: 85,
      serve: 95,
      defense: 74,
      speed: 76,
      stamina: 86,
    },
    colors: {
      primary: '#E30A17',
      secondary: '#FFD700',
      skin: '#C98A5E',
      hair: '#1A1008',
    },
    signature: 'Top Sallama',
  },
  {
    id: 'zehra-gunes',
    name: 'Zehra Güneş',
    number: 16,
    position: POSITIONS.ORTA,
    captain: false,
    height: 197,
    stats: {
      attack: 86,
      block: 95,
      serve: 78,
      defense: 76,
      speed: 72,
      stamina: 84,
    },
    colors: {
      primary: '#E30A17',
      secondary: '#FFFFFF',
      skin: '#EAC0A0',
      hair: '#3A2418',
    },
    signature: 'Duvar',
  },
  {
    id: 'ebrar-karakurt',
    name: 'Ebrar Karakurt',
    number: 10,
    position: POSITIONS.SMACOR,
    captain: false,
    height: 192,
    stats: {
      attack: 94,
      block: 82,
      serve: 88,
      defense: 78,
      speed: 84,
      stamina: 85,
    },
    colors: {
      primary: '#E30A17',
      secondary: '#00BFFF',
      skin: '#EFC7A6',
      hair: '#5FC2E8', // ikonik mavi saç
    },
    signature: 'Çapraz Bomba',
  },
  {
    id: 'cansu-ozbay',
    name: 'Cansu Özbay',
    number: 2,
    position: POSITIONS.PASOR,
    captain: false,
    height: 180,
    stats: {
      attack: 70,
      block: 74,
      serve: 82,
      defense: 86,
      speed: 92,
      stamina: 90,
    },
    colors: {
      primary: '#E30A17',
      secondary: '#FFFFFF',
      skin: '#E8B48C',
      hair: '#2B1B14',
    },
    signature: 'Hızlı Pas',
  },
  {
    id: 'gizem-orge',
    name: 'Gizem Örge',
    number: 7,
    position: POSITIONS.LIBERO,
    captain: false,
    height: 170,
    stats: {
      attack: 40,
      block: 45,
      serve: 72,
      defense: 97,
      speed: 95,
      stamina: 93,
    },
    colors: {
      primary: '#1B1B3A', // libero farklı forma
      secondary: '#FFD700',
      skin: '#E8B48C',
      hair: '#241812',
    },
    signature: 'Kurtarış',
  },
  {
    id: 'hande-baladin',
    name: 'Hande Baladın',
    number: 11,
    position: POSITIONS.SMACOR,
    captain: false,
    height: 186,
    stats: {
      attack: 89,
      block: 80,
      serve: 86,
      defense: 84,
      speed: 86,
      stamina: 87,
    },
    colors: {
      primary: '#E30A17',
      secondary: '#FFFFFF',
      skin: '#EAC0A0',
      hair: '#4A2F1E',
    },
    signature: 'Plase',
  },
];

/** Sahaya ilk çıkan altılı (rotasyon 1 → 6). */
export const STARTING_SIX = [
  'cansu-ozbay',
  'melissa-vargas',
  'zehra-gunes',
  'ebrar-karakurt',
  'eda-erdem',
  'hande-baladin',
];

/**
 * Sahadaki 6 oyuncunun başlangıç koordinatları (0–1 aralığında oransal).
 * Game.js bunları saha ölçüleriyle çarparak piksele çevirir.
 *
 *   x → fileye uzaklık: 0 = dip çizgi, 1 = file
 *   y → derinlik (yan görünüşte ekrana doğru): 0 = uzak, 1 = yakın
 *
 * Uzaktaki oyuncu daha yukarıda ve daha küçük çizilir (sahte perspektif).
 * Ön sıra (file yakını) x ≥ 0.6, arka sıra x ≤ 0.5 olacak şekilde dizildi.
 */
export const FORMATION = {
  // Ön sıra
  'zehra-gunes': { x: 0.78, y: 0.3 },
  'melissa-vargas': { x: 0.9, y: 0.58 },
  'ebrar-karakurt': { x: 0.63, y: 0.86 },
  // Arka sıra
  'cansu-ozbay': { x: 0.46, y: 0.18 },
  'eda-erdem': { x: 0.26, y: 0.62 },
  'hande-baladin': { x: 0.1, y: 0.95 },
};

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
 * @param {string} position POSITIONS değerlerinden biri
 * @returns {Player[]}
 */
export function getPlayersByPosition(position) {
  return ROSTER.filter((player) => player.position === position);
}

/** Takım kaptanı. */
export function getCaptain() {
  return ROSTER.find((player) => player.captain);
}

export default ROSTER;
