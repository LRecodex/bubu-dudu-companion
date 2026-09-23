import Phaser from 'phaser';
import {
  characterAnimations, characters, depthScale, displayScale, frameRates, interactionDirectory,
  interactionFrameRate, interactions, ROOM, sideFacesRight, wanderStates,
  type Character, type Interaction, type SpriteMetadata, type WanderState,
} from '../config';
import { gameEvents } from '../events';
import { drawTemporaryRoom } from './temporaryRoom';

interface Companion {
  name: Character;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  /** Where this character starts, and returns to after an interaction.
   * Wandering is free of it: the whole floor is fair game. */
  homeX: number;
  /** The current animation's on-screen scale, before perspective. */
  baseScale: number;
  timer?: Phaser.Time.TimerEvent;
  tween?: Phaser.Tweens.Tween;
}

/** Every sheet the room needs, as `<directory>/<animation>`. */
const sheets = [
  ...characters.flatMap(c => characterAnimations.map(a => [c, a] as const)),
  ...interactions.map(i => [interactionDirectory, i.key] as const),
];
const sheetKey = (directory: string, animation: string) => `${directory}-${animation}`;

/** How often each wander state comes up, as repeats in the pick pool. */
const wanderWeights: WanderState[] = wanderStates.flatMap(
  state => Array<WanderState>(state === 'idle' ? 4 : state === 'walk' ? 3 : 2).fill(state));

export class RoomScene extends Phaser.Scene {
  private companions: Companion[] = [];
  private interactionSprite?: Phaser.GameObjects.Sprite;
  private busy = false;
  private failed = false;

  constructor(private readonly onError: (message: string) => void) { super('RoomScene'); }

  private fail(message: string) {
    if (this.failed) return;
    this.failed = true;
    console.error(message);
    this.onError(message);
  }

  preload() {
    this.load.on('loaderror', (file: Phaser.Loader.File) => this.fail(`Could not load processed sprite: ${file.key}`));
    for (const [directory, animation] of sheets) {
      const base = `${import.meta.env.BASE_URL}assets/characters/${directory}/${animation}`;
      const key = sheetKey(directory, animation);
      this.load.once(`filecomplete-json-${key}-metadata`, (_key: string, _type: string, asset: SpriteMetadata) => {
        if (!this.validMetadata(asset, directory, animation, key)) return;
        this.load.spritesheet(key, `${base}.png`, { frameWidth: asset.frameWidth, frameHeight: asset.frameHeight });
      });
      this.load.json(`${key}-metadata`, `${base}.json`);
    }
  }

  private validMetadata(asset: SpriteMetadata, directory: string, animation: string, key: string) {
    const positive = [asset.frameWidth, asset.frameHeight, asset.frameCount, asset.sheetWidth, asset.sheetHeight];
    if (!asset || asset.character !== directory || asset.animation !== animation ||
      !positive.every(n => Number.isSafeInteger(n) && n > 0) ||
      !(Number.isFinite(asset.scale) && asset.scale > 0) ||
      !(Number.isSafeInteger(asset.baselineY) && asset.baselineY > 0 && asset.baselineY < asset.frameHeight) ||
      asset.sheetWidth !== asset.frameWidth * asset.frameCount || asset.sheetHeight !== asset.frameHeight) {
      this.fail(`Invalid processed sprite metadata: ${key}`);
      return false;
    }
    return true;
  }

  /** Builds the looping animation for one sheet and returns its metadata. */
  private register(directory: string, animation: string, frameRate: number) {
    const key = sheetKey(directory, animation);
    const asset = this.cache.json.get(`${key}-metadata`) as SpriteMetadata | undefined;
    if (!asset || !this.textures.exists(key)) { this.fail(`Missing processed sprite: ${key}`); return undefined; }
    const source = this.textures.get(key).getSourceImage() as HTMLImageElement;
    if (source.width !== asset.sheetWidth || source.height !== asset.sheetHeight ||
      this.textures.get(key).frameTotal - 1 !== asset.frameCount) {
      this.fail(`Processed sprite/metadata mismatch: ${key}. Check sprite preprocessing output.`);
      return undefined;
    }
    if (!this.anims.exists(key)) this.anims.create({
      key,
      frames: this.anims.generateFrameNumbers(key, { start: 0, end: asset.frameCount - 1 }),
      frameRate,
      repeat: -1,
    });
    return asset;
  }

  create() {
    // Tight viewport around the existing room, preserving all artwork coordinates.
    this.cameras.main.setScroll(420, 130);
    drawTemporaryRoom(this);

    for (const [directory, animation] of sheets) {
      const rate = directory === interactionDirectory ? interactionFrameRate : frameRates[animation] ?? 4;
      if (!this.register(directory, animation, rate)) return;
    }

    for (const [index, name] of characters.entries()) {
      const key = sheetKey(name, 'idle');
      const asset = this.cache.json.get(`${key}-metadata`) as SpriteMetadata;
      const homeX = ROOM.floor.x + (index === 0 ? -58 : 58);
      const shadow = this.add.ellipse(homeX, ROOM.groundY + 1, 65, 17, 0x80684f, 0.15);
      // Every sheet shares baseline row 236, so anchoring that row to groundY
      // keeps the feet planted whatever the pose does above it.
      const sprite = this.add.sprite(homeX, ROOM.groundY, key)
        .setName(name).setOrigin(0.5, asset.baselineY / asset.frameHeight);
      const companion: Companion = { name, sprite, shadow, homeX, baseScale: displayScale(asset) };
      this.companions.push(companion);
      this.place(companion, ROOM.groundY);
      // A stagger keeps the two from changing state in lockstep.
      companion.timer = this.time.delayedCall(index * 900, () => this.nextState(companion));
      this.enter(companion, 'idle');
      sprite.once(Phaser.Animations.Events.ANIMATION_REPEAT, () => console.info(`[BDC] ${key} loop verified`));
    }

    this.interactionSprite = this.add.sprite(ROOM.floor.x, ROOM.groundY, sheetKey(interactionDirectory, interactions[0].key))
      .setVisible(false).setDepth(1000);

    gameEvents.on('play-interaction', this.startInteraction, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      gameEvents.off('play-interaction', this.startInteraction, this);
      gameEvents.emit('interaction-state', false);
    });
    console.info('[BDC] RoomScene ready');
  }

  /** Widest x the floor diamond allows at this depth, less the sprite's reach. */
  private floorHalfWidth(y: number) {
    const { y: centreY, halfWidth, halfHeight } = ROOM.floor;
    const room = 1 - Math.min(1, Math.abs(y - centreY) / halfHeight);
    return Math.max(0, halfWidth * room - ROOM.walk.margin);
  }

  /** Anywhere else on the floor that is not already occupied. The diamond
   * narrows towards its vertices and the pair need clearance, so a spot is not
   * always available. */
  private pickTarget(companion: Companion) {
    const { minY, maxY, minTravel, separation } = ROOM.walk;
    for (let attempt = 0; attempt < 24; attempt++) {
      const y = Phaser.Math.Between(minY, maxY);
      const limit = this.floorHalfWidth(y);
      if (limit <= 0) continue;
      const x = Phaser.Math.Between(ROOM.floor.x - limit, ROOM.floor.x + limit);
      if (Phaser.Math.Distance.Between(x, y, companion.sprite.x, companion.sprite.y) < minTravel) continue;
      const clear = this.companions.every(other => other === companion ||
        Math.hypot((x - other.sprite.x) / separation.side, (y - other.sprite.y) / separation.depth) >= 1);
      if (clear) return { x, y };
    }
    return undefined;
  }

  private place(companion: Companion, y: number, x = companion.sprite.x) {
    const limit = this.floorHalfWidth(y);
    const clamped = Phaser.Math.Clamp(x, ROOM.floor.x - limit, ROOM.floor.x + limit);
    // Depth drives draw order, size and shadow together, so a character at the
    // back of the room reads as further away rather than merely higher up.
    const perspective = depthScale(y);
    companion.sprite.setPosition(clamped, y).setDepth(y).setScale(companion.baseScale * perspective);
    companion.shadow.setPosition(clamped, y + 1).setDepth(y - 0.1).setScale(perspective);
  }

  private apply(companion: Companion, animation: string, flipX = false) {
    const key = sheetKey(companion.name, animation);
    const asset = this.cache.json.get(`${key}-metadata`) as SpriteMetadata;
    companion.baseScale = displayScale(asset);
    companion.sprite.setFlipX(flipX).setOrigin(0.5, asset.baselineY / asset.frameHeight).play(key, true);
    this.place(companion, companion.sprite.y);
  }

  private enter(companion: Companion, state: WanderState) {
    const target = state === 'walk' ? this.pickTarget(companion) : undefined;
    // With nowhere free to go, stand still rather than walk on the spot.
    if (!target) { this.apply(companion, state === 'walk' ? 'idle' : state); return; }
    const fromX = companion.sprite.x, fromY = companion.sprite.y;
    const dx = target.x - fromX, dy = target.y - fromY;
    // Three head directions from three sheets: the side sheet covers mostly
    // horizontal travel and is mirrored to walk the other way, while front and
    // back cover travel along the room's depth.
    if (Math.abs(dx) > Math.abs(dy)) this.apply(companion, 'walk-side', sideFacesRight ? dx < 0 : dx > 0);
    else this.apply(companion, dy >= 0 ? 'walk-front' : 'walk-back');
    const distance = Phaser.Math.Distance.Between(fromX, fromY, target.x, target.y);
    companion.tween = this.tweens.addCounter({
      from: 0, to: 1,
      duration: Math.max(700, (distance / ROOM.walk.speed) * 1000),
      onUpdate: tween => {
        const t = tween.getValue() ?? 0;
        this.place(companion, Phaser.Math.Linear(fromY, target.y, t), Phaser.Math.Linear(fromX, target.x, t));
      },
    });
  }

  private nextState(companion: Companion) {
    if (this.busy) return;
    // Idle is the common resting state; sleeping is the occasional one.
    const state = Phaser.Math.RND.pick(wanderWeights);
    this.enter(companion, state);
    const hold = state === 'sleep' ? Phaser.Math.Between(7000, 13000)
      : state === 'walk' ? (companion.tween?.duration ?? 1500) + 200
        : Phaser.Math.Between(2500, 6000);
    companion.timer = this.time.delayedCall(hold, () => this.nextState(companion));
  }

  private rest(companion: Companion) {
    companion.timer?.remove();
    companion.timer = undefined;
    companion.tween?.stop();
    companion.tween = undefined;
  }

  private startInteraction(key: Interaction) {
    const sprite = this.interactionSprite;
    if (this.busy || this.failed || !sprite || !interactions.some(i => i.key === key)) return;
    const asset = this.cache.json.get(`${sheetKey(interactionDirectory, key)}-metadata`) as SpriteMetadata | undefined;
    if (!asset) return;
    this.busy = true;
    gameEvents.emit('interaction-state', true);

    for (const companion of this.companions) {
      this.rest(companion);
      companion.sprite.setVisible(false).stop();
      companion.shadow.setVisible(false);
    }
    sprite.setOrigin(0.5, asset.baselineY / asset.frameHeight)
      .setScale(displayScale(asset) * depthScale(ROOM.groundY)).setPosition(ROOM.floor.x, ROOM.groundY).setVisible(true);
    // Two passes reads as a deliberate little scene rather than a flicker.
    sprite.play({ key: sheetKey(interactionDirectory, key), repeat: 1 });
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.endInteraction(key));
  }

  private endInteraction(key: Interaction) {
    this.interactionSprite?.setVisible(false).stop();
    this.busy = false;
    for (const [index, companion] of this.companions.entries()) {
      companion.sprite.setVisible(true);
      companion.shadow.setVisible(true);
      this.place(companion, ROOM.groundY, companion.homeX);
      this.enter(companion, 'idle');
      companion.timer = this.time.delayedCall(1200 + index * 700, () => this.nextState(companion));
    }
    gameEvents.emit('interaction-state', false);
    console.info(`[BDC] interaction ${key} complete`);
  }
}
