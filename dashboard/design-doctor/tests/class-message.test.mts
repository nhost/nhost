import { parseMessage } from '../src/biome/parse.mts';
import { parseBiomeReport } from '../src/biome/runner.mts';
import { reportFromBiome } from '../src/doctor/run.mts';
import { loadManifest } from '../src/grit/manifest.mts';
import { CLASS_SUBJECT_SEPARATOR } from '../src/grit/prelude/classes.mts';

it('expands every class token at a single diagnostic span without stripping modifiers', () => {
  const tokens = [
    'sm:hover:!bg-muted/30',
    'bg-[url("x")]',
    "content-['quoted']",
    '[&:nth-child(2)]:px-2',
    'bg-[rgb(2 3 4)]',
  ];
  const message = `[design/class-probe] ${tokens.join(CLASS_SUBJECT_SEPARATOR)}${CLASS_SUBJECT_SEPARATOR} Guidance: Probe class tokens. Docs: design-doctor/docs/rules/class-probe.md`;
  expect(parseMessage(message)).toEqual({
    ruleId: 'class-probe',
    subjects: tokens.map((subject) => ({
      subject,
      guidance: 'Probe class tokens.',
    })),
    docs: 'design-doctor/docs/rules/class-probe.md',
  });
  expect(
    parseMessage(
      message.replace(`${CLASS_SUBJECT_SEPARATOR} Guidance:`, ' Guidance:'),
    ),
  ).toBeNull();
  const fragments = ['px]', ']', 'c]', 'd]', 'h-2'];
  expect(
    parseMessage(
      `[design/class-probe] ${fragments.join(CLASS_SUBJECT_SEPARATOR)}${CLASS_SUBJECT_SEPARATOR} Guidance: Probe class tokens. Docs: design-doctor/docs/rules/class-probe.md`,
    )?.subjects.map(({ subject }) => subject),
  ).toEqual(fragments);
  expect(
    parseMessage(
      `[design/class-probe] px]${CLASS_SUBJECT_SEPARATOR}${CLASS_SUBJECT_SEPARATOR} Guidance: Probe class tokens. Docs: design-doctor/docs/rules/class-probe.md`,
    ),
  ).toBeNull();
});

it('accepts unbalanced template chunks from the Biome reporter', () => {
  const message = `[design/class-probe] px]${CLASS_SUBJECT_SEPARATOR}h-2${CLASS_SUBJECT_SEPARATOR} Guidance: Probe class tokens. Docs: design-doctor/docs/rules/class-probe.md`;
  expect(
    parseBiomeReport(
      JSON.stringify({
        summary: { errors: 0, warnings: 1, diagnosticsNotPrinted: 0 },
        diagnostics: [{ category: 'plugin', severity: 'warning', message }],
      }),
      '',
      0,
    ).diagnostics,
  ).toHaveLength(1);
});

it('creates separate report findings for tokens that share one Biome span', async () => {
  const path = 'src/demo.tsx';
  const manifest = await loadManifest();
  const message = `[design/class-probe] p-2${CLASS_SUBJECT_SEPARATOR}hover:!bg-muted/30${CLASS_SUBJECT_SEPARATOR} Guidance: Probe class tokens. Docs: design-doctor/docs/rules/class-probe.md`;
  const result = parseBiomeReport(
    JSON.stringify({
      summary: { errors: 0, warnings: 1, diagnosticsNotPrinted: 0 },
      diagnostics: [
        {
          category: 'plugin',
          severity: 'warning',
          location: {
            path,
            start: { line: 3, column: 8 },
            end: { line: 3, column: 31 },
          },
          message,
        },
      ],
    }),
    '',
    0,
  );
  const report = reportFromBiome(
    {
      ...manifest,
      rules: [
        ...manifest.rules,
        {
          id: 'class-probe',
          version: 1,
          category: 'class',
          weight: 1,
          subject: 'class token',
          docs: 'design-doctor/docs/rules/class-probe.md',
        },
      ],
    },
    result,
    { expected: [path], ignored: [], vcsIgnored: 'known' },
    [path],
    { stale: false, changedInputs: [] },
    { expected: '2.5.11', actual: '2.5.11', mismatch: false },
  );
  expect(
    report.files[0].findings.map(({ subject, start, end }) => ({
      subject,
      start,
      end,
    })),
  ).toEqual([
    {
      subject: 'p-2',
      start: { line: 3, column: 8 },
      end: { line: 3, column: 31 },
    },
    {
      subject: 'hover:!bg-muted/30',
      start: { line: 3, column: 8 },
      end: { line: 3, column: 31 },
    },
  ]);
  expect(report.baseline.new).toBe(2);
});

it('preserves a separator inside a legacy quoted subject without interpreting it as a class list', () => {
  expect(
    parseMessage(
      `[design/no-reinvented-components] "a${CLASS_SUBJECT_SEPARATOR}b" Use shared components. Docs: design-doctor/docs/rules/no-reinvented-components.md`,
    )?.subjects,
  ).toEqual([
    {
      subject: `a${CLASS_SUBJECT_SEPARATOR}b`,
      guidance: 'Use shared components.',
    },
  ]);
});
