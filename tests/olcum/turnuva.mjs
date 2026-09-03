import { chromium } from 'playwright';

/**
 * Turnuva zorluk rampası gerçekten hissediliyor mu?
 *
 * Her tur kendi `ramp` adımıyla ve kendi rakibiyle koşturulur. Sayı payı
 * turdan tura DÜŞMELİ; düşmüyorsa rampa kâğıt üstünde kalıyor demektir.
 */
const URL = process.env.OYUN_URL ?? 'http://localhost:5173/';
const MAC = Number(process.env.MAC ?? 8);
const ZORLUK = process.env.ZORLUK ?? 'normal';

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('HATA', String(e).slice(0, 200)));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(1500);

const rows = await page.evaluate(async ({ mac, zorluk }) => {
  const { default: Game } = await import('/src/game/Game.js');
  const { TOURNAMENT_ROUNDS } = await import('/src/game/tournament.js');
  const { DIFFICULTY, scaleDifficulty } = await import('/src/game/constants.js');
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
  const out = [];
  for (const tur of TOURNAMENT_ROUNDS) {
    let ev = 0, rak = 0, kazanma = 0, oynanan = 0;
    for (let k = 0; k < mac; k += 1) {
      let done = false, kim = null;
      const g = new Game(canvas, {
        mode: '1v1', difficulty: zorluk, homeIds: ['gizem-orge'],
        format: tur.format, opponentId: tur.opponentId,
        rules: { ...tur.rules }, difficultyRamp: tur.ramp,
        campaign: 'tournament', roundLabel: tur.label,
        onState(){}, onFinish(r){ done = true; kim = r.winner; },
      });
      g.emitState = () => {};
      const oA = g.awardPoint.bind(g);
      g.awardPoint = (w, l, m) => { if (w === 'home') ev += 1; else rak += 1; return oA(w, l, m); };
      let s = 0;
      while (!done && s < 60 * 60 * 8) { drive(g); g.update(1/60); s += 1; }
      if (kim) { oynanan += 1; if (kim === 'home') kazanma += 1; }
      g.destroy?.();
    }
    const d = scaleDifficulty(DIFFICULTY[zorluk], tur.ramp);
    out.push({
      tur: tur.label, rakip: tur.opponentId, ramp: tur.ramp,
      'SAYI PAYI (ev) %': Math.round(ev / (ev + rak) * 100),
      'maç kazanma %': oynanan ? Math.round(kazanma / oynanan * 100) : null,
      'AI hız': +d.speed.toFixed(2), 'AI tepki': +d.reaction.toFixed(3),
      'AI blok': +(d.blockSkill ?? 0).toFixed(2),
    });
  }
  return out;
}, { mac: MAC, zorluk: ZORLUK });
await browser.close();
console.log(`zorluk: ${ZORLUK}`);
console.table(rows);
