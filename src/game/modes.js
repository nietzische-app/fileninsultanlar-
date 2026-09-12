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
 * @property {boolean} [online] Röle üzerinden mi oynanıyor
 * @property {boolean} [hizli] Kadro ekranı ve lobi atlanıp doğrudan eşleşilsin mi
 */

// Rozet ve açıklamalardaki sayılar ayarlardan türetilir; elle yazılsaydı
// can sayısı ya da tur sayısı değiştiğinde menü sessizce yalan söylerdi.
const ROUNDS = TOURNAMENT_ROUNDS.length;

/** @type {GameMode[]} */
export const GAME_MODES = [
  {
    /*
     * HEMEN OYNA — menüdeki ilk düğme ve tek dokunuşta maç.
     *
     * Eskiden çevrimiçi oynamak beş adımdı: ÇEVRİMİÇİ → kadro seç →
     * ODA KUR → lobi → HIZLI EŞLEŞ. Rakip aramak en sık istenen şeydi
     * ama en derine gömülmüştü; oyunu ilk açan biri o düğmeye hiç
     * varamadan vazgeçiyordu.
     *
     * `hizli: true` iki şeyi birden atlıyor: kadro ekranı (kayıtlı
     * kadroyla girilir, isteyen KADRONU SEÇ'ten değiştirir) ve lobi
     * seçimi (eşleşme kendiliğinden başlar).
     */
    id: 'hemen',
    campaign: 'match',
    label: 'HEMEN OYNA',
    tagline: 'RAKİP BUL',
    description: 'Tek dokunuş. Sunucu seni bekleyen bir oyuncuyla eşleştirir.',
    pickOpponent: true,
    playMode: 'vs',
    online: true,
    hizli: true,
  },
  {
    /*
     * Çevrimiçi, "karşılıklı"nın uzaktan oynananı: motor açısından
     * ikisi de `vs` — 1. yuva Türkiye'de, 2. yuva rakip takımda. Fark
     * yalnızca 2. yuvanın tuşlarının nereden geldiği. Bu yüzden ayrı
     * bir oyun modu değil, aynı modun ağ üzerinden hâli.
     *
     * Röle adresi tanımlı değilse menüde hiç görünmez (App bunu
     * `onlineAcik()` ile eliyor) — çalışmayan bir düğme göstermek,
     * basılana kadar süren bir yalan olurdu.
     */
    id: 'online',
    campaign: 'match',
    label: 'ARKADAŞLA OYNA',
    tagline: 'ODA KODU',
    description:
      'Tanıdığın biriyle. Biri oda açar, diğeri kodu girer.',
    pickOpponent: true,
    playMode: 'vs',
    online: true,
  },
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

/**
 * Aynı cihazda iki insan mı oynuyor?
 *
 * Çevrimiçi maç motor açısından `vs` olsa da oyuncular ayrı cihazlarda
 * ve her biri kendi tuş takımını kullanır. `agRol` doluysa bu yerel
 * eşleşme değildir — dokunmatik tuşlar tek takım olarak kalmalı.
 *
 * Yerel Co-Op/VS'te tuşları gizlemek, telefonda o modlara giren
 * oyuncuyu sahaya tuşsuz bırakıyordu. Çift takımın ölçütü bu.
 *
 * @param {string} [playMode]
 * @param {string|null} [agRol]
 */
export function yerelCift(playMode, agRol) {
  return !agRol && (playMode === 'coop' || playMode === 'vs');
}
