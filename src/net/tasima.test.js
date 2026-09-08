import { describe, it, expect } from 'vitest';
import {
  datagramlik, wtAdresi, WebSocketTasima, WebTransportTasima, tasimaKur,
} from './tasima.js';

/**
 * TAŞIMA KATMANI testleri.
 *
 * Burada sınanan şey ağ değil KARAR: hangi mesaj hangi kanaldan gidiyor
 * ve WebTransport olmadığında ne oluyor. İkisi de sessizce
 * bozulabilecek şeyler — biri oyunu iOS'ta tamamen kapatır, diğeri
 * WebTransport'un tek faydasını yok eder ve ikisi de hata vermez.
 */

/** Sahte WebSocket — gerçek ağ olmadan `addEventListener` yüzeyi. */
class SahteSoket {
  constructor(url, { acilsin = true } = {}) {
    this.url = url;
    this.readyState = 0;
    this.gonderilen = [];
    this.dinleyici = {};
    queueMicrotask(() => {
      if (acilsin) {
        this.readyState = 1;
        this.dinleyici.open?.();
      } else {
        this.dinleyici.error?.();
      }
    });
  }

  addEventListener(ad, f) { this.dinleyici[ad] = f; }

  send(m) { this.gonderilen.push(m); }

  close() { this.readyState = 3; this.dinleyici.close?.(); }

  /** Testin sunucu gibi mesaj yollaması için. */
  al(nesne) { this.dinleyici.message?.({ data: JSON.stringify(nesne) }); }
}

/** Sahte WebTransport — iki kanalı da sayan asgari yüzey. */
function sahteWt({ hazirOlsun = true } = {}) {
  const yazilan = { akis: [], datagram: [] };
  const yapici = () => ({
    ready: hazirOlsun ? Promise.resolve() : Promise.reject(new Error('yok')),
    closed: new Promise(() => {}),
    close() {},
    createBidirectionalStream: async () => ({
      writable: { getWriter: () => ({ write: async (b) => { yazilan.akis.push(b); } }) },
      readable: { getReader: () => ({ read: () => new Promise(() => {}) }) },
    }),
    datagrams: {
      writable: { getWriter: () => ({ write: async (b) => { yazilan.datagram.push(b); } }) },
      readable: { getReader: () => ({ read: () => new Promise(() => {}) }) },
    },
  });
  return { yapici, yazilan };
}

const metin = (baytlar) => new TextDecoder().decode(baytlar);

describe('taşıma seçimi', () => {
  it('durum ve girdi DATAGRAM, geri kalan AKIŞ', () => {
    /*
     * Ayrımın gerekçesi: datagram güvenilmez. `durum`/`girdi` her kare
     * tazeleniyor, kaybolanın değeri yok. Ama `kimlik` kaybolursa maç
     * hiç başlamaz — o yüzden kontrol mesajları güvenilir kanalda.
     */
    expect(datagramlik({ t: 'durum' })).toBe(true);
    expect(datagramlik({ t: 'girdi' })).toBe(true);

    ['kimlik', 'oda-ac', 'oda-gir', 'mac', 'bitis', 'puan', 'siralama', 'hata']
      .forEach((t) => {
        expect(datagramlik({ t }), `${t} datagrama düşmemeli`).toBe(false);
      });

    // Tanımsız/bozuk paket de güvenilir tarafta kalmalı
    expect(datagramlik(null)).toBe(false);
    expect(datagramlik({})).toBe(false);
  });

  it('WT adresi yalnız TLS li adresten türüyor', () => {
    expect(wtAdresi('wss://rele.example')).toBe('https://rele.example/wt');
    expect(wtAdresi('wss://rele.example/')).toBe('https://rele.example/wt');
    /*
     * Düz `ws://` için null: WebTransport şifresiz bağlantı kabul
     * etmiyor ve denemek her seferinde bir tur boşa gidip WebSocket'e
     * düşmek olurdu — geliştirmede her bağlantıyı yavaşlatırdı.
     */
    expect(wtAdresi('ws://localhost:8787')).toBe(null);
    expect(wtAdresi(null)).toBe(null);
  });
});

describe('WebSocket taşıma', () => {
  it('açılır, yollar, kapanmayı bildirir', async () => {
    let soket = null;
    const t = new WebSocketTasima('ws://x', (u) => { soket = new SahteSoket(u); return soket; });
    await t.ac();

    expect(t.acikMi()).toBe(true);
    expect(t.yolla({ t: 'kimlik', a: 1 })).toBe(true);
    expect(JSON.parse(soket.gonderilen[0])).toEqual({ t: 'kimlik', a: 1 });

    const gelenler = [];
    t.onMesaj = (m) => gelenler.push(m);
    soket.al({ t: 'mac', yuva: 'p1' });
    expect(gelenler).toEqual([{ t: 'mac', yuva: 'p1' }]);

    let kapandi = false;
    t.onKapandi = () => { kapandi = true; };
    soket.close();
    expect(kapandi).toBe(true);
    expect(t.acikMi()).toBe(false);
  });

  it('kapalıyken yollamak SESSİZCE başarısız olur', async () => {
    const t = new WebSocketTasima('ws://x', (u) => new SahteSoket(u));
    // Henüz açılmadı
    expect(t.yolla({ t: 'girdi' })).toBe(false);
  });
});

describe('WebTransport taşıma', () => {
  it('durum DATAGRAMDAN, kimlik AKIŞTAN gider', async () => {
    const { yapici, yazilan } = sahteWt();
    const t = new WebTransportTasima('https://x/wt', yapici);
    await t.ac();

    t.yolla({ t: 'durum', n: 5 });
    t.yolla({ t: 'kimlik', id: 'a' });

    expect(yazilan.datagram).toHaveLength(1);
    expect(JSON.parse(metin(yazilan.datagram[0]))).toEqual({ t: 'durum', n: 5 });

    expect(yazilan.akis).toHaveLength(1);
    /*
     * Akışta SATIR SONU olmalı: akış bir bayt dizisi, mesaj sınırı yok.
     * Ayıraçsız yazmak, iki mesaj aynı okumada geldiğinde bozuk JSON
     * üretirdi — ve bu ancak ağ yoğunken ortaya çıkardı.
     */
    expect(metin(yazilan.akis[0])).toBe('{"t":"kimlik","id":"a"}\n');
  });

  it('desteklenmiyorsa açılmaz', async () => {
    const t = new WebTransportTasima('https://x/wt', null);
    await expect(t.ac()).rejects.toThrow();
  });
});

describe('geri düşüş', () => {
  it('WebTransport açılmazsa SESSİZCE WebSocket e döner', async () => {
    /*
     * Safari'de WebTransport yok; kurum ağlarının çoğu da UDP/443'ü
     * kapatıyor. Geri düşüş çalışmazsa oyun o oyunculara tamamen
     * kapanır — hem de "bağlantı koptu" diye, sebebini söylemeden.
     */
    const { yapici } = sahteWt({ hazirOlsun: false });
    const t = await tasimaKur('wss://rele.example', {
      wtYapici: yapici,
      wsYapici: (u) => new SahteSoket(u),
    });
    expect(t.ad).toBe('websocket');
    expect(t.acikMi()).toBe(true);
  });

  it('WebTransport çalışıyorsa ONU kullanır', async () => {
    const { yapici } = sahteWt();
    const t = await tasimaKur('wss://rele.example', {
      wtYapici: yapici,
      wsYapici: (u) => new SahteSoket(u),
    });
    expect(t.ad).toBe('webtransport');
  });

  it('ws:// adreste WebTransport hiç DENENMEZ', async () => {
    let denendi = false;
    const { yapici } = sahteWt();
    const t = await tasimaKur('ws://localhost:8787', {
      wtYapici: (...a) => { denendi = true; return yapici(...a); },
      wsYapici: (u) => new SahteSoket(u),
    });
    expect(denendi).toBe(false);
    expect(t.ad).toBe('websocket');
  });

  it('wt:false ile WebTransport kapatılabilir', async () => {
    let denendi = false;
    const { yapici } = sahteWt();
    const t = await tasimaKur('wss://rele.example', {
      wt: false,
      wtYapici: (...a) => { denendi = true; return yapici(...a); },
      wsYapici: (u) => new SahteSoket(u),
    });
    expect(denendi).toBe(false);
    expect(t.ad).toBe('websocket');
  });
});
