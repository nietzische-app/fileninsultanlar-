import { useCallback, useState } from 'react';
import StartScreen from './screens/StartScreen.jsx';
import CharacterSelect from './screens/CharacterSelect.jsx';
import MatchScreen from './screens/MatchScreen.jsx';
import ResultScreen from './screens/ResultScreen.jsx';
import Sfx from './game/audio.js';

/**
 * Ekran akışı:
 *
 *   start → select → match → result
 *                ↑              │
 *                └──────────────┘  (tekrar oyna / ana menü)
 */
export default function App() {
  const [screen, setScreen] = useState('start');
  const [matchConfig, setMatchConfig] = useState(null);
  const [result, setResult] = useState(null);
  const [muted, setMuted] = useState(false);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      Sfx.setMuted(next);
      return next;
    });
  }, []);

  const startMatch = useCallback((config) => {
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
        <CharacterSelect onBack={goHome} onStart={startMatch} />
      )}

      {screen === 'match' && matchConfig && (
        <MatchScreen
          config={matchConfig}
          onFinish={handleFinish}
          onQuit={() => setScreen('select')}
        />
      )}

      {screen === 'result' && result && (
        <ResultScreen result={result} onRematch={handleRematch} onHome={goHome} />
      )}
    </div>
  );
}
