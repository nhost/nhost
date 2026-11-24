import { createRequire } from 'node:module';
import { basename, dirname, join, posix } from 'node:path';
import { existsAtHead, filesContaining, readBase, readHead, UsageError } from './git.mjs';

const MAX_LINES = 500;
const SHARED_PROJECT_FOLDERS = new Set(['common', 'hooks']);
const ARROW_EXEMPT = [/^dashboard\/src\/components\/ui\/v3\//];
const NOT_A_MODULE_FOLDER = /^dashboard\/src\/pages\//;

export function loadTypeScript(repo) {
  const manifest = join(repo, 'dashboard/package.json');
  try {
    return createRequire(manifest)('typescript');
  } catch {
    throw new UsageError('TypeScript not found in dashboard/node_modules.', 'Run pnpm install in dashboard/ of this worktree.');
  }
}

const isTest = (path) => /\.(test|spec)\.tsx?$/.test(path);
const lineCount = (text) => text.replace(/\n$/, '').split('\n').length;

function moduleName(path) {
  return basename(path).replace(/\.tsx?$/, '');
}

// Foo/Foo.tsx, useFoo/useFoo.ts: the file that gives its folder its name.
function isMainFile(path) {
  if (NOT_A_MODULE_FOLDER.test(path) || isTest(path)) {
    return false;
  }
  const name = moduleName(path);
  return name !== 'index' && /^\w+$/.test(name) && name === basename(dirname(path));
}

function makeFinder(ts, sourceFile, path) {
  const position = (pos) => sourceFile.getLineAndCharacterOfPosition(pos);
  return (rule, node, message) => {
    const start = position(node.getStart(sourceFile));
    const end = position(node.getEnd());
    return { rule, file: path, line: start.line + 1, column: start.character + 1, endLine: end.line + 1, message };
  };
}

function parse(ts, path, text) {
  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
}

function calleeName(ts, expression) {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text;
  }
  return null;
}

function walk(ts, node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walk(ts, child, visit));
}

function effectOnlySetsState(ts, sourceFile, finding) {
  const setters = new Set();
  walk(ts, sourceFile, (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isArrayBindingPattern(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      calleeName(ts, node.initializer.expression) === 'useState'
    ) {
      const setter = node.name.elements[1];
      if (setter && ts.isBindingElement(setter) && ts.isIdentifier(setter.name)) {
        setters.add(setter.name.text);
      }
    }
  });
  if (setters.size === 0) {
    return [];
  }
  const isSetterCall = (expression) =>
    ts.isCallExpression(expression) && ts.isIdentifier(expression.expression) && setters.has(expression.expression.text);
  const findings = [];
  walk(ts, sourceFile, (node) => {
    if (!ts.isCallExpression(node) || !['useEffect', 'useLayoutEffect'].includes(calleeName(ts, node.expression))) {
      return;
    }
    const callback = node.arguments[0];
    if (!callback || !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
      return;
    }
    const statements = ts.isBlock(callback.body) ? callback.body.statements : [callback.body];
    const onlySetters =
      statements.length > 0 &&
      statements.every((statement) =>
        ts.isExpressionStatement(statement) ? isSetterCall(statement.expression) : isSetterCall(statement),
      );
    if (onlySetters) {
      findings.push(finding('effect-only-sets-state', node, 'This effect only copies a value into state.'));
    }
  });
  return findings;
}

function functionDeclarations(ts, sourceFile, path, finding) {
  if (ARROW_EXEMPT.some((re) => re.test(path))) {
    return [];
  }
  const findings = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      const init = declaration.initializer;
      if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) && ts.isIdentifier(declaration.name)) {
        findings.push(
          finding('function-declarations', declaration, `Declare \`${declaration.name.text}\` with \`function ${declaration.name.text}(...)\` instead of an arrow function.`),
        );
      }
    }
  }
  return findings;
}

function typesFolderOnlyTypes(ts, sourceFile, path, finding) {
  if (!/\/types\//.test(path) || isTest(path)) {
    return [];
  }
  return sourceFile.statements
    .filter(
      (statement) =>
        ts.isVariableStatement(statement) ||
        ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement) ||
        ts.isExportAssignment(statement) ||
        ts.isExpressionStatement(statement),
    )
    .map((statement) => finding('types-folder-only-types', statement, 'Runtime code in a types/ folder; keep only types here.'));
}

function featureBoundaries(ts, sourceFile, path, finding) {
  const own = path.match(/^dashboard\/src\/features\/orgs\/projects\/([^/]+)\//)?.[1];
  if (!own || SHARED_PROJECT_FOLDERS.has(own)) {
    return [];
  }
  const findings = [];
  for (const statement of sourceFile.statements) {
    const specifier =
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier
        ? statement.moduleSpecifier.text
        : null;
    const target = specifier?.match(/^@\/features\/orgs\/projects\/([^/]+)/)?.[1];
    if (target && target !== own && !SHARED_PROJECT_FOLDERS.has(target)) {
      findings.push(finding('feature-boundaries', statement, `The ${own} feature imports from the ${target} feature.`));
    }
  }
  return findings;
}

const VITEST_GLOBALS = new Set(['describe', 'it', 'test', 'expect', 'vi', 'beforeEach', 'afterEach', 'beforeAll', 'afterAll', 'suite']);

function noVitestImports(ts, sourceFile, path, finding) {
  if (!isTest(path)) {
    return [];
  }
  const findings = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.text !== 'vitest') {
      continue;
    }
    const clause = statement.importClause;
    if (!clause || clause.isTypeOnly || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) {
      continue;
    }
    const globals = clause.namedBindings.elements
      .filter((element) => !element.isTypeOnly && VITEST_GLOBALS.has((element.propertyName ?? element.name).text))
      .map((element) => element.name.text);
    if (globals.length > 0) {
      findings.push(finding('no-vitest-imports', statement, `Vitest globals are enabled; remove the import of ${globals.join(', ')}.`));
    }
  }
  return findings;
}

// '@/a/B/B' -> import '@/a/B' from outside the folder, or './B' from inside it.
function importFolderNotFile(ts, sourceFile, path, finding) {
  if (/\/index\.tsx?$/.test(path)) {
    return [];
  }
  const findings = [];
  for (const statement of sourceFile.statements) {
    if (!(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) || !statement.moduleSpecifier) {
      continue;
    }
    const specifier = statement.moduleSpecifier.text;
    const parts = specifier.split('/');
    if (!specifier.startsWith('@/') || parts.length < 3 || parts.at(-1) !== parts.at(-2)) {
      continue;
    }
    const folderSpecifier = parts.slice(0, -1).join('/');
    const folder = `dashboard/src/${folderSpecifier.slice(2)}`;
    const message =
      dirname(path) === folder
        ? `This file is in the same folder; import it as './${parts.at(-1)}'.`
        : `Import the folder '${folderSpecifier}' (its index.ts), not '${specifier}'.`;
    findings.push(finding('import-folder-not-file', statement.moduleSpecifier, message));
  }
  return findings;
}

function indexReexportShape(ts, sourceFile, path, finding) {
  if (!/\/index\.tsx?$/.test(path)) {
    return [];
  }
  const findings = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier) {
      continue;
    }
    const specifier = statement.moduleSpecifier.text;
    if (specifier.startsWith('@/')) {
      findings.push(finding('index-reexport-shape', statement, `Re-export with a relative path ('./${posix.basename(specifier)}'), not '${specifier}'.`));
    }
    const elements = statement.exportClause && ts.isNamedExports(statement.exportClause) ? statement.exportClause.elements : [];
    for (const element of elements) {
      if (!element.propertyName && element.name.text === 'default') {
        findings.push(finding('index-reexport-shape', element, `Name the default export: export { default as ${posix.basename(specifier)} } from '${specifier}'.`));
      }
    }
  }
  return findings;
}

function defaultExportName(ts, sourceFile) {
  for (const statement of sourceFile.statements) {
    const modifiers = ts.canHaveModifiers(statement) ? (ts.getModifiers(statement) ?? []) : [];
    const isDefault = modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
    if (isDefault && (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement))) {
      return { found: true, name: statement.name?.text ?? null, node: statement };
    }
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      const name = ts.isIdentifier(statement.expression) ? statement.expression.text : null;
      return { found: true, name, node: statement };
    }
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      const element = statement.exportClause.elements.find((e) => e.name.text === 'default');
      if (element) {
        return { found: true, name: element.propertyName?.text ?? null, node: statement };
      }
    }
  }
  return { found: false, name: null, node: sourceFile.statements[0] ?? sourceFile };
}

function mainFileChecks(ts, sourceFile, file, repo, range, finding) {
  if (file.status !== 'added' || !isMainFile(file.path)) {
    return [];
  }
  const name = moduleName(file.path);
  const findings = [];
  const exported = defaultExportName(ts, sourceFile);
  if (!exported.found) {
    findings.push(finding('main-file-default-export', exported.node, `${name}.${file.path.split('.').pop()} has no default export; add \`export default function ${name}\`.`));
  } else if (exported.name && exported.name !== name) {
    findings.push(finding('main-file-default-export', exported.node, `The default export is named ${exported.name}; name it ${name} to match the file.`));
  }
  const folder = dirname(file.path);
  const indexPath = ['index.ts', 'index.tsx'].map((f) => `${folder}/${f}`).find((p) => existsAtHead(repo, range, p));
  if (!indexPath) {
    findings.push(finding('folder-needs-index', sourceFile.statements[0] ?? sourceFile, `${folder}/index.ts is missing.`));
  } else {
    const index = readHead(repo, range, indexPath) ?? '';
    // Any path to the main file counts here; index-reexport-shape reports non-relative paths.
    const reexport = new RegExp(`export \\{[^}]*\\bdefault as ${name}\\b[^}]*\\} from '[^']*/${name}'`);
    if (!reexport.test(index)) {
      findings.push(finding('folder-needs-index', sourceFile.statements[0] ?? sourceFile, `${indexPath} does not have export { default as ${name} } from './${name}'.`));
    }
  }
  return findings;
}

function maxFileLines(ts, sourceFile, file, text, repo, range) {
  if (isTest(file.path)) {
    return [];
  }
  const lines = lineCount(text);
  if (lines <= MAX_LINES) {
    return [];
  }
  const baseText = file.status === 'added' ? null : readBase(repo, range, file.basePath ?? file.path);
  if (baseText !== null && lineCount(baseText) > MAX_LINES) {
    return [];
  }
  return [
    {
      rule: 'max-file-lines',
      file: file.path,
      line: MAX_LINES + 1,
      column: 1,
      endLine: lines,
      message: `File has ${lines} lines (limit ${MAX_LINES})${baseText === null ? '' : `; it had ${lineCount(baseText)} on the base branch`}.`,
    },
  ];
}

// Folder import path for an index.ts: dashboard/src/a/B/index.ts -> @/a/B
function folderImportPath(indexPath) {
  return `@/${dirname(indexPath).slice('dashboard/src/'.length)}`;
}

function barrelExportsUsedOutside(ts, sourceFile, path, repo, range, finding) {
  if (!/\/index\.tsx?$/.test(path)) {
    return [];
  }
  const folder = dirname(path);
  const importPath = folderImportPath(path);
  const quoted = `'${importPath}'`;
  const consumers = filesContaining(repo, range, quoted).filter((consumer) => !consumer.startsWith(`${folder}/`));
  const consumerTexts = consumers.map((consumer) => readHead(repo, range, consumer) ?? '');
  const statementPattern = new RegExp(`(?:import|export)\\s+(?:type\\s+)?\\{([^}]*)\\}\\s*from\\s*${quoted.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}`, 'g');
  const usedNames = new Set();
  for (const text of consumerTexts) {
    for (const match of text.matchAll(statementPattern)) {
      for (const part of match[1].split(',')) {
        const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
        if (name) {
          usedNames.add(name);
        }
      }
    }
    if (new RegExp(`import\\s+\\*\\s+as\\s+\\w+\\s+from\\s*${quoted.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}`).test(text)) {
      return [];
    }
  }
  const findings = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement) || !statement.exportClause || !ts.isNamedExports(statement.exportClause)) {
      continue;
    }
    for (const element of statement.exportClause.elements) {
      const name = element.name.text;
      if (name !== 'default' && !usedNames.has(name)) {
        findings.push(finding('barrel-exports-used-outside', element, `${name} is exported from ${importPath} but nothing outside the folder imports it.`));
      }
    }
  }
  return findings;
}

export function runChecks({ ts, repo, range, file, text, enabled }) {
  const sourceFile = parse(ts, file.path, text);
  const finding = makeFinder(ts, sourceFile, file.path);
  const on = (rule) => enabled.has(rule);
  return [
    ...(on('effect-only-sets-state') ? effectOnlySetsState(ts, sourceFile, finding) : []),
    ...(on('function-declarations') ? functionDeclarations(ts, sourceFile, file.path, finding) : []),
    ...(on('types-folder-only-types') ? typesFolderOnlyTypes(ts, sourceFile, file.path, finding) : []),
    ...(on('feature-boundaries') ? featureBoundaries(ts, sourceFile, file.path, finding) : []),
    ...(on('no-vitest-imports') ? noVitestImports(ts, sourceFile, file.path, finding) : []),
    ...(on('import-folder-not-file') ? importFolderNotFile(ts, sourceFile, file.path, finding) : []),
    ...(on('index-reexport-shape') ? indexReexportShape(ts, sourceFile, file.path, finding) : []),
    ...(on('main-file-default-export') || on('folder-needs-index')
      ? mainFileChecks(ts, sourceFile, file, repo, range, finding).filter((f) => on(f.rule))
      : []),
    ...(on('barrel-exports-used-outside') ? barrelExportsUsedOutside(ts, sourceFile, file.path, repo, range, finding) : []),
    ...(on('max-file-lines') ? maxFileLines(ts, sourceFile, file, text, repo, range) : []),
  ];
}

