import { AudioSettings, ControlSettings } from '../components/SettingsPanels.jsx';
import Sfx from '../game/audio.js';

/**
 * Ayarlar ekranı — menüden açılan tam sayfa hâli.
 *
 * Bölümlerin kendisi `SettingsPanels` içinde; maç içindeki duraklatma
 * katmanı da aynı bileşenleri kullanıyor, böylece iki yer ayrışmıyor.
 */
export default function SettingsScreen({
  onBack,
  muted,
  onToggleMute,
  musicVolume,
  onMusicVolume,
  sfxVolume,
  onSfxVolume,
  controls,
  onControls,
  onReset,
}) {
  return (
    <div className="relative mx-auto flex min-h-full w-full max-w-2xl flex-col gap-5 px-4 py-8 sm:py-10">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg text-turkiye-red text-outline-red sm:text-2xl">AYARLAR</h1>
          <p className="mt-1 text-[7px] tracking-widest text-white/40">
            TERCİHLER BU CİHAZDA SAKLANIR
          </p>
        </div>
        <button type="button" className="retro-button-ghost px-4 py-2 text-[8px]" onClick={onBack}>
          ← GERİ
        </button>
      </header>

      <section className="retro-panel px-5 py-4">
        <h2 className="mb-4 text-[8px] tracking-widest text-retro-accent">★ SES ★</h2>
        <AudioSettings
          muted={muted}
          onToggleMute={onToggleMute}
          musicVolume={musicVolume}
          onMusicVolume={onMusicVolume}
          sfxVolume={sfxVolume}
          onSfxVolume={onSfxVolume}
        />
      </section>

      <section className="retro-panel px-5 py-4">
        <h2 className="mb-1 text-[8px] tracking-widest text-retro-accent">
          ★ DOKUNMATİK TUŞLAR ★
        </h2>
        <p className="mb-4 text-[7px] leading-relaxed text-white/45">
          Yalnızca dokunmatik cihazlarda görünür. Aşağıdaki önizleme
          gerçek tuşları gösterir. Maç sırasında duraklatıp da
          ayarlayabilirsin — orada gerçek tuşlar zaten ekranda olur.
        </p>
        <ControlSettings controls={controls} onControls={onControls} />
      </section>

      <section className="retro-panel px-5 py-4">
        <h2 className="mb-3 text-[8px] tracking-widest text-retro-accent">★ SIFIRLA ★</h2>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[7px] leading-relaxed text-white/45">
            Ses ve tuş ayarlarını fabrika değerlerine döndürür.
            Rekorlara ve rozetlere dokunmaz.
          </p>
          <button
            type="button"
            className="retro-button-ghost shrink-0 px-4 py-2 text-[8px]"
            onClick={() => {
              Sfx.select();
              onReset();
            }}
          >
            VARSAYILAN
          </button>
        </div>
      </section>
    </div>
  );
}
