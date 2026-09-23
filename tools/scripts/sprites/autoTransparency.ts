import sharp from 'sharp';

export interface TransparencyResult {
  image: Buffer;
  removedPixels: number;
}

const percentile = (values: number[], fraction: number) => {
  values.sort((a, b) => a - b);
  return values[Math.min(values.length - 1, Math.floor(values.length * fraction))];
};

/**
 * Removes an edge-connected background from an opaque sprite source.
 *
 * Transparency-preview checkerboards are treated specially: when the image
 * border is predominantly light and neutral, all similar light-neutral shades
 * are accepted as background. Other images use their sampled border colours.
 */
export async function addBackgroundTransparency(source: Buffer): Promise<TransparencyResult> {
  const { data, info } = await sharp(source).toColourspace('srgb').removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  if (width < 2 || height < 2) throw new Error('Source is too small to infer its background');

  const border: number[] = [];
  const add = (x: number, y: number) => {
    const i = (y * width + x) * 3;
    border.push(data[i], data[i + 1], data[i + 2]);
  };
  for (let x = 0; x < width; x++) { add(x, 0); add(x, height - 1); }
  for (let y = 1; y < height - 1; y++) { add(0, y); add(width - 1, y); }

  const luminances: number[] = [], chromas: number[] = [];
  let neutral = 0;
  for (let i = 0; i < border.length; i += 3) {
    const r = border[i], g = border[i + 1], b = border[i + 2];
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    luminances.push((r + g + b) / 3); chromas.push(chroma);
    if (chroma <= 24 && (r + g + b) / 3 >= 150) neutral++;
  }
  const neutralBackground = neutral >= border.length / 3 * 0.9;
  const minimumLightness = percentile(luminances, 0.01) - 18;
  // Allow for pale colour contamination at anti-aliased subject edges. The
  // lightness guard keeps dark neutral outlines and shadows intact.
  const maximumChroma = percentile(chromas, 0.99) + 40;

  // A compact palette sampled around the whole perimeter handles solid and
  // patterned backgrounds without assuming that the top-left pixel is enough.
  const palette: number[][] = [];
  const stride = Math.max(3, Math.floor(border.length / 3 / 2048));
  for (let i = 0; i < border.length; i += 3 * stride) palette.push([border[i], border[i + 1], border[i + 2]]);
  const isBackgroundColour = (pixel: number) => {
    const r = data[pixel * 3], g = data[pixel * 3 + 1], b = data[pixel * 3 + 2];
    if (neutralBackground) {
      return (r + g + b) / 3 >= minimumLightness && Math.max(r, g, b) - Math.min(r, g, b) <= maximumChroma;
    }
    for (const colour of palette) {
      const dr = r - colour[0], dg = g - colour[1], db = b - colour[2];
      if (dr * dr + dg * dg + db * db <= 28 * 28) return true;
    }
    return false;
  };

  const background = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0, tail = 0;
  const enqueue = (pixel: number) => {
    if (!background[pixel] && isBackgroundColour(pixel)) {
      background[pixel] = 1; queue[tail++] = pixel;
    }
  };
  for (let x = 0; x < width; x++) { enqueue(x); enqueue((height - 1) * width + x); }
  for (let y = 1; y < height - 1; y++) { enqueue(y * width); enqueue(y * width + width - 1); }
  while (head < tail) {
    const pixel = queue[head++], x = pixel % width, y = Math.floor(pixel / width);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if ((!dx && !dy) || x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) continue;
      enqueue((y + dy) * width + x + dx);
    }
  }
  if (tail < width * height * 0.01) throw new Error('Could not confidently infer an edge-connected background');

  const rgba = Buffer.alloc(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel++) {
    rgba[pixel * 4] = data[pixel * 3];
    rgba[pixel * 4 + 1] = data[pixel * 3 + 1];
    rgba[pixel * 4 + 2] = data[pixel * 3 + 2];
    rgba[pixel * 4 + 3] = background[pixel] ? 0 : 255;
  }
  return { image: await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer(), removedPixels: tail };
}
