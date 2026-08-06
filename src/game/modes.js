/**
 * Oyun modları — giriş ekranındaki üst seviye seçim.
 *
 * `campaign` alanı motora ve ekran akışına kadar taşınır:
 *   match      → tek maç (klasik akış)
 *   tournament → beş turluk kupa yolu (tournament.js)
 *   survival   → canlar bitene kadar süren tek zincir (survival.js)
 *
 * `playMode` kaç kişinin oynadığını söyler ve motora geçer:
 *   solo → tek oyuncu
 *   coop → iki oyuncu aynı takımda (2v2)
 *   vs   → iki oyuncu karşılıklı
 */

import { SURVIVAL } from './constants.js';
import { TOURNAMENT_ROUNDS } from './tournament.js';

/**
 * @typedef {Object} GameMode
 * @property {string} id
 * @property {'match'|'tournament'|'survival'} campaign
 * @property {string} label
 * @property {string} tagline
 * @property {string} description
 * @property {boolean} pickOpponent Rakip/format seçimi oyuncuda mı
 * @property {'solo'|'coop'|'vs'} [playMode]
 * @property {boolean} [twoPlayer] Tek klavyede iki kişi mi
 */

// Rozet ve açıklamalardaki sayılar ayarlardan türetilir; elle yazılsaydı
// can sayısı ya da tur sayısı değiştiğinde menü sessizce yalan söylerdi.
const ROUNDS = TOURNAMENT_ROUNDS.length;

/** @type {GameMode[]} */
export const GAME_MODES = [
  {
    id: 'match',
    campaign: 'match',
    playMode: 'solo',
    label: 'HIZLI MAÇ',
    tagline: 'TEK MAÇ',
    description: 'Rakibi, formatı ve zorluğu sen seç. Klasik dostluk maçı.',
    pickOpponent: true,
  },
  {
    id: 'tournament',
    campaign: 'tournament',
    playMode: 'solo',
    label: 'TURNUVA',
    tagline: 'KUPA YOLU',
    description: `${ROUNDS} tur, ${ROUNDS} rakip. Tek yenilgi eler; finali geçen kupayı kaldırır.`,
    pickOpponent: false,
  },
  {
    id: 'coop',
    campaign: 'match',
    label: 'CO-OP',
    tagline: '2 KİŞİ',
    description:
      'İki kişi aynı takımda, tek klavyede. 1. oyuncu WASD, 2. oyuncu ok tuşları.',
    pickOpponent: true,
    playMode: 'coop',
    twoPlayer: true,
  },
  {
    id: 'versus',
    campaign: 'match',
    label: 'KARŞILIKLI',
    tagline: 'VS',
    description:
      'İki kişi karşı karşıya. 1. oyuncu Türkiye, 2. oyuncu rakip takım.',
    pickOpponent: true,
    playMode: 'vs',
    twoPlayer: true,
  },
  {
    id: 'survival',
    campaign: 'survival',
    playMode: 'solo',
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
