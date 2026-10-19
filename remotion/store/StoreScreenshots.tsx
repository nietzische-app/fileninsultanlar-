import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {PhoneMockup} from './PhoneMockup';
import {
  PIXEL_FONT,
  STORE_HEIGHT,
  THEMES,
  gridStyle,
  scanlineStyle,
  subtitleStyle,
  titleStyle,
  type StoreTheme,
} from './styles';

export type StoreShotProps = {
  title: string;
  subtitle: string;
  /** Ön plandaki telefonun ekranı (public/ altı) */
  image: string;
  /** Arkadaki ikinci telefon (derinlik için) */
  backImage?: string;
  theme: StoreTheme;
  /** Ön telefon ekran oranı; menü gibi tam genişlik kaynaklar için 16/9 */
  aspect?: number;
};

/** Üst %25: başlık + alt başlık */
const TOP_ZONE = Math.round(STORE_HEIGHT * 0.25);

export const StoreScreenshot: React.FC<StoreShotProps> = ({
  title,
  subtitle,
  image,
  backImage,
  theme,
  aspect,
}) => {
  const t = THEMES[theme];
  const pixelFont = staticFile('fonts/press-start-2p.woff2');

  return (
    <AbsoluteFill style={{background: t.gradient, overflow: 'hidden'}}>
      <style>{`
        @font-face {
          font-family: 'Press Start 2P';
          src: url('${pixelFont}') format('woff2');
          font-display: block;
        }
      `}</style>

      <div style={gridStyle} />
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse 80% 38% at 50% 8%, rgba(255,244,205,0.28), transparent 70%), radial-gradient(ellipse 90% 40% at 50% 100%, rgba(0,0,0,0.65), transparent 70%)',
        }}
      />
      <div style={scanlineStyle} />

      <div
        style={{
          position: 'absolute',
          left: 70,
          right: 70,
          top: 0,
          height: TOP_ZONE,
          paddingTop: 70,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 26,
        }}
      >
        <h1 style={titleStyle(t.highlight)}>{title.toLocaleUpperCase('tr-TR')}</h1>
        <p style={subtitleStyle(t.highlight)}>{subtitle.toLocaleUpperCase('tr-TR')}</p>
      </div>

      {backImage ? (
        <PhoneMockup
          src={backImage}
          width={900}
          glow={t.glow}
          opacity={0.78}
          transform="rotateX(10deg) rotateY(8deg) scale(0.9)"
          style={{position: 'absolute', left: 30, top: 560}}
        />
      ) : null}

      <PhoneMockup
        src={image}
        aspect={aspect}
        glow={t.glow}
        style={{position: 'absolute', left: 20, top: 960}}
      />

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 70,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
        }}
      >
        <Img
          src={staticFile('remotion/icon.png')}
          style={{
            width: 84,
            height: 84,
            borderRadius: 20,
            boxShadow: `0 0 0 3px rgba(255,255,255,0.55), 0 8px 0 rgba(0,0,0,0.5), 0 0 40px ${t.glow}`,
          }}
        />
        <span
          style={{
            fontFamily: PIXEL_FONT,
            fontSize: 30,
            color: '#fff',
            textShadow: '0 4px 0 #000, 3px 3px 0 #000',
          }}
        >
          RETRO VOLEYBOL
        </span>
      </div>
    </AbsoluteFill>
  );
};
