import { readFile } from 'node:fs/promises';
import { parseMessage } from '../src/biome/parse.mts';
import type { Finding } from '../src/contracts/report.mts';
import { suppressFindings } from '../src/doctor/suppress.mts';
import {
  emitClassProbe,
  emitClassRule,
  normalizeClass,
} from '../src/grit/prelude/classes.mts';
import { fixtureRun } from './harness.mts';

it('splits variants only outside arbitrary brackets and normalizes v3 modifiers', () => {
  expect(normalizeClass('sm:[&:nth-child(2)]:!-bg-muted/30')).toEqual({
    variants: ['sm', '[&:nth-child(2)]'],
    base: '!-bg-muted/30',
    normalized: 'bg-muted/30',
  });
  expect(normalizeClass('dark:text-white!').normalized).toBe('text-white!');
});

it('dispatches at node kinds with callee and name filters in their fields', () => {
  const probe = emitClassProbe();
  expect(probe).toContain('JsCallExpression(callee=not r"');
  expect(probe).toContain('JsxAttribute(name=r"');
  expect(probe).toContain('JsVariableDeclarator(id=r"');
  expect(probe).toContain('JsStringLiteralExpression() as $site where {');
  expect(probe).not.toContain('$spaces =');
});

it('probes every class token in scope through the real Biome parser', async () => {
  const run = await fixtureRun(
    [
      'features/class-sites.tsx',
      'features/class-sites.test.tsx',
      'components/ui/v3/class-sites.tsx',
    ],
    new Map([
      [
        'features/class-sites.test.tsx',
        "const test = <div className='p-2' />;",
      ],
      ['components/ui/v3/class-sites.tsx', "const exempt = cn('p-2');"],
    ]),
    emitClassProbe(),
  );
  try {
    const sites = run.report.diagnostics.filter(({ message }) =>
      message.startsWith('[design/class-probe]'),
    );
    const tokens = sites.flatMap(
      ({ message }) =>
        parseMessage(message)?.subjects.map(({ subject }) => subject) ?? [],
    );
    expect(sites.length).toBeGreaterThan(20);
    expect(tokens).toHaveLength(57);
    expect(tokens).toContain('sm:[&:nth-child(2)]:bg-muted/30');
    expect(tokens).toContain('bg-[rgb(2 3 4)]');
    expect(tokens).toContain('italic');
    expect(tokens).toContain('px]');
    expect(tokens).toContain(']');
    expect(tokens).not.toContain('border-red-500');
    expect(
      sites.every(
        ({ location }) => location.path === 'src/features/class-sites.tsx',
      ),
    ).toBe(true);
  } finally {
    await run.close();
  }
});

it('matches normalized utility bases without dropping variant spellings in findings', async () => {
  const path = 'features/normalized.tsx';
  const text =
    '// expect: class-probe "sm:[&:nth-child(2)]:!-bg-muted/30"\n// expect: class-probe "data-[state=open]:bg-muted/30"\n// expect: class-probe "xs+:bg-muted/30"\n// expect: class-probe "group-hover/cell:bg-muted/30"\n// expect: class-probe "bg-muted/30"\n// expect: no-raw-colors "hover:bg-blue-500"\nconst x = <div className="sm:[&:nth-child(2)]:!-bg-muted/30 data-[state=open]:bg-muted/30 xs+:bg-muted/30 group-hover/cell:bg-muted/30 bg-muted/30 hover:bg-blue-500" />;';
  const probe = emitClassRule('class-probe', {
    predicate:
      '$part <: class_normalized($normal), $normal <: r"^bg-muted/30$"',
    substrings: ['bg-muted/30'],
    guidance: 'Probe class tokens.',
  });
  const run = await fixtureRun([path], new Map([[path, text]]), probe);
  await run.close();
});

it('restricts opt-in high-confidence rules without changing the shared probe', async () => {
  const path = 'features/confident.tsx';
  const text = `const looseClassName = 'flex-cols';
const styles = { itemClassName: 'rounded-huge' };
// expect: class-probe "flex-cols"
// expect: no-unknown-classes "flex-cols"
const actual = <div className="flex-cols" />;
// expect: class-probe "rounded-huge"
// expect: no-unknown-classes "rounded-huge"
const merged = cn('rounded-huge', {
  // expect: class-probe "text-md"
  // expect: no-unknown-classes "text-md"
  'text-md': active,
});`;
  const run = await fixtureRun(
    [path],
    new Map([[path, text]]),
    emitClassRule('class-probe', {
      highConfidence: true,
      guidance: 'Probe class tokens.',
    }),
  );
  await run.close();
});

it('treats a line separator in a template chunk as a token boundary', async () => {
  const path = 'features/line-separator.tsx';
  const text = `// expect: class-probe "p-2"\n// expect: class-probe "m-2"\nconst x = <div className={\`p-2\u2028m-2\`} />;`;
  const run = await fixtureRun(
    [path],
    new Map([[path, text]]),
    emitClassProbe(),
  );
  try {
    expect(
      run.report.diagnostics.flatMap(
        ({ message }) => parseMessage(message)?.subjects ?? [],
      ),
    ).toEqual([
      { subject: 'p-2', guidance: 'Probe class tokens.' },
      { subject: 'm-2', guidance: 'Probe class tokens.' },
    ]);
  } finally {
    await run.close();
  }
});

it('attaches actual site-span findings to call arguments, array elements and object properties', async () => {
  const path = 'src/features/class-suppress.tsx';
  const text = await readFile(
    new URL('./fixtures/features/class-suppress.tsx', import.meta.url),
    'utf8',
  );
  const run = await fixtureRun(
    ['features/class-suppress.tsx'],
    new Map([['features/class-suppress.tsx', text]]),
    emitClassProbe(),
  );
  try {
    const findings: Finding[] = run.report.diagnostics.flatMap((diagnostic) => {
      const parsed = parseMessage(diagnostic.message);
      return (parsed?.subjects ?? []).map(({ subject, guidance }) => ({
        path,
        ruleId: 'class-probe',
        subject,
        guidance,
        docs: parsed?.docs ?? '',
        start: diagnostic.location.start,
        end: diagnostic.location.end,
        status: 'new' as const,
      }));
    });
    const directives = suppressFindings(
      findings,
      new Map([[path, text]]),
      new Set(['class-probe']),
    );
    expect(directives.map(({ state }) => state)).toEqual([
      'applied',
      'applied',
      'applied',
      'applied',
    ]);
    expect(
      findings.map(({ subject, status }) => [subject, status]).sort(),
    ).toEqual([
      ['bg-muted', 'suppressed'],
      ['flex', 'new'],
      ['m-2', 'suppressed'],
      ['p-2', 'suppressed'],
      ['text-sm', 'suppressed'],
    ]);
  } finally {
    await run.close();
  }
});

for (const [name, text, reason] of [
  [
    'loose-block.tsx',
    '/* expect: class-probe "p-2" */\nconst x = <div className="p-2" />;',
    'malformed expect annotation',
  ],
  [
    'loose-line.tsx',
    '//expect: class-probe "p-2"\nconst x = <div className="p-2" />;',
    'malformed expect annotation',
  ],
  [
    'loose-jsx.tsx',
    'const x = <div>{/*expect: class-probe "p-2"*/}<span className="p-2" /></div>;',
    'malformed expect annotation',
  ],
  [
    'double.tsx',
    'const x = <div className="p-2" />; // expect: class-probe "p-2" // expect: class-probe "p-2"',
    'malformed expect annotation',
  ],
  [
    'eof.tsx',
    '// expect: class-probe "p-2"',
    'expect block has no following code',
  ],
  [
    'eof-newline.tsx',
    'const x = 1;\n// expect: class-probe "p-2"\n',
    'expect block has no following code',
  ],
] as const) {
  it(`rejects ${name} instead of silently dropping an expectation`, async () => {
    await expect(
      fixtureRun(
        [`features/${name}`],
        new Map([[`features/${name}`, text]]),
        emitClassProbe(),
      ),
    ).rejects.toThrow(reason);
  });
}
