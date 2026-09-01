import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function findMigrationHistoryMismatches(output) {
  const rows = output
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^\s*(\d*)\s*[|│]\s*(\d*)\s*[|│]/);
      if (!match || (!match[1] && !match[2])) return null;
      return { local: match[1], remote: match[2] };
    })
    .filter(Boolean);

  if (rows.length === 0) {
    throw new Error('Supabase migration list did not contain migration rows');
  }

  return rows.filter(({ local, remote }) => local !== remote);
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    throw new Error('Usage: node check-production-migrations.mjs <migration-list>');
  }

  const output = await readFile(path, 'utf8');
  const mismatches = findMigrationHistoryMismatches(output);
  if (mismatches.length > 0) {
    const details = mismatches
      .map(({ local, remote }) => `local=${local || '-'} remote=${remote || '-'}`)
      .join('\n');
    throw new Error(`Production migration history does not match:\n${details}`);
  }

  console.log('Production migration history matches the repository.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
