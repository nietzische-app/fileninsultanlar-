import { describe, expect, it } from 'vitest';
import {
  spawnBurst,
  spawnDust,
  spawnRing,
  updateParticles,
  updateRings,
} from './effects.js';

describe('effects', () => {
  it('spawnBurst parçacık ekler', () => {
    const particles = [];
    spawnBurst(particles, 10, 20, 5, '#fff');
    expect(particles).toHaveLength(5);
    expect(particles[0]).toMatchObject({ x: 10, y: 20, color: '#fff' });
  });

  it('updateParticles ömrü bitenleri siler', () => {
    const particles = [];
    spawnDust(particles, 0, 0, 3);
    particles.forEach((p) => {
      p.life = 0.01;
    });
    updateParticles(particles, 0.05);
    expect(particles).toHaveLength(0);
  });

  it('updateRings yarıçapı büyütür', () => {
    const rings = [];
    spawnRing(rings, 50, 50, '#9BE7FF', 40);
    expect(rings[0].r).toBe(6);
    updateRings(rings, 0.13);
    expect(rings[0].r).toBeGreaterThan(6);
    expect(rings[0].r).toBeLessThanOrEqual(40);
  });
});
