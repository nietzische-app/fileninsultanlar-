/**
 * DAYANIM TESTİ — kötü cihaz + kötü ağ, gerçek tarayıcıda, uzun süre.
 *
 * NEDEN VAR: bu projedeki ağ hatalarının hepsi bir insanın telefonunda
 * bulundu ve hiçbiri masaüstü tarayıcıda görünmüyordu. Kare hızı
 * gecikmeye dönüşüyordu, ping olduğundan küçük görünüyordu — ikisi de
 * 60 fps'te TAM SIFIR etki veriyor. Yani "iki masaüstü açıp oynadım,
 * sorun yok" demek hiçbir şey söylemiyor; haftalarca öyle dedi.
 *
 * Elle sınamanın sorunu tekrarlanabilir olmaması: insanın müsait olması
 * gerekiyor, telefonun o an ne yaptığı bilinmiyor ve bir sonraki koşum
 * öncekiyle karşılaştırılamıyor. Bu test kötü koşulları BİLEREK
 * üretiyor:
 *
 *   · CPU 6 kat kısıtlı bir istemci  → kare düşüren telefonun karşılığı
 *   · gecikme + seğirme + hıçkırık   → gerçek Wi-Fi'nin bozulma biçimi
 *   · gerçek röle, gerçek WebSocket  → taklit değil
 *
 * NE SINIYOR: sayıların KENDİ İÇİNDE tutarlı kalmasını. Mutlak
 * gecikmeyi değil — o ağa bağlı ve burada zaten uydurma. Aranan şey
 * "karşılıksız" gecikme: tamponun açıklamadığı gerilik, kare hızıyla
 * birlikte küçülen ping, kendini durmadan büyüten tampon. Üçü de bu
 * projede gerçekten olmuş arızalar.
 *
 * NE SINAMIYOR, dürüstçe: gerçek cihazın GPU'sunu, ısınmasını, pil
 * tasarrufunu ve gerçek hücresel ağı. CPU kısıtı kare düşmesini taklit
 * ediyor, sebebini değil. Bu test elle sınamanın YERİNE geçmez;
 * GERİLEMEYİ yakalar — yani "bir kez düzelttiğimiz şey tekrar bozuldu
 * mu" sorusunu insan beklemeden cevaplar.
 *
 * Kullanım:
 *   npm run e2e dayanim
 *   SURE=120 npm run e2e dayanim     # daha uzun koşum (sn)
 */

import { baslat } from '../../sunucu/rele.js';
import { vekilKur } from './_gecikmeli-vekil.mjs';
import { agAyarOzeti } from '../../src/game/Game.js';
import {
  tarayiciAc, masaustuBaglam, URL, VARSAYILAN_TERCIH, kontrolcu,
} from './yardim.mjs';

const RELE_PORT = 8819;
/** Koşum süresi (sn). Uzatmak daha çok hıçkırık örneği demek. */
const SURE = Number(process.env.SURE ?? 45);
/** Kısıtlı istemcinin CPU yavaşlatma katsayısı. */
const KISIT = Number(process.env.KISIT ?? 6);
/** Örnekleme aralığı (ms). */
const ORNEK_MS = 250;

const kontrol = kontrolcu();
const rele = await baslat({ port: RELE_PORT, nabiz: 60_000 });
const vekil = await vekilKur({
  hedef: `ws://localhost:${RELE_PORT}`,
  gecikme: 45,
  segirme: 12,
  // Saniyede ~1 hıçkırık: 60 Hz akışta paket başına 1/60 olasılık
  hickirikOran: 1 / 60,
  hickirikMs: 80,
});
const browser = await tarayiciAc();

/**
 * Bir oyuncu açar. Kısıt sonradan, maç ortasında uygulanıyor.
 */
async function oyuncuAc() {
  const ctx = await masaustuBaglam(browser, { width: 1280, height: 800 });
  const page = await ctx.newPage();
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(`PAGEERROR ${String(e).slice(0, 160)}`));
  page.on('console', (m) => {
    if (m.type() === 'error') hatalar.push(`CONSOLE ${m.text().slice(0, 160)}`);
  });

  await page.goto(`${URL}?rele=${encodeURIComponent(vekil.adres)}&tani=1`, { waitUntil: 'load' });
  await page.evaluate(
    (t) => localStorage.setItem('retro-voleybol-prefs', JSON.stringify(t)),
    { ...VARSAYILAN_TERCIH, format: 'practice' },
  );
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(900);

  /*
   * CPU kısıtı CDP üzerinden — Playwright'ın kendi API'sinde yok.
   * Oturum HER istemcide açılıyor ama kısıt sonradan uygulanıyor:
   * asıl deney aynı cihazı kısıt ÖNCESİ ve SONRASI karşılaştırmak.
   */
  page.cdp = await ctx.newCDPSession(page);
  page.hatalar = hatalar;
  return page;
}

const kisitli = await oyuncuAc();
const normal = await oyuncuAc();

await kisitli.getByRole('button', { name: /HEMEN OYNA/ }).first().click();
await kisitli.waitForTimeout(700);
await normal.getByRole('button', { name: /HEMEN OYNA/ }).first().click();
await normal.waitForTimeout(4000);

kontrol('maç kuruldu', await kisitli.evaluate(() => Boolean(window.__game)));
kontrol(
  'vekil trafiği taşıyor',
  vekil.sayac.asagi > 50 && vekil.sayac.yukari > 10,
  `yukarı=${vekil.sayac.yukari} aşağı=${vekil.sayac.asagi}`,
);

/** Motordan tek bir örnek okur. */
const ornekAl = (page) => page.evaluate(() => {
  const g = window.__game;
  const t = g?.agTaniOzeti?.();
  return t && t.gerilik !== null ? t : null;
});

/**
 * Oyuncuyu OYNATIR — sağa sola yürüyüp ara sıra vuruyor.
 *
 * Boş durmak yetmezdi: ileri sarma, çarpışma ve uzlaştırma yolları
 * ancak top hareket edip vuruş olunca çalışıyor. Duran iki istemciyle
 * yapılan bir dayanım testi kodun yarısını hiç çalıştırmaz.
 */
async function oynat(page, tohum) {
  await page.evaluate((t) => {
    const g = window.__game;
    if (!g) return;
    let n = t;
    const rast = () => { n = (n * 1103515245 + 12345) & 0x7fffffff; return n / 0x7fffffff; };
    window.__surucu = setInterval(() => {
      const r = rast();
      g.inputs.p1.left = r < 0.35;
      g.inputs.p1.right = r >= 0.35 && r < 0.7;
      g.inputs.p1.action = r >= 0.85;
      if (r > 0.95) g.actionPresses.p1 += 1;
    }, 180);
  }, tohum);
}

await oynat(kisitli, 12345);
await oynat(normal, 67890);

/**
 * Belirtilen süre boyunca iki istemciden örnek toplar.
 *
 * @param {number} sn Süre
 * @param {object} kova `{ a: [], b: [] }`
 */
async function topla(sn, kova) {
  const bitis = Date.now() + sn * 1000;
  while (Date.now() < bitis) {
    const [x, y] = await Promise.all([ornekAl(kisitli), ornekAl(normal)]);
    if (x) kova.a.push(x);
    if (y) kova.b.push(y);
    await kisitli.waitForTimeout(ORNEK_MS);
  }
}

/*
 * İKİ AŞAMALI DENEY.
 *
 * İlk tasarımda iki AYRI istemci karşılaştırılıyordu ve mutasyon
 * denemesi ele verdi: girdi damgasını bozan sürüm testi GEÇİYORDU.
 * Sebebi, iki istemcinin taban ping'inin zaten farklı olması — arıza
 * kısıtlı istemcinin ping'ini 135'ten 103'e düşürüyordu ama o sayı
 * hâlâ normalinkinin üstündeydi.
 *
 * Doğru deney AYNI cihazı kısıt ÖNCESİ ve SONRASI karşılaştırmak:
 * ağ değişmiyor, yalnız kare hızı değişiyor. Ping o durumda ARTMALI
 * (yavaş cihazın kendi girdisi de kuyrukta bekliyor); DÜŞERSE ölçü
 * kare saatinden okunuyor demektir.
 */
const once = { a: [], b: [] };
const sonra = { a: [], b: [] };

await topla(SURE / 2, once);
await kisitli.cdp.send('Emulation.setCPUThrottlingRate', { rate: KISIT });
await kisitli.waitForTimeout(2500); // ölçüler otursun
await topla(SURE / 2, sonra);

const seri = { kisitli: sonra.a, normal: sonra.b };

await Promise.all([kisitli, normal].map((p) => p.evaluate(() => clearInterval(window.__surucu))));

/** Bir alanın ortalaması / en büyüğü. */
const ort = (dizi, alan) => dizi.reduce((a, s) => a + (s[alan] ?? 0), 0) / Math.max(1, dizi.length);
const enBuyuk = (dizi, alan) => Math.max(...dizi.map((s) => s[alan] ?? 0));
const yuzdelik = (dizi, alan, p) => {
  const s = dizi.map((x) => x[alan] ?? 0).sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0;
};

console.log(`\n${SURE} sn · CPU kısıtı ${KISIT}x · ağ 45 ms ±12, saniyede ~1 hıçkırık`);
console.log(`hıçkırık üretildi: ${vekil.sayac.hickirik}\n`);
console.log('aşama          örnek   kare   çizim  uzun%   ping  seğirme  tampon  gerilik  FAZLA');
console.log('-'.repeat(87));
[['kısıtlı ÖNCE', once.a], ['kısıtlı SONRA', sonra.a],
  ['kontrol önce', once.b], ['kontrol sonra', sonra.b]].forEach(([ad, d]) => {
  if (!d.length) return;
  const fazla = ort(d, 'gerilik') - ort(d, 'tampon');
  console.log(
    `${ad.padEnd(13)} ${String(d.length).padStart(6)} ${ort(d, 'kare').toFixed(0).padStart(6)}ms ${
      ort(d, 'cizim').toFixed(1).padStart(6)}ms ${ort(d, 'uzunKareYuzde').toFixed(0).padStart(5)}% ${
      ort(d, 'ping').toFixed(0).padStart(6)}ms ${ort(d, 'segirme').toFixed(0).padStart(7)}ms ${
      ort(d, 'tampon').toFixed(0).padStart(6)}ms ${ort(d, 'gerilik').toFixed(0).padStart(7)}ms ${
      fazla.toFixed(0).padStart(6)}ms`,
  );
});
console.log('');

kontrol('iki istemci de örnek verdi', seri.kisitli.length > 20 && seri.normal.length > 20,
  `kısıtlı=${seri.kisitli.length} normal=${seri.normal.length}`);

const beklenenAralik = 1000 / agAyarOzeti().durumHz;

[['kısıtlı', seri.kisitli], ['normal', seri.normal]].forEach(([ad, d]) => {
  if (!d.length) return;

  /*
   * ASIL SINAV: gerilik tamponla açıklanabiliyor mu.
   *
   * Tamponun karşılığı var — seğirmeyi yutuyor. Aradaki fark
   * KARŞILIKSIZ gecikme ve bu projede tam olarak orada bir arıza
   * vardı: kırpılmış kare zamanı çizim saatini geriletiyordu, kısıtlı
   * cihazda 47 ms (zirve 151). Sınır geniş çünkü hıçkırıklar da bu
   * farkı anlık büyütüyor; yakalamak istediğimiz şey KALICI kayma.
   */
  const fazla = ort(d, 'gerilik') - ort(d, 'tampon');
  kontrol(
    `[${ad}] gerilik tamponla açıklanıyor`,
    fazla < 40,
    `fazla ${fazla.toFixed(0)} ms (gerilik ${ort(d, 'gerilik').toFixed(0)} · tampon ${ort(d, 'tampon').toFixed(0)})`,
  );

  /*
   * TAMPON KAÇMASIN. Kendini büyüten bir tampon "akıcı ama alakasız"
   * bir oyun üretir; tavana yapışması ağın değil kodun seğirme
   * uydurduğunun işaretiydi (kare saatiyle ölçerken 30 fps'lik telefon
   * 146 ms seğirme icat ediyordu).
   */
  kontrol(
    `[${ad}] tampon tavana yapışmıyor`,
    yuzdelik(d, 'tampon', 0.95) < 190,
    `p95 ${yuzdelik(d, 'tampon', 0.95).toFixed(0)} ms · en büyük ${enBuyuk(d, 'tampon')} ms`,
  );

  /*
   * PAKET ARALIĞI ölçülen değer: röle ile istemci aynı kodda mı.
   */
  kontrol(
    `[${ad}] paket aralığı ${agAyarOzeti().durumHz} Hz ile tutarlı`,
    ort(d, 'paketAralik') < beklenenAralik * 1.6,
    `${ort(d, 'paketAralik').toFixed(0)} ms (beklenen ~${Math.round(beklenenAralik)})`,
  );

  /*
   * AKIŞ KESİLMESİN — uzun koşumda soket sessizce ölmemeli.
   */
  kontrol(
    `[${ad}] akış hiç kesilmedi`,
    enBuyuk(d, 'sessizlik') < 1500,
    `en uzun sessizlik ${enBuyuk(d, 'sessizlik')} ms`,
  );
});

/*
 * VE KISITLI İSTEMCİ, NORMALDEN ÇOK DAHA KÖTÜ OLMAMALI.
 *
 * Bu testin asıl sorusu bu: aynı ağdaki iki istemciden yalnız biri
 * kare düşürüyor. Aradaki gecikme farkı AĞDAN gelmiyorsa koddan
 * geliyordur. Düzeltmeden önce bu fark 47 ms'ydi; sonrasında 0.
 */
if (once.a.length > 10 && sonra.a.length > 10) {
  const fazla = (d) => ort(d, 'gerilik') - ort(d, 'tampon');

  /*
   * ARACIN DOĞRULAMASI: kısıt gerçekten AYNI cihazda kare düşürdü mü.
   */
  kontrol(
    `CPU kısıtı kareyi uzattı (${KISIT}x)`,
    ort(sonra.a, 'kare') > ort(once.a, 'kare') * 1.3,
    `${ort(once.a, 'kare').toFixed(0)}ms → ${ort(sonra.a, 'kare').toFixed(0)}ms`,
  );

  /*
   * 1) KARE HIZI GECİKMEYE DÖNÜŞMÜYOR.
   *
   * Aynı cihaz, aynı ağ; yalnız kareler uzadı. Tamponun açıklamadığı
   * gecikme bundan etkilenmemeli. Düzeltmeden önce bu fark kısıtlı
   * cihazda 47 ms'ye kadar çıkıyordu (zirve 151).
   */
  kontrol(
    'KISIT karşılıksız gecikme ÜRETMİYOR',
    fazla(sonra.a) - fazla(once.a) < 30,
    `fazla ${fazla(once.a).toFixed(0)}ms → ${fazla(sonra.a).toFixed(0)}ms`,
  );

  /*
   * 2) PING, YAVAŞLAYAN CİHAZDA GERÇEKTEN ARTIYOR.
   *
   * Yavaşlayan cihazın gidiş-dönüşü ARTMALI: kendi girdisi de uzayan
   * karede kuyrukta bekliyor. Ölçü kare saatinden okunursa bunun
   * tersi olur — kare hızı düştükçe ağ İYİLEŞMİŞ görünür.
   *
   * ÖLÇÜT FARKIN FARKI, ham yükseliş değil. İlk iki denemem burada
   * başarısız oldu ve mutasyon ikisini de ele verdi:
   *   · "kısıtlı ping > normal ping" — iki istemcinin taban ping'i
   *     zaten farklı; arıza 135'i 103'e düşürdüğünde bile geçiyordu.
   *   · "kısıt sonrası ping düşmesin" — arızalı sürümde de düşmüyor,
   *     yalnız AZ artıyordu (+6 ms; doğrusu +32).
   * Kontrol istemcisinin aynı aradaki değişimi çıkarılınca koşuma özgü
   * kayma (ısınma, makine yükü) da temizleniyor.
   *
   * Ölçüldü: doğru hâlde +31..+37 ms, damga kare saatine bağlıyken
   * +5 ms. 15 ms ikisini kesin ayırıyor.
   */
  const pingArtisi = (ort(sonra.a, 'ping') - ort(once.a, 'ping'))
    - (ort(sonra.b, 'ping') - ort(once.b, 'ping'));
  kontrol(
    'PING yavaşlayan cihazda artıyor (kare saatinden okunmuyor)',
    pingArtisi > 15,
    `kısıtlının artışı ${pingArtisi.toFixed(0)} ms `
    + `(${ort(once.a, 'ping').toFixed(0)}→${ort(sonra.a, 'ping').toFixed(0)}, `
    + `kontrol ${ort(once.b, 'ping').toFixed(0)}→${ort(sonra.b, 'ping').toFixed(0)})`,
  );

  /*
   * 3) KONTROL GRUBU: kısıtlanmayan istemci iki aşamada da aynı
   * kalmalı. Kalmıyorsa değişimin sebebi kısıt değil, koşumun kendisi
   * (ısınma, ağ kayması) — o zaman yukarıdaki iki kontrol de anlamsız.
   */
  kontrol(
    'kontrol istemcisi iki aşamada da KARARLI',
    Math.abs(ort(sonra.b, 'ping') - ort(once.b, 'ping')) < 25
      && Math.abs(fazla(sonra.b) - fazla(once.b)) < 20,
    `ping ${ort(once.b, 'ping').toFixed(0)}→${ort(sonra.b, 'ping').toFixed(0)}ms · `
    + `fazla ${fazla(once.b).toFixed(0)}→${fazla(sonra.b).toFixed(0)}ms`,
  );
}

const tumHatalar = [...kisitli.hatalar, ...normal.hatalar];
kontrol('konsolda hata yok', tumHatalar.length === 0, tumHatalar.slice(0, 3).join(' | '));

await browser.close();
await vekil.kapat();
await rele.kapat?.();
kontrol.bitir('DAYANIM');
