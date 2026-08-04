/**
 * Piksel tarzı stat çubuğu — 10 bloktan oluşur.
 */
export default function StatBar({ label, value, color = '#E30A17', compact = false }) {
  const blocks = 10;
  const filled = Math.round((value / 100) * blocks);

  return (
    <div className="flex items-center gap-2">
      <span
        className={`shrink-0 text-white/60 ${compact ? 'w-[52px] text-[7px]' : 'w-[64px] text-[8px]'}`}
      >
        {label}
      </span>
      <div className="flex gap-[2px]" aria-label={`${label}: ${value}/100`}>
        {Array.from({ length: blocks }, (_, i) => (
          <span
            key={i}
            className={compact ? 'h-2 w-[5px]' : 'h-3 w-[7px]'}
            style={{
              backgroundColor: i < filled ? color : 'rgba(255,255,255,0.14)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
