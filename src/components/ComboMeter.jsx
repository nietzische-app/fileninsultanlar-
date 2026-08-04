/**
 * Ralli kombosu göstergesi — smaç/blok/kurtarış zinciri.
 */
export default function ComboMeter({ combo = 0, best = 0, compact = false }) {
  if (combo < 2 && best < 2) return null;

  const hot = combo >= 5;
  const active = combo >= 2;

  return (
    <div
      className={`flex items-center justify-center gap-2 ${
        compact ? 'min-h-[1.1rem]' : 'min-h-[1.4rem]'
      }`}
      aria-live="polite"
      aria-label={active ? `Kombo ${combo}` : undefined}
    >
      {active ? (
        <p
          className={`animate-combo-pop font-pixel tracking-widest ${
            compact ? 'text-[10px]' : 'text-xs sm:text-sm'
          } ${hot ? 'text-turkiye-red text-outline-red' : 'text-retro-accent'}`}
        >
          x{combo} KOMBO
          {combo >= 5 ? '!' : ''}
        </p>
      ) : (
        <p className={`text-white/30 ${compact ? 'text-[7px]' : 'text-[8px]'}`}>
          EN İYİ x{best}
        </p>
      )}
    </div>
  );
}
