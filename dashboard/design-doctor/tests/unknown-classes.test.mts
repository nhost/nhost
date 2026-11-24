import { readFile } from 'node:fs/promises';
import type { Tokens } from '../src/contracts/tokens.mts';
import { reportFromBiome } from '../src/doctor/run.mts';
import { loadManifest } from '../src/grit/manifest.mts';
import { claimedByArbitraryValues } from '../src/grit/rules/no-arbitrary-values.mts';
import { claimedByRawColors } from '../src/grit/rules/no-raw-colors.mts';
import { unknownVocabulary } from '../src/grit/rules/no-unknown-classes.mts';
import { loadTheme } from '../src/theme/load.mts';
import {
  didYouMean,
  editDistance,
  suggestUnknownClass,
} from '../src/theme/similar.mts';
import { fixtureRun } from './harness.mts';

const dashboard = new URL('../..', import.meta.url).pathname;
const vocabulary = unknownVocabulary(loadTheme(dashboard).resolved, dashboard);
const tokens = JSON.parse(
  await readFile(new URL('../generated/tokens.json', import.meta.url), 'utf8'),
) as Tokens;

it('uses bounded class heads and includes project CSS plus reasoned external hooks', async () => {
  expect(vocabulary.classes.length).toBeGreaterThan(14_000);
  expect(vocabulary.cssClasses).toContain('loading-toast');
  expect(vocabulary.classes).toContain('group');
  expect(vocabulary.classes).toContain('peer');
  expect(vocabulary.classes).toContain('not-prose');
  expect(
    Object.values(vocabulary.externalClasses).every((reason) => reason.trim()),
  ).toBe(true);
  const grit = await readFile(
    new URL('../generated/plugins/no-unknown-classes.grit', import.meta.url),
    'utf8',
  );
  const regexes = [...grit.matchAll(/\br"([^"\n]*)"/g)].map(
    (match) => match[1],
  );
  // The combined static/parameterized variant matcher is a single 1.5 KB
  // regex; the class-vocabulary dispatch remains bounded to 1.3 KB leaves.
  expect(Math.max(...regexes.map((regex) => regex.length))).toBeLessThanOrEqual(
    1500,
  );
});

it('has disjoint class ownership: palette tokens are known and arbitrary claims never belong to this rule', () => {
  const { vocabulary: raw } = claimedByRawColors();
  const names = new Set(vocabulary.classes);
  const colors = raw.families;
  const prefixes = raw.prefixes;
  for (const prefix of prefixes) {
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
      for (const family of colors) {
        const value = `${prefix}-${family}-${shade}`;
        expect(
          names.has(value),
          `Raw-color claim must be known: ${value}`,
        ).toBe(true);
        expect(claimedByArbitraryValues(value)).toBe(false);
      }
    }
  }
  for (const prefix of prefixes) {
    for (const name of ['white', 'black']) {
      expect(names.has(`${prefix}-${name}`)).toBe(true);
    }
  }
  for (const value of [
    'bg-[#333]',
    'text-[12px]',
    'rounded-[8px]',
    'duration-[250ms]',
  ]) {
    expect(claimedByArbitraryValues(value)).toBe(true);
  }
  expect(claimedByArbitraryValues('max-w-[444px]')).toBe(false);
});

it('ports transposition-aware shadcn suggestions and gives v3 color declaration guidance', () => {
  expect(editDistance('foucs', 'focus')).toBe(1);
  expect(didYouMean('w-xl', ['w-2xl', 'w-full', 'w-1/2'])).toBe('w-2xl');
  expect(didYouMean('zzzzzz', ['w-full'])).toBeNull();
  expect(suggestUnknownClass('bg-brand', vocabulary.classes)).toContain(
    'theme.extend.colors',
  );
  expect(suggestUnknownClass('text-md', vocabulary.classes)).toContain(
    'text-base',
  );
  expect(suggestUnknownClass('text-md', vocabulary.classes)).not.toContain(
    'text-end',
  );
  expect(suggestUnknownClass('text-md', vocabulary.classes)).not.toContain(
    'addVariant',
  );
  for (const subject of [
    'focus-vsible:ring-2',
    'hovr:bg-primary',
    'hovr:bg-blue-500',
    'hovr:flex',
    'md:hovr:flex',
  ]) {
    const guidance = suggestUnknownClass(
      subject,
      vocabulary.classes,
      vocabulary.variants.map(({ name }) => name),
    );
    expect(guidance).toContain('addVariant');
    expect(guidance).not.toContain('theme.extend.colors');
    expect(guidance).not.toContain(`Did you mean ${subject}?`);
  }
  expect(
    suggestUnknownClass(
      'md:hovr:flex',
      vocabulary.classes,
      vocabulary.variants.map(({ name }) => name),
    ),
  ).toContain('hover instead of hovr');
  for (const width of ['border-3', 'ring-3', 'outline-3']) {
    const guidance = suggestUnknownClass(width, vocabulary.classes);
    expect(guidance).toMatch(
      new RegExp(`(?:${width.split('-')[0]}-2|${width.split('-')[0]}-4)`),
    );
    expect(guidance).not.toContain('theme.extend.colors');
    expect(guidance).not.toContain('--');
  }
  expect(suggestUnknownClass('-w-xl', ['-w-2xl', 'w-2xl'])).toContain('-w-2xl');
});

it('reports unknown variants and unvarianted bases, but defers known-variant bases and glued edges', async () => {
  const run = await fixtureRun(['features/unknown-classes.tsx']);
  try {
    const path = 'src/features/unknown-classes.tsx';
    const report = reportFromBiome(
      await loadManifest(),
      run.report,
      { expected: [path], ignored: [], vcsIgnored: 'known' },
      [path],
      { stale: false, changedInputs: [] },
      { expected: '2.5.11', actual: '2.5.11', mismatch: false },
      new Map(),
      tokens,
      vocabulary.classes,
      vocabulary.variants.map(({ name }) => name),
    );
    const findings = report.files.flatMap((file) => file.findings);
    expect(
      findings
        .filter(({ ruleId }) => ruleId === 'no-unknown-classes')
        .map(({ subject }) => subject)
        .sort(),
    ).toEqual(
      [
        'flex-cols',
        'rounded-huge',
        'text-md',
        'w-xl',
        'bg-brand',
        'fake-[10px]',
        'fake-[10px]',
        'fake-[10px]',
        'flex-cols',
        'flex-cols',
        'flex-cols',
        'text-sm!',
        'hovr:flex',
        'focus-vsible:ring-2',
        'hovr:bg-primary',
        'md:hovr:flex',
        'dark:focus-vsible:ring-2',
        'group-hover:hovr:flex',
        'data-[state=open]:hovr:flex',
        'peer-checked:hovr:flex',
        'aria-selected:focus-vsible:ring-2',
        'hovr:bg-blue-500',
        'hovr:bg-[#333]',
      ].sort(),
    );
    expect(
      findings.find(({ subject }) => subject === 'bg-brand')?.guidance,
    ).toContain('theme.extend.colors');
    expect(
      findings.find(({ subject }) => subject === 'text-md')?.guidance,
    ).toContain('text-base');
    expect(
      findings.find(({ subject }) => subject === 'text-md')?.guidance,
    ).not.toContain('addVariant');
    for (const subject of [
      'focus-vsible:ring-2',
      'hovr:bg-primary',
      'hovr:bg-blue-500',
      'hovr:flex',
    ]) {
      const guidance = findings.find(
        (finding) =>
          finding.ruleId === 'no-unknown-classes' &&
          finding.subject === subject,
      )?.guidance;
      expect(guidance).toContain('addVariant');
      expect(guidance).not.toContain('theme.extend.colors');
      expect(guidance).not.toContain(`Did you mean ${subject}?`);
    }
  } finally {
    await run.close();
  }
});
