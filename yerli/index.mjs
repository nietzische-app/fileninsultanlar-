/**
 * RETRO VOLEYBOL — tarayıcısız masaüstü istemcisi.
 *
 * Aynı motor, aynı protokol, tarayıcı yok: SDL penceresi, node-canvas
 * ile Canvas2D ve doğrudan QUIC/WebSocket bağlantısı.
 *
 * DÜRÜST BEKLENTİ: bu istemcinin AĞ gecikmesini düşürmesi beklenmiyor
 * ve ölçüm de düşürmediğini gösterdi — aynı ağda Node ile tarayıcı
 * birebir aynı sayıları verdi (ping 50/51, seğirme 3/1-5, gerilik
 * 30/32-38). Kazanabileceği yer varsa ekrana basma gecikmesi ve
 * tarayıcının kendi kare zamanlaması; ikisi de teşhis katmanının
 * ölçmediği şeyler.
 *
 * NE İÇİN İYİ:
 *   · Tarayıcının payını ölçüden ÇIKARMAK (aynı motor, aynı protokol)
 *   · WebTransport'u tarayıcı desteği beklemeden denemek
 *   · Uzun süreli dayanım koşumları
 *
 * Kullanım:
 *   cd yerli && npm install && npm start
 *   RELE=wss://rele.retrovoleybol.online npm start
 *   TANI=1 npm start          # sol üstte teşhis sayıları
 */

import sdl from '@kmamal/sdl';
import { createCanvas } from 'canvas';
import { kabukKur, sesiSustur } from './kabuk.mjs';

const RELE = process.env.RELE ?? 'ws://localhost:8787';
const TANI = process.env.TANI === '1';
const OLCEK = Number(process.env.OLCEK ?? 1.5);

// Kabuk MOTORDAN ÖNCE: motor içe aktarılırken ses modülü de yükleniyor
const kabuk = kabukKur({ kareHz: 60 });

const { default: Game } = await import('../src/game/Game.js');
const { default: Sfx } = await import('../src/game/audio.js');
const { GAME_WIDTH, GAME_HEIGHT } = await import('../src/game/constants.js');
const { PAKET_SURUM } = await import('../src/game/snapshot.js');
const { tasimaKur } = await import('../src/net/tasima.js');

sesiSustur(Sfx);

// =====================================================================
// Pencere ve çizim yüzeyi
// =====================================================================

const genislik = Math.round(GAME_WIDTH * OLCEK);
const yukseklik = Math.round(GAME_HEIGHT * OLCEK);

const pencere = sdl.video.createWindow({
  title: 'Retro Voleybol', width: genislik, height: yukseklik, resizable: false,
});

const tuval = createCanvas(GAME_WIDTH, GAME_HEIGHT);

/**
 * Tuvali pencereye basar.
 *
 * `toBuffer('raw')` küçük endian makinede BGRA veriyor ve SDL'e
 * söylediğimiz biçim de o. Yanlış biçim vermek sessizce mavi-kırmızı
 * yer değiştirmiş bir görüntü üretirdi — çalışıyor görünen ama yanlış
 * bir sonuç.
 */
function ekranaBas() {
  const bayt = tuval.toBuffer('raw');
  pencere.render(GAME_WIDTH, GAME_HEIGHT, GAME_WIDTH * 4, 'bgra32', bayt);
}

// =====================================================================
// Klavye — SDL olaylarını motorun beklediği window olaylarına çevir
// =====================================================================

/**
 * SDL tuş adı → tarayıcı `KeyboardEvent.key`.
 *
 * `key`, `code` DEĞİL. Motor `resolveKeyBinding(event.key)` çağırıyor
 * ve tablosu `a`, `d`, `w`, `s`, `' '` gibi ÜRETİLEN KARAKTERLERİ
 * tutuyor — `KeyA` gibi fiziksel tuş adlarını değil. İlk yazışta
 * `code` yollamıştım ve ön kontrol yakaladı: oyuncu hiç kıpırdamıyordu.
 * Belirtisi "tuşlar çalışmıyor" olurdu ve ağ sorunuyla karıştırılması
 * çok kolaydı.
 *
 * Hem WASD hem ok tuşları var: çevrimiçide motor ikisini de p1'e
 * yazıyor (bkz. `resolveKeyBinding`), yani oyuncu hangisini isterse.
 */
const TUS = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  a: 'a',
  d: 'd',
  w: 'w',
  s: 's',
  z: 'z',
  space: ' ',
  return: 'Enter',
};

pencere.on('keyDown', (o) => {
  const key = TUS[o.key];
  if (key) kabuk.olaylar.emit('keydown', { key, preventDefault() {} });
});
pencere.on('keyUp', (o) => {
  const key = TUS[o.key];
  if (key) kabuk.olaylar.emit('keyup', { key, preventDefault() {} });
});
pencere.on('focusLost', () => kabuk.olaylar.emit('blur', {}));

// =====================================================================
// Ağ
// =====================================================================

/** Node'da WebTransport yok; QUIC istemcisi varsa taşımaya enjekte edilir. */
async function wtYapiciBul() {
  try {
    const { WebTransport } = await import('@fails-components/webtransport');
    return (adres) => new WebTransport(adres);
  } catch {
    return undefined; // WebSocket'e düşülecek
  }
}

const rastgeleId = () => Array.from(
  { length: 16 },
  () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)],
).join('');

const tasima = await tasimaKur(RELE, { wtYapici: await wtYapiciBul() });
console.log(`bağlandı: ${RELE} · taşıma: ${tasima.ad}`);

let oyun = null;
let durum = 'Sıraya giriliyor…';

tasima.onKapandi = () => {
  durum = 'Bağlantı koptu';
  oyun = null;
};

tasima.onMesaj = (m) => {
  if (m.t === 'kimlik') {
    durum = 'Rakip aranıyor…';
    tasima.yolla({ t: 'hizli-esles' });
    return;
  }
  if (m.t === 'hata') { durum = `Hata: ${m.kod}`; return; }
  if (m.t === 'mac') { macKur(m); return; }
  if (m.t === 'bitis') { durum = 'Maç bitti'; oyun?.destroy(); oyun = null; return; }
  oyun?.agPaketAl(m);
};

tasima.yolla({
  t: 'kimlik', id: rastgeleId(), gizli: rastgeleId(), ad: 'YERLİ', surum: PAKET_SURUM,
});

/** @param {object} mesaj Rölenin `mac` mesajı */
function macKur(mesaj) {
  durum = '';
  oyun = new Game(tuval, {
    ...(mesaj.cfg ?? {}),
    playMode: 'vs',
    agRol: 'misafir',
    agYuvam: mesaj.yuva ?? 'p1',
    agRakipAd: mesaj.rakip?.ad ?? null,
    agGonder: (paket) => tasima.yolla(paket),
  });
  oyun.start();
  console.log(`maç kuruldu · yuva=${mesaj.yuva} · rakip=${mesaj.rakip?.ad ?? '?'}`);
}

// =====================================================================
// Çizim döngüsü
// =====================================================================

const ctx = tuval.getContext('2d');

/**
 * Ekranı tazeler.
 *
 * Motor kendi `requestAnimationFrame` döngüsünde çiziyor (kabuk onu
 * sağlıyor); burada yapılan iş yalnız sonucu pencereye basmak ve maç
 * yokken bir bilgi ekranı göstermek.
 */
setInterval(() => {
  if (!oyun) {
    ctx.fillStyle = '#0E1116';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.fillStyle = '#FFD24A';
    ctx.font = '16px sans-serif';
    ctx.fillText('RETRO VOLEYBOL — YERLİ İSTEMCİ', 24, 40);
    ctx.fillStyle = '#ffffffaa';
    ctx.font = '12px sans-serif';
    ctx.fillText(durum, 24, 70);
    ctx.fillText(`taşıma: ${tasima.ad}`, 24, 92);
    ctx.fillText('karşı taraftan ÇEVRİMİÇİ → HEMEN OYNA', 24, 114);
  } else if (TANI) {
    const t = oyun.agTaniOzeti?.();
    if (t && t.gerilik !== null) {
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(4, 4, 150, 76);
      ctx.fillStyle = '#7CE38B';
      ctx.font = '9px monospace';
      const satirlar = [
        `taşıma ${tasima.ad === 'webtransport' ? 'WT' : 'WS'}`,
        `ping ${t.ping ?? '-'}ms  seğ ${t.segirme ?? '-'}ms`,
        `paket ${t.paketAralik ?? '-'}ms`,
        `tampon ${t.tampon}ms  ger ${t.gerilik}ms`,
        `FAZLA ${t.gerilik - t.tampon}ms`,
        `kare ${t.kare ?? '-'}ms`,
      ];
      satirlar.forEach((s, i) => ctx.fillText(s, 10, 18 + i * 11));
    }
  }
  ekranaBas();
}, 1000 / 60);

pencere.on('close', () => {
  oyun?.destroy();
  kabuk.durdur();
  process.exit(0);
});
