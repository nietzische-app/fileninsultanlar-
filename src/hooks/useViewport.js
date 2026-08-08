import { useEffect, useState } from 'react';

/** Tailwind'in `md` kırılımı — dar masaüstü pencereleri için yedek eşik. */
const MOBILE_MAX = 768;

function read() {
  if (typeof window === 'undefined') {
    return {
      width: 0,
      height: 0,
      isMobile: false,
      portrait: false,
      coarse: false,
      isTouchUi: false,
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const coarse =
    window.matchMedia?.('(pointer: coarse)').matches ||
    window.matchMedia?.('(any-pointer: coarse)').matches ||
    false;
  /*
   * Yatay telefonlar çoğu zaman 768px'ten geniştir (ör. 844×390).
   * Yalnızca `max-width` kullanınca dokunmatik kontroller gizlenip
   * masaüstü siyah bar sahayı sıkıştırıyordu. Dokunmatik birincil
   * işaretçi veya kaba işaretçi varsa her zaman touch UI.
   */
  const isTouchUi = coarse || width < MOBILE_MAX;

  return {
    width,
    height,
    isMobile: width < MOBILE_MAX,
    portrait: height >= width,
    coarse,
    isTouchUi,
  };
}

/**
 * Görünüm ölçüsü, yönü ve dokunmatik arayüz bayrağı.
 *
 * CSS medya sorguları genişliğe bakınca yatay telefonu kaçırır;
 * bu hook `pointer: coarse` ile birleştirir. `documentElement[data-ui]`
 * de CSS'ten aynı kararı okumak için senkron tutulur.
 */
export default function useViewport() {
  const [state, setState] = useState(read);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      // Yön değişiminde ölçüler bir kare sonra oturuyor
      frame = requestAnimationFrame(() => {
        const next = read();
        document.documentElement.dataset.ui = next.isTouchUi ? 'touch' : 'desktop';
        setState(next);
      });
    };

    const coarseMq = window.matchMedia?.('(pointer: coarse)');
    const anyCoarseMq = window.matchMedia?.('(any-pointer: coarse)');

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    coarseMq?.addEventListener?.('change', update);
    anyCoarseMq?.addEventListener?.('change', update);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      coarseMq?.removeEventListener?.('change', update);
      anyCoarseMq?.removeEventListener?.('change', update);
    };
  }, []);

  return state;
}
