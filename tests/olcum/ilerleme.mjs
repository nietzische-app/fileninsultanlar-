/**
 * İLERLEME TEMPOSU ÖLÇÜMÜ
 *
 * Soru: fiyatlar doğru mu? Sezgiyle yanıtlanamaz — "150 FP çok mu"
 * sorusunun anlamı, maç başına ne kazanıldığına bağlı.
 *
 * Burada üç oyuncu profili benzetiliyor ve tek bir şey ölçülüyor:
 * KAÇINCI MAÇTA kaç kilit açılıyor. Ölçüt şu:
 *
 *   - İlk kilit ~5 maçtan önce açılmalı. Daha geç olursa ilk oturumda
 *     sistemin varlığı hiç hissedilmez.
 *   - Kadronun yarısı ~40 maç civarında açılmalı.
 *   - Tamamı bir hedef olarak kalmalı ama ulaşılmaz olmamalı.
 *
 * Çalıştır: node tests/olcum/ilerleme.mjs
 */

import {
  macKazanci,
  turnuvaKazanci,
  rozetKazanci,
  kilitliler,
  bedel,
  BASLANGIC_KADRO,
  TOPLAM_BEDEL,
  BEDELLER,
} from '../../src/game/ilerleme.js';
import { ROSTER } from '../../src/game/players.js';

/**
 * Bir maç sonucu üretir.
 *
 * İstatistikler profilin becerisine göre ölçekleniyor; sabit değerler
 * kullansaydık "iyi oyuncu daha hızlı ilerliyor mu" sorusunu ölçüm
 * hiç soramazdı.
 */
function mac({ kazandi, zorluk, format = 'classic', playMode = 'solo', beceri }) {
  const setSayisi = kazandi ? 2 : Math.random() < 0.45 ? 1 : 0;
  return {
    winner: kazandi ? 'home' : 'away',
    campaign: 'match',
    format,
    playMode,
    difficulty: zorluk,
    sets: { home: setSayisi, away: kazandi ? Math.round(Math.random()) : 2 },
    stats: {
      perfects: Math.round(4 + beceri * 10),
      blocks: Math.round(1 + beceri * 4),
      saves: Math.round(2 + beceri * 5),
      tipPoints: Math.random() < beceri * 0.6 ? 1 : 0,
    },
  };
}

/**
 * @param {{ad: string, kazanmaOrani: number, zorluk: string, beceri: number,
 *   turnuvaHer: number, rozetToplam: number}} profil
 */
function benzet(profil) {
  let puan = 0;
  let acilanlar = [];
  const kilometreTaslari = [];
  const toplamKilit = ROSTER.length - BASLANGIC_KADRO.length;
  let rozetKalan = profil.rozetToplam;

  for (let macNo = 1; macNo <= 400; macNo += 1) {
    const kazandi = Math.random() < profil.kazanmaOrani;
    puan += macKazanci(
      mac({ kazandi, zorluk: profil.zorluk, beceri: profil.beceri })
    ).toplam;

    // Rozetler ilk 60 maça yayılıyor — gerçekte de öyle oluyor
    if (rozetKalan > 0 && macNo % 5 === 0) {
      puan += rozetKazanci(['x']).toplam;
      rozetKalan -= 1;
    }
    // Arada bir turnuva; kazanılırsa kupa
    if (macNo % profil.turnuvaHer === 0 && Math.random() < profil.kazanmaOrani) {
      puan += turnuvaKazanci({ status: 'won' }).toplam;
    }

    // Alabildiğini hemen alan oyuncu — en hızlı ilerleme senaryosu
    for (;;) {
      const [hedef] = kilitliler(acilanlar);
      if (!hedef || bedel(hedef.id) > puan) break;
      puan -= bedel(hedef.id);
      acilanlar = [...acilanlar, hedef.id];
      kilometreTaslari.push({ sira: acilanlar.length, macNo });
    }
    if (acilanlar.length === toplamKilit) break;
  }

  return { kilometreTaslari, toplamKilit };
}

const PROFILLER = [
  { ad: 'ÇAYLAK   ', kazanmaOrani: 0.35, zorluk: 'KOLAY', beceri: 0.2, turnuvaHer: 25, rozetToplam: 6 },
  { ad: 'ORTALAMA ', kazanmaOrani: 0.55, zorluk: 'NORMAL', beceri: 0.5, turnuvaHer: 15, rozetToplam: 11 },
  { ad: 'USTA     ', kazanmaOrani: 0.8, zorluk: 'ZOR', beceri: 0.85, turnuvaHer: 10, rozetToplam: 15 },
];

/** Rastgelelik var; her profil çok kez koşturulup ortalaması alınıyor. */
const TEKRAR = 400;

console.log('İLERLEME TEMPOSU — ortalama kaçıncı maçta açılıyor\n');
console.log(`Kadro: ${ROSTER.length} oyuncu · ${BASLANGIC_KADRO.length} başlangıçta açık`);
console.log(`Kilitli: ${Object.keys(BEDELLER).length} · Toplam bedel: ${TOPLAM_BEDEL} FP\n`);

const bakilan = [1, 3, 7, 11, 14];
console.log('profil     ' + bakilan.map((n) => `${n}.kilit`.padStart(9)).join(''));
console.log('─'.repeat(11 + bakilan.length * 9));

for (const profil of PROFILLER) {
  const toplamlar = new Map(bakilan.map((n) => [n, []]));
  for (let i = 0; i < TEKRAR; i += 1) {
    const { kilometreTaslari } = benzet(profil);
    bakilan.forEach((n) => {
      const t = kilometreTaslari.find((k) => k.sira === n);
      if (t) toplamlar.get(n).push(t.macNo);
    });
  }
  const satir = bakilan.map((n) => {
    const dizi = toplamlar.get(n);
    if (dizi.length === 0) return '—'.padStart(9);
    const ort = dizi.reduce((a, b) => a + b, 0) / dizi.length;
    return ort.toFixed(0).padStart(9);
  });
  console.log(profil.ad + satir.join(''));
}

// Tek maçta ne kazanılıyor — fiyatları okurken ölçek lazım
console.log('\nTEK MAÇ KAZANCI');
[
  ['kolay, kaybetti ', { kazandi: false, zorluk: 'KOLAY', beceri: 0.2 }],
  ['normal, kazandı ', { kazandi: true, zorluk: 'NORMAL', beceri: 0.5 }],
  ['zor, kazandı    ', { kazandi: true, zorluk: 'ZOR', beceri: 0.85 }],
  ['antrenman       ', { kazandi: true, zorluk: 'NORMAL', beceri: 0.5, format: 'practice' }],
  ['çevrimiçi galip ', { kazandi: true, zorluk: 'NORMAL', beceri: 0.5, playMode: 'online' }],
].forEach(([ad, opt]) => {
  const orn = Array.from({ length: 500 }, () => macKazanci(mac(opt)).toplam);
  const ort = orn.reduce((a, b) => a + b, 0) / orn.length;
  console.log(`  ${ad} ${ort.toFixed(1).padStart(6)} FP`);
});
