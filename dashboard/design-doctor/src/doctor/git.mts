import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function git(root: string, args: string[]): string {
  const result = spawnSync('git', ['-c', 'core.quotepath=false', ...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`git ${args[0]} failed: ${result.stderr || result.error}`);
  }
  return result.stdout;
}

export function mergeBase(root: string, ref: string): string {
  return git(root, ['merge-base', 'HEAD', ref]).trim();
}

export function baselineReference(
  root: string,
  base?: string,
): string | undefined {
  if (base) {
    return mergeBase(root, base);
  }
  const result = git(root, [
    'rev-list',
    '-1',
    'HEAD',
    '--',
    'dashboard/design-doctor/baseline.json',
  ]).trim();
  if (result && !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(result)) {
    throw new Error('Invalid baseline reference returned by git rev-list');
  }
  return result || undefined;
}

export interface Changes {
  paths: string[];
  renames: Map<string, string>;
  deleted: Set<string>;
}

export function changes(root: string, reference: string): Changes {
  const output = git(root, [
    'diff',
    '-M',
    '--name-status',
    '-z',
    reference,
    '--',
    'dashboard/src/',
  ]).split('\0');
  const paths = new Set<string>();
  const renames = new Map<string, string>();
  const deleted = new Set<string>();
  for (let index = 0; index < output.length - 1; ) {
    const state = output[index++];
    const old = output[index++];
    if (state.startsWith('R')) {
      const next = output[index++];
      renames.set(
        old.slice('dashboard/'.length),
        next.slice('dashboard/'.length),
      );
      paths.add(next.slice('dashboard/'.length));
    } else if (state.startsWith('D')) {
      deleted.add(old.slice('dashboard/'.length));
    } else {
      paths.add(old.slice('dashboard/'.length));
    }
  }
  const untracked = git(root, [
    'ls-files',
    '-z',
    '--others',
    '--exclude-standard',
    '--',
    'dashboard/src/',
  ])
    .split('\0')
    .filter(Boolean)
    .map((path) => path.slice('dashboard/'.length));
  for (const path of untracked) {
    paths.add(path);
  }
  // Git's rename detector cannot compare a tracked deletion to an untracked
  // destination. Exact-content matching covers that case without staging files.
  if (untracked.length) {
    const destinations = new Set(renames.values());
    for (const old of deleted) {
      const original = git(root, ['show', `${reference}:dashboard/${old}`]);
      const matches = untracked.filter(
        (path) =>
          !destinations.has(path) &&
          readFileSync(join(root, 'dashboard', path), 'utf8') === original,
      );
      if (matches.length === 1) {
        renames.set(old, matches[0]);
        destinations.add(matches[0]);
        deleted.delete(old);
      }
    }
  }
  for (const path of paths) {
    if (!existsSync(join(root, 'dashboard', path))) {
      paths.delete(path);
    }
  }
  return { paths: [...paths].sort(), renames, deleted };
}
