/**
 * Röle sunucusunun giriş noktası.
 *
 *   node sunucu/index.js
 *
 * Ortam değişkeni: PORT (varsayılan 8787).
 */

import { baslat } from './rele.js';

const { port, kapat } = await baslat({ port: Number(process.env.PORT ?? 8787) });
console.log(`Röle ayakta — ws://localhost:${port} · sağlık: http://localhost:${port}/saglik`);

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
