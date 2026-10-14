import { describe, expect, it, vi } from 'vitest';
import Sfx from './audio.js';

describe('SfxEngine', () => {
  it('AudioContext olmadan çökmez', () => {
    expect(() => {
      Sfx.bump();
      Sfx.hit();
      Sfx.spike();
      Sfx.dive();
      Sfx.save();
      Sfx.block();
      Sfx.net();
      Sfx.ground();
      Sfx.point();
      Sfx.streak(4);
      Sfx.combo(6);
      Sfx.pointLost();
      Sfx.whistle();
      Sfx.setWon();
      Sfx.setLost();
      Sfx.victory();
      Sfx.defeat();
      Sfx.select();
      Sfx.confirm();
      Sfx.pause();
      Sfx.setAtmosphere(0.5);
      Sfx.hushAtmosphere();
      Sfx.suspend();
      Sfx.resumeContext();
    }).not.toThrow();
  });

  it('arka planda running bağlamı askıya alır, dönüşte açar', () => {
    const onceki = Sfx.ctx;
    const suspend = vi.fn();
    const resume = vi.fn();
    Sfx.ctx = { state: 'running', suspend, resume };

    Sfx.suspend();
    expect(suspend).toHaveBeenCalledTimes(1);

    Sfx.ctx.state = 'suspended';
    Sfx.suspend();
    expect(suspend).toHaveBeenCalledTimes(1);

    Sfx.resumeContext();
    expect(resume).toHaveBeenCalledTimes(1);

    Sfx.ctx.state = 'running';
    Sfx.resumeContext();
    expect(resume).toHaveBeenCalledTimes(1);

    Sfx.ctx = onceki;
  });

  it('jitter 1 civarında sapma üretir', () => {
    const samples = Array.from({ length: 40 }, () => Sfx.jitter(0.05));
    expect(samples.every((v) => v >= 0.95 && v <= 1.05)).toBe(true);
    expect(samples.some((v) => v !== 1)).toBe(true);
  });
});
