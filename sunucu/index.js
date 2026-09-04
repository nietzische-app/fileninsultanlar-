/**
 * Röle sunucusunun giriş noktası.
 *
 *   node sunucu/index.js
 *
 * Ortam değişkeni: PORT (varsayılan 8787).
 */

import { baslat } from './rele.js';

const { port, kapat, depo } = await baslat({ port: Number(process.env.PORT ?? 8787) });
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
