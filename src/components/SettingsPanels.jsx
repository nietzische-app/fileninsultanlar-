import MuteButton from './MuteButton.jsx';
import TouchControls from './TouchControls.jsx';
import Sfx from '../game/audio.js';
import { upper } from '../utils/text.js';

/**
 * Ayar bölümleri — hem tam ekran Ayarlar ekranı hem de maç içindeki
 * duraklatma katmanı bunları kullanır.
 *
 * Tek kaynakta durmalarının sebebi somut: iki yerde ayrı kopya tutmak,
 * biri değiştiğinde diğerinin sessizce eskimesi demek. Maç içinde
 * önizleme kapatılır çünkü gerçek tuşlar zaten arkada duruyor.
 */

/** Etiketli retro kaydırıcı. */
export function Slider({
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
    <div className={`mt-4 first:mt-0 ${disabled ? 'opacity-40' : ''}`}>
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

/** Ses bölümü. */
export function AudioSettings({
  muted,
  onToggleMute,
  musicVolume,
  onMusicVolume,
  sfxVolume,
  onSfxVolume,
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b-2 border-white/10 pb-3">
        <div>
          <p className="text-[9px] text-white">TÜM SESLER</p>
          <p className="mt-1 text-[7px] text-white/45">Kapatınca müzik de susar</p>
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
    </>
  );
}

/**
 * Dokunmatik tuş bölümü.
 * @param {{ controls: object, onControls: (patch: object) => void, showPreview?: boolean }} props
 */
export function ControlSettings({ controls, onControls, showPreview = true }) {
  const setControl = (patch) => {
    Sfx.unlock();
    onControls(patch);
  };

  return (
    <>
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
        <div className="min-w-0">
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

      {showPreview && <ControlsPreview settings={controls} />}
    </>
  );
}

/**
 * Tuş önizlemesi — gerçek bileşen, sahte bir saha zemini üstünde.
 *
 * Oran sahayla aynı (9:5). Ayrı bir taklit çizmek, ikisi ayrışınca
 * oyuncuya yalan söylerdi.
 */
function ControlsPreview({ settings }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-[7px] tracking-widest text-white/40">ÖNİZLEME</p>
      <div
        className="relative w-full overflow-hidden border-4 border-white/20 bg-[#5C070D]"
        style={{ aspectRatio: '9 / 5' }}
      >
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-[#8E1018]" />
        <div className="absolute bottom-[16%] left-0 right-0 h-[2px] bg-white/50" />
        <div className="absolute bottom-1/3 left-1/2 h-1/3 w-[3px] -translate-x-1/2 bg-white/70" />

        <div className="pointer-events-none absolute inset-0">
          <TouchControls
            onInput={() => {}}
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
