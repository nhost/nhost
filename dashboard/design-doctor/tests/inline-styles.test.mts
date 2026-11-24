import { parseMessage } from '../src/biome/parse.mts';
import type { Finding } from '../src/contracts/report.mts';
import { reportFromBiome } from '../src/doctor/run.mts';
import { suppressFindings } from '../src/doctor/suppress.mts';
import { loadManifest } from '../src/grit/manifest.mts';
import { fixtureRun } from './harness.mts';

it('reports each inline property at its own span and leaves other design rules disjoint', async () => {
  const path = 'src/features/inline-styles.tsx';
  const run = await fixtureRun(['features/inline-styles.tsx']);
  try {
    const report = reportFromBiome(
      await loadManifest(),
      run.report,
      { expected: [path], ignored: [], vcsIgnored: 'known' },
      [path],
      { stale: false, changedInputs: [] },
      { expected: '2.5.11', actual: '2.5.11', mismatch: false },
    );
    const findings = report.files.flatMap((file) => file.findings);
    const first = findings.filter(
      ({ ruleId, start }) => ruleId === 'no-inline-styles' && start.line === 5,
    );
    expect(first.map(({ subject }) => subject)).toEqual(['color', 'marginTop']);
    expect(first[0].start.column).not.toBe(first[1].start.column);
    expect(
      findings.filter(({ ruleId }) => ruleId !== 'no-inline-styles'),
    ).toEqual([]);
    expect(
      findings.some(
        ({ subject }) => subject === 'provided.draggableProps.style',
      ),
    ).toBe(false);
    expect(
      run.report.diagnostics
        .filter(
          ({ message }) => parseMessage(message)?.ruleId === 'no-inline-styles',
        )
        .every(({ severity }) => severity === 'warning'),
    ).toBe(true);
  } finally {
    await run.close();
  }
}, 20000);

it('attaches suppressions to one object property or to every finding under the attribute', async () => {
  const path = 'src/features/suppressed-styles.tsx';
  const text = `const panel = <div
  // design-doctor-ignore no-inline-styles: external widget
  style={{ color: 'red', width: 2 }}
/>;
const other = <div style={{
  // design-doctor-ignore no-inline-styles: animation library
  opacity: 0.5,
  color: 'red',
}} />;`;
  const pos = (needle: string, from = 0) => {
    const before = text.slice(0, text.indexOf(needle, from));
    return {
      line: before.split('\n').length,
      column: before.length - before.lastIndexOf('\n'),
    };
  };
  const entry = (needle: string, from = 0): Finding => {
    const start = pos(needle, from);
    return {
      path,
      ruleId: 'no-inline-styles',
      subject: needle,
      guidance: 'Use a class.',
      docs: 'design-doctor/docs/rules/no-inline-styles.md',
      start,
      end: { ...start, column: start.column + needle.length },
      status: 'new',
    };
  };
  const findings = [
    entry("color: 'red'"),
    entry('width: 2'),
    entry('opacity: 0.5'),
    entry("color: 'red'", text.indexOf('const other')),
  ];
  const suppressions = suppressFindings(
    findings,
    new Map([[path, text]]),
    new Set(['no-inline-styles']),
  );
  expect(suppressions.map(({ state, count }) => [state, count])).toEqual([
    ['applied', 2],
    ['applied', 1],
  ]);
  expect(findings.map(({ status }) => status)).toEqual([
    'suppressed',
    'suppressed',
    'suppressed',
    'new',
  ]);
});
