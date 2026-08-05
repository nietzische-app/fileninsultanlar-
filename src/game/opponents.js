/**
 * Rakip takımlar — kurgusal isimler ve kitler.
 * Forma renkleri ve hafif çarpanlarla çeşitlilik sağlar.
 */

import { OPPONENT_TEMPLATE } from './players.js';

/**
 * @typedef {Object} OpponentTeam
 * @property {string} id
 * @property {string} name
 * @property {string} shortName Skor tablosu için kısa ad
 * @property {{primary:string, secondary:string, skin:string, hair:string, accent:string}} colors
 * @property {Record<string, number>} [modifiers]
 * @property {string} blurb
 */

/** @type {OpponentTeam[]} */
export const OPPONENT_TEAMS = [
  {
    id: 'atlas',
    name: 'Atlas Fırtınası',
    shortName: 'ATLAS',
    colors: {
      primary: '#2B3A8F',
      secondary: '#E8ECFF',
      skin: '#D9A57C',
      hair: '#22303F',
      accent: '#9BB0FF',
    },
    modifiers: { blockPower: 1.08, spikePower: 1.02 },
    blurb: 'Sert blok, dengeli hücum.',
  },
  {
    id: 'adriyatik',
    name: 'Adriyatik',
    shortName: 'ADRİYA',
    colors: {
      primary: '#0B6E4F',
      secondary: '#E8FFF4',
      skin: '#C98A5E',
      hair: '#1A1008',
      accent: '#5EE4A8',
    },
    modifiers: { speed: 1.06, bumpPower: 1.08 },
    blurb: 'Çevik savunma, hızlı tempo.',
  },
  {
    id: 'nordik',
    name: 'Nordik Buz',
    shortName: 'NORDİK',
    colors: {
      primary: '#1C3D5A',
      secondary: '#F0F6FF',
      skin: '#E8C4A8',
      hair: '#4A3A2A',
      accent: '#A8D4FF',
    },
    modifiers: { reach: 1.08, jump: 1.06, speed: 0.96 },
    blurb: 'Uzun boy, yüksek blok hattı.',
  },
  {
    id: 'balkan',
    name: 'Balkan Ateşi',
    shortName: 'BALKAN',
    colors: {
      primary: '#8B1E1E',
      secondary: '#FFE8D6',
      skin: '#E0A878',
      hair: '#1A1008',
      accent: '#FF8A4C',
    },
    modifiers: { spikePower: 1.12, charge: 1.05, bumpPower: 0.96 },
    blurb: 'Agresif smaç, riskli savunma.',
  },
  {
    id: 'pasifik',
    name: 'Pasifik Dalga',
    shortName: 'PASİFİK',
    colors: {
      primary: '#0E4D6B',
      secondary: '#D6F4FF',
      skin: '#C9A07A',
      hair: '#2B1B14',
      accent: '#4CC9F0',
    },
    modifiers: { angle: 1.15, spikePower: 1.06, speed: 1.02 },
    blurb: 'Keskin açılar, plase smaç.',
  },
];

const HAIR = ['short', 'bun', 'ponytail', 'braid'];

/**
 * @param {string} id
 * @returns {OpponentTeam | undefined}
 */
export function getOpponentTeam(id) {
  return OPPONENT_TEAMS.find((team) => team.id === id);
}

/**
 * @param {() => number} [rand]
 * @returns {OpponentTeam}
 */
export function pickRandomOpponent(rand = Math.random) {
  const index = Math.floor(rand() * OPPONENT_TEAMS.length);
  return OPPONENT_TEAMS[index] ?? OPPONENT_TEAMS[0];
}

/**
 * Maç için away oyuncu verilerini üretir.
 * @param {OpponentTeam} team
 * @param {number} count
 */
export function buildAwayPlayers(team, count) {
  const numbers = count === 1 ? [9] : [7, 12];

  return Array.from({ length: count }, (_, i) => ({
    ...OPPONENT_TEMPLATE,
    id: `${team.id}-${i}`,
    name: team.name,
    number: numbers[i] ?? i + 1,
    colors: { ...team.colors },
    modifiers: { ...(OPPONENT_TEMPLATE.modifiers ?? {}), ...(team.modifiers ?? {}) },
    appearance: {
      ...OPPONENT_TEMPLATE.appearance,
      hairStyle: HAIR[i % HAIR.length],
      wristband: team.colors.accent,
      kneePads: '#1B1B2E',
    },
  }));
}
