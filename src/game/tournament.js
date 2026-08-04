/**
 * Turnuva (kupa yolu) — saf durum makinesi.
 *
 * Beş rakip takım, beş tur. Her tur tek maç: kaybedersen elenirsin,
 * kazanırsan bir üst tura çıkarsın. Turlar hem uzunluk hem de rakip
 * gücü olarak kademeli sertleşir; final tek maç değil, üç sette iki.
 *
 * Burada Game/React'e ait hiçbir şey yok — bütün geçişler saf
 * fonksiyon, dolayısıyla doğrudan test edilebilir.
 */

import { OPPONENT_TEAMS } from './opponents.js';

/**
 * Tur sıralaması rakip zorluğuna göre elle dizildi: hızlı ama hafif
 * takımlar önde, uzun blok hattı (Nordik) finalde.
 *
 * @typedef {Object} TournamentRound
 * @property {string} id
 * @property {string} label     Tur adı (kupa terminolojisi)
 * @property {string} opponentId
 * @property {string} format    FORMATS anahtarı
 * @property {object} rules     RULES üzerine yazılan alanlar
 * @property {number} ramp      scaleDifficulty adımı
 */

/** @type {TournamentRound[]} */
export const TOURNAMENT_ROUNDS = [
  {
    id: 'r1',
    label: '1. TUR',
    opponentId: 'adriyatik',
    format: 'single',
    rules: { setsToWin: 1, pointsPerSet: 11, pointCap: 15 },
    ramp: 0,
  },
  {
    id: 'r2',
    label: '2. TUR',
    opponentId: 'atlas',
    format: 'single',
    rules: { setsToWin: 1, pointsPerSet: 11, pointCap: 15 },
    ramp: 0.4,
  },
  {
    id: 'qf',
    label: 'ÇEYREK FİNAL',
    opponentId: 'pasifik',
    format: 'single',
    rules: { setsToWin: 1, pointsPerSet: 15, pointCap: 19 },
    ramp: 0.8,
  },
  {
    id: 'sf',
    label: 'YARI FİNAL',
    opponentId: 'balkan',
    format: 'single',
    rules: { setsToWin: 1, pointsPerSet: 15, pointCap: 19 },
    ramp: 1.2,
  },
  {
    id: 'final',
    label: 'FİNAL',
    opponentId: 'nordik',
    format: 'classic',
    rules: { setsToWin: 2, pointsPerSet: 15, pointCap: 21 },
    ramp: 1.6,
  },
];

/**
 * @typedef {Object} TournamentState
 * @property {'1v1'|'2v2'} mode
 * @property {string} difficulty
 * @property {string[]} homeIds
 * @property {number} roundIndex   Sıradaki turun indeksi
 * @property {Array<{roundId:string, opponentId:string, won:boolean, sets:{home:number,away:number}}>} results
 * @property {'active'|'won'|'lost'} status
 * @property {number} startedAt
 */

/**
 * @param {{mode?: string, difficulty?: string, homeIds?: string[]}} config
 * @returns {TournamentState}
 */
export function createTournament(config = {}) {
  return {
    mode: config.mode === '2v2' ? '2v2' : '1v1',
    difficulty: config.difficulty ?? 'normal',
    homeIds: [...(config.homeIds ?? [])],
    roundIndex: 0,
    results: [],
    status: 'active',
    startedAt: Date.now(),
  };
}

/**
 * Sıradaki tur — turnuva bittiyse null.
 * @param {TournamentState} state
 * @returns {TournamentRound | null}
 */
export function currentRound(state) {
  if (!state || state.status !== 'active') return null;
  return TOURNAMENT_ROUNDS[state.roundIndex] ?? null;
}

/**
 * Sıradaki tur için MatchScreen'e verilecek maç yapılandırması.
 * @param {TournamentState} state
 * @returns {object | null}
 */
export function roundMatchConfig(state) {
  const round = currentRound(state);
  if (!round) return null;

  return {
    campaign: 'tournament',
    mode: state.mode,
    difficulty: state.difficulty,
    format: round.format,
    rules: { ...round.rules },
    difficultyRamp: round.ramp,
    opponentId: round.opponentId,
    opponentRandom: false,
    homeIds: [...state.homeIds],
    roundId: round.id,
    roundLabel: round.label,
    roundNumber: state.roundIndex + 1,
    roundCount: TOURNAMENT_ROUNDS.length,
  };
}

/**
 * Bir tur maçının sonucunu işler.
 *
 * Kazanınca bir sonraki tura, son turu kazanınca kupaya; kaybedince
 * turnuva biter (`lost`). Elenmede `roundIndex` ilerletilmez ki bracket
 * ekranı hangi turda takıldığını gösterebilsin.
 *
 * @param {TournamentState} state
 * @param {{winner: string, sets?: {home:number, away:number}}} result
 * @returns {TournamentState} Yeni durum (girdi değiştirilmez)
 */
export function advanceTournament(state, result) {
  const round = currentRound(state);
  if (!round) return state;

  const won = result?.winner === 'home';
  const entry = {
    roundId: round.id,
    opponentId: round.opponentId,
    won,
    sets: {
      home: result?.sets?.home ?? 0,
      away: result?.sets?.away ?? 0,
    },
  };

  const results = [...state.results, entry];

  if (!won) {
    return { ...state, results, status: 'lost' };
  }

  const nextIndex = state.roundIndex + 1;
  return {
    ...state,
    results,
    roundIndex: nextIndex,
    status: nextIndex >= TOURNAMENT_ROUNDS.length ? 'won' : 'active',
  };
}

/**
 * Bracket çizimi için tur listesi + her turun durumu.
 * @param {TournamentState} state
 */
export function tournamentLadder(state) {
  return TOURNAMENT_ROUNDS.map((round, index) => {
    const result = state?.results?.[index] ?? null;
    let status = 'locked';

    if (result) status = result.won ? 'won' : 'lost';
    else if (state?.status === 'active' && index === state.roundIndex) status = 'current';

    return {
      ...round,
      index,
      status,
      result,
      opponent: OPPONENT_TEAMS.find((team) => team.id === round.opponentId) ?? null,
    };
  });
}

/**
 * Sonuç ekranı için özet.
 * @param {TournamentState} state
 */
export function tournamentSummary(state) {
  const results = state?.results ?? [];
  const wins = results.filter((r) => r.won).length;
  const champion = state?.status === 'won';

  // Oynanan son tur = results.length - 1. `currentRound` burada işe
  // yaramaz: turnuva kapandığında null döner ve elenen oyuncuya
  // "FİNAL turunda veda" yazdırırdı.
  const lastIndex = Math.min(
    Math.max(results.length - 1, 0),
    TOURNAMENT_ROUNDS.length - 1
  );

  return {
    wins,
    total: TOURNAMENT_ROUNDS.length,
    champion,
    /** Oynanan son turun adı — şampiyonlukta final. */
    lastRoundLabel: TOURNAMENT_ROUNDS[lastIndex].label,
  };
}
