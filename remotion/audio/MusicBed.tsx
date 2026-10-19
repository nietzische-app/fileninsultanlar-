import React from 'react';
import {Audio, interpolate, staticFile, useVideoConfig} from 'remotion';

type Props = {
  file: string;
  volume: number;
};

/** Tüm video boyunca çalan müzik; girişte/çıkışta yumuşak fade. */
export const MusicBed: React.FC<Props> = ({file, volume}) => {
  const {durationInFrames, fps} = useVideoConfig();
  const fade = fps; // 1 sn

  return (
    <Audio
      src={staticFile(file)}
      volume={(f) =>
        interpolate(
          f,
          [0, fade, durationInFrames - fade, durationInFrames],
          [0, volume, volume, 0],
          {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
        )
      }
    />
  );
};
