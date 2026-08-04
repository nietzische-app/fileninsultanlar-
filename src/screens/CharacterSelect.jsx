import { useMemo, useState } from 'react';
import PixelAvatar from '../components/PixelAvatar.jsx';
import StatBar from '../components/StatBar.jsx';
import {
  DEFAULT_PLAYER_ID,
  ROSTER,
  formatBirthDate,
  getAge,
} from '../game/players.js';
import { DIFFICULTY } from '../game/constants.js';
import Sfx from '../game/audio.js';
import { upper } from '../utils/text.js';

const MODES = [
  { id: '1v1', label: '1 vs 1', description: 'Tek sultan, tek rakip. Klasik düello.' },
  { id: '2v2', label: '2 vs 2', description: 'İki sultan sahada — biri sen, biri takım arkadaşın.' },
];

/**
 * Karakter seçim ekranı — mod, zorluk ve kadro seçimi.
 */
/** Künye satırı — bilinmeyen değer '—' gösterilir. */
function Fact({ label, value }) {
  return (
    <div>
      <dt className="text-white/35">{label}</dt>
      <dd className="mt-[2px] text-white/70">{value}</dd>
    </div>
  );
}

export default function CharacterSelect({ onBack, onStart }) {
  const [mode, setMode] = useState('1v1');
  const [difficulty, setDifficulty] = useState('normal');
  const [selected, setSelected] = useState([DEFAULT_PLAYER_ID]);
  const [focused, setFocused] = useState(DEFAULT_PLAYER_ID);

  const required = mode === '2v2' ? 2 : 1;
  const focusedPlayer = useMemo(
    () => ROSTER.find((p) => p.id === focused) ?? ROSTER[0],
    [focused]
  );

  const handleModeChange = (nextMode) => {
    Sfx.select();
    setMode(nextMode);
    // 2v2 → 1v1 geçişinde fazla seçimi kırp
    setSelected((prev) => prev.slice(0, nextMode === '2v2' ? 2 : 1));
  };

  const togglePlayer = (id) => {
    Sfx.select();
    setFocused(id);

    setSelected((prev) => {
      if (prev.includes(id)) {
        // Son oyuncuyu çıkarmaya izin verme
        return prev.length === 1 ? prev : prev.filter((p) => p !== id);
      }
      if (prev.length >= required) {
        // Kadro dolu — en eski seçimi düşür (kaydırmalı seçim)
        return [...prev.slice(1), id];
      }
      return [...prev, id];
    });
  };

  const canStart = selected.length === required;

  const handleStart = () => {
    if (!canStart) return;
    Sfx.confirm();
    onStart({ mode, difficulty, homeIds: selected });
  };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1100px] flex-col gap-6 px-4 py-8">
      {/* Başlık */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg text-turkiye-red text-outline-red sm:text-xl">
            KADRONU SEÇ
          </h2>
          <p className="mt-2 text-[8px] text-white/50">
            {required === 2 ? 'İKİ SULTAN SEÇ' : 'BİR SULTAN SEÇ'} · SEÇİLEN{' '}
            {selected.length}/{required}
          </p>
        </div>
        <button type="button" className="retro-button-ghost" onClick={onBack}>
          ← GERİ
        </button>
      </div>

      {/* Mod ve zorluk */}
      <div className="grid gap-4 md:grid-cols-2">
        <fieldset className="retro-panel px-4 py-4">
          <legend className="px-2 text-[8px] text-retro-accent">OYUN MODU</legend>
          <div className="flex flex-col gap-3">
            {MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleModeChange(item.id)}
                className={`border-2 px-3 py-3 text-left transition ${
                  mode === item.id
                    ? 'border-turkiye-red bg-turkiye-red/20'
                    : 'border-white/20 hover:border-white/50'
                }`}
              >
                <div className="text-[10px]">{item.label}</div>
                <div className="mt-1 text-[7px] leading-relaxed text-white/50">
                  {item.description}
                </div>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="retro-panel px-4 py-4">
          <legend className="px-2 text-[8px] text-retro-accent">ZORLUK</legend>
          <div className="flex flex-col gap-3">
            {Object.entries(DIFFICULTY).map(([key, value]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  Sfx.select();
                  setDifficulty(key);
                }}
                className={`border-2 px-3 py-3 text-left transition ${
                  difficulty === key
                    ? 'border-turkiye-red bg-turkiye-red/20'
                    : 'border-white/20 hover:border-white/50'
                }`}
              >
                <div className="text-[10px]">{value.label}</div>
                <div className="mt-1 text-[7px] text-white/50">
                  Rakip hızı %{Math.round(value.speed * 100)} · Hata payı{' '}
                  {value.error}px
                </div>
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {/* Kadro ızgarası */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {ROSTER.map((player) => {
          const isSelected = selected.includes(player.id);
          const order = selected.indexOf(player.id) + 1;

          return (
            <button
              key={player.id}
              type="button"
              onClick={() => togglePlayer(player.id)}
              onMouseEnter={() => setFocused(player.id)}
              className={`relative flex flex-col items-center gap-2 border-4 px-2 py-3 transition ${
                isSelected
                  ? 'border-retro-accent bg-turkiye-red/25'
                  : focused === player.id
                    ? 'border-white/60 bg-retro-panel'
                    : 'border-white/15 bg-retro-panel/60 hover:border-white/40'
              }`}
              style={{ boxShadow: isSelected ? '5px 5px 0 0 rgba(0,0,0,0.6)' : undefined }}
            >
              {isSelected && (
                <span className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center border-2 border-black bg-retro-accent text-[9px] text-black">
                  {order}
                </span>
              )}
              {player.captain && (
                <span className="absolute right-1 top-1 text-[7px] text-retro-accent">
                  ★ K
                </span>
              )}

              <PixelAvatar player={player} scale={3} />

              <span className="text-[8px] leading-tight">{upper(player.name)}</span>
              <span className="text-[7px] text-white/45">
                #{player.number} · {player.position}
              </span>
              {player.height && (
                <span className="text-[7px] text-white/30">{player.height} cm</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Odaklanılan oyuncunun kartı */}
      <div className="retro-panel flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-start">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <PixelAvatar player={focusedPlayer} scale={5} pose="cheer" />
          <span className="text-[9px] text-retro-accent">#{focusedPlayer.number}</span>
        </div>

        <div className="flex-1">
          <h3 className="text-sm text-white">{upper(focusedPlayer.name)}</h3>
          <p className="mt-1 text-[8px] text-white/50">
            {focusedPlayer.position}
            {focusedPlayer.captain && ' · KAPTAN'}
          </p>

          {/* Künye — kadro listesindeki gerçek bilgiler */}
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[7px] sm:grid-cols-4">
            <Fact label="DOĞUM" value={formatBirthDate(focusedPlayer)} />
            <Fact
              label="YAŞ"
              value={getAge(focusedPlayer) !== null ? `${getAge(focusedPlayer)}` : '—'}
            />
            <Fact
              label="BOY"
              value={focusedPlayer.height ? `${focusedPlayer.height} cm` : '—'}
            />
            <Fact
              label="KİLO"
              value={focusedPlayer.weight ? `${focusedPlayer.weight} kg` : '—'}
            />
          </dl>

          <div
            className="mt-3 border-l-4 py-1 pl-3"
            style={{ borderColor: focusedPlayer.colors.accent }}
          >
            <p className="text-[8px]" style={{ color: focusedPlayer.colors.accent }}>
              BONUS: {upper(focusedPlayer.bonus.name)}
            </p>
            <p className="mt-1 text-[7px] leading-relaxed text-white/60">
              {focusedPlayer.bonus.description}
            </p>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <StatBar label="SMAÇ" value={focusedPlayer.stats.attack} compact />
            <StatBar label="BLOK" value={focusedPlayer.stats.block} compact color="#FFC633" />
            <StatBar label="SERVİS" value={focusedPlayer.stats.serve} compact color="#FF7A18" />
            <StatBar label="SAVUNMA" value={focusedPlayer.stats.defense} compact color="#5FC2E8" />
            <StatBar label="HIZ" value={focusedPlayer.stats.speed} compact color="#B7F5C6" />
            <StatBar label="DAYANIM" value={focusedPlayer.stats.stamina} compact color="#FF9ED2" />
          </div>
        </div>
      </div>

      {/* Başlat */}
      <div className="flex flex-col items-center gap-3 pb-4">
        <button
          type="button"
          className="retro-button px-10 py-4 text-sm"
          onClick={handleStart}
          disabled={!canStart}
        >
          MAÇA BAŞLA
        </button>
        {!canStart && (
          <p className="text-[8px] text-white/45">
            2v2 MODU İÇİN {required - selected.length} SULTAN DAHA SEÇ
          </p>
        )}
      </div>
    </div>
  );
}
