import { mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import config from '../../sprite.config.js';
import { parseAsset } from './filename.js';
import { detectFrames, detectGrid } from './detectFrames.js';
import { commonScale, normalizeFrame } from './normalizeFrame.js';
import { buildSheet } from './buildSheet.js';
import { writeDetection } from './debug.js';
import { addBackgroundTransparency } from './autoTransparency.js';

// Configured paths resolve from BDC, independently of the shell cwd.
const root = fileURLToPath(new URL('../../../', import.meta.url));
const inside = (parent: string, child: string) => {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

async function main() {
  for (const key of ['frameWidth', 'frameHeight', 'padding', 'baselineY', 'alphaThreshold', 'noiseThreshold'] as const) {
    if (!Number.isSafeInteger(config[key]) || config[key] < 0) throw new Error(`Invalid config: ${key}`);
  }
  if (config.noiseThreshold < 1 || config.alphaThreshold >= 255 || config.frameWidth <= 2 * config.padding ||
    config.baselineY < config.padding || config.baselineY >= config.frameHeight - config.padding + 1) {
    throw new Error('Invalid frame geometry or detection thresholds');
  }
  for (const key of ['detachmentGap', 'gridTolerance'] as const) {
    if (!Number.isFinite(config[key]) || config[key] < 0 || config[key] >= 0.5) throw new Error(`Invalid config: ${key} must be a fraction below 0.5`);
  }
  if (new Set(config.characters).size !== config.characters.length || config.characters.some(c => !/^[a-zA-Z0-9_-]+$/.test(c) || c.toLowerCase() === 'reference')) {
    throw new Error('Character directories must be unique simple names; reference is always excluded');
  }
  const sourceRoot = await realpath(path.resolve(root, config.sourceDirectory));
  // Resolve existing ancestors to reject output symlinks pointing into sources.
  async function resolvedDestination(destination: string): Promise<string> {
    try { return await realpath(destination); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return path.join(await resolvedDestination(path.dirname(destination)), path.basename(destination));
    }
  }
  const outputRoot = await resolvedDestination(path.resolve(root, config.outputDirectory));
  const debugRoot = await resolvedDestination(path.resolve(root, config.debugDirectory));
  for (const dest of [outputRoot, debugRoot]) {
    if (inside(sourceRoot, dest) || inside(dest, sourceRoot)) throw new Error('Output/debug directories must not overlap source directory');
  }
  if (inside(outputRoot, debugRoot) || inside(debugRoot, outputRoot)) throw new Error('Output and debug directories must be separate');
  const args = process.argv.slice(2);
  const debug = args.includes('--debug');
  const positional = args.filter(a => a !== '--debug');
  if (positional.length > 1 || positional.some(a => a.startsWith('-'))) throw new Error('Usage: npm run sprites -- [character/animation-N-frame.png | character/animation-CxR-frame.png] [--debug]');
  const assets: string[] = [];
  if (positional.length) assets.push(positional[0]);
  else for (const character of config.characters) {
    for (const entry of await readdir(path.join(sourceRoot, character), { withFileTypes: true })) {
      if (entry.isFile() && /-(?:\d+x\d+|\d+)-frame\.png$/.test(entry.name)) assets.push(`${character}/${entry.name}`);
    }
  }
  assets.sort();
  let succeeded = 0, failed = 0;
  const summary: string[] = [];
  for (const asset of assets) {
    let counts = '';
    try {
      const { character, animation, frameCount, columns, rows } = parseAsset(asset, config.characters);
      const sourcePath = await realpath(path.join(sourceRoot, asset));
      if (!inside(path.join(sourceRoot, character), sourcePath)) throw new Error('Source symlink leaves its character directory');
      let source: Buffer = await readFile(sourcePath);
      const metadata = await sharp(source).metadata();
      if (!metadata.hasAlpha) {
        const converted = await addBackgroundTransparency(source);
        source = converted.image;
        console.log(`${asset}: inferred transparency, removed ${converted.removedPixels} background pixels`);
      }
      const { data, info } = await sharp(source).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const detection = columns !== null && rows !== null
        ? detectGrid(data, info.width, info.height, columns, rows, config)
        : detectFrames(data, info.width, info.height, config);
      counts = `${detection.boxes.length}/${frameCount}`;
      const debugDirectory = await resolvedDestination(path.join(debugRoot, character, animation));
      if (!inside(debugRoot, debugDirectory)) throw new Error('Debug destination leaves configured directory');
      if (debug || detection.boxes.length !== frameCount) {
        await writeDetection(debugDirectory, source, info.width, info.height, detection, frameCount, config.baselineY);
      }
      if (detection.boxes.length !== frameCount) {
        throw new Error(`Expected frames: ${frameCount}\nDetected frames: ${detection.boxes.length}\n\nPossible causes:\n- two frames touching\n- transparent separation not detected\n- stray pixels connecting frames\n- source image does not contain ${frameCount} frames\nDebug: ${debugDirectory}`);
      }
      const scale = commonScale(detection.boxes, config);
      const frames: Buffer[] = [];
      for (const box of detection.boxes) frames.push(await normalizeFrame(source, box, scale, config));
      if (debug) for (let i = 0; i < frames.length; i++) {
        await writeFile(path.join(debugDirectory, `frame-${i}.png`), frames[i]);
      }
      const sheet = await buildSheet(frames, config);
      const directory = await resolvedDestination(path.join(outputRoot, character));
      if (!inside(outputRoot, directory)) throw new Error('Output destination leaves configured directory');
      await mkdir(directory, { recursive: true });
      for (const extension of ['png', 'json']) {
        const target = await resolvedDestination(path.join(directory, `${animation}.${extension}`));
        if (!inside(outputRoot, target)) throw new Error('Output file leaves configured directory');
      }
      await writeFile(path.join(directory, `${animation}.png`), sheet);
      await writeFile(path.join(directory, `${animation}.json`), JSON.stringify({ character, animation,
        frameWidth: config.frameWidth, frameHeight: config.frameHeight, frameCount,
        sheetWidth: config.frameWidth * frameCount, sheetHeight: config.frameHeight,
        // Output pixels per source pixel. Dividing a chosen on-screen pixel size
        // by this keeps every animation's artwork the same size on screen, so a
        // curled-up sleeping pose does not render larger than a standing one.
        scale: Number(scale.toFixed(6)), baselineY: config.baselineY }, null, 2) + '\n');
      const layout = columns !== null && rows !== null ? `grid ${columns}x${rows}` : 'auto';
      const dropped = detection.detachedPixels ? `, dropped ${detection.detachedPixels} detached pixels` : '';
      console.log(`${asset}: ${layout}, scale=${scale.toFixed(5)}, ignored ${detection.ignoredPixels} noise pixels${dropped}`);
      succeeded++; summary.push(`✓ ${asset}    ${counts}`);
    } catch (error) {
      failed++; summary.push(`✗ ${asset}    ${counts}`);
      console.error(`ERROR: ${config.sourceDirectory}/${asset}\n\n${(error as Error).message}\n`);
    }
  }
  console.log(`\nSprite preprocessing complete\n\n${summary.join('\n')}\n\n${succeeded} succeeded\n${failed} failed`);
  if (!assets.length) console.log('No matching source assets found.');
  if (failed) process.exitCode = 1;
}

main().catch(error => { console.error(`ERROR: ${(error as Error).message}`); process.exitCode = 1; });
