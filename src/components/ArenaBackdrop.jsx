import { useEffect, useRef } from 'react';
import { drawArena, drawFloor, drawNet } from '../game/arena.js';
import { GAME_WIDTH, GAME_HEIGHT, GROUND_Y } from '../game/constants.js';

/**
 * Giriş ekranının arka planı — KODLA ÇİZİLEN salon.
 *
 * Burada bir fotoğraf vardı (84 KB, bize ait olmayan bir basın
 * görseli). Yerine başka bir fotoğraf koymak aynı sorunu tekrarlardı.
 *
 * Çizim için yeni bir şey yazılmadı: maç ekranının salonunu çizen
 * `arena.js` olduğu gibi kullanılıyor. Yani menüdeki arka plan,
 * oyuncunun birazdan içine gireceği sahanın ta kendisi — fotoğrafla
 * oyunun görüntüsü arasındaki üslup kopukluğu da böylece kapanıyor.
 *
 * TEK KARE çiziliyor, döngü yok. Menüde canlı bir salon animasyonu
 * çalıştırmak kareyi %62 saydamlıkta, degradelerin altında kimsenin
 * fark etmeyeceği bir şey için pil harcamak olurdu.
 */
export default function ArenaBackdrop({ className = '', style }) {
  const tuvalRef = useRef(null);

  useEffect(() => {
    const tuval = tuvalRef.current;
    if (!tuval) return;
    /*
     * Ölçü oyunun kendi çözünürlüğü. CSS `object-fit: cover` ile
     * ekranı kaplıyor; fotoğrafın `bg-cover` davranışının aynısı.
     */
    tuval.width = GAME_WIDTH;
    tuval.height = GAME_HEIGHT;
    const ctx = tuval.getContext('2d');
    if (!ctx) return;

    /*
     * `hype` 0.55: tribün ışıkları ve bayrak dalgalanması bu değerle
     * ölçekleniyor. Sıfırda salon ölü görünüyor, 1'de maçın en gergin
     * ânı gibi; menü için arada bir yer doğru.
     *
     * `score` ve `touch` null: sahadaki skorbordlar boş kalıyor.
     * Menüde 0-0 yazan bir skorbord, olmayan bir maçı ima ederdi.
     */
    drawArena(ctx, 0, 0.55, null, null);
    drawFloor(ctx);
    drawNet(ctx, GROUND_Y);
  }, []);

  return (
    <canvas
      ref={tuvalRef}
      aria-hidden="true"
      className={`pointer-events-none h-full w-full object-cover ${className}`}
      style={{ imageRendering: 'pixelated', ...style }}
    />
  );
}
