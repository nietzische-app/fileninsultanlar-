/**
 * TARAYICI KABUĞU — motorun beklediği asgari DOM.
 *
 * Motor (`src/game/Game.js`) tarayıcı için yazıldı ve üç şeye dokunuyor:
 * `document.createElement('canvas')` (arka plan önbelleği),
 * `window.addEventListener` (klavye) ve `requestAnimationFrame`
 * (kare döngüsü). Bu dosya o üçünü Node'da karşılıyor.
 *
 * NEDEN MOTORU DEĞİŞTİRMİYORUZ: yerli istemcinin bütün değeri "aynı
 * motoru çalıştırmak". Motora `if (yerliyse)` dalları eklemek, ölçmek
 * istediğimiz şeyi — tarayıcı ile yerli arasındaki farkı — kodun
 * içine taşırdı. Kabuk dışarıda durunca motor ikisinde de birebir aynı.
 *
 * NE TAKLİT ETMİYOR: Web Audio. Ses motoru bağlam kuramadığında zaten
 * kendini sessiz bırakıyor (`audio.js` her çağrıda `this.ctx` bakıyor),
 * ama `unlock()` `window.AudioContext`e uzanıyor. Onu boş bırakmak
 * yerine ses motorunun kendisi susturuluyor — tek satır ve niyeti açık.
 */

import { createCanvas } from 'canvas';
import { EventEmitter } from 'node:events';

/**
 * Motorun ihtiyaç duyduğu tarayıcı yüzeyini `globalThis`e kurar.
 *
 * @param {{ kareHz?: number }} [ayar]
 * @returns {{ olaylar: EventEmitter, durdur: () => void }}
 */
export function kabukKur({ kareHz = 60 } = {}) {
  const olaylar = new EventEmitter();
  /*
   * Sonsuz dinleyici uyarısı: motor açılışta üç dinleyici kuruyor ve
   * varsayılan sınır 10. Sınırı kaldırmak yerine makul bir sayı
   * vermek, gerçek bir sızıntıyı hâlâ görünür bırakıyor.
   */
  olaylar.setMaxListeners(50);

  globalThis.document = globalThis.document ?? {
    createElement: (ad) => {
      if (ad !== 'canvas') throw new Error(`kabuk yalnız canvas üretiyor: ${ad}`);
      return createCanvas(1, 1);
    },
  };

  globalThis.window = globalThis.window ?? {
    addEventListener: (ad, f) => olaylar.on(ad, f),
    removeEventListener: (ad, f) => olaylar.off(ad, f),
    /*
     * `AudioContext` BİLEREK tanımsız. Ses motoru onu bulamayınca
     * bağlam kurmuyor ve geri kalan bütün çağrıları sessizce yutuyor.
     */
  };

  /*
   * KARE DÖNGÜSÜ. Tarayıcıda bunu ekranın tazeleme hızı sürüyor;
   * burada bir zamanlayıcı. Motor geçen GERÇEK süreyi ölçüp sabit
   * adımlara çevirdiği için gördüğü şey aynı — damga da tarayıcıdaki
   * gibi `performance.now()`.
   */
  const aralik = 1000 / kareHz;
  let sonraki = null;
  const bekleyenler = new Set();
  globalThis.requestAnimationFrame = (f) => {
    const kimlik = Symbol('kare');
    bekleyenler.add({ kimlik, f });
    return kimlik;
  };
  globalThis.cancelAnimationFrame = (kimlik) => {
    bekleyenler.forEach((k) => { if (k.kimlik === kimlik) bekleyenler.delete(k); });
  };

  sonraki = setInterval(() => {
    if (!bekleyenler.size) return;
    const simdi = performance.now();
    /*
     * Kopya alınıp küme boşaltılıyor: geri çağrı içinden yeni bir kare
     * isteniyor (motor döngüyü böyle sürdürüyor) ve aynı turda onu da
     * çalıştırırsak sonsuz döngüye gireriz.
     */
    const tur = [...bekleyenler];
    bekleyenler.clear();
    tur.forEach(({ f }) => f(simdi));
  }, aralik);

  return {
    olaylar,
    durdur() {
      clearInterval(sonraki);
      bekleyenler.clear();
    },
  };
}

/** Ses motorunu tamamen susturur — Node'da Web Audio yok. */
export function sesiSustur(Sfx) {
  const proto = Object.getPrototypeOf(Sfx);
  Object.getOwnPropertyNames(proto).forEach((ad) => {
    if (ad === 'constructor') return;
    if (typeof Sfx[ad] === 'function') Sfx[ad] = () => {};
  });
}
