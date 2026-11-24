import { readFile } from 'node:fs/promises';
import type { Tokens } from '../src/contracts/tokens.mts';
import { reportFromBiome } from '../src/doctor/run.mts';
import { loadManifest } from '../src/grit/manifest.mts';
import {
  arbitraryCategory,
  categoriesFor,
  claimedByArbitraryValues,
  probeArbitraryRoots,
} from '../src/grit/rules/no-arbitrary-values.mts';
import { suggestArbitraryValue } from '../src/theme/arbitrary-suggest.mts';
import { loadTheme } from '../src/theme/load.mts';
import { fixtureRun } from './harness.mts';

const dashboard = new URL('../..', import.meta.url).pathname;
const tokens = JSON.parse(
  await readFile(new URL('../generated/tokens.json', import.meta.url), 'utf8'),
) as Tokens;

it('probes all v3 arbitrary roots and fails closed on unmapped roots', () => {
  const accepted = probeArbitraryRoots(loadTheme(dashboard).resolved);
  expect(accepted).toHaveLength(193);
  expect(categoriesFor(accepted).layout).toContain('w');
  expect(categoriesFor(accepted).typography).toContain('text');
  expect(() => categoriesFor([...accepted, 'new-theme-plugin'])).toThrow(
    'Unmapped Tailwind v3 arbitrary roots: new-theme-plugin',
  );
  expect(arbitraryCategory('text', '12px')).toBe('typography');
  expect(arbitraryCategory('text', '#333')).toBe('color');
  expect(arbitraryCategory('border', 'color:#333')).toBe('color');
  expect(arbitraryCategory('border', '8px')).toBe('shape');
  expect(arbitraryCategory('bg', 'red')).toBe('color');
  expect(arbitraryCategory('bg', 'rgb(1_2_3)')).toBe('color');
});

it('has disjoint ownership for arbitrary appearance, layout, CSS variables and arbitrary variants', () => {
  for (const token of [
    'bg-[#333]',
    '[color:#333]',
    'text-[12px]',
    'p-[13px]',
    '[padding:13px]',
    'hover:!rounded-[8px]',
  ]) {
    expect(claimedByArbitraryValues(token)).toBe(true);
  }
  for (const token of [
    'w-[320px]',
    '[var(--x)]',
    'bg-[var(--brand)]',
    'bg-[--brand]',
    '[color:hsl(var(--primary))]',
    'ring-[rgb(var(--schema-color))]',
    '[mask-type:alpha]',
    '[text-align:center]',
    '[border-collapse:collapse]',
    '[&>svg]:w-[320px]',
    'bg-blue-500',
  ]) {
    expect(claimedByArbitraryValues(token)).toBe(false);
  }
});

it('offers exact scale steps, nearest declared steps and nearest (not exact) colors', () => {
  expect(suggestArbitraryValue('text-[12px]', tokens)).toBe(
    'Exact scale replacement: text-xs.',
  );
  expect(suggestArbitraryValue('rounded-[8px]', tokens)).toBe(
    'Exact scale replacement: rounded-lg.',
  );
  expect(suggestArbitraryValue('rounded-[4px]', tokens)).toBe(
    'Exact scale replacement: rounded.',
  );
  expect(suggestArbitraryValue('rounded-t-[4px]', tokens)).toBe(
    'Exact scale replacement: rounded-t.',
  );
  expect(suggestArbitraryValue('rounded-[5px]', tokens)).not.toContain(
    '-DEFAULT',
  );
  expect(suggestArbitraryValue('ring-[1px]', tokens)).not.toContain(
    'ring-DEFAULT',
  );
  expect(suggestArbitraryValue('outline-[1px]', tokens)).not.toContain(
    'outline-DEFAULT',
  );
  expect(suggestArbitraryValue('text-[11px]', tokens)).toContain(
    'In cn(), tailwind-merge 1.14 treats text-xs- as a text color and can drop it',
  );
  expect(suggestArbitraryValue('text-[12px]', tokens)).not.toContain('In cn()');
  expect(suggestArbitraryValue('p-[13px]', tokens)).toMatch(
    /^Nearest, not exact: p-3(?: or p-3\.5)?/,
  );
  expect(suggestArbitraryValue('[padding:13px]', tokens)).toContain('p-3');
  expect(suggestArbitraryValue('[color:#333]', tokens)).toMatch(
    /^Nearest, not exact: text-[a-z-]+/,
  );
  expect(suggestArbitraryValue('[border-radius:8px]', tokens)).toBe(
    'Exact scale replacement: rounded-lg.',
  );
  expect(suggestArbitraryValue('text-[length:12px]', tokens)).toBe(
    'Exact scale replacement: text-xs.',
  );
  expect(suggestArbitraryValue('hover:!text-[12px]', tokens)).toContain(
    'hover:!text-xs',
  );
  expect(suggestArbitraryValue('bg-[rgb(1_2_3)]', tokens)).toMatch(
    /^Nearest, not exact: bg-/,
  );
  expect(suggestArbitraryValue('bg-[#333]', tokens)).toMatch(
    /^Nearest, not exact: bg-[a-z-]+/,
  );
  expect(suggestArbitraryValue('w-[320px]', tokens)).toBeNull();
});

it('never suggests a nonexistent -DEFAULT utility for a baselined finding', async () => {
  const baseline = JSON.parse(
    await readFile(new URL('../baseline.json', import.meta.url), 'utf8'),
  ) as {
    files: Record<string, Record<string, Record<string, number>>>;
  };
  const subjects = Object.values(baseline.files).flatMap((rules) =>
    Object.keys(rules['no-arbitrary-values'] ?? {}),
  );
  expect(subjects.length).toBeGreaterThan(0);
  for (const subject of subjects) {
    expect(suggestArbitraryValue(subject, tokens) ?? '').not.toContain(
      '-DEFAULT',
    );
  }
});

it('detects arbitrary appearance values in class contexts and reports doctor-side replacements', async () => {
  const run = await fixtureRun(['features/arbitrary-values.tsx']);
  try {
    const path = 'src/features/arbitrary-values.tsx';
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
    const findings = report.files.flatMap((file) => file.findings);
    expect(findings).toHaveLength(9);
    expect(
      findings.find(({ subject }) => subject === 'text-[12px]')?.guidance,
    ).toContain('Exact scale replacement: text-xs');
    expect(
      findings.find(({ subject }) => subject === 'rounded-[8px]')?.guidance,
    ).toContain('Exact scale replacement: rounded-lg');
    expect(
      findings.find(({ subject }) => subject === 'p-[13px]')?.guidance,
    ).toContain('Nearest, not exact: p-3');
    expect(
      findings.find(({ subject }) => subject === 'bg-[#333]')?.guidance,
    ).toContain('Nearest, not exact: bg-');
    expect(
      findings.find(({ subject }) => subject === '[padding:13px]')?.guidance,
    ).toContain('Nearest, not exact: p-3');
    expect(
      findings.find(({ subject }) => subject === '[color:#333]')?.guidance,
    ).toContain('Nearest, not exact: text-');
  } finally {
    await run.close();
  }
});
