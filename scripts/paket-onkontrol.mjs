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
 */

const adres = process.env.VITE_RELE_URL ?? '';

function dur(baslik, ...satirlar) {
  console.error(`\n✗ ${baslik}\n`);
  satirlar.forEach((s) => console.error(`  ${s}`));
  console.error('');
  process.exit(1);
}

if (!adres) {
  dur(
    'VITE_RELE_URL verilmedi — paket ÇEVRİMİÇİ MODSUZ çıkardı.',
    'Yapı tamamlanır, oyun açılır, ama menüde ÇEVRİMİÇİ hiç görünmez',
    've bunu ancak mağazadaki uygulamayı açan biri fark eder.',
    '',
    'Örnek:',
    '  VITE_RELE_URL=wss://rele-178-104-2-249.sslip.io npm run paket',
  );
}

/*
 * Yerel adres denetimi. Test rölesinin adresi (`ws://localhost:8805`)
 * yapıda kalırsa uygulama telefonda kendi kendine bağlanmaya çalışır —
 * telefonda "localhost" telefonun kendisi demek, orada röle yok.
 */
if (/localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]/i.test(adres)) {
  dur(
    `VITE_RELE_URL yerel bir adres: ${adres}`,
    'Telefonda "localhost" telefonun KENDİSİ demek; orada röle yok.',
    'Mağaza paketinde herkese açık adres olmalı.',
  );
}

/*
 * Şifresiz bağlantı denetimi. Android 9'dan beri düz `ws://` varsayılan
 * olarak engelli; üstelik oyun `https://` üzerinden servis edilirse
 * tarayıcı da izin vermiyor. Belirtisi yine sessiz: bağlantı hiç
 * kurulmuyor ve sebebi konsolda kalıyor.
 */
if (adres.startsWith('ws://')) {
  dur(
    `VITE_RELE_URL şifresiz: ${adres}`,
    'Android 9+ düz ws:// bağlantılarını varsayılan olarak engelliyor.',
    'wss:// kullan (Caddy/nginx zaten TLS sonlandırıyor).',
  );
}

console.log(`✓ röle adresi: ${adres}`);
