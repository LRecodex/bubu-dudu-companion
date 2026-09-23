import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import config from '../../sprite.config.js';
import { parseAsset, parseFilename } from './filename.js';
import { detectFrames, detectGrid } from './detectFrames.js';
import { commonScale, normalizeFrame, placement } from './normalizeFrame.js';
import { buildSheet } from './buildSheet.js';
import { addBackgroundTransparency } from './autoTransparency.js';
import type { DetectOptions } from './types.js';

const options = (overrides: Partial<DetectOptions> = {}): DetectOptions => ({
  alphaThreshold: 10, noiseThreshold: 3, detachmentGap: 0.15, gridTolerance: 0.35, ...overrides,
});

test('opaque checkerboard backgrounds become transparent without erasing the sprite', async () => {
  const width = 20, height = 12;
  const rgb = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 3, shade = (x + y) % 2 ? 210 : 245;
    rgb[i] = shade; rgb[i + 1] = shade; rgb[i + 2] = shade;
    if (x >= 6 && x <= 13 && y >= 3 && y <= 9) { rgb[i] = 190; rgb[i + 1] = 100; rgb[i + 2] = 60; }
  }
  const source = await sharp(rgb, { raw: { width, height, channels: 3 } }).png().toBuffer();
  const converted = await addBackgroundTransparency(source);
  const { data } = await sharp(converted.image).raw().toBuffer({ resolveWithObject: true });
  assert.equal(data[3], 0);
  assert.equal(data[(5 * width + 10) * 4 + 3], 255);
  assert.ok(converted.removedPixels > width * height / 2);
});

test('filename, frame count, grid layout, animation and character parsing', () => {
  assert.deepEqual(parseFilename('happy-walk-8-frame.png'), { animation: 'happy-walk', frameCount: 8, columns: null, rows: null });
  assert.deepEqual(parseFilename('share-food-4x2-frame.png'), { animation: 'share-food', frameCount: 8, columns: 4, rows: 2 });
  assert.deepEqual(parseFilename('bubu-hammer-6x1-frame.png'), { animation: 'bubu-hammer', frameCount: 6, columns: 6, rows: 1 });
  assert.deepEqual(parseAsset('dudu\\run-8-frame.png', config.characters), { character: 'dudu', animation: 'run', frameCount: 8, columns: null, rows: null });
  assert.equal(parseAsset('bubu/idle-6-frame.png', config.characters).character, 'bubu');
  assert.equal(parseAsset('bubu-dudu-interact/share-food-4x2-frame.png', config.characters).frameCount, 8);
  for (const name of ['idle.png', 'idle-0-frame.png', 'idle-6-frame.jpg', '../idle-6-frame.png', 'idle-0x2-frame.png', 'idle-2x-frame.png']) {
    assert.throws(() => parseFilename(name));
  }
  for (const name of ['reference/idle-6-frame.png', '../idle-6-frame.png', 'bubu/nested/idle-6-frame.png']) {
    assert.throws(() => parseAsset(name, [...config.characters, 'reference']));
  }
});

test('unequal horizontal regions, alpha threshold, noise and exact bounds', () => {
  const width = 30, height = 12, data = Buffer.alloc(width * height * 4);
  const pixel = (x: number, y: number, alpha: number) => { data[(y * width + x) * 4 + 3] = alpha; };
  for (let y = 2; y <= 7; y++) for (let x = 2; x <= 5; x++) pixel(x, y, 11);
  for (let y = 1; y <= 9; y++) for (let x = 15; x <= 23; x++) pixel(x, y, 180);
  pixel(10, 3, 255); pixel(11, 4, 255); // Eight-connected, but too small.
  for (let x = 6; x < 15; x++) pixel(x, 6, 10); // Faint bridge is below threshold.
  const detection = detectFrames(data, width, height, options());
  assert.deepEqual(detection.boxes, [{ left: 2, top: 2, width: 4, height: 6 }, { left: 15, top: 1, width: 9, height: 9 }]);
  assert.equal(detection.ignoredComponents, 1);
  assert.equal(detection.ignoredPixels, 2);
  assert.equal(detectFrames(Buffer.alloc(16), 2, 2, options({ noiseThreshold: 1 })).boxes.length, 0);
  assert.throws(() => detectFrames(data, 1, 1, options({ noiseThreshold: 1 })));
});

test('touching characters remain merged instead of fabricating expected frames', () => {
  const data = Buffer.alloc(10 * 4, 255);
  assert.equal(detectFrames(data, 10, 1, options({ noiseThreshold: 1 })).boxes.length, 1);
});

test('a detached blob below the body is dropped, one above the body is kept', () => {
  const width = 40, height = 40, data = Buffer.alloc(width * height * 4);
  const fill = (x0: number, x1: number, y0: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) data[(y * width + x) * 4 + 3] = 255;
  };
  fill(10, 29, 10, 25);  // Body: 20x16, dominant.
  fill(12, 17, 4, 6);    // Motion lines above: artwork, must survive.
  fill(20, 23, 34, 36);  // Smudge far below: artifact, must be dropped.
  const detection = detectFrames(data, width, height, options());
  assert.equal(detection.boxes.length, 1);
  assert.deepEqual(detection.boxes[0], { left: 10, top: 4, width: 20, height: 22 });
  assert.equal(detection.boxes[0].top + detection.boxes[0].height - 1, 25);
  assert.deepEqual(detection.detachedBoxes, [{ left: 20, top: 34, width: 4, height: 3 }]);
  assert.equal(detection.detachedPixels, 12);
  // Raising the tolerance past the gap makes the same blob count as artwork.
  const lenient = detectFrames(data, width, height, options({ detachmentGap: 1 }));
  assert.equal(lenient.detachedBoxes.length, 0);
  assert.equal(lenient.boxes[0].top + lenient.boxes[0].height - 1, 36);
});

test('grid slicing keeps two characters per frame together and splits rows', () => {
  const width = 80, height = 40, data = Buffer.alloc(width * height * 4);
  const fill = (x0: number, x1: number, y0: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) data[(y * width + x) * 4 + 3] = 255;
  };
  // Two cells per row. Each cell holds two characters with a gap between them
  // that is narrower than the gap between cells.
  for (const [top, bottom] of [[3, 15], [23, 35]] as const) {
    fill(2, 11, top, bottom); fill(16, 25, top, bottom);   // Cell 0: pair.
    fill(42, 51, top, bottom); fill(56, 65, top, bottom);  // Cell 1: pair.
  }
  // Automatic layout has no cell concept: it splits each pair apart and never
  // reports the four frames this sheet actually holds.
  assert.equal(detectFrames(data, width, height, options()).boxes.length, 4);
  const grid = detectGrid(data, width, height, 2, 2, options());
  assert.equal(grid.boxes.length, 4);
  assert.deepEqual(grid.boxes.map(b => [b.left, b.top, b.width, b.height]), [
    [2, 3, 24, 13], [42, 3, 24, 13], [2, 23, 24, 13], [42, 23, 24, 13],
  ]);
  assert.equal(grid.cuts?.rows.length, 1);
  assert.deepEqual(grid.cuts?.columns.map(row => row.length), [1, 1]);
});

test('grid slicing separates frames that touch, where automatic layout cannot', () => {
  const width = 40, height = 20, data = Buffer.alloc(width * height * 4);
  for (let y = 4; y <= 15; y++) for (let x = 2; x <= 37; x++) data[(y * width + x) * 4 + 3] = 255;
  assert.equal(detectFrames(data, width, height, options()).boxes.length, 1);
  const grid = detectGrid(data, width, height, 2, 1, options());
  assert.equal(grid.boxes.length, 2);
  assert.ok(grid.boxes[0].left < grid.boxes[1].left);
});

test('common scale preserves relative sizes and uses both maximum dimensions', () => {
  const boxes = [{ left: 0, top: 0, width: 400, height: 100 }, { left: 0, top: 0, width: 100, height: 500 }];
  const scale = commonScale(boxes, config);
  assert.equal(scale, 217 / 500);
  for (const box of boxes) {
    const p = placement(box, scale, config);
    assert.equal(p.top + p.height - 1, 236);
    assert.ok(p.left >= 20 && p.top >= 20);
    assert.ok(Math.abs(p.width / box.width - scale) <= 0.5 / box.width);
  }
  assert.throws(() => commonScale([], config));
});

test('Sharp normalization keeps transparent canvas, frame order and meaningful baseline', async () => {
  const boxes = [{ left: 0, top: 0, width: 10, height: 20 }, { left: 0, top: 0, width: 10, height: 10 }];
  const frames: Buffer[] = [];
  const scale = commonScale(boxes, config);
  for (const [i, box] of boxes.entries()) {
    const source = await sharp({ create: { width: box.width, height: box.height, channels: 4, background: i ? '#00ff00' : '#ff0000' } }).png().toBuffer();
    const frame = await normalizeFrame(source, box, scale, config);
    const { data, info } = await sharp(frame).raw().toBuffer({ resolveWithObject: true });
    const bounds = detectFrames(data, info.width, info.height, options({ noiseThreshold: 12 })).boxes[0];
    assert.equal(bounds.top + bounds.height - 1, 236);
    assert.equal(data[3], 0);
    frames.push(frame);
  }
  const sheet = await buildSheet(frames, config);
  const { data, info } = await sharp(sheet).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 512); assert.equal(info.height, 256); assert.equal(info.channels, 4);
  assert.equal(data[(236 * 512 + 128) * 4], 255);
  assert.equal(data[(236 * 512 + 384) * 4 + 1], 255);
});
