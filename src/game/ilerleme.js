/**
 * İlerleme — Forma Puanı (FP) ve oyuncu kilitleri.
 *
 * NEDEN VAR
 * ---------
 * Kadronun tamamı ilk açılışta açıktı. Onyedi oyuncuyu aynı anda önüne
 * koymak iki şeyi birden kaybettiriyor: seçim ezici oluyor (kimse
 * onyedi kartı okuyup karşılaştırmıyor, ilk sıradakine basıp geçiyor)
 * ve oynamanın bir KARŞILIĞI olmuyor — maçtan sonra tabloda bir sayı
 * değişiyor, o kadar.
 *
 * FP bunu değiştiriyor: her maç bir şeye YARIYOR ve bir sonraki
 * oyuncuya ne kadar kaldığı her an görünüyor.
 *
 * TAMAMEN YEREL
 * -------------
 * Sunucuda zaten bir puan var (`sunucu/puan.js`, Elo) ama o BAŞKA bir
 * şey: çevrimiçi sıralama. FP'yi de oraya taşımak, çevrimdışı oynayan
 * herkesin hiç ilerleyememesi demekti — oyunun modlarının çoğu tek
 * kişilik. O yüzden FP tarayıcıda durur.
 *
 * Bu, kurcalanabilir olduğu anlamına geliyor. Sorun değil: burada
 * kimseyle yarışılmıyor, kilitler oyuncunun kendi keşif temposu için
 * var. Kurcalayan yalnızca kendi sürprizini harcar.
 *
 * SAF MODÜL
 * ---------
 * Ne React ne localStorage: girdi alır, sayı döner. Böylece ilerleme
 * temposu BENZETİLEREK ölçülebiliyor (bkz. tests/olcum/ilerleme.mjs) —
 * fiyatlar sezgiyle değil, "ilk kilit kaçıncı maçta açılıyor"
 * ölçülerek kondu.
 */

import { ROSTER } from './players.js';

// =====================================================================
// Kazanç
// =====================================================================

/**
 * Kazanç katsayıları.
 *
 * Hepsi tek yerde çünkü tempo bunların ORANINDAN çıkıyor; birini
 * dosyanın içine gömmek, ayarlarken diğerlerini görmeden değiştirmek
 * demek olurdu.
 */
export const KAZANC = {
  /** Maçı bitirmenin tabanı — kaybedince de bir şey kalsın diye. */
  taban: 12,
  /** Galibiyet. Tabanın 2.5 katı: kazanmak açık ara daha değerli. */
  galibiyet: 30,
  /** Kazanılan set başına. Kaybedilen maçta da set almak sayılır. */
  setBasi: 8,
  /**
   * Zorluk çarpanı — maçın TAMAMINA uygulanır.
   *
   * Anahtar değil ETİKET: `Game.emitFinish` zorluğu `difficulty.label`
   * olarak yolluyor ('NORMAL'), anahtar olarak değil ('normal').
   * Burada anahtarla eşleştirmeye kalksaydık her maç sessizce
   * varsayılan çarpanı alırdı ve zorluk hiçbir şeye yaramazdı.
   */
  zorluk: { KOLAY: 0.8, NORMAL: 1, ZOR: 1.35 },
  /**
   * Antrenman çarpanı.
   *
   * Antrenman formatında rakip yok denecek kadar zayıf ve maç kısa —
   * en verimli FP kaynağı O olurdu. Dörtte bire indirmek onu
   * "ısınmak için oyna" yerinde tutuyor.
   */
  antrenman: 0.25,
  /** Çevrimiçi galibiyet — maç kazancına EK. */
  cevrimiciGalibiyet: 40,
  /** Turnuva kupası. */
  kupa: 250,
  /** Hayatta kalma: koşuda toplanan her puan. */
  hayattaKalma: 5,
  /** Açılan her rozet. */
  rozet: 60,
};

/**
 * Performans tavanı ve kalemleri.
 *
 * TAVAN OLMASININ SEBEBİ: uzun bir ralli maratonunda kurtarış sayısı
 * yüzleri bulabiliyor. Tavansız bırakınca en verimli strateji "topu
 * bitirme, sürdür" oluyordu — yani oyunu kazanmaya çalışmamak.
 */
export const PERFORMANS = {
  tavan: 20,
  tamVurus: 1,
  blok: 2,
  kurtaris: 2,
  plase: 3,
};

/** @param {unknown} d */
function zorlukCarpani(d) {
  return KAZANC.zorluk[String(d ?? '').toUpperCase()] ?? 1;
}

/** Negatif/NaN girdiyi sıfıra çeker — bozuk kayıt puan üretmesin. */
function sayi(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Bir maçın (ya da koşunun) FP kazancı — KALEM KALEM.
 *
 * Toplamı tek sayı döndürmek yeterdi ama sonuç ekranında "+68 FP"
 * yazmak ile "GALİBİYET +30 / 2 SET +16 / PERFORMANS +14 / ZOR ×1.35"
 * yazmak aynı şey değil: ikincisi oyuncuya bir dahaki sefere NEYİ
 * artıracağını söylüyor.
 *
 * @param {object} sonuc `Game.emitFinish` gövdesi
 * @returns {{ toplam: number, kalemler: Array<{ad: string, puan: number}>,
 *   carpan: number, carpanAd: string|null }}
 */
export function macKazanci(sonuc) {
  if (!sonuc) return { toplam: 0, kalemler: [], satirlar: [], carpan: 1, carpanAd: null };

  const kalemler = [];
  const stats = sonuc.stats ?? {};

  // --- Hayatta kalma: set ve galibiyet yok, koşu puanı var ---
  if (sonuc.campaign === 'survival') {
    const puan = sayi(sonuc.survival?.points);
    if (puan > 0) {
      kalemler.push({ ad: `${puan} PUAN`, puan: puan * KAZANC.hayattaKalma });
    }
    kalemler.push({ ad: 'KOŞU', puan: KAZANC.taban });
    const perf = performansKalemi(stats);
    if (perf) kalemler.push(perf);
    const toplam = kalemler.reduce((a, k) => a + k.puan, 0);
    return { toplam, kalemler, satirlar: [...kalemler], carpan: 1, carpanAd: null };
  }

  const kazandi = sonuc.winner === 'home';
  const antrenman = sonuc.format === 'practice';

  kalemler.push({ ad: 'MAÇ', puan: KAZANC.taban });
  if (kazandi) kalemler.push({ ad: 'GALİBİYET', puan: KAZANC.galibiyet });

  const set = sayi(sonuc.sets?.home);
  if (set > 0) kalemler.push({ ad: `${set} SET`, puan: set * KAZANC.setBasi });

  const perf = performansKalemi(stats);
  if (perf) kalemler.push(perf);

  /*
   * Çevrimiçi galibiyet ayrı bir kalem: doldurmak istediğimiz mod o.
   * Yapay zekâyı yenmekle insanı yenmek aynı şey değil ve oyun bunu
   * söylemeli — hem kazanç olarak hem de ekranda görünen bir satır
   * olarak.
   */
  if (kazandi && sonuc.playMode === 'online') {
    kalemler.push({ ad: 'ÇEVRİMİÇİ GALİBİYET', puan: KAZANC.cevrimiciGalibiyet });
  }

  const zorluk = zorlukCarpani(sonuc.difficulty);
  const carpan = antrenman ? KAZANC.antrenman : zorluk;
  const carpanAd = antrenman
    ? 'ANTRENMAN'
    : zorluk === 1
      ? null
      : String(sonuc.difficulty ?? '').toUpperCase();

  const ham = kalemler.reduce((a, k) => a + k.puan, 0);
  const toplam = Math.round(ham * carpan);
  return { toplam, kalemler, satirlar: satirlariKur(kalemler, toplam, carpanAd, carpan), carpan, carpanAd };
}

/**
 * Ekranda gösterilecek satırlar — KOLON TOPLAMI TUTSUN diye.
 *
 * Çarpanı listenin altına "×1.35" diye yazmak yanlıştı ve ekranda
 * görüldü: sonuç ekranı maç kalemlerinin YANINDA rozet/kupa kalemlerini
 * de listeliyor, ama çarpan yalnızca maça uygulanıyor. Altta duran bir
 * çarpan satırı, hepsine uygulanıyormuş gibi okunuyordu — toplayan
 * oyuncu 338 buluyor, ekranda 275 yazıyordu.
 *
 * Çözüm: çarpanı ORANDA değil FARKTA göstermek. "ZOR ×1.35  +25"
 * satırı hem çarpanın ne olduğunu söylüyor hem de kolonu toplanabilir
 * bırakıyor. Satır maç kalemlerinin hemen ardında duruyor, en altta
 * değil — kapsadığı yer orası.
 */
function satirlariKur(kalemler, toplam, carpanAd, carpan) {
  if (!carpanAd) return [...kalemler];
  const ham = kalemler.reduce((a, k) => a + k.puan, 0);
  return [
    ...kalemler,
    { ad: `${carpanAd} ×${carpan}`, puan: toplam - ham, carpan: true },
  ];
}

/** @param {object} stats */
function performansKalemi(stats) {
  const ham =
    sayi(stats.perfects) * PERFORMANS.tamVurus
    + sayi(stats.blocks) * PERFORMANS.blok
    + sayi(stats.saves) * PERFORMANS.kurtaris
    + sayi(stats.tipPoints) * PERFORMANS.plase;
  if (ham <= 0) return null;
  return { ad: 'PERFORMANS', puan: Math.min(PERFORMANS.tavan, ham) };
}

/**
 * Turnuvanın kapanış kazancı — kupa yalnızca şampiyonlukta.
 *
 * Tur maçlarının kendi kazancı zaten `macKazanci` ile işlendi; burası
 * SADECE kupanın kendisi. İkisini birleştirmek turnuvayı iki kez
 * ödüllendirirdi.
 *
 * @param {{status?: string}} durum
 */
export function turnuvaKazanci(durum) {
  if (durum?.status !== 'won') return { toplam: 0, kalemler: [], satirlar: [] };
  const kalemler = [{ ad: 'KUPA', puan: KAZANC.kupa }];
  return { toplam: KAZANC.kupa, kalemler, satirlar: [...kalemler] };
}

/**
 * Yeni açılan rozetlerin kazancı.
 *
 * Rozetler zaten var olan uzun vadeli hedefler; onları FP'ye bağlamak
 * yeni bir görev listesi yazmadan ilerlemeye ikinci bir kaynak
 * veriyor. Oyuncu rozeti hedeflerken zaten oynuyor.
 *
 * @param {string[]} yeniRozetler
 */
export function rozetKazanci(yeniRozetler) {
  const n = Array.isArray(yeniRozetler) ? yeniRozetler.length : 0;
  if (n === 0) return { toplam: 0, kalemler: [], satirlar: [] };
  const kalemler = [{ ad: n === 1 ? 'ROZET' : `${n} ROZET`, puan: n * KAZANC.rozet }];
  return { toplam: n * KAZANC.rozet, kalemler, satirlar: [...kalemler] };
}

// =====================================================================
// Kilitler
// =====================================================================

/**
 * Başlangıçta açık kadro.
 *
 * ÜÇ oyuncu, çünkü ikisi yetmiyor: Co-Op ve 2v2 iki kişi istiyor ve
 * geriye tek seçenek kalsaydı "seçim" diye bir şey olmazdı. Üçü de
 * farklı mevkiden ve farklı oynanıştan:
 *
 *  - `gizel-orgen`  kaptan ve `DEFAULT_PLAYER_ID`; savunma uzmanı
 *  - `derya-basyolu` kadronun EN DENGELİsi (çarpan sapması 0.14) —
 *                    oyunu çarpansız haliyle öğreten oyuncu
 *  - `dilan-ozdener` pasör; hızlı ama vuruşu zayıf, farklı bir ritim
 */
export const BASLANGIC_KADRO = ['gizel-orgen', 'derya-basyolu', 'dilan-ozdener'];

/**
 * Kilit bedelleri — KADEMELİ.
 *
 * Bedeli istatistikten TÜRETMEYİ denedim ve ölçüm reddetti: kadro
 * kasten dengeli, onyedi oyuncunun istatistik toplamı 428-516 arasında
 * sıkışıyor ve net çarpan değeri onikisinde 0.24-0.32 aralığında. Bu
 * sayılardan üretilen her fiyat listesi neredeyse düz çıkıyordu —
 * yani kademe diye bir şey olmuyordu. Dahası sıralama YANLIŞ çıkıyordu:
 * libero çarpanları en uçta olduğu için kaptan en pahalı oyuncu
 * oluyordu, oysa kaptan başlangıç kadrosunda.
 *
 * O yüzden kademeler elle ve gerekçesiyle konuldu. Ölçüt "ne kadar
 * güçlü" değil, OYUNU NE KADAR DEĞİŞTİRDİĞİ:
 *
 *  1. kademe — tek bir yönü belirgin, tanıdık oyuncular
 *  2. kademe — iki yönü birden değiştiren, mevki hissi güçlü olanlar
 *  3. kademe — erişim/blok gibi sahayı yeniden şekillendiren uzmanlar
 *  4. kademe — oyunda başka kimsede olmayan bir mekaniği getiren ikili
 */
const KADEMELER = [
  {
    bedel: 150,
    ids: ['salise-sanli', 'ilknur-aydan', 'elifnur-sahan', 'berna-buse-ozdem'],
  },
  {
    bedel: 400,
    ids: ['yagmur-erkin', 'sinem-jak-kisar', 'melina-vargaz', 'derin-uyanir'],
  },
  {
    bedel: 700,
    ids: ['zeliha-gunay', 'ela-erdim-dundal', 'cansel-ozbey', 'ebru-karakut'],
  },
  {
    // `handan-balatan` oyundaki en geniş çapraz açısı (angle 1.25),
    // `eylem-akarpinar` ikinci libero — uç savunma kurgusu.
    bedel: 1200,
    ids: ['handan-balatan', 'eylem-akarpinar'],
  },
];

/** id → bedel. Başlangıç kadrosu bu tabloda yok (bedeli yok). */
export const BEDELLER = Object.fromEntries(
  KADEMELER.flatMap(({ bedel, ids }) => ids.map((id) => [id, bedel]))
);

/**
 * Bir oyuncunun bedeli; başlangıç kadrosundaysa 0.
 * @param {string} id
 * @returns {number}
 */
export function bedel(id) {
  return BEDELLER[id] ?? 0;
}

/**
 * Oyuncu açık mı?
 *
 * Başlangıç kadrosu HER ZAMAN açık — kayıtta olmasa bile. Kayda
 * güvenseydik, depo silinen ya da kotası dolan bir tarayıcıda oyuncu
 * seçilecek kimse bulamaz ve oyun açılmazdı.
 *
 * @param {string} id
 * @param {string[]} acilanlar
 */
export function acikMi(id, acilanlar = []) {
  return BASLANGIC_KADRO.includes(id) || acilanlar.includes(id);
}

/** Kilitli oyuncular — ucuzdan pahalıya, eşit bedelde kadro sırasıyla. */
export function kilitliler(acilanlar = []) {
  return ROSTER
    .filter((p) => !acikMi(p.id, acilanlar))
    .sort((a, b) => bedel(a.id) - bedel(b.id));
}

/**
 * Sıradaki hedef — en ucuz kilitli oyuncu ve ona kalan.
 *
 * "Bir sonraki oyuncuya 40 FP" cümlesi, tabloda duran çıplak bakiyeden
 * daha çok iş görüyor: oyuncuya bir maç daha oynamak için sebep verir.
 *
 * @param {number} puan
 * @param {string[]} acilanlar
 * @returns {{ id: string, bedel: number, kalan: number, oran: number } | null}
 */
export function sonrakiHedef(puan, acilanlar = []) {
  const [ilk] = kilitliler(acilanlar);
  if (!ilk) return null;
  const fiyat = bedel(ilk.id);
  const elde = Math.max(0, sayi(puan));
  return {
    id: ilk.id,
    bedel: fiyat,
    kalan: Math.max(0, fiyat - elde),
    oran: fiyat > 0 ? Math.min(1, elde / fiyat) : 1,
  };
}

/**
 * Giriş ekranı vitrini — SENİN kadron.
 *
 * Burada sabit üç isim vardı (`players.js` içinde `SHOWCASE_IDS`) ve
 * kilitler gelince yalan söylemeye başladı: üçünün ikisi artık kilitli
 * oyunculardı, yani menü daha ilk açılışta sahip olmadığın bir kadroyu
 * "işte takımın" diye gösteriyordu. Bunu bir test yakaladı.
 *
 * Sabit listeyi başlangıç kadrosuyla değiştirmek düzeltirdi ama vitrin
 * bu kez hiç değişmezdi. Onun yerine vitrin artık AÇILANLARDAN
 * kuruluyor: kaptan sabit, yanındaki iki yer en SON açtığın oyunculara
 * ait. Yeni bir oyuncu aldığında onu menüde görüyorsun — açmanın
 * karşılığı satın alma ekranında kalmıyor.
 *
 * @param {string[]} acilanlar Açılış SIRASIYLA — sonuncu en yenisi
 * @param {number} adet
 */
export function vitrinKadro(acilanlar = [], adet = 3) {
  const acik = Array.isArray(acilanlar) ? acilanlar : [];
  const yeniler = acik.filter((id) => ROSTER.some((p) => p.id === id)).slice(-adet);
  // Kaptan her zaman başta; kalan yerler yeniden eskiye doğru dolar
  const sirali = [...BASLANGIC_KADRO.slice(0, 1), ...yeniler.reverse(), ...BASLANGIC_KADRO.slice(1)];
  return Array.from(new Set(sirali))
    .slice(0, adet)
    .map((id) => ROSTER.find((p) => p.id === id))
    .filter(Boolean);
}

/** Şu anki bakiyeyle açılabilecek oyuncular. */
export function acilabilirler(puan, acilanlar = []) {
  const elde = Math.max(0, sayi(puan));
  return kilitliler(acilanlar).filter((p) => bedel(p.id) <= elde);
}

/**
 * Bir oyuncuyu açar.
 *
 * Doğrulama BURADA çünkü çağıran taraf (React) puanı ekranda
 * gördüğüyle karşılaştırır ve ekran her zaman güncel olmayabilir —
 * iki kez basılan bir düğme aynı oyuncuyu iki kez satın alabilirdi.
 *
 * @param {{puan: number, acilanlar: string[]}} durum
 * @param {string} id
 * @returns {{ok: boolean, durum: {puan: number, acilanlar: string[]}, sebep?: string}}
 */
export function ac(durum, id) {
  const puan = Math.max(0, sayi(durum?.puan));
  const acilanlar = Array.isArray(durum?.acilanlar) ? durum.acilanlar : [];
  const temiz = { puan, acilanlar };

  if (!ROSTER.some((p) => p.id === id)) {
    return { ok: false, durum: temiz, sebep: 'yok' };
  }
  if (acikMi(id, acilanlar)) return { ok: false, durum: temiz, sebep: 'zaten-acik' };

  const fiyat = bedel(id);
  if (puan < fiyat) return { ok: false, durum: temiz, sebep: 'yetersiz' };

  return {
    ok: true,
    durum: { puan: puan - fiyat, acilanlar: [...acilanlar, id] },
  };
}

/**
 * GEÇMİŞE DÖNÜK KAZANÇ — sürüm geçişi için, tek seferlik.
 *
 * Kilitler bu sürümde geldi. Bunu düz uygulamak, aylardır oynayan
 * birinin bir güncellemeden sonra kadrosunun ondördünü KİLİTLİ
 * bulması demekti — kendi emeğiyle kullandığı oyuncular dahil. Bu,
 * ilerleme sistemi değil ceza olurdu.
 *
 * İki şey birden yapılıyor:
 *  1) Kayıtlı rekorlar FP'ye çevriliyor — geçmiş maçlar sayılıyor
 *  2) Oyuncunun ZATEN KULLANDIĞI kadro bedelsiz açılıyor (`kullanilan`)
 *
 * İkincisi olmadan birincisi yetmezdi: puan yetse bile oyuncu, dün
 * oynadığı oyuncuyu bugün mağazada bulurdu.
 *
 * @param {object} records `storage.loadRecords()` gövdesi
 * @param {string[]} rozetler Açılmış rozet id'leri
 * @param {string[]} kullanilan Kayıtlı tercihlerdeki kadro
 */
export function gecmisKazanci(records = {}, rozetler = [], kullanilan = []) {
  const r = records ?? {};
  const puan =
    sayi(r.wins) * KAZANC.galibiyet
    + sayi(r.matchesPlayed) * KAZANC.taban
    + sayi(r.tournamentsWon) * KAZANC.kupa
    + sayi(r.bestSurvivalPoints) * KAZANC.hayattaKalma
    + (Array.isArray(rozetler) ? rozetler.length : 0) * KAZANC.rozet;

  const acilanlar = (Array.isArray(kullanilan) ? kullanilan : [])
    .filter((id) => ROSTER.some((p) => p.id === id) && !BASLANGIC_KADRO.includes(id));

  return { puan, acilanlar: Array.from(new Set(acilanlar)) };
}

/** Tüm kadronun açılması için gereken toplam — ölçüm ve test için. */
export const TOPLAM_BEDEL = Object.values(BEDELLER).reduce((a, b) => a + b, 0);
