import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {SyncedBeep} from '../audio/SyncedBeep';

type Props = {
  ctaLabel: string;
  ctaSub: string;
};

export const CtaScene: React.FC<Props> = ({ctaLabel, ctaSub}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const iconPop = spring({
    frame,
    fps,
    config: {damping: 10, stiffness: 140, mass: 0.55},
  });
  const btn = spring({
    frame: Math.max(0, frame - 18),
    fps,
    config: {damping: 14, stiffness: 110},
  });
  const pulse = 1 + Math.sin(frame / 8) * 0.03;

  return (
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(ellipse at 50% 35%, #5a121c 0%, #0B0B12 68%)',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: '"DejaVu Sans", system-ui, sans-serif',
      }}
    >
      <SyncedBeep file="remotion/whoosh.wav" atFrame={2} volume={0.7} />

      <div
        style={{
          transform: `scale(${interpolate(iconPop, [0, 1], [0.2, 1]) * pulse})`,
          opacity: interpolate(iconPop, [0, 0.15, 1], [0, 1, 1]),
          marginBottom: 48,
        }}
      >
        <Img
          src={staticFile('remotion/icon.png')}
          style={{
            width: 320,
            height: 320,
            borderRadius: 64,
            boxShadow: '0 20px 50px rgba(227,10,23,0.45)',
            imageRendering: 'pixelated',
          }}
        />
      </div>

      <div
        style={{
          color: '#fff',
          fontSize: 48,
          fontWeight: 800,
          letterSpacing: 1,
          textShadow: '0 4px 0 #E30A17',
          marginBottom: 16,
          opacity: interpolate(iconPop, [0, 0.4, 1], [0, 0, 1]),
        }}
      >
        RETRO VOLEYBOL
      </div>

      <div
        style={{
          color: '#A0A0B8',
          fontSize: 26,
          marginBottom: 56,
          opacity: interpolate(btn, [0, 1], [0, 1]),
        }}
      >
        {ctaSub}
      </div>

      <div
        style={{
          transform: `translateY(${interpolate(btn, [0, 1], [40, 0])}px) scale(${interpolate(btn, [0, 1], [0.9, 1])})`,
          opacity: interpolate(btn, [0, 1], [0, 1]),
          backgroundColor: '#E30A17',
          color: '#fff',
          fontSize: 32,
          fontWeight: 800,
          padding: '28px 56px',
          borderRadius: 16,
          border: '4px solid #FFD24A',
          boxShadow: '0 10px 0 #8a0610',
        }}
      >
        {ctaLabel}
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 120,
          color: '#FFD24A',
          fontSize: 24,
          opacity: interpolate(btn, [0, 1], [0, 0.9]),
        }}
      >
        Google Play · Ücretsiz
      </div>
    </AbsoluteFill>
  );
};
