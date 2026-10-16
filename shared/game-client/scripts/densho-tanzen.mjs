// Gently thicken the lettering in the derived Joker render. Keep the supplied
// scan untouched and leave the figure, suit symbols, and paper unchanged.
const WIDTH = 630;
const HEIGHT = 945;
const LABELS = [
  { left: 28, top: 56, right: 105, bottom: 292 },
  { left: 508, top: 646, right: 590, bottom: 885 },
];

const offset = (x, y) => (y * WIDTH + x) * 3;
const isLetterInk = (pixels, at) => {
  const red = pixels[at];
  const green = pixels[at + 1];
  const blue = pixels[at + 2];
  return Math.max(red, green, blue) < 125
    || (red > 90 && green < 120 && blue < 120);
};

export function thickenTanzenLettering(pixels, width, height) {
  if (width !== WIDTH || height !== HEIGHT || pixels.length !== WIDTH * HEIGHT * 3) {
    throw new Error('Tanzen render must be 630 × 945 RGB');
  }
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
