import { SULTAN } from '../game/constants.js';

/**
 * "Sultan Gücü" özel yetenek barı.
 *
 * Sayı alındıkça ve başarılı bloklarla dolar. Dolduğunda X tuşu
 * (veya dokunmatik SULTAN butonu) alevli smacı tetikler.
 */
export default function SultanBar({ charge, ready, armed, onActivate, compact = false }) {
  const percent = Math.min(100, (charge / SULTAN.max) * 100);
  const segments = compact ? 10 : 20;
  const filled = Math.round((percent / 100) * segments);

  return (
    <div
      className={`flex items-center ${
        compact ? 'w-full max-w-[14rem] gap-1.5' : 'w-full max-w-[900px] gap-3'
      }`}
    >
      <span
        className={`shrink-0 uppercase ${
          compact ? 'text-[6px]' : 'text-[8px]'
        } ${ready ? 'text-retro-accent' : 'text-white/50'}`}
      >
        {compact ? 'SULTAN' : 'Sultan Gücü'}
      </span>

      <div
        className={`relative flex flex-1 gap-[2px] border-2 ${
          compact ? 'h-2.5 p-[2px]' : 'h-6 p-[3px]'
        } ${ready ? 'border-retro-accent' : 'border-white/30'}`}
      >
        {Array.from({ length: segments }, (_, i) => (
          <span
            key={i}
            className="h-full flex-1"
            style={{
              backgroundColor:
                i < filled
                  ? segmentColor(i / segments, ready)
                  : 'rgba(255,255,255,0.08)',
            }}
          />
        ))}

        {ready && (
          <span className="pointer-events-none absolute inset-0 animate-shine" />
        )}
      </div>

      {!compact && (
        <button
          type="button"
          onClick={onActivate}
          disabled={!ready || armed}
          className={`shrink-0 border-2 px-3 py-2 text-[8px] uppercase transition ${
            armed
              ? 'border-retro-accent bg-retro-accent text-black'
              : ready
                ? 'animate-pulse-gold border-retro-accent bg-turkiye-red text-white'
                : 'cursor-not-allowed border-white/20 text-white/30'
          }`}
        >
          {armed ? 'AKTİF!' : 'X · ATEŞLE'}
        </button>
      )}
    </div>
  );
}

/** Bar dolarken kırmızıdan altına geçen renk skalası. */
function segmentColor(ratio, ready) {
  if (ready) return '#FFD24A';
  if (ratio < 0.5) return '#E30A17';
  if (ratio < 0.8) return '#FF7A18';
  return '#FFC633';
}
