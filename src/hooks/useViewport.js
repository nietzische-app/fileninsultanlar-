import { useEffect, useState } from 'react';

function read() {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0, portrait: false, coarse: false };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  return {
    width,
    height,
    portrait: height >= width,
    /**
     * Dokunmatik (kaba işaretçi) cihaz mı?
     *
     * Mobil düzenin TEK ölçütü budur. Daha önce genişliğe bakan bir
     * `isMobile` alanı vardı (768px altı) ve yanıltıcıydı: oyun yatay
     * tutuş zorunlu olduğu için telefonlar yatayda 800–932 CSS px
     * geliyor, yani hiçbiri "mobil" sayılmıyordu. Ölçümde iPhone SE
     * dışında hiçbir cihazda dokunmatik tuşlar görünmüyordu. Alan
     * tamamen kaldırıldı ki aynı hata tekrar kurulmasın.
     *
     * Yatay zorunluluğu da buradan uygulanır: masaüstünde pencereyi
     * dar ve uzun yapan birinin önüne "telefonu çevir" ekranı
     * çıkarmak saçma olurdu.
     */
    coarse: window.matchMedia?.('(pointer: coarse)').matches ?? false,
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
