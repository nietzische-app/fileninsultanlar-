/**
 * Dil motoru — sözlükten çeviri, geçerli dil, dinleyiciler.
 *
 * React bağlamı (`DilBaglami`) UI'yi yeniler; motor (`Game.js`) her
 * karede `t()` okur. Varsayılan dil `tr`: birim testleri ve eski
 * kayıtlar İngilizce tarayıcıda sessizce kaymasın.
 */

import { DIL_BILGI, DIL_KODLARI, SOZLUK } from './diller.js';

export { DIL_BILGI, DIL_KODLARI, SOZLUK };

/** @type {string} */
let dil = 'tr';
const dinleyiciler = new Set();

/** @param {unknown} value */
export function normalizeLang(value) {
  const kod = String(value ?? '').toLowerCase().slice(0, 2);
  return DIL_KODLARI.includes(kod) ? kod : null;
}

/** Tarayıcı dilinden ilk tahmin — yalnız `en*` İngilizce, gerisi Türkçe. */
export function detectBrowserLang() {
  if (typeof navigator === 'undefined') return 'tr';
  const raw = (navigator.languages?.[0] || navigator.language || 'tr').toLowerCase();
  return raw.startsWith('en') ? 'en' : 'tr';
}

export function getLang() {
  return dil;
}

export function dilLocale(kod = dil) {
  return DIL_BILGI[kod]?.locale ?? DIL_BILGI.tr.locale;
}

/**
 * @param {string} next
 * @param {{ silent?: boolean }} [opts]
 */
export function setLang(next, opts = {}) {
  const kod = normalizeLang(next) ?? 'tr';
  if (kod === dil) {
    if (!opts.silent) uygulaBelge(kod);
    return dil;
  }
  dil = kod;
  uygulaBelge(kod);
  dinleyiciler.forEach((fn) => {
    try {
      fn(kod);
    } catch {
      /* dinleyici patlaması çeviriyi bozmasın */
    }
  });
  return dil;
}

/** @param {(kod: string) => void} fn */
export function onLangChange(fn) {
  dinleyiciler.add(fn);
  return () => dinleyiciler.delete(fn);
}

function uygulaBelge(kod) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = kod;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) {
    meta.setAttribute(
      'content',
      kod === 'en'
        ? '8-bit pixel volleyball. Built with HTML5 Canvas; not a single image file inside.'
        : '8 bit piksel voleybol oyunu. HTML5 Canvas ile geliştirildi; içinde tek bir görsel dosyası yok.',
    );
  }
}

/**
 * @param {string} sablon
 * @param {Record<string, string|number>} [vars]
 */
export function doldur(sablon, vars) {
  if (!vars) return sablon;
  return String(sablon).replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] === undefined || vars[k] === null ? `{${k}}` : String(vars[k]),
  );
}

/**
 * @param {string} anahtar
 * @param {Record<string, string|number>} [vars]
 */
export function t(anahtar, vars) {
  const soz = SOZLUK[dil] ?? SOZLUK.tr;
  const ham = soz[anahtar] ?? SOZLUK.tr[anahtar] ?? anahtar;
  return doldur(ham, vars);
}

/** Yüzde — TR `%55`, EN `55%`. */
export function yuzde(n) {
  return t('pct', { n: Math.round(Number(n) || 0) });
}

export function sayiYazi(n) {
  const deger = Number(n);
  if (!Number.isFinite(deger)) return String(n ?? '');
  return deger.toLocaleString(dilLocale());
}

/**
 * Modun görünen yazıları — `GAME_MODES` içindeki sabit TR etiket
 * yedek kalsın, ekran buradan okusun.
 * @param {{ id: string }} mode
 * @param {Record<string, string|number>} [vars]
 */
export function modeYazi(mode, vars) {
  const id = mode?.id ?? '';
  return {
    label: t(`mode.${id}.label`),
    tagline: t(`mode.${id}.tagline`, vars),
    description: t(`mode.${id}.description`, vars),
  };
}

export function turYazi(round) {
  if (!round?.id) return round?.label ?? '';
  const ceviri = t(`round.${round.id}`);
  return ceviri === `round.${round.id}` ? round.label ?? '' : ceviri;
}

export function achYazi(item) {
  if (!item?.id) return { label: '', description: '' };
  return {
    label: t(`ach.${item.id}.label`),
    description: t(`ach.${item.id}.desc`),
  };
}

export function mevkiYazi(position) {
  if (!position) return '';
  const key = `pos.${position}`;
  const ceviri = t(key);
  return ceviri === key ? position : ceviri;
}

/**
 * Forma Puanı kalemi — `ad` Türkçe yedek (birim testleri), ekran `id`.
 * @param {{ id?: string, ad?: string, vars?: Record<string, string|number> }} k
 */
export function kalemYazi(k) {
  if (!k) return '';
  if (k.id === 'fp.mult') {
    const ham = String(k.vars?.ad ?? '');
    const adKey = ham === 'ANTRENMAN' ? 'fp.practice' : `diff.${ham.toLowerCase()}`;
    const adCeviri = t(adKey);
    const ad = adCeviri === adKey ? ham : adCeviri;
    return t('fp.mult', { ad, n: k.vars?.n ?? '' });
  }
  if (k.id) {
    const ceviri = t(k.id, k.vars);
    return ceviri === k.id ? (k.ad ?? k.id) : ceviri;
  }
  return k.ad ?? '';
}
