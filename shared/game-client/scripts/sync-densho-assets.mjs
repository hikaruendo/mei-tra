import { mkdir, readFile, readdir, copyFile } from 'node:fs/promises';

const source = new URL('../assets/densho/', import.meta.url);
const target = new URL('../../../mei-tra-frontend/public/cards/densho/', import.meta.url);
const check = process.argv.includes('--check');
await mkdir(target, { recursive: true });
for (const file of (await readdir(source)).filter(file => file.endsWith('.jpg'))) {
  const src = new URL(file, source);
  const dest = new URL(file, target);
  if (check) {
    const actual = await readFile(dest);
    if (!actual.equals(await readFile(src))) throw new Error(`Outdated densho asset: ${file}`);
  } else {
    await copyFile(src, dest);
  }
}
console.log('Densho card assets are in sync.');
