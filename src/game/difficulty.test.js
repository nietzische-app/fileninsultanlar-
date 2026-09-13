import { describe, expect, it, beforeAll } from 'vitest';
import { DIFFICULTY, NET, PHASE, scaleDifficulty } from './constants.js';
import Game from './Game.js';

/**
 * Hücumu yumuşatmak servis karşılamayı bozmamalı. Bu testler o ayrımı
 * bekçiler: receive* ralli kollarından bağımsız, zor servis sapması
 * temas eşiğinin altında, rampa receive tabanını ezmez.
 */

describe('kademe bantları', () => {
  it('her kademede servis sapması ralli sapmasından küçük', () => {
    Object.values(DIFFICULTY).forEach((d) => {
      expect(d.receiveError).toBeLessThan(d.error);
      expect(d.receiveSpeed).toBeGreaterThanOrEqual(d.speed);
      expect(d.receiveReaction).toBeLessThanOrEqual(d.reaction);
    });
  });

  it('kolay < normal < zor hücumda', () => {
    expect(DIFFICULTY.kolay.power).toBeLessThan(DIFFICULTY.normal.power);
    expect(DIFFICULTY.normal.power).toBeLessThan(DIFFICULTY.zor.power);
    expect(DIFFICULTY.kolay.placement).toBeLessThan(DIFFICULTY.normal.placement);
    expect(DIFFICULTY.normal.placement).toBeLessThan(DIFFICULTY.zor.placement);
    expect(DIFFICULTY.kolay.blockSkill).toBeLessThan(DIFFICULTY.normal.blockSkill);
    expect(DIFFICULTY.kolay.error).toBeGreaterThan(DIFFICULTY.zor.error);
  });

  it('kolay serviste de zordan daha sapmalı kalır', () => {
    expect(DIFFICULTY.kolay.receiveError).toBeGreaterThan(DIFFICULTY.normal.receiveError);
    expect(DIFFICULTY.normal.receiveError).toBeGreaterThan(DIFFICULTY.zor.receiveError);
  });
});

describe('scaleDifficulty — receive rampası', () => {
  it('adım 0 kopya döner', () => {
    expect(scaleDifficulty(DIFFICULTY.normal, 0)).toEqual(DIFFICULTY.normal);
  });

  it('yumuşatmada receiveError, ralli error kadar açılmaz', () => {
    const soft = scaleDifficulty(DIFFICULTY.normal, -1.8);
    const errorGain = soft.error / DIFFICULTY.normal.error;
    const receiveGain = soft.receiveError / DIFFICULTY.normal.receiveError;
    expect(receiveGain).toBeLessThan(errorGain);
    expect(soft.receiveError).toBeLessThan(soft.error);
  });

  it('yumuşak başlangıçta servis hızı tabanın altına inmez', () => {
    const soft = scaleDifficulty(DIFFICULTY.kolay, -2.5);
    expect(soft.receiveSpeed).toBeGreaterThanOrEqual(0.78);
    expect(soft.receiveError).toBeLessThanOrEqual(95);
  });

  it('sertleşmede receiveError temas eşiğinin çok altına inmez', () => {
    const hard = scaleDifficulty(DIFFICULTY.zor, 4);
    expect(hard.receiveError).toBeGreaterThanOrEqual(24);
    expect(hard.receiveSpeed).toBeLessThanOrEqual(1.08);
  });

  it('hücum kolları hâlâ rampa ile hareket eder', () => {
    const up = scaleDifficulty(DIFFICULTY.normal, 1);
    expect(up.power).toBeGreaterThan(DIFFICULTY.normal.power);
    expect(up.speed).toBeGreaterThan(DIFFICULTY.normal.speed);
    expect(up.error).toBeLessThan(DIFFICULTY.normal.error);
    expect(up.serveSkill).toBeGreaterThan(DIFFICULTY.normal.serveSkill);
  });
});

function sahteCtx() {
  return new Proxy({}, {
    get: (_t, k) => {
      if (k === 'canvas') return { width: 900, height: 500 };
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient') {
        return () => ({ addColorStop() {} });
      }
      return () => {};
    },
    set: () => true,
  });
}

function sahteCanvas() {
  const ctx = sahteCtx();
  return {
    width: 900,
    height: 500,
    style: {},
    getContext: () => ctx,
    addEventListener() {},
    removeEventListener() {},
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 900, height: 500 }),
  };
}

function servisKarsilama(difficulty) {
  const g = new Game(sahteCanvas(), {
    mode: '1v1',
    difficulty,
    homeIds: ['gizel-orgen'],
    format: 'single',
    opponentId: 'atlas',
  });
  g.emitState = () => {};
  g.render = () => {};
  g.beginServe();
  // Orta bant — sahada kalan, insan servisinin tipik hali.
  g.serve.power = 0.68;
  g.serve.aim = 0.1;
  g.launchServe();

  const away = g.players.find((p) => p.side === 'away');
  let crossed = false;
  let touched = false;
  for (let i = 0; i < 200 && g.phase === PHASE.RALLY; i += 1) {
    g.update(1 / 60);
    if (g.ball.x > NET.x) crossed = true;
    if (g.ball.lastHitBy === away.id) touched = true;
  }
  g.destroy?.();
  return { crossed, touched };
}

function oran(difficulty, n = 16) {
  let crossed = 0;
  let touched = 0;
  for (let i = 0; i < n; i += 1) {
    const r = servisKarsilama(difficulty);
    if (!r.crossed) continue;
    crossed += 1;
    if (r.touched) touched += 1;
  }
  return { rate: crossed ? touched / crossed : 0, crossed };
}

describe('canlı servis karşılama', () => {
  beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = sahteCtx;
  });

  it('hücum yumuşatılsa da rakip tipik servisi tutar', () => {
    const kolay = oran('kolay');
    const zor = oran('zor');
    expect(kolay.crossed).toBeGreaterThan(6);
    expect(zor.crossed).toBeGreaterThan(6);
    expect(kolay.rate).toBeGreaterThan(0.5);
    expect(zor.rate).toBeGreaterThan(0.75);
  });
});



