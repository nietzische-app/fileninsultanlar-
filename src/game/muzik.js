/**
 * Giriş müziği — DOSYA DEĞİL, kodda üretiliyor.
 *
 * Önce 722 KB'lık bir mp3 vardı ve o dosya bize ait değildi. Yerine
 * yayınlanmış başka bir parça koymak aynı sorunu tekrarlardı; oyunun
 * baştan beri geçerli kuralı zaten "her şey kodda üretilsin" idi ve
 * ses efektlerinin tamamı çoktan öyle çalışıyordu. Müzik son istisnaydı.
 *
 * Üç kazanç: telif sorunu tamamen ortadan kalkıyor, paket 722 KB
 * küçülüyor, ve ilk açılışta indirilecek bir şey kalmıyor — müzik
 * ekran açılır açılmaz hazır.
 *
 * NASIL: örnekler tek tek yazılıyor. Osilatör düğümleriyle kurmak da
 * mümkündü ama döngünün kusursuz kapanması gerekiyor; örnek dizisi
 * üretmek, döngü noktasının TAM olarak nerede olduğunu bilmek demek.
 * Osilatörlerle bu, zamanlama kaymalarına bağlı kalırdı.
 *
 * SES: 8-bit chiptune. Kare dalga (bas), darbe dalgası (ezgi) ve
 * gürültü (vurmalı) — NES/Game Boy çipinin üç ana rengi. Oyunun piksel
 * görüntüsüyle aynı dönemden.
 */

/** Vuruş/dakika. 150 hızlı ve iten bir tempo; maç öncesi enerji için. */
const TEMPO = 150;
/** Ölçü sayısı. 8 ölçü = 12.8 sn; kısa döngü tekrar ettiğini belli eder. */
const OLCU = 8;
const VURUS_SURE = 60 / TEMPO;
const OLCU_VURUS = 4;

/**
 * Nota adı → frekans (Hz).
 *
 * Tablo yerine hesap: A4 = 440 Hz'den yarım ton uzaklığıyla. Elle
 * yazılmış bir tabloda bir satır yanlış olsa kulakla bulmak zor olurdu.
 */
const YARIM_TON = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
function frekans(nota) {
  if (!nota) return 0;
  const harf = nota[0].toUpperCase();
  const diyez = nota.includes('#') ? 1 : 0;
  const oktav = Number(nota[nota.length - 1]);
  const mesafe = YARIM_TON[harf] + diyez + (oktav - 4) * 12;
  return 440 * 2 ** (mesafe / 12);
}

/**
 * EZGİ — [nota, başlangıç (vuruş), süre (vuruş)]
 *
 * La minör üzerine kurulu, yükselen bir hat. Nakarat gibi tek bir kanca
 * yerine sürekli hareket eden bir çizgi seçildi: menüde uzun süre
 * dinlenecek ve tekrar eden kısa bir kanca çabuk sıkar.
 */
const EZGI = [
  ['A4', 0, 0.5], ['A4', 0.5, 0.5], ['C5', 1, 0.5], ['E5', 1.5, 0.5],
  ['D5', 2, 0.5], ['C5', 2.5, 0.5], ['B4', 3, 0.75], ['A4', 3.75, 0.25],

  ['G4', 4, 0.5], ['G4', 4.5, 0.5], ['B4', 5, 0.5], ['D5', 5.5, 0.5],
  ['E5', 6, 0.75], ['D5', 6.75, 0.25], ['C5', 7, 1],

  ['F4', 8, 0.5], ['A4', 8.5, 0.5], ['C5', 9, 0.5], ['F5', 9.5, 0.5],
  ['E5', 10, 0.5], ['D5', 10.5, 0.5], ['C5', 11, 1],

  ['G4', 12, 0.5], ['B4', 12.5, 0.5], ['D5', 13, 0.5], ['G5', 13.5, 0.5],
  ['F5', 14, 0.5], ['E5', 14.5, 0.5], ['D5', 15, 1],

  ['A4', 16, 0.5], ['C5', 16.5, 0.5], ['E5', 17, 0.5], ['A5', 17.5, 0.5],
  ['G5', 18, 0.5], ['E5', 18.5, 0.5], ['C5', 19, 1],

  ['F5', 20, 0.5], ['E5', 20.5, 0.5], ['D5', 21, 0.5], ['C5', 21.5, 0.5],
  ['B4', 22, 0.75], ['C5', 22.75, 0.25], ['D5', 23, 1],

  ['E5', 24, 0.5], ['E5', 24.5, 0.5], ['G5', 25, 0.5], ['E5', 25.5, 0.5],
  ['D5', 26, 0.5], ['C5', 26.5, 0.5], ['B4', 27, 1],

  ['A4', 28, 0.5], ['B4', 28.5, 0.5], ['C5', 29, 0.5], ['E5', 29.5, 0.5],
  ['A5', 30, 1.5], ['E5', 31.5, 0.5],
];

/** BAS — ölçü başına akor kökü; her vuruşta tekrar ederek iter. */
const BAS_KOK = ['A2', 'G2', 'F2', 'G2', 'A2', 'F2', 'E2', 'A2'];

/**
 * Darbe (pulse) dalgası.
 *
 * `oran` doluluk: 0.5 kare dalga (kalın, bas için), 0.25 daha ince ve
 * nazal (ezgi için) — iki hat aynı anda çalarken birbirini yemesin diye
 * ayrı renkler.
 */
function darbe(faz, oran) {
  return (faz % 1) < oran ? 1 : -1;
}

/** Tohumlu gürültü — döngü her üretimde aynı olsun. */
function gurultuUretec(tohum = 1337) {
  let s = tohum;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s / 0x3fffffff) - 1;
  };
}

/**
 * Nota zarfı (attack-decay).
 *
 * Chiptune'da nota keskin başlar ve söner. Zarfsız bir kare dalga
 * "bip" gibi duruyor; bu eğri onu çalınmış bir nota hâline getiriyor.
 */
function zarf(t, sure) {
  if (t < 0 || t > sure) return 0;
  const cikis = 0.008;
  if (t < cikis) return t / cikis;
  const kalan = (t - cikis) / Math.max(0.001, sure - cikis);
  return (1 - kalan) ** 1.6;
}

/**
 * Döngülük müziği üretir.
 *
 * @param {BaseAudioContext} ctx Örnekleme hızı buradan alınıyor
 * @returns {AudioBuffer} Baştan sona kusursuz dönen tek kanallı tampon
 */
export function muzikUret(ctx) {
  const hiz = ctx.sampleRate;
  const toplamVurus = OLCU * OLCU_VURUS;
  const sure = toplamVurus * VURUS_SURE;
  const uzunluk = Math.round(sure * hiz);
  const tampon = ctx.createBuffer(1, uzunluk, hiz);
  const ornek = tampon.getChannelData(0);

  const gurultu = gurultuUretec();
  /*
   * Gürültü örnekleri ÖNCEDEN üretiliyor: vurmalı sesler örtüştüğü için
   * akış sırasında çağırmak, aynı vuruşun her çalışta farklı duymasına
   * yol açardı. Döngünün her turda birebir aynı olması gerekiyor.
   */
  const gurultuTablo = new Float32Array(uzunluk);
  for (let i = 0; i < uzunluk; i += 1) gurultuTablo[i] = gurultu();

  // --- Ezgi ve bas ---
  const hatlar = [
    { notalar: EZGI, oran: 0.25, kazanc: 0.28 },
    {
      // Bas: her vuruşta kökü tekrar et — sürükleyen nabız
      notalar: BAS_KOK.flatMap((kok, olcu) => (
        [0, 1, 2, 3].map((v) => [kok, olcu * OLCU_VURUS + v, 0.9])
      )),
      oran: 0.5,
      kazanc: 0.22,
    },
  ];

  hatlar.forEach(({ notalar, oran, kazanc }) => {
    notalar.forEach(([nota, basVurus, surevurus]) => {
      const f = frekans(nota);
      if (!f) return;
      const bas = Math.round(basVurus * VURUS_SURE * hiz);
      const notaSure = surevurus * VURUS_SURE;
      const son = Math.min(uzunluk, bas + Math.round(notaSure * hiz));
      let faz = 0;
      for (let i = bas; i < son; i += 1) {
        faz += f / hiz;
        ornek[i] += darbe(faz, oran) * zarf((i - bas) / hiz, notaSure) * kazanc;
      }
    });
  });

  // --- Vurmalılar ---
  for (let v = 0; v < toplamVurus; v += 1) {
    const bas = Math.round(v * VURUS_SURE * hiz);
    const vurusIci = v % 4;

    // Bas davul: 1. ve 3. vuruş — alçalan sinüs
    if (vurusIci === 0 || vurusIci === 2) {
      const n = Math.round(0.12 * hiz);
      for (let i = 0; i < n && bas + i < uzunluk; i += 1) {
        const t = i / hiz;
        const f = 110 * (1 - t * 4);
        ornek[bas + i] += Math.sin(2 * Math.PI * Math.max(30, f) * t)
          * (1 - i / n) ** 2 * 0.5;
      }
    }

    // Trampet: 2. ve 4. vuruş — filtrelenmiş gürültü
    if (vurusIci === 1 || vurusIci === 3) {
      const n = Math.round(0.1 * hiz);
      for (let i = 0; i < n && bas + i < uzunluk; i += 1) {
        ornek[bas + i] += gurultuTablo[bas + i] * (1 - i / n) ** 2 * 0.22;
      }
    }

    // Hi-hat: her sekizlikte kısa cız
    [0, 0.5].forEach((kayma) => {
      const h = bas + Math.round(kayma * VURUS_SURE * hiz);
      const n = Math.round(0.03 * hiz);
      for (let i = 0; i < n && h + i < uzunluk; i += 1) {
        ornek[h + i] += gurultuTablo[h + i] * (1 - i / n) ** 3 * 0.07;
      }
    });
  }

  /*
   * KIRPMA YERİNE ÖLÇEKLEME. Örnekler toplandığı için tepe noktası
   * 1'i aşabiliyor; olduğu gibi bırakmak dijital kırpılma (çatırtı)
   * demek. En yüksek genliğe göre bir kez ölçeklemek sesin dokusunu
   * bozmadan tavanın altında tutuyor.
   */
  let tepe = 0;
  for (let i = 0; i < uzunluk; i += 1) tepe = Math.max(tepe, Math.abs(ornek[i]));
  if (tepe > 0) {
    const olcek = 0.85 / tepe;
    for (let i = 0; i < uzunluk; i += 1) ornek[i] *= olcek;
  }

  return tampon;
}

/** Döngünün saniye cinsinden uzunluğu — test ve ölçüm için. */
export const MUZIK_SURE = OLCU * OLCU_VURUS * VURUS_SURE;
