import { describe, it, expect } from 'vitest';
import {
  KOC_ADIM,
  KOC_KILIT,
  kocAdimAt,
  kocBaslangic,
  kocGirdiUydu,
  kocVurgu,
  kocMacinaAl,
  kocYaziAnahtar,
} from './koc.js';
import { PHASE } from './constants.js';
import Game from './Game.js';

describe('ilk maç koçu', () => {
  it('hareketle başlar', () => {
    expect(kocBaslangic().adim).toBe(KOC_ADIM.MOVE);
  });

  it('başta kilit varken girdi yemez', () => {
    const s = kocAdimAt(kocBaslangic(), { left: true }, 0);
    expect(s.adim).toBe(KOC_ADIM.MOVE);
  });

  it('sol/sağ hareket adımını geçer', () => {
    let s = kocAdimAt(kocBaslangic(), { left: true }, 0.2);
    expect(s.adim).toBe(KOC_ADIM.JUMP);
    s = kocAdimAt({ adim: KOC_ADIM.MOVE, kilit: 0 }, { right: true }, 0);
    expect(s.adim).toBe(KOC_ADIM.JUMP);
  });

  it('basılı tuş kilit bitmeden sonraki adımı atlamaz', () => {
    const jump = kocAdimAt({ adim: KOC_ADIM.MOVE, kilit: 0 }, { left: true, up: true }, 0);
    expect(jump.adim).toBe(KOC_ADIM.JUMP);
    const ayni = kocAdimAt(jump, { left: true, up: true }, 0.05);
    expect(ayni.adim).toBe(KOC_ADIM.JUMP);
    expect(ayni.kilit).toBeGreaterThan(0);
    expect(ayni.kilit).toBeLessThan(KOC_KILIT);
  });

  it('üç doğru tuşla biter', () => {
    let s = { adim: KOC_ADIM.MOVE, kilit: 0 };
    s = kocAdimAt(s, { left: true }, 0);
    s = kocAdimAt(s, { up: true }, 1);
    s = kocAdimAt(s, { action: true }, 1);
    expect(s.adim).toBe(KOC_ADIM.DONE);
  });

  it('vurgu adımı tuşa bağlar', () => {
    expect(kocVurgu(KOC_ADIM.MOVE)).toBe('move');
    expect(kocVurgu(KOC_ADIM.JUMP)).toBe('jump');
    expect(kocVurgu(KOC_ADIM.HIT)).toBe('hit');
    expect(kocVurgu(KOC_ADIM.DONE)).toBe(null);
  });

  it('girdi eşiği yalnız ilgili tuşu kabul eder', () => {
    expect(kocGirdiUydu(KOC_ADIM.MOVE, { up: true })).toBe(false);
    expect(kocGirdiUydu(KOC_ADIM.HIT, { action: true })).toBe(true);
  });

  it('çevrimiçi ve 2 kişide açılmaz', () => {
    expect(kocMacinaAl({})).toBe(true);
    expect(kocMacinaAl({ kocSeen: true })).toBe(false);
    expect(kocMacinaAl({ online: true })).toBe(false);
    expect(kocMacinaAl({ agRol: 'ev' })).toBe(false);
    expect(kocMacinaAl({ playMode: 'coop' })).toBe(false);
    expect(kocMacinaAl({ playMode: 'solo' })).toBe(true);
  });

  it('telefonda tuş, masaüstünde klavye metni', () => {
    expect(kocYaziAnahtar(KOC_ADIM.MOVE, true)).toBe('koc.moveTouch');
    expect(kocYaziAnahtar(KOC_ADIM.MOVE, false)).toBe('koc.move');
    expect(kocYaziAnahtar(KOC_ADIM.DONE, true)).toBe('koc.done');
  });
});

describe('motor koçu', () => {
  function oyun(ek = {}) {
    return new Game(null, {
      bassiz: true,
      koc: true,
      onState: () => {},
      onFinish: () => {},
      ...ek,
    });
  }

  it('açılışta topu dondurur', () => {
    const g = oyun();
    expect(g.phase).toBe(PHASE.COACH);
    const { x, y } = g.ball;
    g.update(0.05);
    expect(g.ball.x).toBe(x);
    expect(g.ball.y).toBe(y);
    expect(g.phase).toBe(PHASE.COACH);
  });

  it('üç tuşla maça geçer', () => {
    let bitti = 0;
    const g = oyun({ onKocBitir: () => { bitti += 1; } });
    g.koc.kilit = 0;
    g.setInput('left', true);
    g.update(0.05);
    expect(g.koc.adim).toBe(KOC_ADIM.JUMP);
    g.setInput('left', false);
    g.setInput('up', true);
    g.update(0.4);
    expect(g.koc.adim).toBe(KOC_ADIM.HIT);
    g.setInput('up', false);
    g.setInput('action', true);
    g.update(0.4);
    expect(g.koc).toBe(null);
    expect(g.phase).toBe(PHASE.READY);
    expect(bitti).toBe(1);
  });

  it('atla maça geçer', () => {
    let bitti = 0;
    const g = oyun({ onKocBitir: () => { bitti += 1; } });
    g.kocAtla();
    expect(g.koc).toBe(null);
    expect(g.phase).toBe(PHASE.READY);
    expect(bitti).toBe(1);
  });

  it('koçsuz maç READY ile başlar', () => {
    const g = oyun({ koc: false });
    expect(g.phase).toBe(PHASE.READY);
    expect(g.koc).toBe(null);
  });
});
