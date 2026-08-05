/**
 * Hayatta kalma modu — saf yardımcılar.
 *
 * Set ve maç yok: sayı sayı ilerleyen tek bir zincir. Kazandığın her
 * sayı puan, kaybettiğin her sayı bir can. `waveLength` puanda bir
 * dalga yükselir: rakip takım değişir ve bir tık sertleşir.
 *
 * Motor bu dosyayı yalnızca hesap için kullanır; durumu kendi tutar.
 */

import { SURVIVAL, scaleDifficulty } from './constants.js';
import { OPPONENT_TEAMS } from './opponents.js';

/**
 * Kazanılan puan sayısına karşılık gelen dalga (1'den başlar).
 * @param {number} points
 * @param {number} [waveLength]
 */
export function waveForPoints(points, waveLength = SURVIVAL.waveLength) {
  const safe = Math.max(0, Math.floor(points));
  return Math.floor(safe / Math.max(1, waveLength)) + 1;
}

/** Dalganın bitmesine kaç puan kaldı. */
export function pointsToNextWave(points, waveLength = SURVIVAL.waveLength) {
  const len = Math.max(1, waveLength);
  const safe = Math.max(0, Math.floor(points));
  return len - (safe % len);
}

/**
 * Dalgaya göre rakip zorluğu.
 *
 * Eğri seçilen kademenin `startEase` kadar altından başlar, dalga
 * başına `rampPerWave` sertleşir ve `maxRampWave`'de durur. Üst sınır
 * şart: aksi hâlde yeterince uzun dayanan oyuncuya matematiksel olarak
 * imkânsız bir rakip çıkıyor, mod beceri sınavı olmaktan çıkıp zaman
 * aşımına dönüşüyor.
 *
 * @param {object} base DIFFICULTY kademesi
 * @param {number} wave 1'den başlar
 */
export function survivalDifficulty(base, wave) {
  const capped = Math.min(Math.max(1, wave), SURVIVAL.maxRampWave);
  return scaleDifficulty(
    base,
    (capped - 1) * SURVIVAL.rampPerWave - SURVIVAL.startEase
  );
}

/** Seçilen kademeye eşitlenilen dalga — HUD ipucu için. */
export function baselineWave() {
  return Math.round(SURVIVAL.startEase / SURVIVAL.rampPerWave) + 1;
}

/**
 * Dalganın rakip takımı — liste başa sarar.
 * @param {number} wave
 * @param {Array} [teams]
 */
export function waveOpponent(wave, teams = OPPONENT_TEAMS) {
  const index = (Math.max(1, Math.floor(wave)) - 1) % teams.length;
  return teams[index];
}

/**
 * Dalga adı — HUD ve duyuru için.
 * @param {number} wave
 */
export function waveLabel(wave) {
  return `${Math.max(1, Math.floor(wave))}. DALGA`;
}

/**
 * Koşu sonunda gösterilecek rütbe. Tamamen kozmetik ama bir hedef
 * duygusu veriyor: "23 puan" tek başına iyi mi kötü mü belli değil.
 * @param {number} points
 */
export function survivalRank(points) {
  if (points >= 60) return 'EFSANE';
  if (points >= 40) return 'SULTAN';
  if (points >= 25) return 'MİLLÎ OYUNCU';
  if (points >= 15) return 'PROFESYONEL';
  if (points >= 7) return 'GENÇ TAKIM';
  return 'ÇAYLAK';
}
