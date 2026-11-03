import { describe, expect, it } from 'vitest';
import Game from './Game.js';
import { PHASE } from './constants.js';

function mac(ek = {}) {
  return new Game(null, {
    bassiz: true,
    campaign: 'match',
    playMode: 'solo',
    reklamTeklif: true,
    reklamKalan: 3,
    onState: () => {},
    onFinish: () => {},
    ...ek,
  });
}

/** Seti bitirir: skor yazılır, donma ve set sonu kararı çağrılır. */
function setBitir(g, home, away) {
  g.score = { home, away };
  g.afterPoint();
  g.afterSet();
}

describe('set sonu ve yenilgi reklamı', () => {
  it('webde teklif etmez, sete kendiliğinden geçer', () => {
    const g = mac({ reklamTeklif: false });
    setBitir(g, 15, 0);
    expect(g.phase).toBe(PHASE.READY);
    expect(g.setNumber).toBe(2);
  });

  it('kazanılan setten sonra reklamla ya da reklamsız sonraki sete geçer', () => {
    const g = mac();
    setBitir(g, 15, 0);
    expect(g.phase).toBe(PHASE.AD_CONTINUE);
    expect(g.adContinue).toBe('next');
    expect(g.setNumber).toBe(1);
    g.declineAdContinue();
    expect(g.phase).toBe(PHASE.READY);
    expect(g.setNumber).toBe(2);
    expect(g.sets.home).toBe(1);
  });

  it('kaybedilen sette reklam seti siler, geçmek seti bırakır', () => {
    const g = mac();
    setBitir(g, 0, 15);
    expect(g.adContinue).toBe('replay');
    expect(g.sets.away).toBe(1);
    expect(g.grantAdContinue()).toBe(true);
    expect(g.sets.away).toBe(0);
    expect(g.setHistory).toHaveLength(0);
    expect(g.setNumber).toBe(1);
    expect(g.phase).toBe(PHASE.READY);
    expect(g.score).toEqual({ home: 0, away: 0 });

    const g2 = mac();
    setBitir(g2, 0, 15);
    g2.declineAdContinue();
    expect(g2.sets.away).toBe(1);
    expect(g2.setNumber).toBe(2);
  });

  it('maç yenilgisinde bir kez son seti baştan oynatır', () => {
    let bitti = 0;
    let kazanan = null;
    const g = mac({
      format: 'single',
      onFinish: (r) => {
        bitti += 1;
        kazanan = r.winner;
      },
    });
    setBitir(g, 0, 15);
    expect(g.phase).toBe(PHASE.AD_CONTINUE);
    expect(g.adContinue).toBe('loss');
    expect(bitti).toBe(0);
    expect(g.grantAdContinue()).toBe(true);
    expect(g.finished).toBe(false);
    expect(g.sets.away).toBe(0);

    setBitir(g, 0, 15);
    expect(g.phase).toBe(PHASE.MATCH_END);
    expect(bitti).toBe(1);
    expect(kazanan).toBe('away');
  });

  it('yenilgiyi kabul etmek sonucu yazar', () => {
    let kazanan = null;
    const g = mac({
      format: 'single',
      onFinish: (r) => {
        kazanan = r.winner;
      },
    });
    setBitir(g, 0, 15);
    g.declineAdContinue();
    expect(g.phase).toBe(PHASE.MATCH_END);
    expect(kazanan).toBe('away');
  });

  it('galibiyette teklif etmez', () => {
    let kazanan = null;
    const g = mac({
      format: 'single',
      onFinish: (r) => {
        kazanan = r.winner;
      },
    });
    setBitir(g, 15, 0);
    expect(g.phase).toBe(PHASE.MATCH_END);
    expect(kazanan).toBe('home');
  });

  it('karşılıklı ve çevrimiçide teklif etmez', () => {
    const vs = mac({ playMode: 'vs' });
    setBitir(vs, 15, 0);
    expect(vs.phase).toBe(PHASE.READY);
    expect(vs.setNumber).toBe(2);

    let bitti = 0;
    const ag = mac({
      format: 'single',
      agRol: 'ev',
      onFinish: () => { bitti += 1; },
    });
    setBitir(ag, 0, 15);
    expect(ag.phase).toBe(PHASE.MATCH_END);
    expect(bitti).toBe(1);
  });

  it('hak yoksa teklif etmez', () => {
    const g = mac({ reklamKalan: 0, format: 'single' });
    setBitir(g, 0, 15);
    expect(g.phase).toBe(PHASE.MATCH_END);
  });

  it('eşli oyunda da set sonu teklif eder', () => {
    const g = mac({ playMode: 'coop' });
    setBitir(g, 15, 0);
    expect(g.adContinue).toBe('next');
  });
});
