import sharp from 'sharp';
import type { SpriteConfig } from './types.js';

export async function buildSheet(frames: Buffer[], config: SpriteConfig) {
  const width = frames.length * config.frameWidth;
  const pixels = Buffer.alloc(width * config.frameHeight * 4);
  // Direct row copies avoid an unnecessary alpha blend/unpremultiply round trip.
  for (const [i, frame] of frames.entries()) {
    const { data, info } = await sharp(frame).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== config.frameWidth || info.height !== config.frameHeight || info.channels !== 4) throw new Error('Unexpected normalized frame dimensions');
    const rowBytes = config.frameWidth * 4;
    for (let y = 0; y < config.frameHeight; y++) {
      data.copy(pixels, (y * width + i * config.frameWidth) * 4, y * rowBytes, (y + 1) * rowBytes);
    }
  }
  return sharp(pixels, { raw: { width, height: config.frameHeight, channels: 4 } }).png().toBuffer();
}
