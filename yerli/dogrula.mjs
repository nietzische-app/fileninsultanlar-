/**
 * YERLİ İSTEMCİ ÖN KONTROLÜ — pencere açmadan.
 *
 * `index.mjs` bir SDL penceresi açıyor ve ekransız bir makinede (CI,
 * sunucu, konteyner) bu mümkün değil. Ama asıl riskli kısım pencere
 * DEĞİL: motorun tarayıcı olmadan kurulup gerçekten ÇİZMESİ.
 *
 * Bu betik onu sınıyor:
 *   1. Kabuk motoru ayakta tutuyor mu (document/window/rAF)
 *   2. Motor node-canvas'a GERÇEKTEN piksel basıyor mu
 *   3. Klavye eşlemesi oyuncuyu oynatıyor mu
 *
 * İkincisi neden önemli: `getContext('2d')` hata vermeden boş bir tuval
 * de döndürebilir. "Çöküyor mu" diye bakan bir kontrol, siyah bir
 * pencereyi başarı sayardı.
 *
 * Kullanım: node yerli/dogrula.mjs
 */

import { createCanvas } from 'canvas';
import { kabukKur, sesiSustur } from './kabuk.mjs';

let hata = 0;
const kontrol = (ad, gecti, detay = '') => {
  console.log(`${gecti ? '✓' : '✗'} ${ad}${detay ? ` — ${detay}` : ''}`);
  if (!gecti) hata += 1;
};

const kabuk = kabukKur({ kareHz: 60 });
const { default: Game } = await import('../src/game/Game.js');
const { default: Sfx } = await import('../src/game/audio.js');
const { GAME_WIDTH, GAME_HEIGHT, PHASE } = await import('../src/game/constants.js');
sesiSustur(Sfx);

kontrol('kabuk kuruldu', typeof globalThis.document?.createElement === 'function');
kontrol('rAF sağlanıyor', typeof globalThis.requestAnimationFrame === 'function');

const tuval = createCanvas(GAME_WIDTH, GAME_HEIGHT);
const ctx = tuval.getContext('2d');

let oyun = null;
try {
  oyun = new Game(tuval, {
    mode: '1v1', format: 'single', difficulty: 'normal', playMode: 'solo',
  });
  oyun.start();
} catch (e) {
  kontrol('motor kuruldu', false, e.message);
}
kontrol('motor kuruldu ve başladı', Boolean(oyun?.running));

// Motorun kendi rAF döngüsü birkaç kare çizsin
await new Promise((r) => { setTimeout(r, 500); });

/*
 * ÇİZİM GERÇEKTEN OLDU MU. Tek renk bir tuval "çizim yapıldı" demek
 * değil; sahne çizildiyse ekranda BİRDEN ÇOK renk olmalı.
 */
const veri = ctx.getImageData(0, 0, GAME_WIDTH, GAME_HEIGHT).data;
const renkler = new Set();
for (let i = 0; i < veri.length; i += 4 * 97) {
  renkler.add(`${veri[i]},${veri[i + 1]},${veri[i + 2]}`);
}
kontrol(
  'motor tuvale GERÇEKTEN çiziyor',
  renkler.size > 8,
  `${renkler.size} ayrı renk örneklendi`,
);

// Boş/siyah tuval ayrıca ayıklanıyor — yukarıdaki sayıya güvenmemek için
const siyah = [...renkler].every((r) => r === '0,0,0');
kontrol('tuval siyah DEĞİL', !siyah);

/*
 * KLAVYE. Motor `window` üstünde dinliyor; kabuk o olayları taşıyor.
 * Eşleme kopuksa belirti "oyuncu kıpırdamıyor" olur ve ağ sorunuyla
 * karıştırılması çok kolaydır.
 */
oyun.phase = PHASE.RALLY;
oyun.phaseTimer = 99;
const ben = oyun.players.find((p) => p.controlSlot === 'p1');
const once = ben.x;
kabuk.olaylar.emit('keydown', { key: 'ArrowRight', preventDefault() {} });
await new Promise((r) => { setTimeout(r, 400); });
kabuk.olaylar.emit('keyup', { key: 'ArrowRight', preventDefault() {} });
kontrol(
  'klavye oyuncuyu OYNATIYOR',
  Math.abs(ben.x - once) > 5,
  `${once.toFixed(0)} → ${ben.x.toFixed(0)} px`,
);

oyun.destroy();
kabuk.durdur();

console.log(`\n${hata === 0 ? 'YERLİ İSTEMCİ ÖN KONTROLÜ TAMAM' : `${hata} sorun`}`);
process.exit(hata === 0 ? 0 : 1);
