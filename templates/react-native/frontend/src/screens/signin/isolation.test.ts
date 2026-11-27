import { readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

// The rule `methods.ts` describes, checked against the import graph. A sign-in
// method is its directory under `src/screens/auth/`, plus a directory of the
// same name under `src/app/auth/` when it has routes of its own. Nothing
// outside a method imports from it but `methods.ts`, so removing one is its
// two directories and its registry entry.
const SRC = resolve(__dirname, '../..');
const SCREENS = join(SRC, 'screens', 'auth');
const ROUTES = join(SRC, 'app', 'auth');
const ROOTS = [SCREENS, ROUTES];

// The one shared file that names methods, and the one place deleting a method
// is done by hand.
const REGISTRY = join(SRC, 'screens', 'signin', 'methods.ts');

type Tree = Map<string, string>;

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
// literal: `import()`, `require()` and jest's module functions.
const SPECIFIER =
  /(?<=\b(?:from|import)\s*)(['"])(.*?)\1|(?<=\b(?:import|require|jest\.(?:mock|doMock|unmock|setMock|requireActual|requireMock))\s*(?:<.*?>)?\s*\(\s*)(['"`])(.*?)\3/g;

function specifiers(source: string): string[] {
  return [...source.matchAll(SPECIFIER)].map(
    (match) => match[2] ?? match[4] ?? '',
  );
}

const isUnder = (dir: string, path: string): boolean => {
  const rel = relative(dir, path);
  return !rel.startsWith('..') && !isAbsolute(rel);
};

// The path a local specifier names. A template literal stands for every path
// it can spell, so one whose fixed part holds an auth root names that root.
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
  if (hole !== -1) {
    return ROOTS.find((root) => isUnder(path, root)) ?? path;
  }
  return path;
}

/** What the sign-in methods in `tree` break of the rule above. */
function check(tree: Tree) {
  const namesUnder = (root: string) =>
    new Set(
      [...tree.keys()].flatMap((file) => {
        const parts = relative(root, file).split(sep);
        return isUnder(root, file) && parts.length > 1 ? [parts[0]] : [];
      }),
    );
  const screenMethods = namesUnder(SCREENS);
  const routeMethods = namesUnder(ROUTES);
  const methods = new Set([...screenMethods, ...routeMethods]);

  // The method a path belongs to, `*` for an auth root itself, which stands
  // for every method, or null for shared code, including the files directly
  // in a root.
  const methodOf = (path: string): string | null => {
    const root = ROOTS.find((dir) => isUnder(dir, path));
    if (!root) {
      return null;
    }
    const [name, ...rest] = relative(root, path).split(sep);
    if (!name) {
      return '*';
    }
    return rest.length > 0 || methods.has(name) ? name : null;
  };

  const crossings: string[] = [];
  const strays: string[] = [];
  const reaches: string[] = [];

  for (const [file, source] of tree) {
    const own = methodOf(file);
    for (const spec of specifiers(source)) {
      const target = resolveSpecifier(file, spec);
      if (!target) {
        continue;
      }
      const theirs = methodOf(target);
      const edge = `${relative(SRC, file)} imports ${relative(SRC, target)}`;
      if (own && theirs && theirs !== own) {
        crossings.push(edge);
      }
      if (
        own &&
        isUnder(ROUTES, file) &&
        !isUnder(join(SCREENS, own), target)
      ) {
        strays.push(edge);
      }
      if (!own && theirs && file !== REGISTRY) {
        reaches.push(edge);
      }
    }
  }

  const orphans = [...routeMethods]
    .filter((name) => !screenMethods.has(name))
    .map((name) => relative(SRC, join(ROUTES, name)));

  return { crossings, strays, reaches, orphans };
}

describe('sign-in methods are self-contained', () => {
  // This file's fixtures name methods on purpose.
  const tree: Tree = new Map(
    walk(SRC)
      .filter((file) => file !== __filename)
      .map((file) => [file, readFileSync(file, 'utf8')]),
  );
  const found = check(tree);

  it('no method imports from another', () => {
    expect(found.crossings).toEqual([]);
  });

  it("a method's route files import only its own screens", () => {
    expect(found.strays).toEqual([]);
  });

  // Shared code includes `src/__tests__` and every route file outside a
  // method, so `src/app/` reaches a method only through the registry or the
  // method's own route files.
  it('shared code imports no method', () => {
    expect(found.reaches).toEqual([]);
  });

  it('every method with routes has screens', () => {
    expect(found.orphans).toEqual([]);
  });
});

describe('the isolation check', () => {
  const at = (files: Record<string, string>): Tree =>
    new Map(
      Object.entries(files).map(([path, source]) => [join(SRC, path), source]),
    );

  const method = {
    'screens/auth/password/page.tsx':
      "import { Button } from '@/components/ui/button';",
    'screens/auth/password/page.test.tsx': [
      "import RootLayout from '@/app/_layout';",
      "jest.mock('@/screens/auth/password/actions');",
    ].join('\n'),
    'app/auth/password/index.tsx':
      "export { default } from '@/screens/auth/password/page';",
    'screens/auth/otp/page.tsx': "import { x } from './actions';",
  };

  it('reads every form of specifier', () => {
    const source = [
      "import a from 'a';",
      "import type { B } from 'b';",
      "import 'c';",
      "export * from 'd';",
      "const e = await import('e');",
      'const f = require("f");',
      "jest.mock('g', () => ({}));",
      "jest.doMock('h');",
      "jest.requireActual<typeof import('i')>('j');",
      "jest.requireMock('k');",
      `jest.mock(\`l/\${name}\`);`,
    ].join('\n');

    expect(specifiers(source)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
      'h',
      'i',
      'j',
      'k',
      `l/\${name}`,
    ]);
  });

  it('allows a method, its routes, the registry and shared auth files', () => {
    expect(
      check(
        at({
          ...method,
          'screens/signin/methods.ts':
            "import Setting from '@/screens/auth/password/Setting';",
          'screens/auth/layout.tsx':
            "export { default } from '@/components/CenteredLayout';",
          'app/auth/_layout.tsx':
            "export { default } from '@/screens/auth/layout';",
          'app/signin/index.tsx':
            "export { default } from '@/screens/signin/page';",
        }),
      ),
    ).toEqual({ crossings: [], strays: [], reaches: [], orphans: [] });
  });

  it('finds a method importing another, in either tree', () => {
    const { crossings } = check(
      at({
        ...method,
        'screens/auth/otp/page.tsx': "import { x } from '../password/actions';",
        'app/auth/otp/index.tsx':
          "export { default } from '@/screens/auth/password/page';",
      }),
    );

    expect(crossings).toEqual([
      'screens/auth/otp/page.tsx imports screens/auth/password/actions',
      'app/auth/otp/index.tsx imports screens/auth/password/page',
    ]);
  });

  it('finds a route file importing anything but its screens', () => {
    const { strays } = check(
      at({
        ...method,
        'app/auth/password/index.tsx':
          "export { default } from '@/components/NotFound';",
      }),
    );

    expect(strays).toEqual([
      'app/auth/password/index.tsx imports components/NotFound',
    ]);
  });

  it('finds shared code, tests and routes included, reaching a method', () => {
    const { reaches } = check(
      at({
        ...method,
        '__tests__/routes/a.test.tsx':
          "jest.requireActual('@/screens/auth/otp/actions');",
        '__tests__/routes/b.test.tsx': `jest.requireMock(\`@/screens/auth/\${name}/actions\`);`,
        'app/_layout.tsx': "import Password from '@/app/auth/password';",
        'components/Thing.tsx': "require('@/screens/auth/password');",
      }),
    );

    expect(reaches).toEqual([
      '__tests__/routes/a.test.tsx imports screens/auth/otp/actions',
      '__tests__/routes/b.test.tsx imports screens/auth',
      'app/_layout.tsx imports app/auth/password',
      'components/Thing.tsx imports screens/auth/password',
    ]);
  });

  it('finds routes left behind by a removed method', () => {
    const { orphans } = check(at({ ...method, 'app/auth/gone/index.tsx': '' }));

    expect(orphans).toEqual(['app/auth/gone']);
  });
});
