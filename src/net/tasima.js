/**
 * TAŞIMA KATMANI — bağlantının altındaki boru.
 *
 * `Baglanti` eskiden doğrudan bir `WebSocket` sarıyordu. Bu dosya o
 * bağı kesiyor ve iki taşıma sunuyor:
 *
 *   · WebSocket  — her yerde çalışır, TCP üstünde
 *   · WebTransport — HTTP/3 (QUIC) üstünde, DATAGRAM destekli
 *
 * NEDEN İKİNCİSİ: TCP'de kaybolan bir paket, arkasındakileri de
 * bekletiyor (head-of-line blocking). İstemci hiçbir şey almıyor,
 * sonra hepsi toplu geliyor. Ölçüldü (tests/olcum/tasima.mjs, aynı
 * ağda, ortalama gerilik):
 *
 *      kayıp    UDP     TCP    fark
 *       %0     38ms    38ms      0     ← kontrol
 *       %0.5   38ms    43ms     +5ms
 *       %2     38ms    56ms    +18ms
 *       %5     39ms    79ms    +40ms
 *
 * UDP satırı kayıptan neredeyse etkilenmiyor çünkü ara değerleme eksik
 * anlık görüntüyü zaten atlıyor: 17 ms sonra daha yenisi geliyor ve
 * eskisinin yeniden gönderilmesinin hiçbir değeri yok.
 *
 * HANGİ MESAJ HANGİ YOLDAN
 * ------------------------
 * Hepsini datagramla yollamak YANLIŞ olurdu: kimlik el sıkışması,
 * oda açma, maç kurulumu kaybolursa oyun hiç başlamaz. Ayrım şu:
 *
 *   datagram (güvenilmez)  → `durum` ve `girdi`, yani her kare tazelenen
 *                            ve eskisi değersizleşen şeyler
 *   akış (güvenilir)       → geri kalan her şey (kimlik, oda, maç,
 *                            bitiş, puan, sıralama)
 *
 * SAFARI'DE WEBTRANSPORT YOK. Bu yüzden seçim OTOMATİK ve geri düşüş
 * SESSİZ: WebTransport denenir, olmazsa WebSocket'e dönülür. iOS'ta
 * oyunun çalışmaya devam etmesi buna bağlı.
 */

import { datagramlik } from '../game/snapshot.js';

export { datagramlik };

/**
 * WebSocket adresinden WebTransport adresi türetir.
 *
 * `wss://rele.example/` → `https://rele.example/wt`
 *
 * Ayrı bir yol (`/wt`) çünkü QUIC dinleyicisi ayrı bir uç: aynı adrese
 * bakan bir HTTP/3 sunucusu WebSocket yükseltmesini karşılamıyor.
 * Dönüş `null` ise WebTransport denenmiyor demektir.
 *
 * @param {string} url
 * @returns {string|null}
 */
export function wtAdresi(url) {
  if (typeof url !== 'string') return null;
  // Yalnız TLS'li adres: WebTransport düz metin kabul etmiyor
  if (url.startsWith('wss://')) return `https://${url.slice(6).replace(/\/+$/, '')}/wt`;
  return null;
}

/**
 * Ortak taşıma arayüzü.
 *
 * `ac()` bağlanır, `yolla(paket)` bir nesne gönderir, `kapat()` kapatır.
 * Gelen mesajlar `onMesaj(nesne)` ile, kopma `onKapandi()` ile
 * bildiriliyor. İki uygulama da JSON metin taşıyor — biçim değişmiyor,
 * yalnız boru değişiyor.
 */
class Tasima {
  constructor() {
    this.onMesaj = () => {};
    this.onKapandi = () => {};
    this.ad = 'bilinmiyor';
  }
}

/** TCP üstünde WebSocket — her yerde çalışan taban. */
export class WebSocketTasima extends Tasima {
  constructor(url, soketYapici) {
    super();
    this.url = url;
    this.ad = 'websocket';
    this.soket = null;
    /*
     * Yapıcı dışarıdan verilebiliyor: Node'da global `WebSocket`
     * bulunmayabilir ve testlerin sahte bir soket geçirmesi gerekiyor.
     */
    this.soketYapici = soketYapici
      ?? (typeof globalThis.WebSocket !== 'undefined'
        ? (a) => new globalThis.WebSocket(a) : null);
  }

  ac() {
    if (!this.soketYapici) return Promise.reject(new Error('websocket-yok'));
    return new Promise((coz, red) => {
      let soket;
      try {
        soket = this.soketYapici(this.url);
      } catch (hata) {
        red(hata);
        return;
      }
      this.soket = soket;

      soket.addEventListener('open', () => coz());
      soket.addEventListener('error', () => red(new Error('baglanti')));
      soket.addEventListener('message', (olay) => {
        let mesaj;
        try { mesaj = JSON.parse(olay.data); } catch { return; }
        if (mesaj && typeof mesaj === 'object') this.onMesaj(mesaj);
      });
      soket.addEventListener('close', () => this.onKapandi());
    });
  }

  acikMi() {
    return Boolean(this.soket) && this.soket.readyState === 1; // OPEN
  }

  yolla(paket) {
    if (!this.acikMi()) return false;
    this.soket.send(JSON.stringify(paket));
    return true;
  }

  kapat() {
    this.soket?.close?.();
  }
}

/**
 * HTTP/3 (QUIC) üstünde WebTransport.
 *
 * İki kanal birden kullanıyor: güvenilir çift yönlü akış (kontrol) ve
 * datagram (oyun paketleri). Gerekçesi dosya başında.
 */
export class WebTransportTasima extends Tasima {
  constructor(url, yapici) {
    super();
    this.url = url;
    this.ad = 'webtransport';
    this.wt = null;
    this.yazici = null;
    this.datagramYazici = null;
    this.kapandi = false;
    this.yapici = yapici
      ?? (typeof globalThis.WebTransport !== 'undefined'
        ? (a) => new globalThis.WebTransport(a) : null);
  }

  /**
   * Tarayıcı/ortam WebTransport biliyor mu?
   *
   * `globalThis` üzerinden bakılıyor, çıplak adla değil: Safari'de bu
   * ad hiç tanımlı değil ve çıplak başvuru `ReferenceError` atardı —
   * yani desteği YOKLAYAN satır, desteği olmayan tarayıcıda oyunu
   * çökertirdi.
   */
  static destekli(yapici) {
    return Boolean(yapici) || typeof globalThis.WebTransport !== 'undefined';
  }

  async ac() {
    if (!this.yapici) throw new Error('webtransport-yok');
    const wt = this.yapici(this.url);
    this.wt = wt;
    await wt.ready;

    /*
     * KAPANMA TEK YERDEN. `closed` sözü hem düzgün kapanışta hem de
     * kopmada çözülüyor; iki ayrı dinleyici kurmak kapanışı iki kez
     * yayardı ve ekran "bağlantı koptu"yu iki kez gösterirdi.
     */
    wt.closed.catch(() => {}).finally(() => {
      if (this.kapandi) return;
      this.kapandi = true;
      this.onKapandi();
    });

    // --- Güvenilir kanal: kontrol mesajları ---
    const akis = await wt.createBidirectionalStream();
    this.yazici = akis.writable.getWriter();
    this.akisOku(akis.readable);

    // --- Güvenilmez kanal: oyun paketleri ---
    this.datagramYazici = wt.datagrams.writable.getWriter();
    this.datagramOku(wt.datagrams.readable);
  }

  /**
   * Güvenilir akışı okur.
   *
   * Akış BİR BAYT DİZİSİ, mesaj sınırı yok: iki JSON tek okumada
   * gelebilir ya da biri ikiye bölünebilir. Bu yüzden mesajlar satır
   * sonuyla ayrılıyor ve burada tampondan satır satır çıkarılıyor.
   * Bunu atlamak, ağ yoğunken sessizce bozuk JSON üretirdi.
   */
  async akisOku(readable) {
    const okuyucu = readable.getReader();
    const cozucu = new TextDecoder();
    let tampon = '';
    try {
      for (;;) {
        const { value, done } = await okuyucu.read();
        if (done) break;
        tampon += cozucu.decode(value, { stream: true });
        let n = tampon.indexOf('\n');
        while (n >= 0) {
          const satir = tampon.slice(0, n);
          tampon = tampon.slice(n + 1);
          this.mesajCoz(satir);
          n = tampon.indexOf('\n');
        }
      }
    } catch {
      // Kopma `closed` üzerinden bildiriliyor
    }
  }

  /** Datagramları okur — her datagram TAM bir mesaj, sınır sorunu yok. */
  async datagramOku(readable) {
    const okuyucu = readable.getReader();
    const cozucu = new TextDecoder();
    try {
      for (;;) {
        const { value, done } = await okuyucu.read();
        if (done) break;
        this.mesajCoz(cozucu.decode(value));
      }
    } catch {
      // Kopma `closed` üzerinden bildiriliyor
    }
  }

  mesajCoz(metin) {
    if (!metin) return;
    let mesaj;
    try { mesaj = JSON.parse(metin); } catch { return; }
    if (mesaj && typeof mesaj === 'object') this.onMesaj(mesaj);
  }

  acikMi() {
    return Boolean(this.yazici) && !this.kapandi;
  }

  yolla(paket) {
    if (!this.acikMi()) return false;
    const metin = JSON.stringify(paket);
    const kodlayici = new TextEncoder();
    /*
     * Yazma sözü BEKLENMİYOR: oyun döngüsü kare içinde çağırıyor ve
     * burada beklemek kareyi ağ hızına bağlardı. Hata olursa kapanma
     * `closed` üzerinden zaten geliyor.
     */
    if (datagramlik(paket)) {
      this.datagramYazici.write(kodlayici.encode(metin)).catch(() => {});
    } else {
      this.yazici.write(kodlayici.encode(`${metin}\n`)).catch(() => {});
    }
    return true;
  }

  kapat() {
    this.kapandi = true;
    try { this.wt?.close?.(); } catch { /* zaten kapalı */ }
  }
}

/**
 * Taşıma seçer: önce WebTransport, olmazsa WebSocket.
 *
 * GERİ DÜŞÜŞ SESSİZ VE ZORUNLU. Safari'de WebTransport yok; iOS'ta
 * oyunun çalışması buna bağlı. Ayrıca röle WebTransport dinlemiyor
 * olabilir (varsayılan kapalı) — o durumda da WebSocket'e dönülüyor.
 *
 * @param {string} url WebSocket adresi (`wss://...`)
 * @param {object} [secenek]
 * @param {boolean} [secenek.wt] WebTransport denensin mi (varsayılan: evet)
 * @param {Function} [secenek.wtYapici] Test için
 * @param {Function} [secenek.wsYapici] Test için
 * @returns {Promise<Tasima>}
 */
export async function tasimaKur(url, secenek = {}) {
  const { wt = true, wtYapici, wsYapici } = secenek;
  const wtUrl = wtAdresi(url);

  if (wt && wtUrl && WebTransportTasima.destekli(wtYapici)) {
    const deneme = new WebTransportTasima(wtUrl, wtYapici);
    try {
      await deneme.ac();
      return deneme;
    } catch {
      /*
       * Sessizce WebSocket'e dön. Burada hata YÜKSELTİLMEZ: röle
       * WebTransport dinlemiyorsa ya da ağ QUIC'i (UDP 443) engelliyorsa
       * bu BEKLENEN bir sonuç, arıza değil. Kurum ağlarının çoğu UDP'yi
       * kapatıyor ve o oyuncular WebSocket'le sorunsuz oynamalı.
       */
      deneme.kapat();
    }
  }

  const ws = new WebSocketTasima(url, wsYapici);
  await ws.ac();
  return ws;
}
