import { describe, expect, it } from 'vitest';
import {
  TOURNAMENT_ROUNDS,
  advanceTournament,
  createTournament,
  currentRound,
  roundMatchConfig,
  tournamentLadder,
  tournamentSummary,
} from './tournament.js';
import { OPPONENT_TEAMS } from './opponents.js';
import { FORMATS } from './constants.js';

const win = { winner: 'home', sets: { home: 1, away: 0 } };
const loss = { winner: 'away', sets: { home: 0, away: 1 } };

/** Baştan sona kazanılmış turnuva. */
function champion() {
  return TOURNAMENT_ROUNDS.reduce(
    (state) => advanceTournament(state, win),
    createTournament({ homeIds: ['gizem-orge'] })
  );
}

describe('turnuva tanımı', () => {
  it('her turun rakibi gerçek bir takım', () => {
    TOURNAMENT_ROUNDS.forEach((round) => {
      expect(OPPONENT_TEAMS.some((t) => t.id === round.opponentId)).toBe(true);
    });
  });

  it('aynı rakip iki kez çıkmaz', () => {
    const ids = TOURNAMENT_ROUNDS.map((r) => r.opponentId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('her turun formatı tanımlı', () => {
    TOURNAMENT_ROUNDS.forEach((round) => {
      expect(FORMATS[round.format]).toBeDefined();
    });
  });

  it('zorluk rampası turdan tura artar', () => {
    const ramps = TOURNAMENT_ROUNDS.map((r) => r.ramp);
    ramps.forEach((ramp, i) => {
      if (i > 0) expect(ramp).toBeGreaterThan(ramps[i - 1]);
    });
  });

  it('final tek set değil', () => {
    const final = TOURNAMENT_ROUNDS[TOURNAMENT_ROUNDS.length - 1];
    expect(final.rules.setsToWin).toBeGreaterThan(1);
  });
});

describe('turnuva ilerlemesi', () => {
  it('yeni turnuva ilk turda ve aktif başlar', () => {
    const state = createTournament({ mode: '2v2', homeIds: ['a', 'b'] });
    expect(state.status).toBe('active');
    expect(state.roundIndex).toBe(0);
    expect(currentRound(state)).toBe(TOURNAMENT_ROUNDS[0]);
  });

  it('galibiyet bir sonraki tura taşır', () => {
    const state = advanceTournament(createTournament(), win);
    expect(state.roundIndex).toBe(1);
    expect(state.status).toBe('active');
    expect(state.results).toHaveLength(1);
  });

  it('yenilgi turnuvayı bitirir ve turu ilerletmez', () => {
    const state = advanceTournament(createTournament(), loss);
    expect(state.status).toBe('lost');
    expect(state.roundIndex).toBe(0);
  });

  it('girdiyi değiştirmez', () => {
    const state = createTournament();
    advanceTournament(state, win);
    expect(state.roundIndex).toBe(0);
    expect(state.results).toHaveLength(0);
  });

  it('bütün turlar kazanılınca kupa', () => {
    const state = champion();
    expect(state.status).toBe('won');
    expect(state.results.filter((r) => r.won)).toHaveLength(TOURNAMENT_ROUNDS.length);
    expect(currentRound(state)).toBeNull();
  });

  it('turnuva bittikten sonra ilerleme durur', () => {
    const state = champion();
    expect(advanceTournament(state, win)).toBe(state);
  });
});

describe('tur yapılandırması', () => {
  it('sıradaki tur için maç ayarı üretir', () => {
    const state = createTournament({ mode: '2v2', difficulty: 'zor', homeIds: ['x', 'y'] });
    const config = roundMatchConfig(state);

    expect(config.campaign).toBe('tournament');
    expect(config.mode).toBe('2v2');
    expect(config.difficulty).toBe('zor');
    expect(config.opponentId).toBe(TOURNAMENT_ROUNDS[0].opponentId);
    expect(config.rules).toEqual(TOURNAMENT_ROUNDS[0].rules);
    expect(config.roundNumber).toBe(1);
    expect(config.homeIds).toEqual(['x', 'y']);
  });

  it('rakibi rastgeleye bırakmaz', () => {
    expect(roundMatchConfig(createTournament()).opponentRandom).toBe(false);
  });

  it('turnuva bittiğinde ayar üretmez', () => {
    expect(roundMatchConfig(champion())).toBeNull();
  });
});

describe('bracket ve özet', () => {
  it('merdiven her turun durumunu işaretler', () => {
    const state = advanceTournament(createTournament(), win);
    const ladder = tournamentLadder(state);

    expect(ladder[0].status).toBe('won');
    expect(ladder[1].status).toBe('current');
    expect(ladder[2].status).toBe('locked');
    expect(ladder[0].opponent?.id).toBe(TOURNAMENT_ROUNDS[0].opponentId);
  });

  it('elenilen tur kayıp işaretlenir', () => {
    const state = advanceTournament(advanceTournament(createTournament(), win), loss);
    const ladder = tournamentLadder(state);

    expect(ladder[0].status).toBe('won');
    expect(ladder[1].status).toBe('lost');
    expect(ladder[2].status).toBe('locked');
  });

  it('özet kupa ve elenme turunu bildirir', () => {
    expect(tournamentSummary(champion())).toMatchObject({
      champion: true,
      wins: TOURNAMENT_ROUNDS.length,
      lastRoundLabel: 'FİNAL',
    });

    const eliminated = advanceTournament(advanceTournament(createTournament(), win), loss);
    expect(tournamentSummary(eliminated)).toMatchObject({
      champion: false,
      wins: 1,
      lastRoundLabel: TOURNAMENT_ROUNDS[1].label,
    });
  });
});
