import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {SyncedBeep} from '../audio/SyncedBeep';
import {FPS} from '../constants';

type Props = {
  hookText: string;
  hookSub: string;
};

const COUNT_AT = [FPS * 0.35, FPS * 1.15, FPS * 1.95]; // 3, 2, 1
const LABELS = ['3', '2', '1'];

export const HookScene: React.FC<Props> = ({hookText, hookSub}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const card = spring({
    frame,
    fps,
    config: {damping: 14, stiffness: 120, mass: 0.7},
  });
  const cardY = interpolate(card, [0, 1], [80, 0]);
  const cardOpacity = interpolate(card, [0, 1], [0, 1]);

  const countIndex = COUNT_AT.reduce(
    (acc, at, i) => (frame >= at ? i : acc),
    -1,
  );
  const countLabel = countIndex >= 0 ? LABELS[countIndex] : '';
  const sinceCount =
    countIndex >= 0 ? frame - COUNT_AT[countIndex] : 0;
  const countScale = spring({
    frame: Math.max(0, sinceCount),
    fps,
    config: {damping: 12, stiffness: 180},
  });

  return (
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(ellipse at 50% 40%, #3a0a12 0%, #0B0B12 70%)',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily:
          '"Press Start 2P", "DejaVu Sans", system-ui, sans-serif',
      }}
    >
      {/* Geri sayım bip’leri */}
      {COUNT_AT.map((at, i) => (
        <SyncedBeep
          key={i}
          file="remotion/beep.wav"
          atFrame={at}
          volume={0.85}
        />
      ))}
      <SyncedBeep file="remotion/tick.wav" atFrame={0} volume={0.4} />

      <div
        style={{
          transform: `translateY(${cardY}px) scale(${interpolate(card, [0, 1], [0.85, 1])})`,
          opacity: cardOpacity,
          width: 860,
          padding: '56px 48px',
          border: '6px solid #E30A17',
          backgroundColor: 'rgba(12, 12, 20, 0.92)',
          boxShadow: '0 0 0 4px #1a1a28, 0 24px 60px rgba(227,10,23,0.35)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            color: '#FFD24A',
            fontSize: 22,
            letterSpacing: 2,
            marginBottom: 28,
          }}
        >
          RETRO VOLEYBOL
        </div>
        <div
          style={{
            color: '#fff',
            fontSize: 42,
            lineHeight: 1.45,
            textShadow: '0 4px 0 #E30A17',
          }}
        >
          {hookText}
        </div>
        <div
          style={{
            color: '#A0A0B8',
            fontSize: 20,
            marginTop: 28,
            lineHeight: 1.5,
          }}
        >
          {hookSub}
        </div>
      </div>

      {countLabel ? (
        <div
          style={{
            position: 'absolute',
            bottom: 280,
            color: '#FFD24A',
            fontSize: 120,
            transform: `scale(${interpolate(countScale, [0, 1], [1.6, 1])})`,
            textShadow: '0 8px 0 #E30A17',
            opacity: interpolate(sinceCount, [0, 4, 22], [0, 1, 1]),
          }}
        >
          {countLabel}
        </div>
      ) : null}

      {/* Hafif zemin ızgarası */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          pointerEvents: 'none',
          opacity: 0.5,
        }}
      />
    </AbsoluteFill>
  );
};
