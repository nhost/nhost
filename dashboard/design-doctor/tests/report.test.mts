import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseBiomeReport,
  parseProcessedFiles,
  runBiomeWithInventory,
} from '../src/biome/runner.mts';
import { type Finding, reportSchema } from '../src/contracts/report.mts';
import { coverage, scopeFiles } from '../src/doctor/coverage.mts';
import { formatMarkdown, formatText } from '../src/doctor/format.mts';
import { reportFromBiome, reportWarnings } from '../src/doctor/run.mts';
import { score } from '../src/doctor/score.mts';
import { loadManifest } from '../src/grit/manifest.mts';

const generated = { stale: false, changedInputs: [] };
const biomeVersion = { expected: '2.5.11', actual: '2.5.11', mismatch: false };

it('parses real Biome JSON and validates the reporter contract, excluding unrelated diagnostics', async () => {
  const raw = await readFile(
    new URL('./fixtures/report/real-biome.json', import.meta.url),
    'utf8',
  );
  const result = parseBiomeReport(raw, '', 0);
  expect(
    parseProcessedFiles(
      '  i Files processed:\n\n  - src/a.ts\n  - src/b.ts\n\n VERBOSE  ━━━\n',
    ),
  ).toEqual(['src/a.ts', 'src/b.ts']);
  expect(() => parseProcessedFiles('some other reporter')).toThrow(
    'inventory contract',
  );
  const manifest = await loadManifest();
  const paths = result.diagnostics
    .filter((entry) => entry.category === 'plugin')
    .map((entry) => entry.location.path);
  const report = reportFromBiome(
    manifest,
    result,
    { expected: paths, ignored: [], vcsIgnored: 'known' },
    paths,
    generated,
    biomeVersion,
  );
  expect(reportSchema.safeParse(report).success).toBe(true);
  expect(report.rules.map(({ count }) => count)).toEqual([1, 1, 0, 0, 0, 0, 0]);
  expect(report.files.flatMap(({ findings }) => findings)).toHaveLength(2);
  expect(report.baseline).toMatchObject({
    exists: false,
    baselined: 0,
    new: 2,
    slack: 0,
  });
  expect(report.suppressions).toEqual([]);
  const omitted = reportFromBiome(
    manifest,
    result,
    {
      expected: [...paths, 'src/omitted.ts'],
      ignored: [],
      vcsIgnored: 'known',
    },
    paths,
    generated,
    biomeVersion,
  );
  expect(omitted.coverage).toMatchObject({
    status: 'incomplete',
    skipped: [{ path: 'src/omitted.ts', reason: 'omitted' }],
  });
  expect(
    omitted.files.find(({ path }) => path === 'src/omitted.ts')?.health,
  ).toBe(0);
  expect(formatText(report)).toContain('no-direct-radix-imports: 1');
  expect(formatMarkdown(report)).toContain('| no-reinvented-components | 1 |');
  expect(Buffer.byteLength(formatMarkdown(report, 900))).toBeLessThanOrEqual(
    900,
  );
  expect(() =>
    parseBiomeReport(
      raw.replace('"diagnosticsNotPrinted": 0', '"diagnosticsNotPrinted": 1'),
      '',
      0,
    ),
  ).toThrow('reporter contract');
});

it('reads both reporters from one real Biome invocation', async () => {
  const dashboard = fileURLToPath(new URL('../..', import.meta.url));
  const path = 'src/components/common/CookieConsent/CookieConsent.tsx';
  const { result, processed } = await runBiomeWithInventory(dashboard, [path]);
  expect(processed).toContain(path);
  expect(result.diagnostics.some((entry) => entry.category === 'plugin')).toBe(
    true,
  );
  expect(result.summary.diagnosticsNotPrinted).toBe(0);
  const chunked = await runBiomeWithInventory(
    dashboard,
    Array.from({ length: 129 }, () => path),
  );
  expect(chunked.processed).toContain(path);
  expect(chunked.result.summary.diagnosticsNotPrinted).toBe(0);
});

it('warns about mismatched Biome, stale inputs and unknown VCS coverage', async () => {
  const manifest = await loadManifest();
  const report = reportFromBiome(
    manifest,
    {
      diagnostics: [],
      summary: { errors: 0, warnings: 0, diagnosticsNotPrinted: 0 },
      exitCode: 0,
    },
    { expected: ['src/demo.ts'], ignored: [], vcsIgnored: 'unknown' },
    ['src/demo.ts'],
    { stale: true, changedInputs: ['design-doctor/src/doctor/run.mts'] },
    { expected: '2.5.11', actual: '2.6.0', mismatch: true },
  );
  expect(report.generated).toEqual({
    stale: true,
    changedInputs: ['design-doctor/src/doctor/run.mts'],
  });
  expect(report.biomeVersion).toEqual({
    expected: '2.5.11',
    actual: '2.6.0',
    mismatch: true,
  });
  expect(reportWarnings(report)).toEqual([
    'Biome version mismatch: expected 2.5.11, installed 2.6.0',
    'Generated inputs changed: design-doctor/src/doctor/run.mts. Run pnpm design-doctor generate.',
    'Git unavailable; VCS-ignored files are unknown.',
  ]);
});

it('does not treat inventoried files with a check diagnostic as analyzed', async () => {
  const raw = await readFile(
    new URL('./fixtures/report/real-biome.json', import.meta.url),
    'utf8',
  );
  const result = parseBiomeReport(raw, '', 0);
  const path = 'src/utils/__generated__/graphql.ts';
  const report = reportFromBiome(
    await loadManifest(),
    result,
    {
      expected: [
        path,
        ...result.diagnostics
          .filter((entry) => entry.category === 'plugin')
          .map((entry) => entry.location.path),
      ],
      ignored: [],
      vcsIgnored: 'known',
    },
    result.diagnostics.map((entry) => entry.location.path),
    generated,
    biomeVersion,
  );
  expect(report.coverage.skipped).toContainEqual({ path, reason: 'omitted' });
  expect(report.coverage.processed).not.toContain(path);
  expect(report.files.find((file) => file.path === path)?.health).toBe(0);
  expect(reportWarnings(report)).toContain(
    'Coverage incomplete: 1 skipped files.',
  );
});

it('splits multiple subjects per diagnostic and rejects an unknown design rule', async () => {
  const manifest = await loadManifest();
  const docs = manifest.rules[0].docs;
  const path = 'src/demo.ts';
  const result = parseBiomeReport(
    JSON.stringify({
      summary: { errors: 0, warnings: 1, diagnosticsNotPrinted: 0 },
      diagnostics: [
        {
          category: 'plugin',
          severity: 'warning',
          location: {
            path,
            start: { line: 1, column: 1 },
            end: { line: 1, column: 5 },
          },
          message: `[design/${manifest.rules[0].id}] "A" Use A.\n"B" Use B. Docs: ${docs}`,
        },
      ],
    }),
    '',
    0,
  );
  const scope = { expected: [path], ignored: [], vcsIgnored: 'known' as const };
  const report = reportFromBiome(
    manifest,
    result,
    scope,
    [path],
    generated,
    biomeVersion,
  );
  expect(report.files[0].findings.map(({ subject }) => subject)).toEqual([
    'A',
    'B',
  ]);
  expect(report.baseline.new).toBe(2);
  expect(() =>
    reportFromBiome(
      { ...manifest, rules: [] },
      result,
      scope,
      [path],
      generated,
      biomeVersion,
    ),
  ).toThrow('Unknown design rule');
});

it('scores by expected file health, treating parse errors and omissions as zero', async () => {
  const rules = (await loadManifest()).rules;
  const finding = (path: string, status: Finding['status']): Finding => ({
    path,
    status,
    ruleId: rules[0].id,
    subject: 'X',
    guidance: 'Use X',
    docs: rules[0].docs,
    start: { line: 1, column: 1 },
    end: { line: 1, column: 2 },
  });
  const measured = coverage(
    {
      expected: ['src/a.ts', 'src/b.ts', 'src/c.ts'],
      ignored: ['src/logs/d.ts'],
      vcsIgnored: 'known',
    },
    ['src/a.ts', 'src/b.ts'],
    [
      {
        category: 'parse',
        severity: 'error',
        message: '',
        location: {
          path: 'src/b.ts',
          start: { line: 1, column: 1 },
          end: { line: 1, column: 2 },
        },
      },
    ],
  );
  expect(measured).toMatchObject({
    status: 'incomplete',
    expected: 3,
    processed: ['src/a.ts'],
    skipped: [
      { path: 'src/b.ts', reason: 'parse-error' },
      { path: 'src/c.ts', reason: 'omitted' },
      { path: 'src/logs/d.ts', reason: 'vcs-ignored' },
    ],
  });
  const scored = score(
    ['src/a.ts', 'src/b.ts', 'src/c.ts'],
    measured.processed,
    [finding('src/a.ts', 'new'), finding('src/a.ts', 'suppressed')],
    rules,
  );
  expect(scored.files.map(({ health }) => health)).toEqual([0.8, 0, 0]);
  expect(scored.score).toBe(27);
  expect(score([], [], [], rules).score).toBeNull();
  expect(
    score(
      ['src/a.ts'],
      ['src/a.ts'],
      Array.from({ length: 8 }, () => finding('src/a.ts', 'baselined')),
      rules,
    ).score,
  ).toBe(0);
});

it('enumerates only manifest-scoped sources without Git and reports VCS ignores as unknown', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'design-doctor-coverage-'));
  const directory = join(temporary, 'dashboard');
  try {
    await mkdir(join(directory, 'src/features/__tests__'), { recursive: true });
    await writeFile(join(directory, 'src/features/demo.tsx'), 'export {};');
    await writeFile(
      join(directory, 'src/features/__tests__/demo.tsx'),
      'export {};',
    );
    const files = await scopeFiles(directory, (await loadManifest()).scope);
    expect(files).toEqual({
      expected: ['src/features/demo.tsx'],
      ignored: [],
      vcsIgnored: 'unknown',
    });
    expect(coverage(files, files.expected, []).vcsIgnored).toBe('unknown');
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
