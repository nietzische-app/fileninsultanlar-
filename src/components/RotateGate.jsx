import { lockLandscape } from '../utils/fullscreen.js';

/**
 * Yatay zorunluluğu.
 *
 * Saha 9:5 oranında; dikey tutuşta ekranın ancak üçte birine sığıyor ve
 * oyun oynanamayacak kadar küçülüyordu. Bu yüzden dokunmatik cihazlarda
 * dikey tutuş tamamen kapatılır: altındaki her şey erişilemez olur ve
 * maç ekranı motoru duraklatır.
 *
 * Telefon çizimi DOM kutularıyla yapılır — projede görsel dosya yok.
 */
export default function RotateGate() {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-7 bg-retro-bg px-6 text-center"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="rotate-gate-title"
    >
      <PixelPhone />

      <div>
        {/* Büyük başlıklardaki `text-outline-red` bu punto da bulanık
            okunuyor; düz piksel gölgesi daha net. */}
        <h2 id="rotate-gate-title" className="text-shadow-pixel text-sm leading-relaxed text-turkiye-red">
          LÜTFEN CİHAZINIZI YATAY ÇEVİRİN
        </h2>
        <p className="mt-4 text-[8px] leading-relaxed text-white/60">
          Filenin Sultanları yatay ekran için tasarlandı.
          <br />
          Tam ekran arcade deneyimi için telefonunu yan çevir.
        </p>
      </div>

      {/*
        Yön kilidi yalnızca tam ekranda ve yalnızca destekleyen
        tarayıcılarda çalışır (iOS Safari'de API yok). Başarısız olursa
        kullanıcı zaten elle çevirecek — bu yüzden sonuç yok sayılır.
      */}
      <button
        type="button"
        className="retro-button-ghost px-5 py-3 text-[8px]"
        onClick={() => {
          lockLandscape();
        }}
      >
        YATAYA KİLİTLE
      </button>

      <p className="max-w-[16rem] text-[7px] leading-relaxed text-white/30">
        Ekran döndürme kilidi açıksa cihaz ayarlarından kapatman gerekebilir.
      </p>
    </div>
  );
}

/** Dönme animasyonlu piksel telefon. */
function PixelPhone() {
  return (
    <div className="animate-rotate-hint" aria-hidden="true">
      <div className="relative h-28 w-16 border-4 border-white/85 bg-retro-panel">
        {/* Hoparlör */}
        <span className="absolute left-1/2 top-2 h-1 w-6 -translate-x-1/2 bg-white/50" />
        {/* Ekran — içinde küçük bir saha: ortada file, altta dip çizgi.
            İkisi de ortadan geçince kesişip "X" gibi okunuyordu. */}
        <span className="absolute inset-x-1.5 bottom-5 top-5 bg-turkiye-red/70">
          <span className="absolute left-1/2 top-1/2 h-6 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-white/90" />
          <span className="absolute inset-x-1 bottom-1.5 h-[2px] bg-white/60" />
        </span>
        {/* Tuş */}
        <span className="absolute bottom-1.5 left-1/2 h-2 w-2 -translate-x-1/2 border-2 border-white/50" />
      </div>
    </div>
  );
}
