import { useCallback, useEffect, useState } from 'react';
import StartScreen from './screens/StartScreen.jsx';
import TutorialScreen from './screens/TutorialScreen.jsx';
import CharacterSelect from './screens/CharacterSelect.jsx';
import TournamentScreen from './screens/TournamentScreen.jsx';
import MatchScreen from './screens/MatchScreen.jsx';
import ResultScreen from './screens/ResultScreen.jsx';
import RotateGate from './components/RotateGate.jsx';
import useViewport from './hooks/useViewport.js';
import Sfx from './game/audio.js';
import {
  advanceTournament,
  createTournament,
  roundMatchConfig,
} from './game/tournament.js';
import {
  clearTournament,
  loadPrefs,
  loadRecords,
  loadTournament,
  recordMatchResult,
  recordSurvivalResult,
  recordTournamentResult,
  savePrefs,
  saveTournament,
} from './utils/storage.js';

/**
 * Ekran akışı:
 *
 *   start → tutorial? → select ─┬─ (hızlı maç)   → match → result
 *     ↑                         ├─ (turnuva)     → bracket ⇄ match → result
 *     └─────────────────────────┴─ (hayatta kalma) → match → result
 *
 * Turnuvada her tur maçından sonra bracket ekranına dönülür; turnuva
 * kupa ya da elenmeyle kapandığında sonuç ekranına geçilir.
 */
export default function App() {
  const initialPrefs = loadPrefs();
  const [screen, setScreen] = useState('start');
  const [campaign, setCampaign] = useState('match');
  const [matchConfig, setMatchConfig] = useState(null);
  const [tournament, setTournament] = useState(null);
  /** Sonuç ekranında gösterilecek kapanmış turnuva (bracket özeti). */
  const [finishedTournament, setFinishedTournament] = useState(null);
  const [result, setResult] = useState(null);
  const [brokenRecords, setBrokenRecords] = useState(null);
  const [muted, setMuted] = useState(initialPrefs.muted);
  const [prefs, setPrefs] = useState(initialPrefs);
  const [records, setRecords] = useState(() => loadRecords());
  const [savedTournament, setSavedTournament] = useState(() => loadTournament());
  /** Tutorial menüden mi açıldı (geri → start), yoksa ilk akış mı (→ select). */
  const [tutorialFromMenu, setTutorialFromMenu] = useState(false);

  // Dokunmatik cihazda dikey tutuş oyunu tamamen kapatır
  const { portrait, coarse } = useViewport();
  const blockedByOrientation = portrait && coarse;

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

  const handleStart = useCallback(
    (modeId = 'match') => {
      setCampaign(modeId);
      if (!prefs.tutorialSeen) {
        setTutorialFromMenu(false);
        setScreen('tutorial');
        return;
      }
      goSelect();
    },
    [prefs.tutorialSeen, goSelect]
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
    goSelect();
  }, [tutorialFromMenu, goSelect]);

  const goHome = useCallback(() => {
    Sfx.select();
    setScreen('start');
  }, []);

  // --- Turnuva ---

  /** Bracket'teki sıradaki turu sahaya taşır. */
  const playTournamentRound = useCallback((state) => {
    const config = roundMatchConfig(state);
    if (!config) return;

    setMatchConfig({ ...config, startedAt: Date.now() });
    setResult(null);
    setBrokenRecords(null);
    setScreen('match');
  }, []);

  const abandonTournament = useCallback(() => {
    clearTournament();
    setTournament(null);
    setSavedTournament(null);
  }, []);

  const resumeSavedTournament = useCallback(() => {
    if (!savedTournament) return;
    setCampaign('tournament');
    setTournament(savedTournament);
    setScreen('bracket');
  }, [savedTournament]);

  // --- Maç başlatma ---

  const startMatch = useCallback(
    (config) => {
      const mode = config.campaign ?? 'match';
      setCampaign(mode);

      const nextPrefs = savePrefs({
        mode: config.mode,
        difficulty: config.difficulty,
        ...(mode === 'match'
          ? {
              format: config.format,
              opponentId: config.opponentId ?? 'random',
            }
          : {}),
        homeIds: config.homeIds,
      });
      setPrefs(nextPrefs);
      setResult(null);
      setBrokenRecords(null);
      setFinishedTournament(null);

      if (mode === 'tournament') {
        const state = createTournament(config);
        saveTournament(state);
        setTournament(state);
        setSavedTournament(state);
        setScreen('bracket');
        return;
      }

      // Yeni nesne referansı → MatchScreen motoru sıfırdan kurar
      setMatchConfig({ ...config, campaign: mode, startedAt: Date.now() });
      setScreen('match');
    },
    []
  );

  const handleFinish = useCallback(
    (matchResult) => {
      // --- Hayatta kalma: koşu bitti ---
      if (matchResult.campaign === 'survival') {
        const { records: nextRecords, broken } = recordSurvivalResult(matchResult);
        setRecords(nextRecords);
        setBrokenRecords(broken);
        setResult(matchResult);
        setFinishedTournament(null);
        setScreen('result');
        return;
      }

      // --- Turnuva turu ---
      if (matchResult.campaign === 'tournament' && tournament) {
        // Tur maçı gerçek bir maçtır: galibiyet/seri tablosuna işler
        const { records: matchRecords, broken: matchBroken } =
          recordMatchResult(matchResult);
        const nextState = advanceTournament(tournament, matchResult);
        setTournament(nextState);

        if (nextState.status === 'active') {
          saveTournament(nextState);
          setSavedTournament(nextState);
          setRecords(matchRecords);
          setBrokenRecords(matchBroken);
          setResult(matchResult);
          setScreen('bracket');
          return;
        }

        // Kupa ya da elenme — turnuva kapandı
        const { records: nextRecords, broken: tourBroken } =
          recordTournamentResult(nextState);
        clearTournament();
        setSavedTournament(null);
        setRecords(nextRecords);
        setBrokenRecords({ ...matchBroken, ...tourBroken });
        setResult(matchResult);
        setFinishedTournament(nextState);
        setScreen('result');
        return;
      }

      // --- Tek maç ---
      // Rematch aynı rakiple devam etsin (rastgele seçilmiş olsa bile)
      setMatchConfig((prev) =>
        prev && matchResult?.opponent?.id
          ? { ...prev, opponentId: matchResult.opponent.id, opponentRandom: false }
          : prev
      );

      const { records: nextRecords, broken } = recordMatchResult(matchResult);
      setRecords(nextRecords);
      setBrokenRecords(broken);
      setResult(matchResult);
      setFinishedTournament(null);
      setScreen('result');
    },
    [tournament]
  );

  const handleRematch = useCallback(() => {
    if (!matchConfig) {
      setScreen('select');
      return;
    }
    Sfx.confirm();

    // Turnuva sonrası "tekrar" = aynı kadroyla yeni kupa yolu
    if (campaign === 'tournament') {
      const state = createTournament({
        mode: matchConfig.mode,
        difficulty: matchConfig.difficulty ?? prefs.difficulty,
        homeIds: matchConfig.homeIds,
      });
      saveTournament(state);
      setTournament(state);
      setSavedTournament(state);
      setFinishedTournament(null);
      setResult(null);
      setBrokenRecords(null);
      setScreen('bracket');
      return;
    }

    setMatchConfig((prev) => ({
      ...prev,
      startedAt: Date.now(),
      // Hızlı maçta rakip kilitlenir; hayatta kalmada rakip dalgaya
      // bağlı olduğu için son dalganın takımını taşımanın anlamı yok
      ...(campaign === 'survival'
        ? {}
        : {
            opponentId: prev.opponentId ?? result?.opponent?.id,
            opponentRandom: false,
          }),
    }));
    setResult(null);
    setBrokenRecords(null);
    setScreen('match');
  }, [matchConfig, result, campaign, prefs.difficulty]);

  /** Maçtan çıkış — kampanyada koşu/turnuva iptal olur. */
  const handleQuitMatch = useCallback(() => {
    if (campaign === 'tournament') {
      abandonTournament();
      setScreen('start');
      return;
    }
    if (campaign === 'survival') {
      setScreen('start');
      return;
    }
    setScreen('select');
  }, [campaign, abandonTournament]);

  return (
    <div className="min-h-full">
      {/*
        Yatay kapısı en üstte dursun: altındaki ekranlar mount kalır
        (maç motoru durumunu kaybetmez) ama tamamen kapanır.
      */}
      {blockedByOrientation && <RotateGate />}

      {screen === 'start' && (
        <StartScreen
          onStart={handleStart}
          onTutorial={openTutorial}
          muted={muted}
          onToggleMute={toggleMute}
          records={records}
          resumeTournament={savedTournament}
          onResumeTournament={resumeSavedTournament}
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
          campaign={campaign}
          initialMode={prefs.mode}
          initialDifficulty={prefs.difficulty}
          initialFormat={prefs.format}
          initialOpponentId={prefs.opponentId}
          initialHomeIds={prefs.homeIds}
        />
      )}

      {screen === 'bracket' && tournament && (
        <TournamentScreen
          state={tournament}
          onPlay={() => playTournamentRound(tournament)}
          onQuit={() => {
            abandonTournament();
            setScreen('start');
          }}
          muted={muted}
          onToggleMute={toggleMute}
        />
      )}

      {screen === 'match' && matchConfig && (
        <MatchScreen
          config={matchConfig}
          onFinish={handleFinish}
          onQuit={handleQuitMatch}
          muted={muted}
          onToggleMute={toggleMute}
        />
      )}

      {screen === 'result' && result && (
        <ResultScreen
          result={result}
          brokenRecords={brokenRecords}
          tournamentState={finishedTournament}
          onRematch={handleRematch}
          onHome={goHome}
          muted={muted}
          onToggleMute={toggleMute}
        />
      )}
    </div>
  );
}
