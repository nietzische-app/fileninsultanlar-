import { RULES } from '../game/constants.js';

/**
 * Maç skor tablosu — Türkiye vs rakip takım, set takibi.
 */
export default function Scoreboard({
  score,
  sets,
  setNumber,
  setHistory,
  awayName = 'RAKİP',
  awayAccent = 'text-[#9BB0FF]',
  pointsPerSet = RULES.pointsPerSet,
}) {
  const accentClass = awayAccent.startsWith('text-') || awayAccent.startsWith('#')
    ? awayAccent.startsWith('#')
      ? undefined
      : awayAccent
    : undefined;
  const accentStyle = awayAccent.startsWith('#') ? { color: awayAccent } : undefined;

  return (
    <div className="retro-panel w-full max-w-[900px] px-3 py-3 sm:px-5">
      <div className="flex items-center justify-between gap-2">
        <TeamBlock
          name="TÜRKİYE"
          flag
          points={score.home}
          sets={sets.home}
          accent="text-turkiye-red"
          align="left"
        />

        <div className="flex shrink-0 flex-col items-center gap-1">
          <span className="text-[8px] text-white/50">SET {setNumber}</span>
          <span className="text-[9px] text-retro-accent sm:text-[11px]">
            {sets.home} — {sets.away}
          </span>
          <span className="text-[7px] text-white/35">{pointsPerSet} SAYI</span>
        </div>

        <TeamBlock
          name={awayName}
          points={score.away}
          sets={sets.away}
          accent={accentClass ?? 'text-[#9BB0FF]'}
          accentStyle={accentStyle}
          align="right"
        />
      </div>

      {setHistory.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 border-t-2 border-white/15 pt-2">
          {setHistory.map((set, i) => (
            <span
              key={i}
              className={`border-2 px-2 py-1 text-[7px] ${
                set.winner === 'home'
                  ? 'border-turkiye-red text-turkiye-red'
                  : 'border-[#9BB0FF]/60 text-[#9BB0FF]'
              }`}
            >
              {i + 1}. SET {set.home}-{set.away}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TeamBlock({ name, points, sets, accent, accentStyle, align, flag = false }) {
  const isLeft = align === 'left';

  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 sm:gap-3 ${
        isLeft ? 'justify-start' : 'flex-row-reverse justify-start'
      }`}
    >
      {flag && <MiniFlag />}
      <div className={`flex min-w-0 flex-col ${isLeft ? 'items-start' : 'items-end'}`}>
        <span
          className={`truncate text-[8px] sm:text-[10px] ${accent ?? ''}`}
          style={accentStyle}
        >
          {name}
        </span>
        <span className="text-[8px] text-white/40">{sets} SET</span>
      </div>
      <span className="ml-auto text-xl text-white text-shadow-pixel sm:text-3xl">
        {points}
      </span>
    </div>
  );
}

/** Küçük piksel Türk bayrağı. */
function MiniFlag() {
  return (
    <span
      className="relative inline-block h-5 w-8 shrink-0 border border-black/50"
      style={{ backgroundColor: '#E30A17' }}
      aria-hidden="true"
    >
      <span
        className="absolute rounded-full"
        style={{
          left: '5px',
          top: '4px',
          width: '11px',
          height: '11px',
          backgroundColor: '#FFFFFF',
        }}
      />
      <span
        className="absolute rounded-full"
        style={{
          left: '8px',
          top: '5px',
          width: '9px',
          height: '9px',
          backgroundColor: '#E30A17',
        }}
      />
      <span
        className="absolute"
        style={{
          left: '18px',
          top: '7px',
          width: '4px',
          height: '4px',
          backgroundColor: '#FFFFFF',
        }}
      />
    </span>
  );
}
