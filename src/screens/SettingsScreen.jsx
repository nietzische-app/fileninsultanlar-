import MuteButton from '../components/MuteButton.jsx';
import TouchControls from '../components/TouchControls.jsx';
import { DEFAULT_PREFS } from '../utils/storage.js';
import Sfx from '../game/audio.js';
import { upper } from '../utils/text.js';

/**
 * Ayarlar ekranı.
 *
 * Dokunmatik tuş bölümü canlı önizlemeli: ayarı değiştirirken tuşların
 * gerçek boyutunu görmezsen kör ayar yapmış olursun. Önizleme gerçek
 * `TouchControls` bileşenini kullanır — ayrı bir taklit çizmek, ikisi
 * ayrışınca oyuncuya yalan söylerdi.
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
  const setControl = (patch) => {
    Sfx.unlock();
    onControls(patch);
  };

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

      {/* --- Ses --- */}
      <section className="retro-panel px-5 py-4">
        <h2 className="mb-4 text-[8px] tracking-widest text-retro-accent">★ SES ★</h2>

        <div className="flex items-center justify-between gap-3 border-b-2 border-white/10 pb-3">
          <div>
            <p className="text-[9px] text-white">TÜM SESLER</p>
            <p className="mt-1 text-[7px] text-white/45">
              Kapatınca müzik de susar
            </p>
          </div>
          <MuteButton muted={muted} onToggle={onToggleMute} />
        </div>

        <Slider
          label="MÜZİK"
          hint="Giriş ekranındaki şarkı"
          value={musicVolume}
          onChange={onMusicVolume}
          disabled={muted}
        />
        <Slider
          label="EFEKTLER"
          hint="Vuruş, ıslık ve tribün"
          value={sfxVolume}
          onChange={onSfxVolume}
          disabled={muted}
          onCommit={() => Sfx.hit()}
        />
      </section>

      {/* --- Dokunmatik tuşlar --- */}
      <section className="retro-panel px-5 py-4">
        <h2 className="mb-1 text-[8px] tracking-widest text-retro-accent">
          ★ DOKUNMATİK TUŞLAR ★
        </h2>
        <p className="mb-4 text-[7px] leading-relaxed text-white/45">
          Yalnızca dokunmatik cihazlarda görünür. Aşağıdaki önizleme
          gerçek tuşları gösterir.
        </p>

        <Slider
          label="BOYUT"
          hint="Küçük ekranda tuşlar sahayı kapatmasın"
          value={controls.scale}
          min={0.7}
          max={1.4}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => setControl({ scale: v })}
        />
        <Slider
          label="SAYDAMLIK"
          hint="Tuşlar sahanın üstünde durur"
          value={controls.opacity}
          min={0.35}
          max={1}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => setControl({ opacity: v })}
        />

        <div className="mt-4 flex items-center justify-between gap-3 border-t-2 border-white/10 pt-4">
          <div>
            <p className="text-[9px] text-white">TUŞ DÜZENİ</p>
            <p className="mt-1 text-[7px] text-white/45">
              {controls.swap
                ? 'Yön tuşları sağda · solak düzeni'
                : 'Yön tuşları solda · varsayılan'}
            </p>
          </div>
          <button
            type="button"
            className="retro-button-ghost shrink-0 px-4 py-2 text-[8px]"
            onClick={() => {
              Sfx.select();
              setControl({ swap: !controls.swap });
            }}
          >
            {controls.swap ? 'SAĞ ELE AL' : 'SOL ELE AL'}
          </button>
        </div>

        <ControlsPreview settings={controls} />
      </section>

      {/* --- Sıfırlama --- */}
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

/**
 * Tuş önizlemesi — gerçek bileşen, sahte bir sahne zemini üstünde.
 *
 * Oranı sahayla aynı (9:5) tutuluyor ki tuşların sahanın ne kadarını
 * kapattığı doğru görünsün.
 */
function ControlsPreview({ settings }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-[7px] tracking-widest text-white/40">ÖNİZLEME</p>
      <div
        className="relative w-full overflow-hidden border-4 border-white/20 bg-[#5C070D]"
        style={{ aspectRatio: '9 / 5' }}
      >
        {/* Saha çizgileri — önizlemenin saha olduğu anlaşılsın */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-[#8E1018]" />
        <div className="absolute bottom-[16%] left-0 right-0 h-[2px] bg-white/50" />
        <div className="absolute bottom-1/3 left-1/2 h-1/3 w-[3px] -translate-x-1/2 bg-white/70" />

        <div className="pointer-events-none absolute inset-0">
          <TouchControls
            onInput={() => {}}
            sultanReady={false}
            overlay
            preview
            settings={settings}
          />
        </div>
      </div>
      <p className="mt-2 text-[6px] leading-relaxed text-white/30">
        {upper('Önizleme sahayla aynı orandadır (9:5)')}
      </p>
    </div>
  );
}

/** Etiketli retro kaydırıcı. */
function Slider({
  label,
  hint,
  value,
  onChange,
  onCommit,
  min = 0,
  max = 1,
  step = 0.05,
  disabled = false,
  format = (v) => `%${Math.round(v * 100)}`,
}) {
  return (
    <div className={`mt-4 ${disabled ? 'opacity-40' : ''}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[9px] text-white">{label}</p>
        <span className="text-[8px] tabular-nums text-retro-accent">{format(value)}</span>
      </div>
      {hint && <p className="mt-1 text-[7px] text-white/45">{hint}</p>}
      <input
        type="range"
        className="retro-range mt-2 w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
      />
    </div>
  );
}

/** Varsayılanlar dışarıdan da okunabilsin. */
export const DEFAULT_CONTROLS = DEFAULT_PREFS.controls;
