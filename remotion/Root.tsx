import React from 'react';
import {Composition, Still} from 'remotion';
import {ReelsVariant} from './Composition';
import {FPS, HEIGHT, TOTAL_FRAMES, WIDTH} from './constants';
import {ReelsOption1, ReelsOption2, ReelsOption3} from './variants';
import {STORE_SHOTS} from './store/captions';
import {StoreScreenshot} from './store/StoreScreenshots';
import {AppIcon, ICON_SIZE} from './icons/AppIcons';
import {STORE_HEIGHT, STORE_WIDTH} from './store/styles';

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
      {STORE_SHOTS.map((shot, i) => (
        <Still
          key={i}
          id={`StoreScreenshot${i + 1}`}
          component={StoreScreenshot}
          width={STORE_WIDTH}
          height={STORE_HEIGHT}
          defaultProps={shot}
        />
      ))}
      {(['flaming', 'hero', 'court', 'shield'] as const).map((variant, i) => (
        <Still
          key={variant}
          id={`AppIcon${i + 1}`}
          component={AppIcon}
          width={ICON_SIZE}
          height={ICON_SIZE}
          defaultProps={{variant}}
        />
      ))}
    </>
  );
};
