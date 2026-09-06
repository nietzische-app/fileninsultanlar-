/**
 * Mağaza paketlemesinden ÖNCE yapılan denetim.
 *
 * Neden var: röle adresi derleme anında gömülüyor (`VITE_RELE_URL`).
 * Verilmezse yapı sorunsuz tamamlanıyor, uygulama açılıyor, oyun
 * çalışıyor — yalnız ÇEVRİMİÇİ menüsü hiç görünmüyor. Web'de bu
 * kurtarılabilir bir hata (yeniden dağıtırsın); mağazada değil, çünkü
 * aradaki fark bir inceleme süreci.
 *
 * Yanlış adresle paketlemek daha da sinsi: test rölesinin adresi
 * (`ws://localhost:...`) yapıda kalırsa uygulama ölü bir adrese
 * bağlanmaya çalışır ve oyuncu "çevrimiçi çalışmıyor" der. Bu tam
 * olarak yaşandı — `dist/` ve Android'e kopyalanan paket, paket
 * testinin bıraktığı yerel adresi taşıyordu.
 *
 * Denetim yalnız `npm run paket` yolunda: `npm run build` (web/Vercel)
 * dokunulmadan kalıyor, çünkü orada adres dağıtım ortamından geliyor
 * ve geliştirme yapıları çevrimiçi olmadan da anlamlı.
 *
 * KARARIN KENDİSİ burada değil, `rele-adresi.js` içinde. Bu dosya
 * `process.exit` çağırdığı için doğrudan sınanamıyordu; kararı saf bir
 * fonksiyona ayırmak onbir uç durumu birim testinde sorulabilir yaptı.
 */

import { adresSorunu } from './rele-adresi.js';

const adres = process.env.VITE_RELE_URL ?? '';

const sorun = adresSorunu(adres, {
  ipAdresiTamam: Boolean(process.env.PAKET_IP_ADRESI_TAMAM),
});

if (sorun) {
  console.error(`\n✗ ${sorun.baslik}\n`);
  sorun.satirlar.forEach((s) => console.error(`  ${s}`));
  console.error('');
  process.exit(1);
}

console.log(`✓ röle adresi: ${adres}`);
