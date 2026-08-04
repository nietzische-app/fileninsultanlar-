import { useCallback, useEffect, useState } from 'react';
import StartScreen from './screens/StartScreen.jsx';
import TutorialScreen from './screens/TutorialScreen.jsx';
import CharacterSelect from './screens/CharacterSelect.jsx';
import VersusSelect from './screens/VersusSelect.jsx';
import MatchScreen from './screens/MatchScreen.jsx';
import ResultScreen from './screens/ResultScreen.jsx';
import LandscapeGate from './components/LandscapeGate.jsx';
import { useLandscapeGate } from './hooks/useLandscapeGate.js';
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
 *   start → tutorial? → select|versus → match → result
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
  const [tutorialFromMenu, setTutorialFromMenu] = useState(false);
  /** Tutorial sonrası açılacak oyun tarzı. */
  const [pendingPlayMode, setPendingPlayMode] = useState('solo');
  const { blocked: landscapeBlocked, tryLock } = useLandscapeGate();

  useEffect(() => {
    Sfx.setMuted(initialPrefs.muted);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnızca mount
  }, []);

  // Mobilde body kaydırmasını her zaman kilitle (özellikle maç / kapı)
  useEffect(() => {
    if (!landscapeBlocked) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [landscapeBlocked]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      Sfx.setMuted(next);
      setPrefs(savePrefs({ muted: next }));
      return next;
    });
  }, []);

  const goSelectFor = useCallback((playMode) => {
    const next = savePrefs({ playMode });
    setPrefs(next);
    setScreen(playMode === 'solo' ? 'select' : 'versus');
  }, []);

  const handleStart = useCallback(
    (playMode = 'solo') => {
      setPendingPlayMode(playMode);
      if (!prefs.tutorialSeen) {
        setTutorialFromMenu(false);
        setScreen('tutorial');
        return;
      }
      goSelectFor(playMode);
    },
    [prefs.tutorialSeen, goSelectFor]
  );

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
    goSelectFor(pendingPlayMode);
  }, [tutorialFromMenu, goSelectFor, pendingPlayMode]);

  const startMatch = useCallback((config) => {
    const playMode = config.playMode ?? 'solo';
    const nextPrefs = savePrefs({
      mode: config.mode,
      playMode,
      difficulty: config.difficulty,
      format: config.format,
      opponentId: config.opponentId ?? 'random',
      homeIds: config.homeIds,
      awayIds: config.awayIds ?? prefs.awayIds,
    });
    setPrefs(nextPrefs);
    setMatchConfig({ ...config, playMode, startedAt: Date.now() });
    setResult(null);
    setBrokenRecords(null);
    setScreen('match');
  }, [prefs.awayIds]);

  const handleFinish = useCallback((matchResult) => {
    setMatchConfig((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      if (matchResult?.opponent?.id && prev.playMode !== 'vs') {
        next.opponentId = matchResult.opponent.id;
        next.opponentRandom = false;
      }
      if (matchResult?.awayIds) next.awayIds = matchResult.awayIds;
      return next;
    });

    const { records: nextRecords, broken } = recordMatchResult(matchResult);
    setRecords(nextRecords);
    setBrokenRecords(broken);
    setResult(matchResult);
    setScreen('result');
  }, []);

  const handleRematch = useCallback(() => {
    if (!matchConfig) {
      setScreen(prefs.playMode === 'solo' ? 'select' : 'versus');
      return;
    }
    Sfx.confirm();
    setMatchConfig((prev) => ({
      ...prev,
      startedAt: Date.now(),
      opponentId: prev.opponentId ?? result?.opponent?.id,
      opponentRandom: false,
      awayIds: prev.awayIds ?? result?.awayIds,
    }));
    setResult(null);
    setBrokenRecords(null);
    setScreen('match');
  }, [matchConfig, result, prefs.playMode]);

  const goHome = useCallback(() => {
    Sfx.select();
    setScreen('start');
  }, []);

  const backFromSelect = useCallback(() => {
    goHome();
  }, [goHome]);

  return (
    <div className={`min-h-full ${landscapeBlocked ? 'pointer-events-none select-none' : ''}`}>
      <LandscapeGate blocked={landscapeBlocked} onUnlock={tryLock} />

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
          onBack={backFromSelect}
          onStart={startMatch}
          muted={muted}
          onToggleMute={toggleMute}
          initialMode={prefs.mode}
          initialDifficulty={prefs.difficulty}
          initialFormat={prefs.format}
          initialOpponentId={prefs.opponentId}
          initialHomeIds={prefs.homeIds}
        />
      )}

      {screen === 'versus' && (
        <VersusSelect
          playMode={prefs.playMode === 'vs' ? 'vs' : 'coop'}
          onBack={backFromSelect}
          onStart={startMatch}
          muted={muted}
          onToggleMute={toggleMute}
          initialDifficulty={prefs.difficulty}
          initialFormat={prefs.format}
          initialOpponentId={prefs.opponentId}
          initialHomeIds={prefs.homeIds}
          initialAwayIds={prefs.awayIds}
        />
      )}

      {screen === 'match' && matchConfig && (
        <MatchScreen
          config={matchConfig}
          onFinish={handleFinish}
          onQuit={() =>
            setScreen(matchConfig.playMode === 'solo' ? 'select' : 'versus')
          }
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
