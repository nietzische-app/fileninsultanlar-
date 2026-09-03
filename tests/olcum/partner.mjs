import { chromium } from 'playwright';

/**
 * 2v2'de takım arkadaşının AKTİFLİĞİ.
 *
 * Yalnızca "kaç topa dokundu" yetmiyor: şikâyet "top gelmeden hareket
 * etmiyor, blok koymuyor" idi. Bu yüzden hareket, sıçrama, blok ve
 * file dibinde geçirilen zaman ayrı ayrı sayılıyor.
 */
const URL = process.env.OYUN_URL ?? 'http://localhost:5173/';
const MAC = Number(process.env.MAC ?? 8);

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('HATA', String(e).slice(0, 200)));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(1500);

const out = await page.evaluate(async ({ mac }) => {
  const { default: Game } = await import('/src/game/Game.js');
  const { NET } = await import('/src/game/constants.js');
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

  const s = { kare: 0, hareket: 0, sicrama: 0, blokBolge: 0, temas: 0,
              insanTemas: 0, rallikare: 0, uzaklik: 0, blok: 0, blokTemas: 0 };
  for (let n = 0; n < mac; n += 1) {
    let done = false;
    const g = new Game(canvas, { mode:'2v2', difficulty:'normal',
      homeIds:['gizem-orge','zehra-gunes'], format:'single', opponentId:'atlas',
      onState(){}, onFinish(){ done = true; } });
    g.emitState = () => {};
    const oH = g.hitBall.bind(g);
    g.hitBall = (p, ...r) => {
      if (p.side === 'home') {
        if (p.controlled) s.insanTemas += 1;
        else {
          s.temas += 1;
          // File dibinde havada yapılan temas = blok
          if (!p.onGround && Math.abs(NET.x - p.x) < 140) s.blokTemas += 1;
        }
      }
      return oH(p, ...r);
    };
    let steps = 0, oncekiY = null;
    while (!done && steps < 60 * 60 * 8) {
      drive(g); g.update(1/60); steps += 1;
      if (g.phase !== 'rally') continue;
      const partner = g.players.find((p) => p.side === 'home' && !p.controlled);
      if (!partner) continue;
      s.rallikare += 1;
      if (partner.input.left || partner.input.right) s.hareket += 1;
      if (oncekiY !== null && partner.onGround === false && oncekiY === true) {
        s.sicrama += 1;
        if (Math.abs(NET.x - partner.x) < 140) s.blok += 1;
      }
      oncekiY = partner.onGround;
      // File dibi = blok bölgesi (kendi sahasının file tarafındaki 130px)
      if (NET.x - partner.x < 130) s.blokBolge += 1;
      s.uzaklik += Math.abs(g.ball.x - partner.x);
    }
    g.destroy?.();
  }
  const tt = s.temas + s.insanTemas;
  return {
    'ralli karesi': s.rallikare,
    'PARTNER hareket ediyor %': +(s.hareket / s.rallikare * 100).toFixed(1),
    'file dibinde (blok bölgesi) %': +(s.blokBolge / s.rallikare * 100).toFixed(1),
    'sıçrama / 100 kare': +(s.sicrama / s.rallikare * 100).toFixed(2),
    'topa ortalama uzaklık px': Math.round(s.uzaklik / s.rallikare),
    'ev temasları insan/partner': `${s.insanTemas} / ${s.temas}`,
    'partner temas payı %': tt ? +(s.temas / tt * 100).toFixed(1) : 0,
    'file dibinde sıçrama (blok denemesi)': s.blok,
    'blokla temas': s.blokTemas,
  };
}, { mac: MAC });
await browser.close();
console.log(JSON.stringify(out, null, 1));
