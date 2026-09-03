/**
 * Filenin Sultanları — röle sunucusu.
 *
 * Tek işi var: oda koduyla iki istemciyi buluşturmak ve aralarındaki
 * mesajları taşımak. Oyunu SİMÜLE ETMEZ; maçı ev sahibi istemci koşturur
 * ve durumu misafire yollar (host-authoritative).
 *
 * Neden böyle: iki makinenin aynı girdiden aynı sonucu üretmesini
 * gerektiren lockstep mimarisi bu oyunda mümkün değil — simülasyon
 * yolunda 30'dan fazla `Math.random()` çağrısı var. Röle bunu
 * gerektirmiyor: rastgelelik tek yerde çalışıyor, öbür taraf sonucu
 * okuyor.
 *
 * Sunucunun oyun protokolünden haberi olmaması bilinçli. `oda-*` ile
 * başlayan denetim mesajları dışındaki her şey karşı tarafa ham metin
 * olarak aktarılır — protokol değişince sunucuyu yeniden dağıtmak
 * gerekmez.
 */

import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { OdaDefteri, HATA } from './oda.js';

/** Tek mesajın azami boyu (bayt). Anlık görüntü ~300 bayt; 16 KB fazlasıyla yeter. */
const AZAMI_MESAJ = 16 * 1024;

/** Kalp atışı: bu sürede pong gelmeyen soket düşürülür (ms). */
const NABIZ = 30_000;

/**
 * Saniyede izin verilen mesaj sayısı.
 *
 * Ev sahibi saniyede ~20 anlık görüntü, misafir ~60 girdi yolluyor.
 * 150 iki katından fazla pay bırakıyor; amaç oyunu kısıtlamak değil,
 * açık röleyi bedava mesaj kanalına çevirmeye çalışan birini durdurmak.
 */
const SANIYEDE_MESAJ = 150;

/** Tek istemciye yollar — soket kapanmışsa sessizce geçer. */
function yolla(soket, veri) {
  if (!soket || soket.readyState !== soket.OPEN) return;
  soket.send(typeof veri === 'string' ? veri : JSON.stringify(veri));
}

function hataYolla(soket, sebep) {
  yolla(soket, { t: 'hata', sebep });
}

/**
 * Röleyi kurar ve dinlemeye başlar.
 *
 * Dinlemek içe aktarmanın yan etkisi değil: test aynı süreçte kendi
 * portunda ayağa kaldırıp kapatabilsin diye fonksiyon.
 *
 * @param {object} [ayar]
 * @param {number} [ayar.port] 0 verilirse işletim sistemi boş port seçer.
 * @param {number} [ayar.nabiz] Kalp atışı aralığı (ms).
 */
export async function baslat({ port = 8787, nabiz: nabizAraligi = NABIZ } = {}) {
  const defter = new OdaDefteri();

  const http = createServer((istek, cevap) => {
    /*
     * Sağlık ucu. Ücretsiz barındırma katmanları boşta kalan örneği
     * uyutuyor ve ilk bağlantı 10-20 saniye sürüyor — oda kodunu giren
     * iki arkadaş o sürede vazgeçer. Dışarıdan dakikada bir çağrılabilsin
     * diye duruyor.
     */
    if (istek.url === '/saglik') {
      cevap.writeHead(200, { 'content-type': 'application/json' });
      cevap.end(JSON.stringify({ durum: 'ayakta', oda: defter.sayi, istemci: wss.clients.size }));
      return;
    }
    cevap.writeHead(404).end();
  });

  const wss = new WebSocketServer({ server: http, maxPayload: AZAMI_MESAJ });

  wss.on('connection', (soket) => {
    soket.canli = true;
    soket.pencere = { basi: Date.now(), sayi: 0 };

    soket.on('pong', () => {
      soket.canli = true;
    });

    soket.on('message', (ham) => {
      // Hız sınırı — saniyelik pencere
      const simdi = Date.now();
      if (simdi - soket.pencere.basi >= 1000) soket.pencere = { basi: simdi, sayi: 0 };
      soket.pencere.sayi += 1;
      if (soket.pencere.sayi > SANIYEDE_MESAJ) {
        hataYolla(soket, 'cok-hizli');
        soket.close(1008, 'cok-hizli');
        return;
      }

      const metin = ham.toString();
      let mesaj;
      try {
        mesaj = JSON.parse(metin);
      } catch {
        hataYolla(soket, 'bozuk-mesaj');
        return;
      }
      if (!mesaj || typeof mesaj !== 'object') {
        hataYolla(soket, 'bozuk-mesaj');
        return;
      }

      switch (mesaj.t) {
        case 'oda-ac': {
          const sonuc = defter.ac(soket);
          if (sonuc.hata) hataYolla(soket, sonuc.hata);
          else yolla(soket, { t: 'oda', kod: sonuc.kod, rol: 'ev' });
          break;
        }

        case 'oda-gir': {
          const sonuc = defter.gir(mesaj.kod, soket);
          if (sonuc.hata) {
            hataYolla(soket, sonuc.hata);
            break;
          }
          yolla(soket, { t: 'oda', kod: sonuc.kod, rol: 'misafir' });
          // İki taraf da eşleşmeyi öğrenmeli: maçı ev sahibi başlatacak
          yolla(soket, { t: 'eslesme', rol: 'misafir' });
          yolla(sonuc.es, { t: 'eslesme', rol: 'ev' });
          break;
        }

        case 'ayril': {
          const sonuc = defter.ayril(soket);
          if (sonuc?.es) yolla(sonuc.es, { t: 'ayrildi', kapandi: sonuc.kapandi });
          break;
        }

        default: {
          /*
           * Oyun mesajı. Ham metin olarak aktarılıyor — sunucu içeriğe
           * bakmıyor, yeniden serileştirmiyor. Böylece protokol değişince
           * yalnızca istemci güncelleniyor.
           */
          const es = defter.es(soket);
          if (!es) hataYolla(soket, HATA.odaYok);
          else yolla(es, metin);
          break;
        }
      }
    });

    const kapanis = () => {
      const sonuc = defter.ayril(soket);
      if (sonuc?.es) yolla(sonuc.es, { t: 'ayrildi', kapandi: sonuc.kapandi });
    };
    soket.on('close', kapanis);
    soket.on('error', kapanis);
  });

  /*
   * Ölü soketler. Mobilde sekme arkaya alınıp ağ değişince soket "açık"
   * görünüp hiçbir şey taşımayabiliyor; ping/pong olmadan oda sonsuza
   * kadar dolu kalır ve kimse o koda katılamaz.
   */
  const nabiz = setInterval(() => {
    wss.clients.forEach((soket) => {
      if (!soket.canli) {
        soket.terminate();
        return;
      }
      soket.canli = false;
      soket.ping();
    });
    defter.supur();
  }, nabizAraligi);
  nabiz.unref?.();

  await new Promise((coz) => http.listen(port, coz));

  const kapat = () =>
    new Promise((coz) => {
      clearInterval(nabiz);
      wss.clients.forEach((soket) => soket.terminate());
      wss.close(() => http.close(coz));
    });

  return { http, wss, defter, port: http.address().port, kapat };
}
