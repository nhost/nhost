import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import * as ts from 'typescript';

// The `import` snippet shown in each module's docstring is hand written prose,
// not `@includeCode`d from a compiled test, so a rename of an export slips
// straight through to the generated reference pages. This extracts those code
// blocks and typechecks them against the package so that class of drift fails
// here instead of in a user's editor.

const packageRoot = resolve(__dirname, '..', '..');

const entryFiles = [
  'src/index.ts',
  'src/auth/index.ts',
  'src/fetch/index.ts',
  'src/functions/index.ts',
  'src/graphql/index.ts',
  'src/session/index.ts',
  'src/storage/index.ts',
];

// Entries that currently document an example. Listed explicitly so that a change
// to the docstring format which breaks extraction fails loudly rather than
// silently checking nothing.
const entriesWithExamples = [
  'src/index.ts',
  'src/auth/index.ts',
  'src/functions/index.ts',
  'src/graphql/index.ts',
  'src/storage/index.ts',
];

interface Example {
  file: string;
  index: number;
  code: string;
  path: string;
}

function extractTsBlocks(source: string): string[] {
  const blocks: string[] = [];
  let current: string[] | null = null;
  for (const raw of source.split('\n')) {
    if (!/^\s*\*/.test(raw)) continue;
    const line = raw.replace(/^\s*\*\s?/, '');
    if (current === null) {
      if (/^```(ts|typescript)\s*$/.test(line.trim())) current = [];
    } else if (line.trim() === '```') {
      blocks.push(current.join('\n'));
      current = null;
    } else {
      current.push(line);
    }
  }
  return blocks;
}

const examples: Example[] = entryFiles.flatMap((file) =>
  extractTsBlocks(readFileSync(join(packageRoot, file), 'utf8')).map(
    (code, index) => ({
      file,
      index,
      code,
      path: join(
        packageRoot,
        'src',
        `__docstring_check_${file.replace(/[/.]/g, '_')}_${index}.ts`,
      ),
    }),
  ),
);

function compilerOptions(): ts.CompilerOptions {
  const configPath = join(packageRoot, 'tsconfig.json');
  const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);
  if (error)
    throw new Error(ts.flattenDiagnosticMessageText(error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, packageRoot);
  return {
    ...parsed.options,
    noEmit: true,
    declaration: false,
    declarationMap: false,
    composite: false,
    sourceMap: false,
    // Snippets are intentionally partial (an import with nothing that uses it).
    noUnusedLocals: false,
    noUnusedParameters: false,
    skipLibCheck: true,
  };
}

function buildProgram(): ts.Program {
  const options = compilerOptions();
  const sources = new Map(examples.map((e) => [e.path, e.code]));
  const host = ts.createCompilerHost(options, true);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, version, onError, shouldCreate) => {
    const code = sources.get(fileName);
    return code === undefined
      ? getSourceFile(fileName, version, onError, shouldCreate)
      : ts.createSourceFile(fileName, code, version, true);
  };
  const fileExists = host.fileExists.bind(host);
  host.fileExists = (fileName) => sources.has(fileName) || fileExists(fileName);
  const readFile = host.readFile.bind(host);
  host.readFile = (fileName) => sources.get(fileName) ?? readFile(fileName);
  return ts.createProgram({ rootNames: [...sources.keys()], options, host });
}

const program = buildProgram();

function typeErrors(example: Example): string[] {
  const sourceFile = program.getSourceFile(example.path);
  if (!sourceFile) return [`could not load example from ${example.file}`];
  return [
    ...program.getSyntacticDiagnostics(sourceFile),
    ...program.getSemanticDiagnostics(sourceFile),
  ].map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
}

describe('module docstring examples', () => {
  test.each(entriesWithExamples)(
    '%s documents at least one example',
    (file) => {
      expect(examples.some((e) => e.file === file)).toBe(true);
    },
  );

  test.each(
    examples.map(
      (e) => [`${e.file}: ${e.code.replace(/\n/g, ' | ')}`, e] as const,
    ),
  )('typechecks %s', (_label, example) => {
    expect(typeErrors(example)).toEqual([]);
  });
});
