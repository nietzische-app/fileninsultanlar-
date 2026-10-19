import React from 'react';
import {AbsoluteFill, Sequence, staticFile} from 'remotion';
import {
  CTA_FRAMES,
  CTA_FROM,
  HOOK_FRAMES,
  HOOK_FROM,
  PLAY_FRAMES,
  PLAY_FROM,
} from './constants';
import {CtaScene} from './scenes/CtaScene';
import {GameplayScene} from './scenes/GameplayScene';
import {HookScene} from './scenes/HookScene';

export type ShortsProps = {
  hookText: string;
  hookSub: string;
  victoryText: string;
  scoreText: string;
  ctaLabel: string;
  ctaSub: string;
  /** Oynanış düzeni: mockup (16:9 çerçeve) | follow (dikey zoom + kamera) */
  layoutMode?: 'mockup' | 'follow';
};

/**
 * 15 sn Shorts akışı:
 *  0–3  Hook (soru kartı + 3-2-1)
 *  3–10 Oynanış + ZAFER!
 * 10–15 CTA / outro
 */
export const RetroVoleybolShorts: React.FC<ShortsProps> = ({
  hookText,
  hookSub,
  victoryText,
  scoreText,
  ctaLabel,
  ctaSub,
  layoutMode = 'mockup',
}) => {
  const pixelFont = staticFile('fonts/press-start-2p.woff2');

  return (
    <AbsoluteFill style={{backgroundColor: '#0B0B12'}}>
      <style>{`
        @font-face {
          font-family: 'Press Start 2P';
          src: url('${pixelFont}') format('woff2');
          font-display: block;
        }
      `}</style>

      <Sequence from={HOOK_FROM} durationInFrames={HOOK_FRAMES} name="Hook">
        <HookScene hookText={hookText} hookSub={hookSub} />
      </Sequence>

      <Sequence from={PLAY_FROM} durationInFrames={PLAY_FRAMES} name="Oynanış">
        <GameplayScene
          victoryText={victoryText}
          scoreText={scoreText}
          layoutMode={layoutMode}
        />
      </Sequence>

      <Sequence from={CTA_FROM} durationInFrames={CTA_FRAMES} name="CTA">
        <CtaScene ctaLabel={ctaLabel} ctaSub={ctaSub} />
      </Sequence>
    </AbsoluteFill>
  );
};
