import Phaser from 'phaser';

export const characters = ['bubu', 'dudu'] as const;
export type Character = (typeof characters)[number];

/** Every per-character sheet the room loads. */
export const characterAnimations = ['idle', 'walk-front', 'walk-back', 'walk-side', 'sleep'] as const;
export type CharacterAnimation = (typeof characterAnimations)[number];

/** What the wander loop picks between. Walking chooses its own sheet from the
 * direction actually travelled. */
export const wanderStates = ['idle', 'walk', 'sleep'] as const;
export type WanderState = (typeof wanderStates)[number];

/** Two-character scenes. Each is one sprite holding both characters, so it
 * replaces the pair rather than animating them separately. */
export const interactionDirectory = 'bubu-dudu-interact';
export const interactions = [
  { key: 'share-food', label: 'Share food' },
  { key: 'bubu-hammer', label: 'Hammer' },
  { key: 'dudu-slap', label: 'Slap' },
] as const;
export type Interaction = (typeof interactions)[number]['key'];

export interface SpriteMetadata {
  character: string;
  animation: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  sheetWidth: number;
  sheetHeight: number;
  /** Output pixels per source pixel, written by the preprocessing tool. */
  scale: number;
  baselineY: number;
}

export const ROOM = {
  width: 1280,
  height: 720,
  groundY: 480,
  /** On-screen pixels per *source* pixel. Every animation divides this by its
   * own `scale`, so artwork drawn at one size stays that size on screen
   * whatever the preprocessor had to do to fit it in a 256x256 frame. */
  pixelScale: 0.226,
  /** The isometric floor diamond from temporaryRoom, as centre and radii. */
  floor: { x: 640, y: 450, halfWidth: 190, halfHeight: 110 },
  /** Perspective. A character shrinks towards the back of the room and grows
   * towards the front, at exactly 1.0 on `groundY`. */
  depth: { perPixel: 0.0014, min: 0.85, max: 1.1 },
  /** The whole floor is walkable. `minY`/`maxY` stop short of the diamond's
   * back and front vertices, where it narrows to nothing; `margin` keeps a
   * body's width on the boards; `separation` keeps the two from standing on
   * top of each other. That clearance is an ellipse, not a circle: two
   * characters side by side merely stand apart, but one directly behind the
   * other is largely hidden by it, so depth needs far more room than width. */
  walk: {
    minY: 384, maxY: 530, speed: 34, margin: 40,
    separation: { side: 66, depth: 100 },
    /** Walks shorter than this are not worth leaving idle for. */
    minTravel: 30,
  },
};

export const frameRates: Record<string, number> = {
  idle: 4, sleep: 3, 'walk-front': 8, 'walk-back': 8, 'walk-side': 8,
};

/** The side sheet is drawn facing right, so walking left mirrors it. */
export const sideFacesRight = true;
export const interactionFrameRate = 5;

/**
 * Size correction per animation, relative to `idle`, which is the reference.
 *
 * The source sheets are not all drawn at one scale: the sleep artwork and the
 * two-character scenes are drawn noticeably smaller than the standing poses.
 * Normalising by the preprocessor's `scale` alone therefore leaves a sleeping
 * character looking like a smaller animal than the same character standing.
 * These factors restore one consistent character size. They are set by eye
 * against idle, because no automatic measure survives the pose changes -
 * outline stroke width, the obvious candidate, disagrees with itself across
 * two standing sheets of the same character.
 */
export const sizeFactors: Record<string, number> = {
  sleep: 1.5,
  'share-food': 1.5,
  'bubu-hammer': 1.4,
  'dudu-slap': 1.25,
};

/** On-screen scale for one animation, so every sheet renders consistently. */
export const displayScale = (asset: SpriteMetadata) =>
  (ROOM.pixelScale / asset.scale) * (sizeFactors[asset.animation] ?? 1);

/** Perspective multiplier for standing at this depth. */
export const depthScale = (y: number) =>
  Phaser.Math.Clamp(1 + (y - ROOM.groundY) * ROOM.depth.perPixel, ROOM.depth.min, ROOM.depth.max);

export function gameConfig(parent: HTMLElement, scene: Phaser.Scene): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    transparent: true,
    width: 440,
    height: 500,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [scene],
    audio: { noAudio: true },
  };
}
