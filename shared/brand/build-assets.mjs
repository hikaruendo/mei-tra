#!/usr/bin/env node
// Cut original pixels out of the ace of spades; never redraw or recolour them.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const sourcePath = 'shared/game-client/assets/densho/A_S.jpg';
const manifestPath = resolve(root, 'shared/brand/manifest.json');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const source = await readFile(resolve(root, sourcePath));
const recipe = await readFile(fileURLToPath(import.meta.url));
const crop = { left: 348, top: 524, width: 456, height: 534 };
const outputs = [
  { path: 'shared/brand/meitra-spade.png', width: crop.width, height: crop.height, transparent: true },
  { path: 'mei-tra-mobile/assets/images/meitra-icon.png', width: 1024, height: 1024, ink: 800, transparent: false },
  // The whole drawing fits within the central 66/108 safe circle, including wing tips.
  { path: 'mei-tra-mobile/assets/images/meitra-adaptive-foreground.png', width: 1024, height: 1024, ink: 600, transparent: true },
  { path: 'mei-tra-mobile/assets/images/meitra-splash.png', width: 1024, height: 1024, ink: 800, transparent: true },
  { path: 'mei-tra-mobile/assets/images/meitra-brand.png', width: 192, height: 192, ink: 158, transparent: false },
  { path: 'mei-tra-frontend/public/brand/meitra-spade.png', width: 192, height: 192, ink: 158, transparent: false },
  { path: 'mei-tra-frontend/app/icon.png', width: 512, height: 512, ink: 400, transparent: false },
  { path: 'mei-tra-frontend/app/apple-icon.png', width: 180, height: 180, ink: 140, transparent: false },
];
const icoPath = 'mei-tra-frontend/app/favicon.ico';

if (process.argv.includes('--check')) {
  // Hash committed renders rather than relying on platform-specific PNG encoders.
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.source !== hash(source) || manifest.recipe !== hash(recipe)) {
    throw new Error('Brand source/recipe changed; run npm run assets:brand.');
  }
  const expected = [...outputs.map(({ path }) => path), icoPath].sort();
  if (JSON.stringify(Object.keys(manifest.outputs).sort()) !== JSON.stringify(expected)) {
    throw new Error('Brand asset manifest does not cover all outputs.');
  }
  for (const path of expected) {
    const bytes = await readFile(resolve(root, path));
    if (hash(bytes) !== manifest.outputs[path]) throw new Error(`Stale brand asset: ${path}`);
    const spec = outputs.find(output => output.path === path);
    if (spec && (bytes.readUInt32BE(16) !== spec.width || bytes.readUInt32BE(20) !== spec.height ||
      bytes[25] !== (spec.transparent ? 6 : 2))) {
      throw new Error(`Unexpected PNG size/alpha: ${path}`);
    }
  }
  const app = JSON.parse(await readFile(resolve(root, 'mei-tra-mobile/app.json'), 'utf8')).expo;
  const splash = app.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen')?.[1];
  if (app.icon !== './assets/images/meitra-icon.png' || app.ios.icon !== app.icon || app.web.favicon !== app.icon ||
    app.android.adaptiveIcon.foregroundImage !== './assets/images/meitra-adaptive-foreground.png' ||
    app.android.adaptiveIcon.backgroundColor !== '#ffffff' ||
    splash?.image !== './assets/images/meitra-splash.png' || splash?.backgroundColor !== '#ffffff') {
    throw new Error('App icon/splash config differs from the shared white brand assets.');
  }
  console.log(`${expected.length} brand assets and native icon/splash configuration verified.`);
} else {
  let sharp;
  for (const workspace of ['mei-tra-frontend', 'mei-tra-mobile']) {
    try { sharp = createRequire(resolve(root, workspace, 'package.json'))('sharp'); break; } catch { /* Try the other installed client. */ }
  }
  if (!sharp) throw new Error('Install Web or mobile dependencies to generate brand assets.');
  const { data } = await sharp(source).extract(crop).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(crop.width * crop.height * 4);
  for (let i = 0; i < crop.width * crop.height; i++) {
    const [r, g, b] = data.subarray(i * 3, i * 3 + 3);
    // The source has cool grey lettering behind the silhouette. Keep its dark
    // ink and warm gold; remove only white/cool background pixels in this crop.
    const foreground = Math.max(r, g, b) < 135 || (r - b > 25 && g - b > 12 && r > g);
    rgba.set([r, g, b, foreground ? 255 : 0], i * 4);
  }
  const master = await sharp(rgba, { raw: { width: crop.width, height: crop.height, channels: 4 } }).png().toBuffer();
  const square = async (size, ink, transparent) => {
    const mark = await sharp(master).resize({ width: ink, height: ink, fit: 'inside', kernel: 'lanczos3' }).toBuffer();
    let result = sharp({ create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: transparent ? 0 : 1 } } })
      .composite([{ input: mark, gravity: 'centre' }]);
    if (!transparent) result = result.removeAlpha();
    return result.png().toBuffer();
  };
  const manifest = { source: hash(source), recipe: hash(recipe), outputs: {} };
  const save = async (path, bytes) => {
    await mkdir(dirname(resolve(root, path)), { recursive: true });
    await writeFile(resolve(root, path), bytes);
    manifest.outputs[path] = hash(bytes);
  };
  for (const spec of outputs) {
    await save(spec.path, spec.ink ? await square(spec.width, spec.ink, spec.transparent) : master);
  }
  // ICO directory with lossless PNG entries, for 16/32/48 px browser tabs.
  const sizes = [16, 32, 48];
  const pngs = await Promise.all(sizes.map(size => square(size, Math.round(size * 0.88), false)));
  const directory = Buffer.alloc(6 + sizes.length * 16);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(sizes.length, 4);
  let offset = directory.length;
  pngs.forEach((png, i) => {
    const entry = 6 + i * 16;
    directory[entry] = sizes[i]; directory[entry + 1] = sizes[i];
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(png.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  await save(icoPath, Buffer.concat([directory, ...pngs]));
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`${outputs.length + 1} brand assets generated from the original ace.`);
}
