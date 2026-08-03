import { useEffect, useRef, useState } from 'react';
import Game, { GAME_WIDTH, GAME_HEIGHT } from './game/Game.js';
import { ROSTER, STARTING_SIX } from './game/players.js';

/**
 * Filenin Sultanları — ana uygulama bileşeni.
 *
 * Canvas'ı DOM'a basar, Game motorunu mount sırasında başlatır,
 * unmount sırasında döngüyü durdurur. Skor/durum bilgisi motordan
 * `onStateChange` callback'i ile React state'ine akar.
 */
export default function App() {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);

  const [hud, setHud] = useState({
    score: { home: 0, away: 0 },
    set: 1,
    running: false,
    activePlayer: STARTING_SIX[0],
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const game = new Game(canvas, {
      onStateChange: (state) => setHud((prev) => ({ ...prev, ...state })),
    });

    gameRef.current = game;
    game.start();

    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  const handleToggle = () => {
    const game = gameRef.current;
    if (!game) return;
    if (game.running) {
      game.stop();
    } else {
      game.start();
    }
    setHud((prev) => ({ ...prev, running: game.running }));
  };

  const handleReset = () => {
    gameRef.current?.reset();
  };

  return (
    <div className="min-h-full flex flex-col items-center gap-6 px-4 py-8">
      <header className="text-center space-y-3">
        <h1 className="text-turkiye-red text-2xl md:text-3xl drop-shadow-[3px_3px_0_rgba(255,255,255,0.9)]">
          FİLENİN SULTANLARI
        </h1>
        <p className="text-[10px] md:text-xs text-white/70 leading-relaxed">
          Retro Voleybol · Milli Takımımıza Saygıyla
        </p>
      </header>

      {/* Skor tablosu */}
      <div className="retro-panel flex items-center gap-6 px-6 py-4 text-xs">
        <span className="text-turkiye-red">TÜRKİYE</span>
        <span className="text-retro-accent text-lg">
          {hud.score.home} - {hud.score.away}
        </span>
        <span className="text-white/70">RAKİP</span>
        <span className="text-[10px] text-white/50">SET {hud.set}</span>
      </div>

      {/* Oyun alanı — Game.js bu canvas üzerine çizer */}
      <div
        id="game-container"
        className="retro-panel p-2 w-full max-w-[960px]"
      >
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          className="pixelated block w-full h-auto bg-court-out"
          aria-label="Filenin Sultanları voleybol sahası"
        />
      </div>

      {/* Kontroller */}
      <div className="flex flex-wrap justify-center gap-4">
        <button type="button" className="retro-button" onClick={handleToggle}>
          {hud.running ? 'DURAKLAT' : 'BAŞLAT'}
        </button>
        <button type="button" className="retro-button" onClick={handleReset}>
          YENİDEN
        </button>
      </div>

      <p className="text-[9px] text-white/50 text-center leading-relaxed max-w-md">
        ← → HAREKET · BOŞLUK ZIPLA / SMAÇ
      </p>

      {/* Kadro şeridi */}
      <section className="w-full max-w-[960px]">
        <h2 className="text-[10px] text-white/70 mb-3">KADRO</h2>
        <ul className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ROSTER.map((player) => (
            <li
              key={player.id}
              className="retro-panel px-3 py-3 text-[8px] leading-relaxed"
              style={{ borderColor: player.colors.primary }}
            >
              <div className="text-retro-accent">#{player.number}</div>
              <div className="mt-1">{player.name.toUpperCase()}</div>
              <div className="mt-1 text-white/50">{player.position}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
