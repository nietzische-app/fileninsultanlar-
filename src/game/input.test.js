import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import Game from './Game.js';

/**
 * Girdi yönlendirmesi.
 *
 * `setInput` eskiden yuvadan bağımsızdı: ne yazılırsa p1'e giderdi.
 * Ağ üzerinden gelen ikinci oyuncunun tuşlarını koyacak yer yoktu.
 * Yuva artık parametre; bu testler o sözleşmeyi tutuyor, çünkü online
 * tarafın tamamı buna dayanacak.
 */

/** Çizim çağrılarını yutan 2B bağlam taklidi. */
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

/** Canvas taklidi — çizim çağrılarını yutar. */
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

describe('girdi yuvaları', () => {
  let game;

  beforeAll(() => {
    // Arka plan önbelleği kendi canvas'ını yaratıyor; jsdom'da getContext
    // yok ve her kurulumda gürültülü bir "Not implemented" basıyor.
    HTMLCanvasElement.prototype.getContext = sahteCtx;
  });

  beforeEach(() => {
    game = new Game(sahteCanvas(), {
      mode: '2v2',
      difficulty: 'normal',
      homeIds: ['gizem-orge', 'zehra-gunes'],
      format: 'single',
      opponentId: 'atlas',
    });
  });

  it('varsayılan yuva p1', () => {
    game.setInput('right', true);
    expect(game.inputs.p1.right).toBe(true);
    expect(game.inputs.p2.right).toBe(false);
  });

  it('p2 yuvası p1 girdisine dokunmaz', () => {
    game.setInput('left', true, 'p2');
    expect(game.inputs.p2.left).toBe(true);
    expect(game.inputs.p1.left).toBe(false);
  });

  it('vuruş basışı kendi yuvasının sayacını artırır', () => {
    const once = { ...game.actionPresses };
    game.setInput('action', true, 'p2');
    expect(game.actionPresses.p2).toBe(once.p2 + 1);
    expect(game.actionPresses.p1).toBe(once.p1);
  });

  it('basılı tutmak sayacı tekrar artırmaz', () => {
    game.setInput('action', true, 'p1');
    const sonra = game.actionPresses.p1;
    game.setInput('action', true, 'p1');
    expect(game.actionPresses.p1).toBe(sonra);
  });

  it('bilinmeyen tuş ve bilinmeyen yuva sessizce yok sayılır', () => {
    expect(() => game.setInput('turbo', true)).not.toThrow();
    expect(() => game.setInput('right', true, 'p9')).not.toThrow();
    expect(game.inputs.p1.right).toBe(false);
  });

  it('applyInput eksik alanları bırakılmış sayar', () => {
    game.setInput('right', true, 'p2');
    game.setInput('up', true, 'p2');
    // Ağdan gelen paket yalnızca "left" diyorsa diğerleri bırakılmıştır
    game.applyInput('p2', { left: true });
    expect(game.inputs.p2.left).toBe(true);
    expect(game.inputs.p2.right).toBe(false);
    expect(game.inputs.p2.up).toBe(false);
  });

  it('applyInput yuvalar arasında sızmaz', () => {
    game.applyInput('p2', { right: true, action: true });
    expect(game.inputs.p2.right).toBe(true);
    expect(game.inputs.p1.right).toBe(false);
    expect(game.inputs.p1.action).toBe(false);
  });
});
