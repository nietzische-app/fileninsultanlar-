import { chromium } from 'playwright';

const URL = process.env.OYUN_URL ?? 'http://localhost:5173/';

/**
 * Gerçekleşen her temasta, topun kenarı ile sprite'ın kutusu arasındaki
 * boşluk. 0 ve altı = top gövdeye değmiş/binmiş demektir.
 */
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('HATA', String(e).slice(0, 200)));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(1500);
const out = await page.evaluate(async () => {
  const { default: Game } = await import('/src/game/Game.js');
  const { SPRITE_UNITS_W, SPRITE_UNITS_H } = await import('/src/game/sprites.js');
  const { PLAYER } = await import('/src/game/constants.js');
  const stub = new Proxy({}, { get: (_t, k) => {
    if (k === 'canvas') return { width: 900, height: 500 };
    if (k === 'measureText') return () => ({ width: 10 });
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop(){} });
    return () => {}; }, set: () => true });
  const canvas = { width:900,height:500,getContext:()=>stub,addEventListener(){},removeEventListener(){},
    getBoundingClientRect:()=>({x:0,y:0,width:900,height:500}),style:{} };
  function drive(g) {
    const p = g.players?.find((x) => x.controlled); const b = g.ball; const i = g.inputs?.p1;
    if (!p || !b || !i) return;
    const dx = b.x - p.x;
    i.left = dx < -8; i.right = dx > 8;
    i.up = Math.abs(dx) < 70 && b.y < p.y - 40;
    const near = Math.hypot(dx, b.y - (p.y - 40)) < 78;
    if (near && !i.action) g.actionPresses.p1 += 1;
    i.action = near; i.dive = false;
  }
  const u = PLAYER.spriteScale;
  const yariGen = (SPRITE_UNITS_W / 2) * u;
  const yuk = SPRITE_UNITS_H * u;
  const bosluklar = [];
  const havada = [];
  for (let n = 0; n < 8; n += 1) {
    let done = false;
    const g = new Game(canvas, { mode:'1v1', difficulty:'normal', homeIds:['gizem-orge'],
      format:'single', opponentId:'atlas', onState(){}, onFinish(){ done = true; } });
    g.emitState = () => {};
    const asil = g.hitBall.bind(g);
    g.hitBall = function (player, ...rest) {
      const b = g.ball;
      // Sprite kutusu: ayaklar player.y'de, tepe player.y - yuk
      const solK = player.x - yariGen, sagK = player.x + yariGen;
      const ustK = player.y - yuk, altK = player.y;
      const dx = Math.max(solK - b.x, 0, b.x - sagK);
      const dy = Math.max(ustK - b.y, 0, b.y - altK);
      const bosluk = Math.hypot(dx, dy) - b.radius;   // topun KENARI ile kutu arası
      bosluklar.push(bosluk);
      if (!player.onGround) havada.push(bosluk);
      return asil(player, ...rest);
    };
    let steps = 0;
    while (!done && steps < 60 * 60 * 6) { drive(g); g.update(1/60); steps += 1; }
    g.destroy?.();
  }
  const ozet = (a) => {
    if (!a.length) return null;
    const s = [...a].sort((x, y) => x - y);
    const q = (p) => +s[Math.floor(s.length * p)].toFixed(1);
    return { adet: a.length, 'değiyor %': +(a.filter((v) => v <= 0).length / a.length * 100).toFixed(1),
      p10: q(0.1), ortanca: q(0.5), p90: q(0.9), 'en uzak': +s[s.length - 1].toFixed(1) };
  };
  return { 'sprite yarı gen': +yariGen.toFixed(1), 'sprite yük': +yuk.toFixed(1),
    tum: ozet(bosluklar), havadaVuruş: ozet(havada) };
});
await browser.close();
console.log('sprite yarı genişlik', out['sprite yarı gen'], 'yükseklik', out['sprite yük']);
console.log('TÜM TEMASLAR      ', JSON.stringify(out.tum));
console.log('HAVADAKİ VURUŞLAR ', JSON.stringify(out.havadaVuruş));
