import type { SpriteConfig } from './scripts/sprites/types.js';

export default {
  frameWidth: 256,
  frameHeight: 256,
  padding: 20,
  // Pixel coordinate, inclusive: the last meaningful row sits at y=236.
  baselineY: 236,
  alphaThreshold: 10,
  noiseThreshold: 12,
  // Fraction of the dominant component's height. A component starting further
  // than this below it is a source artifact, not artwork, and is dropped.
  detachmentGap: 0.15,
  // Fraction of one cell a grid cut may slide to reach the real frame gap.
  gridTolerance: 0.35,
  // Paths are relative to the BDC root, not tools/.
  sourceDirectory: 'assets',
  outputDirectory: 'public/assets/characters',
  debugDirectory: 'sprite-debug',
  characters: ['bubu', 'dudu', 'bubu-dudu-interact'],
} satisfies SpriteConfig;
