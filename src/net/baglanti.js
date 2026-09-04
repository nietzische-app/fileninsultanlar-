/**
 * Röle bağlantısı — tarayıcı tarafı.
 *
 * Tek bir WebSocket'i sarar ve oyunun geri kalanına dört şey sunar:
 * oda aç, odaya gir, mesaj yolla, olay dinle. React'ten bağımsız
 * tutuldu; ekranlar buna abone oluyor, bu ekranları tanımıyor.
 *
 * Bağlantı adresi `VITE_RELE_URL` ile veriliyor. Tanımlı değilse
 * online menüsü hiç açılmıyor — sunucusuz bir "çevrimiçi oyna"
 * düğmesi, basana kadar çalışıyormuş gibi görünen bir yalandır.
 */

/**
 * Röle adresi; yapı sırasında gömülür.
 *
 * Geliştirmede `?rele=ws://localhost:8799` ile ezilebiliyor — tarayıcı
 * testleri kendi rölesini bu şekilde gösteriyor, yoksa adresi yapıya
 * gömmek için testin vite'ı yeniden başlatması gerekirdi. Üretim
 * yapısında sorgu parametresi okunmuyor: yabancı bir adrese bağlanan
 * bir bağlantı, paylaşılan bir bağlantıyla tetiklenebilirdi.
 */
function releAdresi() {
  const gomulu = import.meta.env.VITE_RELE_URL ?? '';
  if (!import.meta.env.DEV || typeof window === 'undefined') return gomulu;
  const sorgu = new URLSearchParams(window.location.search).get('rele');
  return sorgu || gomulu;
}

export const RELE_URL = releAdresi();

/** Online oynanabilir mi — menüyü göstermeden önce buna bakılır. */
export function onlineAcik() {
  return Boolean(RELE_URL);
}

/** Hata kodlarının Türkçe karşılığı. */
export const HATA_METNI = {
  'oda-yok': 'Böyle bir oda yok. Kodu kontrol edin.',
  'oda-dolu': 'Bu odada maç zaten başlamış.',
  'zaten-odada': 'Zaten bir odadasınız.',
  'zaten-sirada': 'Zaten sıradasınız.',
  'sunucu-dolu': 'Sunucu şu an dolu, biraz sonra deneyin.',
  'kod-uretilemedi': 'Oda açılamadı, tekrar deneyin.',
  'cok-hizli': 'Bağlantı çok fazla mesaj gönderdi.',
  'bozuk-mesaj': 'Sunucu mesajı anlamadı.',
  baglanti: 'Sunucuya ulaşılamadı.',
  koptu: 'Bağlantı koptu.',
};

export function hataMetni(sebep) {
  return HATA_METNI[sebep] ?? 'Bilinmeyen bir sorun oldu.';
}

export class Baglanti {
  constructor(url = RELE_URL) {
    this.url = url;
    this.soket = null;
    this.rol = null;
    this.kod = null;
    /** @type {Map<string, Set<Function>>} */
    this.dinleyiciler = new Map();
  }

  /** Olay dinler; dönen fonksiyon aboneliği bitirir. */
  on(olay, geriCagri) {
    if (!this.dinleyiciler.has(olay)) this.dinleyiciler.set(olay, new Set());
    this.dinleyiciler.get(olay).add(geriCagri);
    return () => this.dinleyiciler.get(olay)?.delete(geriCagri);
  }

  yay(olay, veri) {
    this.dinleyiciler.get(olay)?.forEach((f) => f(veri));
  }

  /** Bağlanır; açılana kadar bekler. */
  baglan() {
    if (!this.url) return Promise.reject(new Error('rele-yok'));
    if (this.soket && this.soket.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise((coz, red) => {
      let soket;
      try {
        soket = new WebSocket(this.url);
      } catch (hata) {
        red(hata);
        return;
      }
      this.soket = soket;

      soket.addEventListener('open', () => coz());
      soket.addEventListener('error', () => red(new Error('baglanti')));

      soket.addEventListener('message', (olay) => {
        let mesaj;
        try {
          mesaj = JSON.parse(olay.data);
        } catch {
          return;
        }
        if (!mesaj || typeof mesaj !== 'object') return;

        if (mesaj.t === 'oda') {
          this.kod = mesaj.kod;
          this.rol = mesaj.rol;
        }
        /*
         * Her mesaj hem kendi adıyla hem de 'mesaj' adıyla yayılıyor.
         * Ekranlar denetim mesajlarını (oda, eşleşme, ayrıldı) ada göre
         * dinliyor; motor ise tek bir kapıdan bütün oyun paketlerini
         * alıyor ve tanımadığını yok sayıyor.
         */
        this.yay(mesaj.t, mesaj);
        this.yay('mesaj', mesaj);
      });

      soket.addEventListener('close', () => {
        // Oda bilgisi kapanınca geçersiz; kalırsa ekran hayalet oda gösterir
        this.kod = null;
        this.rol = null;
        this.yay('kapandi', null);
      });
    });
  }

  yolla(veri) {
    if (!this.soket || this.soket.readyState !== WebSocket.OPEN) return false;
    this.soket.send(JSON.stringify(veri));
    return true;
  }

  odaAc() {
    return this.yolla({ t: 'oda-ac' });
  }

  odaGir(kod) {
    return this.yolla({ t: 'oda-gir', kod });
  }

  /**
   * Hızlı eşleşme sırasına girer.
   *
   * Kimlik burada gidiyor çünkü sunucu maçı kurarken karşı tarafın
   * adına ihtiyaç duyuyor ve o an elinde yalnız soket var. Her girdi
   * paketine ad eklemek (saniyede 60) anlamsız olurdu.
   */
  hizliEsles(kimlik) {
    return this.yolla({ t: 'hizli-esles', kimlik });
  }

  siradanCik() {
    return this.yolla({ t: 'siradan-cik' });
  }

  /** Kimliği bağlantıya yapıştırır — arkadaş maçı yolu için. */
  kimlikBildir(kimlik) {
    return this.yolla({ t: 'kimlik', kimlik });
  }

  ayril() {
    this.yolla({ t: 'ayril' });
    this.kod = null;
    this.rol = null;
  }

  kapat() {
    this.dinleyiciler.clear();
    if (this.soket && this.soket.readyState <= WebSocket.OPEN) this.soket.close();
    this.soket = null;
    this.kod = null;
    this.rol = null;
  }
}
