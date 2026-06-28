/**
 * Remove checkerboard / solid backgrounds from FAPEX logo PNGs.
 * Run: node scripts/process-logo-assets.mjs
 */
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

const WORDMARK_SOURCE = process.env.WORDMARK_SOURCE ?? path.join(publicDir, 'fapex-wordmark.png');
const ICON_SOURCE = process.env.ICON_SOURCE ?? path.join(publicDir, 'fapex-icon.png');

function isGrayCheckerboard(r, g, b) {
  if (Math.abs(r - g) > 12 || Math.abs(g - b) > 12) return false;
  return (r >= 108 && r <= 148) || (r >= 168 && r <= 212);
}

function isLogoWall(r, g, b) {
  if (Math.abs(r - g) > 22 || Math.abs(g - b) > 22) return true;
  if (b > r + 12 && r < 130) return true;
  return r < 95 && g < 95 && b < 95;
}

function isSolidDarkPixel(r, g, b) {
  return r <= 24 && g <= 24 && b <= 24;
}

function idx(width, x, y) {
  return (y * width + x) * 4;
}

function floodFill(rgba, width, height, seedFn, canTraverse) {
  const visited = new Uint8Array(width * height);
  const queue = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (seedFn(x, y)) queue.push(x, y);
    }
  }

  while (queue.length) {
    const y = queue.pop();
    const x = queue.pop();
    const p = y * width + x;
    if (visited[p]) continue;
    visited[p] = 1;

    const o = idx(width, x, y);
    rgba[o + 3] = 0;

    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const np = ny * width + nx;
      if (visited[np]) continue;
      const no = idx(width, nx, ny);
      if (canTraverse(rgba[no], rgba[no + 1], rgba[no + 2], nx, ny, rgba, width, height)) {
        queue.push(nx, ny);
      }
    }
  }
}

function hasNavyNeighbor(x, y, rgba, width, height) {
  for (const [nx, ny] of [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ]) {
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
    const no = idx(width, nx, ny);
    if (isLogoWall(rgba[no], rgba[no + 1], rgba[no + 2])) return true;
  }
  return false;
}

function processWordmark(rgba, width, height) {
  const onBorder = (x, y) => x === 0 || y === 0 || x === width - 1 || y === height - 1;

  floodFill(
    rgba,
    width,
    height,
    onBorder,
    (r, g, b, x, y) => {
      if (isLogoWall(r, g, b)) return false;
      if (isGrayCheckerboard(r, g, b)) return true;
      if (r >= 232 && g >= 232 && b >= 232) return !hasNavyNeighbor(x, y, rgba, width, height);
      return false;
    },
  );

  floodFill(
    rgba,
    width,
    height,
    (x, y) => {
      const o = idx(width, x, y);
      if (rgba[o + 3] === 0) return false;
      return isGrayCheckerboard(rgba[o], rgba[o + 1], rgba[o + 2]);
    },
    (r, g, b) => {
      if (isLogoWall(r, g, b)) return false;
      if (isGrayCheckerboard(r, g, b)) return true;
      return r >= 220 && g >= 220 && b >= 220;
    },
  );
}

function processIcon(rgba, width, height) {
  floodFill(
    rgba,
    width,
    height,
    (x, y) => x === 0 || y === 0 || x === width - 1 || y === height - 1,
    (r, g, b) => isSolidDarkPixel(r, g, b),
  );
}

async function processImage(inputPath, outputPath, postProcess) {
  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  postProcess(rgba, info.width, info.height);

  await sharp(Buffer.from(rgba), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toFile(outputPath);

  console.log(`Wrote ${outputPath} (${info.width}x${info.height})`);
}

await processImage(
  WORDMARK_SOURCE,
  path.join(publicDir, 'fapex-wordmark.png'),
  processWordmark,
);
await processImage(path.join(publicDir, 'fapex-icon.png'), path.join(publicDir, 'fapex-icon.png'), processIcon);
