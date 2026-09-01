import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const sourceRoots = ['app', 'components', 'contexts', 'hooks', 'lib'];
const sourceExtensions = new Set(['.ts', '.tsx']);

function isSupabaseModule(moduleName) {
  return moduleName === '@/lib/supabase' || moduleName.endsWith('/lib/supabase');
}

function containsTrackedClient(expression, trackedNames) {
  if (ts.isIdentifier(expression)) {
    return trackedNames.has(expression.text);
  }
  if (
    ts.isPropertyAccessExpression(expression) ||
    ts.isElementAccessExpression(expression) ||
    ts.isCallExpression(expression)
  ) {
    return containsTrackedClient(expression.expression, trackedNames);
  }
  if (ts.isParenthesizedExpression(expression)) {
    return containsTrackedClient(expression.expression, trackedNames);
  }
  return false;
}

export function findDirectDatabaseCalls(source, fileName = 'source.ts') {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const trackedNames = new Set();

  for (const statement of sourceFile.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      isSupabaseModule(statement.moduleSpecifier.text)
    ) {
      for (const element of statement.importClause?.namedBindings?.elements ?? []) {
        if ((element.propertyName ?? element.name).text === 'supabase') {
          trackedNames.add(element.name.text);
        }
      }
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    const collectAliases = (node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        containsTrackedClient(node.initializer, trackedNames) &&
        !trackedNames.has(node.name.text)
      ) {
        trackedNames.add(node.name.text);
        changed = true;
      }
      ts.forEachChild(node, collectAliases);
    };
    collectAliases(sourceFile);
  }

  const violations = [];
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const method = ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : ts.isElementAccessExpression(callee) &&
            callee.argumentExpression &&
            ts.isStringLiteral(callee.argumentExpression)
          ? callee.argumentExpression.text
          : null;
      if (
        (method === 'from' || method === 'rpc') &&
        containsTrackedClient(callee.expression, trackedNames)
      ) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        violations.push(line + 1);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return violations;
}

async function scan(directory, violations) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await scan(path, violations);
      continue;
    }
    if (!sourceExtensions.has(extname(entry.name))) {
      continue;
    }

    const source = await readFile(path, 'utf8');
    for (const line of findDirectDatabaseCalls(source, path)) {
      violations.push(`${relative(projectRoot, path)}:${line}`);
    }
  }
}

async function main() {
  const violations = [];
  for (const sourceRoot of sourceRoots) {
    await scan(join(projectRoot, sourceRoot), violations);
  }

  if (violations.length > 0) {
    console.error(
      'Direct Supabase database access is forbidden in the Web client. Use the backend API:\n' +
        violations.map((path) => `- ${path}`).join('\n'),
    );
    process.exitCode = 1;
    return;
  }

  console.log('Web client has no direct Supabase database access.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
