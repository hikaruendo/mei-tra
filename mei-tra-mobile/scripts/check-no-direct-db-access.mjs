import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const projectRoot = new URL('..', import.meta.url).pathname;
const sourceRoot = join(projectRoot, 'src');
const sourceExtensions = new Set(['.ts', '.tsx']);
const directDatabaseCall = /\bsupabase\s*\.\s*(?:from|rpc)\s*\(/;
const violations = [];

async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await scan(path);
      continue;
    }
    if (!sourceExtensions.has(extname(entry.name))) {
      continue;
    }

    const source = await readFile(path, 'utf8');
    if (directDatabaseCall.test(source)) {
      violations.push(relative(projectRoot, path));
    }
  }
}

await scan(sourceRoot);

if (violations.length > 0) {
  console.error(
    'Direct Supabase database access is forbidden in the Mobile client. Use the backend API:\n' +
      violations.map((path) => `- ${path}`).join('\n'),
  );
  process.exit(1);
}

console.log('Mobile client has no direct Supabase database access.');
