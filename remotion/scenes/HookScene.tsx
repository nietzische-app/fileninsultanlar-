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
import {beatFrames, type HookStyle} from '../variants';

type Props = {
  hookText: string;
  hookSub?: string;
  hookStyle: HookStyle;
  bpm: number;
  accent: string;
  highlight: string;
};

const PIXEL = '"Press Start 2P", "DejaVu Sans", system-ui, sans-serif';

export const HookScene: React.FC<Props> = (props) => {
  const {hookStyle, accent} = props;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 40%, ${accent}55 0%, #0B0B12 70%)`,
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: PIXEL,
      }}
    >
      {hookStyle === 'countdown' ? <CountdownHook {...props} /> : null}
      {hookStyle === 'punch' ? <PunchHook {...props} /> : null}
      {hookStyle === 'arcade' ? <ArcadeHook {...props} /> : null}

      <AbsoluteFill
        style={{
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

/* -------------------- 1) Soru kartı + 3-2-1 -------------------- */
const COUNT_AT = [FPS * 0.35, FPS * 1.15, FPS * 1.95];
const LABELS = ['3', '2', '1'];

const CountdownHook: React.FC<Props> = ({hookText, hookSub, accent, highlight}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const card = spring({frame, fps, config: {damping: 14, stiffness: 120, mass: 0.7}});
  const countIndex = COUNT_AT.reduce((acc, at, i) => (frame >= at ? i : acc), -1);
  const sinceCount = countIndex >= 0 ? frame - COUNT_AT[countIndex] : 0;
  const countScale = spring({
    frame: Math.max(0, sinceCount),
    fps,
    config: {damping: 12, stiffness: 180},
  });

  return (
    <>
      {COUNT_AT.map((at, i) => (
        <SyncedBeep key={i} file="remotion/beep.wav" atFrame={at} volume={0.85} />
      ))}
      <SyncedBeep file="remotion/tick.wav" atFrame={0} volume={0.4} />

      <div
        style={{
          transform: `translateY(${interpolate(card, [0, 1], [80, 0])}px) scale(${interpolate(card, [0, 1], [0.85, 1])})`,
          opacity: interpolate(card, [0, 1], [0, 1]),
          width: 860,
          padding: '56px 48px',
          border: `6px solid ${accent}`,
          backgroundColor: 'rgba(12, 12, 20, 0.92)',
          boxShadow: `0 0 0 4px #1a1a28, 0 24px 60px ${accent}59`,
          textAlign: 'center',
        }}
      >
        <div style={{color: highlight, fontSize: 22, letterSpacing: 2, marginBottom: 28}}>
          RETRO VOLEYBOL
        </div>
        <div
          style={{
            color: '#fff',
            fontSize: 42,
            lineHeight: 1.45,
            textShadow: `0 4px 0 ${accent}`,
            whiteSpace: 'pre-line',
          }}
        >
          {hookText}
        </div>
        {hookSub ? (
          <div style={{color: '#A0A0B8', fontSize: 20, marginTop: 28, lineHeight: 1.5}}>
            {hookSub}
          </div>
        ) : null}
      </div>

      {countIndex >= 0 ? (
        <div
          style={{
            position: 'absolute',
            bottom: 280,
            color: highlight,
            fontSize: 120,
            transform: `scale(${interpolate(countScale, [0, 1], [1.6, 1])})`,
            textShadow: `0 8px 0 ${accent}`,
            opacity: interpolate(sinceCount, [0, 4, 22], [0, 1, 1]),
          }}
        >
          {LABELS[countIndex]}
        </div>
      ) : null}
    </>
  );
};

/* -------------------- 2) Vurmalı kelime kelime çarpan başlık -------------------- */
const PunchHook: React.FC<Props> = ({hookText, bpm, accent, highlight}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const words = hookText.split(/\s+/);
  const step = beatFrames(bpm) * 0.75;
  const start = 4;
  const since = frame - start;

  const lastAt = start + step * (words.length - 1);
  const shake =
    frame > lastAt
      ? Math.sin(frame * 2.3) * interpolate(frame - lastAt, [0, 14], [10, 0], {extrapolateRight: 'clamp'})
      : 0;

  return (
    <>
      {words.map((w, i) => (
        <SyncedBeep
          key={i}
          file={i === words.length - 1 ? 'remotion/zafer.wav' : 'remotion/tick.wav'}
          atFrame={Math.round(start + step * i)}
          volume={i === words.length - 1 ? 0.55 : 0.8}
        />
      ))}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
          transform: `translateX(${shake}px)`,
        }}
      >
        {words.map((w, i) => {
          const at = start + step * i;
          const hit = spring({
            frame: Math.max(0, frame - at),
            fps,
            config: {damping: 9, stiffness: 260, mass: 0.5},
          });
          const visible = frame >= at;
          const last = i === words.length - 1;
          return (
            <div
              key={i}
              style={{
                opacity: visible ? 1 : 0,
                transform: `scale(${interpolate(hit, [0, 1], [2.4, 1])}) rotate(${interpolate(hit, [0, 1], [i % 2 ? 8 : -8, 0])}deg)`,
                fontSize: last ? 76 : 64,
                color: last ? highlight : '#fff',
                textShadow: `0 8px 0 ${accent}`,
                letterSpacing: 2,
              }}
            >
              {w}
            </div>
          );
        })}
      </div>

      {/* Her çarpmada kısa flaş */}
      <AbsoluteFill
        style={{
          backgroundColor: accent,
          opacity:
            since < 0
              ? 0
              : interpolate(since % step, [0, 4], [0.3, 0], {
                  extrapolateRight: 'clamp',
                }),
          pointerEvents: 'none',
        }}
      />
    </>
  );
};

/* -------------------- 3) Atari / arcade daktilo + INSERT COIN -------------------- */
const ArcadeHook: React.FC<Props> = ({hookText, hookSub, accent, highlight}) => {
  const frame = useCurrentFrame();
  const total = hookText.length;
  const shown = Math.min(total, Math.floor(frame / 1.1));
  const visibleText = hookText.slice(0, shown);
  const done = shown >= total;
  const blink = Math.floor(frame / 12) % 2 === 0;

  return (
    <>
      <SyncedBeep file="remotion/tick.wav" atFrame={0} volume={0.6} />
      <SyncedBeep file="remotion/beep.wav" atFrame={Math.ceil(total * 1.1)} volume={0.7} />

      <div
        style={{
          width: 880,
          padding: '60px 44px',
          border: `6px solid ${accent}`,
          backgroundColor: '#05100b',
          boxShadow: `0 0 0 4px #0b2a1c, 0 0 60px ${accent}66`,
          textAlign: 'center',
        }}
      >
        <div style={{color: highlight, fontSize: 20, marginBottom: 36}}>
          1UP   HI-SCORE 090000
        </div>
        <div
          style={{
            color: accent,
            fontSize: 46,
            lineHeight: 1.6,
            minHeight: 190,
            whiteSpace: 'pre-line',
            textShadow: `0 0 18px ${accent}aa`,
          }}
        >
          {visibleText}
          {!done && blink ? '█' : ''}
        </div>
        {hookSub && done ? (
          <div
            style={{
              marginTop: 40,
              color: highlight,
              fontSize: 28,
              opacity: blink ? 1 : 0.15,
            }}
          >
            {hookSub}
          </div>
        ) : null}
      </div>

      {/* CRT tarama çizgileri */}
      <AbsoluteFill
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(0,0,0,0.28) 0px, rgba(0,0,0,0.28) 2px, transparent 2px, transparent 5px)',
          pointerEvents: 'none',
        }}
      />
    </>
  );
};
