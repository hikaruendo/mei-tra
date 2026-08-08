#!/usr/bin/env node
/**
 * Builds the mobile card art from the web app's SVG source of truth.
 *
 * The web assets total ~7.7 MB, but they are not uniformly heavy: pip cards are
 * ~60 path nodes / 6-16 KB each, while the twelve court cards are Inkscape
 * traces of ~9,000 nodes / 0.6-1.1 MB each. SVGO reduces the *file size* of a
 * court card but not its node count, and react-native-svg pays that node cost
 * on every render at a 30-60px display size. So the pipeline splits:
 *
 *   pips + aces + joker + back  ->  SVGO-compressed .svg   (true vector)
 *   J / Q / K  (12 cards)       ->  3x .webp raster        (bounded cost)
 *
 * Rasterising the courts also side-steps a font problem: the rank indices are
 * `<text font-family="Arial">` nodes. iOS ships Arial so the vector cards match
 * the web, and the rasterised courts bake the glyphs in at build time.
 *
 * Usage:
 *   node scripts/build-card-assets.mjs           # write assets
 *   node scripts/build-card-assets.mjs --check   # verify committed assets are current
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import { optimize } from 'svgo';

const HERE = dirname(fileURLToPath(import.meta.url));
const MOBILE = join(HERE, '..');
const SOURCE = join(MOBILE, '..', 'mei-tra-frontend', 'public', 'cards');
const DEST = join(MOBILE, 'assets', 'cards');

/** Court ranks are rasterised; everything else stays vector. */
const COURT_RANKS = new Set(['J', 'Q', 'K']);
/** cardToSvgId always resolves JOKER to joker_red, so the black one is dead. */
const EXCLUDED = new Set(['joker_black.svg']);

/** 3x the 210x315 viewBox — ample for a card that renders at most ~72pt wide. */
const RASTER_SCALE = 3;
const RASTER_QUALITY = 85;

const MAX_FILE_BYTES = 450 * 1024;
const MAX_TOTAL_BYTES = 3 * 1024 * 1024;

const svgoConfig = {
  multipass: true,
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          // react-native-svg needs the viewBox to scale the drawing.
          removeViewBox: false,
          // card_back.svg references url(#felt) / url(#glow) / url(#weave);
          // keep the names readable rather than minifying to a/b/c.
          cleanupIds: { remove: true, minify: false },
          convertPathData: { floatPrecision: 1, transformPrecision: 3 },
          cleanupNumericValues: { floatPrecision: 1 },
          // Court art is multi-colour; merging paths would flatten fills.
          mergePaths: false,
        },
      },
    },
    // Inkscape/sodipodi namespaced cruft is already handled by
    // preset-default's removeEditorsNSData.
    // Size comes from props, not the document.
    { name: 'removeDimensions' },
    { name: 'sortAttrs' },
  ],
};

const isCourt = (name) => COURT_RANKS.has(name.split('_')[0]);
const kb = (bytes) => `${(bytes / 1024).toFixed(1)}KB`;
const sha = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 12);

async function build() {
  const check = process.argv.includes('--check');
  const files = (await readdir(SOURCE))
    .filter((f) => f.endsWith('.svg') && !EXCLUDED.has(f))
    .sort();

  if (!check) await mkdir(DEST, { recursive: true });

  const results = [];
  let stale = 0;

  for (const file of files) {
    const id = file.replace(/\.svg$/, '');
    const source = await readFile(join(SOURCE, file));

    let outName;
    let output;

    if (isCourt(id)) {
      outName = `${id}.webp`;
      output = await sharp(source, {
        density: 72 * RASTER_SCALE,
      })
        .resize(210 * RASTER_SCALE, 315 * RASTER_SCALE, {
          fit: 'fill',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: RASTER_QUALITY })
        .toBuffer();
    } else {
      outName = `${id}.svg`;
      output = Buffer.from(
        optimize(source.toString('utf8'), { ...svgoConfig, path: file }).data,
        'utf8',
      );
    }

    if (output.length > MAX_FILE_BYTES) {
      throw new Error(
        `${outName} is ${kb(output.length)}, over the ${kb(MAX_FILE_BYTES)} budget`,
      );
    }

    const target = join(DEST, outName);
    if (check) {
      const existing = await readFile(target).catch(() => null);
      if (!existing || sha(existing) !== sha(output)) {
        console.error(`stale: ${outName}`);
        stale += 1;
      }
    } else {
      await writeFile(target, output);
    }

    results.push({ id, outName, source: source.length, out: output.length });
  }

  const totalIn = results.reduce((n, r) => n + r.source, 0);
  const totalOut = results.reduce((n, r) => n + r.out, 0);

  if (totalOut > MAX_TOTAL_BYTES) {
    throw new Error(
      `total ${kb(totalOut)} exceeds the ${kb(MAX_TOTAL_BYTES)} budget`,
    );
  }

  const vectors = results.filter((r) => r.outName.endsWith('.svg'));
  const rasters = results.filter((r) => r.outName.endsWith('.webp'));
  const heaviest = [...results].sort((a, b) => b.out - a.out)[0];

  console.log(
    `${results.length} cards: ${vectors.length} vector, ${rasters.length} raster`,
  );
  console.log(`${kb(totalIn)} -> ${kb(totalOut)}`);
  console.log(`heaviest: ${heaviest.outName} ${kb(heaviest.out)}`);

  if (check && stale > 0) {
    throw new Error(`${stale} asset(s) out of date — run npm run assets:cards`);
  }
}

build().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
