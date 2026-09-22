import Sfx from '../game/audio.js';
import { t } from '../i18n/index.js';

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
      aria-label={muted ? t('mute.enable') : t('mute.disable')}
    >
      {muted ? t('mute.off') : t('mute.on')}
    </button>
  );
}
