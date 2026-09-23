import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Grid cells are catalog entries, never animation frames. Optional row cuts
// accommodate hand-spaced sheets. Background removal follows closed ink outlines.
const source = process.argv[2] ?? 'assets/furniture/default-furniture-5x5-frame.png';
const destination = process.argv[3] ?? 'public/assets/furniture';
const columns = Number(process.argv[4] ?? 5);
const rows = Number(process.argv[5] ?? 5);
if (![columns, rows].every(n => Number.isInteger(n) && n > 0 && n <= 50)) throw Error('Invalid grid');
const metadata = await sharp(source).metadata();
const cuts = process.argv[6]?.split(',').map(Number) ?? Array.from({ length: rows + 1 }, (_, i) => Math.round(i * metadata.height / rows));
if (cuts.length !== rows + 1 || cuts[0] !== 0 || cuts.at(-1) !== metadata.height || cuts.some((n, i) => !Number.isInteger(n) || (i > 0 && n <= cuts[i - 1]))) throw Error('Invalid row cuts');
await mkdir(destination, { recursive: true });
const entries = [];
for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
  const left = Math.round(col * metadata.width / columns);
  const width = Math.round((col + 1) * metadata.width / columns) - left;
  const top = Math.max(0, cuts[row] - 16);
  const height = Math.min(metadata.height, cuts[row + 1] + 16) - top;
  const { data } = await sharp(source).extract({ left, top, width, height }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // Transparent sources need no cleanup. For opaque illustrated sheets, ink
  // forms a barrier, keeping the interior colors while flooding the perimeter.
  if (!data.some((v, i) => i % 4 === 3 && v < 255)) {
    const seen = new Uint8Array(width * height), queue = [];
    const add = p => {
      if (seen[p]) return;
      const i = p * 4;
      if (data[i] * .2126 + data[i + 1] * .7152 + data[i + 2] * .0722 < 57) return;
      seen[p] = 1; queue.push(p);
    };
    for (let x = 0; x < width; x++) { add(x); add((height - 1) * width + x); }
    for (let y = 0; y < height; y++) { add(y * width); add(y * width + width - 1); }
    for (let q = 0; q < queue.length; q++) {
      const p = queue[q], x = p % width;
      if (x) add(p - 1); if (x < width - 1) add(p + 1);
      if (p >= width) add(p - width); if (p < width * (height - 1)) add(p + width);
    }
    for (let p = 0; p < seen.length; p++) if (seen[p]) data[p * 4 + 3] = 0;
  }
    // Retain the main connected object; expanded row crops can include the
    // tip of a neighboring row. This importer targets single connected items.
    const visited = new Uint8Array(width * height);
    let largest = [];
    for (let start = 0; start < visited.length; start++) {
      if (visited[start] || data[start * 4 + 3] < 32) continue;
      const component = [start]; visited[start] = 1;
      for (let q = 0; q < component.length; q++) {
        const p = component[q], x = p % width, y = Math.floor(p / width);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy, n = ny * width + nx;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height || visited[n] || data[n * 4 + 3] < 32) continue;
          visited[n] = 1; component.push(n);
        }
      }
      if (component.length > largest.length) largest = component;
    }
    const keep = new Set(largest);
    for (let p = 0; p < visited.length; p++) if (!keep.has(p)) data[p * 4 + 3] = 0;
  const name = `row-${row + 1}-variant-${col + 1}`;
  await sharp(data, { raw: { width, height, channels: 4 } }).trim({ background: '#00000000', threshold: 1 }).resize(256, 256, { fit: 'contain', background: '#00000000' }).png().toFile(path.join(destination, `${name}.png`));
  entries.push({ name, row, variant: col, file: `${name}.png` });
}
await writeFile(path.join(destination, 'catalog.json'), JSON.stringify({ source: path.basename(source), columns, rows, entries }, null, 2));
console.log(`Imported ${entries.length} furniture variants into ${destination}`);
