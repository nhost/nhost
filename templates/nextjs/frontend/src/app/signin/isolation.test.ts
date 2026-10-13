import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The rule `methods.ts` describes, checked against the import graph: a
// sign-in method lives in its own directory under `src/app/auth/` and nothing
// outside imports from it, so deleting the directory and its line in
// `methods.ts` can never leave a dangling import. The two assertions are the
// two ways that could break: a method reaching into another, or shared code
// reaching into a method.
const SRC = fileURLToPath(new URL('../..', import.meta.url));
const AUTH = join(SRC, 'app', 'auth');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return walk(path);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

// Every way a file names a module: static and type imports and re-exports
// (`from`, `import '...'`), then the calls, which can also take a template
// literal: `import()`, `require()` and the Vitest mocks a test reaches into a
// module with. The calls are matched by lookbehind so a type argument such as
// `vi.importActual<typeof import('...')>('...')` yields both specifiers.
const SPECIFIER =
  /(?<=\b(?:from|import)\s*)(['"])(.*?)\1|(?<=\b(?:import|require|vi\.(?:mock|doMock|importActual|importMock)\s*(?:<.*?>)?)\s*\(\s*)(['"`])(.*?)\3/g;

function specifiers(source: string): string[] {
  return [...source.matchAll(SPECIFIER)].map(
    (match) => match[2] ?? match[4] ?? '',
  );
}

// The path a local specifier names. An interpolated one is cut back to its
// last fixed directory, and one that could still land in any method, such as
// `@/app/auth/${name}/actions`, names the whole of `app/auth/`.
function resolveSpecifier(file: string, spec: string): string | null {
  const hole = spec.indexOf('${');
  const fixed =
    hole === -1 ? spec : spec.slice(0, spec.lastIndexOf('/', hole) + 1);
  let path: string;
  if (fixed.startsWith('@/')) {
    path = resolve(SRC, fixed.slice(2));
  } else if (fixed.startsWith('.')) {
    path = resolve(dirname(file), fixed);
  } else {
    return null;
  }
  if (hole !== -1 && !relative(path, AUTH).startsWith('..')) {
    return AUTH;
  }
  return path;
}

function localImports(file: string): string[] {
  return specifiers(readFileSync(file, 'utf8')).flatMap((spec) => {
    const path = resolveSpecifier(file, spec);
    return path ? [path] : [];
  });
}

// Which method a path belongs to, `*` for `app/auth/` itself, which stands
// for every method, or null for anything outside it.
function methodOf(path: string): string | null {
  const rel = relative(AUTH, path);
  if (rel.startsWith('..')) {
    return null;
  }
  return rel.split(sep)[0] || '*';
}

function describePath(path: string): string {
  return relative(SRC, path);
}

describe('the import scan', () => {
  it('finds a specifier in every form', () => {
    const fixture = [
      "import { a } from '@/static';",
      "import type { B } from '@/type';",
      "export * from './reexport';",
      "import '@/side-effect';",
      "await import('@/dynamic');",
      `await import(\`@/app/auth/\${name}/actions\`);`,
      "vi.mock('@/mock', () => ({}));",
      'vi.doMock("@/do-mock");',
      "vi.importActual<typeof import('@/type-argument')>('@/import-actual');",
      'vi.importMock(`@/import-mock`);',
      "require('@/require');",
    ].join('\n');
    expect(specifiers(fixture)).toEqual([
      '@/static',
      '@/type',
      './reexport',
      '@/side-effect',
      '@/dynamic',
      `@/app/auth/\${name}/actions`,
      '@/mock',
      '@/do-mock',
      '@/type-argument',
      '@/import-actual',
      '@/import-mock',
      '@/require',
    ]);
  });

  it('takes an interpolated method segment to name every method', () => {
    const shared = join(SRC, 'app', 'account', 'page.tsx');
    for (const spec of [
      `@/app/auth/\${name}/actions`,
      `@/app/\${area}/password/actions`,
      `../auth/pass\${word}/actions`,
    ]) {
      expect(resolveSpecifier(shared, spec)).toBe(AUTH);
    }
    expect(resolveSpecifier(shared, `@/app/auth/password/\${file}`)).toBe(
      join(AUTH, 'password'),
    );
    expect(methodOf(AUTH)).toBe('*');
  });
});

describe('sign-in methods are self-contained', () => {
  const files = walk(SRC);

  it('no method imports from another', () => {
    const crossings: string[] = [];
    for (const file of files) {
      const own = methodOf(file);
      if (!own) {
        continue;
      }
      for (const target of localImports(file)) {
        const theirs = methodOf(target);
        if (theirs && theirs !== own) {
          crossings.push(
            `${describePath(file)} imports ${describePath(target)}`,
          );
        }
      }
    }
    expect(crossings).toEqual([]);
  });

  it('shared code imports no method', () => {
    const reaches: string[] = [];
    for (const file of files) {
      if (methodOf(file)) {
        continue;
      }
      for (const target of localImports(file)) {
        if (methodOf(target)) {
          reaches.push(`${describePath(file)} imports ${describePath(target)}`);
        }
      }
    }
    expect(reaches).toEqual([]);
  });
});
