import React from 'react';
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {SyncedBeep} from '../audio/SyncedBeep';
import {VICTORY_AT} from '../constants';

type Props = {
  victoryText: string;
  scoreText: string;
};

/**
 * Oynanış kesiti — `public/remotion/gameplay.mp4` (build-video hazırlar).
 * Dosya yoksa ikon + zemin ile yedek sahne.
 */
export const GameplayScene: React.FC<Props> = ({
  victoryText,
  scoreText,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const src = staticFile('remotion/gameplay.mp4');

  const victoryLocal = frame - VICTORY_AT;
  const showVictory = victoryLocal >= 0;
  const pop = spring({
    frame: Math.max(0, victoryLocal),
    fps,
    config: {damping: 11, stiffness: 160, mass: 0.6},
  });
  const flash = showVictory
    ? interpolate(victoryLocal, [0, 4, 14], [0.55, 0.2, 0], {
        extrapolateRight: 'clamp',
      })
    : 0;

  return (
    <AbsoluteFill style={{backgroundColor: '#0B0B12'}}>
      {/* HD oynanış — cover ile 9:16 doldur */}
      <AbsoluteFill>
        <OffthreadVideo
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          onError={() => {
            /* render sırasında dosya yoksa Img yedeği görünür */
          }}
          transparent={false}
        />
      </AbsoluteFill>

      {/* Yedek zemin (video yüklenene / yokken) */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          background:
            'radial-gradient(ellipse at 50% 50%, #4a1018 0%, #0B0B12 75%)',
          zIndex: -1,
        }}
      >
        <Img
          src={staticFile('remotion/icon.png')}
          style={{width: 280, height: 280, opacity: 0.35, imageRendering: 'pixelated'}}
        />
      </AbsoluteFill>

      {/* Üst şerit */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '48px 40px 24px',
          background:
            'linear-gradient(180deg, rgba(11,11,18,0.85) 0%, transparent 100%)',
          textAlign: 'center',
          fontFamily: '"DejaVu Sans", system-ui, sans-serif',
        }}
      >
        <div
          style={{
            color: '#fff',
            fontSize: 36,
            fontWeight: 800,
            letterSpacing: 1,
            textShadow: '0 3px 0 #E30A17',
          }}
        >
          RETRO VOLEYBOL
        </div>
        <div style={{color: '#FFD24A', fontSize: 22, marginTop: 10}}>
          SMAÇ · BLOK · RALLİ
        </div>
      </div>

      {/* ZAFER / Sayı overlay */}
      {showVictory ? (
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: `rgba(227, 10, 23, ${flash})`,
            }}
          />
          <div
            style={{
              transform: `scale(${interpolate(pop, [0, 1], [0.4, 1])}) rotate(${interpolate(pop, [0, 1], [-8, 0])}deg)`,
              opacity: interpolate(pop, [0, 0.2, 1], [0, 1, 1]),
              textAlign: 'center',
              fontFamily:
                '"Press Start 2P", "DejaVu Sans", system-ui, sans-serif',
            }}
          >
            <div
              style={{
                color: '#FFD24A',
                fontSize: 92,
                textShadow: '0 8px 0 #E30A17, 0 0 40px rgba(255,210,74,0.5)',
              }}
            >
              {victoryText}
            </div>
            <div
              style={{
                color: '#fff',
                fontSize: 36,
                marginTop: 28,
                textShadow: '0 4px 0 #000',
              }}
            >
              {scoreText}
            </div>
          </div>
        </AbsoluteFill>
      ) : null}

      <SyncedBeep file="remotion/zafer.wav" atFrame={VICTORY_AT} volume={1} />
    </AbsoluteFill>
  );
};
