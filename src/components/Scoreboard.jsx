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
  compact = false,
}) {
  const accentClass = awayAccent.startsWith('text-') || awayAccent.startsWith('#')
    ? awayAccent.startsWith('#')
      ? undefined
      : awayAccent
    : undefined;
  const accentStyle = awayAccent.startsWith('#') ? { color: awayAccent } : undefined;

  return (
    <div
      className={`retro-panel w-full max-w-[900px] ${
        compact ? 'px-2 py-2 sm:px-5 sm:py-3' : 'px-3 py-3 sm:px-5'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <TeamBlock
          name="TÜRKİYE"
          flag
          points={score.home}
          sets={sets.home}
          accent="text-turkiye-red"
          align="left"
          compact={compact}
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
          compact={compact}
        />
      </div>

      {setHistory.length > 0 && !compact && (
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

      {setHistory.length > 0 && compact && (
        <div className="mt-1 hidden flex-wrap items-center justify-center gap-1 border-t border-white/10 pt-1 sm:flex">
          {setHistory.map((set, i) => (
            <span key={i} className="text-[6px] text-white/40">
              {set.home}-{set.away}
              {i < setHistory.length - 1 ? ' · ' : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TeamBlock({ name, points, sets, accent, accentStyle, align, flag = false, compact = false }) {
  const isLeft = align === 'left';

  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3 ${
        isLeft ? 'justify-start' : 'flex-row-reverse justify-start'
      }`}
    >
      {flag && !compact && <MiniFlag />}
      {flag && compact && (
        <span className="hidden sm:inline-flex">
          <MiniFlag />
        </span>
      )}
      <div className={`flex min-w-0 flex-col ${isLeft ? 'items-start' : 'items-end'}`}>
        <span
          className={`truncate text-[7px] sm:text-[10px] ${accent ?? ''}`}
          style={accentStyle}
        >
          {name}
        </span>
        <span className="text-[7px] text-white/40 sm:text-[8px]">{sets} SET</span>
      </div>
      <span
        className={`ml-auto text-shadow-pixel text-white ${
          compact ? 'text-lg sm:text-3xl' : 'text-xl sm:text-3xl'
        }`}
      >
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
