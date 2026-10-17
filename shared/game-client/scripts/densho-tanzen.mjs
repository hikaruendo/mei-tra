// Enlarge the thin lowercase letters and gently thicken the lettering in the
// derived Joker render. The supplied scan and its illustration stay untouched.
const WIDTH = 630;
const HEIGHT = 945;
const LOWERCASE_SCALE = 1.2;
const LOWERCASE = [
  { left: 48, top: 149, right: 85, bottom: 289, anchor: 'top' },
  { left: 528, top: 649, right: 569, bottom: 793, anchor: 'bottom' },
];
const LABELS = [
  { left: 28, top: 56, right: 105, bottom: 325 },
  { left: 508, top: 610, right: 590, bottom: 885 },
];

const offset = (x, y) => (y * WIDTH + x) * 3;
const validate = (pixels, width, height) => {
  if (width !== WIDTH || height !== HEIGHT || pixels.length !== WIDTH * HEIGHT * 3) {
    throw new Error('Tanzen render must be 630 × 945 RGB');
  }
};

export function enlargeAnzenLettering(pixels, width, height) {
  validate(pixels, width, height);
  const result = Buffer.from(pixels);
  for (const box of LOWERCASE) {
    const cx = (box.left + box.right) / 2;
    const halfWidth = (box.right - box.left) * LOWERCASE_SCALE / 2;
    const left = Math.floor(cx - halfWidth);
    const right = Math.ceil(cx + halfWidth);
    const extraHeight = Math.ceil((box.bottom - box.top) * (LOWERCASE_SCALE - 1));
    const top = box.anchor === 'top' ? box.top : box.top - extraHeight;
    const bottom = box.anchor === 'top' ? box.bottom + extraHeight : box.bottom;
    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        const sourceX = cx + (x - cx) / LOWERCASE_SCALE;
        const sourceY = box.anchor === 'top'
          ? box.top + (y - box.top) / LOWERCASE_SCALE
          : box.bottom - (box.bottom - y) / LOWERCASE_SCALE;
        const x0 = Math.max(box.left, Math.min(box.right - 1, Math.floor(sourceX)));
        const y0 = Math.max(box.top, Math.min(box.bottom - 1, Math.floor(sourceY)));
        const x1 = Math.min(box.right - 1, x0 + 1);
        const y1 = Math.min(box.bottom - 1, y0 + 1);
        const dx = Math.max(0, Math.min(1, sourceX - x0));
        const dy = Math.max(0, Math.min(1, sourceY - y0));
        const target = offset(x, y);
        for (let channel = 0; channel < 3; channel++) {
          const topPixel = pixels[offset(x0, y0) + channel] * (1 - dx)
            + pixels[offset(x1, y0) + channel] * dx;
          const bottomPixel = pixels[offset(x0, y1) + channel] * (1 - dx)
            + pixels[offset(x1, y1) + channel] * dx;
          result[target + channel] = Math.round(topPixel * (1 - dy) + bottomPixel * dy);
        }
      }
    }
  }
  return result;
}

const isLetterInk = (pixels, at) => {
  const red = pixels[at];
  const green = pixels[at + 1];
  const blue = pixels[at + 2];
  return Math.max(red, green, blue) < 125
    || (red > 90 && green < 120 && blue < 120);
};

export function thickenTanzenLettering(pixels, width, height) {
  validate(pixels, width, height);
  const result = Buffer.from(pixels);
  for (const { left, top, right, bottom } of LABELS) {
    for (let y = top + 1; y < bottom - 1; y++) {
      for (let x = left + 1; x < right - 1; x++) {
        const target = offset(x, y);
        if (Math.min(pixels[target], pixels[target + 1], pixels[target + 2]) < 190) continue;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const source = offset(x + dx, y + dy);
          if (!isLetterInk(pixels, source)) continue;
          for (let channel = 0; channel < 3; channel++) {
            result[target + channel] = Math.round(pixels[target + channel] * 0.55 + pixels[source + channel] * 0.45);
          }
          break;
        }
      }
    }
  }
  return result;
}
