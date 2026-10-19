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

type Props = {
  victoryText: string;
  scoreText: string;
  /**
   * `mockup` — 16:9 çerçeve + bulanık arka plan (varsayılan, kırpma yok)
   * `follow` — dikey full-bleed scale(1.5) + yumuşak kamera kaydırma
   */
  layoutMode?: 'mockup' | 'follow';
};

/** Ön plan 16:9 şerit — kenar payıyla tuvale sığar */
const STAGE_W = 1000;
const STAGE_H = Math.round((STAGE_W * 9) / 16); // 562
const STAGE_LEFT = Math.round((WIDTH - STAGE_W) / 2);
const STAGE_TOP = Math.round((HEIGHT - STAGE_H) / 2) - 20;

/**
 * Oynanış kesiti — yatay sahayı 9:16’da kırpmadan gösterir.
 *
 * mockup: bulanık büyütülmüş arka plan + ortada 16:9 cihaz çerçevesi
 * follow: scale(1.5) cover + frame’e bağlı translateX (kamera takibi hissi)
 */
export const GameplayScene: React.FC<Props> = ({
  victoryText,
  scoreText,
  layoutMode = 'mockup',
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
    ? interpolate(victoryLocal, [0, 4, 14], [0.45, 0.15, 0], {
        extrapolateRight: 'clamp',
      })
    : 0;

  // Top / ralli hissi için zaman çizelgesine bağlı yumuşak yatay kaydırma
  // (gerçek top X’i yok; smaç ritmine yakın sinüzoidal kamera)
  const ballTrack = Math.sin((frame / PLAY_FRAMES) * Math.PI * 2.2);
  const followX = interpolate(ballTrack, [-1, 1], [18, -18]);

  return (
    <AbsoluteFill style={{backgroundColor: '#0B0B12', overflow: 'hidden'}}>
      {/* Yedek zemin */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          background:
            'radial-gradient(ellipse at 50% 50%, #4a1018 0%, #0B0B12 75%)',
          zIndex: 0,
        }}
      >
        <Img
          src={staticFile('remotion/icon.png')}
          style={{
            width: 280,
            height: 280,
            opacity: 0.25,
            imageRendering: 'pixelated',
          }}
        />
      </AbsoluteFill>

      {layoutMode === 'mockup' ? (
        <MockupLayout src={src} panX={followX * 0.35} />
      ) : (
        <FollowLayout src={src} panX={followX} />
      )}

      {/* Üst boşluk — marka (oyun alanının dışında) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: STAGE_TOP,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: 28,
          zIndex: 5,
          pointerEvents: 'none',
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

        {/* ZAFER — üst letterbox’ta, sahayı kapatmaz */}
        {showVictory ? (
          <div
            style={{
              marginTop: 36,
              transform: `scale(${interpolate(pop, [0, 1], [0.5, 1])})`,
              opacity: interpolate(pop, [0, 0.2, 1], [0, 1, 1]),
              textAlign: 'center',
              fontFamily:
                '"Press Start 2P", "DejaVu Sans", system-ui, sans-serif',
            }}
          >
            <div
              style={{
                color: '#FFD24A',
                fontSize: 56,
                textShadow:
                  '0 6px 0 #E30A17, 0 0 28px rgba(255,210,74,0.45)',
              }}
            >
              {victoryText}
            </div>
          </div>
        ) : null}
      </div>

      {/* Alt boşluk — Sayı! CTA bandı */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: STAGE_TOP + STAGE_H,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingTop: 36,
          zIndex: 5,
          pointerEvents: 'none',
          fontFamily:
            '"Press Start 2P", "DejaVu Sans", system-ui, sans-serif',
        }}
      >
        {showVictory ? (
          <div
            style={{
              transform: `scale(${interpolate(pop, [0, 1], [0.6, 1])})`,
              opacity: interpolate(pop, [0, 0.25, 1], [0, 1, 1]),
              color: '#fff',
              fontSize: 32,
              textShadow: '0 4px 0 #000',
            }}
          >
            {scoreText}
          </div>
        ) : null}
      </div>

      {/* Hafif kırmızı flaş — sadece çerçeve çevresi, sahayı yemez */}
      {showVictory ? (
        <AbsoluteFill
          style={{
            backgroundColor: `rgba(227, 10, 23, ${flash})`,
            zIndex: 4,
            pointerEvents: 'none',
          }}
        />
      ) : null}

      <SyncedBeep file="remotion/zafer.wav" atFrame={VICTORY_AT} volume={1} />
    </AbsoluteFill>
  );
};

/** Bulanık ×2 arka plan + ortada 16:9 cihaz çerçevesi */
const MockupLayout: React.FC<{src: string; panX: number}> = ({
  src,
  panX,
}) => {
  return (
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
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            muted
            transparent={false}
          />
        </div>
        <AbsoluteFill
          style={{backgroundColor: 'rgba(11, 11, 18, 0.42)'}}
        />
      </AbsoluteFill>

      {/* Telefon / pencere mockup — orijinal 16:9 */}
      <div
        style={{
          position: 'absolute',
          left: STAGE_LEFT,
          top: STAGE_TOP,
          width: STAGE_W,
          height: STAGE_H,
          zIndex: 2,
          borderRadius: 28,
          padding: 10,
          boxSizing: 'border-box',
          background:
            'linear-gradient(160deg, #3a3a48 0%, #1a1a24 45%, #0e0e14 100%)',
          boxShadow:
            '0 28px 60px rgba(0,0,0,0.55), 0 0 0 2px rgba(255,210,74,0.15), inset 0 1px 0 rgba(255,255,255,0.12)',
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
          <OffthreadVideo
            src={src}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              backgroundColor: '#000',
            }}
            muted
            transparent={false}
          />
        </div>
      </div>
    </>
  );
};

/**
 * Alternatif: dikey full-bleed.
 * scale(1.5) + translateX — saha kırpılır ama kamera topu takip eder gibi kayar.
 */
const FollowLayout: React.FC<{src: string; panX: number}> = ({
  src,
  panX,
}) => {
  return (
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
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          muted
          transparent={false}
        />
      </div>
      {/* Üst/alt vignette — letterbox hissi */}
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
};
