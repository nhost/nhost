import { spawnSync } from 'node:child_process';
import {
  appendFile,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  applyBaseline,
  baselineAt,
  compatibleBaseline,
  moveBaseline,
  moveBaselineForChanges,
  readBaseline,
  remap,
  staleRules,
  updateBaseline,
  writeBaseline,
} from '../src/doctor/baseline.mts';
import {
  branchBaseline,
  changedFiles,
  checkReport,
  markAddedSuppressions,
} from '../src/doctor/changed.mts';
import { coverage, scopeFiles } from '../src/doctor/coverage.mts';
import { baselineReference, changes, git } from '../src/doctor/git.mts';
import { baselineRuleWarnings, reportFromBiome } from '../src/doctor/run.mts';
import { loadManifest } from '../src/grit/manifest.mts';

Object.assign(process.env, {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.invalid',
});
const env = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.invalid',
};
function command(root: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd: root, env, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr);
  }
  return result.stdout.trim();
}

const path = 'src/features/sample.tsx';
const generated = { stale: false, changedInputs: [] };
const biomeVersion = { expected: '2.5.11', actual: '2.5.11', mismatch: false };

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'design-doctor-baseline-'));
  const dashboard = join(root, 'dashboard');
  await copyFile(
    new URL('../../../biome.json', import.meta.url),
    join(root, 'biome.json'),
  );
  await mkdir(join(dashboard, 'src/features'), { recursive: true });
  await mkdir(join(dashboard, 'design-doctor'), { recursive: true });
  command(root, 'init', '-q');
  await writeFile(join(dashboard, path), '<button />\n');
  command(root, 'add', '.');
  command(root, 'commit', '-qm', 'base');
  return { root, dashboard, base: command(root, 'rev-parse', 'HEAD') };
}

async function sample(line = 1, count = 1, suppressed = false) {
  const manifest = await loadManifest();
  const rule = manifest.rules.find(
    ({ id }) => id === 'no-reinvented-components',
  );
  if (!rule) {
    throw new Error('Missing test rule');
  }
  const report = reportFromBiome(
    manifest,
    {
      diagnostics: Array.from({ length: count }, (_, index) => ({
        category: 'plugin',
        severity: 'warning',
        message: `[design/${rule.id}] "button" Use Button. Docs: ${rule.docs}`,
        location: {
          path,
          start: { line: line + index, column: 1 },
          end: { line: line + index, column: 7 },
        },
      })),
      summary: { errors: 0, warnings: count, diagnosticsNotPrinted: 0 },
      exitCode: 0,
    },
    { expected: [path], ignored: [], vcsIgnored: 'known' },
    [path],
    generated,
    biomeVersion,
  );
  if (suppressed) {
    report.files[0].findings[0].status = 'suppressed';
  }
  return report;
}

it('keys baseline by subject rather than line; shrinks slack and counts one added violation', async () => {
  const first = await sample();
  const rules = {
    'no-reinvented-components': { version: 1, vocabularyHash: 'a' },
  };
  const seeded = updateBaseline(undefined, first.files[0].findings, rules, [
    'no-reinvented-components',
  ]).baseline;
  expect(applyBaseline(await sample(20), seeded).baseline).toMatchObject({
    new: 0,
    baselined: 1,
  });
  const removed = applyBaseline(await sample(20, 0), seeded);
  expect(removed.baseline.slack).toBe(1);
  expect(
    updateBaseline(seeded, removed.files[0].findings, rules, []).baseline.files,
  ).toEqual({});
  expect(applyBaseline(await sample(20, 2), seeded).baseline.new).toBe(1);
  expect(applyBaseline(await sample(20, 1, true), seeded).baseline.slack).toBe(
    1,
  );
  expect(() =>
    updateBaseline(seeded, first.files[0].findings, rules, [
      'no-reinvented-components',
    ]),
  ).toThrow('unchanged rule');
  expect(
    updateBaseline(
      seeded,
      first.files[0].findings,
      { 'no-reinvented-components': { version: 1, vocabularyHash: 'b' } },
      ['no-reinvented-components'],
    ).reseeded,
  ).toEqual(['no-reinvented-components: vocabulary change']);
  expect(
    updateBaseline(seeded, [], rules, [], new Set(['src/elsewhere.ts']))
      .baseline.files,
  ).toEqual(seeded.files);
  const changedRules = {
    'no-reinvented-components': { version: 1, vocabularyHash: 'b' },
  };
  expect(staleRules(seeded, changedRules)).toEqual([
    'no-reinvented-components',
  ]);
  expect(
    applyBaseline(
      await sample(),
      compatibleBaseline(seeded, staleRules(seeded, changedRules)),
    ).baseline.new,
  ).toBe(1);
});

it('tracks detected renames, manual moves, untracked files and seed-in-PR growth', async () => {
  const { root, dashboard, base } = await fixture();
  try {
    const baseline = updateBaseline(
      undefined,
      (await sample()).files[0].findings,
      { 'no-reinvented-components': { version: 1, vocabularyHash: 'a' } },
      ['no-reinvented-components'],
    ).baseline;
    await writeBaseline(dashboard, baseline);
    command(root, 'add', '.');
    command(root, 'commit', '-qm', 'baseline');
    const reference = command(root, 'rev-parse', 'HEAD');
    await rename(
      join(dashboard, path),
      join(dashboard, 'src/features/renamed.tsx'),
    );
    await writeFile(join(dashboard, 'src/features/new.tsx'), '<a />\n');
    const changed = changes(root, reference);
    expect(changed.paths).toContain('src/features/new.tsx');
    expect(changed.paths).toContain('src/features/renamed.tsx');
    expect(changed.renames.get(path)).toBe('src/features/renamed.tsx');
    const moved = remap(baseline, changed);
    expect(moved.files['src/features/renamed.tsx']).toEqual(
      baseline.files[path],
    );
    expect(moved.files[path]).toBeUndefined();
    expect(
      changedFiles(dashboard, base, (await loadManifest()).scope).paths,
    ).toContain('src/features/new.tsx');
    expect(baselineAt(root, reference)).toEqual(baseline);
    const manual = remap(baseline, {
      paths: [],
      renames: new Map([[path, 'src/features/undetected.tsx']]),
      deleted: new Set(),
    });
    expect(manual.files['src/features/undetected.tsx']).toEqual(
      baseline.files[path],
    );
    expect(
      moveBaseline(baseline, path, 'src/features/undetected.tsx').files[
        'src/features/undetected.tsx'
      ],
    ).toEqual(baseline.files[path]);
    expect(() => moveBaseline(baseline, path, path)).toThrow(
      'empty destination',
    );
    const grown = {
      ...baseline,
      files: {
        ...baseline.files,
        'src/features/new.tsx': baseline.files[path],
      },
    };
    expect(
      branchBaseline(baseline, remap(grown, changed), changed).growth,
    ).toHaveLength(1);
    const seeded = branchBaseline(undefined, grown, changed);
    expect(seeded.seeded).toEqual(['no-reinvented-components']);
    expect(seeded.baseline?.files['src/features/new.tsx']).toEqual(
      baseline.files[path],
    );
    expect(git(root, ['rev-parse', 'HEAD']).trim()).toBe(reference);
    const report = await sample();
    report.suppressions.push({
      path: 'src/features/renamed.tsx',
      ruleId: 'no-reinvented-components',
      start: { line: 1, column: 1 },
      reason: 'reviewed',
      state: 'unused',
      count: 0,
    });
    markAddedSuppressions(
      dashboard,
      report,
      reference,
      changed,
      new Set(['no-reinvented-components']),
    );
    expect(report.suppressions[0].addedInPr).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it.each(['committed', 'unstaged'])(
  'explicit move carries an undetected %s rewrite through full and branch checks',
  async (mode) => {
    const { root, dashboard } = await fixture();
    try {
      const rules = {
        'no-reinvented-components': { version: 1, vocabularyHash: 'a' },
      };
      const baseline = updateBaseline(
        undefined,
        (await sample()).files[0].findings,
        rules,
        ['no-reinvented-components'],
      ).baseline;
      await writeBaseline(dashboard, baseline);
      command(root, 'add', '.');
      command(root, 'commit', '-qm', 'baseline');
      const reference = command(root, 'rev-parse', 'HEAD');
      const next = 'src/features/rewritten.tsx';
      command(root, 'mv', `dashboard/${path}`, `dashboard/${next}`);
      await appendFile(
        join(dashboard, next),
        `${'// changed substantially\n'.repeat(200)}`,
      );
      if (mode === 'committed') {
        command(root, 'add', '.');
        command(root, 'commit', '-qm', 'rewrite');
      }
      // Untracked files should not prevent detection of the delete, nor the move.
      await writeFile(join(dashboard, 'src/features/other.tsx'), '<a />\n');
      const diff = changes(root, reference);
      expect(diff.deleted.has(path)).toBe(true);
      expect(diff.renames.has(path)).toBe(false);
      const scope = (await loadManifest()).scope;
      const moved = moveBaselineForChanges(
        dashboard,
        baseline,
        diff,
        path,
        next,
        scope,
      );
      expect(moved.files[next]).toEqual(baseline.files[path]);
      expect(() =>
        moveBaselineForChanges(dashboard, baseline, diff, path, path, scope),
      ).toThrow('removed source');
      expect(() =>
        moveBaselineForChanges(
          dashboard,
          baseline,
          diff,
          path,
          'src/features/missing.tsx',
          scope,
        ),
      ).toThrow('existing in-scope destination');
      await writeBaseline(dashboard, moved);
      const loaded = await readBaseline(dashboard);
      expect(loaded).toEqual(moved);
      const finding = await sample(201);
      finding.files[0].path = next;
      finding.files[0].findings[0].path = next;
      const full = applyBaseline(finding, loaded);
      expect(full.baseline).toMatchObject({ new: 0, baselined: 1 });
      expect(checkReport(full)).toBe(true);
      const branch = branchBaseline(baseline, remap(moved, diff), diff);
      expect(branch.growth).toEqual([]);
      expect(applyBaseline(finding, branch.baseline).baseline).toMatchObject({
        new: 0,
        baselined: 1,
      });
      const doubled = {
        ...moved,
        files: {
          ...moved.files,
          [next]: {
            'no-reinvented-components': { button: 2 },
          },
        },
      };
      const excess = branchBaseline(baseline, doubled, diff);
      expect(excess.growth).toEqual([
        `${next}:no-reinvented-components:button`,
      ]);
      expect(excess.baseline?.files[next]).toEqual(baseline.files[path]);
      expect(
        checkReport(applyBaseline(finding, excess.baseline), excess.growth),
      ).toBe(false);
      const duplicate = branchBaseline(
        baseline,
        {
          ...moved,
          files: {
            ...moved.files,
            'src/features/other.tsx': baseline.files[path],
          },
        },
        diff,
      );
      expect(duplicate.growth).toEqual([
        'src/features/rewritten.tsx:no-reinvented-components:button',
      ]);
      expect(duplicate.baseline?.files['src/features/other.tsx']).toEqual(
        baseline.files[path],
      );
      expect(duplicate.baseline?.files[next]).toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);

it('drops removed rules on update and serializes the committed baseline without changes', async () => {
  const { root, dashboard } = await fixture();
  try {
    const original = await readFile(
      new URL('../baseline.json', import.meta.url),
      'utf8',
    );
    await writeBaseline(dashboard, JSON.parse(original));
    expect(
      await readFile(join(dashboard, 'design-doctor/baseline.json'), 'utf8'),
    ).toBe(original);
    const existing = {
      schemaVersion: 1 as const,
      rules: {
        removed: { version: 1, vocabularyHash: 'a' },
        retained: { version: 1, vocabularyHash: 'b' },
      },
      files: {
        [path]: { removed: { a: 1 }, retained: { b: 1 } },
      },
    };
    const active = { retained: existing.rules.retained };
    expect(staleRules(existing, active)).toEqual(['removed']);
    expect(
      baselineRuleWarnings(['removed', 'retained'], {
        retained: { version: 2, vocabularyHash: 'new' },
      }),
    ).toEqual([
      'Baseline rule vocabulary/version changed; re-seed: retained',
      'Baseline rules removed from manifest; run pnpm design-doctor baseline update: removed',
    ]);
    const result = updateBaseline(
      existing,
      [],
      active,
      [],
      new Set(['src/other.tsx']),
    );
    expect(result.baseline.rules).toEqual(active);
    expect(result.baseline.files[path]).toEqual({ retained: { b: 1 } });
    expect(() => updateBaseline(existing, [], active, ['removed'])).toThrow(
      'Unknown baseline rule',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('honors the caller git configuration while temp git repos isolate it', async () => {
  const { root } = await fixture();
  const previous = process.env.GIT_CONFIG_GLOBAL;
  try {
    const config = join(root, 'global.gitconfig');
    await writeFile(config, '[design-doctor]\n\tmarker = visible\n');
    process.env.GIT_CONFIG_GLOBAL = config;
    expect(
      git(root, ['config', '--global', 'design-doctor.marker']).trim(),
    ).toBe('visible');
  } finally {
    process.env.GIT_CONFIG_GLOBAL = previous;
    await rm(root, { recursive: true, force: true });
  }
});

it('resolves an SSH-signed baseline commit with log.showSignature enabled', async () => {
  const { root, dashboard } = await fixture();
  try {
    const key = join(root, 'signing-key');
    const generatedKey = spawnSync(
      'ssh-keygen',
      ['-q', '-t', 'ed25519', '-N', '', '-f', key],
      { cwd: root, env, encoding: 'utf8' },
    );
    if (generatedKey.error || generatedKey.status !== 0) {
      throw new Error(
        `Cannot generate signing key: ${generatedKey.stderr || generatedKey.error}`,
      );
    }
    command(root, 'config', '--local', 'gpg.format', 'ssh');
    command(root, 'config', '--local', 'user.signingkey', key);
    command(root, 'config', '--local', 'commit.gpgsign', 'true');
    command(root, 'config', '--local', 'log.showSignature', 'true');
    await writeBaseline(dashboard, {
      schemaVersion: 1,
      rules: {},
      files: {},
    });
    command(root, 'add', 'dashboard/design-doctor/baseline.json');
    command(root, 'commit', '-qm', 'signed baseline');
    const reference = command(root, 'rev-parse', 'HEAD');
    expect(
      git(root, [
        'log',
        '-1',
        '--format=%H',
        '--',
        'dashboard/design-doctor/baseline.json',
      ]).trim(),
    ).not.toBe(reference);
    expect(baselineReference(root)).toBe(reference);
    expect(baselineAt(root, baselineReference(root))).toEqual({
      schemaVersion: 1,
      rules: {},
      files: {},
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('excludes untracked ignored scratch files while listing tracked ignored sources', async () => {
  const { root, dashboard } = await fixture();
  try {
    await writeFile(join(dashboard, '.gitignore'), 'src/features/ignored*\n');
    await writeFile(
      join(dashboard, 'src/features/ignored-tracked.tsx'),
      'export {};\n',
    );
    command(root, 'add', '-f', 'dashboard/src/features/ignored-tracked.tsx');
    command(root, 'add', 'dashboard/.gitignore');
    command(root, 'commit', '-qm', 'tracked ignored');
    await writeFile(
      join(dashboard, 'src/features/ignored-untracked.tsx'),
      'export {};\n',
    );
    const files = await scopeFiles(dashboard, (await loadManifest()).scope);
    expect(files).toEqual({
      expected: [path],
      ignored: ['src/features/ignored-tracked.tsx'],
      vcsIgnored: 'known',
    });
    expect(coverage(files, files.expected, []).status).toBe('complete');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('identifies added suppressions across a renamed file', async () => {
  const { root, dashboard } = await fixture();
  try {
    await writeFile(
      join(dashboard, path),
      '// design-doctor-ignore no-reinvented-components: reviewed\n<button />\n',
    );
    command(root, 'add', '.');
    command(root, 'commit', '-qm', 'suppression');
    const reference = command(root, 'rev-parse', 'HEAD');
    await rename(
      join(dashboard, path),
      join(dashboard, 'src/features/renamed.tsx'),
    );
    const diff = changes(root, reference);
    const report = await sample();
    report.suppressions = ['reviewed', 'new reason'].map((reason) => ({
      path: 'src/features/renamed.tsx',
      ruleId: 'no-reinvented-components',
      reason,
      start: { line: 1, column: 1 },
      state: 'unused',
      count: 0,
    }));
    markAddedSuppressions(
      dashboard,
      report,
      reference,
      diff,
      new Set(['no-reinvented-components']),
    );
    expect(report.suppressions.map(({ addedInPr }) => addedInPr)).toEqual([
      false,
      true,
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('fails checks for growth, invalid suppression and incomplete coverage; skips Biome on empty paths', async () => {
  const report = await sample();
  expect(checkReport(report)).toBe(false);
  const clean = applyBaseline(
    report,
    updateBaseline(
      undefined,
      report.files[0].findings,
      { 'no-reinvented-components': { version: 1, vocabularyHash: 'a' } },
      ['no-reinvented-components'],
    ).baseline,
  );
  expect(checkReport(clean)).toBe(true);
  expect(checkReport(clean, ['growth'])).toBe(false);
  expect(
    checkReport({
      ...clean,
      coverage: { ...clean.coverage, status: 'incomplete' },
    }),
  ).toBe(false);
  expect(
    checkReport({
      ...clean,
      suppressions: [
        {
          path,
          ruleId: 'no-reinvented-components',
          start: { line: 1, column: 1 },
          state: 'invalid',
          count: 0,
        },
      ],
    }),
  ).toBe(false);
  const { runBiomeWithInventory } = await import('../src/biome/runner.mts');
  expect(
    await runBiomeWithInventory('/nonexistent-dashboard', []),
  ).toMatchObject({ processed: [], result: { diagnostics: [] } });
});
