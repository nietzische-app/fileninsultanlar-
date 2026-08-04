import { useCallback, useEffect, useRef, useState } from 'react';
import Game from '../game/Game.js';
import { GAME_HEIGHT, GAME_WIDTH, PHASE } from '../game/constants.js';
import { getPlayerById } from '../game/players.js';
import Scoreboard from '../components/Scoreboard.jsx';
import SultanBar from '../components/SultanBar.jsx';
import TouchControls from '../components/TouchControls.jsx';
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
};

/**
 * Maç ekranı — Canvas oyun alanı, skor tablosu, Sultan Gücü barı
 * ve mobil dokunmatik kontroller.
 */
export default function MatchScreen({ config, onFinish, onQuit }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const [hud, setHud] = useState(INITIAL_HUD);
  const [paused, setPaused] = useState(false);

  // --- Motorun kurulumu ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const game = new Game(canvas, {
      mode: config.mode,
      homeIds: config.homeIds,
      difficulty: config.difficulty,
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

  // --- Sekme arka plana geçince duraklat ---
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && gameRef.current?.running) {
        gameRef.current.stop();
        setPaused(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // --- Escape ile duraklat ---
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key !== 'Escape' && event.key !== 'p' && event.key !== 'P') return;
      const game = gameRef.current;
      if (!game || game.finished) return;

      if (game.running) {
        game.stop();
        setPaused(true);
      } else {
        game.start();
        setPaused(false);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const togglePause = useCallback(() => {
    const game = gameRef.current;
    if (!game || game.finished) return;

    Sfx.select();
    if (game.running) {
      game.stop();
      setPaused(true);
    } else {
      game.start();
      setPaused(false);
    }
  }, []);

  const handleTouchInput = useCallback((name, pressed) => {
    gameRef.current?.setInput(name, pressed);
  }, []);

  const handleSultan = useCallback(() => {
    gameRef.current?.activateSultan();
  }, []);

  const squad = config.homeIds.map((id) => getPlayerById(id)).filter(Boolean);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[960px] flex-col items-center gap-4 px-3 py-5">
      <Scoreboard
        score={hud.score}
        sets={hud.sets}
        setNumber={hud.setNumber}
        setHistory={hud.setHistory}
      />

      {/* Oyun alanı */}
      <div className="scanlines relative w-full max-w-[900px] border-4 border-white/85 bg-black">
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          className="pixelated block h-auto w-full"
          style={{ aspectRatio: `${GAME_WIDTH} / ${GAME_HEIGHT}` }}
          aria-label="Filenin Sultanları voleybol sahası"
        />

        {/* Duraklatma katmanı */}
        {paused && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-black/80">
            <p className="text-lg text-retro-accent">DURAKLATILDI</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button type="button" className="retro-button" onClick={togglePause}>
                DEVAM ET
              </button>
              <button type="button" className="retro-button-ghost" onClick={onQuit}>
                MAÇTAN ÇIK
              </button>
            </div>
          </div>
        )}
      </div>

      <SultanBar
        charge={hud.sultanCharge}
        ready={hud.sultanReady}
        armed={hud.sultanArmed}
        onActivate={handleSultan}
      />

      <TouchControls onInput={handleTouchInput} sultanReady={hud.sultanReady} />

      {/* Alt bilgi çubuğu */}
      <div className="flex w-full max-w-[900px] flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-[7px] text-white/45">
          <span>{upper(config.mode)}</span>
          <span className="text-white/20">|</span>
          <span>{squad.map((p) => upper(p.name)).join(' + ')}</span>
        </div>

        <div className="flex gap-3">
          <button type="button" className="retro-button-ghost px-4 py-2 text-[8px]" onClick={togglePause}>
            {paused ? 'DEVAM' : 'DURAKLAT'}
          </button>
          <button type="button" className="retro-button-ghost px-4 py-2 text-[8px]" onClick={onQuit}>
            ÇIK
          </button>
        </div>
      </div>

      <p className="hidden text-center text-[7px] leading-relaxed text-white/35 md:block">
        ← → HAREKET · ↑ ZIPLA · BOŞLUK VUR · X SULTAN GÜCÜ · ESC DURAKLAT
      </p>
    </div>
  );
}
