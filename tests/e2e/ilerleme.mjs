/**
 * İLERLEME ZİNCİRİ — gerçek tarayıcı, gerçek maç, gerçek depo.
 *
 * Birim testleri `ilerleme.js`'i tek başına sınıyor: kazanç doğru mu,
 * satın alma doğrulanıyor mu. Onların SORAMADIĞI soru şu: bu modül
 * gerçekten oyuna BAĞLI mı?
 *
 * Zincirin kopabileceği yerler saf modülün dışında:
 *   - `App.handleFinish` puanı hiç işlemiyor olabilir
 *   - kazanç `localStorage`a yazılmıyor olabilir (sayfa kapanınca uçar)
 *   - seçim ekranı kilidi hiç uygulamıyor olabilir
 *   - satın alınan oyuncu maça girmiyor olabilir
 *
 * Bu dosyanın tamamı o dört sorunun cevabı. Hepsi sessizce
 * bozulabilecek şeyler: hiçbiri hata vermez, sadece sistem çalışmaz.
 */

import {
  tarayiciAc, masaustuBaglam, sayfaAc, kontrolcu,
} from './yardim.mjs';

const kontrol = kontrolcu();
const browser = await tarayiciAc();
const ctx = await masaustuBaglam(browser, { width: 1280, height: 900 });

/** Depodaki ilerleme kaydı — ekranın değil, KALICI olanın hali. */
const depo = (page) => page.evaluate(
  () => JSON.parse(localStorage.getItem('retro-voleybol-ilerleme') ?? 'null')
);

const page = await sayfaAc(ctx, { format: 'single', difficulty: 'normal' });

// ===================================================================
// 1) Yeni oyuncu: kadro kilitli mi?
// ===================================================================
await page.getByRole('button', { name: /HIZLI MAÇ/ }).first().click();
await page.waitForTimeout(500);

const kilitliKartlar = () => page.evaluate(() =>
  [...document.querySelectorAll('button[aria-label]')]
    .map((b) => b.getAttribute('aria-label'))
    .filter((a) => a.includes('kilitli'))
);

const ilkKilitli = await kilitliKartlar();
kontrol(
  'yeni oyuncuda kadronun çoğu KİLİTLİ',
  ilkKilitli.length >= 10,
  `${ilkKilitli.length} kart kilitli`
);

const baslangicDepo = await depo(page);
kontrol('ilerleme kaydı oluştu', baslangicDepo !== null, JSON.stringify(baslangicDepo));
kontrol('başlangıç bakiyesi sıfır', baslangicDepo?.puan === 0);

// Kilitli bir karta basmak SEÇMEMELİ — yoksa kilidin anlamı kalmaz
const kilitliId = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button[aria-label]')]
    .find((x) => x.getAttribute('aria-label').includes('kilitli'));
  b?.click();
  return b?.getAttribute('aria-label') ?? null;
});
await page.waitForTimeout(300);
const secimSayisi = await page.evaluate(() =>
  document.body.innerText.match(/OYUNCU SEÇ · (\d+)\/(\d+)/)?.slice(1, 3) ?? null
);
kontrol(
  'kilitli karta basmak SEÇMİYOR',
  secimSayisi === null || secimSayisi[0] === '1',
  `${kilitliId} · seçim ${secimSayisi?.join('/')}`
);

// ===================================================================
// 2) Maç oyna → FP kazan
// ===================================================================
await page.getByRole('button', { name: /MAÇA BAŞLA/ }).last().click();
await page.waitForTimeout(2500);

const motorVar = await page.evaluate(() => !!window.__game);
kontrol('maç motoru ayakta', motorVar);

/*
 * Maçı gerçekten 25 sayıya kadar oynatmak testi dakikalara çıkarırdı ve
 * ölçtüğü şey oynanış olurdu — burada ölçülen SONUÇ ZİNCİRİ. O yüzden
 * istatistikler kurulup maç doğrudan bitiriliyor.
 */
await page.evaluate(() => {
  const g = window.__game;
  g.stats.blocks = 4;
  g.stats.saves = 6;
  g.stats.perfects = 9;
  g.sets.home = 1;
  g.emitFinish('home');
});
await page.waitForTimeout(1500);

const macSonrasi = await depo(page);
kontrol(
  'maç FP KAZANDIRDI',
  (macSonrasi?.puan ?? 0) > 0,
  `${baslangicDepo?.puan} → ${macSonrasi?.puan} FP`
);

const panelMetni = await page.evaluate(() => document.body.innerText);
kontrol('sonuç ekranı FP panelini gösteriyor', panelMetni.includes('FORMA PUANI'));
kontrol(
  'kalem dökümü görünüyor',
  panelMetni.includes('GALİBİYET') && panelMetni.includes('PERFORMANS'),
);

/*
 * KALICILIK: kazanç yalnızca React durumunda kalsaydı bu satıra kadar
 * her şey yeşil görünür, oyuncu sekmeyi kapatınca puanı uçardı.
 */
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1200);
const yenilemeSonrasi = await depo(page);
kontrol(
  'FP sayfa yenilemesini ATLATIYOR',
  yenilemeSonrasi?.puan === macSonrasi?.puan,
  `${yenilemeSonrasi?.puan} FP`
);

// ===================================================================
// 3) Oyuncu satın al → kadroya gerçekten katılıyor mu?
// ===================================================================
// Bakiyeyi en ucuz kilide yetecek hale getir; kazanç temposu burada
// ölçülmüyor (onu `tests/olcum/ilerleme.mjs` yapıyor).
await page.evaluate(() => {
  const k = JSON.parse(localStorage.getItem('retro-voleybol-ilerleme'));
  localStorage.setItem('retro-voleybol-ilerleme', JSON.stringify({ ...k, puan: 5000 }));
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1000);

await page.getByRole('button', { name: /HIZLI MAÇ/ }).first().click();
await page.waitForTimeout(500);

// Kilitli bir oyuncuya odaklan, sonra künye kartından satın al
const hedefAd = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button[aria-label]')]
    .find((x) => x.getAttribute('aria-label').includes('kilitli'));
  b?.click();
  return b?.getAttribute('aria-label').split(' — ')[0] ?? null;
});
await page.waitForTimeout(300);

const alDugmesi = page.getByRole('button', { name: /KADROYA KAT/ });
kontrol('açma düğmesi görünür', await alDugmesi.isVisible().catch(() => false), hedefAd);
await alDugmesi.click();
await page.waitForTimeout(500);

const alimSonrasi = await depo(page);
kontrol(
  'satın alma kaydedildi',
  (alimSonrasi?.acilanlar?.length ?? 0) === 1,
  JSON.stringify(alimSonrasi?.acilanlar)
);
kontrol(
  'bakiyeden BEDEL düşüldü',
  (alimSonrasi?.puan ?? 0) < 5000,
  `5000 → ${alimSonrasi?.puan} FP`
);

const kalanKilitli = await kilitliKartlar();
kontrol(
  'açılan oyuncu artık kilitli DEĞİL',
  kalanKilitli.length === ilkKilitli.length - 1,
  `${ilkKilitli.length} → ${kalanKilitli.length}`
);

// Açılan oyuncu gerçekten seçilebiliyor mu — kilidin kalkması yetmez
await page.evaluate((ad) => {
  const b = [...document.querySelectorAll('button[aria-label]')]
    .find((x) => x.getAttribute('aria-label') === ad);
  b?.click();
}, hedefAd);
await page.waitForTimeout(300);
const secili = await page.evaluate(() =>
  [...document.querySelectorAll('button')].some(
    (b) => b.className.includes('border-retro-accent') && b.querySelector('canvas')
  )
);
kontrol('açılan oyuncu SEÇİLEBİLİYOR', secili, hedefAd);

kontrol('konsol hatası yok', page.hatalar.length === 0, page.hatalar.slice(0, 2).join(' | '));

await ctx.close();
await browser.close();
kontrol.bitir('İLERLEME');
