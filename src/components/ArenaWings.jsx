import { useEffect, useRef } from 'react';
import { GAME_HEIGHT } from '../game/constants.js';
import { drawWings, wingWidthUnits } from '../game/wings.js';

/**
 * Sahanın iki yanındaki siyah bantları dolduran salon katmanı.
 *
 * Oyun canvas'ının ARKASINDA durur ve sahnenin tamamını kaplar. Ortadaki
 * 900 birim zaten oyun canvas'ıyla örtülür; görünen yalnızca kanatlar.
 *
 * Birim ölçeği oyun canvas'ıyla eşitlenir (`wingWidthUnits`), yoksa
 * tribün sıraları dikişte kayardı.
 *
 * Kendi döngüsü var ama 60fps değil: kalabalık ~12fps'te kıpırdıyor.
 * Çevresel bir katman için yeterli, üstelik oyun döngüsüne hiç
 * dokunmadan çalışıyor — motorun tek işi saha kalsın.
 */
export default function ArenaWings({ canvasRef }) {
  const wingRef = useRef(null);

  useEffect(() => {
    const wing = wingRef.current;
    const game = canvasRef?.current;
    if (!wing || !game) return undefined;

    const ctx = wing.getContext('2d');
    let raf = 0;
    let lastDraw = 0;
    let lastW = 0;
    const start = performance.now();

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (now - lastDraw < 80) return;
      lastDraw = now;

      /*
       * Masaüstünde katman `fine:hidden` ile gizli; gizli bir canvas'a
       * her karede çizmek saf israf olurdu. `offsetParent` null ise
       * eleman düzende yok demektir.
       */
      if (!wing.offsetParent) return;

      const stage = wing.parentElement;
      const gameBox = game.getBoundingClientRect();
      if (!stage || gameBox.height === 0) return;

      const stageW = stage.clientWidth;
      const units = wingWidthUnits(stageW, gameBox.height);

      /*
       * Geri tampon yalnızca ölçü değişince yeniden boyutlanır: her
       * karede `width` yazmak canvas'ı temizler ve pahalıdır.
       */
      if (units !== lastW) {
        lastW = units;
        wing.width = units;
        wing.height = GAME_HEIGHT;
      }

      // Ekrandaki yeri: oyun canvas'ıyla aynı üst hiza ve yükseklik
      wing.style.height = `${gameBox.height}px`;
      wing.style.top = `${gameBox.top - stage.getBoundingClientRect().top}px`;

      drawWings(ctx, { width: units, time: (now - start) / 1000 });
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [canvasRef]);

  return (
    <canvas
      ref={wingRef}
      aria-hidden="true"
      className="pixelated pointer-events-none absolute left-0 w-full fine:hidden"
      style={{ zIndex: 0 }}
    />
  );
}
