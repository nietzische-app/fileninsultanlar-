import { describe, it, expect } from 'vitest';
import Game, { agAyarOzeti } from './Game.js';
import { paketle } from './snapshot.js';
import { stepBall } from './ballstep.js';
import { PHYSICS, PLAYER, GROUND_Y } from './constants.js';

/**
 * Başsız misafir motoru — tarayıcı yok, çizim yok.
 *
 * `agSaat` verilebiliyor: seğirme ölçümü artık paketin GERÇEK varış
 * anını okuyor, kare saatini değil (gerekçesi Game.js'te `agSaat`
 * yanında). Testin o saati sürebilmesi gerekiyor; varsayılan
 * `performance.now()` testte anlamsız olurdu, çünkü bütün koşum
 * milisaniyeler içinde biter.
 */
function misafirKur(ek = {}) {
  return new Game(null, {
    mode: '1v1',
    format: 'single',
    difficulty: 'normal',
    playMode: 'vs',
    bassiz: true,
    agRol: 'misafir',
    agYuvam: 'p1',
    ...ek,
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

  it('RAKİBE yakınken frenliyor', () => {
    /*
     * İleri sarma serbest uçuşta kusursuz, vuruş anında yanılıyor.
     * Vuruşun nerede olacağını bilmiyoruz ama nerede olamayacağını
     * biliyoruz: kimsenin yakınında olmayan top serbest uçuyordur.
     *
     * Kıstas artık YALNIZ RAKİP. Kendi oyuncumuz frenlemiyor, çünkü
     * onun konumunu tahmin ediyoruz ve çarpışmasını hesaplayabiliyoruz
     * (bkz. `agTopCarpisma`). Bu test o yüzden rakibi (p2) kullanıyor;
     * ilk yazılışında p1 kullanıyordu ve kural değişince yanlış şeyi
     * sınar hâle gelmişti.
     */
    /*
     * RAKİBİN YERİ PAKETİN İÇİNDEN geliyor, elle yazılarak değil.
     *
     * Elle yazmayı denedim ve tutmadı: rakip ara değerlemeyle her
     * karede paketten geri yazılıyor (yalnız KENDİ oyuncumuz bunun
     * dışında, çünkü o tahmin ediliyor). Testin ilk hâli p1 kullandığı
     * için çalışıyordu; kural değişince p2'ye geçirmek yetmedi,
     * kurulumun da değişmesi gerekti.
     */
    const kur = (rakipX, rakipY) => {
      const g = misafirKur();
      const s = sunucuKur();
      const rakipS = s.players.find((p) => p.controlSlot === 'p2');
      rakipS.x = rakipX;
      rakipS.y = rakipY;
      g.agPencere = 0.1;
      g.agPaketAl(topluPaket(s, { x: 300, y: 200, vx: 400, vy: 0 }, 20));
      rakipS.x = rakipX;
      rakipS.y = rakipY;
      g.agPaketAl(topluPaket(s, { x: 320, y: 200, vx: 400, vy: 0 }, 21));
      // Kendi oyuncumuz yolun dışında — sınanan şey RAKİBİN etkisi
      const ben = g.players.find((p) => p.controlSlot === g.agYuvam);
      ben.x = -5000;
      ben.y = -5000;
      akit(g, 0.05);
      return g;
    };

    const uzak = kur(-5000, -5000);
    const yakin = kur(330, 240);

    expect(yakin.ball.x).toBeLessThan(uzak.ball.x);
  });

  it('KENDİ oyuncumuz ileri sarmayı frenlemiyor', () => {
    /*
     * Bu kural bir ölçümden doğdu (olcum:vurus): top kendi oyuncumuza
     * yaklaşınca ileri sarma sıfırlanıyor ve ekran tam vuruş anında
     * 67 ms geriye düşüyordu. O sayı gidiş-dönüşten BAĞIMSIZDI, yani
     * kaynağı ağ değil bu karardı — oyuncunun "vurduktan sonra top geç
     * sekiyor" dediği şey buydu.
     *
     * Kendi oyuncumuzu ayırabilmemizin sebebi onun konumunu TAHMİN
     * ediyor olmamız; rakip için aynısı doğru değil.
     */
    const g = misafirKur();
    g.ball.x = 400;
    g.ball.y = 200;
    g.players.forEach((p) => { p.x = -5000; p.y = -5000; });

    // Kendi oyuncumuz topun TAM ÜSTÜNDE — güven tam kalmalı
    const ben = g.players.find((p) => p.controlSlot === g.agYuvam);
    ben.x = 400;
    ben.y = 200;
    expect(g.agTopGuvenOrani()).toBe(1);

    // Aynı yere RAKİBİ koyunca frenlemeli — kural taraf ayırıyor
    ben.x = -5000;
    ben.y = -5000;
    const rakip = g.players.find((p) => p.controlSlot !== g.agYuvam);
    rakip.x = 400;
    rakip.y = 200;
    expect(g.agTopGuvenOrani()).toBe(0);
  });

  it('sanal top KENDİ oyuncumuzun içinden GEÇMİYOR', () => {
    /*
     * Güven oranından çıkarmanın bedeli: ileri sarılan top artık kendi
     * oyuncumuzun üstünden geçebilir. Hesaplanmasaydı top oyuncunun
     * içinden geçer, sunucunun paketi gelince geri sıçrardı —
     * gecikmeden de kötü bir görüntü.
     */
    const g = misafirKur();
    const s = sunucuKur();
    g.agPencere = 0.3;
    g.agPaketAl(topluPaket(s, { x: 200, y: 240, vx: 600, vy: 0 }, 20));
    g.agPaketAl(topluPaket(s, { x: 210, y: 240, vx: 600, vy: 0 }, 21));

    /*
     * TAMPON SABİTLENİYOR. Bu test ileri sarmanın GEOMETRİSİNİ sınıyor,
     * tamponun boyunu değil; sınırları da o geometriye göre ölçülüp
     * kondu (mutasyon ayrımı birkaç piksel). Tampon `durumHz`e bağlı
     * olduğu için sabitlenmezse ayar her değiştiğinde bu sayılar kayar
     * ve test, sınadığını sandığı şeyi bırakıp ayarı sınamaya başlar.
     */
    g.agTamponBoyu = 1.5 / 30;

    // Kendi oyuncumuz topun YOLUNDA duruyor
    g.players.forEach((p) => { p.x = -5000; p.y = -5000; });
    const ben = g.players.find((p) => p.controlSlot === g.agYuvam);
    ben.x = 300;
    ben.y = 240 + (PLAYER.hitOffsetY ?? 0);

    akit(g, 0.05);

    /*
     * SINIR TEMAS YÜZEYİNDE, cömert değil.
     *
     * İlk yazışta sınırı oyuncunun ÖTESİNE koymuştum (+20 pay ile) ve
     * mutasyon denemesi ele verdi: çarpışmayı tamamen kaldıran kod da
     * testi geçiyordu. Ölçülen değerler farkı net gösteriyor —
     * çarpışma açıkken top 228.9'da duruyor, kapalıyken 308.3'e, yani
     * oyuncunun içinden geçiyor.
     */
    const erim = ben.hitRadius + PLAYER.reachBonus + g.ball.radius;
    expect(g.ball.x, 'top oyuncunun içinden geçmiş').toBeLessThan(ben.x - erim + 8);

    /*
     * Ve ileri sarma DURMAMIŞ olmalı: topu temas noktasına kadar
     * taşımaya devam ediyor. Yalnız üst sınır olsaydı, ileri sarmayı
     * tamamen kapatan bir mutasyon da testi geçerdi.
     */
    expect(g.ball.x, 'ileri sarma hiç çalışmamış').toBeGreaterThan(215);
  });

  it('güven oranı mesafeyle artıyor ve 0-1 arasında kalıyor', () => {
    const g = misafirKur();
    g.ball.x = 400;
    g.ball.y = 200;

    /*
     * Mesafe RAKİPTEN ölçülüyor: kendi oyuncumuz artık bu hesaba
     * girmiyor (gerekçesi bir üstteki testte). İlk yazılışında p1
     * kullanılıyordu ve kural değişince test hep 1 okur olmuştu.
     */
    const oran = (mesafe) => {
      g.players.forEach((p) => {
        if (p.controlSlot !== g.agYuvam) { p.x = 400 + mesafe; p.y = 200; } else { p.x = -5000; p.y = -5000; }
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
     * ötesinde, oysa telafi edilecek şey ara değerleme tamponunun
     * TAMAMI artı ağ yolu.
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
    /*
     * Tampon boyu ELLE sabitleniyor. Tampon artık ölçülen seğirmeye
     * göre uyarlanıyor (bkz. `agSegirmeOlc`) ve bu test tampon
     * boyutlandırmasını değil UFUK hesabını sınıyor: ikisi karışırsa
     * tampon küçüldüğünde test, kod doğruyken de kırılır (tam olarak
     * bu oldu). Bir paket aralığından belirgin biçimde büyük bir
     * tampon, iki ufuk hesabını ayırt edebilmenin ön koşulu.
     */
    g.agTamponBoyu = 2 * ARALIK * PHYSICS.step;
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
    expect(
      sonZaman - cizimSaati,
      'ön koşul: çizim saati en yeni paketten BİR ARALIKTAN fazla geride olmalı',
    ).toBeGreaterThan(ARALIK * PHYSICS.step);

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

    /*
     * Sınır EN YENİ PAKETE göre kuruluyor, paket dizisinin başına
     * göre değil. İlk yazışta başlangıca göreydi ve tampon küçülünce
     * (uyarlanan tampon) çizim saati ileri kaydığı için test, tavan
     * çalışırken de kırıldı — sınırın kendisi yanlış yerdeydi.
     *
     * Top yörüngesi sunucu saatiyle doğrusal: x(T) = 300 + 400*(T-t0).
     */
    const sonZaman = g.agTampon[g.agTampon.length - 1].zaman;
    const xSon = 300 + 400 * (sonZaman - 20 * PHYSICS.step);

    // 5 sn ileri sarsaydı x 2000'i aşardı; tavan 0.3 sn = 120 px
    expect(g.ball.x).toBeLessThan(xSon + 400 * 0.3 + 10);
    /*
     * Alt sınır da gerekli: tavan "hiç ileri sarma" demek değil.
     * Yalnız üst sınır olsaydı ileri sarmayı tamamen kapatan bir
     * mutasyon da testi geçerdi.
     */
    expect(g.ball.x).toBeGreaterThan(xSon);
  });

  it('ileri sarılan top ZEMİNİN ALTINA inmiyor', () => {
    /*
     * Oyuncu bildirimi: "yere düştüğünde bazen zeminin içerisine
     * giriyor". Sebebi `stepBall`in zemini BİLMEMESİ — o fonksiyon yan
     * duvarları, tavanı ve fileyi ele alıyor ama yere düşmek motorda
     * bir çarpışma değil, sayının bittiği an (`onGround`) ve ayrı ele
     * alınıyor. İleri sarma aynı fonksiyonu kullandığı için ekrandaki
     * top yerin altına iniyordu.
     *
     * Ölçüldü: istemcinin topu zeminin 44 px altına gömülüyordu (top
     * yarıçapı ~13 px, yani tamamen kayboluyor); düzeltmeden sonra
     * 2.5 px, yani sunucunun kendi payından (3.3 px) bile az.
     */
    const g = misafirKur();
    const s = sunucuKur();
    g.agPencere = 0.3; // kötü bağlantı: ileri sarma en uzun

    // Top hızla yere iniyor
    /*
     * Topun YATAY hızı da var. Dikey bırakılsaydı, yere değdikten sonra
     * ileri sarmayı DURDURMAYAN bir sürüm (kelepçe var ama `break` yok)
     * fark edilmezdi: y kelepçelenir, x zaten değişmezdi. Yatay hızla
     * o sürüm topu zeminde kaydırıyor ve test görüyor.
     */
    g.agPaketAl(topluPaket(s, { x: 300, y: GROUND_Y - 80, vx: 300, vy: 400 }, 20));
    g.agPaketAl(topluPaket(s, { x: 305, y: GROUND_Y - 73, vx: 300, vy: 400 }, 21));

    /*
     * TAMPON SABİTLENİYOR. Bu test ileri sarmanın GEOMETRİSİNİ sınıyor,
     * tamponun boyunu değil; sınırları da o geometriye göre ölçülüp
     * kondu (mutasyon ayrımı birkaç piksel). Tampon `durumHz`e bağlı
     * olduğu için sabitlenmezse ayar her değiştiğinde bu sayılar kayar
     * ve test, sınadığını sandığı şeyi bırakıp ayarı sınamaya başlar.
     */
    g.agTamponBoyu = 1.5 / 30;
    oyunculariUzaklastir(g);
    akit(g, 0.05);

    /*
     * SINIR DAR ve ölçülerek kondu. Önce 5 px pay bırakmıştım ve
     * mutasyon denemesi ele verdi: kelepçeyi topun YARIÇAPINI unutacak
     * şekilde bozan sürüm de testi geçiyordu. Ölçülen değerler —
     * doğrusu 416.5 (zeminin 3.5 px üstünde), yarıçapı unutan sürüm
     * 423.8 (3.8 px altında). Sapma yumuşatması 13 px'lik hatanın
     * çoğunu yuttuğu için ayrım dar; pay da o yüzden dar.
     */
    expect(
      g.ball.y + g.ball.radius,
      'top zeminin ALTINDA çiziliyor',
    ).toBeLessThan(GROUND_Y + 1);

    /*
     * Ve top gerçekten zemine kadar İNMİŞ olmalı. Yalnız üst sınır
     * olsaydı ileri sarmayı tamamen kapatan bir mutasyon da geçerdi.
     */
    expect(
      g.ball.y + g.ball.radius,
      'top zemine hiç ulaşmamış — ileri sarma çalışmıyor olabilir',
    ).toBeGreaterThan(GROUND_Y - 10);

    /*
     * VE YERE DEĞİNCE İLERİ SARMA DURMALI — top zeminde kaymamalı.
     *
     * Sayı ölçülerek kondu: durduran sürümde top 325.9'da, durmayan
     * sürümde (kelepçe var ama `break` yok) 353.6'da bitiyor. Sunucu
     * bu topu zaten "yere düştü" saydığı için kaymanın karşılığı yok;
     * ekranda topun zeminde süzülmesi olarak görünürdü.
     */
    expect(g.ball.x, 'top zeminde kaymaya devam ediyor').toBeLessThan(340);
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

    g.agDongu = 0;
    expect(g.agGidisDonus()).toBe(0);

    g.agDongu = 0.12;
    expect(g.agGidisDonus()).toBe(120);
  });

  it('gösterge TAHMİN penceresini değil DÖNGÜ süresini okuyor', () => {
    /*
     * Bu ayrım bir kullanıcı bildiriminden doğdu: "2 ms yazıyor ama
     * inandırıcı değil". Haklıydı — gösterge `agPencere`yi okuyordu ve
     * o değerden sunucudaki bekleme DÜŞÜLÜYOR. Çıkarma tahmin için
     * doğru (sunucu o süreyi zaten ilerletmiş) ama oyuncunun
     * hissettiği gecikme beklemeyi içeriyor; sunucu 20 Hz gönderdiği
     * için gösterge gerçek gidiş-dönüşü ~34 ms eksik veriyordu.
     *
     * İki alan bilerek FARKLI değerlerle sınanıyor: gösterge yanlış
     * olanı okursa test düşer.
     */
    const g = misafirKur();
    g.agPencere = 0.002;  // tahminin penceresi — küçük
    g.agDongu = 0.086;    // oyuncunun hissettiği — gerçek
    expect(g.agGidisDonus()).toBe(86);
  });

  it('GERÇEK döngüde gecikmeyi sistematik olarak EKSİK göstermiyor', () => {
    /*
     * Kullanıcının bildirdiği hata tam olarak buydu ve yalnız bu test
     * yakalayabilir: alanları elle atayan testler tam döngüyü hiç
     * çalıştırmıyor, dolayısıyla "bekleme düşülüyor mu" sorusunu
     * soramıyorlar. Mutasyon bunu gösterdi — çıkarmayı geri koyduğumda
     * bütün birim testleri geçiyordu.
     *
     * Burada iki motor yapay gecikmeyle bağlanıyor ve göstergenin
     * GERÇEK gidiş-dönüşün altında kalmadığı sınanıyor.
     */
    const MS = PHYSICS.step * 1000;
    const gecikmeAdim = 6; // ~100 ms tek yön → ~200 ms gidiş-dönüş
    const gercekRtt = gecikmeAdim * MS * 2;

    const kuyruk = { yukari: [], asagi: [] };
    let adim = 0;
    const yolla = (ad) => (paket) => kuyruk[ad].push({
      varis: adim + gecikmeAdim, veri: JSON.stringify(paket),
    });
    const al = (ad) => {
      const cikan = [];
      while (kuyruk[ad].length && kuyruk[ad][0].varis <= adim) {
        cikan.push(JSON.parse(kuyruk[ad].shift().veri));
      }
      return cikan;
    };

    const ortak = {
      mode: '1v1', format: 'single', difficulty: 'normal', playMode: 'vs', bassiz: true,
    };
    const sunucu = new Game(null, { ...ortak, agRol: 'ev', agGonder: yolla('asagi') });
    sunucu.start();
    const istemci = new Game(null, {
      ...ortak,
      opponentId: sunucu.opponent.id,
      homeIds: [...sunucu.homeIds],
      agRol: 'misafir',
      agYuvam: 'p1',
      agGonder: yolla('yukari'),
      /*
       * SİMÜLE SAAT ŞART. Bu döngü 300 adımı milisaniyeler içinde
       * bitiriyor, yani duvar saatinde neredeyse hiç zaman geçmiyor.
       * Girdi damgası `agSaat`ten geldiği için enjekte edilmezse ölçüm
       * "1 ms gidiş-dönüş" der ve test kodu değil KENDİNİ sınamış olur.
       */
      agSaat: () => adim * PHYSICS.step,
    });
    istemci.start();

    for (adim = 0; adim < 300; adim += 1) {
      al('yukari').forEach((p) => sunucu.agPaketAl(p, 'p1'));
      al('asagi').forEach((p) => istemci.agPaketAl(p, 'p2'));
      if (adim % 30 === 0) istemci.inputs.p1.right = !istemci.inputs.p1.right;
      sunucu.ilerlet(PHYSICS.step);
      sunucu.agAkis();
      istemci.ilerlet(PHYSICS.step);
      istemci.agAkis();
    }

    const gosterilen = istemci.agGidisDonus();
    expect(gosterilen).not.toBeNull();

    /*
     * TOLERANS ÖLÇÜLEREK KONDU, tahminle değil.
     *
     * İlk yazışta 3 adım (50 ms) paya izin verdim ve mutasyon hayatta
     * kaldı: bekleme çıkarılınca sapma 33 ms oluyor, yani payın
     * altında kalıyordu — test adını taşıdığı şeyi sormuyordu.
     *
     * Aynı düzenekte ölçülen:
     *   doğru hâl        → 211 ms (gerçek 200, sapma +11)
     *   bekleme düşülmüş → 167 ms (gerçek 200, sapma -33)
     *
     * 25 ms eşiği ikisini kesin ayırıyor.
     */
    expect(
      Math.abs(gosterilen - gercekRtt),
      `gösterilen ${gosterilen}ms, gerçek ${gercekRtt}ms`,
    ).toBeLessThan(25);
  });

  it('AYNI damga tekrar gelirse ölçüm ŞİŞMİYOR', () => {
    /*
     * Sunucu 20 Hz anlık görüntü gönderiyor, istemci 20 Hz damga —
     * ikisi tam örtüşmediği için sunucu iki ardışık görüntüde AYNI
     * damgayı geri yollayabiliyor. O damgayla tekrar ölçmek süreyi
     * şişirir: ölçülen şey gidiş-dönüş değil, damganın yaşı olur.
     *
     * Bu testi mutasyon istedi: korumayı kaldırdığımda hiçbir test
     * düşmüyordu, yani kod doğrulanmamış duruyordu.
     */
    /*
     * SAAT ENJEKTE EDİLİYOR: gidiş-dönüş ölçüsü artık `agSaat`ten
     * okunuyor (girdi damgasıyla aynı saat, bkz. `agSaat`). `g.time`
     * yazmak bu ölçüyü artık sürmüyor — test geçmeye devam ederdi ama
     * adının söylediği şeyi sınamayı bırakırdı.
     */
    let saat = 0;
    const g = misafirKur({ agSaat: () => saat });
    const s2 = sunucuKur();

    /*
     * Sunucu adımı her pakette ilerliyor: aynı adımla gelen paket
     * yok sayılıyor (tampon sıralaması buna dayanıyor) ve test sessizce
     * hiçbir şey ölçmemiş olurdu — ilk yazışta tam bu oldu.
     */
    let adim = 100;
    const paketYap = (damga, bekleme) => {
      adim += 3;
      s2.adim = adim;
      const p = paketle(s2);
      p.az = [damga, null];
      p.ay = [bekleme, 0];
      return p;
    };

    // İlk ölçüm: damga 1.0, istemci saati ilerledi
    saat = 1.2;
    g.agPaketAl(paketYap(1.0, 0), 'p2');
    const ilk = g.agDongu;
    expect(ilk).toBeGreaterThan(0);

    // AYNI damga, ama istemci saati epey ilerledi
    saat = 1.6;
    g.agPaketAl(paketYap(1.0, 0), 'p2');
    expect(g.agDongu).toBe(ilk);

    // Yeni damga gelince ölçüm yeniden işliyor
    saat = 1.7;
    g.agPaketAl(paketYap(1.6, 0), 'p2');
    expect(g.agDongu).not.toBe(ilk);
  });

  it('ev sahibi tarafta gecikme ölçülmüyor', () => {
    // Sunucu kendi kendine gecikmiyor; orada gösterge anlamsız olurdu
    const ev = sunucuKur();
    ev.agDongu = 0.2;
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

describe('ara değerleme tamponu — ölçülen seğirmeye göre', () => {
  /*
   * Tampon 0.1 sn SABİTTİ. Ölçüm (npm run olcum:hissedilen) bunun
   * oyuncunun hissettiği gecikmenin en büyük kalemi olduğunu gösterdi:
   * ağda hiç gecikme yokken bile rakip ekrana 117 ms geç geliyordu.
   *
   * Sabit sayının asıl sorunu şuydu: herkese EN KÖTÜ bağlantının
   * bedelini ödetiyordu. Bu testlerin sorduğu soru da o — "iyi
   * bağlantıda tampon gerçekten küçülüyor mu, kötüde büyüyor mu".
   */

  /** Tohumlu üreteç — koşumlar arasında karşılaştırılabilir olsun. */
  function uretec(tohum = 20260906) {
    let s = tohum;
    return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  }

  /**
   * Bilinen seğirmeyle paket varışını taklit eder.
   *
   * `saatFarki`, istemci ile sunucu saatleri arasındaki kayma. Sıfır
   * DEĞİL, çünkü gerçekte de sıfır değil ve ölçümün onu soğurması
   * gerekiyor — testin sorularından biri tam olarak bu.
   */
  function segirmeAkit(g, { segirmeSn, saatFarki = 0.5, paket = 400, hz = 30 }) {
    const rast = uretec();
    const aralik = 1 / hz;
    for (let i = 0; i < paket; i += 1) {
      const zaman = i * aralik;
      const sapma = segirmeSn ? (rast() * 2 - 1) * segirmeSn : 0;
      /*
       * VARIŞ SAATİ sürülüyor, `g.time` değil. Ölçüm artık paketin
       * gerçek varış anını okuyor; kare saatini sürmek testi üretim
       * kodundan koparırdı — bu ayrımın kendisi düzeltilen arızaydı.
       */
      g.agSaat = () => zaman + saatFarki + sapma;
      g.agSegirmeOlc(zaman);
    }
    return g.agTamponBoyu;
  }

  it('seğirme yoksa tampon TABANA iniyor', () => {
    /*
     * Düzeltmenin bütün amacı bu satır: seğirmesi olmayan bir oyuncu
     * artık 100 ms değil bir buçuk paket aralığı (~50 ms) bekliyor.
     */
    const boyu = segirmeAkit(misafirKur(), { segirmeSn: 0 });
    expect(boyu).toBeGreaterThan(0.045);
    expect(boyu).toBeLessThan(0.056);
  });

  it('SAAT FARKI tamponu şişirmiyor', () => {
    /*
     * Varış ölçüsünün içinde iki saatin bilinmeyen kayması ve tek yön
     * gecikme de var; tampona girmesi gereken yalnız OYNAMA payı.
     * Farkın mutlak değerini kullanan bir kod bu testte patlar:
     * 5 saniyelik kayma tamponu tavana yapıştırırdı.
     */
    const yakin = segirmeAkit(misafirKur(), { segirmeSn: 0, saatFarki: 0.02 });
    const uzak = segirmeAkit(misafirKur(), { segirmeSn: 0, saatFarki: 5 });
    expect(Math.abs(uzak - yakin)).toBeLessThan(0.002);
  });

  it('seğirme büyüdükçe tampon büyüyor', () => {
    const olc = (s) => segirmeAkit(misafirKur(), { segirmeSn: s });
    const boylar = [0, 0.01, 0.03, 0.06].map(olc);
    for (let i = 1; i < boylar.length; i += 1) {
      expect(boylar[i]).toBeGreaterThan(boylar[i - 1]);
    }
    // Ve fark GÖRÜLECEK kadar büyük olmalı; sıfıra yakın bir eğim
    // "uyarlanıyor" demek değil.
    expect(boylar[boylar.length - 1] - boylar[0]).toBeGreaterThan(0.03);
  });

  it('tampon TAVANLI — kopuk bağlantıda saniyelere çıkmıyor', () => {
    /*
     * Tavansız bırakılsaydı kopmuş bir bağlantıda tampon büyüdükçe
     * büyür, ekran akıcı ama gerçekle alakasız hâle gelirdi.
     */
    const boyu = segirmeAkit(misafirKur(), { segirmeSn: 2 });
    expect(boyu).toBeLessThanOrEqual(0.2);
    // Tavana gerçekten DAYANMIŞ olmalı — yoksa test tavanı sınamıyor
    expect(boyu).toBeGreaterThan(0.19);
  });

  it('seğirme geçince tampon GERİ ÇEKİLİYOR', () => {
    /*
     * Tek yönlü büyüyen bir tampon, bir anlık ağ tökezlemesinden sonra
     * maçın geri kalanını ağır çekim yapardı.
     */
    const g = misafirKur();
    segirmeAkit(g, { segirmeSn: 0.06 });
    const kotu = g.agTamponBoyu;
    expect(kotu).toBeGreaterThan(0.08);

    // Aynı motora bu kez düzgün akış ver
    segirmeAkit(g, { segirmeSn: 0 });
    expect(g.agTamponBoyu).toBeLessThan(0.06);
  });

  it('paket aralığı ÖLÇÜLÜYOR — karşı taraf yavaş gönderiyorsa taban büyüyor', () => {
    /*
     * `AG.durumHz` BİZİM gönderme sıklığımız; karşı taraf başka bir
     * sürümde olabilir (dağıtımlar arasındaki pencere). Taban sabit
     * varsayımla hesaplansaydı, 10 Hz gönderen bir röleyle konuşan
     * istemcinin tamponu bir paket aralığının bile altında kalır ve
     * her karede kururdu — akıcılık için yazılmış kod tam tersini
     * yapardı.
     */
    const hizli = segirmeAkit(misafirKur(), { segirmeSn: 0, hz: 30 });
    const yavas = segirmeAkit(misafirKur(), { segirmeSn: 0, hz: 10 });

    // Taban aralığın 1.5 katı: 30 Hz'de ~0.05, 10 Hz'de ~0.15
    expect(hizli).toBeLessThan(0.06);
    expect(yavas).toBeGreaterThan(0.13);
  });

  it('SIRASI BOZUK paket aralık ölçümünü bozmuyor', () => {
    /*
     * Seğirme paketlerin sırasını bozabiliyor (gerçek ağda da bozuyor).
     * Geriye giden bir damga negatif aralık verirdi; korumasız bir
     * ölçüm bunu ortalamaya katıp tabanı çökertirdi.
     */
    const g = misafirKur();
    segirmeAkit(g, { segirmeSn: 0, paket: 200 });
    const duzgun = g.agPaketAralik;

    // Aynı motora geriye giden damgalar ver
    let saat = 100;
    for (let i = 0; i < 50; i += 1) {
      saat += 1 / 30;
      g.agSaat = () => saat;
      g.agSegirmeOlc(g.agSonPaketZaman - 0.5);
    }
    expect(g.agPaketAralik).toBeCloseTo(duzgun, 3);
    expect(g.agPaketAralik).toBeGreaterThan(0);
  });

  it('KARE HIZI seğirme sanılmıyor', () => {
    /*
     * Bu testin sebebi gerçek bir oyuncunun ekran görüntüsü: telefonu
     * 30 fps çiziyordu ve tampon 170 ms'e çıkmıştı — olması gerekenin
     * üç katı. Ağda bir sorun yoktu.
     *
     * Sebep: seğirme ölçümü istemcinin KARE saatini okuyordu ve o saat
     * yalnız kare başına ilerliyor. 33 ms'lik kareler paket varışlarını
     * kutulara yuvarlıyor, kod bunu ağ seğirmesi sanıp tamponu
     * şişiriyordu. Yani düşük kare hızı gecikmeye dönüşüyordu.
     *
     * Ölçüldü (olcum:kare-hizi, ağ sabit): 30 fps ±%30'da uydurulan
     * seğirme 146 ms → 10 ms, tampon 200 ms → 77 ms.
     */
    const g = misafirKur();
    const rast = uretec();
    const aralik = 1 / 30;

    for (let i = 0; i < 400; i += 1) {
      const zaman = i * aralik;
      /*
       * Paket TAM ZAMANINDA varıyor — ağ kusursuz. Ama istemcinin kare
       * saati düzensiz ve geride: gerçek telefonun hâli bu.
       */
      g.agSaat = () => zaman + 0.5;
      g.time = zaman + 0.5 - (rast() * 0.033);
      g.agSegirmeOlc(zaman);
    }

    /*
     * Kare saatindeki 33 ms'lik düzensizliğe RAĞMEN tampon tabanda
     * kalmalı. Ölçüm kare saatini okusaydı burada 100 ms'i aşardı.
     */
    expect(
      g.agTamponBoyu,
      'kare düzensizliği ağ seğirmesi sanılıyor',
    ).toBeLessThan(0.06);
  });

  it('tampon PAKET YOLUNDAN besleniyor', () => {
    /*
     * Yukarıdaki testler ölçüm fonksiyonunu doğrudan çağırıyor. Bu
     * test onun gerçekten paket alma yoluna BAĞLI olduğunu soruyor;
     * bağlantı kopsa hepsi geçmeye devam ederdi.
     */
    /*
     * Saat burada da elle sürülüyor: `akit` yalnız kare saatini
     * ilerletiyor, ölçümün okuduğu gerçek saati değil.
     */
    let saat = 0;
    const g = misafirKur({ agSaat: () => saat });
    const s = sunucuKur();
    const baslangic = g.agTamponBoyu;
    for (let i = 0; i < 40; i += 1) {
      saat += 6 / 60;
      s.ball.x = 300; s.ball.y = 200; s.ball.vx = 0; s.ball.vy = 0;
      s.adim = 20 + i * 2;
      g.agPaketAl(paketle(s));
      akit(g, 6 / 60); // paket aralığından çok daha yavaş varış = seğirme
    }
    expect(g.agTamponBoyu).not.toBe(baslangic);
    expect(g.agVarisOrt).not.toBeNull();
  });

  it('ÇİZİM SAATİ tampon boyu kadar geride kalıyor', () => {
    /*
     * Tamponun ölçülmesi tek başına bir şey değiştirmez; ekranın
     * çizildiği anı gerçekten o sayının belirlemesi gerekiyor.
     * Sabit 0.1'e geri dönen bir mutasyon burada yakalanır.
     */
    const oku = (boyu) => {
      const g = misafirKur();
      const s = sunucuKur();
      for (let i = 0; i < 12; i += 1) {
        s.ball.x = 300; s.ball.y = 200; s.ball.vx = 0; s.ball.vy = 0;
        s.adim = 20 + i * 2;
        g.agPaketAl(paketle(s));
        g.agTamponBoyu = boyu; // ölçümün üstüne yaz — sınanan şey KULLANIM
        akit(g, 2 / 60);
      }
      const son = g.agTampon[g.agTampon.length - 1].zaman;
      return son - g.agCizimSaati;
    };

    const kucuk = oku(0.04);
    const buyuk = oku(0.16);
    expect(buyuk).toBeGreaterThan(kucuk + 0.08);
  });

  /**
   * Aynı ağda kare hızını değiştirip çizim saatinin geri kalıp
   * kalmadığına bakar.
   *
   * @param {number} kareSuresi Cihazın bir kareyi çizme süresi (sn)
   * @returns {number} `gerilik - tampon` — tamponla AÇIKLANAMAYAN gecikme
   */
  const fazlaGecikme = (kareSuresi) => {
    let saat = 0;
    const g = misafirKur({ agSaat: () => saat });
    const s = sunucuKur();
    let sonrakiPaket = 0;
    const olculen = [];

    // 6 saniye duvar saati — tampon ve çekiş otursun
    for (let kare = 0; kare * kareSuresi < 6; kare += 1) {
      saat = kare * kareSuresi;
      /*
       * Paket akışı DUVAR SAATİNDE, 30 Hz ve seğirmesiz. Ağ her iki
       * çağrıda birebir aynı; değişen tek şey karelerin uzunluğu.
       */
      while (sonrakiPaket <= saat) {
        s.ball.x = 300; s.ball.y = 200; s.ball.vx = 0; s.ball.vy = 0;
        s.adim = Math.round(sonrakiPaket / PHYSICS.step);
        g.agPaketAl(paketle(s));
        sonrakiPaket += 1 / 30;
      }
      g.ilerlet(kareSuresi);
      if (saat > 3) {
        const t = g.agTaniOzeti();
        if (t.gerilik !== null) olculen.push(t.gerilik - t.tampon);
      }
    }
    return olculen.reduce((a, b) => a + b, 0) / olculen.length;
  };

  it('DÜŞÜK KARE HIZI çizim saatini geriletmiyor', () => {
    /*
     * Bir oyuncunun teşhis ekranı: `kare 33 ms · uzun kare %97.6` ve
     * `gerilik 323 ms` — oysa tamponun tavanı 200 ms. Aradaki 120 ms'in
     * kaynağı `PHYSICS.maxCatchUp`: 33.3 ms'yi aşan her karede gerçek
     * zaman atılıyor ve ara değerleme saati o kırpılmış zamanla
     * beslenirse sunucudan yavaş akıyor.
     *
     * Fizik için kırpma DOĞRU (sekmeden dönünce top fileden geçmesin).
     * Çizim saati için karşılıksız gecikme. Bu yüzden ara değerleme
     * sabit adım döngüsünün dışında, kırpılmamış süreyle koşuyor.
     *
     * Mutasyon `ilerlet` içinde `gercekSure` yerine `elapsed` yazmak;
     * ölçülen (tests/olcum/toparlanma.mjs, ağ dört satırda da aynı):
     *   60 fps düzgün     0 ms      30 fps titrek     14 ms
     *   30 fps düzgün    -2 ms      30 fps takılmalı  47 ms (zirve 151)
     */
    const hizli = fazlaGecikme(1 / 60);
    const yavas = fazlaGecikme(1 / 12); // 83 ms kare — kırpmanın 2.5 katı

    /*
     * Eşik ölçülerek kondu. Kırpılmış saatle bu düzenekte fark 60 ms'i
     * aşıyor; doğru hâlde birkaç ms. 25 ms ikisini kesin ayırıyor ve
     * kare başına bir adımlık kuantalama gürültüsüne yer bırakıyor.
     */
    expect(
      Math.abs(yavas - hizli),
      `hızlı ${hizli.toFixed(1)}ms, yavaş ${yavas.toFixed(1)}ms fazla gecikme`,
    ).toBeLessThan(25);
  });

  it('DÜŞÜK KARE HIZI gidiş-dönüşü KÜÇÜK göstermiyor', () => {
    /*
     * Aynı arızanın ikinci yüzü. Girdi damgası `this.time`dan gelirken
     * ölçünün İKİ UCU da kırpılmış saatteydi, yani kare hızı düştükçe
     * gidiş-dönüş KISALIYOR gibi görünüyordu — ağ iyileşmiş gibi.
     *
     * Ölçüldü (ağ dört satırda da 100 ms gidiş-dönüş):
     *   60 fps düzgün → 108 ms      30 fps titrek    →  93 ms
     *   30 fps düzgün →  98 ms      30 fps takılmalı →  79 ms
     *
     * İki zararı vardı: teşhis katmanı oyuncuya yanlış ping gösteriyor,
     * ve aynı ölçüden türeyen `agPencere` topu az ileri sarıyordu —
     * yani top ekranda geride kalıyordu.
     */
    const TEK_YON = 0.05; // sn — enjekte edilen tek yön gecikme

    const olc = (kareSuresi) => {
      let saat = 0;
      const kuyruk = { yukari: [], asagi: [] };
      const yolla = (ad) => (p) => kuyruk[ad].push({
        varis: saat + TEK_YON, veri: JSON.stringify(p),
      });
      const al = (ad) => {
        const c = [];
        while (kuyruk[ad].length && kuyruk[ad][0].varis <= saat) {
          c.push(JSON.parse(kuyruk[ad].shift().veri));
        }
        return c;
      };

      const ortak = {
        mode: '1v1', format: 'single', difficulty: 'normal', playMode: 'vs', bassiz: true,
      };
      const s = new Game(null, { ...ortak, agRol: 'ev', agGonder: yolla('asagi') });
      s.start();
      const g = new Game(null, {
        ...ortak,
        opponentId: s.opponent.id,
        homeIds: [...s.homeIds],
        agRol: 'misafir',
        agYuvam: 'p1',
        agGonder: yolla('yukari'),
        agSaat: () => saat,
      });
      g.start();

      /*
       * SUNUCU her zaman 60 Hz: kırpmadan etkilenen taraf istemci.
       * İstemci kendi kare hızında koşuyor, ikisi de aynı duvar
       * saatinden sürülüyor.
       */
      let sonrakiTik = 0;
      let sonrakiKare = 0;
      for (let n = 0; n * 0.001 < 8; n += 1) {
        saat = n * 0.001;
        if (saat >= sonrakiTik) {
          al('yukari').forEach((p) => s.agPaketAl(p, 'p1'));
          s.ilerlet(PHYSICS.step);
          s.agAkis();
          sonrakiTik += PHYSICS.step;
        }
        if (saat >= sonrakiKare) {
          al('asagi').forEach((p) => g.agPaketAl(p, 'p2'));
          // Girdi DEĞİŞSİN — damga tazelensin, ölçüm yenilensin
          g.inputs.p1.right = Math.floor(saat * 4) % 2 === 0;
          g.ilerlet(kareSuresi);
          g.agAkis();
          sonrakiKare = saat + kareSuresi;
        }
      }
      return g.agGidisDonus();
    };

    const hizli = olc(1 / 60);
    const yavas = olc(1 / 12); // 83 ms kare — kırpmanın 2.5 katı

    /*
     * Yavaş cihazın ölçüsü hızlınınkinden BÜYÜK olabilir (kendi girdisi
     * de kare kadar kuyrukta bekliyor, bu gerçek); KÜÇÜK olamaz. Eşik
     * ölçülerek kondu: kırpılmış saatle yavaş taraf 40 ms'in altına
     * düşüyor, doğru hâlde hızlıya eşit ya da üstünde.
     */
    expect(yavas, `hızlı ${hizli}ms, yavaş ${yavas}ms`).toBeGreaterThan(hizli - 15);
  });
});

describe('durum gönderme sıklığı', () => {
  /*
   * Bu testin sebebi ölçülmüş bir arıza: kapı `this.time - agSonDurum`
   * ile karşılaştırıyordu ve `this.time` sabit adımların toplamı olduğu
   * için kayan nokta artığı biriktiriyordu. 30 Hz ayarında gerçek hız
   * 22.5 Hz'e düşüyor, aralıkların üçte ikisi 2 yerine 3 adım oluyordu.
   *
   * İki ayrı zarar: ayar yalan söylüyordu VE aralık düzensizdi.
   * İkincisi daha sinsi — istemcinin tamponu düzensizliği seğirme
   * sanıp kendini gereksiz yere büyütüyordu, yani "akıcılık" ayarı
   * gecikmeyi artırıyordu.
   */
  it('aralık TAM ve DÜZENLİ — kayan nokta artığı biriktirmiyor', () => {
    const araliklar = [];
    let son = null;
    const g = new Game(null, {
      mode: '1v1', format: 'single', difficulty: 'normal', playMode: 'vs',
      bassiz: true, agRol: 'ev',
      agGonder: () => { if (son !== null) araliklar.push(g.adim - son); son = g.adim; },
    });
    g.start();
    for (let i = 0; i < 600; i += 1) { g.ilerlet(PHYSICS.step); g.agAkis(); }

    expect(araliklar.length).toBeGreaterThan(100);
    // Tek bir farklı aralık bile olmamalı
    expect([...new Set(araliklar)]).toHaveLength(1);

    /*
     * Ve gerçek hız AYARLA uyuşmalı. Sabit sayı yazmıyoruz: sınanan
     * şey "kaç Hz" değil, "ayarın söylediği hız gerçekten çıkıyor mu".
     * Düzelttiğimiz arıza tam olarak buydu — ayar 30 diyordu, gerçek
     * hız 22.5'ti.
     */
    const { durumHz, durumAdim } = agAyarOzeti();
    const hz = araliklar.length / (600 * PHYSICS.step);
    expect(hz).toBeGreaterThan(durumHz - 1);
    expect(hz).toBeLessThan(durumHz + 1);
    // Ve aralık tam olarak ayarın gerektirdiği adım sayısı olmalı
    expect(araliklar[0]).toBe(durumAdim);
  });
});
