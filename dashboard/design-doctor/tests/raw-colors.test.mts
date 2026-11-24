import { readFile } from 'node:fs/promises';
import { parseMessage } from '../src/biome/parse.mts';
import type { Tokens } from '../src/contracts/tokens.mts';
import { reportFromBiome } from '../src/doctor/run.mts';
import { loadManifest } from '../src/grit/manifest.mts';
import {
  claimedByRawColors,
  emitRawColors,
  svgAllowedVariables,
} from '../src/grit/rules/no-raw-colors.mts';
import {
  COLOR_FAMILIES,
  COLOR_PREFIXES,
  suggestRawColor,
} from '../src/theme/suggest.mts';
import { fixtureRun } from './harness.mts';

const tokens = JSON.parse(
  await readFile(new URL('../generated/tokens.json', import.meta.url), 'utf8'),
) as Tokens;

it('shares ownership with the future unknown-class rule and uses the v3 palette', () => {
  const { vocabulary, grit } = claimedByRawColors();
  expect(COLOR_FAMILIES).toHaveLength(22);
  expect(vocabulary.families).toContain('blue');
  expect(grit).toContain('white|black');
  expect(grit).not.toContain('unlisted');
  expect(COLOR_PREFIXES).not.toContain('divide-x');
  expect(COLOR_PREFIXES).not.toContain('divide-y');
  expect(svgAllowedVariables(tokens)).toContain('primary');
  expect(svgAllowedVariables(tokens)).not.toContain('github');
});

it('every palette shade passes the ordered cheap gate', () => {
  for (const shade of [
    '50',
    '100',
    '200',
    '300',
    '400',
    '500',
    '600',
    '700',
    '800',
    '900',
    '950',
  ]) {
    expect(['00', '50'].some((gate) => shade.includes(gate))).toBe(true);
  }
});

it('gates sites and tokens before palette dispatch without wrapping node kinds', () => {
  const plugin = emitRawColors(tokens);
  for (const subject of ['$site', '$part']) {
    const dash = plugin.indexOf(`${subject} <: includes "-"`);
    const shade = plugin.indexOf(`${subject} <: includes "00"`);
    const family = plugin.indexOf(`${subject} <: includes "-slate-"`);
    expect(dash).toBeGreaterThan(0);
    expect(shade).toBeGreaterThan(dash);
    expect(family).toBeGreaterThan(shade);
  }
  expect(plugin).toContain(
    'JsxAttribute(name=$name, initializer=$initializer)',
  );
  expect(plugin).toContain('$name <: or { "fill", "stroke"');
  expect(plugin).not.toContain('pattern class_contexts');
});

it('suggests perceptually near, never exact, color tokens with modifiers intact', () => {
  expect(suggestRawColor('hover:!bg-blue-500/30', tokens)).toMatch(
    /^Nearest, not exact: hover:!bg-[\w-]+\/30/,
  );
  expect(suggestRawColor('dark:!text-white', tokens)).toMatch(
    /^Nearest, not exact: dark:!text-[\w-]+/,
  );
  expect(suggestRawColor('bg-unlisted-brand', tokens)).toBeNull();
  expect(suggestRawColor('fill=#fff', tokens)).toContain('with currentColor');
});

it('flags palette and static SVG paint while leaving unknown classes, tokens and deferred paint alone', async () => {
  const run = await fixtureRun(['features/raw-colors.tsx']);
  try {
    const subjects = run.report.diagnostics.flatMap((entry) => {
      const message = parseMessage(entry.message);
      return message?.ruleId === 'no-raw-colors'
        ? message.subjects.map(({ subject }) => subject)
        : [];
    });
    const unknown = run.report.diagnostics.flatMap((entry) => {
      const message = parseMessage(entry.message);
      return message?.ruleId === 'no-unknown-classes'
        ? message.subjects.map(({ subject }) => subject)
        : [];
    });
    expect(unknown).toEqual(
      expect.arrayContaining([
        'bg-unlisted-brand',
        'text-unknown',
        'divide-x-blue-500',
        'w-xl',
      ]),
    );
    expect(subjects).toContain('bg-blue-500');
    expect(subjects).toContain('fill=#f00');
    expect(subjects).not.toContain('bg-primary');
    expect(subjects).not.toContain('bg-unlisted-brand');
    expect(subjects).not.toContain('text-unknown');
    expect(subjects).not.toContain('dark:text-white!');
    expect(subjects).not.toContain('divide-x-blue-500');
    expect(subjects).not.toContain('bg-github');
    const path = 'src/features/raw-colors.tsx';
    const report = reportFromBiome(
      await loadManifest(),
      run.report,
      { expected: [path], ignored: [], vcsIgnored: 'known' },
      [path],
      { stale: false, changedInputs: [] },
      { expected: '2.5.11', actual: '2.5.11', mismatch: false },
      new Map(),
      tokens,
    );
    const rawFindings = report.files.flatMap((file) =>
      file.findings.filter(({ ruleId }) => ruleId === 'no-raw-colors'),
    );
    expect(
      rawFindings.find(({ subject }) => subject === 'hover:!bg-blue-500/30')
        ?.guidance,
    ).toContain('Nearest, not exact: hover:!bg-');
    expect(
      rawFindings.find(({ subject }) => subject === 'hover:!bg-blue-500/30')
        ?.guidance,
    ).toContain('/30');
    expect(
      rawFindings.find(({ subject }) => subject === 'fill=#f00')?.guidance,
    ).toContain('with currentColor');
    expect(
      rawFindings.some(({ subject }) => subject === 'bg-unlisted-brand'),
    ).toBe(false);
  } finally {
    await run.close();
  }
});
