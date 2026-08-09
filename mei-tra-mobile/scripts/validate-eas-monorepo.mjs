import { createRequire } from 'node:module';
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const mobileRoot = path.resolve(path.dirname(scriptPath), '..');
const repositoryRoot = path.resolve(mobileRoot, '..');
const requireFromMobile = createRequire(path.join(mobileRoot, 'package.json'));

const failures = [];

const fail = (message) => {
  failures.push(message);
};

const readJson = (relativePath) =>
  JSON.parse(readFileSync(path.join(repositoryRoot, relativePath), 'utf8'));

const expectWorkspace = (rootPackage, workspace) => {
  if (!rootPackage.workspaces?.includes(workspace)) {
    fail(`Root package.json must include workspace "${workspace}".`);
  }
};

const expectDependency = (packageJson, dependency, expectedRange) => {
  const actualRange =
    packageJson.dependencies?.[dependency] ??
    packageJson.devDependencies?.[dependency];

  if (actualRange !== expectedRange) {
    fail(
      `${packageJson.name} must depend on ${dependency}@${expectedRange}, found ${actualRange ?? 'missing'}.`,
    );
  }
};

const resolvePackageExport = (specifier) => {
  try {
    requireFromMobile.resolve(specifier);
  } catch (error) {
    fail(
      `Cannot resolve ${specifier} from mei-tra-mobile. Run npm install from mei-tra-mobile and keep workspace metadata in the EAS archive. ${error.message}`,
    );
  }
};

const collectSourceFiles = (directory) => {
  const entries = readdirSync(directory, { withFileTypes: true });
  const sourceFiles = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      sourceFiles.push(...collectSourceFiles(absolutePath));
      continue;
    }

    if (
      entry.isFile() &&
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))
    ) {
      sourceFiles.push(absolutePath);
    }
  }

  return sourceFiles;
};

const ensureNoForbiddenImports = () => {
  const sourceRoots = [
    path.join(mobileRoot, 'src'),
    path.join(repositoryRoot, 'shared', 'game-client'),
  ];

  for (const sourceRoot of sourceRoots) {
    for (const sourceFile of collectSourceFiles(sourceRoot)) {
      const relativePath = path.relative(repositoryRoot, sourceFile);
      const source = readFileSync(sourceFile, 'utf8');

      if (source.includes('@contracts/')) {
        fail(
          `${relativePath} still imports @contracts/*. Use @meitra/contracts/* so Metro, Jest, and EAS resolve the same workspace package.`,
        );
      }

      if (source.match(/(?:\.\.\/){3,}shared\/game-client\//)) {
        fail(
          `${relativePath} imports shared/game-client through a deep relative path. Use @meitra/game-client/* so the sibling package is captured by npm workspaces.`,
        );
      }
    }
  }
};

const rootPackage = readJson('package.json');
const mobilePackage = readJson('mei-tra-mobile/package.json');
const contractsPackage = readJson('contracts/package.json');
const gameClientPackage = readJson('shared/game-client/package.json');

if (rootPackage.private !== true) {
  fail('Root package.json must be private because it declares workspaces.');
}

expectWorkspace(rootPackage, 'mei-tra-mobile');
expectWorkspace(rootPackage, 'contracts');
expectWorkspace(rootPackage, 'shared/game-client');

if (contractsPackage.name !== '@meitra/contracts') {
  fail('contracts/package.json must be named @meitra/contracts.');
}

if (gameClientPackage.name !== '@meitra/game-client') {
  fail('shared/game-client/package.json must be named @meitra/game-client.');
}

expectDependency(mobilePackage, '@meitra/contracts', 'file:../contracts');
expectDependency(
  mobilePackage,
  '@meitra/game-client',
  'file:../shared/game-client',
);
expectDependency(
  gameClientPackage,
  '@meitra/contracts',
  'file:../../contracts',
);

const rootLockPath = path.join(repositoryRoot, 'package-lock.json');
if (!existsSync(rootLockPath)) {
  fail('Root package-lock.json is missing. Run npm install from mei-tra-mobile.');
} else {
  const rootLock = readJson('package-lock.json');
  for (const packagePath of [
    'mei-tra-mobile',
    'contracts',
    'shared/game-client',
    'node_modules/@meitra/contracts',
    'node_modules/@meitra/game-client',
  ]) {
    if (!rootLock.packages?.[packagePath]) {
      fail(`Root package-lock.json is missing packages["${packagePath}"].`);
    }
  }
}

if (existsSync(path.join(mobileRoot, 'package-lock.json'))) {
  fail(
    'mei-tra-mobile/package-lock.json should not exist once npm workspaces are enabled; the reproducible lockfile is ../package-lock.json.',
  );
}

const metroConfigPath = path.join(mobileRoot, 'metro.config.js');
const metroConfig = readFileSync(metroConfigPath, 'utf8');
if (metroConfig.includes('watchFolders')) {
  fail(
    'metro.config.js should rely on Expo SDK 55 workspace auto-detection instead of manual watchFolders.',
  );
}

for (const requiredPath of [
  'mei-tra-mobile/eas.json',
  'mei-tra-mobile/.easignore',
  'contracts/game.ts',
  'contracts/socket.ts',
  'shared/game-client/blow.ts',
  'shared/game-client/card-legality.ts',
]) {
  const absolutePath = path.join(repositoryRoot, requiredPath);
  if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
    fail(`Required EAS monorepo file is missing: ${requiredPath}.`);
  }
}

for (const specifier of [
  '@meitra/contracts/game',
  '@meitra/contracts/push',
  '@meitra/contracts/socket',
  '@meitra/game-client/blow',
  '@meitra/game-client/card-legality',
]) {
  resolvePackageExport(specifier);
}

ensureNoForbiddenImports();

if (failures.length > 0) {
  console.error('EAS monorepo validation failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  'EAS monorepo validation passed: npm workspaces resolve mobile, contracts, and shared game-client packages.',
);
