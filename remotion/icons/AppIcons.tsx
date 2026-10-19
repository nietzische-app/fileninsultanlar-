import React from 'react';
import {AbsoluteFill} from 'remotion';
import {DRAWERS, N, type IconVariant} from './draw';
import {toRuns} from './pixel';

/** Google Play listeleme ikonu: 512x512, düz kare, yazısız. */
export const ICON_SIZE = 512;

export type AppIconProps = {variant: IconVariant};

/**
 * Play Store kuralları:
 *  - 512x512, 1:1
 *  - yazı YOK
 *  - köşeler YUVARLATILMAZ — tuval kenardan kenara dolu, maskeyi Play uygular
 *
 * 64x64 piksel ızgarası 8x büyütülür; `crispEdges` ile her piksel tam 8x8.
 */
export const AppIcon: React.FC<AppIconProps> = ({variant}) => {
  const runs = toRuns(DRAWERS[variant]());
  return (
    <AbsoluteFill style={{background: '#0B0B12'}}>
      <svg
        width={ICON_SIZE}
        height={ICON_SIZE}
        viewBox={`0 0 ${N} ${N}`}
        shapeRendering="crispEdges"
        style={{display: 'block'}}
      >
        {runs.map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.c} />
        ))}
      </svg>
    </AbsoluteFill>
  );
};
