/** 9:16 Shorts / Reels — 15 sn @ 30 fps */
export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const TOTAL_SECONDS = 15;
export const TOTAL_FRAMES = FPS * TOTAL_SECONDS;

/** Sahne sınırları (kare) */
export const HOOK_FROM = 0;
export const HOOK_FRAMES = FPS * 3; // 0–3 sn
export const PLAY_FROM = HOOK_FRAMES; // 3 sn
export const PLAY_FRAMES = FPS * 7; // 3–10 sn
export const CTA_FROM = PLAY_FROM + PLAY_FRAMES; // 10 sn
export const CTA_FRAMES = FPS * 5; // 10–15 sn

/** Oynanış içinde “ZAFER!” patlaması (sahne-içi kare) */
export const VICTORY_AT = FPS * 4; // oynanışın ~4. sn’si ≈ global 7. sn

/** Sayı anı: 0.3 sn’lik yumuşak zoom-in, ardından yavaş gevşeme */
export const VICTORY_ZOOM_FRAMES = Math.round(FPS * 0.3);
export const VICTORY_ZOOM_RELAX_FRAMES = Math.round(FPS * 0.8);
export const VICTORY_ZOOM_AMOUNT = 0.08;

/** Sayı anı: 4 kare süren ekran sarsıntısı (px, kare başına azalan) */
export const SHAKE_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-14, 8],
  [11, -9],
  [-7, 5],
  [4, -3],
];
