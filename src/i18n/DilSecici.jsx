import Sfx from '../game/audio.js';
import { DIL_BILGI, DIL_KODLARI } from './index.js';
import { useDil } from './DilBaglami.jsx';

/**
 * TR | EN anahtarı — açılış şeridinde ve ayarlarda aynı.
 */
export default function DilSecici({ compact = false }) {
  const { lang, changeLang, t } = useDil();

  return (
    <div
      className={`flex shrink-0 items-stretch overflow-hidden border-4 ${
        compact ? 'border-white/40' : 'border-white/70'
      }`}
      role="group"
      aria-label={t('lang.label')}
      style={{ boxShadow: '4px 4px 0 0 rgba(0, 0, 0, 0.6)' }}
    >
      {DIL_KODLARI.map((kod) => {
        const aktif = lang === kod;
        return (
          <button
            key={kod}
            type="button"
            aria-pressed={aktif}
            className={`px-2 py-1.5 text-[7px] tracking-widest sm:px-2.5 ${
              aktif
                ? 'bg-turkiye-red text-white'
                : 'bg-retro-panel/90 text-white/55 hover:text-white'
            }`}
            onClick={() => {
              if (aktif) return;
              Sfx.unlock();
              Sfx.select();
              changeLang(kod);
            }}
          >
            {DIL_BILGI[kod].kisa}
          </button>
        );
      })}
    </div>
  );
}
