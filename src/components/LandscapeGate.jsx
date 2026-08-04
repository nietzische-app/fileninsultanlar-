/**
 * Dik dikey telefonda "yataya çevir" katmanı.
 * Oyun yatay olmadan etkileşime açılmaz.
 */
export default function LandscapeGate({ blocked, onUnlock }) {
  if (!blocked) return null;

  return (
    <div
      className="landscape-gate fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-retro-bg px-6 text-center"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="landscape-gate-title"
      aria-describedby="landscape-gate-desc"
    >
      <div className="rotate-phone" aria-hidden="true">
        <span className="rotate-phone__device" />
        <span className="rotate-phone__arrow">↻</span>
      </div>

      <h2
        id="landscape-gate-title"
        className="text-lg leading-relaxed text-turkiye-red text-outline-red sm:text-2xl"
      >
        YATAYA ÇEVİR
      </h2>
      <p
        id="landscape-gate-desc"
        className="max-w-sm text-[8px] leading-relaxed text-white/70 sm:text-[9px]"
      >
        Bu oyun yatay ekranda oynanır. Telefonunu yana çevir; saha ve kontroller
        ancak o zaman açılır.
      </p>

      <button type="button" className="retro-button px-6 py-3 text-[9px]" onClick={onUnlock}>
        YATAY KİLİTLE / TAM EKRAN
      </button>
      <p className="text-[6px] text-white/35">
        Bazı telefonlarda kilit desteklenmez — elle yataya çevirmen yeterli.
      </p>
    </div>
  );
}
