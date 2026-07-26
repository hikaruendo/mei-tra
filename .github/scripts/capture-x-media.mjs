import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const { chromium } = require(path.resolve('mei-tra-frontend/node_modules/playwright'));

const baseUrl = (process.env.PLAYWRIGHT_BASE_URL || 'https://meitra.kando1.com').replace(/\/$/, '');
const bodyFile = process.env.DEMO_BODY_FILE || 'demo-pr-body.md';
const outputDir = process.env.MEDIA_OUTPUT_DIR || 'x-media';

const body = await fs.readFile(bodyFile, 'utf8');
const match = body.match(/<!-- x-demo:start -->\s*([\s\S]*?)\s*<!-- x-demo:end -->/);

if (!match) {
  console.log('No x-demo specification found; skipping media capture.');
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, 'media.json'), JSON.stringify({ media: 'none' }));
  process.exit(0);
}

let spec;
try {
  spec = JSON.parse(match[1]);
} catch (error) {
  throw new Error(`The x-demo block must contain valid JSON: ${error.message}`);
}

if (!spec || typeof spec.route !== 'string' || !spec.route.startsWith('/')) {
  throw new Error('x-demo.route must be an absolute path such as /ja/docs.');
}

if (!['screenshot', 'video', 'none'].includes(spec.media)) {
  throw new Error('x-demo.media must be screenshot, video, or none.');
}

if (spec.media === 'none') {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, 'media.json'), JSON.stringify({ media: 'none' }));
  console.log('x-demo requested no media; skipping capture.');
  process.exit(0);
}

if (!Array.isArray(spec.steps)) {
  throw new Error('x-demo.steps must be an array.');
}

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext(
  spec.media === 'video'
    ? { recordVideo: { dir: outputDir, size: { width: 1280, height: 720 } }, viewport: { width: 1280, height: 720 } }
    : { viewport: { width: 1280, height: 720 } },
);
const page = await context.newPage();

try {
  const url = `${baseUrl}${spec.route}`;
  let loaded = false;
  let lastError;
  for (let attempt = 1; attempt <= 4 && !loaded; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
      loaded = true;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(5_000);
    }
  }
  if (!loaded) throw lastError;

  for (const [index, step] of spec.steps.entries()) {
    if (!step || typeof step !== 'object') throw new Error(`x-demo.steps[${index}] must be an object.`);
    if (step.action === 'click' && typeof step.text === 'string') {
      const target = page.getByText(step.text, { exact: true }).first();
      await target.click({ timeout: 15_000 });
      await page.waitForTimeout(700);
      continue;
    }
    if (step.action === 'clickRole' && typeof step.role === 'string' && typeof step.name === 'string') {
      await page.getByRole(step.role, { name: step.name }).first().click({ timeout: 15_000 });
      await page.waitForTimeout(700);
      continue;
    }
    if (step.action === 'wait' && Number.isFinite(step.ms)) {
      await page.waitForTimeout(Math.min(Math.max(step.ms, 0), 10_000));
      continue;
    }
    throw new Error(`Unsupported x-demo step at index ${index}.`);
  }

  if (spec.media === 'screenshot') {
    const filename = typeof spec.filename === 'string' && spec.filename.endsWith('.png') ? spec.filename : 'capture.png';
    await page.screenshot({ path: path.join(outputDir, filename), fullPage: false });
    await fs.writeFile(path.join(outputDir, 'media.json'), JSON.stringify({ media: 'screenshot', file: filename }));
  } else {
    await page.screenshot({ path: path.join(outputDir, 'poster.png'), fullPage: false });
    await page.waitForTimeout(500);
    await page.close();
    await context.close();
    const files = (await fs.readdir(outputDir)).filter((file) => file.endsWith('.webm') || file.endsWith('.mp4'));
    const video = files[0];
    if (!video) throw new Error('Playwright did not produce a video file.');
    const finalName = 'capture.webm';
    if (video !== finalName) await fs.rename(path.join(outputDir, video), path.join(outputDir, finalName));
    await fs.writeFile(path.join(outputDir, 'media.json'), JSON.stringify({ media: 'video', file: finalName, poster: 'poster.png' }));
    await browser.close();
    console.log(`Captured ${finalName} for ${url}`);
    process.exit(0);
  }
} finally {
  await page.close().catch(() => {});
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
}

console.log(`Captured ${spec.media} for ${baseUrl}${spec.route}`);
