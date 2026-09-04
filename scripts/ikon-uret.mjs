/**
 * Uygulama ikonlarını OYUNUN KENDİ ÇİZİM KODUYLA üretir.
 *
 * Bu projenin kuralı baştan beri aynı: piksel karakterler, top, file ve
 * arka plan harici görsel dosyalarından değil, Canvas API çağrılarıyla
 * çiziliyor. Mağaza ikonları da öyle olmalı — bir tasarım programında
 * çizilip depoya PNG olarak konsaydı oyunun görünümüyle ikon zamanla
 * ayrışırdı ve kimse fark etmezdi.
 *
 * Üretilen PNG'ler depoya GİRİYOR — türev olmalarına rağmen. Sebebi:
 * Android yapısı onları istiyor ve derlemeyi yapan kişide (Android
 * Studio'lu bir Windows makinesi olabilir) Playwright bulunmayabilir.
 * Kaynak yine burası; sprite değişirse `npm run ikon` ile tazelenir ve
 * fark git'te görünür.
 *
 * TELİF NOTU: ikon bir sultanın piksel görselini taşıyor, yani
 * oyundaki üç varlıkla aynı hukuki sorunun içinde. TVF'den cevap
 * gelmeden mağazaya yüklenemez.
 *
 * Neden Playwright: Node'da canvas yok. `node-canvas` yerel derleme
 * istiyor ve bu ortamda derleyip doğrulayamıyorum (aynı gerekçeyle
 * SQLite'ı da elemiştik). Playwright zaten kurulu ve gerçek bir
 * tarayıcı canvası veriyor — üstelik oyunun ekranda göründüğü motorun
 * ta kendisi.
 *
 * Kullanım:
 *   node scripts/ikon-uret.mjs
 *   node scripts/ikon-uret.mjs --onizleme   # tek büyük dosya, göz denetimi için
 */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const ANDROID_RES = join(KOK, 'android', 'app', 'src', 'main', 'res');
const onizleme = process.argv.includes('--onizleme');

/**
 * Android başlatıcı ikonu boyutları.
 *
 * `ic_launcher_foreground` uyarlanabilir ikonun ÖN katmanı ve Android
 * kenarlarından kırpıyor: güvenli alan yalnızca ortadaki %66'lık daire.
 * Bu yüzden ön katman ayrı ölçekte çiziliyor — düz ikonla aynı
 * çizimi kullansaydık sultanın başı kırpılırdı.
 */
const BOYUTLAR = [
  ['mipmap-mdpi', 48],
  ['mipmap-hdpi', 72],
  ['mipmap-xhdpi', 96],
  ['mipmap-xxhdpi', 144],
  ['mipmap-xxxhdpi', 192],
];

/** Play Store listeleme ikonu — 512x512 zorunlu. */
const MAGAZA_BOYUT = 512;

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
});
const page = await browser.newPage();

/*
 * Oyunun modüllerini içe aktarabilmek için Vite geliştirme sunucusu
 * gerekmiyor: dosyaları doğrudan okuyup sayfaya modül olarak
 * veriyoruz. Böylece ikon üretimi ayrı bir sunucuya bağımlı olmuyor.
 */
await page.goto('about:blank');

/**
 * İkonu TEK BİR büyük boyutta çizip küçültüyoruz.
 *
 * Her boyutu ayrı çizmeyi denedim ve kompozisyon boyuttan boyuta
 * kayıyordu: piksel-art tam sayı ölçek istiyor, `Math.round` 48 px'te
 * ve 192 px'te farklı yuvarlıyor, figür bir ikonda çerçeveyi dolduruyor
 * ötekinde ortada küçük kalıyordu. Tek kaynaktan küçültmek hepsinde
 * AYNI çerçevelemeyi garanti ediyor.
 *
 * Küçültmede yumuşatma açık: 48 px'te tek tek pikseller zaten
 * görünmüyor, keskinlik yerine doğru kompozisyon daha değerli.
 */
const ANA_BOYUT = 512;

const ciz = async (boyut, { onKatman = false } = {}) => page.evaluate(
  async ({ boy, on, kokUrl, ana }) => {
    const { drawSultan } = await import(`${kokUrl}/src/game/sprites.js`);
    const { getPlayerById } = await import(`${kokUrl}/src/game/players.js`);

    // Önce büyük tuvale çiz — kompozisyon her boyutta aynı olsun
    const tuval = document.createElement('canvas');
    tuval.width = ana;
    tuval.height = ana;
    const ctx = tuval.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    /*
     * Ön katmanda arka plan YOK: uyarlanabilir ikonun arka katmanı
     * ayrı bir dosya. İkisine de zemin çizersek Android üst üste
     * bindirip kenarlarda çift renk gösteriyor.
     */
    if (!on) {
      /*
       * Zemin TÜRK BAYRAĞI KIRMIZISI, koyu değil.
       *
       * İlk denemede koyu lacivert zemin + altta ince kırmızı bant
       * vardı ve 48 px'te ikon "koyu bir kare" gibi görünüyordu:
       * başlatıcı ekranında hiçbir şey ayırt edilmiyordu. Mağaza
       * ikonu uzaktan tanınmak zorunda; en güçlü işaret renk.
       */
      ctx.fillStyle = '#E30A17';
      ctx.fillRect(0, 0, ana, ana);

      // Saha çizgisi — figürün ayağını bir yere bastırıyor
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(0, ana * 0.80, ana, ana * 0.20);
    }

    /*
     * Sultan figürü. Ölçek boyuta göre: ikon 48 px de olabiliyor
     * 512 px de, ve piksel-art'ın tam sayı ölçekte kalması gerekiyor
     * yoksa kenarlar bulanıklaşıyor.
     *
     * Ön katmanda daha küçük çiziliyor (0.62): Android uyarlanabilir
     * ikonu kenarlardan kırpıyor ve güvenli alan ortadaki daire.
     */
    /*
     * Figür çerçeveyi dolduruyor. İlk denemede boşluklu çıkıyordu ve
     * 48 px'te sultan bir lekeye dönüşüyordu; ikon uzaktan tanınmak
     * zorunda.
     *
     * Ön katman daha küçük: Android uyarlanabilir ikonu kenarlardan
     * kırpıyor, güvenli alan ortadaki daire.
     */
    const olcek = Math.round((ana * (on ? 0.68 : 0.98)) / 26);

    const sultan = getPlayerById('gizem-orge') ?? undefined;
    drawSultan(ctx, sultan, {
      x: ana / 2,
      y: ana * (on ? 0.84 : 0.94),
      scale: olcek,
      pose: 'spike',
      facing: 1,
      frame: 0,
    });

    if (boy === ana) return tuval.toDataURL('image/png');

    // Hedef boyuta küçült
    const kucuk = document.createElement('canvas');
    kucuk.width = boy;
    kucuk.height = boy;
    const kctx = kucuk.getContext('2d');
    kctx.imageSmoothingEnabled = true;
    kctx.imageSmoothingQuality = 'high';
    kctx.drawImage(tuval, 0, 0, boy, boy);
    return kucuk.toDataURL('image/png');
  },
  { boy: boyut, on: onKatman, kokUrl: 'http://ikon.yerel', ana: ANA_BOYUT },
);

/*
 * Oyun modüllerini sayfaya servis et. `about:blank` içinden göreli
 * içe aktarma çalışmıyor, o yüzden sahte bir kök üzerinden dosyaları
 * elden veriyoruz.
 */
await page.route('http://ikon.yerel/**', async (route) => {
  const { readFileSync } = await import('node:fs');
  const yol = new URL(route.request().url()).pathname;
  try {
    route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: readFileSync(join(KOK, yol), 'utf8'),
    });
  } catch {
    route.fulfill({ status: 404, body: '' });
  }
});

function yaz(hedef, veriUrl) {
  mkdirSync(dirname(hedef), { recursive: true });
  writeFileSync(hedef, Buffer.from(veriUrl.split(',')[1], 'base64'));
}

if (onizleme) {
  const cikti = join(KOK, 'tests', 'ciktilar', 'ikon-onizleme.png');
  yaz(cikti, await ciz(ANA_BOYUT));
  console.log(`önizleme: ${cikti}`);
} else {
  for (const [klasor, boy] of BOYUTLAR) {
    // eslint-disable-next-line no-await-in-loop
    const duz = await ciz(boy);
    yaz(join(ANDROID_RES, klasor, 'ic_launcher.png'), duz);
    yaz(join(ANDROID_RES, klasor, 'ic_launcher_round.png'), duz);
    // eslint-disable-next-line no-await-in-loop
    yaz(join(ANDROID_RES, klasor, 'ic_launcher_foreground.png'), await ciz(boy, { onKatman: true }));
    console.log(`${klasor}: ${boy}x${boy}`);
  }

  const magaza = join(KOK, 'tests', 'ciktilar', 'play-store-ikon-512.png');
  yaz(magaza, await ciz(MAGAZA_BOYUT));
  console.log(`Play Store ikonu (512x512): ${magaza}`);
}

await browser.close();
