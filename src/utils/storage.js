/**
 * Yerel tercih ve rekor saklama.
 * Tarayıcı localStorage kullanır; yazma başarısız olursa sessizce yoksayılır.
 */

const PREFS_KEY = 'filenin-sultanlari-prefs';
const RECORDS_KEY = 'filenin-sultanlari-records';

/** @typedef {{ muted: boolean, mode: string, playMode: string, difficulty: string, format: string, opponentId: string, homeIds: string[], awayIds: string[], tutorialSeen: boolean }} Prefs */

/**
 * @typedef {{
 *   wins: number,
 *   losses: number,
 *   matchesPlayed: number,
 *   longestRally: number,
 *   mostSpikes: number,
 *   mostBlocks: number,
 *   mostSaves: number,
 *   bestCombo: number,
 *   winStreak: number,
 *   bestWinStreak: number,
 * }} Records
 */

/** @type {Prefs} */
export const DEFAULT_PREFS = {
  muted: false,
  mode: '1v1',
  playMode: 'solo',
  difficulty: 'normal',
  format: 'classic',
  opponentId: 'random',
  homeIds: ['gizem-orge'],
  awayIds: ['melissa-vargas'],
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
  bestCombo: 0,
  winStreak: 0,
  bestWinStreak: 0,
};

/**
 * @returns {Prefs}
 */
export function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) {
      return {
        ...DEFAULT_PREFS,
        homeIds: [...DEFAULT_PREFS.homeIds],
        awayIds: [...DEFAULT_PREFS.awayIds],
      };
    }

    const parsed = JSON.parse(raw);
    const homeIds = Array.isArray(parsed.homeIds) && parsed.homeIds.length > 0
      ? parsed.homeIds.filter((id) => typeof id === 'string')
      : [...DEFAULT_PREFS.homeIds];
    const awayIds = Array.isArray(parsed.awayIds) && parsed.awayIds.length > 0
      ? parsed.awayIds.filter((id) => typeof id === 'string')
      : [...DEFAULT_PREFS.awayIds];

    return {
      muted: Boolean(parsed.muted),
      mode: parsed.mode === '2v2' ? '2v2' : '1v1',
      playMode: ['solo', 'coop', 'vs'].includes(parsed.playMode)
        ? parsed.playMode
        : DEFAULT_PREFS.playMode,
      difficulty: ['kolay', 'normal', 'zor', 'easy', 'hard'].includes(parsed.difficulty)
        ? ({ easy: 'kolay', hard: 'zor' }[parsed.difficulty] ?? parsed.difficulty)
        : DEFAULT_PREFS.difficulty,
      format: ['classic', 'single', 'practice'].includes(parsed.format)
        ? parsed.format
        : DEFAULT_PREFS.format,
      opponentId: typeof parsed.opponentId === 'string' ? parsed.opponentId : DEFAULT_PREFS.opponentId,
      homeIds,
      awayIds,
      tutorialSeen: Boolean(parsed.tutorialSeen),
    };
  } catch {
    return {
      ...DEFAULT_PREFS,
      homeIds: [...DEFAULT_PREFS.homeIds],
      awayIds: [...DEFAULT_PREFS.awayIds],
    };
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
      bestCombo: num(parsed.bestCombo),
      winStreak: num(parsed.winStreak),
      bestWinStreak: num(parsed.bestWinStreak),
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
 * @param {{ winner: string, format?: string, stats?: { spikes?: number, blocks?: number, saves?: number, longestRally?: number, bestCombo?: number } }} result
 * @returns {{ records: Records, broken: Record<string, boolean> }}
 */
export function recordMatchResult(result) {
  const prev = loadRecords();
  const won = result.winner === 'home';
  const practice = result.format === 'practice';
  const stats = result.stats ?? {};

  const spikes = num(stats.spikes);
  const blocks = num(stats.blocks);
  const saves = num(stats.saves);
  const rally = num(stats.longestRally);
  const combo = num(stats.bestCombo);
  const nextStreak = !practice && won ? prev.winStreak + 1 : practice ? prev.winStreak : 0;

  const next = {
    wins: prev.wins + (!practice && won ? 1 : 0),
    losses: prev.losses + (!practice && !won ? 1 : 0),
    matchesPlayed: prev.matchesPlayed + (practice ? 0 : 1),
    longestRally: Math.max(prev.longestRally, rally),
    mostSpikes: Math.max(prev.mostSpikes, spikes),
    mostBlocks: Math.max(prev.mostBlocks, blocks),
    mostSaves: Math.max(prev.mostSaves, saves),
    bestCombo: Math.max(prev.bestCombo, combo),
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
    bestCombo: combo > prev.bestCombo && combo > 0,
    bestWinStreak: !practice && won && nextStreak > prev.bestWinStreak,
    firstWin: !practice && won && prev.wins === 0,
  };

  saveRecords(next);
  return { records: next, broken };
}

/** @param {unknown} value */
function num(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
