import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFS,
  DEFAULT_RECORDS,
  loadPrefs,
  loadRecords,
  recordMatchResult,
  savePrefs,
  saveRecords,
} from './storage.js';
import {
  getAge,
  getBonusRoster,
  getCaptain,
  getModifier,
  getPlayerById,
} from '../game/players.js';

describe('storage prefs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('varsayılan tercihleri döner', () => {
    expect(loadPrefs()).toMatchObject({
      muted: false,
      mode: '1v1',
      tutorialSeen: false,
      homeIds: DEFAULT_PREFS.homeIds,
    });
  });

  it('mute ve tutorialSeen kaydeder', () => {
    savePrefs({ muted: true, tutorialSeen: true, mode: '2v2' });
    const prefs = loadPrefs();
    expect(prefs.muted).toBe(true);
    expect(prefs.tutorialSeen).toBe(true);
    expect(prefs.mode).toBe('2v2');
  });
});

describe('storage records', () => {
  beforeEach(() => {
    localStorage.clear();
    saveRecords({ ...DEFAULT_RECORDS });
  });

  it('galibiyeti ve seriyi işler', () => {
    const { records, broken } = recordMatchResult({
      winner: 'home',
      stats: { spikes: 4, blocks: 1, saves: 2, longestRally: 11 },
    });
    expect(records.wins).toBe(1);
    expect(records.winStreak).toBe(1);
    expect(records.longestRally).toBe(11);
    expect(broken.firstWin).toBe(true);
    expect(broken.longestRally).toBe(true);
  });

  it('mağlubiyette seriyi sıfırlar', () => {
    recordMatchResult({
      winner: 'home',
      stats: { spikes: 1, blocks: 0, saves: 0, longestRally: 3 },
    });
    const { records } = recordMatchResult({
      winner: 'away',
      stats: { spikes: 9, blocks: 0, saves: 0, longestRally: 2 },
    });
    expect(records.losses).toBe(1);
    expect(records.winStreak).toBe(0);
    expect(records.mostSpikes).toBe(9);
    expect(loadRecords().mostSpikes).toBe(9);
  });
});

describe('players roster', () => {
  it('Gizem Örge kaptandır', () => {
    const captain = getCaptain();
    expect(captain?.id).toBe('gizem-orge');
    expect(captain?.captain).toBe(true);
  });

  it('bonus kadroda Eda ve Ebrar vardır', () => {
    const bonus = getBonusRoster().map((p) => p.id);
    expect(bonus).toContain('eda-erdem');
    expect(bonus).toContain('ebrar-karakurt');
  });

  it('Ebrar charge çarpanı 1.3', () => {
    const ebrar = getPlayerById('ebrar-karakurt');
    expect(getModifier(ebrar, 'charge')).toBe(1.3);
  });

  it('yaş hesaplar', () => {
    const gizem = getPlayerById('gizem-orge');
    const age = getAge(gizem, new Date('2026-08-04'));
    expect(age).toBe(33);
  });
});
