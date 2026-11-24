import { readFile } from 'node:fs/promises';
import { catalogMeta } from '../catalog.meta.mts';
import { parseMessage } from '../src/biome/parse.mts';
import { catalogSchema } from '../src/contracts/catalog.mts';
import { tokensSchema } from '../src/contracts/tokens.mts';
import { ruleArtifacts } from '../src/grit/emit.mts';
import { loadManifest, vocabularyHash } from '../src/grit/manifest.mts';
import { replacements } from '../src/grit/rules/no-reinvented-components.mts';
import { fixtureRun } from './harness.mts';

it('derives replacements and button options from catalog metadata', async () => {
  const catalog = catalogSchema.parse(
    JSON.parse(
      await readFile(
        new URL('../generated/catalog.json', import.meta.url),
        'utf8',
      ),
    ),
  );
  const map = replacements(catalog);
  expect(map.button[0]).toMatchObject({
    name: 'Button',
    importPath: '@/components/ui/v3/button',
    variants: {
      size: ['xs', 'sm', 'md', 'lg', 'inline', 'icon-xs', 'icon-sm', 'icon'],
    },
  });
  expect(map.input.map(({ name }) => name)).toEqual(['Input', 'FormInput']);
  expect(map['input[type=checkbox]'][0].name).toBe('Checkbox');
  expect(map['input[type=radio]'][0].name).toBe('RadioGroup');
  expect(map.a[0].name).toBe('TextLink');
  expect(catalogMeta['@/components/ui/v3/button#Button'].replaces).toEqual([
    'button',
  ]);
  expect(() =>
    replacements({
      ...catalog,
      components: catalog.components.map((entry) =>
        entry.name === 'Button' ? { ...entry, replaces: ['custom'] } : entry,
      ),
    }),
  ).toThrow('Unsupported raw-element selector');
});

it('emits only registered plugins, with independent vocabulary hashes', async () => {
  const catalog = catalogSchema.parse(
    JSON.parse(
      await readFile(
        new URL('../generated/catalog.json', import.meta.url),
        'utf8',
      ),
    ),
  );
  const manifest = await loadManifest();
  const tokens = tokensSchema.parse(
    JSON.parse(
      await readFile(
        new URL('../generated/tokens.json', import.meta.url),
        'utf8',
      ),
    ),
  );
  const artifacts = ruleArtifacts(manifest, catalog, tokens);
  const rules = JSON.parse(artifacts['rules.json']) as {
    rules: { id: string; vocabularyHash: string }[];
  };
  expect(
    rules.rules.find(({ id }) => id === 'no-reinvented-components')
      ?.vocabularyHash,
  ).toBe(vocabularyHash(Object.keys(replacements(catalog)).sort()));
  const changedMessages = {
    ...catalog,
    components: catalog.components.map((entry) =>
      entry.name === 'Button'
        ? { ...entry, importPath: '@/components/ui/v3/other-button' }
        : entry,
    ),
  };
  const updated = JSON.parse(
    ruleArtifacts(manifest, changedMessages, tokens)['rules.json'],
  ) as typeof rules;
  expect(updated.rules[1].vocabularyHash).toBe(rules.rules[1].vocabularyHash);
  expect(rules.rules[0].vocabularyHash).not.toBe(rules.rules[1].vocabularyHash);
  expect(
    Object.keys(
      ruleArtifacts(
        { ...manifest, rules: manifest.rules.slice(0, 1) },
        catalog,
        tokens,
      ),
    ),
  ).not.toContain('plugins/no-reinvented-components.grit');
  expect(() =>
    ruleArtifacts(
      { ...manifest, rules: [{ ...manifest.rules[0], id: 'unknown' }] },
      catalog,
      tokens,
    ),
  ).toThrow('No Grit emitter for rule: unknown');
});

it('rejects a fixture with the right subject but the wrong finding line', async () => {
  await expect(fixtureRun(['features/incorrect-line.tsx'])).rejects.toThrow(
    /expected \["2:no-reinvented-components:button"\], got \["3:no-reinvented-components:button"\]/,
  );
});

it('rejects malformed annotations and interrupted blocks', async () => {
  await expect(fixtureRun(['features/malformed-expect.tsx'])).rejects.toThrow(
    'features/malformed-expect.tsx:1: malformed expect annotation',
  );
  await expect(
    fixtureRun(['features/malformed-jsx-expect.tsx']),
  ).rejects.toThrow(
    'features/malformed-jsx-expect.tsx:2: malformed expect annotation',
  );
  await expect(fixtureRun(['features/interrupted-expect.tsx'])).rejects.toThrow(
    'features/interrupted-expect.tsx:2: non-expect comment inside expect block',
  );
});

it('reports both JSX forms, typed input variants, and only unowned asChild children', async () => {
  const run = await fixtureRun([
    'features/reinvented.tsx',
    'features/reinvented.test.tsx',
    'features/__tests__/design-exempt.tsx',
    'components/ui/v3/reinvented.tsx',
  ]);
  try {
    expect(
      run.report.diagnostics.filter(
        ({ category }) => category === 'lint/suspicious/noCommentText',
      ),
    ).toHaveLength(0);
    const messages = run.report.diagnostics
      .filter(({ message }) =>
        message.startsWith('[design/no-reinvented-components]'),
      )
      .map(({ message }) => message);
    expect(messages).toHaveLength(20);
    const lines = (
      await readFile(
        new URL('./fixtures/features/reinvented.tsx', import.meta.url),
        'utf8',
      )
    ).split('\n');
    const blockLine =
      lines.findIndex(
        (line) =>
          line.trim() === '{/* expect: no-reinvented-components "button" */}',
      ) + 2;
    const inlineLine =
      lines.findIndex((line) =>
        line.includes('{ready && <a href="/">Link</a>} {/* expect:'),
      ) + 1;
    const findings = run.report.diagnostics.filter(
      ({ location }) => location.path === 'src/features/reinvented.tsx',
    );
    expect(blockLine).toBeGreaterThan(1);
    expect(inlineLine).toBeGreaterThan(0);
    expect(
      findings.some(
        ({ location, message }) =>
          location.start.line === blockLine &&
          parseMessage(message)?.subjects[0]?.subject === 'button',
      ),
    ).toBe(true);
    expect(
      findings.some(
        ({ location, message }) =>
          location.start.line === inlineLine &&
          parseMessage(message)?.subjects[0]?.subject === 'a',
      ),
    ).toBe(true);
    expect(messages.find((message) => message.includes('"button"'))).toContain(
      'Button from @/components/ui/v3/button',
    );
    expect(messages.find((message) => message.includes('"button"'))).toContain(
      'asChild composition',
    );
    expect(messages.find((message) => message.includes('"input"'))).toContain(
      'Input from @/components/ui/v3/input or FormInput from @/components/form/FormInput',
    );
    expect(
      messages.every((message) => message.includes('not a safe drop-in')),
    ).toBe(true);
    expect(
      parseMessage(
        messages.find((message) => message.includes('"table"')) ?? '',
      )?.docs,
    ).toBe('design-doctor/docs/rules/no-reinvented-components.md');
  } finally {
    await run.close();
  }
});
