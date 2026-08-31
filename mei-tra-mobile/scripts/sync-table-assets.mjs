#!/usr/bin/env node
/**
 * Copies the table artwork from the web app's source of truth.
 *
 * Same shape as sync-sound-assets.mjs: metro needs a literal path inside the
 * mobile package, so the file is copied rather than reached across, and
 * `--check` (run in CI) is what stops the copy drifting from the original.
 */
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MOBILE = join(HERE, '..');
const SOURCE = join(MOBILE, '..', 'mei-tra-frontend', 'public', 'table');
const DEST = join(MOBILE, 'assets', 'table');
const FILES = ['zabuton-nishijin.svg'];
const checkOnly = process.argv.includes('--check');

await mkdir(DEST, { recursive: true });

for (const file of FILES) {
  const source = await readFile(join(SOURCE, file));

  if (checkOnly) {
    const destination = await readFile(join(DEST, file)).catch(() => null);
    if (!destination || !source.equals(destination)) {
      throw new Error(`${file} is missing or stale; run npm run assets:table`);
    }
    continue;
  }

  await copyFile(join(SOURCE, file), join(DEST, file));
}

console.log(
  checkOnly
    ? `${FILES.length} table assets are up to date`
    : `${FILES.length} table assets copied from the web source of truth`,
);
