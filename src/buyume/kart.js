/**
 * Paylaşım görseli — skor, mod, takımlar, logo, Play bağlantısı.
 * Repoda PNG yok; kart da sahadaki gibi tuvalde çizilir.
 */

import { PALETTE } from '../game/constants.js';
import { t } from '../i18n/index.js';
import { upper } from '../utils/text.js';
import { PLAY_URL } from './magaza.js';

export const KART_BOY = 1080;

const URL_SATIRLARI = [
  'https://play.google.com/store/apps/',
  'details?id=app.retrovoleybol.oyun',
];

function kisalt(value, n) {
  const metin = String(value ?? '');
  if (metin.length <= n) return metin;
  return `${metin.slice(0, n - 1)}…`;
}

/** Menü modunun paylaşımda görünen adı. */
export function modAdi(result) {
  if (result?.campaign === 'survival' || result?.survival) return t('mode.survival.label');
  if (result?.campaign === 'tournament') return t('mode.tournament.label');
  if (result?.playMode === 'coop') return t('mode.coop.label');
  if (result?.cevrimici) return t('mode.hemen.label');
  if (result?.playMode === 'vs') return t('mode.versus.label');
  return t('mode.match.label');
}

/**
 * @param {object} result
 * @param {{ champion?: boolean, status?: string } | null} [tournament]
 */
export function kartVerisi(result, tournament) {
  const survival = result?.campaign === 'survival' ? result.survival : null;
  const ev = kisalt(upper(t('hud.home')), 14);
  const deplasman = kisalt(
    upper(result?.opponent?.shortName || result?.opponent?.name || t('hud.away')),
    14,
  );
  const sampiyon = Boolean(tournament?.champion || tournament?.status === 'won');
  const elendi = Boolean(tournament) && !sampiyon;
  let sonuc = t('share.loss');
  if (survival) sonuc = t('share.run');
  else if (sampiyon) sonuc = t('share.cup');
  else if (elendi) sonuc = t('share.out');
  else if (result?.winner === 'home') sonuc = t('share.win');

  const skorSatiri = survival
    ? t('share.survScore', { points: survival.points ?? 0, wave: survival.wave ?? 0 })
    : t('share.score', {
      home: ev,
      away: deplasman,
      hs: result?.sets?.home ?? 0,
      as: result?.sets?.away ?? 0,
    });

  const setler = Array.isArray(result?.setHistory)
    ? result.setHistory.map((set) => `${set.home}-${set.away}`).join('  ')
    : '';

  return {
    baslik: t('brand.title'),
    mod: modAdi(result),
    ev,
    deplasman,
    sonuc,
    skorSatiri,
    setler,
    hayatta: Boolean(survival),
    skorEv: result?.sets?.home ?? 0,
    skorDep: result?.sets?.away ?? 0,
    puan: survival?.points ?? 0,
    dalga: survival?.wave ?? 0,
    ucretsiz: t('share.free'),
    url: PLAY_URL,
    urlSatirlari: URL_SATIRLARI,
  };
}

function pikselTop(ctx, x, y, size) {
  const u = size / 16;
  const px = (gx, gy, gw, gh, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(
      Math.round(x + gx * u),
      Math.round(y + gy * u),
      Math.ceil(gw * u),
      Math.ceil(gh * u),
    );
  };
  px(0, 0, 16, 16, PALETTE.turkishRed);
  px(4, 4, 8, 8, '#FFFFFF');
  px(4, 7, 8, 2, PALETTE.turkishRed);
  px(7, 4, 2, 8, PALETTE.turkishRed);
  px(1, 1, 14, 1, 'rgba(0,0,0,0.28)');
}

function yaz(ctx, text, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.font = `${size}px "Press Start 2P", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(String(text), x, y);
  return y + size;
}

function bol(ctx, text, max, size) {
  ctx.font = `${size}px "Press Start 2P", monospace`;
  const kelimeler = String(text).split(' ');
  const cikti = [];
  let satir = '';
  kelimeler.forEach((kelime) => {
    const aday = satir ? `${satir} ${kelime}` : kelime;
    const gen = ctx.measureText ? ctx.measureText(aday).width : aday.length * size;
    if (satir && gen > max) {
      cikti.push(satir);
      satir = kelime;
    } else {
      satir = aday;
    }
  });
  if (satir) cikti.push(satir);
  return cikti.length ? cikti : [''];
}

function yazBlok(ctx, text, x, y, size, color, max) {
  let cy = y;
  bol(ctx, text, max, size).forEach((satir) => {
    yaz(ctx, satir, x, cy, size, color);
    cy += size + Math.round(size * 0.45);
  });
  return cy;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {ReturnType<typeof kartVerisi>} kart
 * @param {number} [w]
 * @param {number} [h]
 */
export function cizPaylasimKarti(ctx, kart, w = KART_BOY, h = KART_BOY) {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = PALETTE.night;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = PALETTE.turkishRed;
  ctx.fillRect(0, 0, w, Math.round(h * 0.018));
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(0, h - Math.round(h * 0.018), w, Math.round(h * 0.018));

  const logo = Math.round(w * 0.12);
  pikselTop(ctx, Math.round((w - logo) / 2), Math.round(h * 0.07), logo);

  let y = Math.round(h * 0.22);
  y = yaz(ctx, kart.baslik, w / 2, y, Math.round(w * 0.04), PALETTE.turkishRed);
  y += Math.round(h * 0.035);
  y = yazBlok(ctx, kart.sonuc, w / 2, y, Math.round(w * 0.026), '#FFFFFF', w * 0.86);
  y += Math.round(h * 0.02);
  y = yaz(ctx, kart.mod, w / 2, y, Math.round(w * 0.02), PALETTE.gold);
  y += Math.round(h * 0.05);

  if (kart.hayatta) {
    y = yaz(ctx, String(kart.puan), w / 2, y, Math.round(w * 0.09), '#FFFFFF');
    y += Math.round(h * 0.02);
    yaz(ctx, kart.skorSatiri, w / 2, y, Math.round(w * 0.02), PALETTE.gold);
  } else {
    const adBoy = Math.round(w * 0.02);
    yaz(ctx, kart.ev, w * 0.28, y, adBoy, PALETTE.turkishRed);
    yaz(ctx, kart.deplasman, w * 0.72, y, adBoy, '#9BB0FF');
    y += Math.round(h * 0.045);
    const skorBoy = Math.round(w * 0.08);
    yaz(ctx, String(kart.skorEv), w * 0.28, y, skorBoy, '#FFFFFF');
    yaz(ctx, String(kart.skorDep), w * 0.72, y, skorBoy, '#FFFFFF');
    yaz(ctx, '-', w / 2, y + Math.round(skorBoy * 0.28), Math.round(w * 0.035), 'rgba(255,255,255,0.4)');
    if (kart.setler) {
      y += skorBoy + Math.round(h * 0.03);
      yaz(ctx, kart.setler, w / 2, y, Math.round(w * 0.018), 'rgba(255,255,255,0.55)');
    }
  }

  const footer = Math.round(h * 0.78);
  yaz(ctx, kart.ucretsiz, w / 2, footer, Math.round(w * 0.024), PALETTE.gold);
  kart.urlSatirlari.forEach((satir, i) => {
    yaz(
      ctx,
      satir,
      w / 2,
      footer + Math.round(h * 0.045) * (i + 1),
      Math.round(w * 0.016),
      'rgba(255,255,255,0.72)',
    );
  });
}

/** Yazı tipi hazırsa bekler, sonra kartı çizer. Hazır değilse de çizer. */
export async function paylasimKanvasi(kart) {
  const fontlar = typeof document !== 'undefined' ? document.fonts : null;
  if (fontlar?.load) {
    try {
      await Promise.race([
        fontlar.load('16px "Press Start 2P"'),
        new Promise((resolve) => { setTimeout(resolve, 400); }),
      ]);
    } catch {
      /* yedek monospace */
    }
  }
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = KART_BOY;
  canvas.height = KART_BOY;
  const ctx = canvas.getContext('2d');
  if (ctx) cizPaylasimKarti(ctx, kart);
  return canvas;
}
