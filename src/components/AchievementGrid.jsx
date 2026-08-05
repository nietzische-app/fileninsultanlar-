import { ACHIEVEMENTS } from '../game/achievements.js';

/**
 * Rozet ızgarası — açılanlar renkli, kilitliler sönük.
 *
 * Kilitli rozetin adı ve açıklaması gizlenmez: hedefi göstermek
 * rozetin işi. Sürpriz olsun diye saklamak, oyuncuya ne yapacağını
 * söylemeyen bir liste bırakırdı.
 */
export default function AchievementGrid({ unlocked = [], compact = false }) {
  const owned = new Set(unlocked);

  return (
    <div
      className={`grid gap-2 ${
        compact ? 'grid-cols-4 sm:grid-cols-6' : 'grid-cols-3 sm:grid-cols-4'
      }`}
    >
      {ACHIEVEMENTS.map((item) => {
        const has = owned.has(item.id);
        return (
          <div
            key={item.id}
            title={`${item.label} — ${item.description}`}
            className={`flex flex-col items-center gap-1 border-2 px-1 py-2 text-center transition ${
              has
                ? 'border-retro-accent/70 bg-retro-accent/10'
                : 'border-white/12 opacity-45'
            }`}
          >
            <span
              className={`text-sm leading-none ${
                has ? 'text-retro-accent' : 'text-white/40'
              }`}
              aria-hidden="true"
            >
              {item.icon}
            </span>
            {!compact && (
              <span
                className={`text-[6px] leading-tight ${
                  has ? 'text-white/80' : 'text-white/40'
                }`}
              >
                {item.label}
              </span>
            )}
            <span className="sr-only">
              {item.label}: {has ? 'açıldı' : 'kilitli'} — {item.description}
            </span>
          </div>
        );
      })}
    </div>
  );
}
