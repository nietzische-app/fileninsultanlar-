import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFS,
  DEFAULT_RECORDS,
  clearTournament,
  loadPrefs,
  loadRecords,
  loadTournament,
  recordMatchResult,
  recordSurvivalResult,
  recordTournamentResult,
  savePrefs,
  saveRecords,
  saveTournament,
} from './storage.js';
import { createTournament } from '../game/tournament.js';
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
    savePrefs({
      muted: true,
      tutorialSeen: true,
      mode: '2v2',
      difficulty: 'zor',
      format: 'practice',
    });
    const prefs = loadPrefs();
    expect(prefs.muted).toBe(true);
    expect(prefs.tutorialSeen).toBe(true);
    expect(prefs.mode).toBe('2v2');
    expect(prefs.difficulty).toBe('zor');
    expect(prefs.format).toBe('practice');
  });

  it('eski easy/hard anahtarlarını kolay/zor çevirir', () => {
    localStorage.setItem(
      'filenin-sultanlari-prefs',
      JSON.stringify({ muted: false, difficulty: 'hard', mode: '1v1', homeIds: ['gizem-orge'] })
    );
    expect(loadPrefs().difficulty).toBe('zor');
  });

  it('müzik sesini kaydeder', () => {
    savePrefs({ musicVolume: 0.3 });
    expect(loadPrefs().musicVolume).toBeCloseTo(0.3);
  });

  it('müzik sesi alanı olmayan eski kayıtta varsayılana döner', () => {
    localStorage.setItem(
      'filenin-sultanlari-prefs',
      JSON.stringify({ muted: false, mode: '1v1', homeIds: ['gizem-orge'] })
    );
    expect(loadPrefs().musicVolume).toBe(DEFAULT_PREFS.musicVolume);
  });

  it('bozuk müzik sesi değerlerini toparlar', () => {
    const cases = [
      [2.5, 1],
      [-1, 0],
      ['yarım', DEFAULT_PREFS.musicVolume],
      [null, DEFAULT_PREFS.musicVolume],
    ];
    cases.forEach(([given, expected]) => {
      localStorage.setItem(
        'filenin-sultanlari-prefs',
        JSON.stringify({ musicVolume: given, homeIds: ['gizem-orge'] })
      );
      expect(loadPrefs().musicVolume).toBe(expected);
    });
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

  it('antrenman galibiyet/seri/maç sayısını şişirmez', () => {
    recordMatchResult({
      winner: 'home',
      format: 'classic',
      stats: { spikes: 2, blocks: 1, saves: 1, longestRally: 5 },
    });
    const before = loadRecords();

    const { records, broken } = recordMatchResult({
      winner: 'home',
      format: 'practice',
      stats: { spikes: 8, blocks: 0, saves: 0, longestRally: 20 },
    });

    expect(records.wins).toBe(before.wins);
    expect(records.matchesPlayed).toBe(before.matchesPlayed);
    expect(records.winStreak).toBe(before.winStreak);
    expect(records.bestWinStreak).toBe(before.bestWinStreak);
    expect(records.longestRally).toBe(20);
    expect(records.mostSpikes).toBe(8);
    expect(broken.firstWin).toBe(false);
    expect(broken.bestWinStreak).toBe(false);
    expect(broken.longestRally).toBe(true);
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

describe('hayatta kalma rekorları', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const run = (points, wave, stats = {}) => ({
    campaign: 'survival',
    winner: null,
    survival: { points, wave, bestWave: wave },
    stats: { spikes: 0, blocks: 0, saves: 0, longestRally: 0, ...stats },
  });

  it('puan ve dalga zirvesini tutar', () => {
    const { records, broken } = recordSurvivalResult(run(18, 4));
    expect(records.bestSurvivalPoints).toBe(18);
    expect(records.bestSurvivalWave).toBe(4);
    expect(broken.bestSurvivalPoints).toBe(true);
    expect(broken.bestSurvivalWave).toBe(true);
  });

  it('daha kötü koşu zirveyi düşürmez', () => {
    recordSurvivalResult(run(18, 4));
    const { records, broken } = recordSurvivalResult(run(5, 2));
    expect(records.bestSurvivalPoints).toBe(18);
    expect(broken.bestSurvivalPoints).toBe(false);
  });

  it('galibiyet/mağlubiyet tablosuna dokunmaz', () => {
    saveRecords({ ...DEFAULT_RECORDS, wins: 3, winStreak: 3, bestWinStreak: 3 });
    const { records } = recordSurvivalResult(run(9, 2));
    expect(records.wins).toBe(3);
    expect(records.losses).toBe(0);
    // Koşu yenilgiyle biter ama galibiyet serisini bozmamalı
    expect(records.winStreak).toBe(3);
    expect(records.matchesPlayed).toBe(0);
  });

  it('kişisel zirveler burada da geçerli', () => {
    const { records } = recordSurvivalResult(run(9, 2, { longestRally: 14, spikes: 7 }));
    expect(records.longestRally).toBe(14);
    expect(records.mostSpikes).toBe(7);
  });

  it('yanlış kapıdan gelen koşu maç sayılmaz', () => {
    // recordMatchResult'a düşerse winner:null bir mağlubiyet gibi işlenirdi
    const { records } = recordMatchResult(run(9, 2));
    expect(records.losses).toBe(0);
    expect(records.bestSurvivalPoints).toBe(9);
  });
});

describe('turnuva rekorları ve kaydı', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const state = (status, wonCount) => ({
    status,
    results: Array.from({ length: wonCount }, () => ({ won: true })).concat(
      status === 'lost' ? [{ won: false }] : []
    ),
  });

  it('kupa sayacını artırır', () => {
    const { records, broken } = recordTournamentResult(state('won', 5));
    expect(records.tournamentsWon).toBe(1);
    expect(records.bestTournamentRound).toBe(5);
    expect(broken.tournamentWon).toBe(true);
  });

  it('elenmede kupa sayacı artmaz, ulaşılan tur yazılır', () => {
    const { records } = recordTournamentResult(state('lost', 2));
    expect(records.tournamentsWon).toBe(0);
    expect(records.bestTournamentRound).toBe(3);
  });

  it('daha erken elenme rekoru düşürmez', () => {
    recordTournamentResult(state('lost', 3));
    const { records } = recordTournamentResult(state('lost', 0));
    expect(records.bestTournamentRound).toBe(4);
  });

  it('yarım turnuvayı saklar ve geri okur', () => {
    const tournament = createTournament({ mode: '2v2', homeIds: ['gizem-orge', 'zehra-gunes'] });
    saveTournament(tournament);
    expect(loadTournament()).toMatchObject({ status: 'active', roundIndex: 0 });
  });

  it('kapanmış turnuvayı saklamaz', () => {
    saveTournament(createTournament({ homeIds: ['gizem-orge'] }));
    saveTournament({ ...createTournament({ homeIds: ['gizem-orge'] }), status: 'won' });
    expect(loadTournament()).toBeNull();
  });

  it('bozuk kayıt null döner', () => {
    localStorage.setItem('filenin-sultanlari-tournament', '{bozuk');
    expect(loadTournament()).toBeNull();

    localStorage.setItem(
      'filenin-sultanlari-tournament',
      JSON.stringify({ status: 'active', homeIds: [], roundIndex: 0 })
    );
    expect(loadTournament()).toBeNull();
  });

  it('temizlenen turnuva geri gelmez', () => {
    saveTournament(createTournament({ homeIds: ['gizem-orge'] }));
    clearTournament();
    expect(loadTournament()).toBeNull();
  });
});

describe('eski kayıtlarla uyum', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('yeni mod alanları olmayan kayıt sıfırla açılır', () => {
    localStorage.setItem(
      'filenin-sultanlari-records',
      JSON.stringify({ wins: 4, losses: 1, matchesPlayed: 5, longestRally: 11 })
    );
    const records = loadRecords();
    expect(records.wins).toBe(4);
    expect(records.tournamentsWon).toBe(0);
    expect(records.bestSurvivalPoints).toBe(0);
    expect(records.bestSurvivalWave).toBe(0);
  });
});
