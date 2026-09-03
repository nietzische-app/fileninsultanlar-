import { chromium } from 'playwright';

const URL = process.env.OYUN_URL ?? 'http://localhost:5173/';

/**
 * SAYI PAYI ölçümü.
 *
 * Maç kazanma oranı yanıltıcı: bot eşiğin bir tık üstündeyse maçların
 * neredeyse tamamını, bir tık altındaysa neredeyse hiçbirini kazanıyor.
 * Aynı durumda arka arkaya %50 ve %100 ölçtüm — ölçüt doyuma gidiyor.
 * Sayı payı sürekli bir büyüklük, tek tek rallilerden geliyor ve
 * varyansı çok daha düşük.
 */
const N = Number(process.env.N ?? 10);
/*
 * Botun vuruş tuşuna bastığı mesafe (piksel).
 *
 * Varsayılan 78, topun uzağından basıp BASILI TUTAN bir oyuncuyu taklit
 * eder. Vuruş "basılı tutulan hâl"den kısa süreli salınıma çevrilince
 * bu strateji cezalandırılır oldu — ölçüm de düştü. Düşüşün salınımdan
 * mı yoksa botun artık ödüllendirilmeyen stratejisinden mi geldiğini
 * ayırmak için basış mesafesi ayarlanabilir: küçük değer, topa
 * yaklaşınca basan (insan gibi oynayan) bir bot demek.
 */
const BASIS_YARICAP = Number(process.env.BASIS_YARICAP ?? 78);
const LEVELS = (process.env.LEVELS ?? 'kolay,normal,zor').split(',');
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('HATA', String(e).slice(0, 200)));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(1500);
const rows = await page.evaluate(async ({ n, levels, basisYaricap }) => {
  const { default: Game } = await import('/src/game/Game.js');
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
    const near = Math.hypot(dx, b.y - (p.y - 40)) < basisYaricap;
    if (near && !i.action) g.actionPresses.p1 += 1;
    i.action = near; i.dive = false;
  }
  const out = [];
  for (const [label, cfg] of levels.map((d) => [`1v1 ${d}`, { mode:'1v1', difficulty:d, homeIds:['gizem-orge'] }])
      .concat([['2v2 normal', { mode:'2v2', difficulty:'normal', homeIds:['gizem-orge','zehra-gunes'] }]])) {
    let homePts = 0, awayPts = 0, touchSum = 0, rallies = 0, hT = 0, pT = 0;
    for (let k = 0; k < n; k += 1) {
      let done = false;
      const g = new Game(canvas, { ...cfg, format:'single', opponentId:'atlas',
        onState(){}, onFinish(){ done = true; } });
      g.emitState = () => {};
      const orig = g.awardPoint.bind(g);
      g.awardPoint = (w, l, m) => { if (w === 'home') homePts += 1; else awayPts += 1; return orig(w, l, m); };
      let steps = 0, prev = null, last = null;
      while (!done && steps < 60 * 60 * 8) {
        drive(g); g.update(1/60); steps += 1;
        if (g.ball.lastHitBy !== last) {
          last = g.ball.lastHitBy;
          const h = g.players.find((p) => p.id === last);
          if (h && h.side === 'home') { if (h.controlled) hT += 1; else pT += 1; }
        }
        if (prev === 'rally' && g.phase !== 'rally') { rallies += 1; touchSum += g.stats?.rallyTouches ?? 0; }
        prev = g.phase;
      }
      g.destroy?.();
    }
    const tot = homePts + awayPts;
    out.push({ seviye: label, 'SAYI PAYI (ev) %': tot ? Math.round(homePts/tot*100) : null,
      sayı: tot, 'ralli temas': rallies ? +(touchSum/rallies).toFixed(2) : null,
      'insan payı %': (hT+pT) ? Math.round(hT/(hT+pT)*100) : null });
  }
  return out;
}, { n: N, levels: LEVELS, basisYaricap: BASIS_YARICAP });
await browser.close();
console.table(rows);
