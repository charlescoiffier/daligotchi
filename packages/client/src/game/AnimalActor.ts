import type { Stage } from '@daligotchi/core';
import Phaser from 'phaser';
import type { HouseholdAnimal } from '../api/client.ts';
import { type Behaviour, chooseBehaviour } from '../behaviour/chooseBehaviour.ts';
import { clampToWalkArea, FOOD_BOWL } from './layout.ts';

const STAGE_SPRITE: Record<Stage, string> = { young: 'jeune', adult: 'adulte', old: 'vieux' };
/** Formes déjà dessinées. Les autres utilisent provisoirement le renard. */
const DRAWN_FORMS = new Set(['renard']);
/** Animations de marche existantes (planches Piskel). */
export const WALK_ANIMATIONS = new Set(['renard_adulte']);

/** Vitesse de marche en pixels du jeu par seconde. */
const SPEED: Record<Stage, number> = { young: 16, adult: 14, old: 7 };

/** Positions des taches de saleté sur le dessin (par rapport aux pattes). */
const SPECKS = [
  [-5, -6],
  [3, -9],
  [-2, -13],
  [5, -4],
] as const;

/**
 * Un animal à l'écran : il vit sa vie (se promène, dort, va à la gamelle…) d'après
 * ses libellés, et joue les effets des soins. Rien de ce qu'il fait n'est envoyé au serveur.
 */
export class AnimalActor {
  /** Position de l'animal (ses pattes). */
  readonly container: Phaser.GameObjects.Container;
  /** Corps : c'est lui qui sautille, pendant que le dessin respire. */
  private readonly body: Phaser.GameObjects.Container;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly specks: Phaser.GameObjects.Image[] = [];
  private marker?: Phaser.GameObjects.Image;
  private behaviourTimer?: Phaser.Time.TimerEvent;
  private moveTween?: Phaser.Tweens.Tween;
  private hopTween?: Phaser.Tweens.Tween;

  constructor(
    private readonly scene: Phaser.Scene,
    private animal: HouseholdAnimal,
    private readonly home: readonly [number, number],
    onSelect: (actor: AnimalActor) => void,
  ) {
    this.container = scene.add.container(home[0], home[1]).setDepth(home[1]);
    this.body = scene.add.container(0, 0);
    this.container.add(this.body);
    this.sprite = scene.add.sprite(0, 0, this.spriteBase).setOrigin(0.5, 1);
    this.body.add(this.sprite);

    for (const [x, y] of SPECKS) {
      const speck = scene.add.image(x, y, 'speck').setVisible(false);
      this.specks.push(speck);
      this.body.add(speck);
    }

    // Zone de toucher un peu plus grande que le dessin, pour les petits doigts.
    this.sprite.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-6, -6, this.sprite.width + 12, this.sprite.height + 12),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    this.sprite.on('pointerdown', () => onSelect(this));

    // Respiration : un léger mouvement continu.
    scene.tweens.add({
      targets: this.sprite,
      y: -1,
      duration: 900,
      yoyo: true,
      repeat: -1,
      delay: Phaser.Math.Between(0, 900),
      ease: 'Stepped',
    });

    this.refreshLook();
    this.schedule(Phaser.Math.Between(500, 2500));
  }

  get id() {
    return this.animal.id;
  }

  get x() {
    return this.container.x;
  }

  /** Hauteur du haut de la tête, par rapport aux pattes. */
  get top() {
    return this.container.y - this.sprite.height;
  }

  private get spriteBase() {
    const form = DRAWN_FORMS.has(this.animal.form) ? this.animal.form : 'renard';
    return `${form}_${STAGE_SPRITE[this.animal.stage]}`;
  }

  /** Nouvel état venu du serveur (après une visite ou un soin). */
  update(animal: HouseholdAnimal) {
    const stageChanged = animal.stage !== this.animal.stage;
    this.animal = animal;
    if (stageChanged && !this.sprite.anims.isPlaying) this.sprite.setTexture(this.spriteBase);
    this.refreshLook();
  }

  setSelected(selected: boolean) {
    if (selected && !this.marker) {
      this.marker = this.scene.add.image(0, -this.sprite.height - 4, 'marker');
      this.body.add(this.marker);
    } else if (!selected && this.marker) {
      this.marker.destroy();
      this.marker = undefined;
    }
  }

  destroy() {
    this.behaviourTimer?.remove();
    this.moveTween?.stop();
    this.hopTween?.stop();
    this.container.destroy();
  }

  /** Taches de saleté selon la propreté. */
  private refreshLook() {
    const level = this.animal.description.needs.hygiene.split('.').pop();
    const visible = level === 'bad' ? 4 : level === 'low' ? 2 : 0;
    this.specks.forEach((speck, index) => speck.setVisible(index < visible));
  }

  private schedule(delay: number) {
    this.behaviourTimer?.remove();
    this.behaviourTimer = this.scene.time.delayedCall(delay, () => this.run(chooseBehaviour(this.animal.description, Math.random)));
  }

  private run(behaviour: Behaviour) {
    const next = (ms: number) => this.schedule(ms);
    switch (behaviour) {
      case 'sit':
        next(Phaser.Math.Between(2500, 5000));
        break;
      case 'wander': {
        const [x, y] = clampToWalkArea(
          this.home[0] + Phaser.Math.Between(-28, 28),
          this.home[1] + Phaser.Math.Between(-14, 14),
        );
        this.walkTo(x, y, () => next(Phaser.Math.Between(1500, 3500)));
        break;
      }
      case 'goToBowl': {
        const [x, y] = clampToWalkArea(FOOD_BOWL.x + Phaser.Math.Between(-12, 6), FOOD_BOWL.y + 8);
        this.walkTo(x, y, () => next(Phaser.Math.Between(3000, 5000)));
        break;
      }
      case 'sleep':
        this.sleep(6000, () => next(1500));
        break;
      case 'beg':
        this.hop(3, () => next(Phaser.Math.Between(2000, 4000)));
        break;
      case 'circle':
        this.turnAround(() => next(Phaser.Math.Between(2000, 4000)));
        break;
    }
  }

  walkTo(x: number, y: number, done: () => void) {
    const distance = Phaser.Math.Distance.Between(this.container.x, this.container.y, x, y);
    if (distance < 2) return done();
    this.sprite.setFlipX(x < this.container.x);

    const walkKey = `${this.spriteBase}_marche`;
    if (WALK_ANIMATIONS.has(this.spriteBase)) {
      this.sprite.play(walkKey);
    } else {
      this.hopTween = this.scene.tweens.add({ targets: this.body, y: -2, duration: 120, yoyo: true, repeat: -1 });
    }

    this.moveTween?.stop();
    this.moveTween = this.scene.tweens.add({
      targets: this.container,
      x,
      y,
      duration: (distance / SPEED[this.animal.stage]) * 1000,
      onUpdate: () => this.container.setDepth(this.container.y),
      onComplete: () => {
        this.sprite.stop();
        this.hopTween?.stop();
        this.sprite.setTexture(this.spriteBase);
        this.body.setY(0);
        done();
      },
    });
  }

  private hop(times: number, done: () => void) {
    this.scene.tweens.add({
      targets: this.body,
      y: -5,
      duration: 160,
      yoyo: true,
      repeat: times - 1,
      ease: 'Quad.Out',
      onComplete: () => done(),
    });
  }

  private turnAround(done: () => void) {
    this.scene.time.addEvent({
      delay: 250,
      repeat: 5,
      callback: () => this.sprite.toggleFlipX(),
    });
    this.scene.time.delayedCall(1600, done);
  }

  private sleep(duration: number, done: () => void) {
    const zzz = this.scene.time.addEvent({
      delay: 1200,
      repeat: Math.floor(duration / 1200) - 1,
      callback: () => this.floatUp('zzz', this.x + 5, this.top - 2, 1600, 10),
    });
    this.scene.time.delayedCall(duration, () => {
      zzz.remove();
      done();
    });
  }

  /** Une image qui monte en s'effaçant (cœur, bulle, zzz). */
  floatUp(texture: string, x: number, y: number, duration: number, rise: number) {
    const image = this.scene.add.image(Math.round(x), Math.round(y), texture).setDepth(1000);
    this.scene.tweens.add({
      targets: image,
      y: y - rise,
      alpha: 0,
      duration,
      ease: 'Sine.Out',
      onComplete: () => image.destroy(),
    });
  }

  // --- Effets des soins ---

  hearts() {
    for (let i = 0; i < 3; i++) {
      this.scene.time.delayedCall(i * 250, () =>
        this.floatUp('heart', this.x + Phaser.Math.Between(-6, 6), this.top - 2, 1400, 14),
      );
    }
    this.hop(1, () => {});
  }

  bubbles() {
    for (let i = 0; i < 6; i++) {
      this.scene.time.delayedCall(i * 150, () =>
        this.floatUp(
          'bubble',
          this.x + Phaser.Math.Between(-9, 9),
          this.container.y - Phaser.Math.Between(2, 14),
          1200,
          10,
        ),
      );
    }
  }

  /** Réaction à la balle : il court un peu puis sautille. */
  playWithBall() {
    this.behaviourTimer?.remove();
    this.hop(2, () => this.schedule(2000));
  }
}
