import type {StoreShotProps} from './StoreScreenshots';

/**
 * Mağaza görselleri — tüm metinler TEK yerde.
 *
 * Başlık değiştirmek için yalnızca burayı düzenle (ya da tek seferlik:
 *   npx remotion still remotion/index.ts StoreScreenshot3 out/x.png \
 *     --props='{"title":"..."}').
 *
 * KAYNAK GÖRÜNTÜLER `npm run store-shots:capture` ile üretilir:
 *   shot-1 maç başı · shot-2 smaç · shot-3 kadro · shot-4 mod menüsü · shot-5 şampiyon
 */

export const STORE_SHOTS: StoreShotProps[] = [
  {
    title: "Nostaljik 90'lar Voleybol Heyecanı!",
    subtitle: 'Mobilde retro atari ruhunu yaşa',
    image: 'remotion/store/shot-1.png',
    backImage: 'remotion/store/shot-2.png',
    theme: 'red',
  },
  {
    title: 'Güçlü Smaçlar ve Bloklar!',
    subtitle: 'Zamanlamanı ayarla, rakibini avla',
    image: 'remotion/store/shot-2.png',
    backImage: 'remotion/store/shot-1.png',
    theme: 'night',
  },
  {
    /*
     * İSTENEN ORİJİNAL: "Filenin Sultanları & Erkek Milli Takımı!"
     * Neden değişti:
     *  - MAGAZA.md: "Filenin Sultanları" adı TVF telif/marka cevabı gelene kadar
     *    mağaza metinlerinden bilerek çıkarıldı.
     *  - Ekrandaki kadro kurgusal KADIN oyuncular; "Erkek Milli Takımı"
     *    görüntüyle çelişir ve Play'in yanıltıcı meta veri kuralına takılır.
     * TVF onayı gelirse orijinal metni buraya geri yaz.
     */
    title: 'Kadronu Seç, Takımını Kur!',
    subtitle: 'Şampiyonluk yolunda tarafını seç',
    image: 'remotion/store/shot-3.png',
    backImage: 'remotion/store/shot-1.png',
    theme: 'red',
  },
  {
    title: 'İster Arkadaşınla İster Bota Karşı!',
    /*
     * İstenen: "...co-op veya kariyer modu". Oyunda "kariyer" modu yok;
     * olan mod TURNUVA. Yanlış özellik vaadi Play'de reddedilme sebebi.
     */
    subtitle: 'Tek telefonda 2 kişilik co-\u2060op veya turnuva modu',
    image: 'remotion/store/shot-4.png',
    aspect: 16 / 9,
    backImage: 'remotion/store/shot-3.png',
    theme: 'night',
  },
  {
    title: 'Zirveye Tırman, Kupayı Kaldır!',
    subtitle: 'Skor tablosunda adını en üste yazdır',
    image: 'remotion/store/shot-5.png',
    backImage: 'remotion/store/shot-2.png',
    theme: 'red',
  },
];
