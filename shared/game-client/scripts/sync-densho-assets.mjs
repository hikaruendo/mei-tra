import { copyFile, mkdir, readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Shared assets are canonical. Web only serves the large variant; these
// disposable public copies are created before dev/build, never committed.
export async function syncDenshoAssets({
  source = new URL('../assets/densho/styled/', import.meta.url),
  target = new URL('../../../mei-tra-frontend/public/cards/densho/styled/', import.meta.url),
  check = false,
} = {}) {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', source), 'utf8'));
  const files = Object.keys(manifest.cards).map(id => {
    if (!/^(?:(?:[2-9]|10|J|Q|K|A)_[SHDC]|card_back|joker_red)$/.test(id)) throw new Error(`Invalid Densho card id: ${id}`);
    return `${id}.webp`;
  }).sort();
  if (!check) await mkdir(target, { recursive: true });
  for (const file of files) {
    const src = new URL(file, source);
    const dest = new URL(file, target);
    if (check) {
      if (!(await readFile(dest)).equals(await readFile(src))) throw new Error(`Outdated Densho web asset: ${file}`);
    } else {
      await copyFile(src, dest);
    }
  }
  if ((await readdir(target)).sort().join() !== files.join()) throw new Error('Densho web assets contain unexpected files or sizes.');
  return files.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const count = await syncDenshoAssets({ check: process.argv.includes('--check') });
  console.log(`${count} Densho web assets ${process.argv.includes('--check') ? 'verified' : 'copied'} from the shared deck.`);
}
