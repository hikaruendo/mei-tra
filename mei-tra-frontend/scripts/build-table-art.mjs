#!/usr/bin/env node
/**
 * Renders the field mat from `scripts/table-art/` and writes the WebP that
 * both apps ship.
 *
 * The zabuton is a static prop, so three.js earns its keep at build time
 * rather than runtime: baking gives real lighting, a soft contact shadow and a
 * metallic border for nothing at all on the client, where shipping a renderer
 * would cost ~150 KB on web and a native module (expo-gl) on mobile. The SVG
 * this replaces had to fake the same effects by stacking dozens of flat
 * translucent shapes, because react-native-svg draws no gradient, filter or
 * pattern.
 *
 * Node has no WebGL, and headless-gl needs a native build that breaks often,
 * so the render runs in the Chromium that `@playwright/test` already installs.
 * The page is served over http rather than opened from disk: Chromium refuses
 * ES module imports across file:// origins.
 *
 * `--check` compares the SHA of the *sources* against `manifest.json`, not the
 * bytes of the output, for the reason `mei-tra-mobile/scripts/build-card-assets.mjs`
 * gives about webp: encoding is only reproducible for a fixed libvips build,
 * and a GPU render is less reproducible still. Hashing the inputs answers the
 * question that matters — "did the scene change without the art being rebuilt?"
 * — and needs neither three, Playwright nor sharp to run, so CI can do it.
 *
 * Usage:
 *   node scripts/build-table-art.mjs           # render and write the art
 *   node scripts/build-table-art.mjs --check   # verify the committed art is current
 *   node scripts/build-table-art.mjs --serve   # host the scene for live tweaking
 */
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(HERE, '..');
const ART = join(HERE, 'table-art');
const DEST = join(FRONTEND, 'public', 'table');

const OUTPUT_NAME = 'zabuton-nishijin.webp';
// Build metadata, not an asset: it lives beside the scene rather than in
// public/, which is served to the browser and mirrored to mobile wholesale.
const MANIFEST = join(ART, 'manifest.json');

/**
 * 1280 covers the largest display: the web mat caps at 23rem = 368 CSS px, so
 * a 3x screen asks for 1104.
 */
const RENDER_SIZE = 1280;
const WEBP_QUALITY = 88;
/** Above this the art is heavier than a rasterised court card, which is the wrong trade. */
const MAX_OUTPUT_BYTES = 320 * 1024;

/** Every file whose content changes the picture. */
const SOURCES = [
  join(ART, 'zabuton-scene.mjs'),
  join(ART, 'render.html'),
  fileURLToPath(import.meta.url),
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const sha = (buffer) => createHash('sha256').update(buffer).digest('hex');

async function sourceHashes() {
  const entries = await Promise.all(
    SOURCES.map(async (path) => [path.slice(FRONTEND.length + 1), sha(await readFile(path))]),
  );
  return Object.fromEntries(entries);
}

/** Serves the frontend directory so the page can import three from node_modules. */
async function startServer() {
  const server = createServer(async (request, response) => {
    const path = normalize(decodeURIComponent(new URL(request.url, 'http://x').pathname));
    const file = join(FRONTEND, path);
    if (!file.startsWith(FRONTEND)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(file);
      response.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, port: server.address().port };
}

async function render(port) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: RENDER_SIZE, height: RENDER_SIZE },
      deviceScaleFactor: 1,
    });
    const failures = [];
    page.on('pageerror', (error) => failures.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') failures.push(message.text());
    });

    await page.goto(
      `http://127.0.0.1:${port}/scripts/table-art/render.html?size=${RENDER_SIZE}`,
      { waitUntil: 'load' },
    );
    await page.waitForFunction(() => window.__zabutonReady === true, null, { timeout: 60_000 });
    if (failures.length > 0) {
      throw new Error(`scene reported errors:\n  ${failures.join('\n  ')}`);
    }

    const framing = await page.evaluate(() => window.__zabuton);
    const png = await page.locator('canvas').screenshot({ omitBackground: true });
    return { png, framing };
  } finally {
    await browser.close();
  }
}

async function build() {
  const { server, port } = await startServer();
  let png;
  let framing;
  try {
    ({ png, framing } = await render(port));
  } finally {
    server.close();
  }

  const sharp = (await import('sharp')).default;
  const webp = await sharp(png)
    .webp({ quality: WEBP_QUALITY, alphaQuality: 100, effort: 6 })
    .toBuffer();

  if (webp.byteLength > MAX_OUTPUT_BYTES) {
    throw new Error(
      `${OUTPUT_NAME} is ${(webp.byteLength / 1024).toFixed(0)} KB, over the ` +
        `${MAX_OUTPUT_BYTES / 1024} KB budget. Lower WEBP_QUALITY or simplify the scene.`,
    );
  }

  await mkdir(DEST, { recursive: true });
  await writeFile(join(DEST, OUTPUT_NAME), webp);
  await writeFile(
    MANIFEST,
    `${JSON.stringify({ renderSize: RENDER_SIZE, framing, sources: await sourceHashes() }, null, 2)}\n`,
  );

  console.log(
    `${OUTPUT_NAME}: ${RENDER_SIZE}px, ${(webp.byteLength / 1024).toFixed(0)} KB\n` +
      `  top face ${(framing.faceWidth * 100).toFixed(1)}% x ` +
      `${(framing.faceHeight * 100).toFixed(1)}% of the canvas, ` +
      `centred at ${framing.faceCenterY.toFixed(4)} (0 is exact)\n` +
      `  solid silhouette reaches ${framing.silhouetteBottom.toFixed(3)} ` +
      `(-1 would touch the bottom edge)\n` +
      `  run \`npm run assets:table\` in mei-tra-mobile to sync it`,
  );
}

async function check() {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  } catch {
    throw new Error('scripts/table-art/manifest.json is missing; run npm run assets:table:build');
  }
  await readFile(join(DEST, OUTPUT_NAME)).catch(() => {
    throw new Error(`${OUTPUT_NAME} is missing; run npm run assets:table:build`);
  });

  const current = await sourceHashes();
  const stale = Object.keys(current).filter((name) => current[name] !== manifest.sources?.[name]);
  if (stale.length > 0) {
    throw new Error(
      `table art is stale — these changed since it was rendered:\n  ${stale.join('\n  ')}\n` +
        'run npm run assets:table:build, then npm run assets:table in mei-tra-mobile',
    );
  }
  console.log(`${OUTPUT_NAME} is up to date`);
}

const mode = process.argv[2];
if (mode === '--check') {
  await check();
} else if (mode === '--serve') {
  const { port } = await startServer();
  console.log(`http://127.0.0.1:${port}/scripts/table-art/render.html?size=${RENDER_SIZE}`);
  console.log('Ctrl-C to stop.');
} else {
  await build();
}
