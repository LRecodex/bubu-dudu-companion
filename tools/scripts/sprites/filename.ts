export interface ParsedFilename {
  animation: string;
  frameCount: number;
  /** Grid layout when the filename declares one; null means automatic layout. */
  columns: number | null;
  rows: number | null;
}

/** `<animation>-<frames>-frame.png` detects frames automatically;
 * `<animation>-<columns>x<rows>-frame.png` slices a declared grid. */
export function parseFilename(filename: string): ParsedFilename {
  const match = /^([a-zA-Z0-9][a-zA-Z0-9_-]*?)-(?:([1-9]\d*)x([1-9]\d*)|([1-9]\d*))-frame\.png$/.exec(filename);
  if (!match) {
    throw new Error(`Invalid sprite filename: ${filename}; expected <animation>-<frameCount>-frame.png or <animation>-<columns>x<rows>-frame.png`);
  }
  const [, animation, gridColumns, gridRows, plainCount] = match;
  const columns = gridColumns ? Number(gridColumns) : null;
  const rows = gridRows ? Number(gridRows) : null;
  const frameCount = columns !== null && rows !== null ? columns * rows : Number(plainCount);
  if (!Number.isSafeInteger(frameCount)) throw new Error('Frame count exceeds safe integer range');
  return { animation, frameCount, columns, rows };
}

export function parseAsset(relativePath: string, characters: string[]) {
  const parts = relativePath.replaceAll('\\', '/').split('/');
  if (parts.length !== 2 || parts[0].toLowerCase() === 'reference' || !characters.includes(parts[0])) {
    throw new Error(`Asset must be directly inside a configured character directory: ${relativePath}`);
  }
  return { character: parts[0], ...parseFilename(parts[1]) };
}
