import { describe, expect, it } from 'vitest';
import { checkDrawing, DRAWINGS } from '../src/game/pixelArt.ts';

describe('dessins en caractères', () => {
  for (const [name, rows] of Object.entries(DRAWINGS)) {
    it(`« ${name} » est rectangulaire et n’utilise que la palette`, () => {
      expect(checkDrawing(rows)).toBeUndefined();
    });
  }

  it('signale une ligne trop courte ou une couleur inconnue', () => {
    expect(checkDrawing(['kk', 'k'])).toMatch(/ligne 2/);
    expect(checkDrawing(['kz'])).toMatch(/inconnue/);
  });
});
