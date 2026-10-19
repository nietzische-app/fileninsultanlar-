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
import {HEIGHT, PLAY_FRAMES, VICTORY_AT, WIDTH} from '../constants';
import {beatFrames, type GameplayLayout} from '../variants';

type Props = {
  victoryText: string;
  scoreText: string;
  /**
   * mockup — 16:9 çerçeve + bulanık arka plan (kırpma yok)
   * zoom   — dikey pencere, net ve blok anına yakın çekim + smaçta punch-in
   * follow — full-bleed scale(1.5) + yumuşak kamera kaydırma
   */
  layoutMode: GameplayLayout;
  clipStartSec: number;
  bpm: number;
  accent: string;
  highlight: string;
};

type Stage = {w: number; h: number; left: number; top: number};

/** 16:9 sahne — kırpmasız */
const WIDE: Stage = (() => {
  const w = 1000;
  const h = Math.round((w * 9) / 16);
  return {w, h, left: Math.round((WIDTH - w) / 2), top: Math.round((HEIGHT - h) / 2) - 20};
})();

/** Dikey pencere — net çevresine odaklı zoom görünümü */
const TALL: Stage = (() => {
  const w = 1000;
  const h = 880;
  return {w, h, left: Math.round((WIDTH - w) / 2), top: Math.round((HEIGHT - h) / 2) - 10};
})();

const stageFor = (mode: GameplayLayout): Stage => {
  if (mode === 'zoom') return TALL;
  if (mode === 'follow') return WIDE;
  return WIDE;
};

export const GameplayScene: React.FC<Props> = ({
  victoryText,
  scoreText,
  layoutMode,
  clipStartSec,
  bpm,
  accent,
  highlight,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const src = staticFile('remotion/gameplay.mp4');
  const trimBefore = Math.round(clipStartSec * fps);
  const stage = stageFor(layoutMode);

  const victoryLocal = frame - VICTORY_AT;
  const showVictory = victoryLocal >= 0;
  const pop = spring({
    frame: Math.max(0, victoryLocal),
    fps,
    config: {damping: 11, stiffness: 160, mass: 0.6},
  });
  const flash = showVictory
    ? interpolate(victoryLocal, [0, 4, 14], [0.45, 0.15, 0], {
        extrapolateRight: 'clamp',
      })
    : 0;

  // Vuruşa senkron çerçeve ışıması
  const beat = beatFrames(bpm);
  const beatPhase = (frame % beat) / beat;
  const glow = interpolate(beatPhase, [0, 0.15, 1], [1, 0.35, 0.1]);

  // Zaman çizelgesine bağlı yumuşak yatay kaydırma (top takibi hissi)
  const ballTrack = Math.sin((frame / PLAY_FRAMES) * Math.PI * 2.2);
  const followX = interpolate(ballTrack, [-1, 1], [18, -18]);

  // Zoom: yavaş yaklaşma + smaç anında punch-in
  const zoomBase = interpolate(frame, [0, PLAY_FRAMES], [1.1, 1.24], {
    extrapolateRight: 'clamp',
  });
  const punch = showVictory ? interpolate(pop, [0, 1], [0.12, 0]) : 0;
  const zoomScale = zoomBase + punch;
  // Kaydırma kenarı açmasın: scale s iken en fazla (s-1)/2 * 100 % güvenli
  const zoomPan = Math.max(
    -(zoomScale - 1) * 50,
    Math.min((zoomScale - 1) * 50, followX * 0.2),
  );

  return (
    <AbsoluteFill style={{backgroundColor: '#0B0B12', overflow: 'hidden'}}>
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          background:
            'radial-gradient(ellipse at 50% 50%, #4a1018 0%, #0B0B12 75%)',
        }}
      >
        <Img
          src={staticFile('remotion/icon.png')}
          style={{width: 280, height: 280, opacity: 0.25, imageRendering: 'pixelated'}}
        />
      </AbsoluteFill>

      {layoutMode === 'follow' ? (
        <FollowLayout src={src} trimBefore={trimBefore} panX={followX} />
      ) : (
        <FramedLayout
          src={src}
          trimBefore={trimBefore}
          stage={stage}
          zoom={layoutMode === 'zoom'}
          scale={zoomScale}
          panX={layoutMode === 'zoom' ? zoomPan : followX * 0.35}
          glow={glow}
          accent={accent}
        />
      )}

      {/* Üst boşluk — marka + ZAFER (oyun alanının dışında) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: stage.top,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: 24,
          zIndex: 5,
          pointerEvents: 'none',
          fontFamily: '"DejaVu Sans", system-ui, sans-serif',
        }}
      >
        <div
          style={{
            color: '#fff',
            fontSize: 34,
            fontWeight: 800,
            letterSpacing: 1,
            textShadow: `0 3px 0 ${accent}`,
          }}
        >
          RETRO VOLEYBOL
        </div>
        <div style={{color: highlight, fontSize: 20, marginTop: 8}}>
          SMAÇ · BLOK · RALLİ
        </div>

        {showVictory ? (
          <div
            style={{
              marginTop: 28,
              transform: `scale(${interpolate(pop, [0, 1], [0.5, 1])})`,
              opacity: interpolate(pop, [0, 0.2, 1], [0, 1, 1]),
              fontFamily:
                '"Press Start 2P", "DejaVu Sans", system-ui, sans-serif',
              color: highlight,
              fontSize: 52,
              textShadow: `0 6px 0 ${accent}, 0 0 28px ${highlight}66`,
            }}
          >
            {victoryText}
          </div>
        ) : null}
      </div>

      {/* Alt boşluk — Sayı! */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: stage.top + stage.h,
          bottom: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          paddingTop: 36,
          zIndex: 5,
          pointerEvents: 'none',
          fontFamily: '"Press Start 2P", "DejaVu Sans", system-ui, sans-serif',
        }}
      >
        {showVictory ? (
          <div
            style={{
              transform: `scale(${interpolate(pop, [0, 1], [0.6, 1])})`,
              opacity: interpolate(pop, [0, 0.25, 1], [0, 1, 1]),
              color: '#fff',
              fontSize: 30,
              textShadow: '0 4px 0 #000',
            }}
          >
            {scoreText}
          </div>
        ) : null}
      </div>

      {showVictory ? (
        <AbsoluteFill
          style={{
            backgroundColor: `${accent}`,
            opacity: flash,
            zIndex: 4,
            pointerEvents: 'none',
          }}
        />
      ) : null}

      <SyncedBeep file="remotion/zafer.wav" atFrame={VICTORY_AT} volume={1} />
    </AbsoluteFill>
  );
};

type FramedProps = {
  src: string;
  trimBefore: number;
  stage: Stage;
  zoom: boolean;
  scale: number;
  panX: number;
  glow: number;
  accent: string;
};

/** Bulanık ×2 arka plan + ortada cihaz çerçevesi (16:9 veya dikey zoom penceresi) */
const FramedLayout: React.FC<FramedProps> = ({
  src,
  trimBefore,
  stage,
  zoom,
  scale,
  panX,
  glow,
  accent,
}) => (
  <>
    <AbsoluteFill style={{overflow: 'hidden', zIndex: 1}}>
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          transform: `scale(2) translateX(${panX}%)`,
          filter: 'blur(20px)',
          opacity: 0.85,
        }}
      >
        <OffthreadVideo
          src={src}
          trimBefore={trimBefore}
          style={{width: '100%', height: '100%', objectFit: 'cover'}}
          muted
          transparent={false}
        />
      </div>
      <AbsoluteFill style={{backgroundColor: 'rgba(11, 11, 18, 0.42)'}} />
    </AbsoluteFill>

    <div
      style={{
        position: 'absolute',
        left: stage.left,
        top: stage.top,
        width: stage.w,
        height: stage.h,
        zIndex: 2,
        borderRadius: 28,
        padding: 10,
        boxSizing: 'border-box',
        background:
          'linear-gradient(160deg, #3a3a48 0%, #1a1a24 45%, #0e0e14 100%)',
        boxShadow: `0 28px 60px rgba(0,0,0,0.55), 0 0 ${24 + glow * 40}px ${accent}${Math.round(glow * 120)
          .toString(16)
          .padStart(2, '0')}, inset 0 1px 0 rgba(255,255,255,0.12)`,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 16,
          overflow: 'hidden',
          backgroundColor: '#000',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            transform: zoom
              ? `scale(${scale}) translateX(${panX}%)`
              : undefined,
            transformOrigin: '50% 58%',
          }}
        >
          <OffthreadVideo
            src={src}
            trimBefore={trimBefore}
            style={{
              width: '100%',
              height: '100%',
              objectFit: zoom ? 'cover' : 'contain',
              backgroundColor: '#000',
            }}
            muted
            transparent={false}
          />
        </div>
      </div>
    </div>
  </>
);

/** Dikey full-bleed: scale(1.5) + translateX kamera takibi */
const FollowLayout: React.FC<{src: string; trimBefore: number; panX: number}> = ({
  src,
  trimBefore,
  panX,
}) => (
  <AbsoluteFill style={{overflow: 'hidden', zIndex: 1}}>
    <div
      style={{
        position: 'absolute',
        inset: 0,
        transform: `scale(1.5) translateX(${panX}%)`,
        transformOrigin: '50% 50%',
      }}
    >
      <OffthreadVideo
        src={src}
        trimBefore={trimBefore}
        style={{width: '100%', height: '100%', objectFit: 'cover'}}
        muted
        transparent={false}
      />
    </div>
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background:
          'linear-gradient(180deg, rgba(11,11,18,0.55) 0%, transparent 18%, transparent 82%, rgba(11,11,18,0.55) 100%)',
        pointerEvents: 'none',
      }}
    />
  </AbsoluteFill>
);
