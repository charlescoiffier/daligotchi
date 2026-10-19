import type { Stage } from '@daligotchi/core';
import Phaser from 'phaser';
import type { Household, HouseholdAnimal } from '../api/client.ts';
import { bridge } from '../bridge.ts';

/** Taille logique de l'habitat, en pixels du jeu (portrait). */
export const HABITAT_WIDTH = 180;
export const HABITAT_HEIGHT = 320;

const GROUND_Y = 250;
/** Six places : deux rangées de trois. */
const SLOT_POSITIONS = [
  [40, GROUND_Y],
  [90, GROUND_Y],
  [140, GROUND_Y],
  [40, GROUND_Y + 45],
  [90, GROUND_Y + 45],
  [140, GROUND_Y + 45],
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
    g.fillStyle(0x7fb069).fillRect(0, GROUND_Y - 30, HABITAT_WIDTH, HABITAT_HEIGHT - GROUND_Y + 30);
    g.fillStyle(0x6a9a57);
    for (let x = 4; x < HABITAT_WIDTH; x += 12) {
      g.fillRect(x, GROUND_Y - 30 + ((x * 7) % 60), 2, 1);
    }
  }
}
