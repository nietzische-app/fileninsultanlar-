import React from 'react';
import {Composition} from 'remotion';
import {ReelsVariant} from './Composition';
import {FPS, HEIGHT, TOTAL_FRAMES, WIDTH} from './constants';
import {ReelsOption1, ReelsOption2, ReelsOption3} from './variants';

const common = {
  component: ReelsVariant,
  durationInFrames: TOTAL_FRAMES,
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
} as const;

/**
 * A/B/C test varyasyonları — aynı iskelet, farklı metin/müzik/oynanış düzeni.
 *   ReelsOption1  Soru / Rekabet
 *   ReelsOption2  Aksiyon / Smaç (zoom)
 *   ReelsOption3  Nostalji / Atari
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="ReelsOption1" {...common} defaultProps={ReelsOption1} />
      <Composition id="ReelsOption2" {...common} defaultProps={ReelsOption2} />
      <Composition id="ReelsOption3" {...common} defaultProps={ReelsOption3} />
    </>
  );
};
