import type {CSSProperties} from 'react';

export const STORE_WIDTH = 1080;
export const STORE_HEIGHT = 1920;

export const PIXEL_FONT = "'Press Start 2P', monospace";

export type StoreTheme = 'red' | 'night';

export type ThemeColors = {
  gradient: string;
  accent: string;
  glow: string;
  highlight: string;
};

/** Kırmızı–siyah (Türkiye) ve gece mavisi–turuncu (stadyum) */
export const THEMES: Record<StoreTheme, ThemeColors> = {
  red: {
    gradient:
      'linear-gradient(165deg, #3A0309 0%, #8B0A14 28%, #E30A17 52%, #5A0710 78%, #0B0B12 100%)',
    accent: '#E30A17',
    glow: 'rgba(255, 70, 40, 0.55)',
    highlight: '#FFD24A',
  },
  night: {
    gradient:
      'linear-gradient(165deg, #070B2A 0%, #101A5C 34%, #2A1F6B 58%, #B8420F 86%, #FF5A1F 100%)',
    accent: '#FF5A1F',
    glow: 'rgba(255, 130, 40, 0.55)',
    highlight: '#FFD24A',
  },
};

/** 8-bit ızgara: zemin dokusu, %15 opaklık */
export const gridStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  opacity: 0.15,
  backgroundImage: [
    'repeating-linear-gradient(0deg, #fff 0 2px, transparent 2px 48px)',
    'repeating-linear-gradient(90deg, #fff 0 2px, transparent 2px 48px)',
  ].join(','),
};

/** Tarama çizgisi — CRT hissi, çok hafif */
export const scanlineStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  opacity: 0.12,
  backgroundImage:
    'repeating-linear-gradient(0deg, rgba(0,0,0,0.7) 0 2px, transparent 2px 6px)',
};

export const titleStyle = (highlight: string): CSSProperties => ({
  fontFamily: PIXEL_FONT,
  fontSize: 58,
  lineHeight: 1.4,
  letterSpacing: 0,
  textAlign: 'center',
  color: '#fff',
  textTransform: 'uppercase',
  textShadow: [
    '0 6px 0 #000',
    '4px 4px 0 #000',
    '-4px 4px 0 #000',
    `0 0 36px ${highlight}88`,
  ].join(','),
  margin: 0,
  textWrap: 'balance' as CSSProperties['textWrap'],
});

export const subtitleStyle = (highlight: string): CSSProperties => ({
  fontFamily: PIXEL_FONT,
  fontSize: 25,
  lineHeight: 1.7,
  textAlign: 'center',
  color: highlight,
  textTransform: 'uppercase',
  textShadow: '0 3px 0 #000, 3px 3px 0 #000',
  margin: 0,
  textWrap: 'balance' as CSSProperties['textWrap'],
});
