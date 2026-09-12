import { describe, it, expect } from 'vitest';
import { getGameMode, yerelCift, GAME_MODES } from './modes.js';

describe('yerelCift', () => {
  it('yerel Co-Op ve VS için true', () => {
    expect(yerelCift('coop', null)).toBe(true);
    expect(yerelCift('vs')).toBe(true);
  });

  it('mod id değil playMode bekler', () => {
    // 'versus' menü id'si; motor playMode olarak 'vs' alır
    expect(yerelCift('versus')).toBe(false);
  });

  it('çevrimiçide false — iki oyuncu ayrı cihazda, her biri p1', () => {
    expect(yerelCift('vs', 'ev')).toBe(false);
    expect(yerelCift('vs', 'misafir')).toBe(false);
    expect(yerelCift('coop', 'ev')).toBe(false);
  });

  it('tek kişilik ve çevrimiçi menü modlarında false', () => {
    expect(yerelCift('solo')).toBe(false);
    expect(yerelCift('online')).toBe(false);
    expect(yerelCift(undefined)).toBe(false);
  });
});

describe('getGameMode', () => {
  it('bilinen id ile doğru modu döner', () => {
    expect(getGameMode('coop').playMode).toBe('coop');
    expect(getGameMode('versus').twoPlayer).toBe(true);
  });

  it('GAME_MODES içindeki yerel iki oyunculu id\'ler yerelCift ile örtüşür', () => {
    const yerel = GAME_MODES.filter((m) => m.twoPlayer && !m.online);
    expect(yerel.map((m) => m.id).sort()).toEqual(['coop', 'versus']);
    yerel.forEach((m) => {
      expect(yerelCift(m.playMode, null), m.id).toBe(true);
    });
  });
});
