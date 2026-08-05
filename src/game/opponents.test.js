import { describe, expect, it } from 'vitest';
import { FORMATS, RULES } from './constants.js';
import { isMatchOver, isSetOver } from './rules.js';
import {
  OPPONENT_TEAMS,
  buildAwayPlayers,
  getOpponentTeam,
  pickRandomOpponent,
} from './opponents.js';

describe('FORMATS', () => {
  it('klasik 2 set ister', () => {
    const rules = { ...RULES, ...FORMATS.classic.rules };
    expect(isMatchOver({ home: 1, away: 0 }, rules)).toBe(false);
    expect(isMatchOver({ home: 2, away: 0 }, rules)).toBe(true);
  });

  it('tek set 1 setle biter', () => {
    const rules = { ...RULES, ...FORMATS.single.rules };
    expect(rules.setsToWin).toBe(1);
    expect(isMatchOver({ home: 1, away: 0 }, rules)).toBe(true);
  });

  it('antrenman 7 sayıda biter', () => {
    const rules = { ...RULES, ...FORMATS.practice.rules };
    expect(isSetOver(7, 5, rules)).toBe(true);
    expect(isSetOver(6, 5, rules)).toBe(false);
    expect(isSetOver(7, 6, rules)).toBe(true); // winBy: 1
  });
});

describe('opponents', () => {
  it('5 rakip takım tanımlı', () => {
    expect(OPPONENT_TEAMS.length).toBeGreaterThanOrEqual(5);
    expect(getOpponentTeam('balkan')?.shortName).toBe('BALKAN');
  });

  it('rastgele seçim havuzdan döner', () => {
    const team = pickRandomOpponent(() => 0.99);
    expect(OPPONENT_TEAMS).toContainEqual(team);
  });

  it('away kadrosu takım kitini alır', () => {
    const team = getOpponentTeam('nordik');
    const roster = buildAwayPlayers(team, 2);
    expect(roster).toHaveLength(2);
    expect(roster[0].colors.primary).toBe(team.colors.primary);
    expect(roster[0].name).toBe(team.name);
    expect(roster[0].number).not.toBe(roster[1].number);
  });
});
