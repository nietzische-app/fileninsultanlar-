/**
 * Yerel tercih ve rekor saklama.
 * Tarayıcı localStorage kullanır; yazma başarısız olursa sessizce yoksayılır.
 */

const PREFS_KEY = 'filenin-sultanlari-prefs';
const RECORDS_KEY = 'filenin-sultanlari-records';
const TOURNAMENT_KEY = 'filenin-sultanlari-tournament';

/** @typedef {{ muted: boolean, mode: string, difficulty: string, format: string, opponentId: string, homeIds: string[], tutorialSeen: boolean }} Prefs */

/**
 * @typedef {{
 *   wins: number,
 *   losses: number,
 *   matchesPlayed: number,
 *   longestRally: number,
 *   mostSpikes: number,
 *   mostBlocks: number,
 *   mostSaves: number,
 *   winStreak: number,
 *   bestWinStreak: number,
 *   tournamentsWon: number,
 *   bestTournamentRound: number,
 *   bestSurvivalPoints: number,
 *   bestSurvivalWave: number,
 * }} Records
 */

/** @type {Prefs} */
export const DEFAULT_PREFS = {
  muted: false,
  mode: '1v1',
  difficulty: 'normal',
  format: 'classic',
  opponentId: 'random',
  homeIds: ['gizem-orge'],
  tutorialSeen: false,
};

/** @type {Records} */
export const DEFAULT_RECORDS = {
  wins: 0,
  losses: 0,
  matchesPlayed: 0,
  longestRally: 0,
  mostSpikes: 0,
  mostBlocks: 0,
  mostSaves: 0,
  winStreak: 0,
  bestWinStreak: 0,
  tournamentsWon: 0,
  /** Turnuvada ulaşılan en ileri tur (1 = 1. tur, 5 = final). */
  bestTournamentRound: 0,
  bestSurvivalPoints: 0,
  bestSurvivalWave: 0,
};

/**
 * @returns {Prefs}
 */
export function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS, homeIds: [...DEFAULT_PREFS.homeIds] };

    const parsed = JSON.parse(raw);
    const homeIds = Array.isArray(parsed.homeIds) && parsed.homeIds.length > 0
      ? parsed.homeIds.filter((id) => typeof id === 'string')
      : [...DEFAULT_PREFS.homeIds];

    return {
      muted: Boolean(parsed.muted),
      mode: parsed.mode === '2v2' ? '2v2' : '1v1',
      difficulty: ['kolay', 'normal', 'zor', 'easy', 'hard'].includes(parsed.difficulty)
        ? ({ easy: 'kolay', hard: 'zor' }[parsed.difficulty] ?? parsed.difficulty)
        : DEFAULT_PREFS.difficulty,
      format: ['classic', 'single', 'practice'].includes(parsed.format)
        ? parsed.format
        : DEFAULT_PREFS.format,
      opponentId: typeof parsed.opponentId === 'string' ? parsed.opponentId : DEFAULT_PREFS.opponentId,
      homeIds,
      tutorialSeen: Boolean(parsed.tutorialSeen),
    };
  } catch {
    return { ...DEFAULT_PREFS, homeIds: [...DEFAULT_PREFS.homeIds] };
  }
}

/**
 * @param {Partial<Prefs>} partial
 * @returns {Prefs}
 */
export function savePrefs(partial) {
  const next = { ...loadPrefs(), ...partial };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    // private mode / quota — tercih kaybolabilir, oyun devam eder
  }
  return next;
}

/**
 * @returns {Records}
 */
export function loadRecords() {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return { ...DEFAULT_RECORDS };

    const parsed = JSON.parse(raw);
    return {
      wins: num(parsed.wins),
      losses: num(parsed.losses),
      matchesPlayed: num(parsed.matchesPlayed),
      longestRally: num(parsed.longestRally),
      mostSpikes: num(parsed.mostSpikes),
      mostBlocks: num(parsed.mostBlocks),
      mostSaves: num(parsed.mostSaves),
      winStreak: num(parsed.winStreak),
      bestWinStreak: num(parsed.bestWinStreak),
      // Yeni modlar eski kayıtlarda yok — eksik alanlar 0'a düşer
      tournamentsWon: num(parsed.tournamentsWon),
      bestTournamentRound: num(parsed.bestTournamentRound),
      bestSurvivalPoints: num(parsed.bestSurvivalPoints),
      bestSurvivalWave: num(parsed.bestSurvivalWave),
    };
  } catch {
    return { ...DEFAULT_RECORDS };
  }
}

/**
 * @param {Records} records
 * @returns {Records}
 */
export function saveRecords(records) {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch {
    // ignore
  }
  return records;
}

/**
 * Maç sonucunu rekorlara işler.
 * Antrenman formatı galibiyet/seri tablosunu şişirmesin diye
 * yalnızca ralli/smaç gibi kişisel zirveleri günceller.
 * @param {{ winner: string, format?: string, stats?: { spikes?: number, blocks?: number, saves?: number, longestRally?: number } }} result
 * @returns {{ records: Records, broken: Record<string, boolean> }}
 */
export function recordMatchResult(result) {
  const prev = loadRecords();

  // Hayatta kalma bir maç değil: galibiyeti yok, kaybı seri bozmamalı.
  // Yanlış kapıdan girerse sessizce doğru kapıya yönlendir.
  if (result?.campaign === 'survival') {
    return recordSurvivalResult(result);
  }

  const won = result.winner === 'home';
  const practice = result.format === 'practice';
  const stats = result.stats ?? {};

  const spikes = num(stats.spikes);
  const blocks = num(stats.blocks);
  const saves = num(stats.saves);
  const rally = num(stats.longestRally);
  const nextStreak = !practice && won ? prev.winStreak + 1 : practice ? prev.winStreak : 0;

  const next = {
    wins: prev.wins + (!practice && won ? 1 : 0),
    losses: prev.losses + (!practice && !won ? 1 : 0),
    matchesPlayed: prev.matchesPlayed + (practice ? 0 : 1),
    longestRally: Math.max(prev.longestRally, rally),
    mostSpikes: Math.max(prev.mostSpikes, spikes),
    mostBlocks: Math.max(prev.mostBlocks, blocks),
    mostSaves: Math.max(prev.mostSaves, saves),
    winStreak: practice ? prev.winStreak : nextStreak,
    bestWinStreak: practice
      ? prev.bestWinStreak
      : Math.max(prev.bestWinStreak, nextStreak),
  };

  const broken = {
    longestRally: rally > prev.longestRally && rally > 0,
    mostSpikes: spikes > prev.mostSpikes && spikes > 0,
    mostBlocks: blocks > prev.mostBlocks && blocks > 0,
    mostSaves: saves > prev.mostSaves && saves > 0,
    bestWinStreak: !practice && won && nextStreak > prev.bestWinStreak,
    firstWin: !practice && won && prev.wins === 0,
  };

  saveRecords(next);
  return { records: next, broken };
}

/**
 * Hayatta kalma koşusunu rekorlara işler.
 *
 * Galibiyet/mağlubiyet tablosuna dokunmaz — koşu her zaman yenilgiyle
 * biter, onu kayıp saymak galibiyet serisini anlamsızca sıfırlardı.
 * Ralli/smaç gibi kişisel zirveler burada da geçerlidir.
 *
 * @param {{ survival?: {points?: number, wave?: number, bestWave?: number}, stats?: object }} result
 * @returns {{ records: Records, broken: Record<string, boolean> }}
 */
export function recordSurvivalResult(result) {
  const prev = loadRecords();
  const stats = result?.stats ?? {};
  const run = result?.survival ?? {};

  const points = num(run.points);
  const wave = num(run.bestWave ?? run.wave);
  const spikes = num(stats.spikes);
  const blocks = num(stats.blocks);
  const saves = num(stats.saves);
  const rally = num(stats.longestRally);

  const next = {
    ...prev,
    longestRally: Math.max(prev.longestRally, rally),
    mostSpikes: Math.max(prev.mostSpikes, spikes),
    mostBlocks: Math.max(prev.mostBlocks, blocks),
    mostSaves: Math.max(prev.mostSaves, saves),
    bestSurvivalPoints: Math.max(prev.bestSurvivalPoints, points),
    bestSurvivalWave: Math.max(prev.bestSurvivalWave, wave),
  };

  const broken = {
    longestRally: rally > prev.longestRally && rally > 0,
    mostSpikes: spikes > prev.mostSpikes && spikes > 0,
    mostBlocks: blocks > prev.mostBlocks && blocks > 0,
    mostSaves: saves > prev.mostSaves && saves > 0,
    bestSurvivalPoints: points > prev.bestSurvivalPoints && points > 0,
    bestSurvivalWave: wave > prev.bestSurvivalWave && wave > 0,
  };

  saveRecords(next);
  return { records: next, broken };
}

/**
 * Turnuvanın kapanışını işler (kupa ya da elenme).
 * Tur maçlarının kendi sonuçları zaten `recordMatchResult` ile
 * işlendi; burada yalnızca turnuva geneli kaydedilir.
 *
 * @param {{ status?: string, results?: Array<{won: boolean}> }} state
 * @returns {{ records: Records, broken: Record<string, boolean> }}
 */
export function recordTournamentResult(state) {
  const prev = loadRecords();
  const champion = state?.status === 'won';
  const wins = Array.isArray(state?.results)
    ? state.results.filter((r) => r.won).length
    : 0;
  // Ulaşılan tur: kazanılan tur sayısı + (elendiyse oynadığı son tur)
  const reached = champion ? wins : wins + 1;

  const next = {
    ...prev,
    tournamentsWon: prev.tournamentsWon + (champion ? 1 : 0),
    bestTournamentRound: Math.max(prev.bestTournamentRound, reached),
  };

  const broken = {
    tournamentWon: champion,
    bestTournamentRound: reached > prev.bestTournamentRound && reached > 0,
  };

  saveRecords(next);
  return { records: next, broken };
}

/**
 * Yarım kalan turnuvayı saklar — sekme kapanırsa kupa yolu kaybolmasın.
 * @param {object | null} state null verilirse kayıt silinir
 */
export function saveTournament(state) {
  try {
    if (!state || state.status !== 'active') {
      localStorage.removeItem(TOURNAMENT_KEY);
      return null;
    }
    localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
  return state;
}

/**
 * Saklanan turnuvayı okur. Bozuk/eski kayıt null döner.
 * @returns {object | null}
 */
export function loadTournament() {
  try {
    const raw = localStorage.getItem(TOURNAMENT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || parsed.status !== 'active') return null;
    if (!Array.isArray(parsed.homeIds) || parsed.homeIds.length === 0) return null;
    if (!Number.isInteger(parsed.roundIndex) || parsed.roundIndex < 0) return null;

    return {
      ...parsed,
      results: Array.isArray(parsed.results) ? parsed.results : [],
    };
  } catch {
    return null;
  }
}

/** Saklanan turnuvayı siler. */
export function clearTournament() {
  try {
    localStorage.removeItem(TOURNAMENT_KEY);
  } catch {
    // ignore
  }
}

/** @param {unknown} value */
function num(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
