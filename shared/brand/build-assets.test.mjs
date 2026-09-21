import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
let sharp;
for (const client of ['mei-tra-frontend', 'mei-tra-mobile']) {
  try { sharp = createRequire(new URL(`${client}/package.json`, root))('sharp'); break; } catch { /* Try the other installed client. */ }
}
const decode = async (path) => sharp(await readFile(new URL(path, root))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

test('cutout preserves original RGB and excludes surrounding lettering', async () => {
  const source = await decode('shared/game-client/assets/densho/A_S.jpg');
  const mark = await decode('shared/brand/meitra-spade.png');
  let kept = 0;
  for (let y = 0; y < mark.info.height; y++) {
    for (let x = 0; x < mark.info.width; x++) {
      const i = (y * mark.info.width + x) * 4;
      if (mark.data[i + 3] === 0) continue;
      const src = ((y + 524) * source.info.width + x + 348) * 4;
      assert.deepEqual(mark.data.subarray(i, i + 3), source.data.subarray(src, src + 3));
      assert.ok(x > 0 && y > 0 && x < mark.info.width - 1 && y < mark.info.height - 1, 'No silhouette touches the crop edge');
      kept++;
    }
  }
  assert.ok(kept > 100_000, 'The entire motif is present');
  const alphaAt = (x, y) => mark.data[((y - 524) * mark.info.width + x - 348) * 4 + 3];
  assert.equal(alphaAt(510, 570), 0, 'Upper grey lettering is removed');
  assert.equal(alphaAt(775, 982), 0, 'Lower grey lettering is removed');
  assert.equal(alphaAt(575, 550), 255, 'Spade tip is retained');
  assert.equal(alphaAt(370, 690), 255, 'Left wing is retained');
  assert.equal(alphaAt(780, 686), 255, 'Right wing is retained');
});

test('adaptive icon stays inside the central safe circle', async () => {
  const { data, info } = await decode('mei-tra-mobile/assets/images/meitra-adaptive-foreground.png');
  const radius = info.width * 33 / 108;
  let ink = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (!data[(y * info.width + x) * 4 + 3]) continue;
    assert.ok(Math.hypot(x + 0.5 - info.width / 2, y + 0.5 - info.height / 2) <= radius);
    ink++;
  }
  assert.ok(ink > 100_000);
});

test('Web and mobile headers use identical pixels on white', async () => {
  const mobile = await readFile(new URL('mei-tra-mobile/assets/images/meitra-brand.png', root));
  const web = await readFile(new URL('mei-tra-frontend/public/brand/meitra-spade.png', root));
  assert.deepEqual(mobile, web);
  const icon = await decode('mei-tra-mobile/assets/images/meitra-icon.png');
  assert.equal(icon.info.width, 1024);
  assert.equal(icon.info.height, 1024);
  assert.deepEqual([...icon.data.subarray(0, 4)], [255, 255, 255, 255]);
  for (let i = 3; i < icon.data.length; i += 4) assert.equal(icon.data[i], 255);
});

test('favicon contains valid 16, 32 and 48 px images', async () => {
  const ico = await readFile(new URL('mei-tra-frontend/app/favicon.ico', root));
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3);
  for (const [i, size] of [16, 32, 48].entries()) {
    const entry = 6 + i * 16;
    const offset = ico.readUInt32LE(entry + 12);
    const length = ico.readUInt32LE(entry + 8);
    const image = await sharp(ico.subarray(offset, offset + length)).metadata();
    assert.equal(image.width, size);
    assert.equal(image.height, size);
  }
});
