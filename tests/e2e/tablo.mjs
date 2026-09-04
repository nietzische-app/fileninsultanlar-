/**
 * SKOR TABLOSU — iki gerçek tarayıcı, gerçek röle, gerçek maç sonucu.
 *
 * Birim testleri depoyu ve puanlamayı ayrı ayrı sınıyor; röle testleri
 * protokolü. Burada sınanan şey onların kapsamadığı zincir: lobide
 * kimlik alınıyor mu, maç bitince tablo GERÇEKTEN değişiyor mu, ve
 * oyuncu kendi satırını ekranda görebiliyor mu.
 *
 * Ayrıca bir iddia daha var ve ancak burada sınanabiliyor: kimliğin
 * KALICI olması. Sayfa yenilendiğinde aynı oyuncu olarak dönmezsen
 * puan hiç birikmez ve tablo hep boş kalır.
 */

import { baslat } from '../../sunucu/rele.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  tarayiciAc, masaustuBaglam, URL, VARSAYILAN_TERCIH, kontrolcu,
} from './yardim.mjs';

const RELE_PORT = 8803;
const veriDizini = mkdtempSync(join(tmpdir(), 'tablo-e2e-'));
const rele = await baslat({ port: RELE_PORT, nabiz: 60_000, veriDizini });
const RELE_URL = `ws://localhost:${RELE_PORT}`;

const kontrol = kontrolcu();
const browser = await tarayiciAc();

async function oyuncuAc(ad, { takmaAd = null } = {}) {
  const ctx = await masaustuBaglam(browser, { width: 1280, height: 720 });
  const page = await ctx.newPage();
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(`${ad} PAGEERROR ${String(e).slice(0, 200)}`));
  page.on('console', (m) => {
    if (m.type() === 'error') hatalar.push(`${ad} CONSOLE ${m.text().slice(0, 160)}`);
  });

  await page.goto(`${URL}?rele=${encodeURIComponent(RELE_URL)}`, { waitUntil: 'load' });
  await page.evaluate(
    ([t, kimlikAd]) => {
      localStorage.setItem('filenin-sultanlari-prefs', JSON.stringify(t));
      if (kimlikAd) {
        localStorage.setItem('filenin-sultanlari-kimlik', JSON.stringify({ ad: kimlikAd }));
      }
    },
    [{ ...VARSAYILAN_TERCIH, format: 'practice' }, takmaAd],
  );
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1000);

  page.hatalar = hatalar;
  return { ctx, page };
}

async function lobiyeGit(page) {
  await page.getByRole('button', { name: /ÇEVRİMİÇİ/ }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /ODA KUR/ }).last().click();
  await page.waitForTimeout(600);
}

/** Tarayıcıda saklanan kimlik. */
function yerelKimlik(page) {
  return page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('filenin-sultanlari-kimlik') ?? 'null');
    } catch {
      return null;
    }
  });
}

console.log('═══ skor tablosu');

// ---------------------------------------------------------------
// 1) Kimliği sunucu veriyor ve tarayıcıda kalıyor
// ---------------------------------------------------------------
/*
 * Takma adlar bilerek NÖTR: kim kazanacağını yazı-tura belirliyor
 * (hangi tarayıcı p1 olacak). "KAZANAN"/"KAYBEDEN" yazsaydık test
 * çıktısı yarı yarıya yanıltıcı olurdu.
 */
const a = await oyuncuAc('A', { takmaAd: 'OYUNCU BİR' });
await lobiyeGit(a.page);

kontrol(
  'ilk açılışta kimlik YOK — istemci kendi üretmiyor',
  (await yerelKimlik(a.page))?.id == null,
);

await a.page.getByRole('button', { name: /SKOR TABLOSU/ }).click();
await a.page.waitForTimeout(1200);

const kimlikA = await yerelKimlik(a.page);
kontrol('sunucu kimlik verdi', Boolean(kimlikA?.id), `id=${kimlikA?.id?.slice(0, 8)}…`);
kontrol('gizli anahtar saklandı', Boolean(kimlikA?.gizli));
/*
 * Metin `upper()` ile Türkçe büyük harfe çevriliyor ve JS'in `/i`
 * bayrağı Türkçe'yi bilmiyor: 'İ' (U+0130) ile 'i' BİRBİRİNE
 * eşleşmiyor. İlk hâlde /Henüz kimse maç oynamamış/i yazmıştım ve
 * ekranda yazı dururken kontrol düşüyordu. Ekranda ne varsa onu ara.
 */
kontrol(
  'tablo boşken bunu söylüyor',
  (await a.page.getByText('HENÜZ KİMSE MAÇ OYNAMAMIŞ', { exact: false }).count()) > 0,
);

// Sayfa yenilenince aynı kimlikle dönmeli — yoksa puan hiç birikmez
await a.page.reload({ waitUntil: 'load' });
await a.page.waitForTimeout(900);
kontrol(
  'sayfa yenilenince kimlik korunuyor',
  (await yerelKimlik(a.page))?.id === kimlikA.id,
);

// ---------------------------------------------------------------
// 2) Gerçek maç → tablo değişiyor
// ---------------------------------------------------------------
const b = await oyuncuAc('B', { takmaAd: 'OYUNCU İKİ' });

await lobiyeGit(a.page);
await a.page.getByRole('button', { name: /HIZLI EŞLEŞ/ }).click();
await a.page.waitForTimeout(800);

await lobiyeGit(b.page);
await b.page.getByRole('button', { name: /HIZLI EŞLEŞ/ }).click();
await a.page.waitForTimeout(2500);

const macKuruldu = await a.page.evaluate(() => Boolean(window.__game));
kontrol('maç kuruldu', macKuruldu);

/*
 * Maçı gerçekten 25 sayıya kadar oynatmak testi dakikalarca sürdürürdü.
 * Bunun yerine SUNUCUDAKİ motorun kendi bitiş yolu tetikleniyor —
 * puanı yazan zincir (motor → Mac → rele → depo) aynen çalışıyor,
 * yalnız voleybol atlanıyor.
 */
/*
 * Yuva maç BİTMEDEN okunuyor: maç bitince MatchScreen sonuç ekranına
 * geçiyor ve `window.__game` yok oluyor. İlk hâlde bitişten sonra
 * okuyup `undefined` almıştım.
 */
const yuvaA = await a.page.evaluate(() => window.__game?.agYuvam);
kontrol('yuva okunabildi', Boolean(yuvaA), `yuva=${yuvaA}`);

const oda = [...rele.defter.odalar.values()].find((o) => o.mac);
kontrol('sunucuda maç koşuyor', Boolean(oda?.mac));
oda.mac.oyun.emitFinish('home');
await a.page.waitForTimeout(1500);

// p1 ev sahibi tarafını sürüyor: 'home' kazanınca p1 kazanır
const kazananSayfa = yuvaA === 'p1' ? a : b;
const kaybedenSayfa = yuvaA === 'p1' ? b : a;

// ---------------------------------------------------------------
// 3) Puan değişimi SONUÇ EKRANINDA görünüyor
// ---------------------------------------------------------------
/*
 * Bu kontrol bir yarışı bekçiliyor. Sunucu `bitis` ile `puan`
 * mesajlarını arka arkaya yolluyor; istemci `bitis`i alınca maç
 * bitiyor ve App SOKETİ KAPATIYOR. İlk yazılışta `puan` sonra
 * yollanıyordu ve yarı yolda kalıyordu — belirtisi "puanım
 * değişmedi" olurdu, oysa sunucuda değişmişti. Şimdi sunucu önce
 * puanı yolluyor (bkz. sunucu/mac.js).
 */
const puanPaneli = await kazananSayfa.page.getByText('ÇEVRİMİÇİ PUAN').count();
kontrol('sonuç ekranında puan paneli var', puanPaneli > 0);

const panelMetni = await kazananSayfa.page
  .locator('div', { hasText: /ÇEVRİMİÇİ PUAN/ })
  .last()
  .textContent();
kontrol(
  'kazananın puan artışı gösteriliyor',
  /\+\d+/.test(panelMetni ?? ''),
  panelMetni?.replace(/\s+/g, ' ').trim().slice(0, 60),
);

// ---------------------------------------------------------------
// 4) Tablo ekranda doğru görünüyor
// ---------------------------------------------------------------
await kazananSayfa.page.goto(`${URL}?rele=${encodeURIComponent(RELE_URL)}`, { waitUntil: 'load' });
await kazananSayfa.page.waitForTimeout(900);
await lobiyeGit(kazananSayfa.page);
await kazananSayfa.page.getByRole('button', { name: /SKOR TABLOSU/ }).click();
await kazananSayfa.page.waitForTimeout(1200);

const satirlar = await kazananSayfa.page.locator('ol li').allTextContents();
kontrol('tabloda iki oyuncu var', satirlar.length === 2, `satır=${satirlar.length}`);
kontrol(
  'kazanan birinci sırada',
  /1\./.test(satirlar[0] ?? '') && /1G/.test(satirlar[0] ?? ''),
  satirlar[0]?.replace(/\s+/g, ' ').trim(),
);
kontrol(
  'kaybeden ikinci sırada',
  /1M/.test(satirlar[1] ?? ''),
  satirlar[1]?.replace(/\s+/g, ' ').trim(),
);

// Puanlar 1000'den ayrılmış olmalı — kazanan üstte, kaybeden altta
const puanlar = satirlar.map((s) => Number(s.match(/(\d{3,4})\s*$/)?.[1] ?? 0));
kontrol(
  'kazananın puanı 1000 üstünde, kaybedenin altında',
  puanlar[0] > 1000 && puanlar[1] < 1000,
  `${puanlar[0]} / ${puanlar[1]}`,
);

/*
 * Kaybeden de menüye DÖNDÜRÜLÜYOR: maç bitince sonuç ekranında
 * kalıyor ve orada "ÇEVRİMİÇİ" düğmesi yok. İlk hâlde doğrudan
 * lobiye gitmeye çalışıp 30 saniye beklemiştim.
 */
await kaybedenSayfa.page.goto(`${URL}?rele=${encodeURIComponent(RELE_URL)}`, {
  waitUntil: 'load',
});
await kaybedenSayfa.page.waitForTimeout(900);
await lobiyeGit(kaybedenSayfa.page);
await kaybedenSayfa.page.getByRole('button', { name: /SKOR TABLOSU/ }).click();
await kaybedenSayfa.page.waitForTimeout(1200);
const kaybedenSatir = await kaybedenSayfa.page.locator('ol li').allTextContents();
kontrol('kaybeden de tabloyu görüyor', kaybedenSatir.length === 2);

// ---------------------------------------------------------------
// 5) Kalıcılık: röle yeniden başlasa da tablo duruyor
// ---------------------------------------------------------------
await rele.kapat();
const yeniRele = await baslat({ port: RELE_PORT, nabiz: 60_000, veriDizini });

await kazananSayfa.page.goto(`${URL}?rele=${encodeURIComponent(RELE_URL)}`, { waitUntil: 'load' });
await kazananSayfa.page.waitForTimeout(900);
await lobiyeGit(kazananSayfa.page);
await kazananSayfa.page.getByRole('button', { name: /SKOR TABLOSU/ }).click();
await kazananSayfa.page.waitForTimeout(1200);

const yenidenSatirlar = await kazananSayfa.page.locator('ol li').allTextContents();
kontrol(
  'röle yeniden başlayınca tablo DURUYOR',
  yenidenSatirlar.length === 2,
  `satır=${yenidenSatirlar.length}`,
);
kontrol(
  'kimlik de yeniden başlatmayı atlatıyor',
  (await yerelKimlik(kazananSayfa.page))?.id != null,
);

const tumHatalar = [...a.page.hatalar, ...b.page.hatalar];
kontrol('konsol hatası yok', tumHatalar.length === 0, tumHatalar.slice(0, 3).join(' | '));

await browser.close();
await yeniRele.kapat();
rmSync(veriDizini, { recursive: true, force: true });

kontrol.bitir('SKOR TABLOSU');
