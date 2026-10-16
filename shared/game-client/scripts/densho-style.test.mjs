import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { styleDenshoSvg } from './densho-style.mjs';
import { broadenAceSpadePixels } from './densho-ace-spade.mjs';
import { enlargeAnzenLettering, thickenTanzenLettering } from './densho-tanzen.mjs';

const cards = new URL('../../../mei-tra-frontend/public/cards/', import.meta.url);
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
  const result = broadenAceSpadePixels(pixels, width, height);
  const colour = (buffer, x, y) => [...buffer.subarray((y * width + x) * 3, (y * width + x) * 3 + 3)];
  assert.deepEqual(colour(result, 299, 300), [190, 151, 62]);
  assert.deepEqual(colour(result, 321, 300), [172, 175, 176]);
  assert.ok(colour(result, 320, 300).every(channel => channel < 50));
  assert.deepEqual(colour(result, 400, 300), [255, 255, 255]);
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
