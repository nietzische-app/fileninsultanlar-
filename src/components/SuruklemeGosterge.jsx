import { useEffect, useState } from 'react';

/**
 * Serbest sürüklemenin görünen ipuçları.
 *
 * Şerit çizgisi okların yerinde durur: kaydırılabileceğini söyler,
 * dokunuş almaz. Halka parmağın üstünde yanar. Kaydırma ipucu maçın
 * ilk iki saniyesinde sol altta gider gelir, sonra solar.
 */

/** 6×11 ızgarada `<` ya da `>`. Tam sayı, kenar yumuşamaz. */
const SOL = [
  [4, 0, 2, 2],
  [2, 2, 2, 2],
  [0, 4, 2, 3],
  [2, 7, 2, 2],
  [4, 9, 2, 2],
];
const SAG = SOL.map(([x, y, g, h]) => [6 - x - g, y, g, h]);

/**
 * Yukarı bakan el: tek işaret parmağı, avuç, solda başparmak.
 * Alttaki parmaklar bir çatal gibi okunuyordu; tek parmak kaydırmayı söyler.
 * Izgara 12×14.
 */
const EL = [
  [6, 0, 3, 1],
  [6, 1, 3, 7],
  [2, 7, 10, 2],
  [2, 9, 9, 5],
  [0, 10, 3, 3],
];

function Piksel({ rects, width, height, className, scale = 2 }) {
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width * scale}
      height={height * scale}
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {rects.map(([x, y, g, h]) => (
        <rect key={`${x}-${y}-${g}-${h}`} x={x} y={y} width={g} height={h} />
      ))}
    </svg>
  );
}

/**
 * Boş şeritteki yatay iz: `< - - >`.
 * Opaklık CSS'te %30 — saha kırmızısının üstünde silik kalsın.
 * @param {{ compact?: boolean }} props
 */
export function DragTrack({ compact = false }) {
  return (
    <div
      className={`drag-track ${compact ? 'drag-track-compact' : ''}`}
      data-drag-track=""
      style={{ opacity: 0.3 }}
      aria-hidden="true"
    >
      <Piksel rects={SOL} width={6} height={11} />
      <span className="drag-track-line" />
      <Piksel rects={SAG} width={6} height={11} />
    </div>
  );
}

/**
 * Maç açılınca sol altta iki saniye sağa sola kayan el, sonra solar.
 */
export function SwipeHint() {
  const [soluyor, setSoluyor] = useState(false);
  const [bitti, setBitti] = useState(false);

  useEffect(() => {
    const sol = setTimeout(() => setSoluyor(true), 2000);
    const bit = setTimeout(() => setBitti(true), 2400);
    return () => {
      clearTimeout(sol);
      clearTimeout(bit);
    };
  }, []);

  if (bitti) return null;

  return (
    <div className={`drag-hint ${soluyor ? 'is-out' : ''}`} aria-hidden="true">
      <div className="drag-hint-motion">
        <Piksel rects={SOL} width={6} height={11} scale={3} className="drag-hint-mark" />
        <Piksel rects={EL} width={12} height={14} scale={3} className="drag-hint-hand" />
        <Piksel rects={SAG} width={6} height={11} scale={3} className="drag-hint-mark" />
      </div>
    </div>
  );
}
