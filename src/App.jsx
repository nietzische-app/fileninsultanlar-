import { useCallback, useEffect, useState } from 'react';
import StartScreen from './screens/StartScreen.jsx';
import TutorialScreen from './screens/TutorialScreen.jsx';
import CharacterSelect from './screens/CharacterSelect.jsx';
import MatchScreen from './screens/MatchScreen.jsx';
import ResultScreen from './screens/ResultScreen.jsx';
import Sfx from './game/audio.js';
import {
  loadPrefs,
  loadRecords,
  recordMatchResult,
  savePrefs,
} from './utils/storage.js';

/**
 * Ekran akışı:
 *
 *   start → tutorial? → select → match → result
 *     ↑         │                      │
 *     └─────────┴──────────────────────┘
 */
export default function App() {
  const initialPrefs = loadPrefs();
  const [screen, setScreen] = useState('start');
  const [matchConfig, setMatchConfig] = useState(null);
  const [result, setResult] = useState(null);
  const [brokenRecords, setBrokenRecords] = useState(null);
  const [muted, setMuted] = useState(initialPrefs.muted);
  const [prefs, setPrefs] = useState(initialPrefs);
  const [records, setRecords] = useState(() => loadRecords());
  /** Tutorial menüden mi açıldı (geri → start), yoksa ilk akış mı (→ select). */
  const [tutorialFromMenu, setTutorialFromMenu] = useState(false);

  // İlk yüklemede ses motoruna mute tercihini uygula
  useEffect(() => {
    Sfx.setMuted(initialPrefs.muted);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnızca mount
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      Sfx.setMuted(next);
      setPrefs(savePrefs({ muted: next }));
      return next;
    });
  }, []);

  const goSelect = useCallback(() => {
    setScreen('select');
  }, []);

  const handleStart = useCallback(() => {
    if (!prefs.tutorialSeen) {
      setTutorialFromMenu(false);
      setScreen('tutorial');
      return;
    }
    goSelect();
  }, [prefs.tutorialSeen, goSelect]);

  const openTutorial = useCallback(() => {
    Sfx.select();
    setTutorialFromMenu(true);
    setScreen('tutorial');
  }, []);

  const finishTutorial = useCallback(() => {
    const next = savePrefs({ tutorialSeen: true });
    setPrefs(next);
    if (tutorialFromMenu) {
      setScreen('start');
      return;
    }
    goSelect();
  }, [tutorialFromMenu, goSelect]);

  const startMatch = useCallback((config) => {
    const nextPrefs = savePrefs({
      mode: config.mode,
      difficulty: config.difficulty,
      homeIds: config.homeIds,
    });
    setPrefs(nextPrefs);
    // Yeni nesne referansı → MatchScreen motoru sıfırdan kurar
    setMatchConfig({ ...config, startedAt: Date.now() });
    setResult(null);
    setBrokenRecords(null);
    setScreen('match');
  }, []);

  const handleFinish = useCallback((matchResult) => {
    const { records: nextRecords, broken } = recordMatchResult(matchResult);
    setRecords(nextRecords);
    setBrokenRecords(broken);
    setResult(matchResult);
    setScreen('result');
  }, []);

  const handleRematch = useCallback(() => {
    if (!matchConfig) {
      setScreen('select');
      return;
    }
    Sfx.confirm();
    setMatchConfig((prev) => ({ ...prev, startedAt: Date.now() }));
    setResult(null);
    setBrokenRecords(null);
    setScreen('match');
  }, [matchConfig]);

  const goHome = useCallback(() => {
    Sfx.select();
    setScreen('start');
  }, []);

  return (
    <div className="min-h-full">
      {screen === 'start' && (
        <StartScreen
          onStart={handleStart}
          onTutorial={openTutorial}
          muted={muted}
          onToggleMute={toggleMute}
          records={records}
        />
      )}

      {screen === 'tutorial' && (
        <TutorialScreen
          onDone={finishTutorial}
          onBack={tutorialFromMenu ? goHome : undefined}
          muted={muted}
          onToggleMute={toggleMute}
        />
      )}

      {screen === 'select' && (
        <CharacterSelect
          onBack={goHome}
          onStart={startMatch}
          muted={muted}
          onToggleMute={toggleMute}
          initialMode={prefs.mode}
          initialDifficulty={prefs.difficulty}
          initialHomeIds={prefs.homeIds}
        />
      )}

      {screen === 'match' && matchConfig && (
        <MatchScreen
          config={matchConfig}
          onFinish={handleFinish}
          onQuit={() => setScreen('select')}
          muted={muted}
          onToggleMute={toggleMute}
        />
      )}

      {screen === 'result' && result && (
        <ResultScreen
          result={result}
          brokenRecords={brokenRecords}
          onRematch={handleRematch}
          onHome={goHome}
          muted={muted}
          onToggleMute={toggleMute}
        />
      )}
    </div>
  );
}
