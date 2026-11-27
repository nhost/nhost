import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The rule `methods.ts` describes, checked against the import graph: a sign-in
// method lives in its own directory under `src/routes/auth/` and nothing
// outside imports from it but `methods.ts` itself.
const SRC = fileURLToPath(new URL('../..', import.meta.url));
const AUTH = join(SRC, 'routes', 'auth');

// The one shared file that names methods, and the one place deleting a method
// is done by hand.
const REGISTRY = join(SRC, 'routes', 'signin', 'methods.ts');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return walk(path);
    }
    return /\.(ts|svelte)$/.test(entry.name) ? [path] : [];
  });
}

// Every way a file names a module: static and type imports and re-exports
// (`from`, `import '...'`), then the calls, which can also take a template
// literal: `import()`.
const SPECIFIER =
  /(?<=\b(?:from|import)\s*)(['"])(.*?)\1|(?<=\b(?:import|require|vi\.(?:mock|doMock|importActual|importMock)\s*(?:<.*?>)?)\s*\(\s*)(['"`])(.*?)\3/g;

function specifiers(source: string): string[] {
  return [...source.matchAll(SPECIFIER)].map(
    (match) => match[2] ?? match[4] ?? '',
  );
}

// The path a local specifier names. `./$types` is SvelteKit's generated types
// for the route, not a file of the app's.
function resolveSpecifier(file: string, spec: string): string | null {
  if (spec.endsWith('/$types')) {
    return null;
  }
  const hole = spec.indexOf('${');
  const fixed =
    hole === -1 ? spec : spec.slice(0, spec.lastIndexOf('/', hole) + 1);
  let path: string;
  if (fixed.startsWith('#lib/') || fixed.startsWith('#routes/')) {
    path = resolve(SRC, fixed.slice(1));
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

// Which method a path belongs to, `*` for `routes/auth/` itself, which stands
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
      if (methodOf(file) || file === REGISTRY) {
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
