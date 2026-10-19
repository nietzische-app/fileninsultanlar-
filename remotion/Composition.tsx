import React from 'react';
import {AbsoluteFill, Sequence, staticFile} from 'remotion';
import {MusicBed} from './audio/MusicBed';
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
import type {VariantProps} from './variants';

/**
 * 15 sn akışı (tüm varyasyonlar aynı iskeleti kullanır, içerik props ile değişir):
 *  0–3  Hook
 *  3–10 Oynanış + ZAFER
 * 10–15 CTA / outro
 */
export const ReelsVariant: React.FC<VariantProps> = (p) => {
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

      <MusicBed file={p.musicFile} volume={p.musicVolume} />

      <Sequence from={HOOK_FROM} durationInFrames={HOOK_FRAMES} name="Hook">
        <HookScene
          hookText={p.hookText}
          hookSub={p.hookSub}
          hookStyle={p.hookStyle}
          bpm={p.bpm}
          accent={p.accent}
          highlight={p.highlight}
        />
      </Sequence>

      <Sequence from={PLAY_FROM} durationInFrames={PLAY_FRAMES} name="Oynanış">
        <GameplayScene
          victoryText={p.victoryText}
          scoreText={p.scoreText}
          layoutMode={p.layoutMode}
          clipStartSec={p.clipStartSec}
          bpm={p.bpm}
          accent={p.accent}
          highlight={p.highlight}
        />
      </Sequence>

      <Sequence from={CTA_FROM} durationInFrames={CTA_FRAMES} name="CTA">
        <CtaScene
          ctaTitle={p.ctaTitle}
          ctaButton={p.ctaButton}
          ctaSub={p.ctaSub}
          ctaFooter={p.ctaFooter}
          bpm={p.bpm}
          accent={p.accent}
          accentDark={p.accentDark}
          highlight={p.highlight}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
