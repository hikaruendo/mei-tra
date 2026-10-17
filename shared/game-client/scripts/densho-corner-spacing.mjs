// Measure the actual rendered rank glyphs: the source SVGs place each rank at
// different baselines, and changing fonts makes the Q descender especially tall.
const WIDTH = 630;
const HEIGHT = 945;
export const CORNER_GAP = 15;

async function inkBounds(svg, sharp, left, top, right, bottom) {
  const { data, info } = await sharp(Buffer.from(svg), { density: 216 })
    .resize(WIDTH, HEIGHT, { fit: 'fill' })
    .flatten({ background: '#ffffff' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let first = bottom;
  let last = top - 1;
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const at = (y * WIDTH + x) * info.channels;
      if (Math.min(data[at], data[at + 1], data[at + 2]) < 180) {
        first = Math.min(first, y);
        last = Math.max(last, y);
      }
    }
  }
  if (last < first) throw new Error('Missing corner ink in Densho SVG');
  return { first, last };
}

export async function measureCornerGaps(svg, sharp) {
  const ranks = svg.replace(/<path\b[\s\S]*?\/>/g, '');
  const suits = svg.replace(/<text\b[\s\S]*?<\/text>/g, '')
    .replace(/<path\b[\s\S]*?\/>/g, path => path.includes('scale(0.9 0.84)') ? path : '');
  const [topRank, bottomRank, topSuit, bottomSuit] = await Promise.all([
    inkBounds(ranks, sharp, 0, 0, 160, 315),
    inkBounds(ranks, sharp, 470, 630, WIDTH, HEIGHT),
    inkBounds(suits, sharp, 0, 0, 160, 315),
    inkBounds(suits, sharp, 470, 630, WIDTH, HEIGHT),
  ]);
  return {
    top: topSuit.first - topRank.last - 1,
    bottom: bottomRank.first - bottomSuit.last - 1,
  };
}

export async function normalizeCornerSpacing(svg, sharp) {
  const texts = [...svg.matchAll(/<text\b[\s\S]*?<\/text>/g)];
  if (texts.length !== 2) throw new Error(`Expected two Densho ranks, found ${texts.length}`);
  const gaps = await measureCornerGaps(svg, sharp);
  const offsets = [gaps.top - CORNER_GAP, CORNER_GAP - gaps.bottom];
  let index = 0;
  return svg.replace(/<text\b[\s\S]*?<\/text>/g, text => {
    const offset = offsets[index++] / 3; // 630px render / 210 SVG units
    return text.replace(/<text\b([^>]*)>/, (_, attributes) => {
      const transform = attributes.match(/\btransform="([^"]+)"/);
      const translation = `translate(0 ${offset.toFixed(4)})`;
      const updated = transform
        ? attributes.replace(transform[0], `transform="${translation} ${transform[1]}"`)
        : `${attributes} transform="${translation}"`;
      return `<text${updated}>`;
    });
  });
}
