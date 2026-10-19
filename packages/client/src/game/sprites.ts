import type { Form, Stage } from '@daligotchi/core';
import type Phaser from 'phaser';

export const STAGE_SPRITE: Record<Stage, string> = { young: 'jeune', adult: 'adulte', old: 'vieux' };

/**
 * Dessin à utiliser pour un animal : la planche Piskel de la forme et de l'âge si elle existe,
 * sinon le dessin provisoire en caractères de la forme, sinon le renard.
 */
export function spriteKeyFor(scene: Phaser.Scene, form: Form, stage: Stage): string {
  const sheet = `${form}_${STAGE_SPRITE[stage]}`;
  if (scene.textures.exists(sheet)) return sheet;
  if (scene.textures.exists(form)) return form;
  return `renard_${STAGE_SPRITE[stage]}`;
}
