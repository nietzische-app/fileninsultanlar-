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
import { Depo, genelGorunum } from './depo.js';
import { puanDegisimi } from './puan.js';
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
 * Tek IP'den açılabilecek en fazla eşzamanlı bağlantı.
 *
 * Var olan hız sınırı SOKET BAŞINA mesaj sayıyor; bir soketin çok
 * konuşmasını engelliyor ama BİN SOKET açılmasını engellemiyor. Ölçüme
 * göre maç başına ~88/256 MB ≈ 350 KB bellek düşüyor, yani on binlerce
 * boş soket makineyi dosya tanıtıcısı ve bellek tarafından zorlar.
 *
 * 20 neden: bir ev ya da ofis tek genel IP'nin arkasında olabiliyor,
 * mobil operatörlerde CGNAT yüzünden yüzlerce kişi aynı IP'yi
 * paylaşabiliyor. Sayı bu yüzden cömert — amaç meşru kalabalığı değil,
 * tek makineden soket yağdıran birini durdurmak. CGNAT arkasındaki
 * gerçek kalabalık bu sınıra takılırsa `IP_SINIRI` ile yükseltilebilir.
 */
const IP_BASINA_BAGLANTI = Number(process.env.IP_SINIRI ?? 20);

/**
 * Soketin geldiği adres.
 *
 * Ters vekilin (Caddy/nginx) arkasındayız: `socket.remoteAddress`
 * HER ZAMAN vekilin adresi olur ve sınır tüm oyuncuları tek kovaya
 * koyardı. Gerçek adres `x-forwarded-for`ın İLK girdisinde — sonraki
 * girdiler istemcinin uydurabileceği değerler.
 *
 * Başlık yoksa sokete düşülüyor: doğrudan bağlantı (test, yerel
 * geliştirme) böyle çalışıyor.
 */
function adresOku(istek, soket) {
  const baslik = istek?.headers?.['x-forwarded-for'];
  if (typeof baslik === 'string' && baslik.length) {
    return baslik.split(',')[0].trim();
  }
  return soket?._socket?.remoteAddress ?? 'bilinmiyor';
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
  /** Veri dizini — testte geçici bir dizine yönlendiriliyor. */
  veriDizini,
  /** IP başına bağlantı sınırı — testte küçültülüyor. */
  ipSiniri = IP_BASINA_BAGLANTI,
} = {}) {
  const defter = new OdaDefteri();
  const sira = new EslesmeSirasi({ beklemeSiniri });
  const depo = new Depo(veriDizini ? { dizin: veriDizini } : {});

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
          oyuncu: depo.sayi,
          /*
           * Dağıtımdan sonra bakılacak iki alan. Boş bir veri dizinine
           * bakmak hiçbir şey söylemiyor, bu ikisi söylüyor:
           *
           *   kalici — dizine YAZILABİLİYOR mu. false ise maçlar
           *     oynanır ama tablo yeniden başlatmada sıfırlanır.
           *   birim  — veri dizini ayrı bir aygıtta mı, yani kalıcı
           *     birim BAĞLI mı. Docker'da false ise birim bağlanmamış
           *     demektir ve tablo her `up --build` ile gider; yazma
           *     denemesi bunu yakalayamaz çünkü bağlanmamış dizin de
           *     gayet yazılabilir.
           */
          kalici: depo.yazilabilir,
          birim: depo.birimde,
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

  /**
   * Biten maçı skor tablosuna işler.
   *
   * Sonucu İSTEMCİ BİLDİRMİYOR: maçı sunucu koşturuyor ve kazananı
   * kendi simülasyonundan biliyor. Adım 1'deki "sunucu hakem"
   * kararının doğrudan getirisi bu — istemci "kazandım" diyemediği
   * için skor tablosu uydurulamıyor. Tablo eklerken bu mimariyi
   * kurmuş olmasaydık, ilk iş bir "sonuç bildir" mesajı yazmak ve
   * onun yalan söylenebileceğini kabul etmek olurdu.
   *
   * Sıralamaya YALNIZ hızlı eşleşme maçları yazılıyor: arkadaş maçında
   * ayarları odayı açan seçiyor (kadro, zorluk, format) ve bu tabloyu
   * ayarlanabilir kılardı.
   */
  function sonucIsle(oda, sonuc) {
    if (!oda.siralamali) return;
    const evKimlik = oda.ev?.kimlik?.id;
    const misafirKimlik = oda.misafir?.kimlik?.id;
    if (!evKimlik || !misafirKimlik) return;
    // Beraberlik ya da yarım kalan maç: `winner` null gelir
    if (sonuc?.winner !== 'home' && sonuc?.winner !== 'away') return;

    // p1 ev sahibi tarafı ('home'), p2 rakip tarafı ('away') sürüyor
    const kazanan = sonuc.winner === 'home' ? evKimlik : misafirKimlik;
    const kaybeden = sonuc.winner === 'home' ? misafirKimlik : evKimlik;

    const islenen = depo.sonucIsle(kazanan, kaybeden, puanDegisimi);
    if (!islenen) return;

    /*
     * Her iki tarafa da KENDİ yeni durumunu yolla — maç sonu ekranı
     * puanın nasıl değiştiğini gösterebilsin. Karşı tarafın kaydı
     * gitmiyor; sıralama zaten ayrı bir uçtan okunuyor.
     */
    [oda.ev, oda.misafir].forEach((soket) => {
      const kimlik = soket?.kimlik?.id;
      if (!kimlik) return;
      yolla(soket, {
        t: 'puan',
        ben: genelGorunum(depo.oyuncu(kimlik)),
        sira: depo.sira(kimlik),
        degisim: kimlik === kazanan ? islenen.degisim : -islenen.degisim,
      });
    });
  }

  /**
   * Odada maçı kurar ve iki istemciye de rolünü bildirir.
   *
   * @param {boolean} [siralamali] Sonuç skor tablosuna yazılsın mı
   */
  function macKur(oda, ayar, siralamali = false) {
    oda.siralamali = siralamali;
    oda.mac = new Mac({
      ayar,
      yolla: (paket) => odayaYolla(oda, paket),
      bitince: (sonuc) => {
        sonucIsle(oda, sonuc);
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
    macKur(oda, { mode: '1v1', format: 'single', difficulty: 'normal' }, true);
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

  /** IP → açık bağlantı sayısı. */
  const ipSayaci = new Map();

  wss.on('connection', (soket, istek) => {
    const adres = adresOku(istek, soket);
    const acik = ipSayaci.get(adres) ?? 0;
    if (acik >= ipSiniri) {
      /*
       * Sınırı aşan bağlantı hemen kapatılıyor. Sebep söyleniyor
       * çünkü meşru bir kalabalık (CGNAT) da buraya düşebilir ve
       * sessizce kapanan bir soket "oyun bozuk" gibi görünürdü.
       */
      hataYolla(soket, 'cok-baglanti');
      soket.close(1008, 'cok-baglanti');
      return;
    }
    ipSayaci.set(adres, acik + 1);
    soket.adres = adres;

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
           * Kimlik artık SUNUCU tarafından veriliyor.
           *
           * Adım 3'te istemci kendi kimliğini üretiyordu ve bu, skor
           * tablosu gelene kadar zararsızdı: kimse kimsenin adını
           * çalmak istemez. Tablo gelince aynı tasarım "başkasının
           * kimliğini yaz, puanını al" demeye dönüşüyor. Şimdi sunucu
           * bir kimlik ve GİZLİ ANAHTAR veriyor; sonraki bağlantılarda
           * anahtarı bilen kişi o kimliğin sahibi sayılıyor.
           *
           * Bu hesap DEĞİL — anahtar taşıyıcı bir jeton, kopyalanırsa
           * kimlik de kopyalanır. Ama artık başkasının kimliğini
           * TAHMİN ederek ele geçirmek mümkün değil.
           */
          const ad = adTemizle(mesaj.ad, AD_UZUNLUK);
          const kayitli = mesaj.id && mesaj.gizli ? depo.dogrula(mesaj.id, mesaj.gizli) : null;

          if (kayitli) {
            // Ad değiştiyse güncelle; anahtar aynı kalıyor
            const guncel = ad && ad !== kayitli.ad ? depo.adDegistir(kayitli.id, ad) : kayitli;
            soket.kimlik = { id: guncel.id, ad: guncel.ad };
            yolla(soket, {
              t: 'kimlik',
              id: guncel.id,
              ad: guncel.ad,
              ben: genelGorunum(guncel),
              sira: depo.sira(guncel.id),
            });
            break;
          }

          /*
           * Anahtar yok ya da tutmuyor: yeni kimlik. Tutmadığında
           * hata dönmüyoruz — eski sürümden gelen (istemcinin kendi
           * ürettiği) kimlikler de buraya düşüyor ve onların
           * reddedilmesi oyuncuya "çevrimiçi bozuldu" gibi görünürdü.
           * Sessizce yeni kimlik vermek, geçmişini kaybetmek pahasına
           * oynamaya devam etmesini sağlıyor.
           */
          const { kayit, gizli } = depo.oyuncuAc(ad || 'İSİMSİZ');
          soket.kimlik = { id: kayit.id, ad: kayit.ad };
          yolla(soket, {
            t: 'kimlik',
            id: kayit.id,
            gizli,
            ad: kayit.ad,
            ben: genelGorunum(kayit),
            sira: null,
          });
          break;
        }

        case 'siralama': {
          yolla(soket, {
            t: 'siralama',
            liste: depo.siralama(20),
            ben: soket.kimlik?.id ? genelGorunum(depo.oyuncu(soket.kimlik.id)) : null,
            sira: soket.kimlik?.id ? depo.sira(soket.kimlik.id) : null,
          });
          break;
        }

        case 'hizli-esles': {
          if (defter.odaOf(soket)) {
            hataYolla(soket, HATA.zatenOdada);
            break;
          }
          /*
           * Kimlik burada ARTIK KURULMUYOR: `kimlik` mesajıyla
           * sunucudan alınmış olmalı. Kimliksiz sıraya girmek serbest
           * (oynayabilir) ama sonucu tabloya yazılmaz — `sonucIsle`
           * iki tarafın da kimliğini arıyor.
           */
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
      /*
       * IP sayacını düşür. Düşürmezsek sayaç tek yönlü büyür ve
       * yeterince açılıp kapanan bağlantıdan sonra o IP kalıcı
       * olarak kilitlenirdi — sinsi bir arıza, çünkü yalnız çok
       * oynayan kişide görünürdü.
       */
      const kalan = (ipSayaci.get(soket.adres) ?? 1) - 1;
      if (kalan > 0) ipSayaci.set(soket.adres, kalan);
      else ipSayaci.delete(soket.adres);

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

  return { http, wss, defter, sira, depo, ipSayaci, port: http.address().port, kapat };
}
