import { WebSocketServer, WebSocket } from 'ws';

/**
 * GECİKMELİ VEKİL — tarayıcı ile röle arasına giren yapay ağ.
 *
 * NEDEN VAR: gecikmeyi `WebSocket.prototype.send`i yamalayarak
 * enjekte etmeye çalışmıştım ve YAMA HİÇ ÇAĞRILMADI — `ws`in sunucu
 * tarafı o yoldan geçmiyor. Daha kötüsü sessizce başarısız oldu:
 * ölçümler koştu, tablolar çıktı, sayılar makul göründü ve hepsi
 * aslında SIFIR gecikmede ölçülmüştü. "Yama çalışıyor" diye
 * doğruladığımı sandığım deneyde saydığım çağrı rölenin değil, test
 * istemcisinin kendi göndermesiymiş.
 *
 * Ders: enjeksiyonun kendisi de doğrulanabilir olmalı. Bu vekil
 * taşıdığı mesajı SAYIYOR (`sayac`), böylece ölçüm "trafik gerçekten
 * benden geçti mi" diye sorabiliyor. Sormayan bir ölçüm, çalışmayan
 * bir enjeksiyonu fark etmez.
 *
 * Vekil iki yönü de geciktiriyor — gerçek ağ da öyle yapıyor.
 *
 * DOSYA ADI `_` İLE BAŞLIYOR çünkü `kos.mjs` e2e dizinindeki her
 * `.mjs`i test sayıp koşturuyor; alt çizgi mevcut "bu bir yardımcı"
 * işareti (bkz. `_pinch.mjs`).
 *
 * @param {{ hedef: string, gecikme?: number, segirme?: number,
 *   hickirikOran?: number, hickirikMs?: number, port?: number }} ayar
 *   `hedef` rölenin ws adresi; `gecikme`/`segirme` TEK YÖN, ms.
 *   `hickirikOran` 0-1 arası: paketlerin bu oranı `hickirikMs` kadar
 *   FAZLADAN gecikir.
 */
export async function vekilKur({
  hedef, gecikme = 0, segirme = 0, hickirikOran = 0, hickirikMs = 80, port = 0,
}) {
  const sayac = { yukari: 0, asagi: 0, hickirik: 0 };
  const sunucu = new WebSocketServer({ port });

  /*
   * HIÇKIRIK ayrı bir kalem, seğirmenin büyütülmüş hâli değil.
   * Seğirme sürekli ve küçük; istemcinin EWMA'sı onu öğrenip tamponu
   * ona göre boyutluyor. Hıçkırık ise seyrek ve büyük — öğrenilemiyor,
   * tamponun payından karşılanmak zorunda. Gerçek Wi-Fi'nin bozulma
   * biçimi bu ve tamponu asıl sınayan şey de bu (bkz.
   * tests/olcum/tampon-tabani.mjs).
   */
  const bekle = () => {
    const sapma = segirme ? (Math.random() * 2 - 1) * segirme : 0;
    let ek = 0;
    if (hickirikOran > 0 && Math.random() < hickirikOran) {
      ek = hickirikMs;
      sayac.hickirik += 1;
    }
    return Math.max(0, gecikme + sapma + ek);
  };

  sunucu.on('connection', (tarayici) => {
    const rele = new WebSocket(hedef);
    /*
     * Röle bağlantısı açılana kadar gelen mesajlar KUYRUKTA bekliyor.
     * Atılsalardı el sıkışma (kimlik) kaybolur ve maç hiç kurulmazdı —
     * üstelik belirtisi "vekil bozuk" değil "eşleşme çalışmıyor" olurdu.
     */
    const kuyruk = [];
    rele.on('open', () => {
      kuyruk.splice(0).forEach((m) => rele.send(m));
    });

    tarayici.on('message', (ham) => {
      sayac.yukari += 1;
      const veri = ham.toString();
      setTimeout(() => {
        if (rele.readyState === WebSocket.OPEN) rele.send(veri);
        else if (rele.readyState === WebSocket.CONNECTING) kuyruk.push(veri);
      }, bekle());
    });

    rele.on('message', (ham) => {
      sayac.asagi += 1;
      const veri = ham.toString();
      setTimeout(() => {
        if (tarayici.readyState === WebSocket.OPEN) tarayici.send(veri);
      }, bekle());
    });

    const kapat = () => {
      if (rele.readyState === WebSocket.OPEN
        || rele.readyState === WebSocket.CONNECTING) rele.close();
      if (tarayici.readyState === WebSocket.OPEN) tarayici.close();
    };
    tarayici.on('close', kapat);
    rele.on('close', kapat);
    rele.on('error', kapat);
  });

  await new Promise((coz) => { sunucu.once('listening', coz); });

  return {
    port: sunucu.address().port,
    adres: `ws://localhost:${sunucu.address().port}`,
    sayac,
    kapat: () => new Promise((coz) => { sunucu.close(coz); }),
  };
}
