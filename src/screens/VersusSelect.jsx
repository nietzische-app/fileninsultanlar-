import { useCallback, useEffect, useMemo, useState } from 'react';
import PixelAvatar from '../components/PixelAvatar.jsx';
import MuteButton from '../components/MuteButton.jsx';
import { DIFFICULTY, FORMATS, PLAY_MODES } from '../game/constants.js';
import { DEFAULT_PLAYER_ID, getActiveRoster, getBonusRoster } from '../game/players.js';
import { OPPONENT_TEAMS } from '../game/opponents.js';
import Sfx from '../game/audio.js';
import { upper } from '../utils/text.js';

const GRID_COLS = 4;

/**
 * Street Fighter tarzı 2 oyuncu karakter seçimi — Co-Op / VS.
 *
 * P1: WASD ile gezin, Space ile onayla
 * P2: Oklarla gezin, Enter / Numpad0 ile onayla
 */
export default function VersusSelect({
  playMode = 'coop',
  onBack,
  onStart,
  muted,
  onToggleMute,
  initialDifficulty = 'normal',
  initialFormat = 'classic',
  initialOpponentId = 'random',
  initialHomeIds,
  initialAwayIds,
}) {
  const roster = useMemo(() => [...getActiveRoster(), ...getBonusRoster()], []);
  const playMeta = PLAY_MODES[playMode] ?? PLAY_MODES.coop;

  const [difficulty, setDifficulty] = useState(
    DIFFICULTY[initialDifficulty] ? initialDifficulty : 'normal'
  );
  const [format, setFormat] = useState(FORMATS[initialFormat] ? initialFormat : 'classic');
  const [opponentId, setOpponentId] = useState(
    initialOpponentId === 'random' || OPPONENT_TEAMS.some((t) => t.id === initialOpponentId)
      ? initialOpponentId
      : 'random'
  );

  const [p1Index, setP1Index] = useState(() =>
    Math.max(0, roster.findIndex((p) => p.id === (initialHomeIds?.[0] ?? DEFAULT_PLAYER_ID)))
  );
  const [p2Index, setP2Index] = useState(() => {
    const fallback =
      playMode === 'vs'
        ? initialAwayIds?.[0]
        : initialHomeIds?.[1];
    const idx = roster.findIndex((p) => p.id === fallback);
    if (idx >= 0) return idx;
    return Math.min(1, roster.length - 1);
  });
  const [p1Locked, setP1Locked] = useState(false);
  const [p2Locked, setP2Locked] = useState(false);

  const p1 = roster[p1Index] ?? roster[0];
  const p2 = roster[p2Index] ?? roster[0];

  const moveCursor = useCallback((index, dx, dy) => {
    const cols = GRID_COLS;
    const rows = Math.ceil(roster.length / cols);
    let col = index % cols;
    let row = Math.floor(index / cols);
    col = (col + dx + cols) % cols;
    row = Math.max(0, Math.min(rows - 1, row + dy));
    let next = row * cols + col;
    if (next >= roster.length) next = roster.length - 1;
    return next;
  }, [roster.length]);

  useEffect(() => {
    const onKey = (event) => {
      const key = event.key;

      // P1 navigasyon
      if (!p1Locked) {
        if (key === 'a' || key === 'A') {
          event.preventDefault();
          setP1Index((i) => moveCursor(i, -1, 0));
          Sfx.select();
        } else if (key === 'd' || key === 'D') {
          event.preventDefault();
          setP1Index((i) => moveCursor(i, 1, 0));
          Sfx.select();
        } else if (key === 'w' || key === 'W') {
          event.preventDefault();
          setP1Index((i) => moveCursor(i, 0, -1));
          Sfx.select();
        } else if (key === 's' || key === 'S') {
          event.preventDefault();
          setP1Index((i) => moveCursor(i, 0, 1));
          Sfx.select();
        } else if (key === ' ' || key === 'z' || key === 'Z') {
          event.preventDefault();
          setP1Locked(true);
          Sfx.confirm();
        }
      }

      // P2 navigasyon
      if (!p2Locked) {
        if (key === 'ArrowLeft') {
          event.preventDefault();
          setP2Index((i) => moveCursor(i, -1, 0));
          Sfx.select();
        } else if (key === 'ArrowRight') {
          event.preventDefault();
          setP2Index((i) => moveCursor(i, 1, 0));
          Sfx.select();
        } else if (key === 'ArrowUp') {
          event.preventDefault();
          setP2Index((i) => moveCursor(i, 0, -1));
          Sfx.select();
        } else if (key === 'ArrowDown') {
          event.preventDefault();
          setP2Index((i) => moveCursor(i, 0, 1));
          Sfx.select();
        } else if (key === 'Enter' || key === 'NumpadEnter' || key === 'Numpad0') {
          event.preventDefault();
          setP2Locked(true);
          Sfx.confirm();
        }
      }

      if (key === 'Backspace' || key === 'Escape') {
        if (p1Locked || p2Locked) {
          event.preventDefault();
          setP1Locked(false);
          setP2Locked(false);
          Sfx.select();
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p1Locked, p2Locked, moveCursor]);

  const canStart = p1Locked && p2Locked && p1 && p2;

  const handleStart = () => {
    if (!canStart) return;
    Sfx.confirm();
    if (playMode === 'vs') {
      onStart({
        playMode: 'vs',
        mode: '1v1',
        difficulty,
        format,
        homeIds: [p1.id],
        awayIds: [p2.id],
        opponentId: 'vs-local',
        opponentRandom: false,
      });
      return;
    }

    onStart({
      playMode: 'coop',
      mode: '2v2',
      difficulty,
      format,
      homeIds: [p1.id, p2.id],
      opponentId: opponentId === 'random' ? undefined : opponentId,
      opponentRandom: opponentId === 'random',
    });
  };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1100px] flex-col gap-4 px-3 pb-28 pt-5 sm:gap-5 sm:px-4 sm:pb-10 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[8px] tracking-widest text-retro-accent">{playMeta.label}</p>
          <h2 className="mt-1 text-base text-turkiye-red text-outline-red sm:text-xl">
            KARAKTER SEÇ
          </h2>
          <p className="mt-1 text-[7px] text-white/45">{playMeta.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <MuteButton muted={muted} onToggle={onToggleMute} />
          <button type="button" className="retro-button-ghost px-3 py-2 text-[8px]" onClick={onBack}>
            ← GERİ
          </button>
        </div>
      </div>

      {/* Zorluk + format */}
      <div className="retro-panel flex flex-col gap-3 px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[7px] tracking-widest text-retro-accent">AI ZORLUK</span>
          {Object.values(DIFFICULTY).map((item) => (
            <button
              key={item.id}
              type="button"
              title={item.blurb}
              onClick={() => {
                Sfx.select();
                setDifficulty(item.id);
              }}
              className={`border-2 px-2.5 py-1.5 text-[8px] ${
                difficulty === item.id
                  ? 'border-turkiye-red bg-turkiye-red/25 text-white'
                  : 'border-white/20 text-white/70'
              }`}
            >
              {item.label}
            </button>
          ))}
          <span className="text-[7px] text-white/40">{DIFFICULTY[difficulty]?.blurb}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[7px] tracking-widest text-retro-accent">FORMAT</span>
          {Object.values(FORMATS).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                Sfx.select();
                setFormat(item.id);
              }}
              className={`border-2 px-2.5 py-1.5 text-[8px] ${
                format === item.id
                  ? 'border-turkiye-red bg-turkiye-red/25 text-white'
                  : 'border-white/20 text-white/70'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {playMode === 'coop' && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[7px] tracking-widest text-retro-accent">RAKİP AI</span>
            <button
              type="button"
              onClick={() => {
                Sfx.select();
                setOpponentId('random');
              }}
              className={`border-2 px-2.5 py-1.5 text-[8px] ${
                opponentId === 'random'
                  ? 'border-turkiye-red bg-turkiye-red/25'
                  : 'border-white/20 text-white/70'
              }`}
            >
              RASTGELE
            </button>
            {OPPONENT_TEAMS.map((team) => (
              <button
                key={team.id}
                type="button"
                onClick={() => {
                  Sfx.select();
                  setOpponentId(team.id);
                }}
                className={`border-2 px-2.5 py-1.5 text-[8px] ${
                  opponentId === team.id
                    ? 'border-turkiye-red bg-turkiye-red/25'
                    : 'border-white/20 text-white/70'
                }`}
              >
                {team.shortName}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* VS / Co-Op portreleri */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PortraitCard
          label="P1"
          color="#E30A17"
          player={p1}
          locked={p1Locked}
          hint="WASD · SPACE"
          side="left"
        />
        <PortraitCard
          label={playMode === 'vs' ? 'P2' : 'P2 · TAKIM'}
          color="#9BB0FF"
          player={p2}
          locked={p2Locked}
          hint="OKLAR · ENTER"
          side="right"
        />
      </div>

      {/* Grid */}
      <div className="retro-panel px-3 py-3 sm:px-4 sm:py-4">
        <p className="mb-3 text-center text-[7px] tracking-widest text-white/45">
          SULTAN IZGARASI
        </p>
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {roster.map((player, index) => {
            const isP1 = index === p1Index;
            const isP2 = index === p2Index;
            return (
              <button
                key={player.id}
                type="button"
                onClick={() => {
                  if (!p1Locked) {
                    setP1Index(index);
                    Sfx.select();
                  } else if (!p2Locked) {
                    setP2Index(index);
                    Sfx.select();
                  }
                }}
                className={`relative flex flex-col items-center gap-1 border-4 px-1 py-2 transition ${
                  isP1 && isP2
                    ? 'border-white bg-white/10'
                    : isP1
                      ? 'border-turkiye-red bg-turkiye-red/20'
                      : isP2
                        ? 'border-[#9BB0FF] bg-[#9BB0FF]/15'
                        : 'border-white/15 bg-retro-panel/60'
                }`}
              >
                {(isP1 || isP2) && (
                  <span
                    className={`absolute -left-1 -top-1 border-2 border-black px-1 text-[6px] ${
                      isP1 ? 'bg-turkiye-red text-white' : 'bg-[#9BB0FF] text-black'
                    }`}
                  >
                    {isP1 && isP2 ? 'P1+P2' : isP1 ? 'P1' : 'P2'}
                  </span>
                )}
                <PixelAvatar player={player} scale={2} />
                <span className="text-center text-[6px] leading-tight sm:text-[7px]">
                  {upper(player.name)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t-4 border-white/20 bg-retro-bg/95 px-3 py-3 backdrop-blur-sm sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
        <div className="mx-auto flex max-w-[1100px] flex-col items-center gap-2 pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            className="retro-button w-full max-w-md px-8 py-3 text-sm sm:w-auto"
            disabled={!canStart}
            onClick={handleStart}
          >
            MAÇA BAŞLA
          </button>
          <p className="text-[7px] text-white/45">
            {!p1Locked && 'P1 SPACE İLE ONAYLASIN'}
            {p1Locked && !p2Locked && 'P2 ENTER İLE ONAYLASIN'}
            {canStart && 'HAZIR — BAŞLAT'}
            {' · '}
            ESC KİLİTLERİ AÇAR
          </p>
        </div>
      </div>
    </div>
  );
}

function PortraitCard({ label, color, player, locked, hint, side }) {
  return (
    <div
      className={`retro-panel flex items-center gap-4 px-4 py-4 ${
        side === 'right' ? 'sm:flex-row-reverse' : ''
      }`}
      style={{ boxShadow: locked ? `0 0 0 3px ${color}` : undefined }}
    >
      <PixelAvatar player={player} scale={5} pose={locked ? 'cheer' : 'idle'} />
      <div className={side === 'right' ? 'text-right' : ''}>
        <p className="text-[8px] tracking-widest" style={{ color }}>
          {label} {locked ? '✓' : ''}
        </p>
        <h3 className="mt-1 text-sm text-white">{upper(player?.name ?? '')}</h3>
        <p className="mt-1 text-[7px] text-white/45">
          #{player?.number} · {player?.position}
        </p>
        <p className="mt-2 text-[6px] text-white/35">{hint}</p>
      </div>
    </div>
  );
}
