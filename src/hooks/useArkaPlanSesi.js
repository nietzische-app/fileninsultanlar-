import { useEffect } from 'react';
import Sfx from '../game/audio.js';

/**
 * Uygulama / sekme aktif mi → ses ne yapsın.
 *
 * Saf çünkü Capacitor dinleyicisini vitest'te kurmak pahalı; karar
 * unutulursa müzik kilit ekranının arkasından çalar.
 *
 * @param {boolean} aktif
 * @returns {'suspend'|'resume'}
 */
export function arkaPlanSesi(aktif) {
  return aktif ? 'resume' : 'suspend';
}

function uygula(aktif) {
  if (arkaPlanSesi(aktif) === 'suspend') Sfx.suspend();
  else Sfx.resumeContext();
}

/**
 * Uygulama / sekme arka plana geçince sesi keser.
 *
 * Giriş müziği ve tribün uğultusu Web Audio `AudioContext` üzerinde
 * çalıyor. Android'de Home'a basınca WebView bağlamı askıya alınmıyor;
 * müzik kilit ekranının arkasından devam ediyor. Tarayıcıda sekme
 * değişince de aynı şey olabiliyor.
 *
 * İki sinyal dinleniyor:
 *   · `visibilitychange` — web + çoğu WebView
 *   · Capacitor `appStateChange` — native kabuk (Home / görev değiştirici)
 *
 * İkisi de aynı kapıya gidiyor; çift tetiklenme zararsız.
 */
export default function useArkaPlanSesi() {
  useEffect(() => {
    const gizle = () => uygula(!document.hidden);

    document.addEventListener('visibilitychange', gizle);
    /*
     * Açılışta zaten gizliyse (nadir: arka planda açılan WebView)
     * dinleyici kurulmadan önce kaçırmamak için bir kez uygula.
     */
    if (document.hidden) uygula(false);

    let cozul = null;
    let iptal = false;

    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        const dinleyici = await App.addListener('appStateChange', ({ isActive }) => {
          uygula(Boolean(isActive));
        });
        if (iptal) dinleyici.remove();
        else cozul = () => dinleyici.remove();
      } catch {
        // Web paketi — Capacitor yok; visibilitychange yeter
      }
    })();

    return () => {
      iptal = true;
      document.removeEventListener('visibilitychange', gizle);
      cozul?.();
    };
  }, []);
}
