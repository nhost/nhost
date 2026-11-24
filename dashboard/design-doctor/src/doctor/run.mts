import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMessage } from '../biome/parse.mts';
import { type BiomeResult, runBiomeWithInventory } from '../biome/runner.mts';
import { indexSchema } from '../contracts/index.mts';
import {
  type Finding,
  type Report,
  reportSchema,
} from '../contracts/report.mts';
import { type Tokens, tokensSchema } from '../contracts/tokens.mts';
import { loadManifest, type Manifest } from '../grit/manifest.mts';
import { unknownVocabulary } from '../grit/rules/no-unknown-classes.mts';
import { suggestArbitraryValue } from '../theme/arbitrary-suggest.mts';
import { loadTheme } from '../theme/load.mts';
import { suggestUnknownClass } from '../theme/similar.mts';
import { suggestRawColor } from '../theme/suggest.mts';
import { inputHashes, stale } from '../tokens/inputs.mts';
import {
  applyBaseline,
  baselineAt,
  baselineChanges,
  compatibleBaseline,
  moveBaselineForChanges,
  readBaseline,
  remap,
  ruleHashes,
  staleRules,
  updateBaseline,
  writeBaseline,
} from './baseline.mts';
import {
  branchBaseline,
  changedFiles,
  checkReport,
  markAddedSuppressions,
} from './changed.mts';
import { coverage, scopeFiles } from './coverage.mts';
import { score } from './score.mts';
import { suppressFindings, suppressionSources } from './suppress.mts';

const dashboardRoot = fileURLToPath(new URL('../../..', import.meta.url));

export function reportFromBiome(
  manifest: Manifest,
  result: BiomeResult,
  scope: {
    expected: string[];
    ignored: string[];
    vcsIgnored: 'known' | 'unknown';
  },
  processed: readonly string[],
  generated: Report['generated'],
  biomeVersion: Report['biomeVersion'],
  sources: ReadonlyMap<string, string> = new Map(),
  tokens?: Tokens,
  knownClasses: readonly string[] = [],
  knownVariants: readonly string[] = [],
): Report {
  const ids = new Set(manifest.rules.map((rule) => rule.id));
  const expected = new Set(scope.expected);
  const findings: Finding[] = [];
  const suggestions = new Map<string, string | null>();
  for (const diagnostic of result.diagnostics) {
    const message = parseMessage(diagnostic.message);
    if (!message || diagnostic.category !== 'plugin') {
      continue;
    }
    if (!ids.has(message.ruleId)) {
      throw new Error(`Unknown design rule: ${message.ruleId}`);
    }
    const { path, start, end } = diagnostic.location;
    if (!expected.has(path) || diagnostic.severity !== 'warning') {
      throw new Error(
        `Design diagnostic outside expected scope or not a warning: ${path}`,
      );
    }
    for (const { subject, guidance } of message.subjects) {
      if (
        tokens &&
        (message.ruleId === 'no-raw-colors' ||
          message.ruleId === 'no-arbitrary-values' ||
          message.ruleId === 'no-unknown-classes') &&
        !suggestions.has(`${message.ruleId}:${subject}`)
      ) {
        suggestions.set(
          `${message.ruleId}:${subject}`,
          message.ruleId === 'no-raw-colors'
            ? suggestRawColor(subject, tokens)
            : message.ruleId === 'no-arbitrary-values'
              ? suggestArbitraryValue(subject, tokens)
              : suggestUnknownClass(subject, knownClasses, knownVariants),
        );
      }
      const suggestion = suggestions.get(`${message.ruleId}:${subject}`);
      findings.push({
        ruleId: message.ruleId,
        path,
        start,
        end,
        subject,
        guidance: suggestion ? `${guidance} ${suggestion}` : guidance,
        docs: message.docs,
        status: 'new',
      });
    }
  }
  findings.sort(
    (a, b) =>
      a.path.localeCompare(b.path) ||
      a.start.line - b.start.line ||
      a.start.column - b.start.column ||
      a.ruleId.localeCompare(b.ruleId),
  );
  // A `check` diagnostic means Biome inventoried but did not analyze the file
  // (for example, a generated file that exceeds files.maxSize).
  const omitted = new Set(
    result.diagnostics
      .filter((entry) => entry.category === 'check')
      .map((entry) => entry.location?.path),
  );
  const analyzed = processed.filter((path) => !omitted.has(path));
  const measured = coverage(scope, analyzed, result.diagnostics);
  const suppressions = suppressFindings(findings, sources, ids);
  const scored = score(
    scope.expected,
    measured.processed,
    findings,
    manifest.rules,
  );
  return reportSchema.parse({
    schemaVersion: 1,
    status: measured.status,
    ...scored,
    suppressions,
    coverage: measured,
    generated,
    biomeVersion,
    baseline: {
      exists: false,
      baselined: 0,
      new: findings.filter((finding) => finding.status !== 'suppressed').length,
      slack: 0,
      stalePaths: [],
      seededRules: [],
    },
  });
}

export function reportWarnings(report: Report): string[] {
  const warnings: string[] = [];
  if (report.biomeVersion.mismatch) {
    warnings.push(
      `Biome version mismatch: expected ${report.biomeVersion.expected}, installed ${report.biomeVersion.actual}`,
    );
  }
  if (report.generated.stale) {
    warnings.push(
      `Generated inputs changed: ${report.generated.changedInputs.join(', ')}. Run pnpm design-doctor generate.`,
    );
  }
  if (report.coverage.vcsIgnored === 'unknown') {
    warnings.push('Git unavailable; VCS-ignored files are unknown.');
  }
  if (report.coverage.status === 'incomplete') {
    warnings.push(
      `Coverage incomplete: ${report.coverage.skipped.length} skipped files.`,
    );
  }
  return warnings;
}

export function baselineRuleWarnings(
  mismatched: readonly string[],
  rules: Readonly<Record<string, { version: number; vocabularyHash: string }>>,
): string[] {
  const removed = mismatched.filter((id) => !rules[id]);
  const unseeded = mismatched.filter((id) => !!rules[id]);
  return [
    ...(unseeded.length
      ? [
          `Baseline rule vocabulary/version changed; re-seed: ${unseeded.join(', ')}`,
        ]
      : []),
    ...(removed.length
      ? [
          `Baseline rules removed from manifest; run pnpm design-doctor baseline update: ${removed.join(', ')}`,
        ]
      : []),
  ];
}

export interface DoctorOptions {
  changed?: boolean;
  base?: string;
  update?: boolean;
  seeds?: string[];
  move?: [string, string];
  check?: boolean;
}

export async function runDoctor(
  root = dashboardRoot,
  options: DoctorOptions = {},
): Promise<{ report: Report; warnings: string[]; failed: boolean }> {
  const dashboard = resolve(root);
  const manifest = await loadManifest();
  const branch = options.base
    ? changedFiles(dashboard, options.base, manifest.scope)
    : undefined;
  const [fullScope, index, inputs, tokens] = await Promise.all([
    scopeFiles(dashboard, manifest.scope),
    readFile(
      join(dashboard, 'design-doctor/generated/index.json'),
      'utf8',
    ).then((text) => indexSchema.parse(JSON.parse(text))),
    inputHashes(dashboard).catch((error: unknown) => {
      throw new Error(
        'Cannot check generated inputs; no staleness report was produced (tool error).',
        { cause: error },
      );
    }),
    readFile(join(dashboard, 'design-doctor/generated/tokens.json'), 'utf8')
      .then((text) => tokensSchema.parse(JSON.parse(text)))
      .catch((error: unknown) => {
        throw new Error(
          'Cannot read generated tokens.json; run pnpm design-doctor generate.',
          {
            cause: error,
          },
        );
      }),
  ]);
  const selected = options.changed ? (branch?.paths ?? []) : fullScope.expected;
  const scope = options.changed
    ? {
        ...fullScope,
        expected: fullScope.expected.filter((path) => selected.includes(path)),
        ignored: [],
      }
    : fullScope;
  const { result: biome, processed } = await runBiomeWithInventory(
    dashboard,
    options.changed ? scope.expected : undefined,
  );
  const actual = execFileSync('biome', ['--version'], {
    cwd: dashboard,
    encoding: 'utf8',
  })
    .trim()
    .replace(/^Version:\s*/, '');
  const biomeVersion = {
    expected: manifest.biomeVersion,
    actual,
    mismatch: actual !== manifest.biomeVersion,
  };
  const generated = stale(index, inputs);
  const sources = await suppressionSources(dashboard, scope.expected);
  const unknown = biome.diagnostics.some(({ message }) =>
    message.includes('[design/no-unknown-classes]'),
  )
    ? unknownVocabulary(loadTheme(dashboard).resolved, dashboard)
    : undefined;
  let report = reportFromBiome(
    manifest,
    biome,
    scope,
    processed,
    generated,
    biomeVersion,
    sources,
    tokens,
    unknown?.classes,
    unknown?.variants.map(({ name }) => name),
  );
  const head = await readBaseline(dashboard);
  const { reference, diff } = branch
    ? {
        reference: baselineAt(join(dashboard, '..'), branch.reference),
        diff: branch.diff,
      }
    : baselineChanges(dashboard);
  const mapped = head && diff ? remap(head, diff) : head;
  if (options.move) {
    if (!head) {
      throw new Error('No baseline to move');
    }
    const [old, next] = options.move;
    const moved = moveBaselineForChanges(
      dashboard,
      head,
      diff,
      old,
      next,
      manifest.scope,
    );
    await writeBaseline(dashboard, moved);
    report = applyBaseline(report, moved);
    return { report, warnings: reportWarnings(report), failed: false };
  }
  const rulesJson = JSON.parse(
    await readFile(
      join(dashboard, 'design-doctor/generated/rules.json'),
      'utf8',
    ),
  ) as { rules: { id: string; vocabularyHash: string }[] };
  const rules = ruleHashes(
    manifest,
    Object.fromEntries(
      rulesJson.rules.map(({ id, vocabularyHash }) => [id, vocabularyHash]),
    ),
  );
  const mismatched = staleRules(mapped, rules);
  if (options.update) {
    const removed = mismatched.filter((id) => !rules[id]);
    const unseeded = mismatched.filter(
      (id) => !!rules[id] && !options.seeds?.includes(id),
    );
    if (unseeded.length) {
      throw new Error(
        `Baseline rule vocabulary/version changed; re-seed: ${unseeded.join(', ')}`,
      );
    }
    if (report.coverage.status === 'incomplete') {
      throw new Error('Cannot update baseline with incomplete coverage');
    }
    const { baseline, reseeded } = updateBaseline(
      mapped,
      report.files.flatMap(({ findings }) => findings),
      rules,
      options.seeds ?? [],
      new Set(scope.expected),
    );
    await writeBaseline(dashboard, baseline);
    report = applyBaseline(report, baseline);
    return {
      report,
      warnings: [
        ...reportWarnings(report),
        ...reseeded.map((entry) => `Re-seeded: ${entry}`),
        ...(removed.length
          ? [
              `Removed baseline rules no longer in manifest: ${removed.join(', ')}`,
            ]
          : []),
      ],
      failed: false,
    };
  }
  const branchState = branch
    ? branchBaseline(reference, mapped, branch.diff)
    : undefined;
  report = applyBaseline(
    report,
    compatibleBaseline(branchState?.baseline ?? mapped, mismatched),
    branchState?.seeded,
    new Set(fullScope.expected),
  );
  if (branch && options.changed) {
    markAddedSuppressions(
      dashboard,
      report,
      branch.reference,
      branch.diff,
      new Set(manifest.rules.map(({ id }) => id)),
    );
  }
  const warnings = reportWarnings(report);
  warnings.push(...baselineRuleWarnings(mismatched, rules));
  const added = report.suppressions.filter((entry) => entry.addedInPr);
  if (added.length) {
    warnings.push(
      `Suppressions added in this PR: ${added.map(({ path, start, ruleId }) => `${path}:${start.line} ${ruleId}`).join(', ')}`,
    );
  }
  if (report.suppressions.some((entry) => entry.state === 'unused')) {
    warnings.push('Unused design-doctor suppressions remain.');
  }
  if (branchState?.growth.length) {
    warnings.push(
      `Baseline growth or invalid re-seed: ${branchState.growth.join(', ')}`,
    );
  }
  if (report.baseline.slack) {
    warnings.push(
      `Baseline slack: ${report.baseline.slack} findings; run pnpm design-doctor baseline update.`,
    );
  }
  if (branchState?.seeded.length) {
    warnings.push(`Seeded in this PR: ${branchState.seeded.join(', ')}`);
  }
  const failed = Boolean(
    options.check &&
      (!checkReport(report, branchState?.growth) || mismatched.length > 0),
  );
  return { report, warnings, failed };
}
