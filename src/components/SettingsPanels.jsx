import MuteButton from './MuteButton.jsx';
import TouchControls from './TouchControls.jsx';
import Sfx from '../game/audio.js';
import { t, yuzde } from '../i18n/index.js';

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
  format = (v) => yuzde(v * 100),
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
          <p className="text-[9px] text-white">{t('settings.allSound')}</p>
          <p className="mt-1 text-[7px] text-white/45">{t('settings.allSoundHint')}</p>
        </div>
        <MuteButton muted={muted} onToggle={onToggleMute} />
      </div>

      <Slider
        label={t('settings.music')}
        hint={t('settings.musicHint')}
        value={musicVolume}
        onChange={onMusicVolume}
        disabled={muted}
      />
      <Slider
        label={t('settings.sfx')}
        hint={t('settings.sfxHint')}
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
        label={t('settings.size')}
        hint={t('settings.sizeHint')}
        value={controls.scale}
        min={0.7}
        max={1.4}
        step={0.05}
        format={(v) => yuzde(v * 100)}
        onChange={(v) => setControl({ scale: v })}
      />
      {/*
        Aralık BOYUTTAN ayrı bir ayar. Yanlış tuşa basmanın sebebi tuşun
        küçüklüğü değil komşusuna yakınlığı; boyutu büyütmek sahadan yer
        çalarken aralığı açmak çalmıyor.
      */}
      <Slider
        label={t('settings.gap')}
        hint={t('settings.gapHint')}
        value={controls.gap}
        min={0.5}
        max={3}
        step={0.1}
        format={(v) => yuzde(v * 100)}
        onChange={(v) => setControl({ gap: v })}
      />
      <Slider
        label={t('settings.opacity')}
        hint={t('settings.opacityHint')}
        value={controls.opacity}
        min={0.35}
        max={1}
        step={0.05}
        format={(v) => yuzde(v * 100)}
        onChange={(v) => setControl({ opacity: v })}
      />

      <div className="mt-4 flex items-center justify-between gap-3 border-t-2 border-white/10 pt-4">
        <div className="min-w-0">
          <p className="text-[9px] text-white">{t('settings.layout')}</p>
          <p className="mt-1 text-[7px] text-white/45">
            {controls.swap
              ? t('settings.layoutSwap')
              : t('settings.layoutDefault')}
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
          {controls.swap ? t('settings.toRight') : t('settings.toLeft')}
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
      <p className="mb-2 text-[7px] tracking-widest text-white/40">{t('settings.preview')}</p>
      {/*
        Kutu artık 9:5 değil, ŞERİDE göre boyutlanıyor.
        Sabit oranda tuşlar gerçek boyutlarında kalıp kutunun altından
        taşıyordu — ölçek %140'a çekildiğinde yarısı görünmüyordu.
        `--touch-scale` burada da tanımlı olmalı, `--strip-h` onu okuyor.
      */}
      <div
        className="controls-preview relative w-full overflow-hidden border-4 border-white/20 bg-[#5C070D]"
        style={{
          '--touch-scale': settings?.scale ?? 1,
          height: 'calc(var(--strip-h) + 5rem)',
        }}
      >
        {/* Beyaz dip çizgi yok — sahada da kaldırıldı, önizleme onu izler */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-[#8E1018]" />
        <div className="absolute bottom-1/3 left-1/2 h-1/3 w-[3px] -translate-x-1/2 bg-white/70" />

        {/*
          Tuşlar maçtaki gibi ALT ŞERİTTE. Önizleme "binen" düzeni
          gösterirken oyun şerit düzenine geçmişti — önizlemenin işi
          gerçeği göstermek, yoksa oyuncu kör ayar yapar.
        */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0">
          <TouchControls
            onInput={() => {}}
            strip
            preview
            settings={settings}
          />
        </div>
      </div>
      <p className="mt-2 text-[6px] leading-relaxed text-white/30">
        {t('settings.previewHint')}
      </p>
    </div>
  );
}
