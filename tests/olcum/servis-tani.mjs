import { chromium } from 'playwright';

/**
 * Servis karşılama tanısı.
 *
 * Ev sahibi BİLİNÇLİ servis atar (yüksek güç + güvenli bandın derin ucu) —
 * insanın yaptığı şey. Karşı tarafın AI'ı topa dokunabiliyor mu?
 * "As" = kimse dokunmadan yere düşen, sahada kalan servis.
 */
const URL = process.env.OYUN_URL ?? 'http://localhost:5173/';
const N = Number(process.env.N ?? 120);

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('SAYFA HATASI:', String(e).slice(0, 300)));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(1500);

const out = await page.evaluate(async ({ n }) => {
  const { default: Game } = await import('/src/game/Game.js');
  const { safeAimRange, meterToAim } = await import('/src/game/serve.js');
  const { GROUND_Y } = await import('/src/game/constants.js');

  const stub = new Proxy({}, { get: (_t, k) => {
    if (k === 'canvas') return { width: 900, height: 500 };
    if (k === 'measureText') return () => ({ width: 10 });
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
    return () => {};
  }, set: () => true });
  const canvas = { width: 900, height: 500, getContext: () => stub,
    addEventListener() {}, removeEventListener() {},
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 900, height: 500 }), style: {} };

  /** Bilinçli servis: verilen güçte güvenli bandın derin ucuna nişan al. */
  function aimFor(power, serveStat) {
    const band = safeAimRange({ power, toOpponent: 1, serveStat });
    if (!band) return null;
    // Bandın derin ucundan biraz içeride kal (insan da tam uca basmaz)
    const m = band.max - (band.max - band.min) * 0.15;
    return meterToAim(m);
  }

  function trial(difficulty, power) {
    const game = new Game(canvas, { mode: '1v1', difficulty, homeIds: ['gizem-orge'],
      format: 'single', opponentId: 'atlas', onState: () => {}, onFinish: () => {} });
    game.emitState = () => {};
    const dt = 1 / 60;
    let steps = 0;
    // Servise kadar ilerle
    while (game.phase !== 'serve' && steps < 1200) { game.update(dt); steps += 1; }
    if (game.phase !== 'serve') { game.destroy?.(); return null; }
    if (game.servingSide !== 'home') { game.destroy?.(); return null; }
    const server = game.players.find((p) => p.id === game.serve.serverId);
    const aim = aimFor(power, server?.data?.stats?.serve ?? 70);
    if (aim === null) { game.destroy?.(); return null; }
    game.serve.power = power;
    game.serve.aim = aim;
    game.launchServe();

    // Ralliyi izle: karşı taraf servise dokunabildi mi?
    let touched = false;
    let minGap = Infinity;   // topun yere indiği an alıcıyla arasındaki yatay mesafe
    let steps2 = 0;
    while (game.phase === 'rally' && steps2 < 600) {
      game.update(dt);
      steps2 += 1;
      if (!game.ball.serveUntouched) { touched = true; break; }
      const rec = game.players.find((p) => p.side === 'away');
      if (rec) minGap = Math.min(minGap, Math.abs(game.ball.x - rec.x));
    }
    const out_ = game.ball.serveOut;
    const landedSide = game.ball.x < 450 ? 'home' : 'away';
    game.destroy?.();
    return { touched, out: out_, landedSide, minGap, ballY: GROUND_Y };
  }

  const rows = [];
  for (const difficulty of ['kolay', 'normal', 'zor']) {
    for (const power of [0.55, 0.75, 0.95]) {
      let ok = 0, aces = 0, outs = 0, gapSum = 0;
      for (let k = 0; k < n; k += 1) {
        const r = trial(difficulty, power);
        if (!r) continue;
        ok += 1;
        if (r.out) { outs += 1; continue; }
        if (!r.touched) { aces += 1; gapSum += Math.min(r.minGap, 400); }
      }
      const scored = ok - outs;
      rows.push({
        seviye: difficulty, güç: power, deneme: ok,
        'aut %': ok ? Math.round((outs / ok) * 100) : null,
        'AS % (sahada kalan servislerde)': scored ? Math.round((aces / scored) * 100) : null,
        'as sayısı': aces,
        'as anında en yakın mesafe px': aces ? Math.round(gapSum / aces) : null,
      });
    }
  }
  return rows;
}, { n: N });

await browser.close();
console.table(out);
