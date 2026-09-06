/**
 * RÖVANŞ — iki gerçek tarayıcı, gerçek röle, iki ardışık maç.
 *
 * Çevrimiçi bir maçın en sık istenen devamı "bir daha" ve bunun yolu
 * yoktu: maç biter bitmez soket kapanıyor, oyuncu menüye dönüp baştan
 * rakip arıyordu. Yeni rakip bulmak, az önce oynadığın kişiyle tekrar
 * oynamaktan çok daha uzun.
 *
 * Zincir uzun ve HER HALKASI sessizce kopabilir:
 *   - maç bitince soket kapanıyor olabilir (rövanş imkânsız)
 *   - istek tek taraflı başlatıyor olabilir (rakip hazırlıksız maça girer)
 *   - ikisi de isteyince maç KURULMUYOR olabilir
 *   - yeni maç eski sonucu taşıyor olabilir (skor sıfırlanmaz)
 *
 * Hiçbiri hata vermez; yalnız sistem çalışmaz. Bu dosya o dört sorunun
 * cevabı.
 *
 * MENÜ AKIŞI da burada sınanıyor: HEMEN OYNA kadro ekranını ve lobi
 * seçimini atlayıp doğrudan eşleşmeye gitmeli.
 */

import { baslat } from '../../sunucu/rele.js';
import {
  tarayiciAc, masaustuBaglam, URL, VARSAYILAN_TERCIH, kontrolcu,
} from './yardim.mjs';

const RELE_PORT = 8806;
const rele = await baslat({ port: RELE_PORT, nabiz: 60_000 });
const RELE_URL = `ws://localhost:${RELE_PORT}`;

const kontrol = kontrolcu();
const browser = await tarayiciAc();

async function oyuncuAc(ad) {
  const ctx = await masaustuBaglam(browser, { width: 1280, height: 800 });
  const page = await ctx.newPage();
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(`${ad} PAGEERROR ${String(e).slice(0, 200)}`));
  page.on('console', (m) => {
    if (m.type() === 'error') hatalar.push(`${ad} CONSOLE ${m.text().slice(0, 160)}`);
  });

  await page.goto(`${URL}?rele=${encodeURIComponent(RELE_URL)}`, { waitUntil: 'load' });
  await page.evaluate(
    (t) => localStorage.setItem('retro-voleybol-prefs', JSON.stringify(t)),
    { ...VARSAYILAN_TERCIH, format: 'practice' },
  );
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(900);

  page.hatalar = hatalar;
  return { ctx, page };
}

const durum = (page) => page.evaluate(() => {
  const g = window.__game;
  return g ? { adim: g.adim, faz: g.phase, ev: g.sets?.home, dep: g.sets?.away } : null;
});

const a = await oyuncuAc('A');
const b = await oyuncuAc('B');

// ===================================================================
// 1) HEMEN OYNA — kadro ekranını ve lobi seçimini atlıyor mu?
// ===================================================================
kontrol(
  'menüde HEMEN OYNA en üstte',
  await a.page.evaluate(() => {
    const modlar = [...document.querySelectorAll('button')]
      .map((x) => x.textContent.trim())
      .filter((t) => /HEMEN OYNA|HIZLI MAÇ|ARKADAŞLA OYNA/.test(t));
    return modlar[0]?.startsWith('HEMEN OYNA') ?? false;
  }),
);

await a.page.getByRole('button', { name: /HEMEN OYNA/ }).first().click();
await a.page.waitForTimeout(900);

const aMetin = await a.page.evaluate(() => document.body.innerText);
kontrol(
  'HEMEN OYNA doğrudan eşleşmeye gidiyor (kadro ekranı YOK)',
  !aMetin.includes('KADRONU SEÇ') && /RAKİP ARANIYOR|SIRADA|ARANIYOR/.test(aMetin),
  aMetin.split('\n').slice(0, 2).join(' · '),
);

// İkinci oyuncu da aynı yoldan girsin — eşleşmeliler
await b.page.getByRole('button', { name: /HEMEN OYNA/ }).first().click();
await b.page.waitForTimeout(2500);

const ilkA = await durum(a.page);
const ilkB = await durum(b.page);
kontrol('iki oyuncu EŞLEŞTİ ve maç kuruldu', Boolean(ilkA && ilkB), JSON.stringify({ ilkA, ilkB }));

// ===================================================================
// 1b) Maç içi: rakip adı ve bağlantı göstergesi
// ===================================================================
/*
 * İkisi de sessizce eksik kalabilir: gösterge hiç çıkmaz, skorbordda
 * yapay zekâ takımının adı kalır. Hata vermezler, yalnız bilgi
 * ulaşmaz.
 */
const macMetni = await a.page.evaluate(() => document.body.innerText);
const rakipAdi = await b.page.evaluate(() => {
  const k = JSON.parse(localStorage.getItem('retro-voleybol-kimlik') ?? 'null');
  return k?.ad ?? null;
});
kontrol(
  'skorbordda RAKİBİN TAKMA ADI yazıyor (AI takımı değil)',
  Boolean(rakipAdi) && macMetni.includes(rakipAdi.toUpperCase()),
  `rakip=${rakipAdi}`,
);

const gosterge = await a.page.evaluate(() => {
  const el = [...document.querySelectorAll('div[title]')]
    .find((d) => d.getAttribute('title')?.startsWith('Bağlantı:'));
  return el ? { baslik: el.getAttribute('title'), metin: el.innerText.trim() } : null;
});
kontrol(
  'bağlantı göstergesi çevrimiçi maçta GÖRÜNÜYOR',
  Boolean(gosterge),
  gosterge ? gosterge.baslik : 'gösterge yok',
);
kontrol(
  'gösterge gerçek bir ms değeri yazıyor',
  gosterge ? /^\d+ms$/.test(gosterge.metin) : false,
  gosterge?.metin ?? '',
);

/*
 * DEPLASMANDAKİ oyuncuda etiketler ters olmamalı — ölçerek bulunmuş
 * bir hata. Skorbordun ev etiketi sabit 'TÜRKİYE' idi ve deplasmana
 * düşen oyuncu KENDİ tarafında rakibinin adını görüyordu. Birim testi
 * motoru sınıyor; burada sınanan şey ekrana ne yazıldığı.
 */
const etiketler = async (p) => p.evaluate(() => {
  const g = window.__game;
  const ben = g.players.find((x) => x.controlSlot === g.agYuvam);
  const el = [...document.querySelectorAll('div')]
    .find((d) => d.className.includes('retro-panel') && /SET\s+1/.test(d.innerText));
  return { taraf: ben?.side, rakip: g.agRakipAd, metin: el?.innerText ?? '' };
});

for (const [ad, sayfa] of [['A', a.page], ['B', b.page]]) {
  const e = await etiketler(sayfa);
  const kendiTarafiRakipAdi = e.taraf === 'away'
    // Deplasmandaysam sağdaki (away) etiket BENİM tarafım
    ? e.metin.split('\n').slice(-3).join(' ').includes(e.rakip)
    // Ev sahibiysem soldaki (home) etiket benim tarafım
    : e.metin.split('\n').slice(0, 3).join(' ').includes(e.rakip);
  kontrol(
    `${ad} (${e.taraf}) kendi tarafında RAKİBİNİN adını görmüyor`,
    !kendiTarafiRakipAdi,
    `rakip=${e.rakip}`,
  );
}

// ===================================================================
// 2) Maçı bitir → rövanş düğmesi çıkıyor mu?
// ===================================================================
/*
 * Maçı gerçekten sonuna kadar oynatmak testi dakikalara çıkarırdı.
 * SUNUCUNUN maçını bitiriyoruz — istemciler sonucu ağdan öğrensin,
 * yani zincirin tamamı çalışsın.
 */
const oda = [...rele.defter.odalar.values()][0];
kontrol('röle odası bulundu', Boolean(oda?.mac), oda ? `kod=${oda.kod}` : 'yok');
/*
 * Motorun kendi bitiş yolundan geçiliyor: `emitFinish` sonucu
 * `Mac.bitince`ye, oradan röleye ve iki istemciye taşıyor. Röleye
 * doğrudan sahte bir paket yollasaydık zincirin yarısını atlardık.
 */
oda.mac.oyun.emitFinish('home');
await a.page.waitForTimeout(2500);

const sonucA = await a.page.evaluate(() => document.body.innerText);
kontrol('sonuç ekranı açıldı', /MAÇ BİTTİ|ŞAMPİYON/.test(sonucA));
kontrol('RÖVANŞ düğmesi var', sonucA.includes('RÖVANŞ'), sonucA.includes('RÖVANŞ') ? '' : sonucA.slice(0, 120));

// ===================================================================
// 3) Tek taraflı istek MAÇ BAŞLATMIYOR
// ===================================================================
await a.page.getByRole('button', { name: /RÖVANŞ/ }).first().click();
await a.page.waitForTimeout(1200);

const tekTarafliA = await a.page.evaluate(() => document.body.innerText);
kontrol(
  'tek taraflı istekte maç BAŞLAMIYOR, bekleniyor',
  tekTarafliA.includes('BEKLENİYOR'),
  tekTarafliA.includes('BEKLENİYOR') ? '' : 'beklenen metin yok',
);

const tekTarafliB = await b.page.evaluate(() => document.body.innerText);
/*
 * "RÖVANŞ geçiyor mu" diye sormak YETMİYOR: düğme zaten orada, yani
 * sunucu hiç haber yollamasa da o iddia geçerdi. Mutasyon bunu
 * gösterdi. Asıl soru, karşı tarafın SIRANIN KENDİSİNDE olduğunu
 * öğrenip öğrenmediği — o bilgi yalnızca sunucudan gelebilir.
 */
kontrol(
  'karşı tarafa "rakibin istiyor" haberi gidiyor',
  tekTarafliB.includes('SIRA SENDE'),
  tekTarafliB.includes('SIRA SENDE') ? '' : 'haber ulaşmadı',
);

// ===================================================================
// 4) İkisi de isteyince YENİ MAÇ kuruluyor
// ===================================================================
await b.page.getByRole('button', { name: /RÖVANŞ/ }).first().click();
await b.page.waitForTimeout(3000);

const yeniA = await durum(a.page);
const yeniB = await durum(b.page);
kontrol('rövanş maçı KURULDU', Boolean(yeniA && yeniB), JSON.stringify({ yeniA, yeniB }));

/*
 * Yeni maç GERÇEKTEN yeni: skor sıfırdan başlamalı. Eski durumu
 * taşısaydı oyuncu bitmiş bir maçın içine düşerdi.
 */
kontrol(
  'yeni maçın skoru SIFIRDAN başlıyor',
  yeniA && yeniA.ev === 0 && yeniA.dep === 0,
  JSON.stringify(yeniA),
);

// Ve motor gerçekten dönüyor — donmuş bir maç da "kuruldu" görünürdü
const adim1 = (await durum(a.page))?.adim ?? 0;
await a.page.waitForTimeout(1200);
const adim2 = (await durum(a.page))?.adim ?? 0;
kontrol('rövanş maçında AKIŞ var', adim2 > adim1, `${adim1} → ${adim2}`);

kontrol(
  'konsol hatası yok',
  a.page.hatalar.length === 0 && b.page.hatalar.length === 0,
  [...a.page.hatalar, ...b.page.hatalar].slice(0, 2).join(' | '),
);

await a.ctx.close();
await b.ctx.close();
await browser.close();
await rele.kapat();
kontrol.bitir('RÖVANŞ');
