import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { syncDenshoAssets } from './sync-densho-assets.mjs';

test('a fresh web build copies only the 54 large shared images and detects stale copies', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'densho-web-'));
  const target = pathToFileURL(`${directory}/`);
  try {
    assert.equal(await syncDenshoAssets({ target }), 54);
    const files = await readdir(target);
    assert.equal(files.length, 54);
    assert.ok(files.every(file => file.endsWith('.webp')));
    await syncDenshoAssets({ target, check: true });
    const shared = await readFile(new URL('../assets/densho/styled/A_S.webp', import.meta.url));
    assert.deepEqual(await readFile(new URL('A_S.webp', target)), shared);
    await writeFile(new URL('A_S.webp', target), 'stale');
    await assert.rejects(syncDenshoAssets({ target, check: true }), /Outdated Densho web asset: A_S.webp/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
