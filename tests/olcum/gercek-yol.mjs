/**
 * GERÇEK YOLUN MASRAFI — websocket + röle süreci + tarayıcı.
 *
 * Bu dosya bir çelişkiden doğdu. Oyuncunun makinesinden röleye ICMP
 * gidiş-dönüş 52 ms ölçüldü, ama oyundaki gösterge 92 ms yazıyordu.
 * Aradaki 40 ms'in nereden geldiği bilinmiyordu ve elimizdeki bütün
 * ölçümler bu farkı GÖREMEZDİ: hepsi iki motoru aynı süreçte, aynı
 * döngüde, yapay bir kanalla konuşturuyor. Yani şunları hiç
 * içermiyorlardı:
 *
 *   · websocket çerçeveleme, TCP, TLS
 *   · rölenin AYRI BİR SÜREÇ olması (girdi, tik'ler arasında bekliyor)
 *   · tarayıcının kare zamanlaması (rAF), motorun sabit adım toplayıcısı
 *   · Caddy ters vekili (üretimde; burada yok — farkı da bu ayırıyor)
 *
 * ÖLÇÜMÜN FİKRİ: aynı düzeneği YEREL AĞDA kur. Ağ gecikmesi ~0 olduğu
 * için göstergede kalan her milisaniye YOLUN KENDİ MASRAFI. Üretimdeki
 * sayıdan bunu çıkarınca geriye gerçek ağ payı kalıyor — yani "92 ms
 * fazla mı" sorusu tahmin olmaktan çıkıyor.
 *
 * NEDEN GERÇEK TARAYICI: motoru Node'da koşturmak yolun yarısını
 * atlardı. Gecikmenin bir kısmı rAF'ın kare hizasında ve ancak gerçek
 * bir tarayıcıda görünüyor.
 *
 * Kullanım (vite ayrıca çalışıyor olmalı):
 *   npm run olcum:gercek-yol
 */

import { baslat } from '../../sunucu/rele.js';
import {
  tarayiciAc, masaustuBaglam, URL, VARSAYILAN_TERCIH,
} from '../e2e/yardim.mjs';

/** Ölçüm süresi (ms) — göstergenin yumuşatması (0.85/0.15) otursun. */
const SURE = Number(process.env.SURE ?? 12000);
const RELE_PORT = Number(process.env.RELE_PORT ?? 8809);

const rele = await baslat({ port: RELE_PORT, nabiz: 60_000 });
const RELE_URL = `ws://localhost:${RELE_PORT}`;
const browser = await tarayiciAc();

async function oyuncuAc() {
  const ctx = await masaustuBaglam(browser, { width: 1280, height: 800 });
  const page = await ctx.newPage();
  await page.goto(`${URL}?rele=${encodeURIComponent(RELE_URL)}`, { waitUntil: 'load' });
  await page.evaluate(
    (t) => localStorage.setItem('retro-voleybol-prefs', JSON.stringify(t)),
    { ...VARSAYILAN_TERCIH, format: 'practice' },
  );
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(900);
  return { ctx, page };
}

const a = await oyuncuAc();
const b = await oyuncuAc();

await a.page.getByRole('button', { name: /HEMEN OYNA/ }).first().click();
await a.page.waitForTimeout(700);
await b.page.getByRole('button', { name: /HEMEN OYNA/ }).first().click();
await b.page.waitForTimeout(2500);

const kuruldu = await a.page.evaluate(() => Boolean(window.__game));
if (!kuruldu) {
  console.log('MAÇ KURULMADI — vite çalışıyor mu? (npx vite --port 5173)');
  await browser.close();
  await rele.kapat?.();
  process.exit(1);
}

/*
 * Tuşa BASIP BIRAKMAK gerekiyor. Gösterge yalnız DAMGA DEĞİŞTİĞİNDE
 * ölçüyor (aynı damgayla tekrar ölçmek süreyi şişiriyordu, gerekçesi
 * Game.js'te). Hareketsiz bir oyuncuda damga 20 Hz tazeleniyor ama
 * gerçek maçta tuşlar sürekli değişiyor; ölçüm o hâli taklit etmeli.
 */
const surucu = (page) => page.evaluate((sure) => new Promise((coz) => {
  const g = window.__game;
  const ornekler = [];
  let sag = true;
  const t = setInterval(() => {
    g.inputs.p1.right = sag;
    g.inputs.p1.left = !sag;
    sag = !sag;
    const ms = g.agGidisDonus?.();
    if (typeof ms === 'number') ornekler.push(ms);
  }, 100);
  setTimeout(() => { clearInterval(t); coz(ornekler); }, sure);
}), SURE);

const [orA, orB] = await Promise.all([surucu(a.page), surucu(b.page)]);

/** Misafir tarafı ölçüyor; ev sahibinde gösterge yok (kendi motoru). */
const ornekler = orA.length ? orA : orB;

if (ornekler.length < 5) {
  console.log('YETERSİZ ÖRNEK — gösterge hiç değer üretmedi.');
  await browser.close();
  await rele.kapat?.();
  process.exit(1);
}

const sirali = [...ornekler].sort((x, y) => x - y);
const yuzdelik = (p) => sirali[Math.min(sirali.length - 1, Math.floor(sirali.length * p))];
const ortalama = ornekler.reduce((t, v) => t + v, 0) / ornekler.length;

console.log('\nGERÇEK YOLUN MASRAFI — yerel ağ, yani ağ gecikmesi ~0\n');
console.log(`${ornekler.length} örnek · ${SURE / 1000} sn · gerçek röle süreci + websocket + tarayıcı\n`);
console.log(`  en düşük   ${sirali[0]} ms`);
console.log(`  p50        ${yuzdelik(0.5)} ms`);
console.log(`  ortalama   ${ortalama.toFixed(1)} ms`);
console.log(`  p95        ${yuzdelik(0.95)} ms`);
console.log(`  en yüksek  ${sirali[sirali.length - 1]} ms`);

console.log(`
NASIL OKUNUR: bu sayı AĞ DEĞİL, yolun kendi masrafı. Oyuncunun
gördüğü göstergeden çıkarınca geriye gerçek ağ payı kalıyor:

  göstergedeki sayı  −  buradaki ortalama  ≈  gerçek ağ gidiş-dönüşü

Sonuç oyuncunun ICMP ping'ine yakınsa gösterge dürüst demektir ve
gecikmeyi düşürmenin yolu koddan geçmiyor. Belirgin biçimde BÜYÜKSE
aradaki fark üretime özgü bir yerde (Caddy ters vekili, mobil ağ,
Wi-Fi) ve orada aranmalı.`);

await browser.close();
await rele.kapat?.();
