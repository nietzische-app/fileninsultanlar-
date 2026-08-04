import { useCallback, useEffect, useState } from 'react';

/**
 * Mobil / dar ekranda dikey (portrait) kullanımda kapı gerekir.
 */
function isMobileLike() {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const noHover = window.matchMedia('(hover: none)').matches;
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 820;
  const ua = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  return ua || ((coarse || noHover) && narrow);
}

function isPortrait() {
  if (typeof window === 'undefined') return false;
  const type = window.screen?.orientation?.type || '';
  if (type.startsWith('portrait')) return true;
  if (type.startsWith('landscape')) return false;
  if (typeof window.orientation === 'number') {
    return Math.abs(window.orientation) !== 90;
  }
  return window.innerHeight >= window.innerWidth;
}

/**
 * @returns {{ blocked: boolean, tryLock: () => void }}
 */
export function useLandscapeGate() {
  const [blocked, setBlocked] = useState(() => isMobileLike() && isPortrait());

  const refresh = useCallback(() => {
    setBlocked(isMobileLike() && isPortrait());
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener('resize', onChange);
    window.addEventListener('orientationchange', onChange);
    window.screen?.orientation?.addEventListener?.('change', onChange);
    return () => {
      window.removeEventListener('resize', onChange);
      window.removeEventListener('orientationchange', onChange);
      window.screen?.orientation?.removeEventListener?.('change', onChange);
    };
  }, [refresh]);

  const tryLock = useCallback(() => {
    const orient = window.screen?.orientation;
    if (orient?.lock) {
      orient.lock('landscape').catch(() => {
        // iOS ve birçok tarayıcı kilidi desteklemez — overlay yeterli
      });
    }
    const root = document.documentElement;
    if (root.requestFullscreen) {
      root.requestFullscreen().catch(() => {});
    }
    refresh();
  }, [refresh]);

  return { blocked, tryLock };
}
