import { useMemo } from 'react';
import MuteButton from '../components/MuteButton.jsx';
import PixelAvatar from '../components/PixelAvatar.jsx';
import { getPlayerById } from '../game/players.js';
import { roundStrength, tournamentLadder } from '../game/tournament.js';
import { FORMATS } from '../game/constants.js';
import Sfx from '../game/audio.js';
import { upper } from '../utils/text.js';

/**
 * Kupa yolu — turlar arasında görülen bracket ekranı.
 *
 * Her maçtan sonra buraya dönülür: geçilen turlar işaretlenir, sıradaki
 * rakip tanıtılır. Turnuva bittiğinde (kupa ya da elenme) App bu ekranı
 * atlayıp sonuç ekranına geçer.
 */
export default function TournamentScreen({
  state,
  onPlay,
  onQuit,
  muted,
  onToggleMute,
}) {
  const ladder = useMemo(() => tournamentLadder(state), [state]);
  const squad = useMemo(
    () => state.homeIds.map((id) => getPlayerById(id)).filter(Boolean),
    [state.homeIds]
  );

  const next = ladder.find((round) => round.status === 'current');
  const wins = state.results.filter((r) => r.won).length;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[760px] flex-col justify-center gap-5 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base text-turkiye-red text-outline-red sm:text-xl">
            KUPA YOLU
          </h2>
          <p className="mt-2 text-[7px] tracking-widest text-white/50 sm:text-[8px]">
            {wins}/{ladder.length} TUR GEÇİLDİ
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <MuteButton muted={muted} onToggle={onToggleMute} />
          <button
            type="button"
            className="retro-button-ghost px-3 py-2 text-[8px]"
            onClick={() => {
              Sfx.select();
              onQuit();
            }}
          >
            TURNUVADAN ÇIK
          </button>
        </div>
      </div>

      {/* Merdiven */}
      <div className="retro-panel flex flex-col gap-2 px-3 py-3 sm:px-4 sm:py-4">
        {ladder.map((round) => (
          <LadderRow key={round.id} round={round} />
        ))}
      </div>

      {/* Sıradaki maç */}
      {next && (
        <div className="retro-panel px-4 py-4">
          <p className="text-[7px] tracking-widest text-retro-accent">SIRADAKİ</p>
          <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-4 sm:grid-cols-[auto_1fr_auto]">
            <div className="flex items-center gap-2">
              {squad.map((player) => (
                <div key={player.id} className="flex flex-col items-center gap-1">
                  <PixelAvatar player={player} scale={3} pose="idle" />
                  <span className="text-[6px] text-white/55">{upper(player.name)}</span>
                </div>
              ))}
            </div>

            <div className="text-center">
              <p className="text-sm text-white sm:text-lg">{next.label}</p>
              <p className="mt-1 text-[7px] text-white/45">
                {FORMATS[next.format]?.label ?? next.format} ·{' '}
                {next.rules.pointsPerSet} SAYI
                {next.rules.setsToWin > 1 ? ` · 3 SETTE ${next.rules.setsToWin}` : ''}
              </p>
            </div>

            {/* Dar ekranda rakip kartı alta düşer, taşma yapmasın */}
            <div className="col-span-2 border-t-2 border-white/10 pt-3 text-center sm:col-span-1 sm:border-l-2 sm:border-t-0 sm:pl-4 sm:pt-0 sm:text-right">
              <p
                className="text-[9px]"
                style={{ color: next.opponent?.colors.accent ?? '#9BB0FF' }}
              >
                {next.opponent?.name ?? 'RAKİP'}
              </p>
              <p className="mt-1 text-[7px] leading-relaxed text-white/45 sm:max-w-[150px]">
                {next.opponent?.blurb ?? ''}
              </p>
              {/*
                Zorluk turdan tura artıyor ama oyuncu bunu ancak sahada
                hissediyordu. Yıldızlar rampayı görünür kılıyor.
              */}
              <p className="mt-2 text-[7px] tracking-widest text-retro-accent sm:text-right">
                GÜÇ <GucYildizi seviye={roundStrength(next)} />
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-center pb-2">
        <button
          type="button"
          className="retro-button px-10 py-4 text-sm"
          onClick={() => {
            Sfx.unlock();
            Sfx.confirm();
            onPlay();
          }}
        >
          {wins === 0 ? 'TURNUVAYA BAŞLA' : 'SONRAKİ TURA ÇIK'}
        </button>
      </div>
    </div>
  );
}

function LadderRow({ round }) {
  const tone =
    round.status === 'won'
      ? 'border-retro-accent bg-retro-accent/10'
      : round.status === 'lost'
        ? 'border-white/25 bg-white/5 opacity-70'
        : round.status === 'current'
          ? 'border-turkiye-red bg-turkiye-red/20'
          : 'border-white/12 opacity-45';

  const badge =
    round.status === 'won'
      ? '✓'
      : round.status === 'lost'
        ? '✗'
        : round.status === 'current'
          ? '▶'
          : '·';

  return (
    <div className={`flex items-center gap-3 border-2 px-3 py-2 ${tone}`}>
      <span className="w-4 shrink-0 text-center text-[9px] text-retro-accent">
        {badge}
      </span>
      <span className="w-24 shrink-0 text-[7px] text-white/70 sm:w-28 sm:text-[8px]">
        {round.label}
      </span>
      <span
        className="mr-1 inline-block h-2.5 w-2.5 shrink-0 border border-black/40"
        style={{ backgroundColor: round.opponent?.colors.primary ?? '#333' }}
      />
      <span className="min-w-0 flex-1 truncate text-[7px] text-white/55 sm:text-[8px]">
        {round.opponent?.name ?? '—'}
      </span>
      <span className="shrink-0 text-[7px] text-retro-accent/70">
        <GucYildizi seviye={roundStrength(round)} />
      </span>
      {round.result && (
        <span className="shrink-0 text-[7px] text-white/45 sm:text-[8px]">
          {round.result.sets.home}-{round.result.sets.away}
        </span>
      )}
    </div>
  );
}

/**
 * Rakip gücü — dolu/boş yıldız.
 *
 * Ekran okuyucu için metin karşılığı da veriliyor; yalnızca sembol
 * bırakıldığında "yıldız yıldız yıldız" diye okunuyor.
 */
function GucYildizi({ seviye }) {
  const dolu = '★'.repeat(seviye);
  const bos = '☆'.repeat(5 - seviye);
  return (
    <span aria-label={`Rakip gücü: 5 üzerinden ${seviye}`} title={`Güç ${seviye}/5`}>
      {dolu}
      <span className="text-white/25">{bos}</span>
    </span>
  );
}
