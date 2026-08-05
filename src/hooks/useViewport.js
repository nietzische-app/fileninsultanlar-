import { useEffect, useState } from 'react';

/** Tailwind'in `md` kırılımı — sınıf koşullarıyla aynı eşik olmalı. */
const MOBILE_MAX = 768;

function read() {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0, isMobile: false, portrait: false };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  return {
    width,
    height,
    isMobile: width < MOBILE_MAX,
    portrait: height >= width,
  };
}

/**
 * Görünüm ölçüsü ve yönü.
 *
 * Yalnızca CSS ile çözülemeyen yerlerde kullanılır (ör. bir bileşene
 * "saydam varyantı çiz" demek). Yön değişimi bazı mobil tarayıcılarda
 * `resize`'ı gecikmeli tetiklediği için `orientationchange` de dinlenir.
 */
export default function useViewport() {
  const [state, setState] = useState(read);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      // Yön değişiminde ölçüler bir kare sonra oturuyor
      frame = requestAnimationFrame(() => setState(read()));
    };

    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return state;
}
