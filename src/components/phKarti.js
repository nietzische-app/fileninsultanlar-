/**
 * Product Hunt kartının nerede görüneceği.
 *
 * Gömü sitedeki ziyaretçi içindir. Mağaza paketinde ve oyun
 * portallarında (Y8, CrazyGames, iframe) aynı paket çalışır; orada
 * harici bir tanıtım kartı hem yersiz hem portal kurallarına aykırı.
 *
 * Geliştirme `localhost`'ta, dağıtım önizlemesi `*.vercel.app`'ta
 * görünür. Capacitor da `localhost` kullanır ama o yol `yerel` ile kapanır.
 */

export const PH_ADRES =
  'https://www.producthunt.com/products/retro-voleybol?embed=true&utm_source=embed&utm_medium=post_embed';

export const PH_IKON =
  'https://ph-files.imgix.net/8d1135a6-a7ab-4555-bc70-386c652351c0.png?auto=compress,format&codec=mozjpeg&cs=strip&fit=crop&h=80&w=80';

const SITE = new Set(['retrovoleybol.online', 'www.retrovoleybol.online']);
const GELISTIRME = new Set(['localhost', '127.0.0.1']);

/**
 * @param {{ yerel?: boolean, hostname?: string, cerceve?: boolean }} [ortam]
 * @returns {boolean}
 */
export function phKartiGoster({ yerel = false, hostname = '', cerceve = false } = {}) {
  if (yerel || cerceve) return false;
  const ad = String(hostname).toLowerCase();
  if (SITE.has(ad) || GELISTIRME.has(ad)) return true;
  // Nokta sınırı: `notvercel.app` ve `vercel.app.evil.com` elenir.
  return ad.endsWith('.vercel.app');
}
