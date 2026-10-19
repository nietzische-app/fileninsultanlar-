import React from 'react';
import {Composition} from 'remotion';
import {RetroVoleybolShorts} from './Composition';
import {FPS, HEIGHT, WIDTH, TOTAL_FRAMES} from './constants';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="RetroVoleybolShorts"
        component={RetroVoleybolShorts}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{
          hookText: 'BU SETİ KİM ALIR?',
          hookSub: 'SULTANLAR MI, BALKAN MI?',
          victoryText: 'ZAFER!',
          scoreText: 'Sayı!',
          ctaLabel: "Hemen Ücretsiz Oyna",
          ctaSub: "Yakında Google Play'de",
          layoutMode: 'mockup' as const,
        }}
      />
    </>
  );
};
