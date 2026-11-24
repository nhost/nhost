import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type Finding, reportSchema } from '../src/contracts/report.mts';
import { formatMarkdown, formatText } from '../src/doctor/format.mts';
import { reportFromBiome } from '../src/doctor/run.mts';
import {
  suppressFindings,
  suppressionSources,
} from '../src/doctor/suppress.mts';
import { loadManifest } from '../src/grit/manifest.mts';
import { fixtureRun } from './harness.mts';

const path = 'src/suppress/cases.tsx';
const fixture = new URL('./fixtures/suppress/cases.tsx', import.meta.url);
const radix = 'no-direct-radix-imports';
const reinvented = 'no-reinvented-components';

function at(text: string, index: number): Finding['start'] {
  const before = text.slice(0, index);
  const line = before.split('\n').length;
  const column = [...before.slice(before.lastIndexOf('\n') + 1)].length + 1;
  return { line, column };
}

function finding(
  text: string,
  needle: string,
  ruleId: string,
  spanLength = needle.length,
): Finding {
  const index = text.indexOf(needle);
  if (index < 0) {
    throw new Error(`Missing fixture marker: ${needle}`);
  }
  return {
    path,
    ruleId,
    subject: needle,
    guidance: 'Use the shared component.',
    docs: `design-doctor/docs/rules/${ruleId}.md`,
    start: at(text, index),
    end: at(text, index + spanLength),
    status: 'new',
  };
}

it('attaches leading comments to JSX children, attributes and properties, including stacked comments and emoji columns', async () => {
  const text = await readFile(fixture, 'utf8');
  const findings = [
    finding(text, 'button\n', reinvented),
    finding(text, 'button type="button">Nested', reinvented),
    finding(text, 'button type="button">Adjacent', reinvented),
    finding(text, 'button type="button">Stacked', reinvented),
    finding(text, 'Stacked', radix),
    finding(text, 'label"', reinvented), // after the emoji on the same line
    finding(text, 'thing:', radix),
    finding(text, 'other:', radix),
    finding(text, 'afterInline', reinvented),
    // A short Biome span must not shift into the preceding <b> when converting columns.
    finding(text, 'button type="button">after', reinvented, 'button'.length),
    finding(text, 'const jsdocStatement = 1', radix),
    finding(text, 'button type="button">Doctor JSDoc', reinvented),
    finding(text, 'const laterDesign = 1', radix),
    finding(text, 'const twoDoctorLines = 1', radix),
    finding(text, 'const twoDoctorLines = 1', reinvented),
  ];
  const suppressions = suppressFindings(
    findings,
    new Map([[path, text]]),
    new Set([radix, reinvented]),
  );
  expect(findings.map(({ status }) => status)).toEqual([
    'suppressed',
    'suppressed',
    'new',
    'suppressed',
    'suppressed',
    'suppressed',
    'suppressed',
    'suppressed',
    'new',
    'new',
    'suppressed',
    'suppressed',
    'suppressed',
    'suppressed',
    'new',
  ]);
  expect(
    suppressions
      .filter(({ state }) => state === 'applied')
      .map(({ count }) => count),
  ).toEqual([2, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  expect(suppressions.filter(({ state }) => state === 'unused')).toHaveLength(
    4,
  );
  expect(suppressions).toContainEqual(
    expect.objectContaining({
      ruleId: reinvented,
      start: at(
        text,
        text.indexOf(
          '{/* design-doctor-ignore',
          text.indexOf('const emojiSiblings'),
        ),
      ),
      state: 'unused',
      count: 0,
    }),
  );
  expect(suppressions.filter(({ state }) => state === 'invalid')).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        ruleId: radix,
        start: { line: 27, column: 3 },
        count: 0,
      }),
      expect.objectContaining({ ruleId: 'unknown-rule' }),
      expect.objectContaining({ ruleId: 'lint/plugin' }),
      expect.objectContaining({ ruleId: `lint/plugin/${reinvented}` }),
      expect.objectContaining({ ruleId: `lint/plugin/${radix}` }),
      expect.objectContaining({
        ruleId: 'lint/plugin',
        start: at(text, text.indexOf('/** biome-ignore-all lint/plugin:')),
      }),
      expect.objectContaining({
        ruleId: `lint/plugin/${reinvented}`,
        start: at(text, text.indexOf('{/** biome-ignore lint/plugin/')),
      }),
      expect.objectContaining({
        ruleId: 'lint/plugin',
        start: at(text, text.indexOf('/**\n * Wrapper notes.')),
      }),
      expect.objectContaining({
        ruleId: 'lint',
        start: at(text, text.indexOf('// biome-ignore-all lint:')),
      }),
      expect.objectContaining({
        ruleId: 'lint',
        start: at(text, text.indexOf('// biome-ignore-start lint:')),
      }),
      expect.objectContaining({
        ruleId: 'lint',
        start: at(text, text.indexOf('{/* biome-ignore lint:')),
      }),
      expect.objectContaining({
        ruleId: reinvented,
        start: at(
          text,
          text.indexOf(
            '{/* design-doctor-ignore',
            text.indexOf('const inlineJsx'),
          ),
        ),
      }),
      expect.objectContaining({
        ruleId: 'lint/plugin',
        start: at(
          text,
          text.indexOf('biome-ignore lint/plugin: hidden import'),
        ),
      }),
      expect.objectContaining({
        ruleId: `lint/plugin/${reinvented}`,
        start: at(
          text,
          text.indexOf(
            'biome-ignore lint/plugin/no-reinvented-components: hidden child',
          ),
        ),
      }),
      expect.objectContaining({
        ruleId: 'lint/plugin',
        start: at(
          text,
          text.indexOf(
            'biome-ignore lint/plugin: hidden import',
            text.indexOf('const secondBiomeJsx'),
          ),
        ),
      }),
      expect.objectContaining({
        ruleId: reinvented,
        start: at(
          text,
          text.indexOf(
            'design-doctor-ignore no-reinvented-components: second directive',
          ),
        ),
      }),
    ]),
  );
  expect(suppressions.filter(({ state }) => state === 'invalid')).toHaveLength(
    18,
  );
  expect(suppressions).toHaveLength(32);
  expect(suppressions).not.toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        start: at(text, text.indexOf('// biome-ignore-end')),
      }),
      expect.objectContaining({
        start: at(text, text.indexOf('/** biome-ignore-all lint/style:')),
      }),
    ]),
  );
});

it('reports every unsafe line that real Biome uses to hide design findings', async () => {
  const paths = [
    'runtime.tsx',
    'runtime-import.tsx',
    'runtime-jsx.tsx',
    'runtime-all-top.tsx',
    'runtime-all-later.tsx',
    'runtime-crlf.tsx',
    'runtime-cr.tsx',
  ].map((name) => `suppress/${name}`);
  const crlfPath = 'suppress/runtime-crlf.tsx';
  const crPath = 'suppress/runtime-cr.tsx';
  const crlf = await readFile(
    new URL('./fixtures/suppress/runtime-crlf.tsx', import.meta.url),
    'utf8',
  );
  const loneCr = await readFile(
    new URL('./fixtures/suppress/runtime-cr.tsx', import.meta.url),
    'utf8',
  );
  const run = await fixtureRun(
    paths,
    new Map([
      [crlfPath, crlf.replaceAll('\n', '\r\n')],
      [crPath, loneCr.replaceAll('␍', '\r')],
    ]),
  );
  try {
    expect(
      await readFile(join(run.root, 'dashboard/src', crlfPath), 'utf8'),
    ).toContain('\r\n');
    const expected = paths.map((name) => `src/${name}`);
    const sources = new Map(
      await Promise.all(
        expected.map(
          async (name) =>
            [
              name,
              await readFile(join(run.root, 'dashboard', name), 'utf8'),
            ] as const,
        ),
      ),
    );
    const manifest = await loadManifest();
    const report = reportFromBiome(
      manifest,
      run.report,
      { expected, ignored: [], vcsIgnored: 'known' },
      expected,
      { stale: false, changedInputs: [] },
      { actual: '2.5.11', expected: '2.5.11', mismatch: false },
      sources,
    );
    expect(reportSchema.safeParse(report).success).toBe(true);
    expect(report.files.flatMap(({ findings }) => findings)).toHaveLength(4);
    expect(
      report.suppressions.filter(({ state }) => state === 'invalid'),
    ).toHaveLength(20);
    expect(
      report.suppressions.filter(({ state }) => state === 'unused'),
    ).toHaveLength(2);
    for (const [name, count] of [
      ['runtime.tsx', 11],
      ['runtime-import.tsx', 2],
      ['runtime-jsx.tsx', 3],
      ['runtime-all-top.tsx', 1],
      ['runtime-all-later.tsx', 1],
      ['runtime-crlf.tsx', 1],
      ['runtime-cr.tsx', 1],
    ] as const) {
      expect(
        report.suppressions.filter(
          ({ path: source, state }) =>
            source === `src/suppress/${name}` && state === 'invalid',
        ),
      ).toHaveLength(count);
    }
    expect(report.suppressions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'src/suppress/runtime-import.tsx',
          ruleId: 'lint/plugin',
          start: { line: 3, column: 4 },
        }),
        expect.objectContaining({
          path: 'src/suppress/runtime-jsx.tsx',
          ruleId: `lint/plugin/${reinvented}`,
          start: { line: 5, column: 8 },
        }),
        expect.objectContaining({
          path: 'src/suppress/runtime-crlf.tsx',
          ruleId: 'lint/plugin',
          start: { line: 3, column: 4 },
        }),
        expect.objectContaining({
          path: 'src/suppress/runtime-cr.tsx',
          ruleId: 'lint/plugin',
          start: { line: 2, column: 1 },
        }),
        expect.objectContaining({
          path: 'src/suppress/runtime.tsx',
          ruleId: `lint/plugin/${reinvented}`,
          start: { line: 23, column: 1 },
        }),
        expect.objectContaining({
          path: 'src/suppress/runtime.tsx',
          ruleId: 'lint/plugin',
          start: { line: 25, column: 1 },
        }),
        expect.objectContaining({
          path: 'src/suppress/runtime.tsx',
          ruleId: 'lint',
          start: { line: 27, column: 1 },
        }),
        expect.objectContaining({
          path: 'src/suppress/runtime-all-top.tsx',
          ruleId: `lint/plugin/${reinvented}`,
          start: { line: 1, column: 1 },
        }),
        expect.objectContaining({
          path: 'src/suppress/runtime-import.tsx',
          ruleId: radix,
          state: 'unused',
        }),
      ]),
    );
    expect(
      report.suppressions.filter(
        ({ path: source }) => source === 'src/suppress/runtime-cr.tsx',
      ),
    ).toHaveLength(1);
    // A misplaced file-wide directive does not hide the control finding,
    // but is still invalid so it cannot become a silent bypass if moved.
    expect(
      report.files.find(
        ({ path: name }) => name === 'src/suppress/runtime-all-later.tsx',
      )?.health,
    ).toBe(0.8);
  } finally {
    await run.close();
  }
});

it('reports a suppressed Biome finding without charging it to health or the new baseline', async () => {
  const text = await readFile(fixture, 'utf8');
  const original = finding(text, 'button type="button">Adjacent', reinvented);
  const covered = finding(text, 'button type="button">Stacked', reinvented);
  const manifest = await loadManifest();
  const result = {
    diagnostics: [original, covered].map((item) => ({
      severity: 'warning',
      category: 'plugin',
      message: `[design/${item.ruleId}] "${item.subject}" ${item.guidance} Docs: ${item.docs}`,
      location: { path, start: item.start, end: item.end },
    })),
    summary: { errors: 0, warnings: 2, diagnosticsNotPrinted: 0 },
    exitCode: 0,
  };
  const report = reportFromBiome(
    manifest,
    result,
    { expected: [path], ignored: [], vcsIgnored: 'known' },
    [path],
    { stale: false, changedInputs: [] },
    { actual: '2.5.11', expected: '2.5.11', mismatch: false },
    new Map([[path, text]]),
  );
  expect(reportSchema.safeParse(report).success).toBe(true);
  expect(report.files[0].findings.map(({ status }) => status)).toEqual([
    'new',
    'suppressed',
  ]);
  expect(report.rules.find(({ id }) => id === reinvented)?.count).toBe(2);
  expect(report.baseline.new).toBe(1);
  expect(report.files[0].health).toBe(0.8);
  expect(report.score).toBe(80);
  expect(formatText(report)).toContain(
    `${path}:10:5 ${reinvented}: applied (1 findings)`,
  );
  expect(formatMarkdown(report)).toContain(
    'suppression **lint/plugin**: invalid',
  );
});

it('marks an unattached end-of-file directive invalid', () => {
  const text =
    'const first = 1;\n// design-doctor-ignore no-reinvented-components: no following node\n';
  expect(
    suppressFindings([], new Map([[path, text]]), new Set([reinvented])),
  ).toEqual([
    {
      path,
      ruleId: reinvented,
      reason: 'no following node',
      start: { line: 2, column: 1 },
      state: 'invalid',
      count: 0,
    },
  ]);
});

it('parses only marked sources while reading from the in-scope path list', async () => {
  // No source outside the explicitly provided inventory is opened.
  const root = new URL('./fixtures/', import.meta.url).pathname;
  const sources = await suppressionSources(root, [
    'suppress/cases.tsx',
    'features/alias.ts',
  ]);
  expect([...sources.keys()]).toEqual(['suppress/cases.tsx']);
  expect((await suppressionSources(root, [])).size).toBe(0);
  expect(
    suppressFindings([], new Map([[path, 'const x = 1;']]), new Set()),
  ).toEqual([]);
});
