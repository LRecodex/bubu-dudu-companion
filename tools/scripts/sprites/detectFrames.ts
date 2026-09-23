import type { Box, DetectOptions, Detection } from './types.js';

interface Component { pixels: number; left: number; top: number; right: number; bottom: number }

interface Labelled {
  components: Component[];
  /** Per pixel: the index of the retained component covering it, or -1. */
  owner: Int32Array;
  ignoredComponents: number;
  ignoredPixels: number;
}

/** Eight-connected components suppress isolated noise. Everything downstream
 * works on whole components rather than raw alpha, so a single speck can never
 * be mistaken for part of a frame. */
function label(rgba: Uint8Array, width: number, height: number, options: DetectOptions): Labelled {
  if (rgba.length !== width * height * 4) throw new Error('Expected RGBA pixel buffer');
  const visited = new Uint8Array(width * height);
  const owner = new Int32Array(width * height).fill(-1);
  const queue = new Int32Array(width * height);
  const components: Component[] = [];
  let ignoredComponents = 0, ignoredPixels = 0;
  for (let start = 0; start < visited.length; start++) {
    if (visited[start] || rgba[start * 4 + 3] <= options.alphaThreshold) continue;
    let head = 0, tail = 1;
    queue[0] = start;
    visited[start] = 1;
    while (head < tail) {
      const pixel = queue[head++], x = pixel % width, y = Math.floor(pixel / width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const next = ny * width + nx;
        if (!visited[next] && rgba[next * 4 + 3] > options.alphaThreshold) {
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    if (tail < options.noiseThreshold) { ignoredComponents++; ignoredPixels += tail; continue; }
    const component: Component = { pixels: tail, left: width, top: height, right: -1, bottom: -1 };
    for (let i = 0; i < tail; i++) {
      const pixel = queue[i], x = pixel % width, y = Math.floor(pixel / width);
      owner[pixel] = components.length;
      if (x < component.left) component.left = x;
      if (x > component.right) component.right = x;
      if (y < component.top) component.top = y;
      if (y > component.bottom) component.bottom = y;
    }
    components.push(component);
  }
  return { components, owner, ignoredComponents, ignoredPixels };
}

/** The components present inside one cell, measured only by the part of each
 * that falls inside it. A shape straddling a cut therefore contributes to both
 * cells instead of being awarded to one of them. */
function cellComponents(owner: Int32Array, width: number,
  left: number, top: number, right: number, bottom: number): Component[] {
  const parts = new Map<number, Component>();
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    const index = owner[y * width + x];
    if (index < 0) continue;
    const part = parts.get(index);
    if (!part) { parts.set(index, { pixels: 1, left: x, top: y, right: x, bottom: y }); continue; }
    part.pixels++;
    if (x < part.left) part.left = x;
    if (x > part.right) part.right = x;
    if (y > part.bottom) part.bottom = y;
  }
  return [...parts.values()];
}

function boxOf(members: Component[]): Box {
  const bounds = members.reduce((a, c) => ({
    pixels: 0,
    left: Math.min(a.left, c.left), top: Math.min(a.top, c.top),
    right: Math.max(a.right, c.right), bottom: Math.max(a.bottom, c.bottom),
  }));
  return { left: bounds.left, top: bounds.top, width: bounds.right - bounds.left + 1, height: bounds.bottom - bounds.top + 1 };
}

/**
 * Frame bounds for one group of components.
 *
 * A component sitting well below the dominant mass is a source artifact - a
 * faint smudge or a stray crumb - rather than artwork. Its only effect would be
 * to drag the frame's ground contact down, floating the whole drawing above the
 * baseline, so it is excluded from the bounds. Detached artwork *above* the body
 * (motion lines, hearts, speech effects) is always kept: it cannot affect ground
 * alignment.
 */
function resolve(members: Component[], detachmentGap: number) {
  const dominant = members.reduce((a, c) => (c.pixels > a.pixels ? c : a));
  const limit = dominant.bottom + Math.round((dominant.bottom - dominant.top + 1) * detachmentGap);
  const kept: Component[] = [], detached: Component[] = [];
  for (const component of members) (component.top > limit ? detached : kept).push(component);
  return { box: boxOf(kept), detached };
}

/**
 * Cell boundaries splitting [from, to] into `count` parts, returned as
 * `count + 1` positions where each cell is [bounds[i], bounds[i + 1] - 1].
 *
 * Each cut starts at its even position and slides within a tolerance window
 * onto the widest empty run it can reach, which is the real gap between two
 * hand-spaced frames. That keeps a detached prop with its own frame, and keeps
 * two characters drawn apart inside one frame together.
 *
 * When no gap exists the cut minimises `bridge` - the ink actually continuous
 * across it - rather than total ink. Two shapes that merely sit at the same
 * columns at different heights can then still be separated without either
 * being sliced through.
 */
function splitRange(occupancy: Int32Array, bridge: Int32Array, from: number, to: number, count: number, tolerance: number): number[] {
  const span = to - from + 1;
  if (count > span) throw new Error(`Cannot split ${span} pixels into ${count} cells`);
  const bounds = [from];
  const window = Math.max(1, Math.round((span / count) * tolerance));
  for (let i = 1; i < count; i++) {
    const ideal = from + Math.round((i * span) / count);
    const last = to + 1 - (count - i);
    let low = Math.max(bounds[i - 1] + 1, ideal - window);
    let high = Math.min(last, ideal + window);
    if (low > high) low = high = Math.min(Math.max(ideal, bounds[i - 1] + 1), last);
    let cut = -1, widest = 0;
    for (let x = low; x <= high; x++) {
      if (occupancy[x]) continue;
      let start = x; while (start > from && !occupancy[start - 1]) start--;
      let end = x; while (end < to && !occupancy[end + 1]) end++;
      if (end - start + 1 > widest) {
        widest = end - start + 1;
        cut = Math.min(Math.max(Math.round((start + end + 1) / 2), low), high);
      }
      x = end;
    }
    if (cut < 0) {
      let best: [number, number, number] | null = null;
      for (let x = low; x <= high; x++) {
        const score: [number, number, number] = [bridge[x], occupancy[x], Math.abs(x - ideal)];
        if (!best || score[0] < best[0] || (score[0] === best[0] && (score[1] < best[1] ||
          (score[1] === best[1] && score[2] < best[2])))) {
          best = score; cut = x;
        }
      }
    }
    bounds.push(cut);
  }
  bounds.push(to + 1);
  return bounds;
}

const nothing = (labelled: Labelled): Detection => ({
  boxes: [], detachedBoxes: [], detachedPixels: 0,
  ignoredComponents: labelled.ignoredComponents, ignoredPixels: labelled.ignoredPixels,
});

/** Automatic layout: separated horizontal regions become frames, left to right.
 * The frame count is discovered, never assumed. */
export function detectFrames(rgba: Uint8Array, width: number, height: number, options: DetectOptions): Detection {
  const labelled = label(rgba, width, height, options);
  if (!labelled.components.length) return nothing(labelled);
  const boxes: Box[] = [], detachedBoxes: Box[] = [];
  let detachedPixels = 0;
  const groups: Component[][] = [];
  let reach = -2;
  for (const component of [...labelled.components].sort((a, b) => a.left - b.left)) {
    if (component.left > reach + 1) groups.push([]);
    groups[groups.length - 1].push(component);
    reach = Math.max(reach, component.right);
  }
  for (const group of groups) {
    const resolved = resolve(group, options.detachmentGap);
    boxes.push(resolved.box);
    for (const component of resolved.detached) { detachedBoxes.push(boxOf([component])); detachedPixels += component.pixels; }
  }
  return { boxes, detachedBoxes, detachedPixels, ignoredComponents: labelled.ignoredComponents, ignoredPixels: labelled.ignoredPixels };
}

/** Grid layout: the declared columns x rows cells, in reading order. Cell
 * boundaries come from the sheet's own gaps, not from equal slicing. */
export function detectGrid(rgba: Uint8Array, width: number, height: number,
  columns: number, rows: number, options: DetectOptions): Detection {
  const labelled = label(rgba, width, height, options);
  if (!labelled.components.length) return nothing(labelled);
  const { owner } = labelled;
  const rowOccupancy = new Int32Array(height), rowBridge = new Int32Array(height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (owner[y * width + x] < 0) continue;
    rowOccupancy[y]++;
    if (y > 0 && owner[(y - 1) * width + x] >= 0) rowBridge[y]++;
  }
  const rowBounds = splitRange(rowOccupancy, rowBridge, 0, height - 1, rows, options.gridTolerance);
  const boxes: Box[] = [], detachedBoxes: Box[] = [], columnCuts: number[][] = [];
  let detachedPixels = 0;
  for (let row = 0; row < rows; row++) {
    const top = rowBounds[row], bottom = rowBounds[row + 1] - 1;
    // Columns are projected within this band only, so an overlapping pose in
    // another band cannot fill in this band's gaps.
    const columnOccupancy = new Int32Array(width), columnBridge = new Int32Array(width);
    for (let y = top; y <= bottom; y++) for (let x = 0; x < width; x++) {
      if (owner[y * width + x] < 0) continue;
      columnOccupancy[x]++;
      if (x > 0 && owner[y * width + x - 1] >= 0) columnBridge[x]++;
    }
    const columnBounds = splitRange(columnOccupancy, columnBridge, 0, width - 1, columns, options.gridTolerance);
    columnCuts.push(columnBounds.slice(1, -1));
    for (let column = 0; column < columns; column++) {
      const left = columnBounds[column], right = columnBounds[column + 1] - 1;
      const members = cellComponents(owner, width, left, top, right, bottom);
      if (!members.length) throw new Error(`Grid cell at row ${row + 1}, column ${column + 1} contains no artwork`);
      const resolved = resolve(members, options.detachmentGap);
      boxes.push(resolved.box);
      for (const component of resolved.detached) { detachedBoxes.push(boxOf([component])); detachedPixels += component.pixels; }
    }
  }
  return {
    boxes, detachedBoxes, detachedPixels,
    ignoredComponents: labelled.ignoredComponents, ignoredPixels: labelled.ignoredPixels,
    cuts: { rows: rowBounds.slice(1, -1), columns: columnCuts },
  };
}
