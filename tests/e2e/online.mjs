/**
 * ÇEVRİMİÇİ maç — iki gerçek tarayıcı, gerçek röle.
 *
 * Birim testleri iki motoru aynı süreçte bağlayıp senkron kaldıklarını
 * gösteriyor. Burada sınanan şey onun kanıtlamadığı kısım: menüden
 * odaya, odadan sahaya giden yol; WebSocket'in kendisi; ve misafirin
 * tuşunun ev sahibindeki oyuncuyu gerçekten hareket ettirmesi.
 *
 * Röle bu testin kendi süreci içinde kalkıyor — ayrı bir sunucu
 * başlatmayı unutmak, testin sessizce atlanması demek olurdu.
 */

import { baslat } from '../../sunucu/rele.js';
import { tarayiciAc, masaustuBaglam, URL, VARSAYILAN_TERCIH, kontrolcu } from './yardim.mjs';

const RELE_PORT = 8799;
const rele = await baslat({ port: RELE_PORT, nabiz: 60_000 });
const RELE_URL = `ws://localhost:${RELE_PORT}`;

const kontrol = kontrolcu();
const browser = await tarayiciAc();

/** Sayfayı röle adresiyle açar — geliştirmede `?rele=` ezmesi geçerli. */
async function oyuncuAc(ad) {
  const ctx = await masaustuBaglam(browser, { width: 1280, height: 720 });
  const page = await ctx.newPage();
  const hatalar = [];
  page.on('pageerror', (e) => hatalar.push(`${ad} PAGEERROR ${String(e).slice(0, 200)}`));
  page.on('console', (m) => {
    if (m.type() === 'error') hatalar.push(`${ad} CONSOLE ${m.text().slice(0, 160)}`);
  });

  const adres = `${URL}?rele=${encodeURIComponent(RELE_URL)}`;
  await page.goto(adres, { waitUntil: 'load' });
  await page.evaluate(
    (t) => localStorage.setItem('filenin-sultanlari-prefs', JSON.stringify(t)),
    { ...VARSAYILAN_TERCIH, format: 'practice' },
  );
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1000);

  page.hatalar = hatalar;
  return { ctx, page };
}

/** Menüden kadro ekranına, oradan çevrimiçi lobiye. */
async function lobiyeGit(page) {
  await page.getByRole('button', { name: /ÇEVRİMİÇİ/ }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /ODA KUR/ }).last().click();
  await page.waitForTimeout(600);
}

/** Motorun içinden durum okur. */
function durum(page) {
  return page.evaluate(() => {
    const g = window.__game;
    if (!g) return null;
    return {
      rol: g.agRol,
      adim: g.adim,
      faz: g.phase,
      top: [Math.round(g.ball.x), Math.round(g.ball.y)],
      skor: [g.score.home, g.score.away],
      oyuncular: g.players.map((p) => [Math.round(p.x), Math.round(p.y)]),
      rakip: g.opponent.id,
      kadro: g.players.map((p) => p.data.name),
    };
  });
}

const ev = await oyuncuAc('EV');
const misafir = await oyuncuAc('MISAFIR');

console.log('═══ çevrimiçi');

// --- Menüde görünüyor mu ---
kontrol(
  'röle tanımlıyken ÇEVRİMİÇİ menüde',
  (await ev.page.getByRole('button', { name: /ÇEVRİMİÇİ/ }).count()) > 0,
);

// --- Oda aç ---
await lobiyeGit(ev.page);
await ev.page.getByRole('button', { name: /^ODA AÇ$/ }).click();
await ev.page.waitForTimeout(900);

const kod = (await ev.page.locator('.tracking-\\[0\\.3em\\]').first().textContent())?.trim();
kontrol('oda kodu 4 karakter', kod?.length === 4, `kod=${kod}`);

// --- Odaya katıl ---
await lobiyeGit(misafir.page);
await misafir.page.getByRole('button', { name: /KODLA KATIL/ }).click();
await misafir.page.waitForTimeout(300);
await misafir.page.getByLabel('ODA KODU').fill(kod);
await misafir.page.getByRole('button', { name: /^KATIL$/ }).click();

// Eşleşme → iki tarafta da maç kurulmalı
await ev.page.waitForTimeout(2500);

const evDurum = await durum(ev.page);
const misafirDurum = await durum(misafir.page);

kontrol('ev sahibi maça girdi', evDurum?.rol === 'ev', `rol=${evDurum?.rol}`);
kontrol('misafir maça girdi', misafirDurum?.rol === 'misafir', `rol=${misafirDurum?.rol}`);

// --- Aynı maç mı ---
kontrol(
  'iki tarafta aynı rakip takım',
  evDurum?.rakip === misafirDurum?.rakip,
  `${evDurum?.rakip} / ${misafirDurum?.rakip}`,
);
kontrol(
  'iki tarafta aynı kadro',
  JSON.stringify(evDurum?.kadro) === JSON.stringify(misafirDurum?.kadro),
  `${evDurum?.kadro} / ${misafirDurum?.kadro}`,
);

// --- Simülasyon yalnız ev sahibinde ---
kontrol('ev sahibi simüle ediyor', (evDurum?.adim ?? 0) > 30, `adım=${evDurum?.adim}`);

// --- Misafir ev sahibini takip ediyor mu ---
await ev.page.waitForTimeout(1500);
const ev2 = await durum(ev.page);
const misafir2 = await durum(misafir.page);

const topFark = Math.hypot(ev2.top[0] - misafir2.top[0], ev2.top[1] - misafir2.top[1]);
/*
 * Sıfır beklemiyoruz: paketler 20 Hz gidiyor, iki ölçüm arasında ev
 * sahibi birkaç adım daha atmış olabilir. 20 Hz'de topun en hızlı
 * hâliyle bir paket arası yol alması ~85 piksel; eşik onun biraz
 * üstünde. Asıl yakalanmak istenen "misafir hiç güncellenmiyor" hâli.
 */
kontrol('misafirin topu ev sahibininkiyle aynı yerde', topFark < 120, `fark=${Math.round(topFark)}px`);

const oyuncuFark = Math.max(
  ...ev2.oyuncular.map((p, i) => Math.hypot(p[0] - misafir2.oyuncular[i][0], p[1] - misafir2.oyuncular[i][1])),
);
kontrol('oyuncular aynı yerde', oyuncuFark < 60, `enBüyükFark=${Math.round(oyuncuFark)}px`);

/*
 * Servisi ev sahibi atar. Bu adım şart: SERVİS fazında motor hiç
 * `updatePlayers` çağırmıyor, yani kimse kıpırdamıyor. İlk yazdığım
 * hâlde tuşu serviste basıp "misafirin tuşu çalışmıyor" sonucuna
 * varmıştım — girdi zinciri baştan sona doğruydu, ölçüm yanlış fazda
 * yapılıyordu.
 */
await ev.page.keyboard.press('Space');
await ev.page.waitForTimeout(500);
await ev.page.keyboard.press('Space');
await ev.page.waitForTimeout(700);

const rallide = await durum(ev.page);
kontrol('servis atıldı, ralli başladı', rallide?.faz === 'rally', `faz=${rallide?.faz}`);

// --- Misafirin tuşu ev sahibindeki oyuncuyu oynatıyor mu (kendi cihazında 1. oyuncu tuşları) ---
const oncekiAway = (await durum(ev.page)).oyuncular[1][0];
await misafir.page.keyboard.down('a');
await ev.page.waitForTimeout(700);
await misafir.page.keyboard.up('a');
await ev.page.waitForTimeout(200);
const sonrakiAway = (await durum(ev.page)).oyuncular[1][0];

kontrol(
  'misafirin tuşu ev sahibinde rakip oyuncuyu oynatıyor',
  oncekiAway - sonrakiAway > 15,
  `${oncekiAway} → ${sonrakiAway}`,
);

// Ev sahibinin girdisi misafire sızmamalı — iki yuva ayrı kalmalı
const evYuvalar = await ev.page.evaluate(() => ({
  p1: window.__game.inputs.p1.left,
  p2: window.__game.inputs.p2.left,
}));
kontrol('yuvalar karışmıyor', evYuvalar.p1 === false, `p1.left=${evYuvalar.p1}`);

// --- Ayrılınca karşı taraf haber alıyor mu ---
await misafir.page.close();
await ev.page.waitForTimeout(1200);
const kopukGorunur = await ev.page.getByText('RAKİP AYRILDI').isVisible().catch(() => false);
kontrol('misafir gidince ev sahibi haber alıyor', kopukGorunur);

// --- Sayfa hataları ---
const tumHatalar = [...ev.page.hatalar];
kontrol('konsol hatası yok', tumHatalar.length === 0, tumHatalar.slice(0, 3).join(' | '));

await browser.close();
await rele.kapat();
kontrol.bitir('ÇEVRİMİÇİ');
