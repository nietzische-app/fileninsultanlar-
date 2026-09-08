/**
 * Röle bağlantısı — tarayıcı tarafı.
 *
 * Altındaki boruyu `tasima.js` seçiyor (WebTransport, olmazsa
 * WebSocket); burası o seçimden habersiz. Oyunun geri kalanına dört şey
 * sunar:
 * oda aç, odaya gir, mesaj yolla, olay dinle. React'ten bağımsız
 * tutuldu; ekranlar buna abone oluyor, bu ekranları tanımıyor.
 *
 * Bağlantı adresi `VITE_RELE_URL` ile veriliyor. Tanımlı değilse
 * online menüsü hiç açılmıyor — sunucusuz bir "çevrimiçi oyna"
 * düğmesi, basana kadar çalışıyormuş gibi görünen bir yalandır.
 */

import { PAKET_SURUM } from '../game/snapshot.js';
import { tasimaKur } from './tasima.js';

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
  'cok-baglanti': 'Bu ağdan çok fazla bağlantı açık. Diğer sekmeleri kapatıp deneyin.',
  'bozuk-mesaj': 'Sunucu mesajı anlamadı.',
  'surum-uyusmuyor':
    'Oyunun sürümü sunucununkiyle uyuşmuyor. Sayfayı yenile (gerekirse '
    + 'önbelleği temizle); sorun sürerse site güncellenmemiş demektir.',
  baglanti: 'Sunucuya ulaşılamadı.',
  koptu: 'Bağlantı koptu.',
};

export function hataMetni(sebep) {
  return HATA_METNI[sebep] ?? 'Bilinmeyen bir sorun oldu.';
}

export class Baglanti {
  /**
   * @param {string} [url] Röle adresi
   * @param {object} [secenek] `tasimaKur`a geçiyor (test ve WT kapatma)
   */
  constructor(url = RELE_URL, secenek = {}) {
    this.url = url;
    this.secenek = secenek;
    /** @type {import('./tasima.js').WebSocketTasima|null} */
    this.tasima = null;
    /** Kapatıldı mı — taşıma kurulurken gelen `kapat()` buradan görülüyor. */
    this.kapandi = false;
    this.rol = null;
    this.kod = null;
    /** @type {Map<string, Set<Function>>} */
    this.dinleyiciler = new Map();
  }

  /** Hangi taşıma kullanılıyor — teşhis ve test için. */
  get tasimaAdi() {
    return this.tasima?.ad ?? null;
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
  async baglan() {
    if (!this.url) throw new Error('rele-yok');
    if (this.tasima?.acikMi()) return;

    this.kapandi = false;
    const tasima = await tasimaKur(this.url, this.secenek);

    /*
     * BAĞLANIRKEN KAPATILDIYSA taşımayı hemen bırak.
     *
     * `kapat()` yalnız `this.tasima`ya bakıyordu ve o alan taşıma
     * KURULDUKTAN sonra doluyor. Kurulum sırasında kapatılan bir
     * bağlantıda `kapat()` boşa gidiyor, sonra taşıma sessizce açılıp
     * SAHİPSİZ kalıyordu.
     *
     * Belirtisi ağ hatası değildi, bambaşka bir şeydi: React
     * geliştirmede efektleri bağla-çöz-bağla diye çalıştırıyor, HEMEN
     * OYNA iki bağlantı açıyor, ikisi de sıraya giriyor ve röle
     * oyuncuyu KENDİSİYLE eşleştiriyordu. Ekranda gerçek bir maç
     * görünüyordu; rakip yoktu. Rövanş testi bunu "haber ulaşmadı"
     * diye yakaladı — iki taraf ayrı odalardaydı.
     *
     * Bu, taşıma katmanına geçerken doğdu: eski kod `WebSocket`i
     * kurucuda açtığı için `kapat()`ın kapatacağı bir nesne HEP vardı.
     */
    if (this.kapandi) {
      tasima.kapat();
      return;
    }
    this.tasima = tasima;

    tasima.onMesaj = (mesaj) => {
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
    };

    tasima.onKapandi = () => {
      // Oda bilgisi kapanınca geçersiz; kalırsa ekran hayalet oda gösterir
      this.kod = null;
      this.rol = null;
      this.yay('kapandi', null);
    };
  }

  yolla(veri) {
    return this.tasima ? this.tasima.yolla(veri) : false;
  }

  odaAc() {
    return this.yolla({ t: 'oda-ac' });
  }

  odaGir(kod) {
    return this.yolla({ t: 'oda-gir', kod });
  }

  /** Hızlı eşleşme sırasına girer. Kimlik önceden bildirilmiş olmalı. */
  hizliEsles() {
    return this.yolla({ t: 'hizli-esles' });
  }

  siradanCik() {
    return this.yolla({ t: 'siradan-cik' });
  }

  /**
   * Kimliği sunucuya bildirir ve cevabını bekler.
   *
   * Anahtar varsa sunucu aynı kimliği geri veriyor; yoksa (ya da
   * anahtar tutmuyorsa) yenisini açıyor. Kimlik bağlantıya yapışıyor,
   * mesajlarla taşınmıyor: maç kurulurken karşı tarafın adı gerekiyor
   * ve o an sunucunun elinde yalnız soket var. Saniyede 60 girdi
   * paketinin her birine ad eklemek anlamsız olurdu.
   *
   * @returns {Promise<object>} Sunucunun kimlik cevabı
   */
  kimlikBildir({ id, gizli, ad }) {
    return new Promise((coz) => {
      const cozul = this.on('kimlik', (mesaj) => {
        cozul();
        coz(mesaj);
      });
      /*
       * Paket sürümü de bildiriliyor. Sebebi yaşanmış bir arıza: site
       * ile röle AYRI dağıtılıyor ve site geride kaldığında sunucu
       * `v:2` yolluyor, istemci `v:1` bekliyor, gelen her paketi
       * sessizce atıyordu. Görünen tek şey ilk karede donmuş bir maçtı;
       * ne istemcide ne sunucuda tek satır iz vardı.
       *
       * Sürümü EL SIKIŞMADA söylemek, uyuşmazlığı maç kurulmadan ÖNCE
       * yakalatıyor. Sunucu bunu hem günlüğe yazıyor hem de oyuncuya
       * söylüyor — çizilemeyecek bir maçı başlatmaktansa sebebini
       * söyleyip başlatmamak daha iyi.
       */
      this.yolla({ t: 'kimlik', id, gizli, ad, surum: PAKET_SURUM });
    });
  }

  /** Skor tablosunu ister; cevap `siralama` olayıyla gelir. */
  siralamaIste() {
    return this.yolla({ t: 'siralama' });
  }

  /**
   * Rövanş isteği — aynı odada, aynı rakiple yeni maç.
   *
   * Sunucu İKİ TARAFIN da istemesini bekliyor; tek taraflı çağrı
   * yalnızca "hazırım" oyu veriyor ve karşı tarafa haber gidiyor.
   */
  rovans() {
    this.yolla({ t: 'rovans' });
  }

  ayril() {
    this.yolla({ t: 'ayril' });
    this.kod = null;
    this.rol = null;
  }

  kapat() {
    this.dinleyiciler.clear();
    // Kurulumu süren bir taşıma varsa `baglan()` bu bayrağa bakıp bırakıyor
    this.kapandi = true;
    this.tasima?.kapat();
    this.tasima = null;
    this.kod = null;
    this.rol = null;
  }
}
