import { describe, expect, it } from 'vitest';
import { DAY, HOUR, worldElapsed } from '../src/clock.ts';

describe('worldElapsed', () => {
  it('à vitesse 1, le temps du monde suit le temps réel', () => {
    expect(worldElapsed(0, 3 * HOUR, 1)).toBe(3 * HOUR);
  });

  it('à vitesse 24, une heure réelle vaut une journée de jeu', () => {
    expect(worldElapsed(0, HOUR, 24)).toBe(DAY);
  });

  it('ne revient jamais en arrière', () => {
    expect(worldElapsed(10 * HOUR, 5 * HOUR, 1)).toBe(0);
  });
});
