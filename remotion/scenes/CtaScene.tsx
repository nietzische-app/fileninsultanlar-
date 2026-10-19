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
import {beatFrames} from '../variants';

const BTN_ENTER_FRAME = 22;
const PULSE_AMOUNT = 0.08;

type Props = {
  ctaTitle: string;
  ctaButton: string;
  ctaSub?: string;
  ctaFooter?: string;
  bpm: number;
  accent: string;
  accentDark: string;
  highlight: string;
};

export const CtaScene: React.FC<Props> = ({
  ctaTitle,
  ctaButton,
  ctaSub,
  ctaFooter,
  bpm,
  accent,
  accentDark,
  highlight,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const iconPop = spring({frame, fps, config: {damping: 10, stiffness: 140, mass: 0.55}});
  const text = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: {damping: 14, stiffness: 120},
  });
  const btn = spring({
    frame: Math.max(0, frame - BTN_ENTER_FRAME),
    fps,
    config: {damping: 14, stiffness: 110},
  });

  // Sürekli nabız: scale 1 → 1.08 → 1, döngü her 2 vuruşta bir (tempoya senkron).
  // CSS @keyframes render sırasında kare kare çalışmaz; aynı eğriyi kareden hesaplıyoruz.
  const pulsePeriod = beatFrames(bpm) * 2;
  const pulsePhase = Math.max(0, frame - BTN_ENTER_FRAME) / pulsePeriod;
  const pulse = 1 + PULSE_AMOUNT * (0.5 - 0.5 * Math.cos(2 * Math.PI * pulsePhase));

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 35%, ${accent}66 0%, #0B0B12 68%)`,
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: '"DejaVu Sans", system-ui, sans-serif',
      }}
    >
      <SyncedBeep file="remotion/whoosh.wav" atFrame={2} volume={0.7} />
      <SyncedBeep file="remotion/beep.wav" atFrame={BTN_ENTER_FRAME} volume={0.6} />

      <div
        style={{
          transform: `scale(${interpolate(iconPop, [0, 1], [0.2, 1])})`,
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
            boxShadow: `0 20px 50px ${accent}73`,
            imageRendering: 'pixelated',
          }}
        />
      </div>

      <div
        style={{
          color: '#fff',
          fontSize: 54,
          fontWeight: 800,
          lineHeight: 1.2,
          textAlign: 'center',
          padding: '0 60px',
          textShadow: `0 4px 0 ${accent}`,
          marginBottom: 20,
          opacity: interpolate(text, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(text, [0, 1], [30, 0])}px)`,
        }}
      >
        {ctaTitle}
      </div>

      {ctaSub ? (
        <div
          style={{
            color: '#A0A0B8',
            fontSize: 26,
            marginBottom: 52,
            opacity: interpolate(text, [0, 1], [0, 1]),
          }}
        >
          {ctaSub}
        </div>
      ) : (
        <div style={{height: 52}} />
      )}

      <div
        style={{
          transform: `translateY(${interpolate(btn, [0, 1], [40, 0])}px) scale(${interpolate(btn, [0, 1], [0.9, 1]) * pulse})`,
          opacity: interpolate(btn, [0, 1], [0, 1]),
          backgroundColor: accent,
          color: '#fff',
          fontSize: 34,
          fontWeight: 800,
          padding: '28px 60px',
          borderRadius: 16,
          border: `4px solid ${highlight}`,
          boxShadow: `0 10px 0 ${accentDark}`,
        }}
      >
        {ctaButton}
      </div>

      {ctaFooter ? (
        <div
          style={{
            position: 'absolute',
            bottom: 120,
            color: highlight,
            fontSize: 24,
            opacity: interpolate(btn, [0, 1], [0, 0.9]),
          }}
        >
          {ctaFooter}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
