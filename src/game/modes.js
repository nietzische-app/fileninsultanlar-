/**
 * Oyun modları — giriş ekranındaki üst seviye seçim.
 *
 * `campaign` alanı motora ve ekran akışına kadar taşınır:
 *   match      → tek maç (klasik akış)
 *   tournament → beş turluk kupa yolu (tournament.js)
 *   survival   → canlar bitene kadar süren tek zincir (survival.js)
 */

import { SURVIVAL } from './constants.js';
import { TOURNAMENT_ROUNDS } from './tournament.js';

/**
 * @typedef {Object} GameMode
 * @property {'match'|'tournament'|'survival'} id
 * @property {string} label
 * @property {string} tagline
 * @property {string} description
 * @property {boolean} pickOpponent Rakip/format seçimi oyuncuda mı
 */

// Rozet ve açıklamalardaki sayılar ayarlardan türetilir; elle yazılsaydı
// can sayısı ya da tur sayısı değiştiğinde menü sessizce yalan söylerdi.
const ROUNDS = TOURNAMENT_ROUNDS.length;

/** @type {GameMode[]} */
export const GAME_MODES = [
  {
    id: 'match',
    label: 'HIZLI MAÇ',
    tagline: 'TEK MAÇ',
    description: 'Rakibi, formatı ve zorluğu sen seç. Klasik dostluk maçı.',
    pickOpponent: true,
  },
  {
    id: 'tournament',
    label: 'TURNUVA',
    tagline: 'KUPA YOLU',
    description: `${ROUNDS} tur, ${ROUNDS} rakip. Tek yenilgi eler; finali geçen kupayı kaldırır.`,
    pickOpponent: false,
  },
  {
    id: 'survival',
    label: 'HAYATTA KALMA',
    tagline: `${SURVIVAL.lives} CAN`,
    description: `Set yok, bitiş yok. Her sayı bir puan, her kayıp bir can. ${SURVIVAL.waveLength} puanda bir dalga sertleşir.`,
    pickOpponent: false,
  },
];

/** @param {string} id */
export function getGameMode(id) {
  return GAME_MODES.find((mode) => mode.id === id) ?? GAME_MODES[0];
}
