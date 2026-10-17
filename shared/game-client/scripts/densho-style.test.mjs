import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { styleDenshoSvg } from './densho-style.mjs';
import { CORNER_GAP, measureCornerGaps, normalizeCornerSpacing } from './densho-corner-spacing.mjs';
import { broadenAceSpadePixels } from './densho-ace-spade.mjs';
import { enlargeAnzenLettering, thickenTanzenLettering } from './densho-tanzen.mjs';

const cards = new URL('../../../mei-tra-frontend/public/cards/', import.meta.url);
const require = createRequire(new URL('../../../mei-tra-frontend/package.json', import.meta.url));
const sharp = require('sharp');
const suitPath = path => {
  const data = path.match(/\bd="([^"]+)"/)?.[1];
  return data && data.length < 2000 && path.includes('stroke:#000000');
};

test('every SVG face retains its pips and enlarges exactly two corner suits', async () => {
  const faces = (await readdir(cards)).filter(file => /^(?:[2-9]|10|J|Q|K|A)_[SHDC]\.svg$/.test(file));
  assert.equal(faces.length, 52);
  for (const file of faces) {
    const original = await readFile(new URL(file, cards), 'utf8');
    const styled = styleDenshoSvg(original);
    const sourcePips = [...original.matchAll(/<path\b[\s\S]*?\/>/g)].map(match => match[0]).filter(suitPath);
    const styledPips = [...styled.matchAll(/<path\b[\s\S]*?\/>/g)].map(match => match[0])
      .filter(path => /scale\((?:0\.82 0\.72|0\.9 0\.84)\)/.test(path));
    assert.equal(styledPips.length, sourcePips.length, file);
    assert.equal(styledPips.filter(path => path.includes('scale(0.9 0.84)')).length, 2, file);
    assert.equal(styledPips.filter(path => path.includes('scale(0.82 0.72)')).length, sourcePips.length - 2, file);
  }
});

test('court illustration pips remain present while only rank-adjacent pips get corner size', async () => {
  const styled = styleDenshoSvg(await readFile(new URL('K_H.svg', cards), 'utf8'));
  const suits = [...styled.matchAll(/<path\b[\s\S]*?\/>/g)].map(match => match[0])
    .filter(path => /scale\((?:0\.82 0\.72|0\.9 0\.84)\)/.test(path));
  const ids = scale => suits.filter(path => path.includes(`scale(${scale})`))
    .map(path => path.match(/\bid="([^"]+)"/)?.[1]);
  assert.deepEqual(ids('0.9 0.84'), ['use17040', 'use17042']);
  assert.deepEqual(ids('0.82 0.72'), ['path11850', 'path11870']);
});

test('all SVG cards keep an even visible gap between both ranks and corner suits', async () => {
  const faces = (await readdir(cards)).filter(file => /^(?:[2-9]|10|J|Q|K|A)_[SHDC]\.svg$/.test(file));
  assert.equal(faces.length, 52);
  for (const file of faces) {
    const source = await readFile(new URL(file, cards), 'utf8');
    const styled = await normalizeCornerSpacing(styleDenshoSvg(source), sharp);
    const gaps = await measureCornerGaps(styled, sharp);
    assert.ok(Math.abs(gaps.top - CORNER_GAP) <= 1, `${file}: top gap ${gaps.top}`);
    assert.ok(Math.abs(gaps.bottom - CORNER_GAP) <= 1, `${file}: bottom gap ${gaps.bottom}`);
  }
});

test('ace of spades adjustment widens black ink without touching illustration colours', () => {
  const width = 630;
  const height = 945;
  const pixels = Buffer.alloc(width * height * 3, 255);
  const paint = (x, y, colour) => {
    const at = (y * width + x) * 3;
    pixels.set(colour, at);
  };
  for (let x = 300; x < 320; x++) paint(x, 300, [30, 28, 29]);
  paint(299, 300, [190, 151, 62]);
  paint(321, 300, [172, 175, 176]);
  paint(330, 300, [172, 175, 176]);
  const result = broadenAceSpadePixels(pixels, width, height);
  const colour = (buffer, x, y) => [...buffer.subarray((y * width + x) * 3, (y * width + x) * 3 + 3)];
  assert.deepEqual(colour(result, 299, 300), [190, 151, 62]);
  assert.ok(colour(result, 321, 300).every(channel => channel < 80), 'the widened spade covers grey ink beneath its new edge');
  assert.deepEqual(colour(result, 330, 300), [172, 175, 176], 'lettering outside the new silhouette is unchanged');
  assert.ok(colour(result, 320, 300).every(channel => channel < 50));
  assert.deepEqual(colour(result, 400, 300), [255, 255, 255]);
});

test('ace illustration retains original pixels and direct-sampled detail at every size', async () => {
  const originals = new URL('../assets/densho/', import.meta.url);
  const config = JSON.parse(await readFile(new URL('../densho-rendering.json', import.meta.url), 'utf8'));
  for (const [size, width] of Object.entries(config.widths)) {
    let control = sharp(new URL('A_S.jpg', originals).pathname)
      .extract(config.originals.A_S)
      .resize(width, width * 1.5, { fit: 'fill', kernel: 'lanczos3' })
      .flatten({ background: '#ffffff' });
    if (size !== 'large') control = control.sharpen({ sigma: 0.4, m1: 0.5, m2: 1, x1: 2, y2: 5, y3: 5 });
    const expected = await control.removeAlpha().raw().toBuffer();
    const file = `styled/${size === 'large' ? '' : `${size}/`}A_S.webp`;
    const actual = await sharp(new URL(file, originals).pathname).removeAlpha().raw().toBuffer();
    // Includes fine black/grey outlines, not just saturated gold pixels.
    for (let y = Math.ceil(370 * width / 630); y < Math.floor(580 * width / 630); y++) {
      const left = (y * width + Math.ceil(245 * width / 630)) * 3;
      const right = (y * width + Math.floor(385 * width / 630)) * 3;
      let maxDifference = 0;
      for (let at = left; at < right; at++) maxDifference = Math.max(maxDifference, Math.abs(actual[at] - expected[at]));
      // Thumbnail filtering can round one channel value beside the edit mask.
      assert.ok(maxDifference <= (size === 'large' ? 0 : 1), `${size}: illustration row ${y}, difference ${maxDifference}`);
    }
  }
});

test('central spade absorbs the scanned grey edge without a dotted outline', () => {
  const pixels = Buffer.alloc(630 * 945 * 3, 255);
  const paint = (x, y, colour) => pixels.set(colour, (y * 630 + x) * 3);
  for (let x = 450; x <= 475; x++) paint(x, 450, [12, 12, 12]);
  paint(476, 450, [156, 160, 159]); // Cool-tinted antialiasing, not calligraphy.
  const result = broadenAceSpadePixels(pixels, 630, 945);
  const red = (x, y) => result[(y * 630 + x) * 3];
  assert.equal(red(476, 450), 12);
  assert.ok(red(480, 450) < 80);
});

test('central spade tip widens gradually instead of starting with a stepped rim', () => {
  const pixels = Buffer.alloc(630 * 945 * 3, 255);
  const paint = (x, y) => pixels.set([12, 12, 12], (y * 630 + x) * 3);
  for (let x = 311; x <= 316; x++) paint(x, 274);
  for (let x = 310; x <= 317; x++) paint(x, 275);
  const result = broadenAceSpadePixels(pixels, 630, 945);
  const dark = (x, y) => result[(y * 630 + x) * 3] < 100;
  assert.ok(dark(308, 274), 'the narrow tip receives a small expansion');
  assert.ok(!dark(303, 274), 'the full-width rim does not begin abruptly at the tip');
  assert.ok(dark(307, 275), 'the rim grows with the original silhouette');
});

test('ace corner spades grow vertically and horizontally from their original shapes', () => {
  const width = 630;
  const height = 945;
  const pixels = Buffer.alloc(width * height * 3, 255);
  const paint = (x, y) => pixels.set([30, 28, 29], (y * width + x) * 3);
  for (let y = 190; y < 200; y++) for (let x = 45; x < 55; x++) paint(x, y);
  for (let y = 710; y < 720; y++) for (let x = 550; x < 560; x++) paint(x, y);
  const result = broadenAceSpadePixels(pixels, width, height);
  const isDark = (x, y) => result[(y * width + x) * 3] < 80;
  assert.ok(isDark(42, 187), 'top-left corner expands both left and up');
  assert.ok(isDark(548, 707), 'bottom-right corner expands both left and up');
  assert.ok(!isDark(200, 200), 'unrelated artwork is unchanged');
});

test('lower ace corner keeps paper around the adjacent caption', () => {
  const pixels = Buffer.alloc(630 * 945 * 3, 255);
  const paint = (x, y) => pixels.set([30, 28, 29], (y * 630 + x) * 3);
  for (let y = 720; y < 741; y++) for (let x = 540; x < 551; x++) paint(x, y);
  paint(520, 730); // Final letter of the caption, separate in the scan.
  const result = broadenAceSpadePixels(pixels, 630, 945);
  const red = (x, y) => result[(y * 630 + x) * 3];
  assert.equal(red(520, 730), 30);
  assert.equal(red(523, 730), 255, 'paper gap beside the caption is retained');
  assert.ok(red(540, 730) < 80, 'the corner suit remains visible beside the caption');
});

test('rendered ace caption ends in readable ink separated from the lower spade', async () => {
  const styled = new URL('../assets/densho/styled/A_S.webp', import.meta.url);
  const { data, info } = await sharp(styled.pathname).raw().toBuffer({ resolveWithObject: true });
  const red = (x, y) => data[(y * info.width + x) * info.channels];
  assert.ok(red(523, 726) < 80, 'the final letter remains dark');
  assert.ok(red(527, 726) > 230, 'paper separates the letter from the spade');
  assert.ok(red(528, 726) < 80, 'the spade keeps its full width beyond the letter');
});

test('ace corner spades match the width of standard spade corners', async () => {
  const styled = new URL('../assets/densho/styled/', import.meta.url);
  const widths = async (id, y, left, right) => {
    const { data, info } = await sharp(new URL(`${id}.webp`, styled).pathname)
      .raw().toBuffer({ resolveWithObject: true });
    const xs = [];
    for (let x = left; x < right; x++) {
      const at = (y * info.width + x) * info.channels;
      if (Math.max(data[at], data[at + 1], data[at + 2]) < 80) xs.push(x);
    }
    return xs.at(-1) - xs[0] + 1;
  };
  for (const [y, left, right] of [[225, 0, 140], [715, 500, 625]]) {
    assert.ok(Math.abs(await widths('A_S', y, left, right) - await widths('2_S', y, left, right)) <= 3);
  }
});

test('Tanzen lettering gains a subtle edge without changing other artwork or the source', () => {
  const pixels = Buffer.alloc(630 * 945 * 3, 255);
  const paint = (x, y, colour) => pixels.set(colour, (y * 630 + x) * 3);
  paint(60, 180, [20, 20, 20]);
  paint(550, 700, [190, 20, 25]);
  paint(180, 180, [20, 20, 20]);
  const result = thickenTanzenLettering(pixels, 630, 945);
  const colour = (buffer, x, y) => [...buffer.subarray((y * 630 + x) * 3, (y * 630 + x) * 3 + 3)];
  assert.ok(colour(result, 61, 180)[0] < 255);
  assert.ok(colour(result, 551, 700)[1] < 255);
  assert.deepEqual(colour(result, 181, 180), [255, 255, 255]);
  assert.deepEqual(colour(pixels, 61, 180), [255, 255, 255]);
});

test('only the anzen letters enlarge, with the two T letters fixed', () => {
  const pixels = Buffer.alloc(630 * 945 * 3, 255);
  const paint = (x, y) => pixels.set([20, 20, 20], (y * 630 + x) * 3);
  paint(66, 275);
  paint(548, 665);
  paint(66, 110);
  paint(548, 835);
  const result = enlargeAnzenLettering(pixels, 630, 945);
  const dark = (buffer, x, y) => buffer[(y * 630 + x) * 3] < 220;
  assert.ok(dark(result, 66, 300), 'top label extends downwards');
  assert.ok(dark(result, 548, 640), 'bottom label extends upwards');
  assert.ok(dark(result, 66, 110), 'top T is unchanged');
  assert.ok(dark(result, 548, 835), 'bottom T is unchanged');
  assert.ok(!dark(result, 180, 180), 'illustration is unchanged');
  assert.ok(dark(pixels, 66, 275), 'source remains untouched');
});
