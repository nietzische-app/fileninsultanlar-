import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
    include: ['src/**/*.test.{js,jsx}'],
  },
});
