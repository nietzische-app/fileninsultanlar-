/**
 * Filenin Sultanları — röle sunucusu.
 *
 * İki işi var: oda koduyla iki istemciyi buluşturmak, ve MAÇI
 * KOŞTURMAK. Maç `mac.js` içinde, oyun motorunun başsız hâliyle burada
 * işliyor; iki istemci de yalnızca çiziyor ve tuşlarını yolluyor.
 *
 * Önce ev sahibi yetkili bir röleydi: maçı odayı açan oyuncunun cihazı
 * koşturuyordu. Arkadaş maçında sorun değil ama yabancıyla oynanınca
 * iki sorun doğuyor — ev sahibi kendi tarayıcısındaki simülasyona
 * müdahale edebiliyor, ve sıfır gecikmeyle oynarken karşısındaki tam
 * gidiş-dönüş süresi kadar geriden oynuyor. Hakem sunucu olunca ikisi
 * de aynı mesafede.
 *
 * Lockstep yine elenmiş durumda: iki makinenin aynı girdiden aynı
 * sonucu üretmesi gerekirdi, simülasyon yolunda 30'dan fazla
 * `Math.random()` çağrısı var. Sunucu hakem mimaride rastgelelik tek
 * yerde çalışıyor, iki taraf da sonucu okuyor.
 *
 * Not: sunucu artık oyun protokolünü BİLİYOR (`mac-basla`, `girdi`,
 * `durum`, `bitis`). Eski röle bunlardan habersizdi; maçı koşturan
 * taraf olunca bu kaçınılmaz oldu. Tanımadığı mesajlar hâlâ karşı
 * tarafa olduğu gibi aktarılıyor.
 */

import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { OdaDefteri, HATA } from './oda.js';
import { EslesmeSirasi } from './sira.js';
import { AD_UZUNLUK, adTemizle } from './protokol.js';
import { Mac } from './mac.js';

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

/** Sıradakilerin bekleme süresinin denetlenme aralığı (ms). */
const SIRA_TIK = 1000;

/**
 * İstemciden gelen kimliği temizler.
 *
 * Bu ad KARŞI OYUNCUNUN ekranında görünüyor, yani istemciden gelen
 * metin başka birinin arayüzüne giriyor. React metni kaçırıyor (XSS
 * yok) ama uzunluk ve görünmez karakter sınırı burada olmak zorunda:
 * istemcideki temizlik yalnız kolaylık, protokolü konuşan herkes onu
 * atlayabilir.
 */
function temizleKimlik(ham = {}) {
  return {
    /*
     * Kimlik numarası ada göre daha gevşek: ekranda görünmüyor, yalnız
     * eşleştirme/sıralama anahtarı. Yine de sınırsız değil — 500 KB'lık
     * bir kimlik sunucuda saklanırdı.
     */
    id: typeof ham.id === 'string' ? ham.id.replace(/\s+/g, '').slice(0, 64) : '',
    ad: adTemizle(ham.ad, AD_UZUNLUK),
  };
}

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
export async function baslat({
  port = 8787,
  nabiz: nabizAraligi = NABIZ,
  beklemeSiniri,
  /**
   * Hızlı eşleşmede Filenin Sultanları'nı kim oynayacak.
   *
   * Rastgele, çünkü iki yabancının ikisi de Türkiye'yi oynamak
   * istiyor ve tercih soracak bir "ev sahibi" yok. Testte
   * sabitlenebilsin diye dışarıdan verilebiliyor — yoksa eşleşme
   * testleri yazı-tura atmış olurdu.
   */
  yaziTura = () => Math.random() < 0.5,
} = {}) {
  const defter = new OdaDefteri();
  const sira = new EslesmeSirasi({ beklemeSiniri });

  const http = createServer((istek, cevap) => {
    /*
     * Sağlık ucu. Ücretsiz barındırma katmanları boşta kalan örneği
     * uyutuyor ve ilk bağlantı 10-20 saniye sürüyor — oda kodunu giren
     * iki arkadaş o sürede vazgeçer. Dışarıdan dakikada bir çağrılabilsin
     * diye duruyor.
     */
    if (istek.url === '/saglik') {
      cevap.writeHead(200, { 'content-type': 'application/json' });
      cevap.end(
        JSON.stringify({
          durum: 'ayakta',
          oda: defter.sayi,
          sira: sira.sayi,
          istemci: wss.clients.size,
          /*
           * Makine kimliği teşhis için. Röle durum tutuyor: bir odanın
           * iki soketi AYNI süreçte olmalı. Birden fazla makine
           * çalışıyorsa oda açan biri, katılan diğeri olabilir ve
           * katılan "oda yok" alır — arıza aralıklı görünür, teşhisi
           * zordur. `/saglik` birkaç kez çağrılıp farklı kimlik
           * dönüyorsa sebep budur.
           */
          makine: process.env.FLY_MACHINE_ID ?? process.env.HOSTNAME ?? null,
        }),
      );
      return;
    }
    cevap.writeHead(404).end();
  });

  const wss = new WebSocketServer({ server: http, maxPayload: AZAMI_MESAJ });

  /** Odadaki iki sokete de yollar. */
  function odayaYolla(oda, paket) {
    const metin = JSON.stringify(paket);
    yolla(oda.ev, metin);
    yolla(oda.misafir, metin);
  }

  /** Odada maçı kurar ve iki istemciye de rolünü bildirir. */
  function macKur(oda, ayar) {
    oda.mac = new Mac({
      ayar,
      yolla: (paket) => odayaYolla(oda, paket),
      bitince: () => {
        oda.mac = null;
      },
    });

    /*
     * İstemciler maçı motorun KESİNLEŞMİŞ ayarıyla kuruyor, istenen
     * ayarla değil: "rastgele rakip" seçilmişse takımı sunucu belirler
     * ve iki taraf da aynısını çizer. Yuva bilgisi de burada gidiyor —
     * her istemci hangi oyuncuyu sürdüğünü böyle öğreniyor.
     */
    const gercek = oda.mac.gercekAyar;
    /*
     * Her istemciye KARŞISINDAKİNİN adı gidiyor, kendi adı değil:
     * kendi adını zaten biliyor, ekranda göreceği isim rakibinki.
     */
    yolla(oda.ev, { t: 'mac', cfg: gercek, yuva: 'p1', rakip: oda.misafir?.kimlik ?? null });
    yolla(oda.misafir, { t: 'mac', cfg: gercek, yuva: 'p2', rakip: oda.ev?.kimlik ?? null });

    oda.mac.baslat();
  }

  /**
   * Sıradan eşleşen iki soketi bir odaya koyup maçı başlatır.
   *
   * Oda kodu üretiliyor ama kimseye SÖYLENMİYOR — hızlı eşleşmede
   * kodun bir işi yok. Yine de oda kuruluyor, çünkü maçın koştuğu,
   * ayrılmanın ve kopmanın işlendiği yer o; ayrı bir yol açmak aynı
   * mantığı ikinci kez yazmak olurdu.
   *
   * @returns {boolean} Maç kurulduysa true
   */
  function siradanEslestir(a, b) {
    const acilis = defter.ac(a);
    if (acilis.hata) {
      hataYolla(a, acilis.hata);
      // Eşi boşta bırakma: sıraya geri koy, yoksa sessizce kaybolurdu
      sira.katil(b, b.kimlik ?? {});
      return false;
    }

    const katilim = defter.gir(acilis.kod, b);
    if (katilim.hata) {
      defter.ayril(a);
      hataYolla(b, katilim.hata);
      sira.katil(a, a.kimlik ?? {});
      return false;
    }

    const oda = defter.odalar.get(acilis.kod);
    /*
     * Ayar sıraya girenin değil SUNUCUNUN seçimi. Hızlı eşleşmede
     * karşındaki yabancının kadro tercihini kabul etmek zorunda
     * değilsin; iki taraf da aynı standart maçı oynuyor. Kadro boş
     * bırakılıyor, motor varsayılanını kuruyor.
     */
    macKur(oda, { mode: '1v1', format: 'single', difficulty: 'normal' });
    return true;
  }

  /** Oda kapanır ya da biri ayrılırsa maçı da durdur — sunucuda sürmesin. */
  function macBitir(kod) {
    const oda = defter.odalar.get(kod);
    if (oda?.mac) {
      oda.mac.durdur();
      oda.mac = null;
    }
  }

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
          sira.cik(soket);
          const sonuc = defter.ayril(soket);
          if (sonuc?.es) yolla(sonuc.es, { t: 'ayrildi', kapandi: sonuc.kapandi });
          if (sonuc?.kod) macBitir(sonuc.kod);
          break;
        }

        case 'kimlik': {
          /*
           * Kimlik bağlantıya yapışıyor, mesajla birlikte taşınmıyor.
           * Sebebi: maç kurulurken karşı tarafın adı gerekiyor ve o an
           * elimizde yalnız soket var. Kimliği her mesajda taşımak da
           * olurdu ama saniyede 60 girdi paketinin her birine ad
           * eklemek anlamsız.
           */
          soket.kimlik = temizleKimlik(mesaj.kimlik);
          break;
        }

        case 'hizli-esles': {
          if (defter.odaOf(soket)) {
            hataYolla(soket, HATA.zatenOdada);
            break;
          }
          if (mesaj.kimlik) soket.kimlik = temizleKimlik(mesaj.kimlik);

          const sonuc = sira.katil(soket, soket.kimlik ?? {});
          if (sonuc.hata) {
            hataYolla(soket, sonuc.hata);
            break;
          }
          if (sonuc.es) {
            /*
             * Kim Türkiye'yi (p1) oynayacak: yazı-tura. Sırada uzun
             * bekleyene vermek "önce gelen kazanır" gibi görünürdü ama
             * bekleme süresi oyuncunun elinde değil — sunucuda kaç
             * kişi olduğuna bağlı. Rastgele olan, adil olan.
             */
            const [ilk, ikinci] = yaziTura()
              ? [sonuc.es.istemci, soket]
              : [soket, sonuc.es.istemci];
            siradanEslestir(ilk, ikinci);
            break;
          }
          yolla(soket, { t: 'sirada', sira: sonuc.sira });
          break;
        }

        case 'siradan-cik': {
          sira.cik(soket);
          yolla(soket, { t: 'sira-bitti' });
          break;
        }

        case 'mac-basla': {
          /*
           * Maçı YALNIZCA odayı açan başlatabilir. Katılan da
           * başlatabilseydi ikisi aynı anda başlatıp iki motor
           * kurabilirdi; üstelik maç ayarı (kadro, rakip, format)
           * odayı açanın seçimi.
           */
          const oda = defter.odaOf(soket);
          if (!oda) {
            hataYolla(soket, HATA.odaYok);
            break;
          }
          if (oda.ev !== soket) {
            hataYolla(soket, 'yetki-yok');
            break;
          }
          if (!oda.misafir) {
            hataYolla(soket, 'rakip-yok');
            break;
          }
          if (oda.mac) break; // zaten başlamış

          macKur(oda, mesaj.cfg);
          break;
        }

        case 'girdi': {
          /*
           * Girdi karşı tarafa DEĞİL maça gider — hakem sunucu.
           * Hangi yuvaya yazılacağını soket belirliyor: odayı açan
           * Türkiye'yi (p1), katılan rakip takımı (p2) sürüyor.
           */
          const oda = defter.odaOf(soket);
          if (!oda?.mac) break;
          oda.mac.girdi(oda.ev === soket ? 'p1' : 'p2', mesaj);
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
      // Sıradaysa da çıkar: yoksa kapanmış bir soketle eşleşme denenir
      sira.cik(soket);
      const oda = defter.odaOf(soket);
      const sonuc = defter.ayril(soket);
      if (sonuc?.es) yolla(sonuc.es, { t: 'ayrildi', kapandi: sonuc.kapandi });
      /*
       * Maçı da durdur. Yoksa oyuncular gittikten sonra sunucuda
       * sahipsiz bir motor 60 Hz koşmaya devam eder — tek maçta fark
       * edilmez, birikince sunucuyu yer.
       */
      if (oda?.mac) {
        oda.mac.durdur();
        oda.mac = null;
      }
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

  /*
   * Uzun bekleyene haber ver: "rakip yok, istersen yapay zekâya karşı
   * oyna". SIRADAN ÇIKARMIYORUZ — oyuncu beklemeye devam edebilir ve
   * tam o sırada biri gelirse gerçek maç olur. Çıkarsaydık iki kişinin
   * birbirini birer saniye farkla kaçırması mümkün olurdu.
   */
  const siraSaati = setInterval(() => {
    sira.uyarilacaklar().forEach((kayit) => {
      yolla(kayit.istemci, { t: 'rakip-yok' });
    });
  }, SIRA_TIK);
  siraSaati.unref?.();

  await new Promise((coz) => http.listen(port, coz));

  const kapat = () =>
    new Promise((coz) => {
      clearInterval(nabiz);
      clearInterval(siraSaati);
      wss.clients.forEach((soket) => soket.terminate());
      wss.close(() => http.close(coz));
    });

  return { http, wss, defter, sira, port: http.address().port, kapat };
}
