import {FPS} from './constants';

export type GameplayLayout = 'mockup' | 'follow' | 'zoom';
export type HookStyle = 'countdown' | 'punch' | 'arcade';

export type VariantProps = {
  /** Intro kartı ana metni (satır sonları `\n`) */
  hookText: string;
  hookSub?: string;
  hookStyle: HookStyle;

  victoryText: string;
  scoreText: string;
  layoutMode: GameplayLayout;
  /**
   * Çerçeve içindeki oyun görüntüsünün temel ölçeği.
   * mockup: 1.35 (karakterler büyür). zoom: dikey pencere zaten ~1.6x
   * kırpılmış olduğundan 1.1 ile birleşip ~1.8x etkili yakınlaşma verir.
   */
  gameplayScale: number;
  /** Kaynak klipte başlangıç saniyesi (varyasyonlar farklı kesit gösterir) */
  clipStartSec: number;

  ctaTitle: string;
  ctaButton: string;
  ctaSub?: string;
  ctaFooter?: string;

  /** `public/` altındaki müzik dosyası ve tempo (vuruşa senkron animasyon) */
  musicFile: string;
  bpm: number;
  musicVolume: number;

  /** Renk teması */
  accent: string;
  accentDark: string;
  highlight: string;
};

export const ReelsOption1: VariantProps = {
  hookText: 'BU SETİ KİM ALIR?',
  hookSub: 'SULTANLAR MI, BALKAN MI?',
  hookStyle: 'countdown',
  victoryText: 'ZAFER!',
  scoreText: 'Sayı!',
  layoutMode: 'mockup',
  gameplayScale: 1.35,
  clipStartSec: 0,
  ctaTitle: 'Hemen İndir ve Tarafını Seç!',
  ctaButton: 'Ücretsiz İndir',
  ctaSub: "Yakında Google Play'de",
  ctaFooter: 'Google Play · Ücretsiz',
  musicFile: 'remotion/music-v1.wav',
  bpm: 112,
  musicVolume: 0.55,
  accent: '#E30A17',
  accentDark: '#8a0610',
  highlight: '#FFD24A',
};

export const ReelsOption2: VariantProps = {
  hookText: 'EN SERT SMAÇI KİM ATACAK?',
  hookStyle: 'punch',
  victoryText: 'SMAÇ!',
  scoreText: 'Blok · Sayı!',
  layoutMode: 'zoom',
  gameplayScale: 1.1,
  clipStartSec: 2,
  ctaTitle: 'Filenin Kralı Ol!',
  ctaButton: 'Ücretsiz Oyna',
  ctaFooter: 'Google Play · Ücretsiz',
  musicFile: 'remotion/music-v2.wav',
  bpm: 150,
  musicVolume: 0.6,
  accent: '#FF5A1F',
  accentDark: '#8a2b08',
  highlight: '#FFE14A',
};

export const ReelsOption3: VariantProps = {
  hookText: "90'LAR RETRO\nVOLEYBOLU MOBİLDE!",
  hookSub: 'INSERT COIN',
  hookStyle: 'arcade',
  victoryText: 'YOU WIN!',
  scoreText: 'Sayı!',
  layoutMode: 'mockup',
  gameplayScale: 1.35,
  clipStartSec: 1,
  ctaTitle: "Google Play'de Ücretsiz!",
  ctaButton: 'Hemen Oyna',
  ctaSub: '8-bit piksel voleybol',
  musicFile: 'remotion/music-v3.wav',
  bpm: 120,
  musicVolume: 0.5,
  accent: '#19C37D',
  accentDark: '#0b6b45',
  highlight: '#FFD24A',
};

/** BPM → kare cinsinden vuruş aralığı */
export const beatFrames = (bpm: number): number => (FPS * 60) / bpm;
