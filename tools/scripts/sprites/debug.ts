import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Detection } from './types.js';

export async function writeDetection(directory: string, source: Buffer, width: number, height: number,
  detection: Detection, expected: number, baseline: number) {
  await mkdir(directory, { recursive: true });
  // Yellow: the grid cuts actually used. Magenta: frame bounds and source
  // order. Cyan: each source bottom. Orange dashes: components dropped as
  // detached artifacts, which no longer pull the frame off the baseline.
  const cuts = detection.cuts
    ? [...detection.cuts.rows.map(y => `<path d="M 0 ${y} h ${width}" stroke="#ffcc00" stroke-width="2" stroke-dasharray="12 8"/>`),
       ...detection.cuts.columns.map(row => row.map(x => `<path d="M ${x} 0 v ${height}" stroke="#ffcc00" stroke-width="2" stroke-dasharray="12 8"/>`).join(''))].join('')
    : '';
  const overlay = `<svg width="${width}" height="${height}">
    <rect width="${width}" height="30" fill="white" fill-opacity="0.9"/>
    <text x="8" y="21" font-size="16" fill="black">Detected ${detection.boxes.length}/${expected}; ignored ${detection.ignoredPixels} noise pixels; dropped ${detection.detachedPixels} detached pixels; output baseline y=${baseline}</text>
    ${cuts}
    ${detection.detachedBoxes.map(b => `<rect x="${b.left - 2}" y="${b.top - 2}" width="${b.width + 4}" height="${b.height + 4}" fill="none" stroke="#ff7700" stroke-width="2" stroke-dasharray="6 4"/>`).join('')}
    ${detection.boxes.map((b, i) => `<rect x="${b.left}" y="${b.top}" width="${b.width}" height="${b.height}" fill="none" stroke="#ff00cc" stroke-width="2"/>
      <path d="M ${b.left} ${b.top + b.height - 1} h ${b.width}" stroke="#00bfff" stroke-width="2"/>
      <text x="${b.left + 3}" y="${Math.max(48, b.top + 20)}" font-size="20" fill="#ff00cc">${i}</text>`).join('')}
  </svg>`;
  await sharp(source).composite([{ input: Buffer.from(overlay) }]).png().toFile(path.join(directory, 'detection.png'));
  await writeFile(path.join(directory, 'detection.json'), JSON.stringify({ expected, ...detection, outputBaselineY: baseline }, null, 2) + '\n');
}
