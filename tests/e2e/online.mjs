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
// Akışı hiç başlatmayan bir maç kurabilmek için — aşağıda gerekçesi var
import { Mac } from '../../sunucu/mac.js';
import {
  tarayiciAc, masaustuBaglam, mobilBaglam, URL, VARSAYILAN_TERCIH, kontrolcu, tusKutulari,
} from './yardim.mjs';

const RELE_PORT = 8799;
const rele = await baslat({ port: RELE_PORT, nabiz: 60_000 });
const RELE_URL = `ws://localhost:${RELE_PORT}`;

const kontrol = kontrolcu();
const browser = await tarayiciAc();

/**
 * Sayfayı röle adresiyle açar — geliştirmede `?rele=` ezmesi geçerli.
 *
 * `mobil` seçeneği bilerek var: hata bildirimi telefondan katılan
 * oyuncuda çıktı (dokunmatik tuşlar hiç görünmüyordu), masaüstü
 * bağlamında o hata görünmez.
 */
async function oyuncuAc(ad, { mobil = false } = {}) {
  const ctx = mobil
    ? await mobilBaglam(browser)
    : await masaustuBaglam(browser, { width: 1280, height: 720 });
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
      yuva: g.agYuvam,
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
// Misafir telefon: gerçek kullanımda da Android'den katılındı
const misafir = await oyuncuAc('MISAFIR', { mobil: true });

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

/*
 * Artık İKİ taraf da misafir: maçı sunucu koşturuyor. Eskiden odayı
 * açanın cihazı hakemdi — hile açıktı ve gecikme avantajı tamamen
 * ondaydı.
 */
kontrol(
  'odayı açan da misafir rolünde (simülasyon sunucuda)',
  evDurum?.rol === 'misafir',
  `rol=${evDurum?.rol}`,
);
kontrol('katılan misafir rolünde', misafirDurum?.rol === 'misafir', `rol=${misafirDurum?.rol}`);
kontrol(
  'yuvalar ayrı dağıtıldı',
  evDurum?.yuva === 'p1' && misafirDurum?.yuva === 'p2',
  `${evDurum?.yuva} / ${misafirDurum?.yuva}`,
);

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

// --- Sunucu simüle ediyor: iki tarafta da adım ilerliyor ---
kontrol(
  'sunucudan gelen adım iki tarafta da ilerliyor',
  (evDurum?.adim ?? 0) > 30 && (misafirDurum?.adim ?? 0) > 30,
  `ev=${evDurum?.adim} misafir=${misafirDurum?.adim}`,
);

/*
 * Telefondan katılan oyuncuda dokunmatik tuşlar.
 *
 * Bu hata canlıda çıktı: motor açısından çevrimiçi maç `playMode: 'vs'`
 * ve ekran "iki kişi tek klavyede oynuyor" varsayıp tuşları gizliyordu.
 * Ayrı cihazlardaki iki oyuncu için yanlış — telefondan katılan oyuncu
 * sahaya giriyor ama hiçbir şekilde hareket edemiyordu.
 */
const misafirTuslar = await tusKutulari(misafir.page);
kontrol(
  'telefondan katılan misafirde dokunmatik tuşlar var',
  misafirTuslar.length >= 4,
  `${misafirTuslar.length} tuş: ${misafirTuslar.map((t) => t.etiket).join(', ')}`,
);

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

/*
 * İstemcide karşı tarafın tuşu HİÇ bulunmamalı. Eskiden ev sahibi
 * misafirin girdisini kendi p2 yuvasına yazıyordu; artık girdi
 * doğrudan sunucuya gidiyor ve istemciler birbirinin tuşunu görmüyor.
 */
const evYuvalar = await ev.page.evaluate(() => ({
  p1: window.__game.inputs.p1.left,
  p2: window.__game.inputs.p2.left,
}));
kontrol(
  'istemci karşı tarafın tuşunu tutmuyor',
  evYuvalar.p1 === false && evYuvalar.p2 === false,
  `p1.left=${evYuvalar.p1} p2.left=${evYuvalar.p2}`,
);

/*
 * Ev sahibi duraklatınca maç DURMAMALI.
 *
 * Duraklatma tek kişilik oyun için yazılmıştı: motoru durduruyordu.
 * Çevrimiçide bu, paket akışını kesip misafirin ekranını hiçbir
 * açıklama olmadan donduruyordu.
 */
const duraklamaOncesi = await durum(ev.page);
await ev.page.keyboard.press('Escape');
await ev.page.waitForTimeout(900);
const duraklamaSonrasi = await durum(ev.page);
const evKatman = await ev.page.evaluate(() => ({
  kosuyor: window.__game.running,
  duraklatmaGorunur: Boolean(
    [...document.querySelectorAll('p')].find((n) => /DURAKLATILDI|MAÇ MENÜSÜ/.test(n.textContent)),
  ),
}));

/*
 * Ölçütün `adim` OLMAMASI önemli: ilk yazdığım hâlde yalnız adıma
 * bakıyordum ve düzeltme geri alındığında da geçiyordu — çünkü test
 * duraklatma katmanını açıyor ama motorun durup durmadığını
 * sormuyordu. `running` doğrudan o soruyu soruyor.
 */
kontrol('ev sahibinde duraklatma katmanı açıldı', evKatman.duraklatmaGorunur);
kontrol(
  'ev sahibi duraklatsa da motor koşmaya devam ediyor',
  evKatman.kosuyor === true && duraklamaSonrasi.adim > duraklamaOncesi.adim,
  `running=${evKatman.kosuyor} · adım ${duraklamaOncesi.adim} → ${duraklamaSonrasi.adim}`,
);
kontrol(
  'çevrimiçide duraklatma katmanı bunu söylüyor',
  await ev.page.getByText('ÇEVRİMİÇİ MAÇ DURMAZ', { exact: false }).isVisible().catch(() => false),
);
await ev.page.keyboard.press('Escape');
await ev.page.waitForTimeout(400);

/*
 * Paket akışı kesilirse misafir bunu ÖĞRENMELİ.
 *
 * Ev sahibinin sekmesi arka plana geçtiğinde soket açık kalır ama
 * tarayıcı kare döngüsünü durdurur; misafirin ekranı donar. Kopmuş
 * bağlantı değil bu — ayrı bir uyarı gerekiyor.
 */
/*
 * Akışı kesmek için artık SUNUCUDAKİ maçı durduruyoruz. Eskiden ev
 * sahibinin motorunu durdurmak yetiyordu (paketleri o üretiyordu);
 * hakem sunucu olunca istemciyi durdurmak yalnız o istemciyi etkiliyor.
 * Röle bu testin kendi süreci içinde olduğu için maça buradan
 * ulaşabiliyoruz — gerçek hayatta karşılığı sunucunun tökezlemesi.
 */
const oda = [...rele.defter.odalar.values()][0];
oda.mac.durdur();
await misafir.page.waitForTimeout(2600);
kontrol(
  'akış kesilince misafir "rakip bekleniyor" görüyor',
  await misafir.page.getByText('RAKİP BEKLENİYOR').isVisible().catch(() => false),
);

// Akış geri gelince uyarı kendiliğinden kaybolmalı
oda.mac.baslat();
await misafir.page.waitForTimeout(1200);
kontrol(
  'akış dönünce uyarı kayboluyor',
  !(await misafir.page.getByText('RAKİP BEKLENİYOR').isVisible().catch(() => false)),
);

// --- Akış HİÇ başlamazsa ---
/*
 * Gerçekten yaşandı: oda kuruldu, misafir katıldı, iki taraf da maç
 * ekranına geçti ve orada DONDU — "HAZIR OL 2" karesinde, top ilk
 * konumunda. Sunucudan tek bir durum paketi gelmemişti.
 *
 * Asıl kötü olan sessizlikti. Bekçi "son paketten beri geçen süre"ye
 * bakıyordu; son paket hiç olmadığı için sıfır dönüyor ve hiçbir uyarı
 * çıkmıyordu. Yani bekçinin var olma sebebi olan durumun en ağır hâli,
 * tam da göremediği hâliydi.
 *
 * Burada maçın akışını hiç başlatmıyoruz: `Mac` kuruluyor, iki
 * istemciye `mac` mesajı gidiyor, ama motor hiç dönmüyor.
 */
const asilBaslat = Mac.prototype.baslat;
Mac.prototype.baslat = function sessiz() {};

const sessizEv = await oyuncuAc('SESSIZ-EV');
const sessizMisafir = await oyuncuAc('SESSIZ-MISAFIR');
await lobiyeGit(sessizEv.page);
await sessizEv.page.getByRole('button', { name: /^ODA AÇ$/ }).click();
await sessizEv.page.waitForTimeout(900);
const sessizKod = (
  await sessizEv.page.locator('.tracking-\\[0\\.3em\\]').first().textContent()
)?.trim();
await lobiyeGit(sessizMisafir.page);
await sessizMisafir.page.getByRole('button', { name: /KODLA KATIL/ }).click();
await sessizMisafir.page.waitForTimeout(300);
await sessizMisafir.page.getByLabel('ODA KODU').fill(sessizKod);
await sessizMisafir.page.getByRole('button', { name: /^KATIL$/ }).click();
await sessizMisafir.page.waitForTimeout(3000);

kontrol(
  'akış hiç başlamazsa maç ekranına geçiliyor (arızanın koşulu)',
  (await sessizMisafir.page.locator('canvas').count()) > 0,
);
kontrol(
  'akış hiç başlamazsa ekran sebebini SÖYLÜYOR',
  await sessizMisafir.page
    .getByText('MAÇ SUNUCUDA BAŞLAMADI')
    .isVisible()
    .catch(() => false),
);
/*
 * "Rakip bekleniyor" DEMEMELİ: rakip orada ve beklemek çare değil.
 * Yanlış cümle oyuncuyu boşuna bekletir, üstelik rakibini suçlar.
 */
kontrol(
  'yanlış sebebi göstermiyor ("rakip bekleniyor" değil)',
  !(await sessizMisafir.page
    .getByText('RAKİP BEKLENİYOR')
    .isVisible()
    .catch(() => false)),
);

await sessizEv.ctx.close();
await sessizMisafir.ctx.close();
Mac.prototype.baslat = asilBaslat;

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
