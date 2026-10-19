import Phaser from 'phaser';
import type { MeetingInteraction, PublicAnimal } from '../api/client.ts';
import { drawGround, startClouds } from './decor.ts';
import { spriteKeyFor } from './sprites.ts';

export interface MeetingSceneData {
  /** Animal de l'invitant, à gauche. */
  inviter: PublicAnimal;
  /** Animal de l'invité, à droite. */
  invitee: PublicAnimal;
  /** En souvenir : les interactions à rejouer, au même rythme. */
  replay?: MeetingInteraction[];
}

const GROUND = 126;
const LEFT_X = 40;
const RIGHT_X = 80;

/**
 * Scène de rencontre (GDD §9) : deux animaux face à face, dans le même décor que l'habitat.
 * Elle ne fait que montrer ; ce sont les menus qui enregistrent les interactions.
 */
export class MeetingScene extends Phaser.Scene {
  private actors: Record<'inviter' | 'invitee', Phaser.GameObjects.Container> | undefined;

  constructor() {
    super('meeting');
  }

  create(data: MeetingSceneData) {
    drawGround(this);
    startClouds(this);
    this.actors = {
      inviter: this.addAnimal(data.inviter, LEFT_X, false),
      invitee: this.addAnimal(data.invitee, RIGHT_X, true),
    };
    // Ils se saluent en arrivant.
    this.time.delayedCall(400, () => this.floatHeart(60, GROUND - 26));

    for (const interaction of data.replay ?? []) {
      this.time.delayedCall(800 + interaction.at, () =>
        interaction.kind === 'ball' ? this.ball() : this.pet(interaction.animal ?? 'invitee'),
      );
    }
  }

  private addAnimal(animal: PublicAnimal, x: number, facingLeft: boolean) {
    const container = this.add.container(x, GROUND);
    const sprite = this.add
      .sprite(0, 0, spriteKeyFor(this, animal.form, animal.stage))
      .setOrigin(0.5, 1)
      .setFlipX(facingLeft);
    container.add(sprite);
    this.tweens.add({ targets: sprite, y: -1, duration: 900, yoyo: true, repeat: -1, ease: 'Stepped' });
    return container;
  }

  private hop(container: Phaser.GameObjects.Container, times = 1) {
    this.tweens.add({ targets: container, y: GROUND - 5, duration: 160, yoyo: true, repeat: times - 1, ease: 'Quad.Out' });
  }

  private floatHeart(x: number, y: number) {
    const heart = this.add.image(Math.round(x), Math.round(y), 'heart').setDepth(100);
    this.tweens.add({ targets: heart, y: y - 14, alpha: 0, duration: 1400, onComplete: () => heart.destroy() });
  }

  /** Caresse : des cœurs au-dessus de l'animal, qui sautille de joie. */
  pet(which: 'inviter' | 'invitee') {
    const target = this.actors?.[which];
    if (!target) return;
    for (let i = 0; i < 2; i++) {
      this.time.delayedCall(i * 220, () => this.floatHeart(target.x + Phaser.Math.Between(-4, 4), GROUND - 22));
    }
    this.hop(target);
  }

  /** Balle : elle rebondit de l'un à l'autre, et les deux sautent pour l'attraper. */
  ball() {
    if (!this.actors) return;
    const ball = this.add.image(LEFT_X + 10, GROUND - 4, 'ball').setDepth(100);
    this.tweens.chain({
      targets: ball,
      tweens: [
        { x: RIGHT_X - 10, y: GROUND - 30, duration: 300, ease: 'Quad.Out' },
        { y: GROUND - 4, duration: 300, ease: 'Quad.In' },
        { x: LEFT_X + 10, y: GROUND - 24, duration: 300, ease: 'Quad.Out' },
        { y: GROUND - 4, duration: 300, ease: 'Quad.In' },
        { alpha: 0, duration: 250 },
      ],
      onComplete: () => ball.destroy(),
    });
    this.hop(this.actors.invitee, 2);
    this.time.delayedCall(600, () => this.actors && this.hop(this.actors.inviter, 2));
  }
}
