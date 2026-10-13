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

// Static imports, re-exports and dynamic `import()`, by specifier.
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;

function localImports(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const found: string[] = [];
  for (const match of source.matchAll(SPECIFIER)) {
    const spec = match[1];
    if (spec?.startsWith('@/')) {
      found.push(resolve(SRC, spec.slice(2)));
    } else if (spec?.startsWith('.')) {
      found.push(resolve(dirname(file), spec));
    }
  }
  return found;
}

// Which method a path belongs to, or null for anything outside `app/auth/`.
function methodOf(path: string): string | null {
  const rel = relative(AUTH, path);
  if (rel.startsWith('..')) {
    return null;
  }
  return rel.split(sep)[0] ?? null;
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
