/**
 * Arayüz ikonları — PİKSEL IZGARASINDA, kendi çizimimiz.
 *
 * Önce hazır bir GUI paketinden (Prinbles "Silent") alınmış vektör
 * yolları vardı. İki sebeple değiştirildi:
 *
 *  1) TELİF. Pakette açık bir lisans metni yoktu; atıf vermek
 *     kullanma hakkı vermiyor. Mağazaya çıkacak bir üründe "muhtemelen
 *     sorun olmaz" yeterli bir dayanak değil.
 *  2) TARZ. O ikonlar yuvarlatılmış, eğrisel vektörlerdi; oyunun
 *     tamamı piksel sanatı. Yan yana durduklarında sonradan
 *     yapıştırılmış gibi görünüyorlardı.
 *
 * Şimdi her ikon 16×16'lık bir ızgarada, tam sayı koordinatlı
 * dikdörtgenlerden oluşuyor. Bu, projenin baştan beri geçerli olan
 * kuralının (her şey kodda çizilsin) arayüze de uygulanması.
 *
 * NEDEN SVG DİKDÖRTGENİ, PNG DEĞİL: tuş boyutu ayarlardan %70-%140
 * arasında değişiyor. Tam sayı ızgarasındaki dikdörtgenler her ölçekte
 * keskin kalır ve `currentColor` sayesinde oyunun kendi rengini alır.
 */

/**
 * Her ikon `[x, y, genişlik, yükseklik]` dikdörtgenlerinden oluşuyor.
 * Izgara 16×16; koordinatlar tam sayı, yani ara piksel bulanıklığı yok.
 */
const IZGARA = 16;

/** Sola bakan dolu üçgen — her satırda 2 piksel genişleyen basamaklar. */
const SOL_OK = [
  [14, 0, 2, 1], [12, 1, 4, 1], [10, 2, 6, 1], [8, 3, 8, 1],
  [6, 4, 10, 1], [4, 5, 12, 1], [2, 6, 14, 1], [0, 7, 16, 1],
  [0, 8, 16, 1], [2, 9, 14, 1], [4, 10, 12, 1], [6, 11, 10, 1],
  [8, 12, 8, 1], [10, 13, 6, 1], [12, 14, 4, 1], [14, 15, 2, 1],
];

/** Sağa bakan üçgen — solun aynası. */
const SAG_OK = SOL_OK.map(([x, y, g, y2]) => [IZGARA - x - g, y, g, y2]);

const ICONS = {
  ArrowLeft: SOL_OK,
  ArrowRight: SAG_OK,

  /** Oynat — sağ ok ile aynı biçim; bağlam ayırt ediyor. */
  Play: SAG_OK,

  /** Duraklat — iki kalın çubuk. */
  Pause: [[2, 1, 4, 14], [10, 1, 4, 14]],

  /**
   * Ev — çatı üçgeni, gövde ve KAPI BOŞLUĞU.
   *
   * Kapı, boyayarak değil BOŞ BIRAKARAK yapılıyor: ikonlar tek renk
   * (`currentColor`) ve arkasındaki zemin her ekranda farklı. Kapıyı
   * zemin rengiyle doldursaydık, koyu bir düğmede kapı görünmezdi.
   */
  Home: [
    [7, 1, 2, 1], [6, 2, 4, 1], [5, 3, 6, 1], [4, 4, 8, 1],
    [3, 5, 10, 1], [2, 6, 12, 1], [1, 7, 14, 1],
    [3, 8, 10, 2],
    [3, 10, 4, 5], [9, 10, 4, 5],
  ],
};

/*
 * BURADA DÖRT İKON DAHA VARDI (yıldız, ses açık/kapalı, tekrar) ve
 * hiçbiri kullanılmıyordu — arayüzde tek bir çağrısı yoktu.
 *
 * Çizip ekrana bastıktan sonra üçünün kötü durduğunu gördüm: yıldız
 * çadıra benziyordu, "ses kapalı"nın çarpısı dağınık noktalara
 * dönüşüyordu, "tekrar" kırık bir kare gibi okunuyordu. Cilalamak
 * yerine sildim: görünmeyen bir ikonu güzelleştirmek, bakımı olan ama
 * karşılığı olmayan bir iş. Gerekirse geri eklenir.
 */

/**
 * @param {{ name: keyof typeof ICONS, size?: number|string, rotate?: number,
 *   className?: string }} props
 */
export default function GameIcon({ name, size = '1em', rotate = 0, className = '' }) {
  const rects = ICONS[name];
  if (!rects) return null;

  return (
    <svg
      viewBox={`0 0 ${IZGARA} ${IZGARA}`}
      width={size}
      height={size}
      fill="currentColor"
      /*
       * `shapeRendering: crispEdges` — ölçeklenirken kenarlar
       * yumuşatılmasın. Piksel sanatında bulanık kenar, çizimin
       * kendisini bozar; tarayıcı varsayılanı yumuşatmak.
       */
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={rotate ? { transform: `rotate(${rotate}deg)` } : undefined}
    >
      {rects.map(([x, y, g, h]) => (
        <rect key={`${x}-${y}-${g}-${h}`} x={x} y={y} width={g} height={h} />
      ))}
    </svg>
  );
}

