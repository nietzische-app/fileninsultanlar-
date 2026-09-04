/**
 * Puanlama — Elo.
 *
 * NEDEN GALİBİYET SAYISI DEĞİL
 * ----------------------------
 * En basit tablo "kaç maç kazandın" olurdu ama o tablo beceriyi değil
 * BOŞ ZAMANI ölçüyor: yüz maç oynayıp yarısını kazanan, on maç oynayıp
 * dokuzunu kazananın üstünde çıkar. Elo bunu düzeltiyor — güçlü rakibi
 * yenmek çok, zayıf rakibi yenmek az kazandırıyor.
 *
 * Ayrı dosya olmasının sebebi ölçüm: bu fonksiyon saf, yani bilinen
 * güçte oyuncularla binlerce maç benzetip sıralamanın gerçekten
 * beceriye göre oluştuğunu sınayabiliyoruz (bkz. puan.test.js). Depoya
 * gömülü olsaydı bunu ölçmek için dosya sistemi gerekirdi.
 */

/**
 * K katsayısı — tek maçın puanı ne kadar oynatabileceği.
 *
 * 32 satranç federasyonlarının yeni oyuncular için kullandığı değer.
 * Bu oyun için de uygun: az oyunculu bir tabloda sıralamanın birkaç
 * maçta oturması gerekiyor. 16 olsaydı yeni bir oyuncunun gerçek
 * yerini bulması onlarca maç sürerdi; 64'te tek bir şanslı maç
 * tabloyu alt üst ederdi.
 */
export const K = 32;

/**
 * Kazananın alacağı puan (kaybeden aynısını verir).
 *
 * Beklenen sonuç formülü standart Elo: 400 puanlık fark, güçlü tarafın
 * kazanma ihtimalini ~%91 yapıyor. Sonuç EN AZ 1: eşit puanlıda 16,
 * çok güçlünün çok zayıfı yenmesinde 1'e yaklaşıyor ama sıfır olmuyor
 * — sıfır olsaydı tablo tepesindeki oyuncu için maç kazanmanın hiçbir
 * karşılığı kalmazdı.
 *
 * @param {number} kazananPuan
 * @param {number} kaybedenPuan
 * @returns {number} Tam sayı puan değişimi
 */
export function puanDegisimi(kazananPuan, kaybedenPuan) {
  const beklenen = 1 / (1 + 10 ** ((kaybedenPuan - kazananPuan) / 400));
  return Math.max(1, Math.round(K * (1 - beklenen)));
}
