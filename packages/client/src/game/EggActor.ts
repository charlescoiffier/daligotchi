import Phaser from 'phaser';
import type { HouseholdEgg } from '../api/client.ts';

/** Taches de saleté sur la coquille (par rapport au bas de l'œuf). */
const SPECKS = [
  [-2, -3],
  [2, -6],
  [-1, -8],
] as const;

/** Un œuf à l'écran : il remue quand l'éclosion approche, se salit, et peut éclore. */
export class EggActor {
  readonly container: Phaser.GameObjects.Container;
  private readonly image: Phaser.GameObjects.Image;
  private readonly specks: Phaser.GameObjects.Image[] = [];
  private marker?: Phaser.GameObjects.Image;
  private wobble?: Phaser.Time.TimerEvent;

  constructor(
    private readonly scene: Phaser.Scene,
    private egg: HouseholdEgg,
    readonly home: readonly [number, number],
    onSelect: (actor: EggActor) => void,
  ) {
    this.container = scene.add.container(home[0], home[1]).setDepth(home[1]);
    this.image = scene.add.image(0, 0, 'egg').setOrigin(0.5, 1);
    this.container.add(this.image);
    for (const [x, y] of SPECKS) {
      const speck = scene.add.image(x, y, 'speck').setVisible(false);
      this.specks.push(speck);
      this.container.add(speck);
    }

    this.image.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-6, -6, this.image.width + 12, this.image.height + 12),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    this.image.on('pointerdown', () => onSelect(this));
    this.refresh();
  }

  get id() {
    return this.egg.id;
  }

  get x() {
    return this.container.x;
  }

  get top() {
    return this.container.y - this.image.height;
  }

  update(egg: HouseholdEgg) {
    this.egg = egg;
    this.refresh();
  }

  setSelected(selected: boolean) {
    if (selected && !this.marker) {
      this.marker = this.scene.add.image(0, -this.image.height - 4, 'marker');
      this.container.add(this.marker);
    } else if (!selected && this.marker) {
      this.marker.destroy();
      this.marker = undefined;
    }
  }

  /** L'œuf remue de plus en plus souvent à mesure que l'éclosion approche. */
  private refresh() {
    const dirt = this.egg.description.cleanliness.split('.').pop();
    const visible = dirt === 'bad' ? 3 : dirt === 'low' ? 1 : 0;
    this.specks.forEach((speck, index) => speck.setVisible(index < visible));

    this.wobble?.remove();
    const progress = this.egg.description.progress;
    const every = progress === 'egg.progress.almost' ? 1800 : progress === 'egg.progress.moving' ? 4500 : 0;
    if (every) this.wobble = this.scene.time.addEvent({ delay: every, loop: true, callback: () => this.shake(2) });
  }

  private shake(times: number, onDone?: () => void) {
    this.scene.tweens.add({
      targets: this.image,
      x: 1,
      duration: 70,
      yoyo: true,
      repeat: times * 2 - 1,
      ease: 'Stepped',
      onComplete: () => {
        this.image.setX(0);
        onDone?.();
      },
    });
  }

  /** Éclosion : la coquille se fêle, tremble, puis disparaît. */
  hatch(onOpened: () => void) {
    this.wobble?.remove();
    this.setSelected(false);
    this.image.setTexture('eggCracked');
    this.shake(4, () => {
      this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        duration: 250,
        onComplete: () => {
          onOpened();
          this.destroy();
        },
      });
    });
  }

  destroy() {
    this.wobble?.remove();
    this.container.destroy();
  }
}
