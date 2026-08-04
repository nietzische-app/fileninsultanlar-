import { useEffect, useRef } from 'react';
import { drawSultan, SPRITE_UNITS_H, SPRITE_UNITS_W } from '../game/sprites.js';

/**
 * Bir sultanın piksel avatarını küçük bir canvas üzerine çizer.
 *
 * Sahadaki figürle birebir aynı çizim fonksiyonunu kullanır
 * (src/game/sprites.js) — böylece seçim ekranındaki görsel ile
 * oyundaki karakter tutarlıdır.
 */
export default function PixelAvatar({
  player,
  scale = 5,
  pose = 'idle',
  facing = 1,
  showNumber = true,
  className = '',
}) {
  const canvasRef = useRef(null);

  const width = Math.round((SPRITE_UNITS_W + 2) * scale);
  const height = Math.round((SPRITE_UNITS_H + 2) * scale);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');

    const paint = () => {
      ctx.clearRect(0, 0, width, height);
      drawSultan(ctx, player, {
        x: width / 2,
        y: height - scale,
        scale,
        pose,
        facing,
        showNumber,
      });
    };

    paint();

    // Retro font geç yüklenirse forma numarası doğru fontla yeniden çizilsin
    let cancelled = false;
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (!cancelled) paint();
      });
    }

    return () => {
      cancelled = true;
    };
  }, [player, scale, pose, facing, showNumber, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`pixelated ${className}`}
      aria-label={`${player.name} piksel avatarı`}
    />
  );
}
