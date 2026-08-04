import Sfx from '../game/audio.js';

/**
 * Ses aç/kapa — tüm ekranlarda aynı görünüm.
 */
export default function MuteButton({ muted, onToggle, className = '' }) {
  return (
    <button
      type="button"
      className={`retro-button-ghost px-4 py-2 text-[8px] ${className}`}
      onClick={() => {
        Sfx.unlock();
        onToggle();
      }}
      aria-pressed={muted}
      aria-label={muted ? 'Sesi aç' : 'Sesi kapat'}
    >
      SES: {muted ? 'KAPALI' : 'AÇIK'}
    </button>
  );
}
