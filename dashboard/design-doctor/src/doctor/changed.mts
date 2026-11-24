import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Report } from '../contracts/report.mts';
import type { Manifest } from '../grit/manifest.mts';
import { inScope } from '../grit/manifest.mts';
import { type Baseline, remap } from './baseline.mts';
import { changes, git, mergeBase } from './git.mts';
import { suppressFindings } from './suppress.mts';

export function changedFiles(
  dashboard: string,
  base: string,
  scope: Manifest['scope'],
): { paths: string[]; reference: string; diff: ReturnType<typeof changes> } {
  const root = join(dashboard, '..');
  const reference = mergeBase(root, base);
  const diff = changes(root, reference);
  return {
    reference,
    diff,
    paths: diff.paths.filter(
      (path) =>
        existsSync(join(dashboard, path)) &&
        inScope(join(dashboard, path), scope),
    ),
  };
}

export function branchBaseline(
  reference: Baseline | undefined,
  head: Baseline | undefined,
  diff: ReturnType<typeof changes>,
): { baseline: Baseline | undefined; seeded: string[]; growth: string[] } {
  if (!head) {
    return {
      baseline: reference && remap(reference, diff),
      seeded: [],
      growth: [],
    };
  }
  const old = reference && remap(reference, diff);
  const seeded = Object.keys(head.rules).filter(
    (id) =>
      !reference?.rules[id] ||
      reference.rules[id].version !== head.rules[id].version ||
      reference.rules[id].vocabularyHash !== head.rules[id].vocabularyHash,
  );
  const invalidSeeds = Object.keys(head.files).flatMap((path) =>
    Object.keys(head.files[path])
      .filter((id) => !seeded.includes(id) && !old?.rules[id])
      .map((id) => `${path}:${id}`),
  );
  const growth = [
    ...invalidSeeds,
    ...seeded
      .filter(
        (id) =>
          reference?.rules[id] &&
          head.rules[id].version <= reference.rules[id].version &&
          head.rules[id].vocabularyHash === reference.rules[id].vocabularyHash,
      )
      .map((id) => `invalid re-seed: ${id}`),
  ];
  const files: Baseline['files'] = Object.fromEntries(
    Object.entries(old?.files ?? {}).map(([path, rules]) => [
      path,
      Object.fromEntries(
        Object.entries(rules).filter(([id]) => !seeded.includes(id)),
      ),
    ]),
  );
  // A rewrite can defeat Git's rename detection. Destinations without a mapped
  // reference baseline can claim counts freed by deleted reference paths;
  // allocate that allowance once per rule/subject across all destinations.
  const freed: Record<string, number> = {};
  for (const path of diff.deleted) {
    for (const [id, subjects] of Object.entries(reference?.files[path] ?? {})) {
      for (const [subject, count] of Object.entries(subjects)) {
        const key = JSON.stringify([id, subject]);
        freed[key] = (freed[key] ?? 0) + count;
      }
    }
  }
  for (const [path, rules] of Object.entries(head.files).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    for (const [id, subjects] of Object.entries(rules)) {
      if (seeded.includes(id)) {
        files[path] ??= {};
        files[path][id] = subjects;
        continue;
      }
      for (const [subject, count] of Object.entries(subjects)) {
        const previous = old?.files[path]?.[id]?.[subject] ?? 0;
        let allowed = previous;
        if (!old?.files[path]) {
          const key = JSON.stringify([id, subject]);
          const carried = Math.min(count, freed[key] ?? 0);
          freed[key] = (freed[key] ?? 0) - carried;
          allowed = carried;
          if (carried) {
            files[path] ??= {};
            files[path][id] ??= {};
            files[path][id][subject] = carried;
          }
        }
        if (count > allowed) {
          growth.push(`${path}:${id}:${subject}`);
        }
      }
    }
  }
  return {
    baseline: { schemaVersion: 1, rules: head.rules, files },
    seeded,
    growth,
  };
}

export function markAddedSuppressions(
  dashboard: string,
  report: Report,
  reference: string,
  diff: ReturnType<typeof changes>,
  ruleIds: ReadonlySet<string>,
): void {
  const reverse = new Map([...diff.renames].map(([old, path]) => [path, old]));
  for (const path of new Set(report.suppressions.map((entry) => entry.path))) {
    const oldPath = reverse.get(path) ?? path;
    const root = join(dashboard, '..');
    const exists = git(root, [
      'ls-tree',
      '--name-only',
      reference,
      '--',
      `dashboard/${oldPath}`,
    ]).trim();
    const oldText = exists
      ? git(root, ['show', `${reference}:dashboard/${oldPath}`])
      : '';
    const old = suppressFindings([], new Map([[path, oldText]]), ruleIds);
    const counts = new Map<string, number>();
    const key = (entry: Report['suppressions'][number]) =>
      JSON.stringify([entry.ruleId, entry.reason ?? '']);
    for (const entry of old) {
      const id = key(entry);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const entry of report.suppressions.filter(
      (item) => item.path === path,
    )) {
      const id = key(entry);
      const remaining = counts.get(id) ?? 0;
      entry.addedInPr = remaining === 0;
      counts.set(id, Math.max(0, remaining - 1));
    }
  }
}

export function checkReport(
  report: Report,
  growth: readonly string[] = [],
): boolean {
  return (
    report.baseline.new === 0 &&
    report.coverage.status === 'complete' &&
    !report.suppressions.some((item) => item.state === 'invalid') &&
    growth.length === 0
  );
}
