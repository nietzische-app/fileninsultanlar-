import { upper } from '../utils/text.js';

/**
 * Giriş müziği ses kaydırıcısı.
 *
 * Sessize alma düğmesinden ayrı durur: düğme her şeyi (efektler, tribün,
 * müzik) kapatır, bu kaydırıcı yalnızca müziğin seviyesini belirler.
 * Sessizken kaydırıcı devre dışı bırakılır — açıkken sürüklemek hiçbir
 * şey duyurmadığı için bozuk sanılıyordu.
 *
 * @param {object} props
 * @param {number} props.value 0–1
 * @param {(value: number) => void} props.onChange
 * @param {boolean} [props.muted]
 */
export default function MusicVolume({ value, onChange, muted = false }) {
  const percent = Math.round(value * 100);

  return (
    <label
      className={`flex items-center gap-2 border-4 bg-retro-panel/90 px-2.5 py-1.5 transition ${
        muted ? 'border-white/20 opacity-50' : 'border-white/70'
      }`}
      style={{ boxShadow: '4px 4px 0 0 rgba(0, 0, 0, 0.6)' }}
      title={muted ? upper('Ses kapalı') : `${upper('Müzik')} · %${percent}`}
    >
      <span aria-hidden className="text-[9px] leading-none text-retro-accent">
        ♪
      </span>
      <input
        type="range"
        min="0"
        max="100"
        step="5"
        value={percent}
        disabled={muted}
        aria-label={upper('Müzik sesi')}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        className="retro-range w-16 sm:w-24"
      />
      {/* Yüzde sabit genişlikte: değer değişince kaydırıcı yerinden oynamasın */}
      <span className="w-7 text-right text-[7px] tabular-nums text-white/60">
        %{percent}
      </span>
    </label>
  );
}
