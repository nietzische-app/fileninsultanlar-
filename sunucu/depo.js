/**
 * Kalıcı depo — oyuncu kayıtları ve sıralama.
 *
 * Şimdiye kadar sunucuda hiçbir şey kalıcı değildi: odalar, sıra, maçlar
 * hepsi bellekte duruyordu ve röle yeniden başlayınca yok oluyordu. Maç
 * sonuçlarını saklamak için ilk kalıcı katman bu.
 *
 * NEDEN SQLITE DEĞİL
 * ------------------
 * SQLite doğru araç gibi görünüyor ve iki yolu da denenebilirdi:
 *
 *   - `node:sqlite` — bağımlılık gerektirmiyor ama Node 22'de DENEYSEL
 *     ve imaj `node:20-alpine`; imajı yükseltmek ve deneysel bir API'ye
 *     bağlanmak gerekirdi.
 *   - `better-sqlite3` — yerel derleme istiyor, yani imaja python3, make
 *     ve g++ girecek. Bu ortamda imajı DERLEYİP DOĞRULAYAMIYORUM (vekil
 *     sunucu Docker Hub katmanlarını engelliyor, bu daha önce yaşandı).
 *     Doğrulayamadığım bir yerel bağımlılığı üretime yollamak, "bende
 *     çalıştı" bile diyemeyeceğim bir değişiklik olurdu.
 *
 * Bunun yerine EKLEME GÜNLÜĞÜ (append-only JSONL) + bellekte dizin.
 * Bedelleri açık ve burada yazılı:
 *   - Her şey bellekte. Binlerce oyuncu birkaç MB; yüz binlerde bu yol
 *     bırakılmalı.
 *   - Sorgu yok, tarama var. `siralama` tüm oyuncuları sıralıyor.
 *   - Günlük büyüyor; `sikistir()` bunun için var.
 * Karşılığında: sıfır bağımlılık, imaj değişmiyor, tek dosya yedeği
 * (`cp`), ve çökme sonrası davranışı sınanabiliyor (bkz. depo.test.js).
 *
 * DAYANIKLILIK — ve sınırı
 * ------------------------
 * Her kayıt tek satır ve dosyanın SONUNA ekleniyor. Süreç çökerse
 * (hata, `kill`, yeniden dağıtım) hiçbir şey kaybolmuyor: yazma
 * çekirdeğe teslim edilmiş oluyor. Kötü durumda yalnız son satır
 * yarım kalır ve yükleme onu atıyor — bu iddia testte gerçekten yarım
 * dosya üretilerek sınanıyor, varsayılmıyor.
 *
 * `fsync` YOK ve bilerek yok: her maçta diski beklemek, kazandığından
 * çok daha pahalı. Bedeli açıkça şu — makine elektrik kesintisi ya da
 * çekirdek çökmesiyle giderse son birkaç saniyenin maçları
 * kaybolabilir. Bir voleybol oyununun skor tablosu için kabul
 * edilebilir; para ya da ödül bağlanırsa bu takas yeniden
 * düşünülmeli.
 */

import { createHash, randomBytes } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

/** Başlangıç puanı — Elo geleneği. */
export const BASLANGIC_PUAN = 1000;

/**
 * Günlük bu katına çıkınca sıkıştırılıyor.
 *
 * 3: 100 oyuncu için günlük 300 satırı geçince yeniden yazılıyor. Daha
 * küçüğü her maçta dosyayı baştan yazardı; daha büyüğü açılışı
 * yavaşlatırdı. Sıkıştırma zaten ucuz (bellekten yazılıyor), sık
 * olması sorun değil.
 */
const SIKISTIRMA_ORANI = 3;

/** Takma ad çakışırsa bile kimlik ayrı — id benzersizliği burada. */
function kimlikUret() {
  return randomBytes(12).toString('hex');
}

/**
 * Gizli anahtarı özetler.
 *
 * Anahtar bir taşıyıcı jeton: bilen kişi o kimliğin sahibi sayılıyor.
 * Düz metin saklasaydık dosyayı okuyabilen herkes bütün oyuncuların
 * yerine geçebilirdi. Özet tek yönlü; dosya sızsa bile jetonlar
 * kullanılamaz.
 *
 * Tuz yok ve gerekmiyor: anahtar kullanıcı parolası değil, 32 baytlık
 * rastgele bir dizi. Sözlük saldırısı diye bir şey söz konusu değil.
 */
function ozet(gizli) {
  return createHash('sha256').update(String(gizli)).digest('hex');
}

export class Depo {
  /**
   * @param {object} [ayar]
   * @param {string} [ayar.dizin] Veri dizini.
   * @param {boolean} [ayar.yukle] Açılışta günlüğü oku (testte kapatılabilir).
   */
  constructor({ dizin = process.env.VERI_DIZINI ?? './veri', yukle = true } = {}) {
    this.dizin = dizin;
    this.dosya = join(dizin, 'oyuncular.jsonl');
    /** @type {Map<string, object>} */
    this.oyuncular = new Map();
    /** Günlükteki satır sayısı — sıkıştırma kararı buna bakıyor. */
    this.satir = 0;

    mkdirSync(dizin, { recursive: true });
    if (yukle) this.yukle();
  }

  get sayi() {
    return this.oyuncular.size;
  }

  /**
   * Günlüğü baştan okuyup belleği kurar.
   *
   * Aynı kimlik birden çok kez geçebilir; SON kayıt geçerli. Bozuk ya
   * da yarım satır sessizce atlanıyor — yükleme sırasında hata
   * fırlatmak, tek bir bozuk baytın bütün sunucuyu açılmaz hâle
   * getirmesi demek olurdu.
   */
  yukle() {
    this.oyuncular.clear();
    this.satir = 0;
    if (!existsSync(this.dosya)) return;

    const ham = readFileSync(this.dosya, 'utf8');
    ham.split('\n').forEach((satir) => {
      if (!satir.trim()) return;
      this.satir += 1;
      try {
        const kayit = JSON.parse(satir);
        if (kayit?.id) this.oyuncular.set(kayit.id, kayit);
      } catch {
        /*
         * Yarım satır: yazma ortasında çökülmüş. Yalnız SON satırda
         * beklenir; ortada çıkması dosyanın elle bozulduğu anlamına
         * gelir. İkisinde de doğru davranış aynı — o satırı atla,
         * ötekileri kurtar.
         */
      }
    });
  }

  /** Tek kaydı günlüğe ekler ve gerekirse sıkıştırır. */
  yaz(kayit) {
    this.oyuncular.set(kayit.id, kayit);
    appendFileSync(this.dosya, `${JSON.stringify(kayit)}\n`);
    this.satir += 1;
    if (this.satir > Math.max(32, this.oyuncular.size * SIKISTIRMA_ORANI)) {
      this.sikistir();
    }
    return kayit;
  }

  /**
   * Günlüğü bellekteki hâliyle yeniden yazar.
   *
   * Geçici dosyaya yazıp `rename` ile taşıyor: aynı dosya sistemindeki
   * `rename` atomik, yani sıkıştırma ortasında SÜREÇ çökse bile eski
   * dosya olduğu gibi duruyor. Doğrudan üstüne yazsaydık o an çöken
   * sunucu bütün geçmişi kaybederdi. (Elektrik kesintisi ayrı bir
   * konu; bkz. dosya başındaki dayanıklılık notu.)
   */
  sikistir() {
    const gecici = `${this.dosya}.yeni`;
    const govde = [...this.oyuncular.values()]
      .map((k) => JSON.stringify(k))
      .join('\n');
    writeFileSync(gecici, govde ? `${govde}\n` : '');
    renameSync(gecici, this.dosya);
    this.satir = this.oyuncular.size;
  }

  /**
   * Yeni oyuncu oluşturur; gizli anahtarı YALNIZ burada döner.
   *
   * Anahtar bir daha okunamıyor (özeti saklanıyor), yani çağıran onu
   * istemciye iletmek zorunda. Kaybolursa oyuncu kimliğini kaybeder ve
   * yenisini alır — parola sıfırlama diye bir şey yok, çünkü kime ait
   * olduğunu doğrulayacak bir e-posta da yok.
   */
  oyuncuAc(ad) {
    const gizli = randomBytes(24).toString('hex');
    const kayit = {
      id: kimlikUret(),
      ozet: ozet(gizli),
      ad,
      galibiyet: 0,
      maglubiyet: 0,
      puan: BASLANGIC_PUAN,
      mac: 0,
      acilis: Date.now(),
      sonMac: null,
    };
    this.yaz(kayit);
    return { kayit, gizli };
  }

  /** Kimlik + gizli anahtar doğruysa kaydı döner, yoksa null. */
  dogrula(id, gizli) {
    const kayit = this.oyuncular.get(id);
    if (!kayit || !gizli) return null;
    return ozet(gizli) === kayit.ozet ? kayit : null;
  }

  oyuncu(id) {
    return this.oyuncular.get(id) ?? null;
  }

  /** Takma adı değiştirir. */
  adDegistir(id, ad) {
    const kayit = this.oyuncular.get(id);
    if (!kayit || !ad) return null;
    return this.yaz({ ...kayit, ad });
  }

  /**
   * Maç sonucunu işler: iki oyuncunun da kaydını günceller.
   *
   * Sonucu İSTEMCİ BİLDİRMİYOR — maçı sunucu koşturuyor ve kazananı
   * kendi simülasyonundan biliyor (bkz. rele.js `macKur`). Bu, adım
   * 1'deki "sunucu hakem" kararının doğrudan karşılığı: istemci
   * "kazandım" diyemediği için skor tablosu uydurulamıyor.
   *
   * @returns {{kazanan:object, kaybeden:object, degisim:number}|null}
   */
  sonucIsle(kazananId, kaybedenId, puanla) {
    const kazanan = this.oyuncular.get(kazananId);
    const kaybeden = this.oyuncular.get(kaybedenId);
    if (!kazanan || !kaybeden) return null;
    /*
     * Aynı kimliğin iki bağlantısı: kendine karşı oynanmış maç. Puana
     * yazmıyoruz — kazanç çiftçiliğinin en ucuz yolu bu olurdu.
     */
    if (kazananId === kaybedenId) return null;

    const degisim = puanla(kazanan.puan, kaybeden.puan);
    const simdi = Date.now();

    const yeniKazanan = this.yaz({
      ...kazanan,
      galibiyet: kazanan.galibiyet + 1,
      mac: kazanan.mac + 1,
      puan: kazanan.puan + degisim,
      sonMac: simdi,
    });
    const yeniKaybeden = this.yaz({
      ...kaybeden,
      maglubiyet: kaybeden.maglubiyet + 1,
      mac: kaybeden.mac + 1,
      // Puan sıfırın altına düşmesin: sıralamada anlamı yok, üstelik
      // kaybetmeye devam eden oyuncuyu sonsuza kadar cezalandırırdı
      puan: Math.max(0, kaybeden.puan - degisim),
      sonMac: simdi,
    });

    return { kazanan: yeniKazanan, kaybeden: yeniKaybeden, degisim };
  }

  /**
   * Sıralama — puana göre en iyiler.
   *
   * Hiç maç oynamamışlar DIŞARIDA: herkes 1000 puanla başlıyor, listeye
   * girselerdi tablo oyun açıp hiç oynamamış kişilerle dolardı.
   */
  siralama(limit = 20) {
    return [...this.oyuncular.values()]
      .filter((k) => k.mac > 0)
      .sort((a, b) => b.puan - a.puan || b.galibiyet - a.galibiyet)
      .slice(0, limit)
      .map(genelGorunum);
  }

  /** Oyuncunun sıradaki yeri (1 tabanlı); hiç oynamamışsa null. */
  sira(id) {
    const kayit = this.oyuncular.get(id);
    if (!kayit || kayit.mac === 0) return null;
    const ustundekiler = [...this.oyuncular.values()].filter(
      (k) => k.mac > 0 && (k.puan > kayit.puan || (k.puan === kayit.puan && k.galibiyet > kayit.galibiyet)),
    );
    return ustundekiler.length + 1;
  }
}

/**
 * Dışarıya açılan oyuncu görünümü.
 *
 * `ozet` ASLA çıkmıyor. Ayrı bir fonksiyon olmasının sebebi bu: kaydı
 * olduğu gibi yollamak kolay ve bir gün biri öyle yapardı; tek bir
 * yerden geçmesi o hatayı zorlaştırıyor.
 */
export function genelGorunum(kayit) {
  if (!kayit) return null;
  return {
    id: kayit.id,
    ad: kayit.ad,
    puan: kayit.puan,
    galibiyet: kayit.galibiyet,
    maglubiyet: kayit.maglubiyet,
    mac: kayit.mac,
  };
}
