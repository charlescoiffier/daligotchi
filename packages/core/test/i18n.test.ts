import { describe, expect, it } from 'vitest';
import { t } from '../src/i18n/index.ts';

describe('t', () => {
  it('renvoie le texte français', () => {
    expect(t('actions.button')).toBe('Actions');
  });

  it('remplace les paramètres', () => {
    expect(t('server.worldSpeed', { speed: 24 })).toBe('Temps ×24');
  });

  it('laisse un paramètre absent visible', () => {
    expect(t('server.worldSpeed')).toBe('Temps ×{speed}');
  });
});
