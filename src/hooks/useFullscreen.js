import { useCallback, useEffect, useState } from 'react';
import {
  enterFullscreen,
  exitFullscreen,
  getFullscreenElement,
  isFullscreenSupported,
} from '../utils/fullscreen.js';

/**
 * Bir elemanı tam ekrana alıp durumu izler.
 *
 * Durumu kendimiz tutmak yerine `fullscreenchange` olayını dinliyoruz:
 * kullanıcı ESC ya da sistem jestiyle çıktığında bizim düğmemize
 * dokunmuyor, tek doğru kaynak tarayıcının kendisi.
 *
 * @param {{ current: HTMLElement | null }} ref Tam ekrana alınacak eleman
 */
export default function useFullscreen(ref) {
  const [supported] = useState(() => isFullscreenSupported());
  const [active, setActive] = useState(() => Boolean(getFullscreenElement()));

  useEffect(() => {
    const sync = () => setActive(Boolean(getFullscreenElement()));
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  const toggle = useCallback(async () => {
    if (getFullscreenElement()) {
      await exitFullscreen();
      return;
    }
    await enterFullscreen(ref?.current ?? null);
  }, [ref]);

  return { supported, active, toggle };
}
