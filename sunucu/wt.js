/**
 * WEBTRANSPORT DİNLEYİCİSİ — röleye QUIC üstünden ikinci kapı.
 *
 * NEDEN VAR: WebSocket TCP üstünde ve TCP'de kaybolan bir paket
 * arkasındakileri de bekletiyor (head-of-line blocking). Bu oyunda
 * eskimiş bir anlık görüntünün yeniden gönderilmesinin hiçbir değeri
 * yok — 17 ms sonra yenisi geliyor. Ölçüldü (tests/olcum/tasima.mjs):
 *
 *      kayıp    UDP     TCP
 *       %0.5   38ms    43ms
 *       %2     38ms    56ms
 *       %5     39ms    79ms
 *
 * VARSAYILAN KAPALI. Bu dosya yalnız `WT_PORT` verilirse devreye
 * giriyor. Sebebi risk: QUIC ayrı bir UDP portu, ayrı sertifika ve
 * güvenlik duvarında ayrı bir kural demek. Çalışan bir üretim
 * hizmetini "belki iyi olur" diye değiştirmek doğru takas değil;
 * WebSocket yolu dokunulmadan duruyor ve istemci zaten kendiliğinden
 * ona düşüyor.
 *
 * BAĞIMLILIK İSTEĞE BAĞLI (`optionalDependencies`). Kurulu değilse bu
 * modül sessizce `null` dönüyor ve röle WebSocket'le açılıyor —
 * `npm ci` yapan CI ya da native derleyicisi olmayan bir makine
 * yüzünden dağıtımın kırılmasını istemiyoruz.
 */

import { EventEmitter } from 'node:events';
import { datagramlik } from '../src/game/snapshot.js';

/** Bir WebTransport oturumunu WebSocket benzeri bir nesneye sarar. */
class WtSoket extends EventEmitter {
  constructor(oturum, adres) {
    super();
    this.oturum = oturum;
    this.adres = adres;
    /*
     * `adresOku` WebSocket'te `soket._socket.remoteAddress` okuyor.
     * Aynı alanı burada da sunmak, rölede WebTransport'a özel bir dal
     * açmaktan iyi: bağlantının nereden geldiği tek yerden okunuyor.
     */
    this._socket = { remoteAddress: adres };
    this.OPEN = 1;
    this.readyState = 1;
    this.yazici = null;
    this.datagramYazici = null;
    /*
     * QUIC'in kendi boşta kalma zaman aşımı var ve ölü yolu WebSocket
     * ping/pong'undan daha güvenilir yakalıyor. Rölenin nabız süpürgesi
     * yine de `canli` bakıyor; burada `ping()` onu tazeliyor ve gerçek
     * kopmayı `closed` bildiriyor.
     */
    this.canli = true;
  }

  async kur() {
    const o = this.oturum;
    await o.ready;

    o.closed.catch(() => {}).finally(() => this.kapandiBildir());

    // Güvenilir kanal: kontrol mesajları (kimlik, oda, maç, bitiş)
    /*
     * İstemcinin kontrol akışını açmasını bekliyoruz. Süre sınırı var:
     * bağlanıp hiç akış açmayan bir oturum burada sonsuza kadar
     * beklerdi ve o oturum ne kurulur ne temizlenirdi.
     */
    const gelen = o.incomingBidirectionalStreams.getReader();
    const akis = await Promise.race([
      gelen.read().then((r) => r.value),
      new Promise((coz) => { setTimeout(() => coz(null), 10_000); }),
    ]);
    if (!akis) throw new Error('akis-yok');
    this.yazici = akis.writable.getWriter();
    this.akisOku(akis.readable);

    // Güvenilmez kanal: durum ve girdi
    this.datagramYazici = o.datagrams.writable.getWriter();
    this.datagramOku(o.datagrams.readable);
  }

  /**
   * Güvenilir akışı satır satır okur.
   *
   * Akış bayt dizisi, mesaj sınırı yok: iki JSON tek okumada gelebilir
   * ya da biri ikiye bölünebilir. İstemci satır sonuyla ayırıyor
   * (bkz. src/net/tasima.js), burası da öyle çözüyor.
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
          if (satir) this.emit('message', satir);
          n = tampon.indexOf('\n');
        }
      }
    } catch { /* kopma `closed` üzerinden */ }
    this.kapandiBildir();
  }

  async datagramOku(readable) {
    const okuyucu = readable.getReader();
    const cozucu = new TextDecoder();
    try {
      for (;;) {
        const { value, done } = await okuyucu.read();
        if (done) break;
        this.emit('message', cozucu.decode(value));
      }
    } catch { /* kopma `closed` üzerinden */ }
  }

  /**
   * Mesaj yollar — kanal seçimi İSTEMCİYLE AYNI kaynaktan.
   *
   * `datagramlik` protokolün tanımıyla aynı dosyada (snapshot.js) ve
   * iki tarafın da içe aktardığı tek fonksiyon. Ayrı
   * listeler tutsaydık biri değişip diğeri unutulduğunda paketler
   * yanlış kanala düşerdi: kontrol mesajı datagrama giderse maç hiç
   * kurulmaz, durum paketi akışa giderse WebTransport'un tek faydası
   * yok olur. İkisi de sessiz arıza.
   */
  send(veri) {
    if (this.readyState !== this.OPEN) return;
    const metin = typeof veri === 'string' ? veri : JSON.stringify(veri);
    let paket = null;
    try { paket = JSON.parse(metin); } catch { /* biçimsiz — akıştan gitsin */ }

    const kodlayici = new TextEncoder();
    try {
      if (paket && datagramlik(paket)) {
        this.datagramYazici?.write(kodlayici.encode(metin)).catch(() => {});
      } else {
        this.yazici?.write(kodlayici.encode(`${metin}\n`)).catch(() => {});
      }
    } catch { /* kapanmış */ }
  }

  ping() {
    // QUIC kendi keepalive'ını yürütüyor; süpürgeyi tatmin etmek yeterli
    this.canli = true;
  }

  close() {
    this.terminate();
  }

  terminate() {
    if (this.readyState !== this.OPEN) return;
    this.readyState = 3;
    try { this.oturum.close(); } catch { /* zaten kapalı */ }
    this.emit('close');
  }

  kapandiBildir() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.emit('close');
  }
}

/**
 * WebTransport dinleyicisini başlatır.
 *
 * @param {object} ayar
 * @param {number} ayar.port UDP portu
 * @param {string|Buffer} ayar.cert TLS sertifikası (PEM)
 * @param {string|Buffer} ayar.privKey Özel anahtar (PEM)
 * @param {string} [ayar.host]
 * @param {string} [ayar.yol] Karşılanacak yol (varsayılan `/wt`)
 * @param {(soket: object, istek: object) => void} ayar.baglandi
 *   Yeni oturum — röle bunu WebSocket bağlantısıyla aynı şekilde işler
 * @param {(m: string) => void} [ayar.gunluk]
 * @returns {Promise<{ kapat: () => Promise<void>, istemciler: Set }|null>}
 *   Bağımlılık yoksa `null`
 */
export async function wtBaslat({
  port, cert, privKey, host = '0.0.0.0', yol = '/wt', baglandi, gunluk = () => {},
}) {
  let Http3Server;
  let quicheLoaded;
  try {
    /*
     * DİNAMİK İÇE AKTARIM. Statik olsaydı paket kurulu değilken röle
     * hiç açılmazdı — yani isteğe bağlı bir özellik zorunlu bir
     * bağımlılığa dönerdi.
     *
     * Paket adı DEĞİŞKENDE ve `@vite-ignore` var: Vite içe aktarımları
     * ÇALIŞMADAN ÖNCE, kaynağı dönüştürürken çözüyor ve paket kurulu
     * değilse dosyayı hiç yükleyemiyor. Yani `try/catch` devreye bile
     * girmiyordu; bu dosyayı içe aktaran her şey çöküyordu.
     *
     * CI tam olarak bunu gösterdi: kökteki `npm ci` `sunucu/`nun
     * isteğe bağlı bağımlılıklarını kurmuyor ve rölenin BÜTÜN test
     * dosyası yüklenemedi. Yerelde görünmedi çünkü paket
     * `sunucu/node_modules` altında duruyor.
     */
    const paket = '@fails-components/webtransport';
    ({ Http3Server, quicheLoaded } = await import(/* @vite-ignore */ paket));
    await quicheLoaded;
  } catch (hata) {
    gunluk(`webtransport kapalı: bağımlılık yüklenemedi (${hata.message})`);
    return null;
  }

  const sunucu = new Http3Server({
    port,
    host,
    secret: process.env.WT_SECRET || 'retro-voleybol-wt-varsayilan-gizli-anahtar',
    cert,
    privKey,
  });

  const istemciler = new Set();
  sunucu.startServer();
  await sunucu.ready;
  gunluk(`webtransport dinliyor: udp ${host}:${port}${yol}`);

  /*
   * Oturumları karşıla. `sessionStream` yol başına ayrı bir akış
   * veriyor; başka yola gelenler burada hiç karşılanmıyor ve QUIC
   * onları kendiliğinden reddediyor.
   */
  const akis = sunucu.sessionStream(yol);
  const okuyucu = akis.getReader();

  let duruyor = false;
  (async () => {
    for (;;) {
      let deger;
      try {
        ({ value: deger } = await okuyucu.read());
      } catch { break; }
      if (!deger || duruyor) break;

      /*
       * `sessionStream` oturumu DOĞRUDAN veriyor (sarmalayıcı yok) ve
       * adres `peerAddress` alanında. İlk yazışta `deger.session
       * .remoteAddress` varsaymıştım; sonuç, her oturumun adresinin
       * 'bilinmiyor' olması ve IP başına bağlantı sınırının tek bir
       * sahte adres üstünde toplanmasıydı — yani sınır ya herkesi
       * engeller ya da hiç kimseyi.
       */
      const adres = deger?.peerAddress?.host ?? deger?.peerAddress ?? 'bilinmiyor';
      const soket = new WtSoket(deger, adres);
      try {
        await soket.kur();
      } catch (hata) {
        gunluk(`webtransport oturumu kurulamadı: ${hata.message}`);
        continue;
      }
      istemciler.add(soket);
      soket.on('close', () => istemciler.delete(soket));
      /*
       * Röle `x-forwarded-for` bakıyor; QUIC'te vekil yok, adres
       * doğrudan oturumdan geliyor. Sahte istek nesnesi o sözleşmeyi
       * karşılıyor.
       */
      baglandi(soket, { headers: {}, socket: { remoteAddress: adres } });
    }
  })();

  return {
    istemciler,
    async kapat() {
      duruyor = true;
      istemciler.forEach((s) => s.terminate());
      istemciler.clear();
      try { await sunucu.stopServer(); } catch { /* zaten kapalı */ }
    },
  };
}
