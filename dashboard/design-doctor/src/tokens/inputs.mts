import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, relative } from 'node:path';
import { buildCatalog } from '../catalog/build.mts';
import type { GeneratedIndex } from '../contracts/index.mts';
import { sorted } from './build.mts';

const require = createRequire(import.meta.url);
const packages = [
  'tailwindcss',
  '@tailwindcss/forms',
  '@tailwindcss/typography',
  'tailwindcss-animate',
];

async function files(
  root: string,
  path: string,
  extensions: readonly string[],
): Promise<string[]> {
  try {
    const entries = await readdir(join(root, path), { withFileTypes: true });
    const found = await Promise.all(
      entries.map(async (entry) => {
        const child = join(path, entry.name);
        if (entry.isDirectory()) {
          return files(root, child, extensions);
        }
        if (
          entry.isFile() &&
          extensions.includes(extname(entry.name)) &&
          !/(?:\.test\.|\.spec\.)/.test(entry.name)
        ) {
          return [child];
        }
        return [];
      }),
    );
    return found.flat();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export async function inputHashes(
  dashboard: string,
  catalogFiles?: ReadonlySet<string>,
): Promise<Record<string, string>> {
  const parsed = new Set(catalogFiles);
  if (!catalogFiles) {
    await buildCatalog(dashboard, {}, parsed);
  }
  const base = [
    'tailwind.config.js',
    'src/constants/screens.cjs',
    ...(await files(dashboard, 'src/styles', ['.css'])),
    ...(await files(dashboard, 'src/components/ui/v3', ['.ts', '.tsx'])),
    ...(await files(dashboard, 'design-doctor/src', ['.mts'])),
  ];
  for (const folder of ['form', 'common', 'presentational']) {
    for (const path of await files(dashboard, `src/components/${folder}`, [
      '.ts',
    ])) {
      const relativePath = path.slice(`src/components/${folder}/`.length);
      if (/^[^/]+\/index\.ts$/.test(relativePath)) {
        base.push(path);
      }
    }
  }
  for (const path of parsed) {
    const source = relative(dashboard, path).replaceAll('\\', '/');
    if (
      !source.startsWith('../') &&
      !source.startsWith('/') &&
      ['.ts', '.tsx'].includes(extname(source)) &&
      !/(?:\.test\.|\.spec\.)/.test(source)
    ) {
      base.push(source);
    }
  }
  for (const optional of [
    'design-doctor/catalog.meta.mts',
    'design-doctor/manifest.json',
  ]) {
    try {
      if ((await stat(join(dashboard, optional))).isFile()) {
        base.push(optional);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
  const inputs: [string, string][] = await Promise.all(
    [...new Set(base)].map(async (path) => [
      path.replaceAll('\\', '/'),
      createHash('sha256')
        .update(await readFile(join(dashboard, path)))
        .digest('hex'),
    ]),
  );
  for (const name of packages) {
    const pkg = require(`${name}/package.json`) as { version: string };
    inputs.push([
      `package:${name}`,
      createHash('sha256').update(pkg.version).digest('hex'),
    ]);
  }
  const biomeVersion = execFileSync('biome', ['--version'], {
    cwd: dashboard,
    encoding: 'utf8',
  }).trim();
  inputs.push([
    'biome:version',
    createHash('sha256').update(biomeVersion).digest('hex'),
  ]);
  return sorted(inputs);
}

export function changedInputs(
  stored: GeneratedIndex,
  current: Record<string, string>,
): string[] {
  return [...new Set([...Object.keys(stored.inputs), ...Object.keys(current)])]
    .filter((path) => stored.inputs[path] !== current[path])
    .sort();
}

export function stale(stored: GeneratedIndex, current: Record<string, string>) {
  const changed = changedInputs(stored, current);
  return { stale: changed.length > 0, changedInputs: changed };
}
