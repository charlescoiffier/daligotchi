import { type CareAction, seededRandom } from '@daligotchi/core';
import Phaser from 'phaser';
import type { Household } from '../api/client.ts';
import { bridge } from '../bridge.ts';
import { AnimalActor, WALK_ANIMATIONS } from './AnimalActor.ts';
import {
  FOOD_BOWL,
  HABITAT_HEIGHT,
  HABITAT_WIDTH,
  HORIZON_Y,
  SLOT_POSITIONS,
  WALK_AREA,
  WATER_BOWL,
} from './layout.ts';
import { registerDrawings } from './pixelArt.ts';

export { HABITAT_HEIGHT, HABITAT_WIDTH } from './layout.ts';
export const HOUSEHOLD_KEY = 'household';

const STAGES = ['jeune', 'adulte', 'vieux'] as const;

/**
 * Habitat : décor gris léger sur fond blanc (sol tramé, nuages), gamelles,
 * et les animaux du foyer qui vivent leur vie. Un toucher sur un animal ouvre sa fiche.
 */
export class HabitatScene extends Phaser.Scene {
  private readonly actors = new Map<string, AnimalActor>();
  private selectedId?: string;
  private foodBowl?: Phaser.GameObjects.Image;
  private waterBowl?: Phaser.GameObjects.Image;
  private groundDirt: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('habitat');
  }

  preload() {
    for (const stage of STAGES) this.load.image(`renard_${stage}`, `sprites/renard_${stage}.png`);
    this.load.spritesheet('renard_adulte_marche', 'sprites/renard_adulte_marche.png', {
      frameWidth: 27,
      frameHeight: 17,
    });
  }

  create() {
    registerDrawings(this);
    for (const base of WALK_ANIMATIONS) {
      this.anims.create({
        key: `${base}_marche`,
        frames: this.anims.generateFrameNumbers(`${base}_marche`, { start: 0, end: 7 }),
        frameRate: 10,
        repeat: -1,
      });
    }

    this.drawGround();
    this.startClouds();
    this.foodBowl = this.add.image(FOOD_BOWL.x, FOOD_BOWL.y, 'bowlEmpty').setOrigin(0.5, 1).setDepth(FOOD_BOWL.y);
    this.waterBowl = this.add.image(WATER_BOWL.x, WATER_BOWL.y, 'bowlEmpty').setOrigin(0.5, 1).setDepth(WATER_BOWL.y);

    this.renderHousehold(this.registry.get(HOUSEHOLD_KEY) as Household | undefined);
    this.registry.events.on(`changedata-${HOUSEHOLD_KEY}`, (_: unknown, household: Household) =>
      this.renderHousehold(household),
    );

    const offCare = bridge.on('care-performed', ({ action, animalId }) => this.playCareEffect(action, animalId));
    const offDeselect = bridge.on('animal-deselected', () => this.select(undefined));
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      offCare();
      offDeselect();
    });
  }

  private renderHousehold(household: Household | undefined) {
    if (!household) return;
    const ids = new Set(household.animals.map((animal) => animal.id));

    for (const [id, actor] of this.actors) {
      if (!ids.has(id)) {
        actor.destroy();
        this.actors.delete(id);
      }
    }

    household.animals.forEach((animal, index) => {
      const existing = this.actors.get(animal.id);
      if (existing) {
        existing.update(animal);
      } else {
        const home = SLOT_POSITIONS[index] ?? SLOT_POSITIONS[0];
        const actor = new AnimalActor(this, animal, home, (a) => this.select(a.id, true));
        actor.setSelected(animal.id === this.selectedId);
        this.actors.set(animal.id, actor);
      }
    });

    // Gamelles pleines tant que tout le monde est rassasié / désaltéré.
    const all = (need: 'satiety' | 'hydration') =>
      household.animals.every((animal) => animal.description.needs[need].endsWith('.good'));
    this.foodBowl?.setTexture(all('satiety') ? 'bowlFood' : 'bowlEmpty');
    this.waterBowl?.setTexture(all('hydration') ? 'bowlWater' : 'bowlEmpty');

    this.showGroundDirt(household.home.split('.').pop() as 'good' | 'low' | 'bad');
  }

  private select(id: string | undefined, notify = false) {
    this.selectedId = id;
    for (const actor of this.actors.values()) actor.setSelected(actor.id === id);
    if (notify && id) bridge.emit('animal-selected', { id });
  }

  private playCareEffect(action: CareAction, animalId?: string) {
    const target = animalId ? this.actors.get(animalId) : undefined;
    switch (action) {
      case 'feed':
        this.sparkleAt(FOOD_BOWL.x, FOOD_BOWL.y - 4, 3);
        break;
      case 'water':
        this.sparkleAt(WATER_BOWL.x, WATER_BOWL.y - 4, 3);
        break;
      case 'cleanHome':
        for (let i = 0; i < 8; i++) {
          this.time.delayedCall(i * 90, () =>
            this.sparkleAt(
              Phaser.Math.Between(WALK_AREA.minX, WALK_AREA.maxX),
              Phaser.Math.Between(WALK_AREA.minY - 10, WALK_AREA.maxY),
              1,
            ),
          );
        }
        break;
      case 'pet':
        target?.hearts();
        break;
      case 'wash':
        target?.bubbles();
        break;
      case 'ball':
        for (const actor of target ? [target] : this.actors.values()) this.throwBall(actor);
        break;
    }
  }

  private throwBall(actor: AnimalActor) {
    const ball = this.add.image(HABITAT_WIDTH / 2, HABITAT_HEIGHT + 4, 'ball').setDepth(1000);
    const landingY = actor.top + 4;
    this.tweens.add({
      targets: ball,
      x: actor.x + 8,
      duration: 700,
      ease: 'Linear',
    });
    this.tweens.add({
      targets: ball,
      y: landingY - 18,
      duration: 350,
      ease: 'Quad.Out',
      yoyo: true,
      onComplete: () => {
        actor.playWithBall();
        this.tweens.add({ targets: ball, alpha: 0, delay: 600, duration: 300, onComplete: () => ball.destroy() });
      },
    });
  }

  private sparkleAt(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const sparkle = this.add
        .image(x + Phaser.Math.Between(-4, 4), y + Phaser.Math.Between(-3, 3), 'sparkle')
        .setDepth(1000);
      this.tweens.add({
        targets: sparkle,
        alpha: 0,
        y: sparkle.y - 4,
        delay: i * 120,
        duration: 700,
        onComplete: () => sparkle.destroy(),
      });
    }
  }

  // --- Décor ---

  /** Sol : fond blanc, trame de points gris clair avec quelques imperfections. */
  private drawGround() {
    const random = seededRandom(19);
    const g = this.add.graphics().setDepth(-10);
    g.fillStyle(0xffffff).fillRect(0, 0, HABITAT_WIDTH, HABITAT_HEIGHT);

    // Ligne d'horizon, avec quelques trous.
    g.fillStyle(0xd2d2d2);
    for (let x = 0; x < HABITAT_WIDTH; x++) {
      if (random() > 0.08) g.fillRect(x, HORIZON_Y, 1, 1);
    }

    // Trame : un point tous les 6 pixels, une rangée sur deux décalée, de plus en plus dense vers le bas.
    for (let y = HORIZON_Y + 5, row = 0; y < HABITAT_HEIGHT; y += 6, row++) {
      for (let x = (row % 2) * 3 + 1; x < HABITAT_WIDTH; x += 6) {
        const roll = random();
        if (roll < 0.12) continue; // point manquant
        g.fillStyle(roll > 0.93 ? 0xc4c4c4 : 0xe0e0e0);
        g.fillRect(x, y, roll > 0.96 ? 2 : 1, 1); // parfois un petit trait
      }
    }
  }

  /** Taches au sol quand l'habitat est sale. */
  private showGroundDirt(level: 'good' | 'low' | 'bad') {
    const count = { good: 0, low: 3, bad: 7 }[level];
    if (this.groundDirt.length === count) return;
    for (const dirt of this.groundDirt) dirt.destroy();
    const random = seededRandom(7);
    this.groundDirt = Array.from({ length: count }, () =>
      this.add
        .image(
          Math.round(WALK_AREA.minX + random() * (WALK_AREA.maxX - WALK_AREA.minX)),
          Math.round(WALK_AREA.minY - 8 + random() * (WALK_AREA.maxY - WALK_AREA.minY)),
          'groundDirt',
        )
        .setDepth(-5),
    );
  }

  /** Deux nuages qui traversent lentement le ciel, puis reviennent de l'autre côté. */
  private startClouds() {
    const clouds = [
      { key: 'cloudBig', y: 22, duration: 70000, start: 0.3 },
      { key: 'cloudSmall', y: 48, duration: 95000, start: 0.75 },
    ];
    for (const cloud of clouds) {
      const image = this.add.image(0, cloud.y, cloud.key).setDepth(-8);
      const from = -image.width;
      const to = HABITAT_WIDTH + image.width;
      image.x = Math.round(from + (to - from) * cloud.start);
      const drift = (startX: number) =>
        this.tweens.add({
          targets: image,
          x: to,
          duration: cloud.duration * ((to - startX) / (to - from)),
          onUpdate: () => image.setX(Math.round(image.x)),
          onComplete: () => {
            image.x = from;
            drift(from);
          },
        });
      drift(image.x);
    }
  }
}
