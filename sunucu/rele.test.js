import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { baslat } from './rele.js';

/**
 * Röle testleri — gerçek soketlerle.
 *
 * `oda.js` eşleşme mantığını taklit istemcilerle sınıyor; burada
 * sınanan şey tel üzerindeki davranış: mesaj sırası, kopan bağlantının
 * karşı tarafa bildirilmesi, bozuk girdinin sunucuyu düşürmemesi.
 */

let sunucu;
/*
 * Veri dizini GEÇİCİ. Verilmezse depo `./veri` altına yazıyor ve
 * testler depoyu kirletiyor — ilk koşumda tam bu oldu, çalışma
 * ağacında bir `veri/oyuncular.jsonl` belirdi.
 */
let veriDizini;

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


/** Sunucudan kimlik alır — adım 4'ten sonra kimliği sunucu veriyor. */
async function kimlikAl(k, ad) {
  k.yolla({ t: 'kimlik', ad });
  const cevap = await k.al();
  return cevap;
}

beforeAll(async () => {
  // Port 0: işletim sistemi boş port seçsin, testler çakışmasın
  veriDizini = mkdtempSync(join(tmpdir(), 'rele-veri-'));
  sunucu = await baslat({ port: 0, nabiz: 60_000, veriDizini });
});

afterAll(async () => {
  await sunucu.kapat();
  rmSync(veriDizini, { recursive: true, force: true });
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

    await kimlikAl(a, 'ATEŞLİ SMAÇ');
    await kimlikAl(b, 'ÇELİK BLOK');

    a.yolla({ t: 'hizli-esles' });
    await a.al();
    b.yolla({ t: 'hizli-esles' });

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

    await kimlikAl(a, `AAAAAAAAAAAAAAAAAAAAAAAA\u0000\u0007`);
    await kimlikAl(b, 'ÇELİK BLOK');

    a.yolla({ t: 'hizli-esles' });
    await a.al();
    b.yolla({ t: 'hizli-esles' });

    await a.al();
    const macB = await b.al();
    expect(macB.rakip.ad.length).toBeLessThanOrEqual(12);
    expect([...macB.rakip.ad].every((c) => c.codePointAt(0) >= 0x20)).toBe(true);

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
    const kisa = await baslat({
      port: 0, nabiz: 60_000, beklemeSiniri: 30, veriDizini,
    });
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

describe('kimlik ve skor tablosu', () => {
  it('sunucu kimlik ve gizli anahtar veriyor', async () => {
    const a = await istemci();
    const kimlik = await kimlikAl(a, 'ATEŞLİ SMAÇ');

    expect(kimlik.t).toBe('kimlik');
    expect(kimlik.id).toBeTruthy();
    expect(kimlik.gizli).toBeTruthy();
    expect(kimlik.ad).toBe('ATEŞLİ SMAÇ');
    expect(kimlik.ben.puan).toBe(1000);
    a.kapat();
  });

  it('anahtarla dönen oyuncu AYNI kimliği alıyor', async () => {
    const a = await istemci();
    const ilk = await kimlikAl(a, 'DÖNEN');
    a.kapat();

    const b = await istemci();
    b.yolla({ t: 'kimlik', id: ilk.id, gizli: ilk.gizli, ad: 'DÖNEN' });
    const ikinci = await b.al();

    expect(ikinci.id).toBe(ilk.id);
    // Anahtar zaten onda; yeniden yollanmıyor
    expect(ikinci.gizli).toBeUndefined();
    b.kapat();
  });

  it('YANLIŞ anahtarla başkasının kimliği ELE GEÇİRİLEMİYOR', async () => {
    /*
     * Adım 3'te kimliği istemci üretiyordu ve skor tablosu yokken
     * zararsızdı. Tablo gelince aynı tasarım "başkasının kimliğini
     * yaz, puanını al" demeye dönüşüyordu.
     */
    const a = await istemci();
    const kurban = await kimlikAl(a, 'KURBAN');
    a.kapat();

    const saldirgan = await istemci();
    saldirgan.yolla({ t: 'kimlik', id: kurban.id, gizli: 'tahmin', ad: 'SALDIRGAN' });
    const cevap = await saldirgan.al();

    expect(cevap.id).not.toBe(kurban.id);
    // Kurbanın adı da değişmemiş olmalı
    expect(cevap.ad).toBe('SALDIRGAN');
    saldirgan.kapat();
  });

  it('ad değişikliği anahtarı korur', async () => {
    const a = await istemci();
    const ilk = await kimlikAl(a, 'ESKİ AD');
    a.yolla({ t: 'kimlik', id: ilk.id, gizli: ilk.gizli, ad: 'YENİ AD' });
    const ikinci = await a.al();

    expect(ikinci.id).toBe(ilk.id);
    expect(ikinci.ad).toBe('YENİ AD');
    a.kapat();
  });

  it('sıralama gizli anahtar ya da özet SIZDIRMIYOR', async () => {
    const a = await istemci();
    const kimlik = await kimlikAl(a, 'GİZLİLİK');
    a.yolla({ t: 'siralama' });
    const cevap = await a.al();

    const metin = JSON.stringify(cevap);
    expect(metin).not.toContain(kimlik.gizli);
    expect(metin).not.toContain('ozet');
    expect(Array.isArray(cevap.liste)).toBe(true);
    a.kapat();
  });

  it('istemci "kazandım" diyerek puan alamıyor', async () => {
    /*
     * Skor tablosunun tek dayanağı bu: sonucu SUNUCU koyuyor, çünkü
     * maçı sunucu koşturuyor. İstemcinin uydurabileceği bir "sonuç
     * bildir" mesajı yok — olmadığını sınıyoruz.
     */
    const a = await istemci();
    const kimlik = await kimlikAl(a, 'HİLECİ');

    a.yolla({ t: 'sonuc', kazandim: true, puan: 9999 });
    a.yolla({ t: 'puan', ben: { puan: 9999 } });
    // Sunucunun bunları yok saydığını görmek için durumu geri sor
    a.yolla({ t: 'siralama' });
    let cevap = await a.al();
    while (cevap.t !== 'siralama') cevap = await a.al();

    expect(cevap.ben.puan).toBe(1000);
    expect(cevap.ben.mac).toBe(0);
    expect(kimlik.ben.puan).toBe(1000);
    a.kapat();
  });

  it('maçı SUNUCU bitirince puanlar işleniyor', async () => {
    /*
     * Üstteki test yalnız "şu mesaj adları bir işe yaramıyor" diyor —
     * zayıf bir iddia. Asıl kanıt bu: gerçek bir hızlı eşleşme maçı
     * kuruluyor ve motorun kendi bitiş yolu tetikleniyor. Puanı yazan
     * el, maçı koşturan elin ta kendisi.
     */
    const a = await istemci();
    const b = await istemci();
    const kimlikA = await kimlikAl(a, 'KAZANAN');
    const kimlikB = await kimlikAl(b, 'KAYBEDEN');

    a.yolla({ t: 'hizli-esles' });
    await a.al();
    b.yolla({ t: 'hizli-esles' });
    const macA = await a.al();
    await b.al();

    // Odayı bul ve motorun kendi bitiş yolunu tetikle
    const oda = [...sunucu.defter.odalar.values()].find((o) => o.mac);
    expect(oda).toBeTruthy();
    // p1 ev sahibi tarafını sürüyor: 'home' kazanınca p1 kazanır
    oda.mac.oyun.emitFinish('home');

    // p1 hangi soketse o kazanmış olmalı
    const p1Kimlik = macA.yuva === 'p1' ? kimlikA : kimlikB;
    const p2Kimlik = macA.yuva === 'p1' ? kimlikB : kimlikA;

    const okuA = macA.yuva === 'p1' ? a : b;
    const okuB = macA.yuva === 'p1' ? b : a;

    let puanP1 = await okuA.al();
    while (puanP1.t !== 'puan') puanP1 = await okuA.al();
    let puanP2 = await okuB.al();
    while (puanP2.t !== 'puan') puanP2 = await okuB.al();

    expect(puanP1.ben.galibiyet).toBe(1);
    expect(puanP1.ben.puan).toBeGreaterThan(1000);
    expect(puanP1.degisim).toBeGreaterThan(0);
    expect(puanP2.ben.maglubiyet).toBe(1);
    expect(puanP2.ben.puan).toBeLessThan(1000);
    expect(puanP2.degisim).toBeLessThan(0);

    // Ve tablo bunu gösteriyor
    okuA.yolla({ t: 'siralama' });
    let tablo = await okuA.al();
    while (tablo.t !== 'siralama') tablo = await okuA.al();
    expect(tablo.liste[0].id).toBe(p1Kimlik.id);
    expect(tablo.liste.map((k) => k.id)).toContain(p2Kimlik.id);

    a.kapat();
    b.kapat();
  });

  it('arkadaş maçı tabloya YAZILMIYOR', async () => {
    /*
     * Arkadaş maçında ayarları odayı açan seçiyor (kadro, zorluk,
     * format). Tabloya yazsaydık sıralama ayarlanabilir olurdu:
     * "en kolay rakip, en kısa format" seçip puan toplamak.
     */
    const ev = await istemci();
    const mis = await istemci();
    const kimlikEv = await kimlikAl(ev, 'EV SAHİBİ');
    await kimlikAl(mis, 'KATILAN');

    ev.yolla({ t: 'oda-ac' });
    const oda1 = await ev.al();
    mis.yolla({ t: 'oda-gir', kod: oda1.kod });
    await mis.al();
    await mis.al();
    await ev.al();

    ev.yolla({ t: 'mac-basla', cfg: { mode: '1v1', format: 'single' } });
    await ev.al();
    await mis.al();

    const oda = sunucu.defter.odalar.get(oda1.kod);
    oda.mac.oyun.emitFinish('home');

    ev.yolla({ t: 'siralama' });
    let tablo = await ev.al();
    while (tablo.t !== 'siralama') tablo = await ev.al();

    const bizim = tablo.liste.find((k) => k.id === kimlikEv.id);
    expect(bizim).toBeUndefined();
    expect(tablo.ben.mac).toBe(0);

    ev.kapat();
    mis.kapat();
  });

  it('sağlık ucu oyuncu sayısını veriyor', async () => {
    const a = await istemci();
    await kimlikAl(a, 'SAYIM');

    const veri = await (await fetch(`http://localhost:${sunucu.port}/saglik`)).json();
    expect(veri.oyuncu).toBeGreaterThanOrEqual(1);
    a.kapat();
  });
});
