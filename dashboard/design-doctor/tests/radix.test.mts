import { readFile } from 'node:fs/promises';
import { parseMessage } from '../src/biome/parse.mts';
import { parseBiomeReport } from '../src/biome/runner.mts';
import { catalogSchema } from '../src/contracts/catalog.mts';
import { radixMap } from '../src/grit/emit.mts';
import { inScope, loadManifest } from '../src/grit/manifest.mts';
import { fixtureRun } from './harness.mts';

it('maps both long and short Radix aliases from the catalog', async () => {
  const catalog = catalogSchema.parse(
    JSON.parse(
      await readFile(
        new URL('../generated/catalog.json', import.meta.url),
        'utf8',
      ),
    ),
  );
  const collapsible = radixMap(catalog)['@radix-ui/react-collapsible'];
  expect(collapsible.Trigger).toContain(
    'CollapsibleTrigger from @/components/ui/v3/collapsible',
  );
  expect(collapsible.Content).toContain(
    'CollapsibleContent from @/components/ui/v3/collapsible',
  );
  const dialog = radixMap(catalog)['@radix-ui/react-dialog'];
  expect(dialog.Dialog).toContain('Dialog from @/components/ui/v3/dialog');
  expect(dialog.DialogRoot).toBeUndefined();
});

it('links the generated rule summary to its documentation', async () => {
  const markdown = await readFile(
    new URL('../generated/rules.md', import.meta.url),
    'utf8',
  );
  expect(markdown).toContain(
    '[Details](../../design-doctor/docs/rules/no-direct-radix-imports.md)',
  );
  for (const row of markdown
    .split('\n')
    .filter((line) => line.startsWith('|'))) {
    expect(row.split('|')).toHaveLength(7); // Five cells and the two outer separators.
    expect(row.replace(/`[^`]*`/g, '')).not.toMatch(/<[^>]+>/);
  }
  expect(markdown).toContain('`<style>`');
  expect(
    await readFile(
      new URL('../docs/rules/no-direct-radix-imports.md', import.meta.url),
      'utf8',
    ),
  ).toContain('# no-direct-radix-imports');
});

it('round-trips the emitted diagnostic message', () => {
  const message =
    '[design/no-direct-radix-imports] "DialogPrimitive" A namespace has no single drop-in replacement. Docs: design-doctor/docs/rules/no-direct-radix-imports.md';
  expect(parseMessage(message)).toEqual({
    ruleId: 'no-direct-radix-imports',
    subjects: [
      {
        subject: 'DialogPrimitive',
        guidance: 'A namespace has no single drop-in replacement.',
      },
    ],
    docs: 'design-doctor/docs/rules/no-direct-radix-imports.md',
  });
  const quotedLiteral =
    '[design/no-direct-radix-imports] ""@radix-ui/react-label"" This package import has no single safe exact replacement. Docs: design-doctor/docs/rules/no-direct-radix-imports.md';
  expect(parseMessage(quotedLiteral)?.subjects).toEqual([
    {
      subject: "'@radix-ui/react-label'",
      guidance: 'This package import has no single safe exact replacement.',
    },
  ]);
  const report = parseBiomeReport(
    JSON.stringify({
      diagnostics: [{ category: 'plugin', message: quotedLiteral }],
      summary: { errors: 0, warnings: 1, diagnosticsNotPrinted: 0 },
    }),
    '',
    0,
  );
  expect(parseMessage(report.diagnostics[0].message)?.subjects[0].subject).toBe(
    "'@radix-ui/react-label'",
  );
  expect(parseMessage('[design/no-direct-radix-imports] invalid')).toBeNull();
});

it('matches all Radix import forms and excludes scoped paths and react-slot', async () => {
  const paths = [
    'features/radix.ts',
    'features/slot.ts',
    'features/two-names.ts',
    'features/three-names.ts',
    'features/four-names.ts',
    'features/reexport.ts',
    'features/alias.ts',
    'features/edge.ts',
    'features/package-imports.ts',
    'features/list-arity.ts',
    'features/slot-and-lookalikes.ts',
    'features/example.test.ts',
    'features/example.spec.ts',
    'features/tests/example.ts',
    'features/testUtils/example.ts',
    'features/mocks/example.ts',
    'features/__mocks__/example.ts',
    'features/generated/example.ts',
    'features/__generated__/example.ts',
    'features/__tests__/design-exempt.tsx',
    'components/ui/v3/inside.ts',
    'features/dynamic.ts',
    'features/root-primitives.ts',
    'features/default-import.ts',
    'features/quoted-imports.ts',
  ];
  const scope = (await loadManifest()).scope;
  expect(inScope('/tmp/dashboard/src/features/radix.ts', scope)).toBe(true);
  for (const path of paths.slice(11, 21)) {
    expect(inScope(`/tmp/dashboard/src/${path}`, scope)).toBe(false);
  }
  const run = await fixtureRun(paths);
  try {
    const messages = run.report.diagnostics
      .filter((entry) => entry.message.startsWith('[design/'))
      .map((entry) => entry.message);
    expect(messages).toHaveLength(54);
    const dynamic = run.report.diagnostics.filter(
      (entry) => entry.location.path === 'src/features/dynamic.ts',
    );
    expect(dynamic).toHaveLength(1);
    const source = await readFile(
      new URL('./fixtures/features/dynamic.ts', import.meta.url),
      'utf8',
    );
    const span = dynamic[0].location;
    expect(span.start.line).toBe(span.end.line);
    expect(
      source
        .split('\n')
        [span.start.line - 1].slice(span.start.column - 1, span.end.column - 1),
    ).toBe("'@radix-ui/react-select'");
    expect(messages[0]).toContain('ui/v3');
    for (const name of ['Dialog', 'Tooltip']) {
      const primitive = run.report.diagnostics.find((entry) =>
        parseMessage(entry.message)?.subjects.some(
          ({ subject }) => subject === name,
        ),
      );
      expect(primitive?.message).toContain(
        `${name} from @/components/ui/v3/${name.toLowerCase()}`,
      );
      expect(primitive?.message).not.toContain('No exact ui/v3 export');
    }
    expect(
      messages.some((message) =>
        parseMessage(message)?.subjects.some(
          ({ subject }) => subject === 'DialogDescription',
        ),
      ),
    ).toBe(true);
    expect(
      messages.some((entry) => entry.includes('No exact ui/v3 export')),
    ).toBe(true);
  } finally {
    await run.close();
  }
});

it('rejects plugin failures hidden in otherwise valid Biome JSON', () => {
  const report = {
    diagnostics: [
      {
        category: 'plugin',
        message: 'no-direct-radix-imports errored: invalid snippet',
      },
    ],
    summary: { errors: 0, warnings: 0, diagnosticsNotPrinted: 0 },
  };
  expect(() => parseBiomeReport(JSON.stringify(report), '', 0)).toThrow(
    'Biome plugin failed',
  );
  expect(() =>
    parseBiomeReport(
      JSON.stringify({
        ...report,
        diagnostics: [],
        summary: { ...report.summary, diagnosticsNotPrinted: 1 },
      }),
      '',
      1,
    ),
  ).toThrow('Biome reporter contract failed');
});

it('exits zero when diagnostics are warnings only', async () => {
  const run = await fixtureRun(['features/warning-only.ts']);
  try {
    expect(run.report.exitCode).toBe(0);
    expect(run.report.summary.errors).toBe(0);
    expect(run.report.summary.warnings).toBe(1);
    const source = await readFile(
      new URL('./fixtures/features/warning-only.ts', import.meta.url),
      'utf8',
    );
    expect(source).toContain('// expect:');
  } finally {
    await run.close();
  }
});
