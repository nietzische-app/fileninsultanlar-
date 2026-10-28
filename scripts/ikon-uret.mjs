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
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
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

/**
 * iOS ikon seti. App Store 1024 ister; iPhone ve iPad yuvaları
 * kendi nokta boyutlarında. Hepsi aynı 1024 tuvalden küçülür.
 *
 * Eski Capacitor taslağı `AppIcon-512@2x.png` adıyla duruyordu.
 * O dosya her üretimde silinir; katalogda yalnız bu liste kalır.
 */
const IOS_DIZIN = join(KOK, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
const IOS_ANA = 1024;
const IOS_DOSYALAR = [
  ['Icon-20.png', 20],
  ['Icon-20@2x.png', 40],
  ['Icon-20@3x.png', 60],
  ['Icon-29.png', 29],
  ['Icon-29@2x.png', 58],
  ['Icon-29@3x.png', 87],
  ['Icon-40.png', 40],
  ['Icon-40@2x.png', 80],
  ['Icon-40@3x.png', 120],
  ['Icon-60@2x.png', 120],
  ['Icon-60@3x.png', 180],
  ['Icon-76.png', 76],
  ['Icon-76@2x.png', 152],
  ['Icon-83.5@2x.png', 167],
  ['Icon-1024.png', 1024],
];

/** Katalog girdileri. Aynı piksel dosyası birden fazla yuvaya yazılmaz. */
const IOS_GIRDILER = [
  ['20x20', 'iphone', 'Icon-20@2x.png', '2x'],
  ['20x20', 'iphone', 'Icon-20@3x.png', '3x'],
  ['29x29', 'iphone', 'Icon-29@2x.png', '2x'],
  ['29x29', 'iphone', 'Icon-29@3x.png', '3x'],
  ['40x40', 'iphone', 'Icon-40@2x.png', '2x'],
  ['40x40', 'iphone', 'Icon-40@3x.png', '3x'],
  ['60x60', 'iphone', 'Icon-60@2x.png', '2x'],
  ['60x60', 'iphone', 'Icon-60@3x.png', '3x'],
  ['20x20', 'ipad', 'Icon-20.png', '1x'],
  ['20x20', 'ipad', 'Icon-20@2x.png', '2x'],
  ['29x29', 'ipad', 'Icon-29.png', '1x'],
  ['29x29', 'ipad', 'Icon-29@2x.png', '2x'],
  ['40x40', 'ipad', 'Icon-40.png', '1x'],
  ['40x40', 'ipad', 'Icon-40@2x.png', '2x'],
  ['76x76', 'ipad', 'Icon-76.png', '1x'],
  ['76x76', 'ipad', 'Icon-76@2x.png', '2x'],
  ['83.5x83.5', 'ipad', 'Icon-83.5@2x.png', '2x'],
  ['1024x1024', 'ios-marketing', 'Icon-1024.png', '1x'],
];

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

const ciz = async (boyut, { onKatman = false, ana = ANA_BOYUT } = {}) => page.evaluate(
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

    const sultan = getPlayerById('gizel-orgen') ?? undefined;
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
  { boy: boyut, on: onKatman, kokUrl: 'http://ikon.yerel', ana },
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

/**
 * App Store 1024 ikonunda alfa kanalı varsa yükleme reddedilir.
 * Tuval zaten opak kırmızıyla dolu; kanalın kendisini de söküyoruz.
 */
function alfaSil(dizin, dosyalar) {
  const kod = `
import sys
from pathlib import Path
from PIL import Image
kok = Path(sys.argv[1])
for ad in sys.argv[2:]:
    yol = kok / ad
    im = Image.open(yol).convert("RGB")
    im.save(yol, "PNG")
`;
  const sonuc = spawnSync('python3', ['-c', kod, dizin, ...dosyalar], { encoding: 'utf8' });
  if (sonuc.status !== 0) {
    throw new Error(sonuc.stderr || 'iOS ikonundan alfa kanalı silinemedi');
  }
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

  mkdirSync(IOS_DIZIN, { recursive: true });
  for (const [ad, boy] of IOS_DOSYALAR) {
    // eslint-disable-next-line no-await-in-loop
    yaz(join(IOS_DIZIN, ad), await ciz(boy, { ana: IOS_ANA }));
    console.log(`ios ${ad}: ${boy}x${boy}`);
  }
  alfaSil(IOS_DIZIN, IOS_DOSYALAR.map(([ad]) => ad));
  rmSync(join(IOS_DIZIN, 'AppIcon-512@2x.png'), { force: true });
  const images = IOS_GIRDILER.map(([size, idiom, filename, scale]) => ({
    size, idiom, filename, scale,
  }));
  // Xcode 14+ App Store yuvası. Aynı 1024 dosya; ayrı bir çizim değil.
  images.push({
    filename: 'Icon-1024.png',
    idiom: 'universal',
    platform: 'ios',
    size: '1024x1024',
  });
  writeFileSync(join(IOS_DIZIN, 'Contents.json'), `${JSON.stringify({
    images,
    info: { version: 1, author: 'xcode' },
  }, null, 2)}\n`);
  console.log('iOS ikon kataloğu yazıldı');
}

await browser.close();
