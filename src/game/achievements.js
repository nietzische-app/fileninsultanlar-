/**
 * Rozetler — uzun vadeli hedefler.
 *
 * Her rozet, biriken rekorlar (`records`) ve biten maçın sonucu
 * (`result`) üzerinden saf bir koşulla tanımlanır. Motor ya da React
 * burada yok: `evaluateAchievements` girdi alır, açılan rozetlerin
 * id listesini döner.
 */

/**
 * @typedef {Object} Achievement
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {string} icon Tek karakterlik piksel simge
 * @property {(ctx: {records: object, result: object|null}) => boolean} earned
 */

/** @type {Achievement[]} */
export const ACHIEVEMENTS = [
  {
    id: 'first-win',
    label: 'İLK ZAFER',
    description: 'İlk maçını kazan.',
    icon: '★',
    earned: ({ records }) => records.wins >= 1,
  },
  {
    id: 'streak-3',
    label: 'SERİ BAŞI',
    description: 'Üst üste 3 maç kazan.',
    icon: '≡',
    earned: ({ records }) => records.bestWinStreak >= 3,
  },
  {
    id: 'wall',
    label: 'DUVAR',
    description: 'Tek maçta 8 blok yap.',
    icon: '▮',
    earned: ({ records }) => records.mostBlocks >= 8,
  },
  {
    id: 'libero',
    label: 'LİBERO RUHU',
    description: 'Tek maçta 8 kurtarış yap.',
    icon: '⤢',
    earned: ({ records }) => records.mostSaves >= 8,
  },
  {
    id: 'rally-25',
    label: 'NEFES KESEN RALLİ',
    description: '25 temaslık bir ralli oyna.',
    icon: '∞',
    earned: ({ records }) => records.longestRally >= 25,
  },
  {
    id: 'combo-5',
    label: 'RİTİM',
    description: '5 komboya ulaş.',
    icon: '♪',
    earned: ({ records }) => records.bestCombo >= 5,
  },
  {
    id: 'combo-10',
    label: 'SULTAN SERİSİ',
    description: '10 komboya ulaş.',
    icon: '♫',
    earned: ({ records }) => records.bestCombo >= 10,
  },
  {
    id: 'perfect-25',
    label: 'ZAMANLAMA USTASI',
    description: 'Toplam 25 tam vuruş yap.',
    icon: '◎',
    earned: ({ records }) => records.totalPerfects >= 25,
  },
  {
    id: 'tip-point',
    label: 'KURNAZ PLASE',
    description: 'Plase ile sayı kazan.',
    icon: '↓',
    earned: ({ records }) => records.tipPoints >= 1,
  },
  {
    id: 'cup',
    label: 'KUPA',
    description: 'Bir turnuvayı kazan.',
    icon: '♛',
    earned: ({ records }) => records.tournamentsWon >= 1,
  },
  {
    id: 'survivor-20',
    label: 'DİRENİŞÇİ',
    description: 'Hayatta kalmada 20 puana ulaş.',
    icon: '♥',
    earned: ({ records }) => records.bestSurvivalPoints >= 20,
  },
  {
    id: 'hard-win',
    label: 'ZORU BAŞAR',
    description: 'Zor seviyede bir maç kazan.',
    icon: '⚡',
    earned: ({ result }) =>
      result?.winner === 'home' &&
      result?.difficulty === 'ZOR' &&
      result?.campaign !== 'survival',
  },
];

/** @param {string} id */
export function getAchievement(id) {
  return ACHIEVEMENTS.find((a) => a.id === id) ?? null;
}

/**
 * Kazanılmış rozetlerin id listesini hesaplar.
 *
 * `result` yoksa (ör. ana menüde) yalnızca birikimli rekorlara bakan
 * rozetler değerlendirilir — maça bağlı olanlar sessizce elenir.
 *
 * @param {object} records
 * @param {object | null} [result]
 * @returns {string[]}
 */
export function evaluateAchievements(records, result = null) {
  const ctx = { records: records ?? {}, result };
  return ACHIEVEMENTS.filter((a) => {
    try {
      return a.earned(ctx) === true;
    } catch {
      // Eksik/bozuk kayıt rozetleri patlatmasın
      return false;
    }
  }).map((a) => a.id);
}

/**
 * Bu maçta yeni açılanları bulur.
 * @param {string[]} before Önceden açık olanlar
 * @param {string[]} after Şimdi açık olanlar
 * @returns {string[]}
 */
export function newlyUnlocked(before, after) {
  const had = new Set(before ?? []);
  return (after ?? []).filter((id) => !had.has(id));
}
