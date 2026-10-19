import type { Stage } from '@daligotchi/core';
import Phaser from 'phaser';
import type { Household, HouseholdAnimal } from '../api/client.ts';
import { bridge } from '../bridge.ts';

/**
 * Taille logique de l'habitat, en pixels du jeu (portrait). Plus elle est petite,
 * plus tout est agrandi à l'écran : 120 × 180 donne ×3 sur un téléphone courant.
 */
export const HABITAT_WIDTH = 120;
export const HABITAT_HEIGHT = 180;

/** Limite entre le ciel et le sol. */
const HORIZON_Y = 100;
/** Six places : deux rangées de trois (coordonnées des pattes). */
const SLOT_POSITIONS = [
  [24, 132],
  [60, 132],
  [96, 132],
  [24, 166],
  [60, 166],
  [96, 166],
] as const;

const STAGE_SPRITE: Record<Stage, string> = { young: 'jeune', adult: 'adulte', old: 'vieux' };
/** Formes déjà dessinées. Les autres utilisent provisoirement le renard. */
const DRAWN_FORMS = new Set(['renard']);

export const HOUSEHOLD_KEY = 'household';

/** Habitat : affiche les animaux du foyer, assis à leur place ; un toucher ouvre leur fiche. */
export class HabitatScene extends Phaser.Scene {
  private animalLayer?: Phaser.GameObjects.Container;
  private selectionMarker?: Phaser.GameObjects.Graphics;

  constructor() {
    super('habitat');
  }

  preload() {
    for (const stage of Object.values(STAGE_SPRITE)) {
      this.load.image(`renard_${stage}`, `sprites/renard_${stage}.png`);
    }
  }

  create() {
    this.drawGround();
    this.animalLayer = this.add.container(0, 0);
    this.selectionMarker = this.add.graphics().setVisible(false);

    this.renderAnimals(this.registry.get(HOUSEHOLD_KEY) as Household | undefined);
    this.registry.events.on(`changedata-${HOUSEHOLD_KEY}`, (_: unknown, household: Household) =>
      this.renderAnimals(household),
    );
  }

  private spriteKey(animal: HouseholdAnimal): string {
    const form = DRAWN_FORMS.has(animal.form) ? animal.form : 'renard';
    return `${form}_${STAGE_SPRITE[animal.stage]}`;
  }

  private renderAnimals(household: Household | undefined) {
    this.animalLayer?.removeAll(true);
    this.selectionMarker?.setVisible(false);
    if (!household) return;

    household.animals.forEach((animal, index) => {
      const [x, y] = SLOT_POSITIONS[index] ?? SLOT_POSITIONS[0];
      const sprite = this.add.image(x, y, this.spriteKey(animal)).setOrigin(0.5, 1);

      // Zone de toucher un peu plus grande que le dessin, pour les petits doigts.
      sprite.setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-6, -6, sprite.width + 12, sprite.height + 12),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      });
      sprite.on('pointerdown', () => {
        this.markSelection(x, y - sprite.height - 4);
        bridge.emit('animal-selected', { id: animal.id });
      });

      // Respiration : un léger mouvement, décalé pour chaque animal.
      this.tweens.add({
        targets: sprite,
        y: y - 1,
        duration: 900,
        yoyo: true,
        repeat: -1,
        delay: index * 250,
        ease: 'Stepped',
      });

      this.animalLayer?.add(sprite);
    });
  }

  private markSelection(x: number, y: number) {
    this.selectionMarker
      ?.clear()
      .fillStyle(0xffffff)
      .fillTriangle(x - 3, y - 3, x + 3, y - 3, x, y)
      .setVisible(true);
  }

  private drawGround() {
    const g = this.add.graphics();
    g.fillStyle(0x3b3157).fillRect(0, 0, HABITAT_WIDTH, HABITAT_HEIGHT);
    g.fillStyle(0x7fb069).fillRect(0, HORIZON_Y, HABITAT_WIDTH, HABITAT_HEIGHT - HORIZON_Y);
    g.fillStyle(0x6a9a57);
    for (let x = 4; x < HABITAT_WIDTH; x += 12) {
      g.fillRect(x, HORIZON_Y + 4 + ((x * 7) % 70), 2, 1);
    }
  }
}
