import { type CareAction, type EggAction, seededRandom } from '@daligotchi/core';
import Phaser from 'phaser';
import type { Household, HouseholdAnimal } from '../api/client.ts';
import { bridge } from '../bridge.ts';
import { AnimalActor, WALK_ANIMATIONS } from './AnimalActor.ts';
import { EggActor } from './EggActor.ts';
import {
  FOOD_BOWL,
  HABITAT_HEIGHT,
  NEST,
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
  private readonly eggs = new Map<string, EggActor>();
  private selectedId?: string;
  private foodBowl?: Phaser.GameObjects.Image;
  private waterBowl?: Phaser.GameObjects.Image;
  private groundDirt: Phaser.GameObjects.Image[] = [];
  private nest?: Phaser.GameObjects.Image;

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
    this.nest = this.add.image(NEST.x, NEST.y, 'nest1').setOrigin(0.5, 1).setDepth(NEST.y).setVisible(false);
    this.nest.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-4, -6, this.nest.width + 8, this.nest.height + 10),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    this.nest.on('pointerdown', () => bridge.emit('nest-selected', {}));

    this.renderHousehold(this.registry.get(HOUSEHOLD_KEY) as Household | undefined);
    this.registry.events.on(`changedata-${HOUSEHOLD_KEY}`, (_: unknown, household: Household) =>
      this.renderHousehold(household),
    );

    const offCare = bridge.on('care-performed', ({ action, animalId, eggId }) =>
      this.playCareEffect(action, animalId, eggId),
    );
    const offDeselect = bridge.on('animal-deselected', () => this.select(undefined));
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      offCare();
      offDeselect();
    });
  }

  private renderHousehold(household: Household | undefined) {
    if (!household) return;

    // Éclosions : l'œuf se fêle, puis le bébé apparaît à sa place.
    const hatchedIds = new Set(household.hatched.map((h) => h.animalId));
    for (const hatching of household.hatched) {
      const eggActor = this.eggs.get(hatching.eggId);
      const animal = household.animals.find((a) => a.id === hatching.animalId);
      if (!eggActor || !animal) continue;
      this.eggs.delete(hatching.eggId);
      const home = eggActor.home;
      eggActor.hatch(() => {
        this.sparkleAt(home[0], home[1] - 6, 4);
        this.addAnimal(animal, home);
      });
    }

    const animalIds = new Set(household.animals.map((animal) => animal.id));
    for (const [id, actor] of this.actors) {
      if (!animalIds.has(id)) {
        actor.destroy();
        this.actors.delete(id);
      }
    }
    const eggIds = new Set(household.eggs.map((egg) => egg.id));
    for (const [id, actor] of this.eggs) {
      if (!eggIds.has(id)) {
        actor.destroy();
        this.eggs.delete(id);
      }
    }

    for (const animal of household.animals) {
      const existing = this.actors.get(animal.id);
      if (existing) existing.update(animal);
      else if (!hatchedIds.has(animal.id)) this.addAnimal(animal, this.freeSlot());
    }
    for (const egg of household.eggs) {
      const existing = this.eggs.get(egg.id);
      if (existing) {
        existing.update(egg);
      } else {
        const actor = new EggActor(this, egg, this.freeSlot(), (a) => this.select(a.id, 'egg'));
        actor.setSelected(egg.id === this.selectedId);
        this.eggs.set(egg.id, actor);
      }
    }

    // Gamelles pleines tant que tout le monde est rassasié / désaltéré.
    const all = (need: 'satiety' | 'hydration') =>
      household.animals.every((animal) => animal.description.needs[need].endsWith('.good'));
    this.foodBowl?.setTexture(all('satiety') ? 'bowlFood' : 'bowlEmpty');
    this.waterBowl?.setTexture(all('hydration') ? 'bowlWater' : 'bowlEmpty');

    this.showGroundDirt(household.home.split('.').pop() as 'good' | 'low' | 'bad');

    const nestCount = household.nest.length;
    this.nest?.setVisible(nestCount > 0);
    if (nestCount > 0) this.nest?.setTexture(`nest${Math.min(3, nestCount)}`);
  }

  private addAnimal(animal: HouseholdAnimal, home: readonly [number, number]) {
    const actor = new AnimalActor(this, animal, home, (a) => this.select(a.id, 'animal'));
    actor.setSelected(animal.id === this.selectedId);
    this.actors.set(animal.id, actor);
  }

  /** Première des six places qui n'est occupée par aucun animal ni œuf. */
  private freeSlot(): readonly [number, number] {
    const taken = new Set([...this.actors.values(), ...this.eggs.values()].map((actor) => actor.home.join(',')));
    return SLOT_POSITIONS.find((slot) => !taken.has(slot.join(','))) ?? SLOT_POSITIONS[0];
  }

  private select(id: string | undefined, kind?: 'animal' | 'egg') {
    this.selectedId = id;
    for (const actor of this.actors.values()) actor.setSelected(actor.id === id);
    for (const actor of this.eggs.values()) actor.setSelected(actor.id === id);
    if (id && kind === 'animal') bridge.emit('animal-selected', { id });
    if (id && kind === 'egg') bridge.emit('egg-selected', { id });
  }

  private playCareEffect(action: CareAction | EggAction, animalId?: string, eggId?: string) {
    const target = animalId ? this.actors.get(animalId) : undefined;
    const egg = eggId ? this.eggs.get(eggId) : undefined;
    switch (action) {
      case 'warmEgg':
        if (egg) for (let i = 0; i < 2; i++) this.time.delayedCall(i * 250, () => this.floatUp('heart', egg.x, egg.top - 2));
        break;
      case 'washEgg':
        if (egg) this.sparkleAt(egg.x, egg.top + 4, 3);
        break;
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

  private floatUp(texture: string, x: number, y: number) {
    const image = this.add.image(Math.round(x), Math.round(y), texture).setDepth(1000);
    this.tweens.add({ targets: image, y: y - 12, alpha: 0, duration: 1200, onComplete: () => image.destroy() });
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
