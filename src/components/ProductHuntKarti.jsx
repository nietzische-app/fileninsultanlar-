import { yerelKabukMu } from '../utils/gizlilik.js';
import { t } from '../i18n/index.js';
import { PH_ADRES, PH_IKON, phKartiGoster } from './phKarti.js';

function cercevedeMi() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Product Hunt'ın verdiği gömü kartı.
 *
 * Yazı tipi kasıtlı olarak sistem fontu: gövde Press Start 2P ve
 * 14 px'te o font kartın satırını taşımaz. Renkler gömünün kendi
 * beyaz kartı — menünün piksel paneline boyanırsa Product Hunt
 * bağlantısı okunmaz.
 *
 * @param {{ yerel?: boolean, hostname?: string, cerceve?: boolean }} props
 */
export default function ProductHuntKarti({
  yerel = yerelKabukMu(),
  hostname = typeof location !== 'undefined' ? location.hostname : '',
  cerceve = typeof window !== 'undefined' && cercevedeMi(),
}) {
  if (!phKartiGoster({ yerel, hostname, cerceve })) return null;

  return (
    <div
      data-ph-kart
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        border: '1px solid #e0e0e0',
        borderRadius: 12,
        padding: 20,
        maxWidth: 500,
        width: '100%',
        margin: '0 auto',
        background: '#fff',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
        color: '#1a1a1a',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <img
          alt="Retro Voleybol"
          src={PH_IKON}
          width={64}
          height={64}
          style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
        />
        <div style={{ flex: '1 1 0%', minWidth: 0 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 600,
              color: '#1a1a1a',
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            Retro Voleybol
          </h3>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 14,
              color: '#666',
              lineHeight: 1.4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {t('ph.tagline')}
          </p>
        </div>
      </div>
      <a
        href={PH_ADRES}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          marginTop: 12,
          padding: '8px 16px',
          background: '#ff6154',
          color: '#fff',
          textDecoration: 'none',
          borderRadius: 9999,
          fontSize: 16,
          fontWeight: 600,
          lineHeight: 1.5,
        }}
      >
        {t('ph.cta')}
      </a>
    </div>
  );
}
