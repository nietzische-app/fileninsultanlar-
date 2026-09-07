/**
 * TEŞHİS KATMANI — doğru sayıları gösteriyor mu?
 *
 * Bu katman bir teşhis aracı ve bu projede araçlar defalarca yanılttı:
 * bir ölçüm dokuz kez yanlış cevap verdi, biri "%57 duraklama" diye
 * olmayan bir arıza bildirdi. Yanlış sayı gösteren bir teşhis aracı,
 * hiç araç olmamasından KÖTÜDÜR — insanı yanlış yere gönderir.
 *
 * O yüzden burada katmanın kendisi sınanıyor: bilinen bir gecikme
 * enjekte ediliyor ve ekranda yazan sayıların onunla tutarlı olması
 * bekleniyor.
 *
 * SINIRLAR GENİŞ ve kasıtlı: sınanan şey "sayı DOĞRU MERTEBEDE mi",
 * kesin değeri değil. Dar sınırlar bu testi ağ gürültüsüne bağlı
 * yanıp sönen bir teste çevirirdi ve o da bir tür yalan olurdu.
 */

import { baslat } from '../../sunucu/rele.js';
import { vekilKur } from './_gecikmeli-vekil.mjs';
import {
  tarayiciAc, masaustuBaglam, URL, VARSAYILAN_TERCIH, kontrolcu,
} from './yardim.mjs';

const RELE_PORT = 8817;
/** Enjekte edilen TEK YÖN gecikme (ms) — röleden istemciye. */
const GECIKME = Number(process.env.GECIKME ?? 40);

const kontrol = kontrolcu();
const rele = await baslat({ port: RELE_PORT, nabiz: 60_000 });
/*
 * Gecikme VEKİLLE enjekte ediliyor, `WebSocket.prototype.send` yamasıyla
 * değil: o yama `ws`in sunucu tarafında hiç çağrılmıyor ve SESSİZCE
 * başarısız oluyordu — ölçümler koşuyor, tablolar çıkıyor, hepsi sıfır
 * gecikmede oluyordu. Vekil taşıdığı mesajı sayıyor, aşağıda sınanıyor.
 */
const vekil = await vekilKur({ hedef: `ws://localhost:${RELE_PORT}`, gecikme: GECIKME });
const browser = await tarayiciAc();

async function oyuncuAc(tani) {
  const ctx = await masaustuBaglam(browser, { width: 1280, height: 800 });
  const page = await ctx.newPage();
  const adres = `${URL}?rele=${encodeURIComponent(vekil.adres)}${tani ? '&tani=1' : ''}`;
  await page.goto(adres, { waitUntil: 'load' });
  await page.evaluate(
    (t) => localStorage.setItem('retro-voleybol-prefs', JSON.stringify(t)),
    { ...VARSAYILAN_TERCIH, format: 'practice' },
  );
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(900);
  return page;
}

const a = await oyuncuAc(true);
const b = await oyuncuAc(false);

await a.getByRole('button', { name: /HEMEN OYNA/ }).first().click();
await a.waitForTimeout(700);
await b.getByRole('button', { name: /HEMEN OYNA/ }).first().click();
await b.waitForTimeout(3000);

kontrol('maç kuruldu', await a.evaluate(() => Boolean(window.__game)));

/*
 * ARACIN DOĞRULAMASI, bulgudan ÖNCE: trafik gerçekten vekilden geçti
 * mi? Bu satır olmasaydı çalışmayan bir enjeksiyon fark edilmezdi —
 * bir kez tam olarak bu oldu.
 */
kontrol(
  'gecikme vekili trafiği taşıyor',
  vekil.sayac.asagi > 20 && vekil.sayac.yukari > 5,
  `yukarı=${vekil.sayac.yukari} aşağı=${vekil.sayac.asagi}`,
);

// Sayılar otursun — tampon ve yumuşatmalar birkaç saniye istiyor
await a.waitForTimeout(4000);

/** Katmanın ekrandaki metnini satır satır sayıya çevirir. */
const oku = async (page) => page.evaluate(() => {
  const kutu = [...document.querySelectorAll('div')]
    .find((d) => d.textContent.startsWith('TEŞHİS') && d.children.length > 3);
  if (!kutu) return null;
  const cikti = {};
  [...kutu.children].slice(1).forEach((satir) => {
    const ad = satir.children[0]?.textContent?.trim();
    const ham = satir.children[1]?.textContent?.trim();
    if (ad) cikti[ad] = ham === '—' ? null : parseFloat(ham);
  });
  return cikti;
});

const veri = await oku(a);
kontrol('teşhis katmanı görünüyor', veri !== null, JSON.stringify(veri));

if (veri) {
  /*
   * PAKET ARALIĞI, katmanın en değerli satırı: röle 30 Hz gönderiyorsa
   * ~33 ms olmalı. Bu sayı AYARDAN değil ÖLÇÜMDEN geliyor, yani röle
   * eski sürümdeyse burada büyür ve "iki taraf aynı kodda mı" sorusu
   * tek bakışta cevaplanır.
   */
  kontrol(
    'paket aralığı 30 Hz ile tutarlı',
    veri.paket >= 25 && veri.paket <= 45,
    `${veri.paket} ms (beklenen ~33)`,
  );

  /*
   * PING enjekte ettiğimiz gidiş-dönüşü içermeli. Sınır geniş: yolun
   * kendi masrafı (~11 ms, bkz. olcum:gercek-yol) ve anlık görüntü
   * kuyruğu da bu sayının içinde.
   */
  kontrol(
    'ping enjekte edilen gecikmeyi görüyor',
    veri.ping !== null && veri.ping >= GECIKME * 2 * 0.7 && veri.ping <= GECIKME * 2 + 80,
    `${veri.ping} ms (enjekte tek yön ${GECIKME}, beklenen ~${GECIKME * 2}+)`,
  );

  /*
   * TAMPON, ölçülen seğirmeye göre uyarlanıyor ve tabanı 1.5 paket
   * aralığı (~50 ms). Sabit gecikmede tavana yaklaşmamalı.
   */
  kontrol(
    'tampon makul aralıkta',
    veri.tampon >= 40 && veri.tampon <= 200,
    `${veri.tampon} ms`,
  );

  /*
   * GERİLİK tamponla aynı mertebede olmalı: ekran tam da tampon kadar
   * geriden çiziliyor. Aralarında büyük fark varsa çizim saati
   * kaymıştır ve bu, katmanın yakalaması gereken asıl arızalardan biri.
   */
  kontrol(
    'gerilik tamponla uyumlu',
    veri.gerilik !== null && Math.abs(veri.gerilik - veri.tampon) < 60,
    `gerilik=${veri.gerilik} tampon=${veri.tampon}`,
  );

  kontrol(
    'kare süresi 60 fps ile tutarlı',
    veri.kare >= 12 && veri.kare <= 24,
    `${veri.kare} ms`,
  );

  /*
   * SESSİZLİK son paketten beri geçen süre. Akış sağlıklıyken bir
   * paket aralığından büyük olmamalı; büyükse akış kesilmiş demektir.
   */
  kontrol('akış kesilmemiş', veri.sessizlik !== null && veri.sessizlik < 500, `${veri.sessizlik} ms`);
}

/*
 * VE KAPALIYKEN GÖRÜNMEMELİ. Bu satır olmadan katman herkese açık
 * kalabilir ve kimse fark etmez — normal oyuncunun ekranında teşhis
 * kutusu istemiyoruz.
 */
kontrol('parametre yokken katman ÇIZILMIYOR', (await oku(b)) === null);

await browser.close();
await vekil.kapat();
await rele.kapat?.();
kontrol.bitir('TEŞHİS KATMANI');
