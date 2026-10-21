import { beforeAll, describe, expect, it } from 'vitest';
import Game from './Game.js';
import { drawBall, drawSultan } from './sprites.js';
import { drawNet } from './arena.js';

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

describe('çizim önbelleği', () => {
  beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = sahteCtx;
  });

  it('figür, top ve file ikinci çizimde de hata vermez', () => {
    const ctx = sahteCtx();
    const data = {
      id: 'gizel-orgen',
      number: 7,
      captain: true,
      colors: {
        primary: '#E30A17',
        secondary: '#FFFFFF',
        skin: '#E8B48A',
        hair: '#2A1810',
        accent: '#FFD24A',
      },
    };
    const opts = { x: 120, y: 420, scale: 3.4, pose: 'run', facing: 1, frame: 0.15 };
    expect(() => drawSultan(ctx, data, opts)).not.toThrow();
    expect(() => drawSultan(ctx, data, { ...opts, frame: 0.16 })).not.toThrow();
    expect(() => drawSultan(ctx, data, { ...opts, pose: 'dive' })).not.toThrow();
    const ball = { x: 450, y: 200, radius: 13, rotation: 0.4 };
    expect(() => drawBall(ctx, ball)).not.toThrow();
    expect(() => drawBall(ctx, { ...ball, rotation: 1.2 })).not.toThrow();
    expect(() => drawNet(ctx, 420)).not.toThrow();
    expect(() => drawNet(ctx, 420)).not.toThrow();
  });

  it('maç karesi önbellekli gölge ve figürle çizilir', () => {
    const canvas = {
      width: 900,
      height: 500,
      style: {},
      getContext: () => sahteCtx(),
      addEventListener() {},
      removeEventListener() {},
      getBoundingClientRect: () => ({ x: 0, y: 0, width: 900, height: 500 }),
    };
    const game = new Game(canvas, {
      mode: '1v1',
      difficulty: 'normal',
      homeIds: ['gizel-orgen'],
      format: 'single',
      opponentId: 'atlas',
    });
    expect(() => game.render()).not.toThrow();
    game.players.forEach((p) => {
      p.pose = 'run';
      p.runFrame = 0.42;
    });
    expect(() => game.render()).not.toThrow();
    game.destroy();
  });
});
