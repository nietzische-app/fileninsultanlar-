import React, {useEffect, useState} from 'react';
import {getAudioDurationInSeconds} from '@remotion/media-utils';
import {
  Audio,
  Sequence,
  continueRender,
  delayRender,
  staticFile,
  useVideoConfig,
} from 'remotion';

type Props = {
  /** `public/` altındaki yol, örn. `remotion/beep.wav` */
  file: string;
  /** Bu sesin başlayacağı kare (ebeveyn Sequence’e göre) */
  atFrame: number;
  volume?: number;
};

/**
 * Ses efektini kareye kilitleyen sarmalayıcı.
 * `@remotion/media-utils` ile süre okunur → `durationInFrames` senkron kalır.
 */
export const SyncedBeep: React.FC<Props> = ({
  file,
  atFrame,
  volume = 1,
}) => {
  const {fps} = useVideoConfig();
  const src = staticFile(file);
  const [frames, setFrames] = useState<number | null>(null);
  const [handle] = useState(() =>
    delayRender(`audio-duration:${file}`),
  );

  useEffect(() => {
    let cancelled = false;
    getAudioDurationInSeconds(src)
      .then((sec) => {
        if (!cancelled) {
          setFrames(Math.max(1, Math.ceil(sec * fps)));
          continueRender(handle);
        }
      })
      .catch((err) => {
        console.warn('SyncedBeep süre okunamadı, 0.2s varsayılan:', err);
        if (!cancelled) {
          setFrames(Math.ceil(0.2 * fps));
          continueRender(handle);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [src, fps, handle]);

  if (frames === null) return null;

  return (
    <Sequence from={atFrame} durationInFrames={frames} layout="none">
      <Audio src={src} volume={volume} />
    </Sequence>
  );
};
