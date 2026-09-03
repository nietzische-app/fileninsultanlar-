import { chromium } from 'playwright';
const URL = process.env.OYUN_URL ?? 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('HATA', String(e).slice(0, 200)));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(1500);
const rows = await page.evaluate(async () => {
  const { default: Game } = await import('/src/game/Game.js');
  const { OPPONENT_TEAMS } = await import('/src/game/opponents.js');
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
  for (const t of OPPONENT_TEAMS) {
    let ev = 0, rak = 0;
    for (let k = 0; k < 12; k += 1) {
      let done = false;
      const g = new Game(canvas, { mode:'1v1', difficulty:'normal', homeIds:['gizem-orge'],
        format:'single', opponentId:t.id, onState(){}, onFinish(){ done = true; } });
      g.emitState = () => {};
      const oA = g.awardPoint.bind(g);
      g.awardPoint = (w,l,m) => { if (w==='home') ev+=1; else rak+=1; return oA(w,l,m); };
      let s = 0;
      while (!done && s < 60*60*6) { drive(g); g.update(1/60); s += 1; }
      g.destroy?.();
    }
    out.push({ rakip: t.id, ad: t.shortName,
      'SAYI PAYI (ev) %': Math.round(ev/(ev+rak)*100),
      çarpanlar: JSON.stringify(t.modifiers ?? {}) });
  }
  out.sort((a,b) => b['SAYI PAYI (ev) %'] - a['SAYI PAYI (ev) %']);
  return out;
});
await browser.close();
console.log('(sayı payı YÜKSEK = rakip ZAYIF)');
console.table(rows);
