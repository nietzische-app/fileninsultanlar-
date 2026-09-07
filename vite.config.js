import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Yapı damgası — hangi taahhüdün yayında olduğu.
 *
 * NEDEN VAR: röleye aynısını koyduktan sonra geriye tek bir kör nokta
 * kalmıştı. İstemci Vercel'den kendiliğinden dağıtılıyor, röle elle;
 * ikisi ayrı sürümde kalınca belirti "yaptığın düzeltme işe yaramadı"
 * oluyor ve dışarıdan hangisinin eski olduğu görünmüyordu. Üstelik
 * karışık sürüm hiç düzeltmemekten kötü (ölçüm: sunucu/README.md).
 *
 * Damgayı bulmanın sırası önemli:
 *   1. VERCEL_GIT_COMMIT_SHA — Vercel yapılarında git yok, bu var
 *   2. yerel git            — geliştiricinin kendi yapısı
 *   3. 'bilinmiyor'         — ikisi de yoksa YALAN SÖYLEME
 */
function yapiDamgasi() {
  const vercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (vercel) return vercel.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch {
    return 'bilinmiyor';
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  /*
   * Göreli varlık yolları.
   *
   * Vite varsayılan olarak `/assets/...` üretir; oyun portalları oyunu
   * bir alt klasörde barındırdığı için (site.com/oyun/sultanlar/) bu
   * yollar 404 veriyor ve sayfa bomboş açılıyordu — ölçümle doğrulandı.
   * './' ile build hem kök dizinde hem alt klasörde hem de iframe
   * içinde çalışır.
   */
  base: './',
  plugins: [react()],
  /*
   * Damga pakete GÖMÜLÜYOR, çalışma anında okunmuyor: tarayıcıda
   * `process.env` diye bir şey yok ve damganın yapı anında sabitlenmesi
   * zaten istediğimiz şey — "bu paket hangi koddan üretildi".
   */
  define: {
    __SURUM__: JSON.stringify(yapiDamgasi()),
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    // `sunucu/` oyunun paketine girmez ama testleri aynı koşumda çıksın
    /*
     * `scripts/` de dahil: paketleme denetimi (`rele-adresi.js`)
     * mağazaya yanlış adresle paket gitmesini engelliyor ve o kararın
     * sınanmadan durması, denetimin kendisinin sessizce bozulabilmesi
     * demekti.
     */
    include: [
      'src/**/*.test.{js,jsx}',
      'sunucu/**/*.test.js',
      'scripts/**/*.test.js',
    ],
  },
});
