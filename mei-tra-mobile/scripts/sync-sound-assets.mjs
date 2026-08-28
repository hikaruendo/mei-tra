#!/usr/bin/env node
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MOBILE = join(HERE, '..');
const SOURCE = join(MOBILE, '..', 'mei-tra-frontend', 'public', 'sounds');
const DEST = join(MOBILE, 'assets', 'sounds');
const FILES = [
  'card-play.mp3',
  'card-select.mp3',
  'negri.mp3',
  'shuffle.mp3',
  'victory.mp3',
];
const checkOnly = process.argv.includes('--check');

await mkdir(DEST, { recursive: true });

for (const file of FILES) {
  const source = await readFile(join(SOURCE, file));

  if (checkOnly) {
    const destination = await readFile(join(DEST, file)).catch(() => null);
    if (!destination || !source.equals(destination)) {
      throw new Error(
        `${file} is missing or stale; run npm run assets:sounds`,
      );
    }
    continue;
  }

  await copyFile(join(SOURCE, file), join(DEST, file));
}

console.log(
  checkOnly
    ? `${FILES.length} sound assets are up to date`
    : `${FILES.length} sound assets copied from the web source of truth`,
);
