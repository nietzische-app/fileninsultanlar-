/**
 * Yerel tercih saklama — mute, son mod/zorluk/kadro seçimi.
 * Tarayıcı localStorage kullanır; yazma başarısız olursa sessizce yoksayılır.
 */

const STORAGE_KEY = 'filenin-sultanlari-prefs';

/** @typedef {{ muted: boolean, mode: string, difficulty: string, homeIds: string[] }} Prefs */

/** @type {Prefs} */
export const DEFAULT_PREFS = {
  muted: false,
  mode: '1v1',
  difficulty: 'normal',
  homeIds: ['gizem-orge'],
};

/**
 * @returns {Prefs}
 */
export function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS, homeIds: [...DEFAULT_PREFS.homeIds] };

    const parsed = JSON.parse(raw);
    const homeIds = Array.isArray(parsed.homeIds) && parsed.homeIds.length > 0
      ? parsed.homeIds.filter((id) => typeof id === 'string')
      : [...DEFAULT_PREFS.homeIds];

    return {
      muted: Boolean(parsed.muted),
      mode: parsed.mode === '2v2' ? '2v2' : '1v1',
      difficulty: ['easy', 'normal', 'hard'].includes(parsed.difficulty)
        ? parsed.difficulty
        : DEFAULT_PREFS.difficulty,
      homeIds,
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // private mode / quota — tercih kaybolabilir, oyun devam eder
  }
  return next;
}
