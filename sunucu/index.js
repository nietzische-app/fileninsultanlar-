/**
 * Röle sunucusunun giriş noktası.
 *
 *   node sunucu/index.js
 *
 * Ortam değişkenleri:
 *   PORT      WebSocket portu (varsayılan 8787)
 *   WT_PORT   WebTransport/QUIC UDP portu — VERİLMEZSE KAPALI
 *   WT_CERT   TLS sertifikası dosya yolu (PEM)
 *   WT_KEY    Özel anahtar dosya yolu (PEM)
 *   WT_SECRET QUIC oturum gizli anahtarı (isteğe bağlı)
 */

import { readFileSync } from 'node:fs';
import { baslat } from './rele.js';

/**
 * WebTransport ayarını ortamdan okur.
 *
 * ÜÇÜ BİRDEN gerekiyor; biri eksikse KAPALI. Yarım yapılandırmayla
 * açmaya çalışmak, rölenin açılışta çökmesi demek olurdu — ve o an
 * kaybedilen şey isteğe bağlı bir özellik değil, çalışan WebSocket
 * hizmeti olurdu.
 */
function wtAyari() {
  const port = Number(process.env.WT_PORT ?? 0);
  const certYol = process.env.WT_CERT;
  const anahtarYol = process.env.WT_KEY;
  if (!port || !certYol || !anahtarYol) return null;
  try {
    return {
      port,
      cert: readFileSync(certYol, 'utf8'),
      privKey: readFileSync(anahtarYol, 'utf8'),
    };
  } catch (hata) {
    console.warn(`UYARI: WebTransport sertifikası okunamadı (${hata.message}) — kapalı.`);
    return null;
  }
}

const { port, kapat, depo } = await baslat({
  port: Number(process.env.PORT ?? 8787),
  wt: wtAyari(),
});
console.log(`Röle ayakta — ws://localhost:${port} · sağlık: http://localhost:${port}/saglik`);

/*
 * Kalıcılık durumu AÇILIŞTA söyleniyor.
 *
 * Bunu günlüğe basmamızın sebebi somut: veri dizini boşken "birim
 * bağlandı mı" sorusuna bakarak cevap verilemiyor — bağlanmamış bir
 * dizinle boş bir dizin birebir aynı görünüyor. Arıza ancak ilk maçın
 * sonucu kaybolduğunda ortaya çıkardı ve o an kimse bakmıyor olurdu.
 * Şimdi `docker compose logs` ilk satırlarda söylüyor.
 */
if (!depo.yazilabilir) {
  console.warn(
    `UYARI: veri dizini YAZILAMIYOR (${depo.dizin}) — ${depo.acilisHatasi}\n` +
      '        Maçlar oynanır ama skor tablosu yeniden başlatmada sıfırlanır.',
  );
} else if (depo.birimde) {
  console.log(`Skor tablosu kalıcı — birim bağlı: ${depo.dizin}`);
} else {
  /*
   * Yazılabiliyor ama ayrı bir aygıtta değil. Geliştirmede normal;
   * Docker'da BİRİM BAĞLANMAMIŞ demek ve tablo her yeniden kurulumda
   * gider. Yazma denemesi bunu yakalayamıyor — bağlanmamış dizin de
   * gayet yazılabilir olduğu için ayrı bir uyarı gerekiyor.
   */
  console.warn(
    `UYARI: veri dizini (${depo.dizin}) kalıcı bir birimde DEĞİL.\n` +
      '        Docker/Fly kullanıyorsan birim bağlanmamış: skor tablosu\n' +
      '        her yeniden kurulumda sıfırlanır. Yerelde koşuyorsan normal.',
  );
}

/*
 * Düzgün kapanma.
 *
 * Dağıtım sırasında (fly deploy) eski makineye SIGTERM gidiyor. Kendi
 * elimizle kapatmazsak açık soketler platformun zorla öldürmesini
 * bekliyor ve devam eden maçlar o süre boyunca donmuş görünüyor.
 * Soketleri kapatmak istemcide "bağlantı koptu" katmanını açıyor —
 * kötü haber, ama sessiz donmadan iyi.
 *
 * Konteynerde bu sürecin PID 1 olduğunu unutma: PID 1'e giden SIGTERM'in
 * varsayılan davranışı YOKTUR, yani aşağıdaki dinleyici olmadan sinyal
 * hiç işlenmez. Dockerfile ayrıca tini kullanıyor.
 */
let kapaniyor = false;
['SIGTERM', 'SIGINT'].forEach((sinyal) => {
  process.on(sinyal, async () => {
    if (kapaniyor) return;
    kapaniyor = true;
    console.log(`${sinyal} alındı, röle kapanıyor.`);
    await kapat();
    process.exit(0);
  });
});
