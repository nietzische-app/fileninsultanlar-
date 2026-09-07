/**
 * ÇEVRİMİÇİ MAÇTA EKRAN — gerçek tarayıcı, gerçek röle, gerçek gecikme.
 *
 * NEDEN VAR: elimizdeki ölçümlerin hepsinde aynı kör nokta vardı ve
 * oyuncunun ısrarla "kasma" demesi onu görünür kıldı.
 *
 *   · olcum:akicilik   — motor Node'da, SABİT ADIMLI yapay bir döngüde.
 *                        Tarayıcının kare düşürmesini göremez.
 *   · olcum:perf       — gerçek tarayıcı ama ÇEVRİMDIŞI maç: ağ yok,
 *                        ara değerleme yok, tampon yok.
 *   · olcum:gercek-yol — gerçek yol ama YEREL ağ: gecikme ~0.
 *
 * Yani "gerçek tarayıcıda, gerçek gecikmeyle ekran ne yapıyor" sorusunu
 * hiçbiri sormuyordu. Oyuncunun yaşadığı tam olarak o birleşim.
 *
 * DÜZENEK: iki gerçek tarayıcı, gerçek röle süreci, gerçek websocket.
 * B sabit hızda gidip geliyor, A onu çizilen karelerden izliyor. Sabit
 * hız kasten — kusursuz bir ekranda kare başına yol DEĞİŞMEZ, yani
 * ölçülen her dalgalanma yolun (ağ, ara değerleme, tarayıcı) kusuru.
 *
 * ARAÇ İKİ KEZ YANILTTI; ikisi de aşağıda belgeli, çünkü aynı tuzağa
 * bir daha düşmemenin tek yolu bu:
 *   1. Girdiyi `inputs`a doğrudan yazmak — aşama geçişinde `clearInput`
 *      siliyor, B hiç yürümüyor ve ölçüm bunu "rakip kıpırdamıyor" diye
 *      okuyordu.
 *   2. Ayrı bir rAF döngüsünden okumak — iki geri çağrının sırası kare
 *      kare değişince aynı konum iki kez okunuyor, sonraki karede çift
 *      sıçrama görünüyordu. "%57 duraklama, 2.5 kat sıçrama" diye
 *      raporlanmıştı; doğrusu %1.1 çıktı.
 *
 * Kullanım (vite ayrıca çalışıyor olmalı):
 *   npm run olcum:cevrimici-kare
 *   GECIKME=45 SEGIRME=10 npm run olcum:cevrimici-kare   # gerçek ağ gibi
 *   CPU=4 npm run olcum:cevrimici-kare                   # zayıf telefon
 */

import { baslat } from '../../sunucu/rele.js';
import { vekilKur } from '../e2e/_gecikmeli-vekil.mjs';
import {
  tarayiciAc, masaustuBaglam, URL, VARSAYILAN_TERCIH,
} from '../e2e/yardim.mjs';

const SURE = Number(process.env.SURE ?? 30000);
const RELE_PORT = Number(process.env.RELE_PORT ?? 8810);
/** CPU kısıtlama katsayısı — 1 = kısıtlama yok. Telefonu taklit için 4-6. */
const CPU = Number(process.env.CPU ?? 1);
/** Röleden istemciye enjekte edilen TEK YÖN gecikme (ms) ve seğirme. */
const GECIKME = Number(process.env.GECIKME ?? 0);
const SEGIRME = Number(process.env.SEGIRME ?? 0);

const rele = await baslat({ port: RELE_PORT, nabiz: 60_000 });
/*
 * GECİKME VEKİLLE enjekte ediliyor — tarayıcı ile röle arasına giren
 * gerçek bir ara katman, iki yönü de geciktiriyor.
 *
 * Önce `WebSocket.prototype.send` yamalanıyordu ve o yama `ws`in
 * sunucu tarafında HİÇ ÇAĞRILMIYORDU. Sessizce başarısız oldu: bu
 * dosya "26/45/80 ms gecikmede ekran düzgün" diye tablolar üretti ve
 * hepsi aslında SIFIR gecikmede ölçülmüştü. Vekil taşıdığı mesajı
 * sayıyor ve rapor onu basıyor — aynı hata bir daha sessiz kalamaz.
 */
const vekil = await vekilKur({
  hedef: `ws://localhost:${RELE_PORT}`, gecikme: GECIKME, segirme: SEGIRME,
});
const browser = await tarayiciAc();

async function oyuncuAc() {
  const ctx = await masaustuBaglam(browser, { width: 1280, height: 800 });
  const page = await ctx.newPage();
  await page.goto(`${URL}?rele=${encodeURIComponent(vekil.adres)}`, { waitUntil: 'load' });
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
await b.page.waitForTimeout(3000);

if (!await a.page.evaluate(() => Boolean(window.__game))) {
  console.log('MAÇ KURULMADI — vite çalışıyor mu? (npx vite --port 5173)');
  await browser.close();
  await rele.kapat?.();
  process.exit(1);
}

if (CPU > 1) {
  const cdp = await a.ctx.newCDPSession(a.page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await a.page.waitForTimeout(600);
}

/*
 * B'yi SABİT HIZDA gidip getir.
 *
 * `setInput` kullanılıyor, `inputs`a doğrudan yazılmıyor: aşama
 * geçişlerinde motor `clearInput` çağırıyor ve doğrudan yazılan tuş
 * siliniyor — ilk koşumlarda B tam bu yüzden 0 px yürüdü. 50 ms'de bir
 * tazelendiği için silinse de geri geliyor.
 *
 * Yön HİSTEREZİS BANDIYLA dönüyor. Tek eşik yazmıştım ve B o noktanın
 * etrafında titredi; kare başına yol sıfıra yakın çıkınca ölçüm "%59
 * duraklama" dedi — yine ekranın değil sürücünün kusuru.
 */
const surucuB = b.page.evaluate((sure) => new Promise((coz) => {
  const g = window.__game;
  /*
   * İKİ FARKLI YUVA ve karıştırmak ölçümü sessizce boşa çıkarıyor:
   *   GİRDİ hep yerel p1'den gider — misafir tuşlarını her zaman oradan
   *   yolluyor (`agGirdiGonder`), eşlemeyi röle yapıyor.
   *   KONUM ise `agYuvam` yuvasından okunur — sunucudaki gerçek yer.
   */
  const yuva = g.agYuvam ?? 'p1';
  const gorulen = [];
  const yon = { sag: true };
  const t = setInterval(() => {
    const ben = g.players.find((p) => p.controlSlot === yuva);
    if (!ben) return;
    if (g.phase === 'rally') gorulen.push(ben.x);
    // Servis beklemesini kısalt: metreye bas, ralli karesi çoğalsın
    if (g.phase === 'serve') { g.setInput('action', true); g.setInput('action', false); }
    /*
     * BANT OYUNCUNUN KENDİ YARISINDA olmalı — üçüncü araç hatası
     * buradaydı ve en sinsisiydi. Sabit 560-760 bandı sahanın SAĞ
     * yarısı; oyuncu ev sahibi tarafa düşünce file'ye yaslanıp orada
     * kalıyor, karşı taraf da onu haklı olarak hareketsiz çiziyordu.
     * Ölçüm bunu "maçların yarısı kasıyor" diye okudu ve sebebi
     * yuvaya bağladı — oysa kasan şey sürücüydü.
     */
    const evde = ben.side === 'home';
    const alt = evde ? 120 : 560;
    const ust = evde ? 380 : 760;
    if (ben.x > ust) yon.sag = false;
    if (ben.x < alt) yon.sag = true;
    g.setInput('right', yon.sag);
    g.setInput('left', !yon.sag);
  }, 50);
  setTimeout(() => {
    clearInterval(t);
    coz({ yuva, taraf: (g.players.find((p) => p.controlSlot === yuva) || {}).side,
      xEnAz: Math.min(...gorulen), xEnCok: Math.max(...gorulen) });
  }, sure);
}), SURE);

/*
 * A TARAFINDA ÖLÇÜM — oyunun KENDİ döngüsünün içinden.
 *
 * Ayrı bir rAF döngüsü kullanmamanın sebebi başlıkta: sıra belirsizliği
 * olmayan tek yer burası. Okuduğumuz değer, o karede motorun bıraktığı
 * değerin ta kendisi.
 */
const olcumA = a.page.evaluate((sure) => new Promise((coz) => {
  const g = window.__game;
  const rakipYuva = (g.agYuvam ?? 'p1') === 'p1' ? 'p2' : 'p1';
  const kayit = [];
  const asil = g.ilerlet.bind(g);
  g.ilerlet = (gecen) => {
    asil(gecen);
    const r = g.players.find((p) => p.controlSlot === rakipYuva);
    /*
     * İÇ DURUM da kaydediliyor: sonuç iki kutuplu çıktı (aynı ayarla
     * kimi maç %2, kimi maç %55 duraklama) ve dışarıdan bakarak hangi
     * kipe düştüğünü anlamak mümkün değil. Ara değerlemenin üç sayısı
     * bunu söylüyor.
     */
    const son = g.agTampon && g.agTampon.length ? g.agTampon[g.agTampon.length - 1] : null;
    kayit.push([
      gecen * 1000, r ? r.x : null, g.ball ? g.ball.x : null, g.phase,
      g.agTamponBoyu * 1000,
      son && g.agCizimSaati !== null ? (son.zaman - g.agCizimSaati) * 1000 : null,
      g.agTampon ? g.agTampon.length : 0,
    ]);
  };
  setTimeout(() => { g.ilerlet = asil; coz(kayit); }, sure);
}), SURE);

const [olcum, sonucB] = await Promise.all([olcumA, surucuB]);

// ---------------------------------------------------------------- ölçüt
const sirala = (d) => [...d].sort((x, y) => x - y);
const yuzdelik = (d, p) => sirala(d)[Math.min(d.length - 1, Math.floor(d.length * p))];

/**
 * Kare başına giden yolun DÜZGÜNLÜĞÜ — yalnız BİTİŞİK RALLİ karelerinden.
 *
 * İki eleme de zorunlu ve ikisi de yaşanmış hatadan geliyor:
 *   · Servis aşamasında sunucu oyuncuları hiç adımlamıyor; o kareler
 *     sayılırsa ekran kusursuz olsa bile %90 duraklama çıkıyor.
 *   · İki ralli parçasını uç uca eklemek, aradaki servis boyunca biriken
 *     yer değişimini tek kareye sıkıştırıp olmayan bir sıçrama uyduruyor.
 *
 * Ölçütler olcum:akicilik ile birebir aynı — sayılar yan yana konabilsin.
 */
function akiciligi(idx) {
  const yollar = [];
  for (let i = 1; i < olcum.length; i += 1) {
    if (olcum[i][3] !== 'rally' || olcum[i - 1][3] !== 'rally') continue;
    if (olcum[i][idx] === null || olcum[i - 1][idx] === null) continue;
    yollar.push(Math.abs(olcum[i][idx] - olcum[i - 1][idx]));
  }
  if (yollar.length < 30) return null;
  const s = sirala(yollar);
  const kirp = Math.floor(s.length * 0.02);
  const temiz = s.slice(kirp, s.length - kirp);
  const ort = temiz.reduce((t, v) => t + v, 0) / temiz.length;
  if (!ort) return null;
  const varyans = temiz.reduce((t, v) => t + (v - ort) ** 2, 0) / temiz.length;
  return {
    n: temiz.length,
    dalgalanma: Math.sqrt(varyans) / ort,
    duraklama: temiz.filter((v) => v < ort * 0.1).length / temiz.length,
    sicrama: yuzdelik(temiz, 0.99) / ort,
  };
}

const kareler = olcum.slice(1).map((k) => k[0]);
const fazSayim = {};
olcum.forEach((k) => { fazSayim[k[3]] = (fazSayim[k[3]] ?? 0) + 1; });
const bYolu = sonucB.xEnCok - sonucB.xEnAz;
const uzun = kareler.filter((d) => d > (1000 / 60) * 1.5).length;

console.log('\nÇEVRİMİÇİ MAÇTA EKRAN — gerçekten çizilen karelerden\n');
console.log(`${kareler.length} kare · ${SURE / 1000} sn · CPU kısıtı ${CPU}x`
  + ` · enjekte TEK YÖN gecikme ${GECIKME} ms ±${SEGIRME}\n`);

/*
 * ROLLER. Sonuç iki kutuplu çıkınca akla gelen ilk şüpheli, maç
 * başında sabitlenen ve maç boyunca değişmeyen bir şey — rol ve yuva
 * tam olarak öyle. Kayda geçmezse iki kipi ayırt edecek hiçbir
 * tutamağımız kalmıyor.
 */
const roller = {
  A: await a.page.evaluate(() => ({ rol: window.__game.agRol, yuva: window.__game.agYuvam })),
  B: await b.page.evaluate(() => ({ rol: window.__game.agRol, yuva: window.__game.agYuvam })),
};

console.log('0) ARACIN DOĞRULAMASI — bulguya güvenmeden önce');
console.log(`   roller: A=${roller.A.rol}/${roller.A.yuva} · B=${roller.B.rol}/${roller.B.yuva}`);
console.log(`   vekilden geçen mesaj: yukarı ${vekil.sayac.yukari} · aşağı ${vekil.sayac.asagi}`
  + `  ${vekil.sayac.asagi > 20 ? '✓ gecikme uygulanıyor' : '✗ TRAFİK VEKİLDEN GEÇMİYOR — ölçüm geçersiz'}`);
console.log(`   B (${sonucB.yuva}/${sonucB.taraf}) ralli boyunca yolu ${bYolu.toFixed(0)} px`
  + `  ${bYolu > 100 ? '✓ yürüdü' : '✗ YÜRÜMEDİ — ölçüm geçersiz'}`);
console.log(`   aşamalar: ${JSON.stringify(fazSayim)}`);

console.log('\n1) TARAYICI kareleri düzgün üretiyor mu');
console.log(`   p50 ${yuzdelik(kareler, 0.5).toFixed(1)} ms`
  + ` · p95 ${yuzdelik(kareler, 0.95).toFixed(1)} ms`
  + ` · en kötü ${Math.max(...kareler).toFixed(1)} ms`
  + ` · uzun kare %${(uzun / kareler.length * 100).toFixed(1)}`);

/*
 * ARA DEĞERLEMENİN İÇ DURUMU.
 *
 * `tamponBoyu` hedeflenen gecikme; `çizimGeriliği` ise gerçekte en yeni
 * paketin kaç ms gerisinden çizildiği. İkisi birbirini tutmuyorsa
 * tampon adı var kendi yok demektir: çizim saati en yeni paketin
 * üstünde yürür, kareler arasında gösterilecek yeni bilgi kalmaz ve
 * ekran ancak paket geldiğinde kıpırdar.
 */
const rallide = olcum.filter((k) => k[3] === 'rally' && k[5] !== null);
if (rallide.length > 30) {
  const boy = rallide.map((k) => k[4]);
  const geri = rallide.map((k) => k[5]);
  const uzunluk = rallide.map((k) => k[6]);
  console.log('\n1b) ARA DEĞERLEMENİN İÇ DURUMU (ralli kareleri)');
  console.log(`   hedef tampon   p50 ${yuzdelik(boy, 0.5).toFixed(1)} ms`);
  console.log(`   çizim geriliği p50 ${yuzdelik(geri, 0.5).toFixed(1)} ms`
    + ` · p05 ${yuzdelik(geri, 0.05).toFixed(1)} ms · p95 ${yuzdelik(geri, 0.95).toFixed(1)} ms`);
  console.log(`   tampon uzunluğu p50 ${yuzdelik(uzunluk, 0.5)} kayıt`);
  console.log(`   geriliğin tampondan KÜÇÜK olduğu kare: `
    + `%${(rallide.filter((k) => k[5] < k[4] * 0.5).length / rallide.length * 100).toFixed(1)}`);
}

console.log('\n2) O KARELERDE SAHNE düzgün akıyor mu');
console.log('   nesne     örnek  dalgalanma   duraklama   sıçrama');
console.log('   ------------------------------------------------');
for (const [ad, i] of [['rakip', 1], ['top', 2]]) {
  const s = akiciligi(i);
  if (!s) { console.log(`   ${ad.padEnd(9)} ölçülemedi (yeterli ralli karesi yok)`); continue; }
  console.log(
    `   ${ad.padEnd(9)} ${String(s.n).padStart(5)} ${s.dalgalanma.toFixed(2).padStart(11)}`
    + ` ${(s.duraklama * 100).toFixed(1).padStart(9)}%`
    + ` ${s.sicrama.toFixed(2).padStart(9)}`,
  );
}

console.log(`
GEÇERLİ SİNYAL RAKİP, top DEĞİL. Rakip sabit hızda yürütülüyor, yani
kusursuz bir ekranda kare başına yol değişmez ve her dalgalanma yolun
kusurudur. Topun hızı ise fizik gereği sürekli değişiyor (vuruş, sekme,
dikey iniş); oradaki "duraklama" ekranın değil oyunun kendi hareketi.
Aynı sebeple olcum:akicilik de sinyal olarak rakibi seçmişti.

Karşılaştırma: aynı ölçütler yapay döngüde (olcum:akicilik) 0.07-0.08
dalgalanma ve %0 duraklama veriyor.`);

await browser.close();
await vekil.kapat();
await rele.kapat?.();
