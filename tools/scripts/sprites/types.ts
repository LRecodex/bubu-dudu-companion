export interface DetectOptions {
  alphaThreshold: number;
  /** Minimum number of connected pixels retained for detection. */
  noiseThreshold: number;
  /** A component whose top sits this fraction of the dominant component's
   * height below its bottom is a detached source artifact, not artwork. */
  detachmentGap: number;
  /** How far a grid cut may slide from its even position, as a fraction of
   * one cell, to land on the real gap between hand-spaced frames. */
  gridTolerance: number;
}

export interface SpriteConfig extends DetectOptions {
  frameWidth: number;
  frameHeight: number;
  padding: number;
  baselineY: number;
  sourceDirectory: string;
  outputDirectory: string;
  debugDirectory: string;
  characters: string[];
}

export interface Box { left: number; top: number; width: number; height: number }

export interface Detection {
  boxes: Box[];
  /** Components excluded as detached artifacts, for debug overlays. */
  detachedBoxes: Box[];
  ignoredComponents: number;
  ignoredPixels: number;
  detachedPixels: number;
  /** Grid mode only: the chosen row cuts and, per row band, the column cuts. */
  cuts?: { rows: number[]; columns: number[][] };
}
