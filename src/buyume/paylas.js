/**
 * Sonuç ve davet paylaşımı.
 *
 * Yerel kabukta Capacitor Share: görsel önbelleğe yazılır, sayfa
 * metin + Play adresiyle açılır. Tarayıcıda Web Share API; o da yoksa
 * bağlantı panoya, görsel indirilir. İptal hata değildir.
 */

import { t } from '../i18n/index.js';
import { yerelKabukMu } from '../utils/gizlilik.js';
import { kartVerisi } from './kart.js';
import { PLAY_URL } from './magaza.js';

export { PLAY_URL } from './magaza.js';

/** @param {ReturnType<typeof kartVerisi>} kart */
export function paylasMetni(kart) {
  return [kart.sonuc, kart.skorSatiri, kart.mod, kart.ucretsiz].filter(Boolean).join('\n');
}

export function sonucPaylasimi(result, tournament) {
  const kart = kartVerisi(result, tournament);
  return {
    kart,
    title: t('share.dialog'),
    text: paylasMetni(kart),
    url: PLAY_URL,
  };
}

export function davetPaylasimi() {
  return {
    title: t('share.dialog'),
    text: [t('share.inviteBody'), t('share.free')].join('\n'),
    url: PLAY_URL,
  };
}

function iptalMi(hata) {
  const ad = String(hata?.name || '');
  const mesaj = String(hata?.message || hata || '').toLowerCase();
  return ad === 'AbortError'
    || mesaj.includes('cancel')
    || mesaj.includes('canceled')
    || mesaj.includes('abort');
}

function fileUri(uri) {
  if (!uri) return '';
  if (uri.startsWith('file:') || uri.startsWith('content:')) return uri;
  if (uri.startsWith('/')) return `file://${uri}`;
  return uri;
}

async function varsayilanDosyaYaz(canvas) {
  const { Directory, Filesystem } = await import('@capacitor/filesystem');
  const data = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
  const path = `retro-voleybol-${Date.now()}.png`;
  const yazilan = await Filesystem.writeFile({
    path,
    data,
    directory: Directory.Cache,
  });
  /*
   * Dosya silinmiyor. Sayfa kapanınca hedef uygulama hâlâ okuyor
   * olabilir; önbelleği işletim sistemi temizler.
   */
  return { uri: fileUri(yazilan?.uri) };
}

async function varsayilanYerelShare(opts) {
  const { Share } = await import('@capacitor/share');
  await Share.share(opts);
}

/**
 * @param {{ title?: string, text: string, url?: string, canvas?: HTMLCanvasElement | null }} istek
 * @param {object} [baglanti] Testlerin sahte paylaşım / pano vermesi için
 * @returns {Promise<'ok'|'iptal'|'hata'|'kopya'|'gorsel'|'yedek'>}
 */
export async function paylasAc(istek, baglanti = {}) {
  const yerel = baglanti.yerel ?? yerelKabukMu(baglanti.kap);
  const paket = {
    title: istek.title || t('share.dialog'),
    text: istek.text,
    url: istek.url || PLAY_URL,
    canvas: istek.canvas ?? null,
  };
  if (yerel) return yereldePaylas(paket, baglanti);
  return webdePaylas(paket, baglanti);
}

async function yereldePaylas(istek, baglanti) {
  const share = baglanti.share ?? varsayilanYerelShare;
  let dosya = null;
  if (istek.canvas?.toDataURL) {
    try {
      const yaz = baglanti.dosyaYaz ?? varsayilanDosyaYaz;
      dosya = await yaz(istek.canvas);
    } catch {
      dosya = null;
    }
  }
  const denemeler = [];
  if (dosya?.uri) {
    denemeler.push({
      title: istek.title,
      text: istek.text,
      url: istek.url,
      files: [dosya.uri],
      dialogTitle: istek.title,
    });
  }
  denemeler.push({
    title: istek.title,
    text: istek.text,
    url: istek.url,
    dialogTitle: istek.title,
  });
  for (const opts of denemeler) {
    try {
      await share(opts);
      return 'ok';
    } catch (hata) {
      if (iptalMi(hata)) return 'iptal';
    }
  }
  return 'hata';
}

async function webDosyalari(canvas) {
  if (!canvas?.toBlob || typeof File === 'undefined') return null;
  const blob = await new Promise((resolve) => {
    canvas.toBlob((sonuc) => resolve(sonuc), 'image/png');
  });
  if (!blob) return null;
  return [new File([blob], 'retro-voleybol.png', { type: 'image/png' })];
}

async function webdePaylas(istek, baglanti) {
  const nav = baglanti.navigator ?? (typeof navigator !== 'undefined' ? navigator : undefined);
  if (nav?.share) {
    try {
      const dosyalar = baglanti.dosyalar ?? (istek.canvas ? await webDosyalari(istek.canvas) : null);
      if (dosyalar && nav.canShare?.({ files: dosyalar })) {
        await nav.share({
          title: istek.title,
          text: istek.text,
          url: istek.url,
          files: dosyalar,
        });
      } else {
        await nav.share({ title: istek.title, text: istek.text, url: istek.url });
      }
      return 'ok';
    } catch (hata) {
      if (iptalMi(hata)) return 'iptal';
    }
  }
  return yedekKaydet(istek, baglanti);
}

async function yedekKaydet(istek, baglanti) {
  let kopya = false;
  let gorsel = false;
  const clipboard = baglanti.clipboard ?? (typeof navigator !== 'undefined' ? navigator.clipboard : undefined);
  const metin = `${istek.text}\n${istek.url}`;
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(metin);
      kopya = true;
    } catch {
      kopya = false;
    }
  }
  if (istek.canvas?.toDataURL && !baglanti.indirmeKapali) {
    try {
      indirKanvas(istek.canvas, baglanti.document);
      gorsel = true;
    } catch {
      gorsel = false;
    }
  }
  if (gorsel && kopya) return 'yedek';
  if (gorsel) return 'gorsel';
  if (kopya) return 'kopya';
  return 'hata';
}

function indirKanvas(canvas, doc) {
  const belge = doc ?? document;
  const url = canvas.toDataURL('image/png');
  const link = belge.createElement('a');
  link.href = url;
  link.download = 'retro-voleybol.png';
  belge.body.appendChild(link);
  link.click();
  link.remove();
}
