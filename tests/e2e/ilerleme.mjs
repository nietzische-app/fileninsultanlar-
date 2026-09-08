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
 *
 * FP GEÇİCİ OLARAK KAPATILABİLİYOR (`ilerleme.js` → `FP_ACIK`). Bu
 * dosya o anahtara göre İKİ AYRI sınav koşuyor:
 *
 *   açıkken  → aşağıdaki zincirin tamamı
 *   kapalıyken → "gerçekten kapalı mı" sınavı
 *
 * İkincisi gerekli çünkü bir özelliği kapatmanın da kendi arızaları
 * var: kazanç kesilip arayüz kalabilir, arayüz gizlenip kilitler
 * kalabilir (o hâlde kadro sonsuza dek üç kişide donar). Testi silmek
 * ya da atlamak bunların hiçbirini yakalamazdı.
 */

import {
  tarayiciAc, masaustuBaglam, sayfaAc, kontrolcu,
} from './yardim.mjs';
import { FP_ACIK } from '../../src/game/ilerleme.js';

const kontrol = kontrolcu();
const browser = await tarayiciAc();
const ctx = await masaustuBaglam(browser, { width: 1280, height: 900 });

/** Depodaki ilerleme kaydı — ekranın değil, KALICI olanın hali. */
const depo = (page) => page.evaluate(
  () => JSON.parse(localStorage.getItem('retro-voleybol-ilerleme') ?? 'null')
);

const page = await sayfaAc(ctx, { format: 'single', difficulty: 'normal' });

// ===================================================================
// FP KAPALIYKEN: gerçekten her yerden kalkmış mı?
// ===================================================================
if (!FP_ACIK) {
  const metin = () => page.evaluate(() => document.body.innerText);

  kontrol('menüde FP cüzdanı YOK', !(await metin()).includes('FORMA PUANI'));

  await page.getByRole('button', { name: /HIZLI MAÇ/ }).first().click();
  await page.waitForTimeout(600);

  /*
   * KİLİT KALMAMALI. Kazancı kesip kilitleri bırakmak en olası yarım
   * kapatma ve sonucu oyunu bozmak: kadro üç kişide donar, Koleksiyon
   * ulaşılamaz bir vitrine döner.
   */
  const kilitli = await page.evaluate(() =>
    [...document.querySelectorAll('button[aria-label]')]
      .map((b) => b.getAttribute('aria-label'))
      .filter((a) => a.includes('kilitli')));
  kontrol('kadroda KİLİTLİ oyuncu yok', kilitli.length === 0, `${kilitli.length} kilitli kart`);

  kontrol('kadro ekranında FP yazmıyor', !(await metin()).includes(' FP'));

  /*
   * VE KADRO GERÇEKTEN SEÇİLEBİLİR OLMALI. Rozetin kalkması yetmez;
   * asıl soru oyuncunun kadroya girip girmediği.
   */
  const secildi = await page.evaluate(() => {
    const kartlar = [...document.querySelectorAll('button[aria-label]')];
    const son = kartlar[kartlar.length - 1];
    const ad = son?.getAttribute('aria-label');
    son?.click();
    return ad;
  });
  await page.waitForTimeout(400);
  const secimSayisi = await page.evaluate(() =>
    document.body.innerText.match(/\d+\s*\/\s*\d+/)?.[0] ?? '?');
  kontrol('kilitsiz kadrodan oyuncu SEÇİLEBİLİYOR', Boolean(secildi), `${secildi} · ${secimSayisi}`);

  /*
   * Koleksiyon ekranı. Menüye `goBack` ile dönmüştüm ve tarayıcı
   * localStorage'a erişimi olmayan bir belgeye düşüyordu; sayfayı
   * yenilemek hem daha sağlam hem de gerçek bir açılışı taklit ediyor.
   */
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(900);
  const koleksiyon = page.getByRole('button', { name: /KOLEKSİYON/ }).first();
  kontrol('koleksiyon düğmesi duruyor', (await koleksiyon.count()) > 0);
  if (await koleksiyon.count()) {
    await koleksiyon.click();
    await page.waitForTimeout(700);
    const k = await metin();
    const fpGecen = k.split('\n').filter((r) => r.includes(' FP'));
    kontrol('koleksiyonda FP fiyatı yok', fpGecen.length === 0, fpGecen.slice(0, 3).join(' | '));
    kontrol('koleksiyonda "OYUNCU AÇIK" sayacı yok', !k.includes('OYUNCU AÇIK'));
    kontrol('koleksiyonda "AÇ" düğmesi yok',
      (await page.getByRole('button', { name: /^AÇ$/ }).count()) === 0);
  }

  // Depodaki kayıt SİLİNMEMELİ — geri açınca kaldığı yerden devam etsin
  const kayit = await depo(page);
  kontrol(
    'kayıtlı ilerleme SİLİNMEDİ (geri açılabilir)',
    kayit === null || typeof kayit.puan === 'number',
    JSON.stringify(kayit),
  );

  await browser.close();
  kontrol.bitir('İLERLEME — FP KAPALI');
  process.exit(kontrol.durum.hata === 0 ? 0 : 1);
}


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
// 2b) Eşik haberi — "yeni oyuncu açabilirsin"
// ===================================================================
/*
 * Bakiye tek başına bir sayı; oyuncu ne anlama geldiğini bilmiyor.
 * Asıl haber, kazancın bir EŞİĞİ geçmiş olması. Bunu sınamak için
 * bakiyeyi en ucuz kilidin hemen ALTINA kurup bir maç daha oynuyoruz.
 */
const enUcuz = 150;
await page.evaluate((alt) => {
  const k = JSON.parse(localStorage.getItem('retro-voleybol-ilerleme'));
  localStorage.setItem('retro-voleybol-ilerleme', JSON.stringify({ ...k, puan: alt }));
}, enUcuz - 30);
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1000);

await page.getByRole('button', { name: /HIZLI MAÇ/ }).first().click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: /MAÇA BAŞLA/ }).last().click();
await page.waitForTimeout(2500);
await page.evaluate(() => {
  const g = window.__game;
  g.sets.home = 1;
  g.emitFinish('home');
});
await page.waitForTimeout(1500);

const esikMetni = await page.evaluate(() => document.body.innerText);
kontrol(
  'eşik geçilince "YENİ OYUNCU AÇABİLİRSİN" çıkıyor',
  esikMetni.includes('YENİ OYUNCU AÇABİLİRSİN'),
  `bakiye ${(await depo(page))?.puan} FP`,
);

/*
 * Ve TEKRAR ETMİYOR. Bakiyesi zaten yetenleri her maç sonunda
 * duyurmak uyarıyı gürültüye çevirirdi; ikinci maçta aynı cümle
 * çıkmamalı çünkü yeni bir eşik geçilmedi.
 */
await page.getByRole('button', { name: /TEKRAR OYNA/ }).first().click();
await page.waitForTimeout(2500);
await page.evaluate(() => {
  const g = window.__game;
  g.sets.home = 1;
  g.emitFinish('home');
});
await page.waitForTimeout(1500);
const ikinciMetin = await page.evaluate(() => document.body.innerText);
/*
 * İki iddia birlikte: panel VAR ama eşik kutusu YOK. Yalnız ikincisini
 * sorsaydık, sonuç ekranı hiç açılmasa bile test geçerdi — yani asıl
 * sorusunu hiç sormamış olurdu.
 */
kontrol(
  'ikinci maçta FP paneli yine var (ekran açıldı)',
  ikinciMetin.includes('FORMA PUANI'),
);
kontrol(
  'aynı eşik İKİNCİ maçta tekrar duyurulmuyor',
  !ikinciMetin.includes('YENİ OYUNCU AÇABİLİRSİN'),
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

// Satın alma anı görünür bir şey yapıyor mu
const alimMetni = await page.evaluate(() => document.body.innerText);
kontrol('satın alma KUTLANIYOR', alimMetni.includes('KADRONA KATILDI'), hedefAd);

/*
 * Ve alınan oyuncu kadroya GİRİYOR. Satın alıp ayrıca seçmek
 * gerekseydi oyuncu çoğu zaman eski kadrosuyla maça başlar, aldığı
 * oyuncuyu ilk maçta hiç oynayamazdı.
 */
const kadroda = await page.evaluate((ad) => {
  const b = [...document.querySelectorAll('button[aria-label]')]
    .find((x) => x.getAttribute('aria-label') === ad);
  // Seçili kartlar sıra numarası rozeti taşıyor
  return Boolean(b && b.className.includes('border-retro-accent'));
}, hedefAd);
kontrol('alınan oyuncu KADROYA da katıldı', kadroda, hedefAd);

// ===================================================================
// 4) Koleksiyon ekranı
// ===================================================================
await page.getByRole('button', { name: /← GERİ/ }).first().click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /KOLEKSİYON/ }).first().click();
await page.waitForTimeout(600);

const kol = await page.evaluate(() => document.body.innerText);
kontrol('koleksiyon ekranı açılıyor', kol.includes('KOLEKSİYON'));

/*
 * Sayaç KADRONUN TAMAMINI kapsamalı. Bir kademe unutulsa ekran
 * sorunsuz çizilir ve yalnız sayı yanlış olur — gözle yakalanmaz.
 */
const sayac = kol.match(/(\d+)\s*\/\s*(\d+)\s*OYUNCU AÇIK/);
kontrol(
  'sayaç kadronun tamamını kapsıyor',
  sayac && Number(sayac[2]) === 17,
  sayac ? `${sayac[1]}/${sayac[2]}` : 'okunamadı',
);
kontrol(
  'açık sayısı satın almayı yansıtıyor',
  sayac && Number(sayac[1]) === 4,   // 3 başlangıç + 1 satın alınan
  sayac ? sayac[1] : '?',
);

/*
 * Her oyuncu ekranda TAM BİR KEZ. Kademe listeleri çakışsa bir oyuncu
 * iki kez görünür; bir kademe düşse hiç görünmez.
 */
const kartSayisi = await page.evaluate(() => {
  const idler = [...document.querySelectorAll('[data-oyuncu]')]
    .map((e) => e.getAttribute('data-oyuncu'));
  return { toplam: idler.length, benzersiz: new Set(idler).size };
});
kontrol(
  'her oyuncu koleksiyonda TEK KEZ ve kadronun tamamı var',
  kartSayisi.toplam === 17 && kartSayisi.benzersiz === 17,
  JSON.stringify(kartSayisi),
);

// Kilitli oyuncunun BONUSU görünüyor mu — "neyi kaçırıyorum" sorusu
kontrol(
  'kilitli oyuncunun yeteneği gizlenmiyor',
  kol.includes('ÇAPRAZ PLASE') || kol.includes('SERİ REFLEKS'),
);

// Koleksiyondan satın alma
const acDugmesi = page.getByRole('button', { name: /^AÇ$/ }).first();
const acVar = await acDugmesi.isVisible().catch(() => false);
kontrol('koleksiyondan satın alma düğmesi var', acVar);
if (acVar) {
  const once = (await depo(page))?.acilanlar?.length ?? 0;
  await acDugmesi.click();
  await page.waitForTimeout(600);
  const sonra = (await depo(page))?.acilanlar?.length ?? 0;
  kontrol('koleksiyondan satın alma İŞLİYOR', sonra === once + 1, `${once} → ${sonra}`);
}

kontrol('konsol hatası yok', page.hatalar.length === 0, page.hatalar.slice(0, 2).join(' | '));

await ctx.close();
await browser.close();
kontrol.bitir('İLERLEME');
