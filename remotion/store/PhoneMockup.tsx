import React from 'react';
import {Img, staticFile} from 'remotion';

export type PhoneMockupProps = {
  /** public/ altındaki görüntü yolu */
  src: string;
  /** Çerçeve dahil genişlik (px). Yatay telefon. */
  width?: number;
  /** Ekran en/boy oranı. Oyun kaynağı 16:9; 3:2 kırpma kenar boşluklarını atar. */
  aspect?: number;
  glow: string;
  /** CSS transform — varsayılan: istenen 3B perspektif */
  transform?: string;
  opacity?: number;
  style?: React.CSSProperties;
};

const BEZEL = 20;

/** Yarı saydam, modern yatay telefon. 3B eğim + renkli ışıma. */
export const PhoneMockup: React.FC<PhoneMockupProps> = ({
  src,
  width = 1040,
  aspect = 1.5,
  glow,
  transform = 'rotateX(10deg) rotateY(-5deg) scale(0.9)',
  opacity = 1,
  style,
}) => {
  const screenW = width - BEZEL * 2;
  const screenH = Math.round(screenW / aspect);
  const radius = 62;

  return (
    <div style={{perspective: 1800, opacity, ...style}}>
      <div
        style={{
          position: 'relative',
          width,
          height: screenH + BEZEL * 2,
          borderRadius: radius,
          padding: BEZEL,
          boxSizing: 'border-box',
          transform,
          transformStyle: 'preserve-3d',
          background:
            'linear-gradient(145deg, rgba(255,255,255,0.34), rgba(255,255,255,0.08) 45%, rgba(255,255,255,0.22))',
          border: '2px solid rgba(255,255,255,0.45)',
          backdropFilter: 'blur(14px)',
          boxShadow: `0 20px 50px rgba(0,0,0,0.5), 0 0 110px ${glow}, inset 0 0 0 2px rgba(0,0,0,0.35)`,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: screenW,
            height: screenH,
            borderRadius: radius - BEZEL + 4,
            overflow: 'hidden',
            background: '#05050A',
            boxShadow: 'inset 0 0 0 3px rgba(0,0,0,0.85)',
          }}
        >
          <Img
            src={staticFile(src)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              imageRendering: 'auto',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(115deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 32%)',
              pointerEvents: 'none',
            }}
          />
        </div>

        <div
          style={{
            position: 'absolute',
            left: 6,
            top: '50%',
            width: 9,
            height: 9,
            marginTop: -4,
            borderRadius: '50%',
            background: '#0a0a10',
            boxShadow: '0 0 0 2px rgba(255,255,255,0.25)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: -5,
            top: '26%',
            width: 5,
            height: 90,
            borderRadius: 3,
            background: 'rgba(255,255,255,0.45)',
          }}
        />
      </div>
    </div>
  );
};
