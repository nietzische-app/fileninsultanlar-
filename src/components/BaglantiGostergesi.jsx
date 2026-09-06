import { kaliteAdi } from '../game/baglantiKalite.js';

/**
 * Bağlantı kalitesi göstergesi — üç piksel çubuk.
 *
 * Kademe SINIRLARI burada değil `game/baglantiKalite.js` içinde ve
 * ölçümden geliyor (gerekçesi orada). Burada yalnız çizim var.
 *
 * NEDEN SAYIYI DA YAZIYORUZ: yalnız çubuk göstermek "kötü" derken
 * suçu oyuncunun internetine atıyormuş gibi olur. Milisaniye, oyuncuya
 * kendi durumunu doğrulama imkânı veriyor.
 */

const RENK = {
  iyi: '#7CE38B',
  orta: '#FFD24A',
  kotu: '#FF6B6B',
};

/** Kademe başına kaç çubuk dolu. */
const DOLU = { iyi: 3, orta: 2, kotu: 1 };

/**
 * @param {{ ms: number|null, className?: string }} props
 */
export default function BaglantiGostergesi({ ms, className = '' }) {
  const kalite = kaliteAdi(ms);
  /*
   * Ölçüm yoksa HİÇBİR ŞEY çizilmiyor. "?" ya da boş çubuk göstermek
   * çevrimdışı maçlarda da bir ağ sorunu varmış izlenimi verirdi.
   */
  if (!kalite) return null;

  const renk = RENK[kalite];
  const dolu = DOLU[kalite];

  return (
    <div
      className={`flex items-end gap-[3px] ${className}`}
      title={`Bağlantı: ${ms} ms`}
    >
      {/*
        Çubuklar SVG değil düz div: üçü de tam sayı yükseklikte ve
        oyunun geri kalanı gibi piksel ızgarasında duruyor.
      */}
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            width: 3,
            height: 4 + i * 3,
            backgroundColor: i < dolu ? renk : 'rgba(255,255,255,0.18)',
          }}
        />
      ))}
      <span className="ml-1 text-[7px]" style={{ color: renk }}>
        {ms}ms
      </span>
    </div>
  );
}
