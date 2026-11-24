import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { Finding, Report } from '../contracts/report.mts';
import { inScope, type Manifest } from '../grit/manifest.mts';
import { baselineReference, type Changes, changes, git } from './git.mts';

const counts = z.record(z.string(), z.number().int().positive());
export const baselineSchema = z.object({
  schemaVersion: z.literal(1),
  rules: z.record(
    z.string(),
    z.object({
      version: z.number().int().positive(),
      vocabularyHash: z.string(),
    }),
  ),
  files: z.record(z.string(), z.record(z.string(), counts)),
});
export type Baseline = z.infer<typeof baselineSchema>;
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const location = 'design-doctor/baseline.json';

export async function readBaseline(
  dashboard: string,
): Promise<Baseline | undefined> {
  try {
    return baselineSchema.parse(
      JSON.parse(await readFile(join(dashboard, location), 'utf8')),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

export function baselineAt(
  root: string,
  reference?: string,
): Baseline | undefined {
  if (!reference) {
    return undefined;
  }
  if (
    !git(root, [
      'ls-tree',
      '--name-only',
      reference,
      '--',
      `dashboard/${location}`,
    ]).trim()
  ) {
    return undefined;
  }
  return baselineSchema.parse(
    JSON.parse(git(root, ['show', `${reference}:dashboard/${location}`])),
  );
}

export function ruleHashes(
  manifest: Manifest,
  hashes: Readonly<Record<string, string>>,
): Baseline['rules'] {
  return Object.fromEntries(
    manifest.rules.map(({ id, version }) => [
      id,
      { version, vocabularyHash: hashes[id] ?? '' },
    ]),
  );
}

export function remap(baseline: Baseline, diff: Changes): Baseline {
  const files = { ...baseline.files };
  for (const [old, path] of diff.renames) {
    if (files[old]) {
      if (files[path]) {
        throw new Error(`Baseline rename destination already exists: ${path}`);
      }
      files[path] = files[old];
      delete files[old];
    }
  }
  for (const path of diff.deleted) {
    delete files[path];
  }
  return { ...baseline, files };
}

export function staleRules(
  baseline: Baseline | undefined,
  current: Baseline['rules'],
): string[] {
  return Object.entries(baseline?.rules ?? {})
    .filter(
      ([id, entry]) =>
        !current[id] ||
        current[id].version !== entry.version ||
        current[id].vocabularyHash !== entry.vocabularyHash,
    )
    .map(([id]) => id);
}

export function compatibleBaseline(
  baseline: Baseline | undefined,
  stale: readonly string[],
): Baseline | undefined {
  if (!baseline || !stale.length) {
    return baseline;
  }
  const excluded = new Set(stale);
  return {
    ...baseline,
    files: Object.fromEntries(
      Object.entries(baseline.files).map(([path, rules]) => [
        path,
        Object.fromEntries(
          Object.entries(rules).filter(([id]) => !excluded.has(id)),
        ),
      ]),
    ),
  };
}

export function moveBaseline(
  baseline: Baseline,
  old: string,
  next: string,
): Baseline {
  if (!baseline.files[old] || baseline.files[next]) {
    throw new Error(
      'Baseline move requires an existing source and an empty destination',
    );
  }
  const files = { ...baseline.files, [next]: baseline.files[old] };
  delete files[old];
  return { ...baseline, files };
}

export function moveBaselineForChanges(
  dashboard: string,
  baseline: Baseline,
  diff: Changes | undefined,
  old: string,
  next: string,
  scope: Manifest['scope'],
): Baseline {
  if (
    !old.startsWith('src/') ||
    !next.startsWith('src/') ||
    existsSync(join(dashboard, old)) ||
    !existsSync(join(dashboard, next)) ||
    !inScope(join(dashboard, next), scope)
  ) {
    throw new Error(
      'Baseline move requires a removed source and an existing in-scope destination',
    );
  }
  // An undetected rename is a deletion to Git. Retain its source entry until
  // the explicit move has consumed it, but still honor other detected renames.
  return moveBaseline(
    diff ? remap(baseline, { ...diff, deleted: new Set() }) : baseline,
    old,
    next,
  );
}

export function applyBaseline(
  report: Report,
  baseline: Baseline | undefined,
  seededRules: string[] = [],
  knownPaths: ReadonlySet<string> = new Set(
    report.files.map((file) => file.path),
  ),
): Report {
  if (!baseline) {
    return report;
  }
  const used: Record<string, number> = {};
  let baselined = 0;
  const files = report.files.map((file) => ({
    ...file,
    findings: file.findings.map((finding) => ({ ...finding })),
  }));
  for (const file of files) {
    for (const finding of file.findings) {
      if (finding.status === 'suppressed') {
        continue;
      }
      const key = JSON.stringify([file.path, finding.ruleId, finding.subject]);
      const count =
        baseline.files[file.path]?.[finding.ruleId]?.[finding.subject] ?? 0;
      const next = (used[key] ?? 0) + 1;
      used[key] = next;
      if (next <= count) {
        finding.status = 'baselined';
        baselined++;
      }
    }
  }
  let slack = 0;
  for (const [path, rules] of Object.entries(baseline.files)) {
    if (!report.files.some((file) => file.path === path)) {
      continue;
    }
    for (const [id, subjects] of Object.entries(rules)) {
      for (const [subject, count] of Object.entries(subjects)) {
        slack +=
          count -
          Math.min(count, used[JSON.stringify([path, id, subject])] ?? 0);
      }
    }
  }
  const summary: Report['baseline'] = {
    exists: true,
    baselined,
    new: files
      .flatMap((file) => file.findings)
      .filter((finding) => finding.status === 'new').length,
    slack,
    stalePaths: Object.keys(baseline.files)
      .filter((path) => !knownPaths.has(path))
      .sort(compare),
    seededRules,
  };
  return { ...report, files, baseline: summary };
}

function currentCounts(findings: readonly Finding[]): Baseline['files'] {
  const files: Baseline['files'] = {};
  for (const finding of findings) {
    if (finding.status === 'suppressed') {
      continue;
    }
    files[finding.path] ??= {};
    files[finding.path][finding.ruleId] ??= {};
    const subjects = files[finding.path][finding.ruleId];
    subjects[finding.subject] = (subjects[finding.subject] ?? 0) + 1;
  }
  return files;
}

export function updateBaseline(
  existing: Baseline | undefined,
  findings: readonly Finding[],
  rules: Baseline['rules'],
  seeds: readonly string[],
  activePaths: ReadonlySet<string> = new Set(),
): { baseline: Baseline; reseeded: string[] } {
  const requested = new Set(seeds);
  const reseeded: string[] = [];
  for (const id of requested) {
    if (!rules[id]) {
      throw new Error(`Unknown baseline rule: ${id}`);
    }
    const before = existing?.rules[id];
    if (
      before &&
      before.version >= rules[id].version &&
      before.vocabularyHash === rules[id].vocabularyHash
    ) {
      throw new Error(`Cannot re-seed unchanged rule: ${id}`);
    }
    if (before && before.vocabularyHash !== rules[id].vocabularyHash) {
      reseeded.push(`${id}: vocabulary change`);
    }
  }
  const current = currentCounts(findings);
  const files: Baseline['files'] = {};
  for (const [path, fileRules] of Object.entries(existing?.files ?? {})) {
    for (const [id, subjects] of Object.entries(fileRules)) {
      if (requested.has(id) || !rules[id]) {
        continue;
      }
      for (const [subject, count] of Object.entries(subjects)) {
        const value =
          activePaths.size && !activePaths.has(path)
            ? count
            : Math.min(count, current[path]?.[id]?.[subject] ?? 0);
        if (value) {
          files[path] ??= {};
          files[path][id] ??= {};
          files[path][id][subject] = value;
        }
      }
    }
  }
  for (const [path, fileRules] of Object.entries(current)) {
    for (const id of requested) {
      if (fileRules[id]) {
        files[path] ??= {};
        files[path][id] = fileRules[id];
      }
    }
  }
  return {
    baseline: {
      schemaVersion: 1,
      rules: {
        ...Object.fromEntries(
          Object.entries(existing?.rules ?? {}).filter(([id]) => !!rules[id]),
        ),
        ...Object.fromEntries([...requested].map((id) => [id, rules[id]])),
      },
      files,
    },
    reseeded,
  };
}

export async function writeBaseline(
  dashboard: string,
  baseline: Baseline,
): Promise<void> {
  // Sorting object insertion order is deterministic for ordinary keys. JS places
  // integer-like keys first regardless of insertion order; JSON key order is not semantic.
  const ordered: Baseline = {
    files: Object.fromEntries(
      Object.entries(baseline.files)
        .sort(([a], [b]) => compare(a, b))
        .map(([path, rules]) => [
          path,
          Object.fromEntries(
            Object.entries(rules)
              .sort(([a], [b]) => compare(a, b))
              .map(([id, subjects]) => [
                id,
                Object.fromEntries(
                  Object.entries(subjects).sort(([a], [b]) => compare(a, b)),
                ),
              ]),
          ),
        ]),
    ),
    rules: Object.fromEntries(
      Object.entries(baseline.rules).sort(([a], [b]) => compare(a, b)),
    ),
    schemaVersion: 1,
  };
  // Use the pinned Biome executable's formatter rather than a second formatting implementation.
  const content = `${JSON.stringify(ordered, null, 2)}\n`;
  const formatted = spawnSync(
    'biome',
    ['format', '--stdin-file-path=design-doctor/baseline.json'],
    {
      cwd: dashboard,
      input: content,
      encoding: 'utf8',
    },
  );
  if (formatted.status !== 0 || formatted.error) {
    throw new Error(
      `Cannot format baseline: ${formatted.stderr || formatted.error}`,
    );
  }
  await writeFile(join(dashboard, location), formatted.stdout);
}

export function baselineChanges(
  dashboard: string,
  base?: string,
): { reference?: Baseline; diff?: Changes } {
  const root = join(dashboard, '..');
  const reference = baselineReference(root, base);
  return {
    reference: baselineAt(root, reference),
    diff: reference ? changes(root, reference) : undefined,
  };
}
