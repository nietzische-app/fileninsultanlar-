import { describe, expect, it } from 'vitest';
import { FORMATS, RULES } from './constants.js';
import { ROSTER, DEFAULT_PLAYER_ID } from './players.js';
import { vitrinKadro } from './ilerleme.js';
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

describe('kadro sabitleri kadroyla tutarlı', () => {
  /*
   * Bu test bir arızanın bedeli. Kadro yeniden adlandırılırken
   * `DEFAULT_PLAYER_ID` ve `SHOWCASE_IDS` gözden kaçtı: ikisi de
   * ROSTER bloklarının DIŞINDA duruyor ve toplu değişimden
   * etkilenmedi. Sonuç, var olmayan bir oyuncuyu gösteren varsayılan
   * kadro oldu — çevrimiçi maç kuruluyor ama çizilemiyordu ve arıza
   * ancak e2e'de, "adım ilerlemiyor" diye ortaya çıktı.
   *
   * Bir kimliğin kadroda OLDUĞUNU sınamak bunu kaynağında yakalar.
   */
  it('DEFAULT_PLAYER_ID gerçek bir oyuncu', () => {
    expect(ROSTER.some((p) => p.id === DEFAULT_PLAYER_ID)).toBe(true);
  });

  it('vitrin kadrosu hep gerçek oyuncu döner', () => {
    /*
     * Vitrin sabit bir liste olmaktan çıkıp açılanlardan kurulur oldu
     * (bkz. ilerleme.js). Aynı soru geçerli: ekrana var olmayan bir
     * oyuncu gitmesin — kayıtta çöp id olsa bile.
     */
    const kimlikler = new Set(ROSTER.map((p) => p.id));
    [[], ['zeliha-gunay'], ['yok-boyle-biri', 'handan-balatan']].forEach((acilanlar) => {
      const vitrin = vitrinKadro(acilanlar);
      expect(vitrin.length).toBe(3);
      vitrin.forEach((p) => expect(kimlikler.has(p.id)).toBe(true));
    });
  });

  it('kadroda kimlik ve forma numarası benzersiz', () => {
    expect(new Set(ROSTER.map((p) => p.id)).size).toBe(ROSTER.length);
    expect(new Set(ROSTER.map((p) => p.number)).size).toBe(ROSTER.length);
  });
});
