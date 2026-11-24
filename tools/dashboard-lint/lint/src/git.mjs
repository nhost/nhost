import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const SCOPE_ROOT = 'dashboard/src';
const SOURCE_FILE = /\.(ts|tsx)$/;
const EXCLUDED = [/\/__generated__\//, /\/generated\//, /\.d\.ts$/];

export function isLintable(path) {
  return path.startsWith(`${SCOPE_ROOT}/`) && SOURCE_FILE.test(path) && !EXCLUDED.some((re) => re.test(path));
}

export function git(repo, args, { allowFailure = false } = {}) {
  try {
    return execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    if (allowFailure) {
      return null;
    }
    const stderr = error.stderr?.toString().trim() ?? '';
    throw new Error(`git ${args.join(' ')} failed: ${stderr}`);
  }
}

export function repoRoot(cwd) {
  const root = git(cwd, ['rev-parse', '--show-toplevel'], { allowFailure: true });
  if (!root) {
    throw new UsageError('Not inside a git repository.', 'Run dashboard-lint from a nhost checkout or worktree, or pass --repo <path>.');
  }
  return root.trim();
}

export class UsageError extends Error {
  constructor(message, hint) {
    super(message);
    this.hint = hint;
  }
}

export function resolveRange(repo, { base, head, commit }) {
  if (commit) {
    return resolveRange(repo, { base: `${commit}^`, head: commit });
  }
  const baseRef = base ?? 'origin/main';
  const headRef = head ?? null;
  const headCommit = headRef ? revParse(repo, headRef) : revParse(repo, 'HEAD');
  const baseCommit = revParse(repo, baseRef);
  const mergeBase = git(repo, ['merge-base', baseCommit, headCommit], { allowFailure: true })?.trim();
  if (!mergeBase) {
    throw new UsageError(`No merge-base between ${baseRef} and ${headRef ?? 'HEAD'}.`, 'Pass --base <ref> explicitly.');
  }
  return { baseRef, mergeBase, headRef, headCommit, worktree: headRef === null };
}

function revParse(repo, ref) {
  const sha = git(repo, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { allowFailure: true })?.trim();
  if (!sha) {
    throw new UsageError(`Unknown git ref: ${ref}`, 'Check the ref name, or run git fetch origin if it is a remote branch.');
  }
  return sha;
}

// Parses `git diff -U0 -M` into { path -> { status, basePath, added: [[start, end], ...] } }.
export function changedFiles(repo, range) {
  const args = ['diff', '-U0', '-M', '--no-color', '--no-ext-diff', range.mergeBase];
  if (!range.worktree) {
    args.push(range.headCommit);
  }
  args.push('--', SCOPE_ROOT);
  const diff = git(repo, args);
  const files = new Map();
  let current = null;
  let pendingFrom = null;
  let pendingStatus = 'modified';
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) {
      current = null;
      pendingFrom = null;
      pendingStatus = 'modified';
    } else if (line.startsWith('new file mode')) {
      pendingStatus = 'added';
    } else if (line.startsWith('rename from ')) {
      pendingFrom = line.slice('rename from '.length);
      pendingStatus = 'renamed';
    } else if (line.startsWith('--- ')) {
      const from = line.slice(4);
      if (from !== '/dev/null' && !pendingFrom) {
        pendingFrom = from.replace(/^a\//, '');
      }
    } else if (line.startsWith('+++ ')) {
      const to = line.slice(4);
      if (to === '/dev/null') {
        current = null;
      } else {
        const path = to.replace(/^b\//, '');
        current = { path, status: pendingStatus, basePath: pendingStatus === 'added' ? null : pendingFrom, added: [] };
        files.set(path, current);
      }
    } else if (line.startsWith('@@ ') && current) {
      const match = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
      const start = Number(match[1]);
      const count = match[2] === undefined ? 1 : Number(match[2]);
      if (count > 0) {
        current.added.push([start, start + count - 1]);
      }
    }
  }
  if (range.worktree) {
    const untracked = git(repo, ['ls-files', '--others', '--exclude-standard', '--', SCOPE_ROOT]).split('\n').filter(Boolean);
    for (const path of untracked) {
      const lines = readFileSync(join(repo, path), 'utf8').split('\n').length;
      files.set(path, { path, status: 'added', basePath: null, added: [[1, lines]] });
    }
  }
  return [...files.values()].filter((file) => isLintable(file.path));
}

export function allFiles(repo, range) {
  const list = range.worktree
    ? git(repo, ['ls-files', '--cached', '--others', '--exclude-standard', '--', SCOPE_ROOT])
    : git(repo, ['ls-tree', '-r', '--name-only', range.headCommit, '--', SCOPE_ROOT]);
  return list
    .split('\n')
    .filter((path) => path && isLintable(path))
    .filter((path) => !range.worktree || existsSync(join(repo, path)))
    .map((path) => ({ path, status: 'added', basePath: null, added: [[1, Number.MAX_SAFE_INTEGER]] }));
}

export function readHead(repo, range, path) {
  if (range.worktree) {
    const full = join(repo, path);
    return existsSync(full) ? readFileSync(full, 'utf8') : null;
  }
  return git(repo, ['show', `${range.headCommit}:${path}`], { allowFailure: true });
}

export function readBase(repo, range, path) {
  if (!path) {
    return null;
  }
  return git(repo, ['show', `${range.mergeBase}:${path}`], { allowFailure: true });
}

export function existsAtHead(repo, range, path) {
  if (range.worktree) {
    return existsSync(join(repo, path));
  }
  return git(repo, ['cat-file', '-e', `${range.headCommit}:${path}`], { allowFailure: true }) !== null;
}

// Files under SCOPE_ROOT at head whose text contains `needle`.
export function filesContaining(repo, range, needle) {
  const args = range.worktree
    ? ['grep', '-l', '--untracked', '-F', needle, '--', SCOPE_ROOT]
    : ['grep', '-l', '-F', needle, range.headCommit, '--', SCOPE_ROOT];
  const out = git(repo, args, { allowFailure: true }) ?? '';
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => (range.worktree ? line : line.slice(range.headCommit.length + 1)));
}

// A throwaway clone that shares objects with the repo, checked out at `sha` (dashboard/ only).
export function withCheckout(repo, sha, fn, { paths = ['/dashboard/'] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dashboard-lint-checkout-'));
  try {
    const git = (args) => execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
    execFileSync('git', ['clone', '-q', '--shared', '--no-checkout', repo, dir], { stdio: ['ignore', 'pipe', 'pipe'] });
    git(['sparse-checkout', 'set', '--no-cone', ...paths]);
    git(['checkout', '-q', '--detach', sha]);
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

