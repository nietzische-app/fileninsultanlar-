import { useCallback, useEffect, useState } from 'react';
import StartScreen from './screens/StartScreen.jsx';
import CharacterSelect from './screens/CharacterSelect.jsx';
import MatchScreen from './screens/MatchScreen.jsx';
import ResultScreen from './screens/ResultScreen.jsx';
import Sfx from './game/audio.js';
import { loadPrefs, savePrefs } from './utils/storage.js';

/**
 * Ekran akışı:
 *
 *   start → select → match → result
 *                ↑              │
 *                └──────────────┘  (tekrar oyna / ana menü)
 */
export default function App() {
  const initialPrefs = loadPrefs();
  const [screen, setScreen] = useState('start');
  const [matchConfig, setMatchConfig] = useState(null);
  const [result, setResult] = useState(null);
  const [muted, setMuted] = useState(initialPrefs.muted);
  const [prefs, setPrefs] = useState(initialPrefs);

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
    setScreen('match');
  }, []);

  const handleFinish = useCallback((matchResult) => {
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
          onStart={() => setScreen('select')}
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
          onRematch={handleRematch}
          onHome={goHome}
          muted={muted}
          onToggleMute={toggleMute}
        />
      )}
    </div>
  );
}
