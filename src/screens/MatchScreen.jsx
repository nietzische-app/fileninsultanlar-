import { useCallback, useEffect, useRef, useState } from 'react';
import Game from '../game/Game.js';
import { GAME_HEIGHT, GAME_WIDTH, PHASE } from '../game/constants.js';
import { getPlayerById } from '../game/players.js';
import Scoreboard from '../components/Scoreboard.jsx';
import SultanBar from '../components/SultanBar.jsx';
import TouchControls from '../components/TouchControls.jsx';
import MuteButton from '../components/MuteButton.jsx';
import Sfx from '../game/audio.js';
import { upper } from '../utils/text.js';

const INITIAL_HUD = {
  score: { home: 0, away: 0 },
  sets: { home: 0, away: 0 },
  setNumber: 1,
  setHistory: [],
  phase: PHASE.READY,
  sultanCharge: 0,
  sultanReady: false,
  sultanArmed: false,
  running: false,
  streak: { side: null, count: 0 },
  pointsPerSet: 15,
  formatId: 'classic',
  opponentName: 'RAKİP',
  opponentAccent: '#9BB0FF',
};

/**
 * Maç ekranı — Canvas oyun alanı, skor tablosu, Sultan Gücü barı
 * ve mobil dokunmatik kontroller.
 */
export default function MatchScreen({ config, onFinish, onQuit, muted, onToggleMute }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const confirmCancelRef = useRef(null);

  const [hud, setHud] = useState(INITIAL_HUD);
  const [paused, setPaused] = useState(false);
  const [quitConfirm, setQuitConfirm] = useState(false);

  // --- Motorun kurulumu ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const game = new Game(canvas, {
      mode: config.mode,
      homeIds: config.homeIds,
      difficulty: config.difficulty,
      format: config.format,
      opponentId: config.opponentId,
      onState: setHud,
      onFinish: (result) => onFinishRef.current(result),
    });

    gameRef.current = game;
    game.start();

    // Geliştirme kolaylığı: konsoldan motora eriş (production build'de yok)
    if (import.meta.env.DEV) {
      window.__game = game;
    }

    return () => {
      game.destroy();
      gameRef.current = null;
      if (import.meta.env.DEV) delete window.__game;
    };
  }, [config]);

  // --- Maç sırasında sayfa kaydırmasını kilitle (mobil) ---
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.overscrollBehavior = prevOverscroll;
    };
  }, []);

  const pauseGame = useCallback(() => {
    const game = gameRef.current;
    if (!game || game.finished) return;
    if (game.running) game.stop();
    setPaused(true);
  }, []);

  const resumeGame = useCallback(() => {
    const game = gameRef.current;
    if (!game || game.finished) return;
    setQuitConfirm(false);
    if (!game.running) game.start();
    setPaused(false);
  }, []);

  // --- Sekme arka plana geçince duraklat ---
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && gameRef.current && !gameRef.current.finished) {
        pauseGame();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [pauseGame]);

  const requestQuit = useCallback(() => {
    Sfx.unlock();
    Sfx.select();
    pauseGame();
    setQuitConfirm(true);
  }, [pauseGame]);

  const cancelQuit = useCallback(() => {
    Sfx.select();
    setQuitConfirm(false);
  }, []);

  const confirmQuit = useCallback(() => {
    Sfx.unlock();
    Sfx.select();
    setQuitConfirm(false);
    onQuit();
  }, [onQuit]);

  const togglePause = useCallback(() => {
    const game = gameRef.current;
    if (!game || game.finished) return;

    Sfx.unlock();
    Sfx.select();
    if (quitConfirm) {
      setQuitConfirm(false);
      return;
    }
    if (game.running) {
      pauseGame();
    } else {
      resumeGame();
    }
  }, [pauseGame, resumeGame, quitConfirm]);

  // --- Escape / P ile duraklat; onay açıkken iptal ---
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape' && quitConfirm) {
        event.preventDefault();
        cancelQuit();
        return;
      }
      if (event.key !== 'Escape' && event.key !== 'p' && event.key !== 'P') return;
      if (quitConfirm) return;

      const game = gameRef.current;
      if (!game || game.finished) return;

      if (game.running) {
        pauseGame();
      } else {
        resumeGame();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [pauseGame, resumeGame, quitConfirm, cancelQuit]);

  // Onay diyaloğu açılınca iptal düğmesine odak
  useEffect(() => {
    if (!quitConfirm) return;
    confirmCancelRef.current?.focus?.();
  }, [quitConfirm]);

  const handleTouchInput = useCallback((name, pressed) => {
    if (paused || quitConfirm) return;
    Sfx.unlock();
    gameRef.current?.setInput(name, pressed);
  }, [paused, quitConfirm]);

  const handleSultan = useCallback(() => {
    if (paused || quitConfirm) return;
    Sfx.unlock();
    gameRef.current?.activateSultan();
  }, [paused, quitConfirm]);

  const squad = config.homeIds.map((id) => getPlayerById(id)).filter(Boolean);
  const controlsLocked = paused || quitConfirm;

  return (
    <div className="match-screen mx-auto flex min-h-full w-full max-w-[960px] flex-col items-center gap-3 px-2 py-3 max-md:h-[100dvh] max-md:max-h-[100dvh] max-md:justify-between max-md:overflow-hidden max-md:overscroll-none max-md:py-2 sm:gap-4 sm:px-3 sm:py-5">
      <div className="w-full shrink-0">
        <Scoreboard
          score={hud.score}
          sets={hud.sets}
          setNumber={hud.setNumber}
          setHistory={hud.setHistory}
          awayName={hud.opponentName}
          awayAccent={hud.opponentAccent}
          pointsPerSet={hud.pointsPerSet}
          compact
        />
      </div>

      {/* Oyun alanı — mobilde viewport'un ~%40'ı */}
      <div className="scanlines relative w-full max-w-[900px] shrink border-4 border-white/85 bg-black max-md:max-h-[min(42dvh,280px)]">
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          className="pixelated block h-auto max-h-full w-full"
          style={{ aspectRatio: `${GAME_WIDTH} / ${GAME_HEIGHT}` }}
          aria-label="Filenin Sultanları voleybol sahası"
        />

        {/* Duraklatma katmanı */}
        {paused && !quitConfirm && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/80 px-3"
            role="dialog"
            aria-modal="true"
            aria-label="Oyun duraklatıldı"
          >
            <p className="text-lg text-retro-accent">DURAKLATILDI</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button type="button" className="retro-button" onClick={resumeGame}>
                DEVAM ET
              </button>
              <MuteButton muted={muted} onToggle={onToggleMute} />
              <button type="button" className="retro-button-ghost" onClick={requestQuit}>
                MAÇTAN ÇIK
              </button>
            </div>
          </div>
        )}

        {/* Çıkış onayı */}
        {quitConfirm && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/90 px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quit-confirm-title"
          >
            <p id="quit-confirm-title" className="text-center text-sm text-white sm:text-lg">
              MAÇTAN ÇIKILSIN MI?
            </p>
            <p className="max-w-xs text-center text-[7px] leading-relaxed text-white/55 sm:text-[8px]">
              Skor kaydedilmez. Kadro seçimine dönersin.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                ref={confirmCancelRef}
                type="button"
                className="retro-button px-6 py-3"
                onClick={cancelQuit}
              >
                DEVAM ET
              </button>
              <button
                type="button"
                className="retro-button-ghost px-6 py-3"
                onClick={confirmQuit}
              >
                ÇIK
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="w-full shrink-0 max-md:hidden">
        <SultanBar
          charge={hud.sultanCharge}
          ready={hud.sultanReady}
          armed={hud.sultanArmed}
          onActivate={handleSultan}
        />
      </div>

      {/* Mobil: ince sultan barı + dokunmatik */}
      <div className="flex w-full shrink-0 flex-col gap-2 md:hidden">
        <SultanBar
          charge={hud.sultanCharge}
          ready={hud.sultanReady}
          armed={hud.sultanArmed}
          onActivate={handleSultan}
          compact
        />
        <TouchControls
          onInput={handleTouchInput}
          sultanReady={hud.sultanReady}
          disabled={controlsLocked}
        />
      </div>

      {/* Alt bilgi — masaüstünde tam, mobilde hızlı aksiyonlar */}
      <div className="flex w-full max-w-[900px] shrink-0 flex-wrap items-center justify-between gap-2 max-md:pb-[env(safe-area-inset-bottom)]">
        <div className="hidden items-center gap-3 text-[7px] text-white/45 sm:flex">
          <span>{upper(config.mode)}</span>
          <span className="text-white/20">|</span>
          <span>{upper(config.format ?? 'classic')}</span>
          <span className="text-white/20">|</span>
          <span>{squad.map((p) => upper(p.name)).join(' + ')}</span>
          {hud.opponentName && (
            <>
              <span className="text-white/20">vs</span>
              <span style={{ color: hud.opponentAccent }}>{hud.opponentName}</span>
            </>
          )}
        </div>

        <div className="flex w-full justify-end gap-2 sm:w-auto sm:gap-3">
          <MuteButton muted={muted} onToggle={onToggleMute} className="max-md:px-3 max-md:py-2" />
          <button
            type="button"
            className="retro-button-ghost px-4 py-2 text-[8px] max-md:px-3"
            onClick={togglePause}
          >
            {paused ? 'DEVAM' : 'DURAKLAT'}
          </button>
          <button
            type="button"
            className="retro-button-ghost px-4 py-2 text-[8px] max-md:px-3"
            onClick={requestQuit}
          >
            ÇIK
          </button>
        </div>
      </div>

      <p className="hidden text-center text-[7px] leading-relaxed text-white/35 md:block">
        ← → HAREKET · ↑ ZIPLA · ↓ DALIŞ · BOŞLUK VUR · X SULTAN GÜCÜ · ESC DURAKLAT
      </p>
    </div>
  );
}
