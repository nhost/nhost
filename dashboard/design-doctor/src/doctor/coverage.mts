import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { BiomeDiagnostic } from '../biome/runner.mts';
import type { Report } from '../contracts/report.mts';
import { inScope, type Manifest } from '../grit/manifest.mts';

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const source = /\.(?:[cm]?[jt]sx?)$/;

async function walk(root: string, prefix = 'src'): Promise<string[]> {
  const entries = await readdir(join(root, prefix), { withFileTypes: true });
  const children = await Promise.all(
    entries.map((entry) => {
      const path = `${prefix}/${entry.name}`;
      return entry.isDirectory()
        ? walk(root, path)
        : Promise.resolve(entry.isFile() && source.test(path) ? [path] : []);
    }),
  );
  return children.flat();
}

export async function scopeFiles(
  dashboard: string,
  scope: Manifest['scope'],
): Promise<{
  expected: string[];
  ignored: string[];
  vcsIgnored: 'known' | 'unknown';
}> {
  const candidates = (await walk(dashboard))
    .filter((path) => inScope(resolve(dashboard, path), scope))
    .sort(compare);
  const git = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd: dashboard,
    encoding: 'utf8',
  });
  if (git.status !== 0 || git.stdout.trim() !== 'true') {
    return { expected: candidates, ignored: [], vcsIgnored: 'unknown' };
  }
  const tracked = spawnSync('git', ['ls-files', '-z', '--', 'src/'], {
    cwd: dashboard,
    encoding: 'utf8',
  });
  if (tracked.status !== 0) {
    throw new Error(`Cannot list tracked sources: ${tracked.stderr}`);
  }
  const trackedSet = new Set(tracked.stdout.split('\0'));
  const check = spawnSync(
    'git',
    ['check-ignore', '--no-index', '-z', '--stdin'],
    {
      cwd: dashboard,
      input: `${candidates.join('\0')}\0`,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  if (check.error || (check.status !== 0 && check.status !== 1)) {
    throw new Error(`Cannot check VCS ignores: ${check.stderr || check.error}`);
  }
  const ignoredSet = new Set(check.stdout.split('\0').filter(Boolean));
  const ignored = [...ignoredSet]
    .filter((path) => trackedSet.has(path))
    .sort(compare);
  return {
    expected: candidates.filter((path) => !ignoredSet.has(path)),
    ignored,
    vcsIgnored: 'known',
  };
}

export function coverage(
  files: {
    expected: string[];
    ignored: string[];
    vcsIgnored: 'known' | 'unknown';
  },
  processed: readonly string[],
  diagnostics: readonly BiomeDiagnostic[],
): Report['coverage'] {
  const analyzed = new Set(processed);
  const parseErrors = new Set(
    diagnostics
      .filter((entry) => entry.category.startsWith('parse'))
      .map((entry) => entry.location?.path),
  );
  const skipped: Report['coverage']['skipped'] = files.expected
    .filter((path) => parseErrors.has(path) || !analyzed.has(path))
    .map((path) => ({
      path,
      reason: parseErrors.has(path)
        ? ('parse-error' as const)
        : ('omitted' as const),
    }));
  skipped.push(
    ...files.ignored.map((path) => ({ path, reason: 'vcs-ignored' as const })),
  );
  skipped.sort((a, b) => compare(a.path, b.path));
  return {
    status: skipped.some((entry) => entry.reason !== 'vcs-ignored')
      ? 'incomplete'
      : 'complete',
    expected: files.expected.length,
    processed: files.expected.filter(
      (path) => analyzed.has(path) && !parseErrors.has(path),
    ),
    skipped,
    vcsIgnored: files.vcsIgnored,
  };
}
