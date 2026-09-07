import { describe, it, expect } from 'vitest';
import Game from './Game.js';
import { paketle } from './snapshot.js';
import { stepBall } from './ballstep.js';
import { PHYSICS, PLAYER } from './constants.js';

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
    const g = misafirKur();
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
    g.time = 1.2;
    g.agPaketAl(paketYap(1.0, 0), 'p2');
    const ilk = g.agDongu;
    expect(ilk).toBeGreaterThan(0);

    // AYNI damga, ama istemci saati epey ilerledi
    g.time = 1.6;
    g.agPaketAl(paketYap(1.0, 0), 'p2');
    expect(g.agDongu).toBe(ilk);

    // Yeni damga gelince ölçüm yeniden işliyor
    g.time = 1.7;
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
      g.time = zaman + saatFarki + sapma;
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
    for (let i = 0; i < 50; i += 1) {
      g.time += 1 / 30;
      g.agSegirmeOlc(g.agSonPaketZaman - 0.5);
    }
    expect(g.agPaketAralik).toBeCloseTo(duzgun, 3);
    expect(g.agPaketAralik).toBeGreaterThan(0);
  });

  it('tampon PAKET YOLUNDAN besleniyor', () => {
    /*
     * Yukarıdaki testler ölçüm fonksiyonunu doğrudan çağırıyor. Bu
     * test onun gerçekten paket alma yoluna BAĞLI olduğunu soruyor;
     * bağlantı kopsa hepsi geçmeye devam ederdi.
     */
    const g = misafirKur();
    const s = sunucuKur();
    const baslangic = g.agTamponBoyu;
    for (let i = 0; i < 40; i += 1) {
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
     * Ve gerçek hız ayarla uyuşmalı. Aralık sayısını kontrol etmek tek
     * başına yetmez: her karede gönderen bir kod da "düzenli" olurdu.
     */
    const hz = araliklar.length / (600 * PHYSICS.step);
    expect(hz).toBeGreaterThan(29);
    expect(hz).toBeLessThan(31);
  });
});
