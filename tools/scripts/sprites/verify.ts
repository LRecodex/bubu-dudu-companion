// Read-only verification of the current generated assets and debug frames.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import config from '../../sprite.config.js';
import { detectFrames } from './detectFrames.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));

for (const character of ['bubu', 'dudu']) {
  const output = path.join(root, config.outputDirectory, character, 'idle');
  const metadata = JSON.parse(await readFile(`${output}.json`, 'utf8'));
  assert.equal(metadata.character, character);
  assert.equal(metadata.frameCount, 6);
  const sheet = await sharp(`${output}.png`).metadata();
  assert.equal(sheet.width, 1536);
  assert.equal(sheet.height, 256);
  assert.equal(sheet.hasAlpha, true);
  for (let i = 0; i < 6; i++) {
    const frame = await sharp(path.join(root, config.debugDirectory, character, 'idle', `frame-${i}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(frame.info.width, 256); assert.equal(frame.info.height, 256);
    const bounds = detectFrames(frame.data, 256, 256, config).boxes;
    assert.equal(bounds.length, 1);
    assert.equal(bounds[0].top + bounds[0].height - 1, 236);
    const extracted = await sharp(`${output}.png`).extract({ left: i * 256, top: 0, width: 256, height: 256 }).ensureAlpha().raw().toBuffer();
    assert.deepEqual(extracted, frame.data);
  }
  console.log(`${character}: 1536x256 RGBA, six debug frames match sheet, all baselines = 236`);
}
for (const [file, expected] of [
  ['assets/bubu/idle-6-frame.png', '6f84967f05824e0231969418e31c599b73848c36096490c93bc0d181d698971c'],
  ['assets/dudu/idle-6-frame.png', '9831ce1eda001d80a551ea532671b03dba6b618fc8644e731529b3e18a310fc5'],
  ['assets/reference/Bubu dudu reference.png', '69e772179b8466845e4d402a9c6164f279b007906f090c170b196add209ac7b0'],
]) {
  assert.equal(createHash('sha256').update(await readFile(path.join(root, file))).digest('hex'), expected);
}
console.log('All three original images remain byte-for-byte unchanged.');
