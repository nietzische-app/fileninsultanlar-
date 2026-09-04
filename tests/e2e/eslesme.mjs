/**
 * HIZLI EŞLEŞME — iki gerçek tarayıcı, gerçek röle.
 *
 * `online.mjs` oda koduyla buluşan iki arkadaşı sınıyor. Burada sınanan
 * şey onun kapsamadığı asıl durum: kimseyi TANIMAYAN oyuncu. Oyunu ilk
 * açan kişinin elinde kod verecek kimse yok; hızlı eşleşme onun için
 * var ve bu testin varlık sebebi de o yol.
 *
 * Üç şey ölçülüyor:
 *   1. İki yabancı eşleşiyor ve ayrı yuvalar alıyor.
 *   2. Takma ad karşı tarafın ekranına gerçekten ulaşıyor.
 *   3. Rakip yoksa oyuncu çıkmaza girmiyor — yapay zekâ teklifi
 *      geliyor ve kabul edilince maç başlıyor.
 *
 * Bekleme sınırı burada 1.5 saniyeye çekiliyor: gerçek 20 saniyeyi
 * beklemek testi bir dakikaya çıkarırdı ve ölçülen şey süre değil,
 * teklifin gelip gelmediği.
 */

import { baslat } from '../../sunucu/rele.js';
import {
  tarayiciAc, masaustuBaglam, mobilBaglam, URL, VARSAYILAN_TERCIH, kontrolcu,
} from './yardim.mjs';

const RELE_PORT = 8801;
const BEKLEME = 1500;
const rele = await baslat({ port: RELE_PORT, nabiz: 60_000, beklemeSiniri: BEKLEME });
const RELE_URL = `ws://localhost:${RELE_PORT}`;

const kontrol = kontrolcu();
const browser = await tarayiciAc();

/**
 * Oyuncu açar; takma adı verilmişse kimliği ÖNCEDEN yazar.
 *
 * Ad kutusunu tıklayarak doldurmak da mümkündü ama testin ölçtüğü şey
 * ad yazma arayüzü değil, adın karşı tarafa ULAŞMASI. Depoya yazmak
 * bunu kısa yoldan kuruyor.
 */
async function oyuncuAc(ad, { mobil = false, takmaAd = null } = {}) {
  const ctx = mobil
    ? await mobilBaglam(browser)
    : await masaustuBaglam(browser, { width: 1280, height: 720 });
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
        localStorage.setItem(
          'filenin-sultanlari-kimlik',
          JSON.stringify({ id: `test-${kimlikAd}`, ad: kimlikAd }),
        );
      }
    },
    [{ ...VARSAYILAN_TERCIH, format: 'practice' }, takmaAd],
  );
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1000);

  page.hatalar = hatalar;
  return { ctx, page };
}

/** Menüden çevrimiçi lobiye. */
async function lobiyeGit(page) {
  await page.getByRole('button', { name: /ÇEVRİMİÇİ/ }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /ODA KUR/ }).last().click();
  await page.waitForTimeout(600);
}

function durum(page) {
  return page.evaluate(() => {
    const g = window.__game;
    if (!g) return null;
    return {
      rol: g.agRol,
      yuva: g.agYuvam,
      rakipAd: g.agRakipAd,
      adim: g.adim,
      playMode: g.playMode,
      kontrolluSayisi: g.players.filter((p) => p.controlled).length,
    };
  });
}

console.log('═══ hızlı eşleşme');

// ---------------------------------------------------------------
// 1) İki yabancı eşleşiyor
// ---------------------------------------------------------------
const a = await oyuncuAc('A', { takmaAd: 'ATEŞLİ SMAÇ' });
const b = await oyuncuAc('B', { mobil: true, takmaAd: 'ÇELİK BLOK' });

await lobiyeGit(a.page);
kontrol(
  'lobide HIZLI EŞLEŞ var',
  (await a.page.getByRole('button', { name: /HIZLI EŞLEŞ/ }).count()) > 0,
);
kontrol(
  'kendi takma adı görünüyor',
  (await a.page.getByText('ATEŞLİ SMAÇ').count()) > 0,
);

await a.page.getByRole('button', { name: /HIZLI EŞLEŞ/ }).click();
await a.page.waitForTimeout(700);

kontrol(
  'ilk giren sırada bekliyor',
  (await a.page.getByText(/RAKİP ARANIYOR/).count()) > 0,
);
kontrol('sunucuda bir kişi sırada', rele.sira.sayi === 1, `sıra=${rele.sira.sayi}`);

await lobiyeGit(b.page);
await b.page.getByRole('button', { name: /HIZLI EŞLEŞ/ }).click();
await a.page.waitForTimeout(2500);

const aDurum = await durum(a.page);
const bDurum = await durum(b.page);

kontrol('ikisi de maça girdi', Boolean(aDurum && bDurum));
kontrol(
  'yuvalar ayrı dağıtıldı',
  aDurum?.yuva !== bDurum?.yuva && Boolean(aDurum?.yuva) && Boolean(bDurum?.yuva),
  `${aDurum?.yuva} / ${bDurum?.yuva}`,
);
kontrol('sıra boşaldı', rele.sira.sayi === 0, `sıra=${rele.sira.sayi}`);
kontrol(
  'sunucudan gelen adım iki tarafta da ilerliyor',
  (aDurum?.adim ?? 0) > 10 && (bDurum?.adim ?? 0) > 10,
  `a=${aDurum?.adim} b=${bDurum?.adim}`,
);

// ---------------------------------------------------------------
// 2) Kimlik karşı tarafa ulaştı mı
// ---------------------------------------------------------------
kontrol(
  'A rakibinin adını görüyor',
  aDurum?.rakipAd === 'ÇELİK BLOK',
  `rakipAd=${aDurum?.rakipAd}`,
);
kontrol(
  'B rakibinin adını görüyor',
  bDurum?.rakipAd === 'ATEŞLİ SMAÇ',
  `rakipAd=${bDurum?.rakipAd}`,
);

await a.ctx.close();
await b.ctx.close();

// ---------------------------------------------------------------
// 3) Rakip yoksa yapay zekâ teklifi
// ---------------------------------------------------------------
const yalniz = await oyuncuAc('YALNIZ', { takmaAd: 'YALNIZ KURT' });
await lobiyeGit(yalniz.page);
await yalniz.page.getByRole('button', { name: /HIZLI EŞLEŞ/ }).click();
await yalniz.page.waitForTimeout(700);

kontrol(
  'beklerken teklif HENÜZ yok',
  (await yalniz.page.getByRole('button', { name: /YAPAY ZEKÂYA KARŞI/ }).count()) === 0,
);

await yalniz.page.waitForTimeout(BEKLEME + 1500);

kontrol(
  'süre dolunca yapay zekâ teklifi geliyor',
  (await yalniz.page.getByRole('button', { name: /YAPAY ZEKÂYA KARŞI/ }).count()) > 0,
);
/*
 * Teklif sıradan ATILDIN demek değil: tam o sırada biri gelirse
 * gerçek maç olmalı. Sunucu tarafındaki karşılığı buydu.
 */
kontrol(
  'teklife rağmen sırada kalıyor',
  rele.sira.sayi === 1,
  `sıra=${rele.sira.sayi}`,
);

await yalniz.page.getByRole('button', { name: /YAPAY ZEKÂYA KARŞI/ }).click();
await yalniz.page.waitForTimeout(2000);

const botDurum = await durum(yalniz.page);
kontrol('yapay zekâ maçı başladı', Boolean(botDurum), `durum=${botDurum ? 'var' : 'yok'}`);
/*
 * Bot maçı YEREL: rakip zaten yapay zekâ olduğuna göre sunucuya
 * gitmenin tek getirisi gecikme olurdu.
 */
kontrol('bot maçı yerel — ağ rolü yok', botDurum?.rol === null, `rol=${botDurum?.rol}`);
kontrol(
  'tek insan oyuncu var',
  botDurum?.kontrolluSayisi === 1,
  `kontrollü=${botDurum?.kontrolluSayisi}`,
);
kontrol('oyuncu sıradan çıktı', rele.sira.sayi === 0, `sıra=${rele.sira.sayi}`);

const tumHatalar = [...yalniz.page.hatalar];
kontrol('konsol hatası yok', tumHatalar.length === 0, tumHatalar.join(' | '));

await yalniz.ctx.close();
await browser.close();
await rele.kapat();

kontrol.bitir('HIZLI EŞLEŞME');
