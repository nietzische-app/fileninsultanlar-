import { describe, it, expect } from 'vitest';
import Game from './Game.js';
import { paketle } from './snapshot.js';
import { stepBall } from './ballstep.js';
import { PHYSICS } from './constants.js';

/** Başsız misafir motoru — tarayıcı yok, çizim yok. */
function misafirKur() {
  return new Game(null, {
    mode: '1v1',
    format: 'single',
    difficulty: 'normal',
    playMode: 'vs',
    bassiz: true,
    agRol: 'misafir',
    agYuvam: 'p1',
  });
}

/**
 * Zamanı KARE KARE akıtır.
 *
 * `ilerlet(2)` işe yaramıyor: tek çağrı `PHYSICS.maxCatchUp` ile
 * sınırlanıyor (sekme arka plandayken biriken zamanın tek karede
 * boşalmaması için) ve yalnız iki adım atıyor. Gerçek döngü de her
 * karede bir kez çağırıyor; test de öyle yapmalı.
 */
function akit(oyun, saniye) {
  const kare = 1 / 60;
  for (let gecen = 0; gecen < saniye; gecen += kare) oyun.ilerlet(kare);
}

/** Sunucu tarafı — paket üretmek için. */
function sunucuKur() {
  return new Game(null, {
    mode: '1v1',
    format: 'single',
    difficulty: 'normal',
    playMode: 'vs',
    bassiz: true,
    agRol: 'ev',
    agGonder: () => {},
  });
}

describe('ağ sessizliği', () => {
  /*
   * Bu testin sebebi gerçek bir arıza: maç kuruldu, sunucudan tek bir
   * durum paketi gelmedi, ekran ilk karede dondu ve oyun hiçbir şey
   * söylemedi. Bekçi "son paketten beri geçen süre"ye bakıyordu ve son
   * paket hiç olmadığı için sessiz kalıyordu.
   */
  it('hiç paket gelmediyse maçın başından beri sessiz sayılır', () => {
    const g = misafirKur();
    expect(g.agSessizlik()).toBe(0);

    // 2 saniye ilerlet — misafir simüle etmez ama zaman akar
    akit(g, 2);
    expect(g.agSessizlik()).toBeGreaterThan(1.5);
  });

  it('paket geldiyse ölçü son paketten alınır', () => {
    const g = misafirKur();
    const sunucu = sunucuKur();

    akit(g, 2); // önce uzun bir sessizlik
    expect(g.agSessizlik()).toBeGreaterThan(1.5);

    // Paket gelince sayaç sıfırlanmalı
    expect(g.agPaketAl(paketle(sunucu))).toBe(true);
    expect(g.agSessizlik()).toBe(0);

    akit(g, 0.5);
    expect(g.agSessizlik()).toBeGreaterThan(0.4);
    expect(g.agSessizlik()).toBeLessThan(0.6);
  });

  it('ev sahibi için sessizlik ölçülmez — akışı o üretiyor', () => {
    const g = sunucuKur();
    akit(g, 3);
    expect(g.agSessizlik()).toBe(0);
  });
});

describe('akış başladı mı', () => {
  /*
   * Sessizliğin iki sebebi ayrı ayrı gösterilmeli: hiç başlamayan akış
   * beklemekle düzelmiyor, kesilen akış çoğu zaman geri geliyor. Ekran
   * ikisine de "rakip bekleniyor" deseydi oyuncu boşuna beklerdi.
   */
  it('ilk pakete kadar false, sonra true', () => {
    const g = misafirKur();
    const sunucu = sunucuKur();

    expect(g.agAkisBasladiMi()).toBe(false);
    akit(g, 2);
    expect(g.agAkisBasladiMi()).toBe(false);

    g.agPaketAl(paketle(sunucu));
    expect(g.agAkisBasladiMi()).toBe(true);
  });

  it('sürüm uyuşmazlığında akış BAŞLAMIŞ sayılmaz', () => {
    const g = misafirKur();
    const sunucu = sunucuKur();

    // Karşı taraf başka sürümdeyse paket uygulanmıyor
    const bozuk = { ...paketle(sunucu), v: 999 };
    expect(g.agPaketAl(bozuk)).toBe(false);
    expect(g.agAkisBasladiMi()).toBe(false);
    expect(g.agSurumUyusmazligi).toBe(true);
  });
});

describe('servis metresi ara değerlemesi', () => {
  /*
   * Metre 0.65 sn'de baştan sona gidiyor, paketler 1/20 sn arayla
   * geliyor. Doğrudan yazıldığında bar karelerin %74'ünde hiç
   * kıpırdamıyor, sonra 4,4 kat sıçrıyordu (ölçüm: olcum/akicilik.mjs).
   * Oyuncunun "güç ve yön barları kasıyor" dediği şey buydu.
   */
  const paket = (asama, metre, yon, atan = 'p1') => [asama, metre, atan, 0, 0, yon];

  it('iki paket arasında metre yürür', () => {
    const g = misafirKur();
    g.agServisYaz(paket('power', 0.2, 1), paket('power', 0.4, 1), 0.5);
    expect(g.serve.meter).toBeCloseTo(0.3, 5);
  });

  it('sekmede metre uca gidip geri döner, ters yöne KAÇMAZ', () => {
    const g = misafirKur();
    // 0.9'dan 1'e çarpıp 0.85'e dönmüş: toplam yol 0.1 + 0.15 = 0.25
    const once = paket('power', 0.9, 1);
    const sonra = paket('power', 0.85, -1);

    // Yolun ilk %20'si: hâlâ yukarı, 0.9 + 0.05 = 0.95
    g.agServisYaz(once, sonra, 0.2);
    expect(g.serve.meter).toBeCloseTo(0.95, 5);

    // Yolun %40'ı: tam uçta
    g.agServisYaz(once, sonra, 0.4);
    expect(g.serve.meter).toBeCloseTo(1, 5);

    // Yolun %80'i: geri dönüşte, 1 - (0.2 - 0.1) = 0.9
    g.agServisYaz(once, sonra, 0.8);
    expect(g.serve.meter).toBeCloseTo(0.9, 5);

    /*
     * Sekme bilinmeseydi doğrusal karışım 0.9 → 0.85 arası inerdi,
     * yani bar tam ters yöne yürürdü. Uçta nişan alan oyuncu için en
     * kötü an orası.
     */
    g.agServisYaz(once, sonra, 0.2);
    expect(g.serve.meter).toBeGreaterThan(0.9);
  });

  it('aşama değişince ara değerleme yapılmaz — metre sıfırlanmıştır', () => {
    const g = misafirKur();
    g.agServisYaz(paket('power', 0.95, 1), paket('aim', 0.5, 1), 0.5);
    expect(g.serve.stage).toBe('aim');
    expect(g.serve.meter).toBe(0.5);
  });

  it('servis atan değişince de ara değerleme yapılmaz', () => {
    const g = misafirKur();
    g.agServisYaz(paket('power', 0.9, 1, 'p1'), paket('power', 0.1, 1, 'p2'), 0.5);
    expect(g.serve.meter).toBe(0.1);
  });

  it('servis bitince gösterge kalkar', () => {
    const g = misafirKur();
    g.agServisYaz(paket('power', 0.5, 1), null, 0.5);
    expect(g.serve).toBe(null);
  });
});

describe('topu ileri sarma', () => {
  /*
   * Sorunun ölçüsü (tests/olcum/top.mjs): kendi oyuncumuz tahmin
   * edilip "şimdi"de çiziliyor, top ise tampondan 133-217 ms geçmişten
   * geliyordu — gerçek yerinden 58-83 piksel uzakta. Temas eşiği
   * toplam ~65 px olduğu için görsel gecikme VURUŞ PENCERESİNİN
   * TAMAMINDAN büyüktü.
   */

  /** Belirli bir top hâliyle sunucu paketi üretir. */
  function topluPaket(sunucu, { x, y, vx, vy }, adim) {
    sunucu.ball.x = x;
    sunucu.ball.y = y;
    sunucu.ball.vx = vx;
    sunucu.ball.vy = vy;
    sunucu.adim = adim;
    return paketle(sunucu);
  }

  /**
   * Oyuncuları saha dışına çeker.
   *
   * İleri sarma, top bir oyuncuya yaklaştıkça FRENLENİYOR (çarpışma
   * orada olası). Serbest uçuşu ölçmek isteyen bir testte oyuncular
   * yakında dururken sonuç frenlenmiş çıkar ve test kendi sorusunu
   * sormamış olur.
   */
  function oyunculariUzaklastir(oyun) {
    oyun.players.forEach((p) => { p.x = -5000; p.y = -5000; });
  }

  it('serbest uçuşta topu İLERİ taşıyor', () => {
    const g = misafirKur();
    const s = sunucuKur();
    g.agPencere = 0.1;

    // İki paket: top sağa doğru düz uçuyor
    g.agPaketAl(topluPaket(s, { x: 300, y: 200, vx: 400, vy: 0 }, 20));
    g.agPaketAl(topluPaket(s, { x: 320, y: 200, vx: 400, vy: 0 }, 21));
    oyunculariUzaklastir(g);
    akit(g, 0.05);

    /*
     * Ara değerleme topu iki paketin ARASINDA gösterirdi (≤320).
     * İleri sarma çalışıyorsa top bunun ötesinde olmalı.
     */
    expect(g.ball.x).toBeGreaterThan(320);
  });

  it('bayrak kapalıyken ileri sarmıyor', () => {
    /*
     * Ölçümün "önce/sonra" sütunu bu bayrağa dayanıyor. Bayrak
     * çalışmasaydı iki koşum aynı çıkar ve iyileşme ölçülemezdi.
     */
    const kapali = new Game(null, {
      mode: '1v1', format: 'single', difficulty: 'normal', playMode: 'vs',
      bassiz: true, agRol: 'misafir', agYuvam: 'p1', agTopIleri: false,
    });
    const acik = misafirKur();
    const s = sunucuKur();

    [kapali, acik].forEach((g) => {
      g.agPencere = 0.1;
      g.agPaketAl(topluPaket(s, { x: 300, y: 200, vx: 400, vy: 0 }, 20));
      g.agPaketAl(topluPaket(s, { x: 320, y: 200, vx: 400, vy: 0 }, 21));
      oyunculariUzaklastir(g);
      akit(g, 0.05);
    });

    expect(acik.ball.x).toBeGreaterThan(kapali.ball.x);
  });

  it('oyuncuya YAKINKEN frenliyor', () => {
    /*
     * İleri sarma serbest uçuşta kusursuz, vuruş anında yanılıyor.
     * Vuruşun nerede olacağını bilmiyoruz ama nerede olamayacağını
     * biliyoruz: kimsenin yakınında olmayan top serbest uçuyordur.
     */
    const uzak = misafirKur();
    const yakin = misafirKur();
    const s = sunucuKur();

    [uzak, yakin].forEach((g) => {
      g.agPencere = 0.1;
      g.agPaketAl(topluPaket(s, { x: 300, y: 200, vx: 400, vy: 0 }, 20));
      g.agPaketAl(topluPaket(s, { x: 320, y: 200, vx: 400, vy: 0 }, 21));
    });
    oyunculariUzaklastir(uzak);
    // Yakın kurulumda bir oyuncu topun tam üstünde
    yakin.players.forEach((p, i) => {
      if (i === 0) { p.x = 320; p.y = 240; } else { p.x = -5000; p.y = -5000; }
    });

    akit(uzak, 0.05);
    akit(yakin, 0.05);

    expect(yakin.ball.x).toBeLessThan(uzak.ball.x);
  });

  it('güven oranı mesafeyle artıyor ve 0-1 arasında kalıyor', () => {
    const g = misafirKur();
    g.ball.x = 400;
    g.ball.y = 200;

    const oran = (mesafe) => {
      g.players.forEach((p, i) => {
        if (i === 0) { p.x = 400 + mesafe; p.y = 200; } else { p.x = -5000; p.y = -5000; }
      });
      return g.agTopGuvenOrani();
    };

    expect(oran(0)).toBe(0);
    expect(oran(10000)).toBe(1);
    // Aradaki değerler sınırların dışına taşmıyor ve azalmıyor
    let onceki = -1;
    [0, 30, 60, 90, 120, 200, 400].forEach((m) => {
      const o = oran(m);
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o).toBeLessThanOrEqual(1);
      expect(o).toBeGreaterThanOrEqual(onceki);
      onceki = o;
    });
  });

  it('ufuk EN YENİ pakete göre, kuşatan çifte göre DEĞİL', () => {
    /*
     * İlk yazışta ufku kuşatan çiftin yenisinden hesaplamıştım ve
     * ölçüm yakaladı: o an çizim saatinin en fazla bir paket aralığı
     * (0.05 sn) ötesinde, oysa telafi edilecek şey ara değerleme
     * gecikmesinin TAMAMI (0.1 sn) artı ağ yolu.
     *
     * Bu testi ilk yazışımda iki paket besliyordum; iki pakette
     * kuşatan çiftin yenisi ZATEN en yeni pakettir, yani test yanlış
     * ufku hiç göremezdi. Tampon, çizim saatinin en yeniden geride
     * kalacağı kadar DOLU olmalı.
     */
    const g = misafirKur();
    const s2 = sunucuKur();
    g.agPencere = 0;

    /*
     * Paketler ÜÇ ADIM arayla — sunucu 20 Hz gönderiyor, motor 60 Hz
     * koşuyor. İlk yazışta 1 adım arayla beslemiştim ve tampon
     * yalnızca 0.067 sn kapsıyordu; çizim saati 0.1 sn geriye hiç
     * düşemediği için test kendi sorusunu soramıyordu.
     */
    const ARALIK = 3;
    for (let i = 0; i < 8; i += 1) {
      const t = i * ARALIK * PHYSICS.step;
      g.agPaketAl(topluPaket(
        s2, { x: 300 + 400 * t, y: 200, vx: 400, vy: 0 }, 20 + i * ARALIK,
      ));
    }
    oyunculariUzaklastir(g);
    akit(g, 0.05);

    /*
     * Kuşatan çiftten hesaplanan ufuk en fazla bir paket aralığı
     * ilerletir (~20 px). En yeniden hesaplanan ufuk ara değerleme
     * gecikmesinin tamamını kapatır, yani belirgin biçimde ileride.
     */
    const cizimSaati = g.agCizimSaati;
    const sonZaman = g.agTampon[g.agTampon.length - 1].zaman;
    expect(sonZaman - cizimSaati).toBeGreaterThan(0.05);

    /*
     * Topun x'i sunucu saatiyle doğrusal: x(t) = 300 + 400*(t - t0).
     * Kuşatan çiftten hesaplanan ufuk çizim saatini en fazla BİR paket
     * aralığı ilerletirdi; doğru ufuk en yeni pakete kadar kapatır.
     */
    const t0 = 20 * PHYSICS.step;
    const x = (t) => 300 + 400 * (t - t0);
    expect(g.ball.x).toBeGreaterThan(x(cizimSaati + ARALIK * PHYSICS.step));
    // Ve en yeni paketin ötesine de taşmıyor (agPencere = 0 verildi)
    expect(g.ball.x).toBeLessThan(x(sonZaman) + 5);
  });

  it('DÜŞEN topta da doğru yeri buluyor (yerçekimi düzeltmesi)', () => {
    /*
     * İki anlık görüntünün farkı ORTALAMA hızı veriyor, anlık hızı
     * değil; sabit ivmede ortalama, aralığın ORTASINDAKİ anlık hıza
     * eşit. Düzeltilmezse ileri sarma topu sistematik olarak yanlış
     * yere koyar.
     *
     * Yatay uçan topla sınamak bunu GÖREMEZ (yerçekimi vy'yi etkiler,
     * vx'i değil) — ilk testlerim tam olarak bu yüzden düzeltmeyi
     * kaldırınca da geçiyordu. O yüzden burada top düşüyor.
     */
    const g = misafirKur();
    const s2 = sunucuKur();
    g.agPencere = 0;

    /*
     * GERÇEK yörünge motorun kendi fiziğiyle üretiliyor; paketler
     * ondan örnekleniyor. Böylece "doğru yer" tanımı testin kendi
     * hesabı değil, oyunun fiziği oluyor.
     */
    const gercek = { x: 400, y: 120, vx: 60, vy: -260, radius: g.ball.radius };
    const kareler = [];
    for (let adim = 0; adim < 40; adim += 1) {
      kareler.push({ x: gercek.x, y: gercek.y });
      stepBall(gercek, PHYSICS.step);
    }

    // Her 3 adımda bir paket (20 Hz'e yakın)
    for (let i = 0; i < 5; i += 1) {
      const k = kareler[i * 3];
      g.agPaketAl(topluPaket(s2, { x: k.x, y: k.y, vx: 0, vy: 0 }, 20 + i * 3));
    }
    oyunculariUzaklastir(g);
    akit(g, 0.05);

    // Çizilen top gerçek yörüngenin ÜSTÜNDE bir noktaya denk gelmeli
    const enYakin = Math.min(
      ...kareler.map((k) => Math.hypot(k.x - g.ball.x, k.y - g.ball.y))
    );
    /*
     * Eşik ÖLÇÜLEREK kondu: düzeltme varken sapma 1.3 px, düzeltme
     * kaldırılınca 3.0 px. İlk yazışta 6 px kullanmıştım ve mutasyon
     * hayatta kaldı — test, adını taşıdığı şeyi hiç sormuyordu.
     * 2 px ikisinin arasında ve ayrımı kesin yapıyor.
     */
    expect(enYakin).toBeLessThan(2);
  });

  it('kötü bağlantıda ufuk TAVANLI', () => {
    /*
     * `agPencere` gidiş-dönüşten öğreniliyor ve kopuk bir bağlantıda
     * saniyelere çıkabiliyor. Tavansız bırakılsa top ekranın dışına
     * fırlar ve paket gelince geri döner — gecikmeden çok daha kötü
     * bir görüntü.
     */
    const g = misafirKur();
    const s2 = sunucuKur();
    g.agPencere = 5; // saçma derecede kötü bağlantı

    const ARALIK = 3;
    for (let i = 0; i < 6; i += 1) {
      const t = i * ARALIK * PHYSICS.step;
      g.agPaketAl(topluPaket(
        s2, { x: 300 + 400 * t, y: 200, vx: 400, vy: 0 }, 20 + i * ARALIK,
      ));
    }
    oyunculariUzaklastir(g);
    akit(g, 0.05);

    // 5 sn ileri sarsaydı x binleri bulurdu; tavan 0.3 sn
    expect(g.ball.x).toBeLessThan(300 + 400 * 0.45);
  });

  it('ev sahibi tarafta ileri sarma HİÇ çalışmıyor', () => {
    /*
     * Sunucu topu zaten gerçek zamanlı simüle ediyor; orada ileri
     * sarmak, gerçeği tahminle bozmak olurdu.
     */
    const ev = sunucuKur();
    ev.ball.x = 300;
    ev.ball.y = 200;
    ev.ball.vx = 400;
    const oncekiX = ev.ball.x;
    ev.agAradegerle(1 / 60);
    // Tampon boş; ara değerleme hiç çalışmıyor, top da kıpırdamıyor
    expect(ev.ball.x).toBe(oncekiX);
  });
});

describe('bağlantı gecikmesi ölçümü', () => {
  it('ölçüm yokken null, SIFIR gecikmeyle null DEĞİL', () => {
    /*
     * "Henüz ölçülmedi" ile "sıfır gecikme" farklı şeyler. İlk yazışta
     * `agPencere`yi 0 ile başlatıp `!agPencere` diye bakmıştım; kusursuz
     * bir bağlantıda (yerel ağ, aynı makine) gösterge tamamen
     * kayboluyordu — yani EN İYİ durum, ölçüm yokmuş gibi görünüyordu.
     */
    const g = misafirKur();
    expect(g.agGidisDonus()).toBeNull();

    g.agPencere = 0;
    expect(g.agGidisDonus()).toBe(0);

    g.agPencere = 0.12;
    expect(g.agGidisDonus()).toBe(120);
  });

  it('ev sahibi tarafta gecikme ölçülmüyor', () => {
    // Sunucu kendi kendine gecikmiyor; orada gösterge anlamsız olurdu
    const ev = sunucuKur();
    ev.agPencere = 0.2;
    expect(ev.agGidisDonus()).toBeNull();
  });

  it('DEPLASMANDAKİ oyuncuda etiketler ters DEĞİL', () => {
    /*
     * Ölçerek bulunmuş bir hata. Skorbordun ev etiketi sabit
     * 'TÜRKİYE' idi; çevrimdışında doğru (oyuncu her zaman ev sahibi)
     * ama çevrimiçide değil — hızlı eşleşmede Türkiye'yi kimin
     * oynayacağına sunucu karar veriyor.
     *
     * İki tarayıcıyla ölçüldüğünde deplasmana düşen oyuncu KENDİ
     * TARAFINDA rakibinin adını görüyordu:
     *   ev sahibi:  TÜRKİYE ... OYUNCU-B   doğru
     *   deplasman:  TÜRKİYE ... OYUNCU-A   YANLIŞ
     *
     * Kural: karşı taraf rakibin adını, kendi tarafın oynadığın
     * takımın adını taşır.
     */
    const etiketler = (yuva) => {
      let yakalanan = null;
      const g = new Game(null, {
        mode: '1v1', format: 'single', difficulty: 'normal', playMode: 'vs',
        bassiz: true, agRol: 'misafir', agYuvam: yuva, agRakipAd: 'RAKİBİM',
        onState: (durum) => { yakalanan = durum; },
      });
      g.emitState(true);
      const ben = g.players.find((p) => p.controlSlot === yuva);
      return { taraf: ben?.side, ...yakalanan };
    };

    const ev = etiketler('p1');
    expect(ev.taraf).toBe('home');
    expect(ev.homeName).toBe('TÜRKİYE');
    expect(ev.opponentName).toBe('RAKİBİM');

    const dep = etiketler('p2');
    expect(dep.taraf).toBe('away');
    // Rakip KARŞI tarafta; kendi tarafında rakibin adı OLMAMALI
    expect(dep.homeName).toBe('RAKİBİM');
    expect(dep.opponentName).not.toBe('RAKİBİM');
  });

  it('çevrimiçi skorbordda RAKİBİN adı yazıyor', () => {
    /*
     * Karşındaki insanken skorbordda yapay zekâ takımının adını
     * ("NORDİK") görmek maçı kişisizleştiriyordu — üstelik sprite'ın
     * üstünde zaten oyuncunun adı yazıyor, yani ekran iki farklı isim
     * söylüyordu.
     *
     * Test motorun GERÇEK yolundan geçiyor (`emitState` → `onState`).
     * İlk yazışımda ifadeyi test içinde tekrar etmiştim; öyle bir test
     * üretim kodu değişse de geçerdi, yani hiçbir şey sormuyordu.
     */
    const oku = (agRakipAd) => {
      let yakalanan = null;
      const g = new Game(null, {
        mode: '1v1', format: 'single', difficulty: 'normal', playMode: 'vs',
        bassiz: true, agRol: 'misafir', agYuvam: 'p1', agRakipAd,
        onState: (durum) => { yakalanan = durum; },
      });
      g.emitState(true);
      return yakalanan?.opponentName ?? null;
    };

    const aiAdi = oku(null);
    expect(aiAdi).toBeTruthy();
    expect(oku('ŞİMŞEK FİLE')).toBe('ŞİMŞEK FİLE');
  });
});
