/**
 * Sunucuda koşan maç.
 *
 * Oyun motorunun aynısı (`src/game/Game.js`), başsız modda. Fizik,
 * kurallar ve servis burada işliyor; iki istemci de yalnızca çiziyor ve
 * tuşlarını yolluyor.
 *
 * Neden ev sahibi yetkili mimariden buraya geçildi: maçı bir oyuncunun
 * cihazı yönetiyordu. Arkadaş maçında sorun değil — ama yabancıyla
 * oynarken iki ayrı sorun var. Birincisi hile: ev sahibi tarayıcısında
 * koşan simülasyona müdahale edebilir. İkincisi ve daha sinsi olanı
 * gecikme avantajı: ev sahibi sıfır gecikmeyle oynarken karşısındaki
 * tam gidiş-dönüş süresi kadar geriden oynuyor. Sunucu hakem olunca
 * ikisi de aynı mesafede.
 *
 * Motorun başsız koşabilmesi tesadüf değil: simülasyonun kendisi zaten
 * DOM'a dokunmuyor, tarayıcıya bağlı üç şey de (arka plan önbelleği,
 * klavye dinleyicileri, rAF döngüsü) `update()` dışında duruyor.
 */

import Game from '../src/game/Game.js';

/** Simülasyon tiki (ms). Sabit adım motorun içinde; bu yalnız uyandırma. */
const TIK_MS = 1000 / 60;

/** Kadroda izin verilen en fazla sultan — istemciden gelen listeyi sınırlar. */
const AZAMI_KADRO = 2;

/**
 * İstemciden gelen maç ayarını temizler.
 *
 * Ayar artık SUNUCUDA çalışacak bir motoru kuruyor, yani istemciden
 * gelen veri doğrudan sunucu kaynağına dönüşüyor. Motor bilinmeyen
 * değerlerde zaten varsayılana düşüyor ama uzunluk sınırı onda yok:
 * on binlik bir `homeIds` dizisi buraya kadar gelebilirdi.
 */
function temizleAyar(ayar = {}) {
  const metin = (deger) => (typeof deger === 'string' ? deger.slice(0, 64) : undefined);
  const kadro = Array.isArray(ayar.homeIds)
    ? ayar.homeIds.filter((id) => typeof id === 'string').slice(0, AZAMI_KADRO).map(metin)
    : undefined;

  return {
    mode: metin(ayar.mode),
    homeIds: kadro,
    opponentId: metin(ayar.opponentId),
    format: metin(ayar.format),
    difficulty: metin(ayar.difficulty),
  };
}

export class Mac {
  /**
   * @param {object} secenek
   * @param {object} secenek.ayar İstemciden gelen maç ayarı (temizlenir)
   * @param {(paket: object) => void} secenek.yolla Her iki istemciye de gönderir
   * @param {(sonuc: object) => void} [secenek.bitince]
   */
  constructor({ ayar, yolla, bitince = () => {} }) {
    this.ayar = temizleAyar(ayar);
    this.yolla = yolla;
    this.bitince = bitince;
    this.zamanlayici = null;
    this.sonTik = 0;
    this.bittiMi = false;

    this.oyun = new Game(null, {
      ...this.ayar,
      // Çevrimiçi 1v1: iki yuva da insan, yapay zekâ yok
      playMode: 'vs',
      bassiz: true,
      agRol: 'ev',
      agGonder: (paket) => this.yolla(paket),
      onFinish: (sonuc) => {
        this.bittiMi = true;
        this.yolla({ t: 'bitis', sonuc });
        this.durdur();
        this.bitince(sonuc);
      },
    });
  }

  /** Motorun kurduğu gerçek ayar — istemcilere bunu yolluyoruz. */
  get gercekAyar() {
    return {
      mode: this.oyun.mode,
      homeIds: [...this.oyun.homeIds],
      /*
       * Rakip takım motorun kendi seçimi olabilir ("rastgele" gelirse).
       * İstemcilere motorun SEÇTİĞİNİ yolluyoruz, isteneni değil —
       * yoksa iki taraf farklı takım çizerdi.
       */
      opponentId: this.oyun.opponent.id,
      format: this.oyun.format.id,
      difficulty: this.ayar.difficulty,
    };
  }

  baslat() {
    if (this.zamanlayici) return;
    this.oyun.start();
    this.sonTik = performance.now();

    this.zamanlayici = setInterval(() => {
      const simdi = performance.now();
      const gecen = (simdi - this.sonTik) / 1000;
      this.sonTik = simdi;

      /*
       * Zamanlayıcı hassas değil (Node timer'ları kayar) ama önemli de
       * değil: `ilerlet` geçen GERÇEK zamanı sabit adımlara çeviriyor,
       * yani tik erken ya da geç gelse de sahadaki fizik aynı hızda
       * akıyor. Sabit adım işi tam da bunun için gerekliydi.
       */
      this.oyun.ilerlet(gecen);
      this.oyun.agAkis();
    }, TIK_MS);
  }

  /**
   * Bir istemcinin tuşlarını kendi yuvasına yazar.
   * @param {'p1'|'p2'} yuva
   */
  girdi(yuva, paket) {
    if (this.bittiMi) return;
    this.oyun.agPaketAl(paket, yuva);
  }

  durdur() {
    if (this.zamanlayici) {
      clearInterval(this.zamanlayici);
      this.zamanlayici = null;
    }
    this.oyun.destroy();
  }
}
