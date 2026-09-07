/**
 * TİK TEŞHİSİ — bu makine 60 Hz'i tutabiliyor mu?
 *
 * NEDEN VAR: "gecikme var" denince ilk akla gelen sunucuyu değiştirmek
 * oluyor, ama sunucunun suçlu olup olmadığı ÖLÇÜLEBİLİR bir şey ve
 * ölçmeden taşımak parayı da zamanı da boşa harcamak demek.
 *
 * NE ÖLÇÜYOR: `mac.js` maçı `setInterval(16.67ms)` ile yürütüyor.
 * Fizik bundan etkilenmiyor (`ilerlet` geçen GERÇEK zamanı sabit
 * adımlara çeviriyor, gerekçesi orada) ama PAKETİN NE ZAMAN ÇIKTIĞI
 * doğrudan bu zamanlayıcıya bağlı. Tik geciktiğinde paket de gecikiyor
 * ve istemci bunu ağ seğirmesi sanıp ara değerleme tamponunu
 * büyütüyor — yani makinedeki tökezleme, oyuncuya GECİKME olarak
 * dönüyor.
 *
 * NASIL OKUNUR:
 *   p50 ~17 ms ve p95 < 25 ms   → makine iyi, sorun burada değil
 *   p95 > 35 ms ya da geç %5+   → makine tikleri kaçırıyor; sebebi
 *                                 ya CPU sınırı ya da komşu servisler
 *
 * Bu sayı AĞ GECİKMESİ DEĞİL. Ağ için ayrı bakılmalı (oyundaki
 * gösterge ya da `ping`). İkisi karıştırılırsa yanlış şey değişir.
 *
 * Kullanım — röleyi çalıştıran makinede, konteynerin İÇİNDEN
 * (kaynak sınırları ve komşu yük ancak orada gerçekçi):
 *
 *   docker compose exec rele node tik-tani.mjs
 */

/** Ölçüm süresi (sn). 15 sn, geçici bir tökezlemeyi yakalamaya yeter. */
const SURE = Number(process.env.SURE ?? 15);
const TIK_MS = 1000 / 60;

const gecikmeler = [];
let onceki = performance.now();

const zamanlayici = setInterval(() => {
  const simdi = performance.now();
  gecikmeler.push(simdi - onceki);
  onceki = simdi;
}, TIK_MS);

setTimeout(() => {
  clearInterval(zamanlayici);

  const sirali = [...gecikmeler].sort((a, b) => a - b);
  const yuzdelik = (p) => sirali[Math.min(sirali.length - 1, Math.floor(sirali.length * p))];
  /*
   * "Geç" ölçütü bir TAM ADIM: 16.67 ms'lik hedefin üstüne bir adım
   * daha binmişse o tikte bir kare kaybedilmiş demektir. Rastgele
   * seçilmedi — istemcinin gördüğü boşluk tam olarak bu.
   */
  const gec = gecikmeler.filter((d) => d > TIK_MS * 2).length;

  console.log('\nTİK TEŞHİSİ — bu makine 60 Hz döngüyü tutabiliyor mu?\n');
  console.log(`süre: ${SURE} sn · ${gecikmeler.length} tik · hedef ${TIK_MS.toFixed(1)} ms\n`);
  console.log(`  p50 (tipik)   ${yuzdelik(0.5).toFixed(1)} ms`);
  console.log(`  p95           ${yuzdelik(0.95).toFixed(1)} ms`);
  console.log(`  p99           ${yuzdelik(0.99).toFixed(1)} ms`);
  console.log(`  en kötü       ${sirali[sirali.length - 1].toFixed(1)} ms`);
  console.log(`  geç tik       ${gec} / ${gecikmeler.length}  (%${(gec / gecikmeler.length * 100).toFixed(1)})`);

  const iyi = yuzdelik(0.95) < 25 && gec / gecikmeler.length < 0.05;
  console.log(`\n${iyi ? '✓ MAKİNE İYİ' : '✗ MAKİNE TİK KAÇIRIYOR'} — ${iyi
    ? 'gecikmenin kaynağı burası değil; ağa ve istemciye bak.'
    : 'CPU sınırı ya da komşu servisler tikleri geciktiriyor.'}`);
  console.log(
    '\nBu sayı AĞ GECİKMESİ DEĞİL — makinenin kendi zamanlayıcısı.'
    + '\nAğ için oyundaki gösterge ya da `ping rele.retrovoleybol.online`.',
  );
}, SURE * 1000);
