import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const typesDirectory = fileURLToPath(new URL('../src/types/', import.meta.url));

async function collectTypeScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory()
        ? collectTypeScriptFiles(path)
        : Promise.resolve(path.endsWith('.ts') ? [path] : []);
    }),
  );

  return nestedFiles.flat();
}

const invalidFiles = (await collectTypeScriptFiles(typesDirectory)).filter(
  (path) => !path.endsWith('.types.ts') && !path.endsWith('.d.ts'),
);

if (invalidFiles.length > 0) {
  const formattedPaths = invalidFiles
    .map((path) => `- ${relative(typesDirectory, path)}`)
    .join('\n');

  throw new Error(
    `src/types may contain only explicitly named *.types.ts modules. Move standalone runtime code to src/adapters or src/domain:\n${formattedPaths}`,
  );
}

console.log('src/types contains explicitly named type modules only.');
