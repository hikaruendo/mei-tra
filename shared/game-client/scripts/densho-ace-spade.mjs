// Work only on the derived 630px render. The supplied scan remains untouched.
// The central spade is widened at its edges. The corner spades are enlarged
// from their original silhouettes to match the width of the SVG corner suits.
const WIDTH = 630;
const HEIGHT = 945;
const CENTRE = { left: 130, top: 265, right: 500, bottom: 680, radius: 8, minRun: 8 };
const CORNERS = [
  { left: 27, top: 168, right: 101, bottom: 253, scaleX: 1.72, scaleY: 1.2 },
  { left: 530, top: 688, right: 600, bottom: 774, scaleX: 1.72, scaleY: 1.2, besideCaption: true },
];

const indexOf = (x, y) => (y * WIDTH + x) * 3;
const isSpadeInk = (pixels, index) => Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) < 80;
const isCoolCalligraphy = (red, green, blue) => Math.min(red, green, blue) > 140
  && Math.max(red, green, blue) < 215 && blue >= red + 2;
const isNeutralPaper = (pixels, index) => {
  const red = pixels[index];
  const green = pixels[index + 1];
  const blue = pixels[index + 2];
  // The scanned spade edge and calligraphy share a cool grey tint. Inside the
  // widened silhouette, the black spade must cover both as foreground ink;
  // otherwise remnants of the old edge form a dotted second outline.
  return Math.min(red, green, blue) > 80
    && Math.max(red, green, blue) - Math.min(red, green, blue) < 16;
};

function centralExteriorPaper(pixels) {
  const { left, top, right, bottom } = CENTRE;
  const protectedArt = new Uint8Array(WIDTH * HEIGHT);
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const at = indexOf(x, y);
      // Preserve the whole gold illustration, including the antialiased
      // black/grey line edges beside its coloured pixels.
      if (pixels[at] <= pixels[at + 1] + 15 || pixels[at + 1] <= pixels[at + 2] + 15) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) protectedArt[(y + dy) * WIDTH + x + dx] = 1;
      }
    }
  }
  const exterior = new Uint8Array(WIDTH * HEIGHT);
  const queue = new Int32Array((right - left) * (bottom - top));
  let head = 0;
  let tail = 0;
  const visit = (x, y) => {
    if (x < left || x >= right || y < top || y >= bottom) return;
    const pixel = y * WIDTH + x;
    if (exterior[pixel] || protectedArt[pixel] || !isNeutralPaper(pixels, pixel * 3)) return;
    exterior[pixel] = 1;
    queue[tail++] = pixel;
  };
  for (let x = left; x < right; x++) { visit(x, top); visit(x, bottom - 1); }
  for (let y = top; y < bottom; y++) { visit(left, y); visit(right - 1, y); }
  while (head < tail) {
    const pixel = queue[head++];
    const x = pixel % WIDTH;
    const y = Math.floor(pixel / WIDTH);
    visit(x - 1, y); visit(x + 1, y); visit(x, y - 1); visit(x, y + 1);
  }
  return exterior;
}

function cornerInkCoverage(pixels, x, y, corner) {
  if (x < corner.left || x >= corner.right || y < corner.top || y >= corner.bottom) return 0;
  const at = indexOf(x, y);
  const red = pixels[at];
  const green = pixels[at + 1];
  const blue = pixels[at + 2];
  if (isCoolCalligraphy(red, green, blue)) return 0;
  return Math.max(0, Math.min(1, (150 - Math.max(red, green, blue)) / 80));
}

function keepCaptionLegible(pixels, result) {
  // The final “y” in the caption ends just inside the enlarged lower spade.
  // Bring those original ink pixels forward with a three-pixel paper outline.
  // This keeps both the scanned lettering and the spade silhouette intact.
  const ink = [];
  for (let y = 725; y <= 746; y++) {
    for (let x = 510; x <= 526; x++) {
      if (isSpadeInk(pixels, indexOf(x, y))) ink.push([x, y]);
    }
  }
  for (const [x, y] of ink) {
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (dx * dx + dy * dy > 9) continue;
        const at = indexOf(x + dx, y + dy);
        result[at] = 255;
        result[at + 1] = 255;
        result[at + 2] = 255;
      }
    }
  }
  for (let y = 723; y <= 748; y++) {
    for (let x = 508; x <= 528; x++) {
      const at = indexOf(x, y);
      if (Math.max(pixels[at], pixels[at + 1], pixels[at + 2]) >= 235) continue;
      if (isCoolCalligraphy(pixels[at], pixels[at + 1], pixels[at + 2])) continue;
      result.set(pixels.subarray(at, at + 3), at);
    }
  }
}

function enlargeCornerSpades(pixels, result) {
  for (const corner of CORNERS) {
    const cx = (corner.left + corner.right) / 2;
    const cy = (corner.top + corner.bottom) / 2;
    const padX = Math.ceil((corner.right - corner.left) * (corner.scaleX - 1) / 2);
    const padY = Math.ceil((corner.bottom - corner.top) * (corner.scaleY - 1) / 2);
    for (let y = corner.top - padY; y < corner.bottom + padY; y++) {
      for (let x = corner.left - padX; x < corner.right + padX; x++) {
        const sourceX = cx + (x - cx) / corner.scaleX;
        const sourceY = cy + (y - cy) / corner.scaleY;
        const x0 = Math.floor(sourceX);
        const y0 = Math.floor(sourceY);
        const dx = sourceX - x0;
        const dy = sourceY - y0;
        const top = cornerInkCoverage(pixels, x0, y0, corner) * (1 - dx)
          + cornerInkCoverage(pixels, x0 + 1, y0, corner) * dx;
        const bottom = cornerInkCoverage(pixels, x0, y0 + 1, corner) * (1 - dx)
          + cornerInkCoverage(pixels, x0 + 1, y0 + 1, corner) * dx;
        const opacity = top * (1 - dy) + bottom * dy;
        if (opacity === 0) continue;
        const target = indexOf(x, y);
        for (let channel = 0; channel < 3; channel++) {
          result[target + channel] = Math.round(result[target + channel] * (1 - opacity) + 30 * opacity);
        }
      }
    }
  }
  keepCaptionLegible(pixels, result);
}

export function broadenAceSpadePixels(pixels, width, height) {
  if (width !== WIDTH || height !== HEIGHT || pixels.length !== WIDTH * HEIGHT * 3) {
    throw new Error('Ace of spades render must be 630 × 945 RGB');
  }
  const result = Buffer.from(pixels);
  const coverage = new Uint8Array(WIDTH * HEIGHT);
  const exterior = centralExteriorPaper(pixels);
  const { left, top, right, bottom, radius, minRun } = CENTRE;
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right;) {
      if (!isSpadeInk(pixels, indexOf(x, y))) {
        x++;
        continue;
      }
      const start = x;
      while (x < right && isSpadeInk(pixels, indexOf(x, y))) x++;
      const runLength = x - start;
      // The pointed tip starts as a one-pixel run. Applying the full width
      // only once it reaches minRun leaves a stepped, double-looking apex.
      const atTip = y < 285 && Math.abs((start + x - 1) / 2 - 313) < 35;
      if (runLength < minRun && !atTip) continue;
      const edgeRadius = atTip ? Math.min(radius, Math.floor(runLength / 2)) : radius;
      for (const [edge, direction] of [[start, -1], [x - 1, 1]]) {
        // Pool over adjacent scanlines so small gaps in the scanned ink do
        // not become horizontal stripes in the widened silhouette.
        for (let targetY = Math.max(top, y - 1); targetY <= Math.min(bottom - 1, y + 1); targetY++) {
          for (let distance = 1; distance <= edgeRadius; distance++) {
            const targetX = edge + direction * distance;
            if (targetX < left || targetX >= right) break;
            const target = indexOf(targetX, targetY);
            // Only grow into exterior paper. Grey antialiasing on lines
            // inside the gold illustration must retain its original pixels.
            if (!exterior[target / 3]) continue;
            const opacity = distance === edgeRadius ? 85 : distance === edgeRadius - 1 ? 170 : 255;
            const pixel = target / 3;
            coverage[pixel] = Math.max(coverage[pixel], opacity);
          }
        }
      }
    }
  }
  for (let pixel = 0; pixel < coverage.length; pixel++) {
    if (!coverage[pixel]) continue;
    const opacity = coverage[pixel] / 255;
    for (let channel = 0; channel < 3; channel++) {
      result[pixel * 3 + channel] = Math.round(pixels[pixel * 3 + channel] * (1 - opacity) + 12 * opacity);
    }
  }
  enlargeCornerSpades(pixels, result);
  return result;
}
