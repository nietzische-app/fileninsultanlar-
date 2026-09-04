import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { baslat } from './rele.js';

/**
 * Röle testleri — gerçek soketlerle.
 *
 * `oda.js` eşleşme mantığını taklit istemcilerle sınıyor; burada
 * sınanan şey tel üzerindeki davranış: mesaj sırası, kopan bağlantının
 * karşı tarafa bildirilmesi, bozuk girdinin sunucuyu düşürmemesi.
 */

let sunucu;

/** Bağlanmış bir istemci; gelen mesajları kuyruğa yazar. */
async function istemci() {
  const soket = new WebSocket(`ws://localhost:${sunucu.port}`);
  const kuyruk = [];
  const bekleyenler = [];

  soket.on('message', (ham) => {
    const mesaj = JSON.parse(ham.toString());
    const bekleyen = bekleyenler.shift();
    if (bekleyen) bekleyen(mesaj);
    else kuyruk.push(mesaj);
  });

  await new Promise((coz, red) => {
    soket.once('open', coz);
    soket.once('error', red);
  });

  return {
    soket,
    yolla: (veri) => soket.send(JSON.stringify(veri)),
    /** Sıradaki mesajı bekler — testler zamanlamaya değil sıraya bakar. */
    al: (ms = 2000) =>
      new Promise((coz, red) => {
        if (kuyruk.length) return coz(kuyruk.shift());
        const zaman = setTimeout(() => red(new Error('mesaj gelmedi')), ms);
        bekleyenler.push((mesaj) => {
          clearTimeout(zaman);
          coz(mesaj);
        });
        return undefined;
      }),
    kapat: () => soket.close(),
  };
}

beforeAll(async () => {
  // Port 0: işletim sistemi boş port seçsin, testler çakışmasın
  sunucu = await baslat({ port: 0, nabiz: 60_000 });
});

afterAll(async () => {
  await sunucu.kapat();
});

describe('röle', () => {
  it('oda açar ve kod döner', async () => {
    const ev = await istemci();
    ev.yolla({ t: 'oda-ac' });
    const cevap = await ev.al();
    expect(cevap.t).toBe('oda');
    expect(cevap.rol).toBe('ev');
    expect(cevap.kod).toHaveLength(4);
    ev.kapat();
  });

  it('iki taraf eşleşmeyi öğrenir', async () => {
    const ev = await istemci();
    ev.yolla({ t: 'oda-ac' });
    const { kod } = await ev.al();

    const misafir = await istemci();
    misafir.yolla({ t: 'oda-gir', kod });

    expect(await misafir.al()).toEqual({ t: 'oda', kod, rol: 'misafir' });
    expect(await misafir.al()).toEqual({ t: 'eslesme', rol: 'misafir' });
    expect(await ev.al()).toEqual({ t: 'eslesme', rol: 'ev' });

    ev.kapat();
    misafir.kapat();
  });

  /** Eşleşmiş bir oda kurar ve iki istemciyi döndürür. */
  async function esliOda() {
    const ev = await istemci();
    ev.yolla({ t: 'oda-ac' });
    const { kod } = await ev.al();
    const misafir = await istemci();
    misafir.yolla({ t: 'oda-gir', kod });
    await misafir.al(); // oda
    await misafir.al(); // eslesme
    await ev.al(); // eslesme
    return { ev, misafir, kod };
  }

  /** Test maçı için asgari ayar. */
  const MAC_AYARI = {
    mode: '1v1',
    homeIds: ['gizem-orge'],
    opponentId: 'atlas',
    format: 'practice',
    difficulty: 'normal',
  };

  it('tanımadığı mesajı karşı tarafa aktarır', async () => {
    const { ev, misafir } = await esliOda();

    // Protokolde olmayan bir mesaj hâlâ ham hâliyle taşınıyor
    ev.yolla({ t: 'selam', veri: 42 });
    expect(await misafir.al()).toEqual({ t: 'selam', veri: 42 });

    ev.kapat();
    misafir.kapat();
  });

  it('sunucu maçı kurar ve iki tarafa da yuvasını bildirir', async () => {
    const { ev, misafir } = await esliOda();
    ev.yolla({ t: 'mac-basla', cfg: MAC_AYARI });

    const evMac = await ev.al();
    const misafirMac = await misafir.al();

    expect(evMac.t).toBe('mac');
    expect(misafirMac.t).toBe('mac');
    // Odayı açan Türkiye'yi, katılan rakip takımı sürer
    expect(evMac.yuva).toBe('p1');
    expect(misafirMac.yuva).toBe('p2');
    // Ayar İKİSİNDE DE aynı olmalı; yoksa farklı kadro çizerler
    expect(evMac.cfg).toEqual(misafirMac.cfg);

    ev.kapat();
    misafir.kapat();
  });

  it('rakip rastgele istense bile iki tarafa aynı takım gider', async () => {
    const { ev, misafir } = await esliOda();
    // opponentId yok: seçimi sunucu yapacak
    ev.yolla({ t: 'mac-basla', cfg: { ...MAC_AYARI, opponentId: undefined } });

    const evMac = await ev.al();
    const misafirMac = await misafir.al();
    expect(evMac.cfg.opponentId).toBeTruthy();
    expect(evMac.cfg.opponentId).toBe(misafirMac.cfg.opponentId);

    ev.kapat();
    misafir.kapat();
  });

  it('maç başlayınca iki tarafa da durum paketi akar', async () => {
    const { ev, misafir } = await esliOda();
    ev.yolla({ t: 'mac-basla', cfg: MAC_AYARI });
    await ev.al(); // mac
    await misafir.al(); // mac

    const evDurum = await ev.al();
    const misafirDurum = await misafir.al();
    expect(evDurum.t).toBe('durum');
    expect(misafirDurum.t).toBe('durum');
    // Simülasyon sunucuda koşuyor: adım ilerlemiş olmalı
    expect(evDurum.n).toBeGreaterThan(0);

    ev.kapat();
    misafir.kapat();
  });

  it('girdi maça gider, karşı tarafa aktarılmaz', async () => {
    const { ev, misafir } = await esliOda();
    ev.yolla({ t: 'mac-basla', cfg: MAC_AYARI });
    await ev.al();
    await misafir.al();

    /*
     * Eski mimaride girdi karşı tarafa (ev sahibine) aktarılıyordu.
     * Artık hakem sunucu: girdi maça yazılıyor ve karşı istemciye HİÇ
     * gitmiyor — gitseydi iki taraf birbirinin tuşlarını da uygulardı.
     */
    misafir.yolla({ t: 'girdi', v: 1, k: { right: true }, b: 1 });

    // Ev sahibine gelen bir sonraki mesaj girdi DEĞİL, durum olmalı
    const gelen = await ev.al();
    expect(gelen.t).toBe('durum');

    ev.kapat();
    misafir.kapat();
  });

  it('maçı yalnızca odayı açan başlatabilir', async () => {
    const { ev, misafir } = await esliOda();
    misafir.yolla({ t: 'mac-basla', cfg: MAC_AYARI });
    expect(await misafir.al()).toEqual({ t: 'hata', sebep: 'yetki-yok' });

    ev.kapat();
    misafir.kapat();
  });

  it('rakip yokken maç başlatılamaz', async () => {
    const ev = await istemci();
    ev.yolla({ t: 'oda-ac' });
    await ev.al();
    ev.yolla({ t: 'mac-basla', cfg: MAC_AYARI });
    expect(await ev.al()).toEqual({ t: 'hata', sebep: 'rakip-yok' });
    ev.kapat();
  });

  it('odası olmayanın oyun mesajı hata döner', async () => {
    const yalniz = await istemci();
    yalniz.yolla({ t: 'durum', adim: 1 });
    expect(await yalniz.al()).toEqual({ t: 'hata', sebep: 'oda-yok' });
    yalniz.kapat();
  });

  it('eşi olmayan odada mesaj kaybolmaz, hata döner', async () => {
    const ev = await istemci();
    ev.yolla({ t: 'oda-ac' });
    await ev.al();
    // Misafir henüz gelmedi — sessizce yutulursa ev sahibi maçı
    // başlattığını sanır
    ev.yolla({ t: 'durum', adim: 1 });
    expect(await ev.al()).toEqual({ t: 'hata', sebep: 'oda-yok' });
    ev.kapat();
  });

  it('olmayan odaya girilemez', async () => {
    const misafir = await istemci();
    misafir.yolla({ t: 'oda-gir', kod: 'ZZZZ' });
    expect(await misafir.al()).toEqual({ t: 'hata', sebep: 'oda-yok' });
    misafir.kapat();
  });

  it('bağlantı kopunca karşı taraf haber alır', async () => {
    const ev = await istemci();
    ev.yolla({ t: 'oda-ac' });
    const { kod } = await ev.al();
    const misafir = await istemci();
    misafir.yolla({ t: 'oda-gir', kod });
    await misafir.al();
    await misafir.al();
    await ev.al();

    misafir.kapat();
    expect(await ev.al()).toEqual({ t: 'ayrildi', kapandi: false });
    ev.kapat();
  });

  it('ev sahibi gidince misafire oda kapandı denir', async () => {
    const ev = await istemci();
    ev.yolla({ t: 'oda-ac' });
    const { kod } = await ev.al();
    const misafir = await istemci();
    misafir.yolla({ t: 'oda-gir', kod });
    await misafir.al();
    await misafir.al();
    await ev.al();

    ev.kapat();
    expect(await misafir.al()).toEqual({ t: 'ayrildi', kapandi: true });
    misafir.kapat();
  });

  it('bozuk mesaj sunucuyu düşürmez', async () => {
    const soket = await istemci();
    soket.soket.send('bu json değil');
    expect(await soket.al()).toEqual({ t: 'hata', sebep: 'bozuk-mesaj' });

    soket.soket.send('"düz metin"');
    expect(await soket.al()).toEqual({ t: 'hata', sebep: 'bozuk-mesaj' });

    // Sunucu hâlâ iş görüyor mu
    soket.yolla({ t: 'oda-ac' });
    expect((await soket.al()).t).toBe('oda');
    soket.kapat();
  });

  it('sağlık ucu açık oda sayısını verir', async () => {
    const ev = await istemci();
    ev.yolla({ t: 'oda-ac' });
    await ev.al();

    const cevap = await fetch(`http://localhost:${sunucu.port}/saglik`);
    expect(cevap.ok).toBe(true);
    const veri = await cevap.json();
    expect(veri.durum).toBe('ayakta');
    expect(veri.oda).toBeGreaterThanOrEqual(1);
    /*
     * Makine kimliği alanı teşhis için: birden fazla makine çalışırsa
     * oda açan ile katılan ayrı süreçlere düşer ve arıza aralıklı
     * görünür. Alan hep bulunmalı, değeri ortama göre değişir.
     */
    expect('makine' in veri).toBe(true);
    ev.kapat();
  });
});

describe('hızlı eşleşme', () => {
  it('ilk giren sırada bekler', async () => {
    const a = await istemci();
    a.yolla({ t: 'hizli-esles', kimlik: { id: 'k1', ad: 'ATEŞLİ SMAÇ' } });

    const cevap = await a.al();
    expect(cevap.t).toBe('sirada');
    expect(cevap.sira).toBe(1);

    a.yolla({ t: 'siradan-cik' });
    await a.al();
    a.kapat();
  });

  it('ikinci giren maçı başlatır ve iki tarafa da yuva gider', async () => {
    const a = await istemci();
    const b = await istemci();

    a.yolla({ t: 'hizli-esles', kimlik: { id: 'k1', ad: 'ATEŞLİ SMAÇ' } });
    expect((await a.al()).t).toBe('sirada');

    b.yolla({ t: 'hizli-esles', kimlik: { id: 'k2', ad: 'ÇELİK BLOK' } });

    const macA = await a.al();
    const macB = await b.al();
    expect(macA.t).toBe('mac');
    expect(macB.t).toBe('mac');
    // Yuvalar AYRI olmalı — ikisi de p1 olsaydı aynı oyuncuyu sürerlerdi
    expect([macA.yuva, macB.yuva].sort()).toEqual(['p1', 'p2']);
    // İki taraf da aynı maçı kurmalı
    expect(macA.cfg.opponentId).toBe(macB.cfg.opponentId);

    a.kapat();
    b.kapat();
  });

  it('her oyuncu KARŞISININ adını görür', async () => {
    const a = await istemci();
    const b = await istemci();

    a.yolla({ t: 'hizli-esles', kimlik: { id: 'k1', ad: 'ATEŞLİ SMAÇ' } });
    await a.al();
    b.yolla({ t: 'hizli-esles', kimlik: { id: 'k2', ad: 'ÇELİK BLOK' } });

    const macA = await a.al();
    const macB = await b.al();
    expect(macA.rakip.ad).toBe('ÇELİK BLOK');
    expect(macB.rakip.ad).toBe('ATEŞLİ SMAÇ');

    a.kapat();
    b.kapat();
  });

  it('uzun ad ve görünmez karakterler sunucuda kırpılır', async () => {
    /*
     * Ad KARŞI OYUNCUNUN ekranında görünüyor: istemcideki kırpma
     * yalnız kolaylık, protokolü konuşan herkes onu atlayabilir.
     */
    const a = await istemci();
    const b = await istemci();

    a.yolla({
      t: 'hizli-esles',
      kimlik: { id: 'x'.repeat(500), ad: `AAAAAAAAAAAAAAAAAAAAAAAA\u0000\u0007` },
    });
    await a.al();
    b.yolla({ t: 'hizli-esles', kimlik: { id: 'k2', ad: 'ÇELİK BLOK' } });

    await a.al();
    const macB = await b.al();
    expect(macB.rakip.ad.length).toBeLessThanOrEqual(12);
    expect([...macB.rakip.ad].every((c) => c.codePointAt(0) >= 0x20)).toBe(true);
    expect(macB.rakip.id.length).toBeLessThanOrEqual(64);

    a.kapat();
    b.kapat();
  });

  it('aynı bağlantı iki kez sıraya giremez', async () => {
    const a = await istemci();
    a.yolla({ t: 'hizli-esles' });
    expect((await a.al()).t).toBe('sirada');

    a.yolla({ t: 'hizli-esles' });
    const cevap = await a.al();
    expect(cevap.t).toBe('hata');
    expect(cevap.sebep).toBe('zaten-sirada');

    a.kapat();
  });

  it('odadayken sıraya girilemez', async () => {
    const a = await istemci();
    a.yolla({ t: 'oda-ac' });
    await a.al();

    a.yolla({ t: 'hizli-esles' });
    const cevap = await a.al();
    expect(cevap.t).toBe('hata');
    expect(cevap.sebep).toBe('zaten-odada');

    a.kapat();
  });

  it('kopan bağlantı sıradan düşer', async () => {
    /*
     * Düşmezse sonraki oyuncu kapanmış bir soketle "eşleşir": maç
     * kurulur, karşı taraf hiç oynamaz ve oyuncu donmuş bir sahaya
     * bakar. Belirtisi teşhis edilemez bir şey olurdu.
     */
    const a = await istemci();
    a.yolla({ t: 'hizli-esles' });
    await a.al();
    expect(sunucu.sira.sayi).toBe(1);

    a.kapat();
    await new Promise((coz) => { setTimeout(coz, 120); });
    expect(sunucu.sira.sayi).toBe(0);
  });

  it('rakip gelmezse "rakip yok" der ama sıradan atmaz', async () => {
    // Kısa bekleme sınırlı ayrı bir sunucu — 20 saniye beklemeyelim
    const kisa = await baslat({ port: 0, nabiz: 60_000, beklemeSiniri: 30 });
    const soket = new WebSocket(`ws://localhost:${kisa.port}`);
    const gelen = [];
    soket.on('message', (ham) => gelen.push(JSON.parse(ham.toString())));
    await new Promise((coz) => soket.once('open', coz));

    soket.send(JSON.stringify({ t: 'hizli-esles' }));
    await new Promise((coz) => { setTimeout(coz, 1300); });

    expect(gelen.some((m) => m.t === 'sirada')).toBe(true);
    expect(gelen.some((m) => m.t === 'rakip-yok')).toBe(true);
    // Uyarı bir kez gelmeli, saniyede bir değil
    expect(gelen.filter((m) => m.t === 'rakip-yok')).toHaveLength(1);
    // Ve oyuncu HÂLÂ sırada — bekleyip gerçek rakip bulabilmeli
    expect(kisa.sira.sayi).toBe(1);

    soket.close();
    await kisa.kapat();
  });
});
