import { useMemo, useState } from 'react';
import PixelAvatar from '../components/PixelAvatar.jsx';
import StatBar from '../components/StatBar.jsx';
import MuteButton from '../components/MuteButton.jsx';
import {
  DEFAULT_PLAYER_ID,
  getActiveRoster,
  getBonusRoster,
  getPlayerById,
  formatBirthDate,
  getAge,
} from '../game/players.js';
import { DIFFICULTY, FORMATS, SURVIVAL } from '../game/constants.js';
import { OPPONENT_TEAMS } from '../game/opponents.js';
import { getGameMode } from '../game/modes.js';
import { TOURNAMENT_ROUNDS } from '../game/tournament.js';
import Sfx from '../game/audio.js';
import { upper } from '../utils/text.js';

const MODES = [
  { id: '1v1', label: '1 vs 1', description: 'Tek sultan, tek rakip.' },
  {
    id: '2v2',
    label: '2 vs 2',
    description: 'İki sultan — sen + AI takım arkadaşı.',
  },
];

/** Künye satırı — bilinmeyen değer '—' gösterilir. */
function Fact({ label, value }) {
  return (
    <div>
      <dt className="text-white/35">{label}</dt>
      <dd className="mt-[2px] text-white/70">{value}</dd>
    </div>
  );
}

/**
 * @param {string[]} ids
 * @param {string} mode
 */
function sanitizeHomeIds(ids, mode) {
  const required = mode === '2v2' ? 2 : 1;
  const valid = (Array.isArray(ids) ? ids : [])
    .filter((id) => Boolean(getPlayerById(id)))
    .slice(0, required);
  if (valid.length === 0) return [DEFAULT_PLAYER_ID];
  return valid;
}

/**
 * Karakter seçim ekranı — mod, zorluk, format, rakip ve kadro.
 */
export default function CharacterSelect({
  onBack,
  onStart,
  muted,
  onToggleMute,
  campaign = 'match',
  playMode = 'solo',
  modeId = 'match',
  initialMode = '1v1',
  initialDifficulty = 'normal',
  initialFormat = 'classic',
  initialOpponentId = 'random',
  initialHomeIds,
}) {
  const gameMode = getGameMode(modeId);
  const twoPlayer = playMode === 'coop' || playMode === 'vs';
  // Turnuvada rakip ve format turlara bağlı, hayatta kalmada dalgalara —
  // ikisi de oyuncunun seçeceği şey değil.
  const picksMatchup = gameMode.pickOpponent;
  const [mode, setMode] = useState(initialMode === '2v2' ? '2v2' : '1v1');
  const [difficulty, setDifficulty] = useState(
    DIFFICULTY[initialDifficulty] ? initialDifficulty : 'normal'
  );
  const [format, setFormat] = useState(
    FORMATS[initialFormat] ? initialFormat : 'classic'
  );
  const [opponentId, setOpponentId] = useState(
    initialOpponentId === 'random' || OPPONENT_TEAMS.some((t) => t.id === initialOpponentId)
      ? initialOpponentId
      : 'random'
  );
  const [selected, setSelected] = useState(() =>
    sanitizeHomeIds(initialHomeIds, initialMode === '2v2' ? '2v2' : '1v1')
  );
  const [focused, setFocused] = useState(() => selected[0] ?? DEFAULT_PLAYER_ID);

  const activeRoster = useMemo(() => getActiveRoster(), []);
  const bonusRoster = useMemo(() => getBonusRoster(), []);

  /*
   * Co-Op iki sultanı aynı takımda oynatır → 2v2 zorunlu.
   * VS'te 2. oyuncu rakip takımı sürer, ev sahibi kadro tek kişiliktir.
   */
  const required = playMode === 'coop' ? 2 : mode === '2v2' ? 2 : 1;
  const focusedPlayer = useMemo(
    () => getPlayerById(focused) ?? activeRoster[0],
    [focused, activeRoster]
  );

  const handleModeChange = (nextMode) => {
    Sfx.select();
    setMode(nextMode);
    setSelected((prev) => prev.slice(0, nextMode === '2v2' ? 2 : 1));
  };

  const togglePlayer = (id) => {
    Sfx.select();
    setFocused(id);

    setSelected((prev) => {
      if (prev.includes(id)) {
        return prev.length === 1 ? prev : prev.filter((p) => p !== id);
      }
      if (prev.length >= required) {
        return [...prev.slice(1), id];
      }
      return [...prev, id];
    });
  };

  const canStart = selected.length === required;

  const handleStart = () => {
    if (!canStart) return;
    Sfx.confirm();

    if (!picksMatchup) {
      // Kampanya modlarında format/rakip yapılandırması çağırana ait
      onStart({ campaign, playMode, mode, difficulty, homeIds: selected });
      return;
    }

    onStart({
      campaign,
      playMode,
      mode: playMode === 'coop' ? '2v2' : playMode === 'vs' ? '1v1' : mode,
      difficulty,
      format,
      // random ise undefined — Game rastgele seçer; bitişte id kilitlenir
      opponentId: opponentId === 'random' ? undefined : opponentId,
      opponentRandom: opponentId === 'random',
      homeIds: selected,
    });
  };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1100px] flex-col gap-4 px-3 pb-28 pt-5 sm:gap-6 sm:px-4 sm:pb-10 sm:py-8">
      {/* Başlık */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base text-turkiye-red text-outline-red sm:text-xl">
            KADRONU SEÇ
          </h2>
          <p className="mt-1 text-[7px] text-white/50 sm:mt-2 sm:text-[8px]">
            {!picksMatchup && (
              <span className="text-retro-accent">{gameMode.label} · </span>
            )}
            {required === 2
              ? playMode === 'coop'
                ? 'İKİ SULTAN · 1. VE 2. OYUNCU'
                : 'İKİ SULTAN · 1. SEN, 2. AI'
              : 'BİR SULTAN SEÇ'}{' '}
            ·{' '}
            {selected.length}/{required}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <MuteButton muted={muted} onToggle={onToggleMute} />
          <button type="button" className="retro-button-ghost px-3 py-2 text-[8px]" onClick={onBack}>
            ← GERİ
          </button>
        </div>
      </div>

      {/* Ayarlar — kompakt chip satırları */}
      <div className="retro-panel flex flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4">
        {twoPlayer ? (
          <div className="border-l-4 border-retro-accent/70 py-1 pl-3">
            <p className="text-[8px] text-retro-accent">
              {gameMode.label} · {playMode === 'coop' ? '2 vs 2' : '1 vs 1'}
            </p>
            <div className="mt-2 grid gap-1 text-[7px] leading-relaxed text-white/60 sm:grid-cols-2">
              <span>
                <b className="text-white/80">1. OYUNCU</b> — W A S D · BOŞLUK vur · X Sultan
              </span>
              <span>
                <b className="text-white/80">2. OYUNCU</b> — ok tuşları · ENTER vur
              </span>
            </div>
            <p className="mt-2 text-[7px] leading-relaxed text-white/45">
              {playMode === 'coop'
                ? 'İki sultan aynı takımda; rakip yapay zekâ.'
                : '2. oyuncu rakip takımı sürer. Sultan Gücü yalnızca Türkiye\'nindir.'}
            </p>
          </div>
        ) : (
          <ChipRow label="MOD">
            {MODES.map((item) => (
              <Chip
                key={item.id}
                active={mode === item.id}
                onClick={() => handleModeChange(item.id)}
                title={item.description}
              >
                {item.label}
              </Chip>
            ))}
          </ChipRow>
        )}

        <ChipRow label="ZORLUK">
          {Object.entries(DIFFICULTY).map(([key, value]) => (
            <Chip
              key={key}
              active={difficulty === key}
              onClick={() => {
                Sfx.select();
                setDifficulty(key);
              }}
            >
              {value.label}
            </Chip>
          ))}
        </ChipRow>

        {picksMatchup ? (
          <>
            <ChipRow label="FORMAT">
              {Object.values(FORMATS).map((item) => (
                <Chip
                  key={item.id}
                  active={format === item.id}
                  onClick={() => {
                    Sfx.select();
                    setFormat(item.id);
                  }}
                  title={item.description}
                >
                  {item.label}
                </Chip>
              ))}
            </ChipRow>

            <ChipRow label="RAKİP" wrap>
              <Chip
                active={opponentId === 'random'}
                onClick={() => {
                  Sfx.select();
                  setOpponentId('random');
                }}
              >
                RASTGELE
              </Chip>
              {OPPONENT_TEAMS.map((team) => (
                <Chip
                  key={team.id}
                  active={opponentId === team.id}
                  onClick={() => {
                    Sfx.select();
                    setOpponentId(team.id);
                  }}
                  title={team.blurb}
                >
                  <span
                    className="mr-1.5 inline-block h-2 w-2 border border-black/40"
                    style={{ backgroundColor: team.colors.primary }}
                  />
                  {team.shortName}
                </Chip>
              ))}
            </ChipRow>
          </>
        ) : (
          <div className="border-l-4 border-retro-accent/70 py-1 pl-3">
            <p className="text-[8px] text-retro-accent">{gameMode.label}</p>
            <p className="mt-1 text-[7px] leading-relaxed text-white/60">
              {campaign === 'tournament'
                ? `${TOURNAMENT_ROUNDS.length} tur, ${TOURNAMENT_ROUNDS.length} rakip. Rakip ve format turlara göre belirlenir; zorluk her turda bir tık artar.`
                : `${SURVIVAL.lives} can. Her ${SURVIVAL.waveLength} puanda yeni dalga: rakip değişir ve sertleşir. Seçtiğin zorluk başlangıç seviyesidir.`}
            </p>
          </div>
        )}
      </div>

      {/* Aktif kadro */}
      <RosterGrid
        title="AKTİF KADRO"
        players={activeRoster}
        selected={selected}
        focused={focused}
        onSelect={togglePlayer}
        onFocus={setFocused}
      />

      {bonusRoster.length > 0 && (
        <div className="flex flex-col gap-2 sm:gap-3">
          <div>
            <p className="text-[8px] tracking-widest text-retro-accent">★ BONUS KADRO ★</p>
            <p className="mt-1 text-[7px] text-white/40">
              Milletler Ligi&apos;nde dinlenen sultanlar
            </p>
          </div>
          <RosterGrid
            players={bonusRoster}
            selected={selected}
            focused={focused}
            onSelect={togglePlayer}
            onFocus={setFocused}
            guest
          />
        </div>
      )}

      {/* Odak kartı — mobilde daha sıkı */}
      <div className="retro-panel flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:gap-5 sm:px-5 sm:py-5">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <PixelAvatar player={focusedPlayer} scale={4} pose="cheer" />
          <span className="text-[9px] text-retro-accent">#{focusedPlayer.number}</span>
        </div>

        <div className="flex-1">
          <h3 className="text-sm text-white">{upper(focusedPlayer.name)}</h3>
          <p className="mt-1 text-[8px] text-white/50">
            {focusedPlayer.position}
            {focusedPlayer.captain && ' · KAPTAN'}
            {focusedPlayer.guest && ' · BONUS'}
          </p>

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

      {/* Sticky CTA — mobilde her zaman erişilir */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t-4 border-white/20 bg-retro-bg/95 px-3 py-3 backdrop-blur-sm sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
        <div className="mx-auto flex max-w-[1100px] flex-col items-center gap-2 pb-[env(safe-area-inset-bottom)] sm:pb-4">
          <button
            type="button"
            className="retro-button w-full max-w-md px-8 py-3 text-sm sm:w-auto sm:px-10 sm:py-4"
            onClick={handleStart}
            disabled={!canStart}
          >
            {campaign === 'tournament'
              ? 'KUPA YOLUNA ÇIK'
              : campaign === 'survival'
                ? 'SAHAYA ÇIK'
                : twoPlayer
                  ? 'İKİ KİŞİ BAŞLA'
                  : 'MAÇA BAŞLA'}
          </button>
          {!canStart && (
            <p className="text-[7px] text-white/45 sm:text-[8px]">
              {playMode === 'coop' ? 'CO-OP' : '2v2'} İÇİN{' '}
              {required - selected.length} SULTAN DAHA
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ChipRow({ label, children, wrap = false }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <span className="shrink-0 text-[7px] tracking-widest text-retro-accent sm:w-14">
        {label}
      </span>
      <div className={`flex gap-2 ${wrap ? 'flex-wrap' : 'flex-wrap sm:flex-nowrap'}`}>
        {children}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`border-2 px-2.5 py-1.5 text-[8px] transition sm:px-3 sm:py-2 sm:text-[9px] ${
        active
          ? 'border-turkiye-red bg-turkiye-red/25 text-white'
          : 'border-white/20 text-white/70 hover:border-white/50'
      }`}
    >
      {children}
    </button>
  );
}

function RosterGrid({ title, players, selected, focused, onSelect, onFocus, guest = false }) {
  return (
    <div className="flex flex-col gap-2 sm:gap-3">
      {title && <p className="text-[8px] tracking-widest text-white/45">{title}</p>}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        {players.map((player) => {
          const isSelected = selected.includes(player.id);
          const order = selected.indexOf(player.id) + 1;

          return (
            <button
              key={player.id}
              type="button"
              onClick={() => onSelect(player.id)}
              onMouseEnter={() => onFocus(player.id)}
              className={`relative flex flex-col items-center gap-1 border-4 px-1 py-2 transition sm:gap-2 sm:px-2 sm:py-3 ${
                isSelected
                  ? 'border-retro-accent bg-turkiye-red/25'
                  : focused === player.id
                    ? 'border-white/60 bg-retro-panel'
                    : 'border-white/15 bg-retro-panel/60 hover:border-white/40'
              }`}
              style={{ boxShadow: isSelected ? '4px 4px 0 0 rgba(0,0,0,0.6)' : undefined }}
            >
              {isSelected && (
                <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center border-2 border-black bg-retro-accent text-[8px] text-black sm:h-6 sm:w-6 sm:text-[9px]">
                  {order}
                </span>
              )}
              {player.captain && (
                <span className="absolute right-0.5 top-0.5 text-[6px] text-retro-accent sm:text-[7px]">
                  ★ K
                </span>
              )}
              {guest && !player.captain && (
                <span className="absolute right-0.5 top-0.5 text-[5px] text-[#FFD24A]/80 sm:text-[6px]">
                  BONUS
                </span>
              )}

              <PixelAvatar player={player} scale={2} />

              <span className="text-center text-[6px] leading-tight sm:text-[8px]">
                {upper(player.name)}
              </span>
              <span className="hidden text-[7px] text-white/45 sm:block">
                #{player.number} · {player.position}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
