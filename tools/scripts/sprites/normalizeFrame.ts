import sharp from 'sharp';
import type { Box, SpriteConfig } from './types.js';

export function commonScale(boxes: Box[], config: SpriteConfig): number {
  if (!boxes.length || boxes.some(b => b.width <= 0 || b.height <= 0)) throw new Error('No valid frame bounds');
  return Math.min(
    (config.frameWidth - 2 * config.padding) / Math.max(...boxes.map(b => b.width)),
    (config.baselineY - config.padding + 1) / Math.max(...boxes.map(b => b.height)),
  );
}

export function placement(box: Box, scale: number, config: SpriteConfig) {
  const width = Math.max(1, Math.round(box.width * scale));
  const height = Math.max(1, Math.round(box.height * scale));
  return { width, height, left: Math.floor((config.frameWidth - width) / 2), top: config.baselineY - height + 1 };
}

export async function normalizeFrame(source: Buffer, box: Box, scale: number, config: SpriteConfig) {
  const target = placement(box, scale, config);
  // Both dimensions derive from ONE scale. fit:inside preserves aspect ratio
  // even when integer rounding changes the target rectangle by one pixel.
  const resized = await sharp(source).extract(box)
    .resize(target.width, target.height, { fit: 'inside', kernel: 'lanczos3' })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // Resampling can leave a faint edge row. Align using the same meaningful-alpha
  // definition as source detection, without changing or erasing any pixels.
  let lowest = -1;
  for (let y = 0; y < resized.info.height; y++) for (let x = 0; x < resized.info.width; x++) {
    if (resized.data[(y * resized.info.width + x) * 4 + 3] > config.alphaThreshold) lowest = y;
  }
  if (lowest < 0) throw new Error('Frame disappeared below alpha threshold after resizing');
  const top = config.baselineY - lowest;
  if (top < 0 || top + resized.info.height > config.frameHeight) throw new Error('Resized frame exceeds canvas');
  return sharp({ create: { width: config.frameWidth, height: config.frameHeight, channels: 4, background: '#00000000' } })
    .composite([{ input: resized.data, raw: resized.info, left: Math.floor((config.frameWidth - resized.info.width) / 2), top }])
    .png().toBuffer();
}
