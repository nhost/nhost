import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { indexSchema } from '../src/contracts/index.mts';
import { tokensSchema } from '../src/contracts/tokens.mts';
import { normalizeColor } from '../src/theme/color-normalize.mts';
import { parseColor } from '../src/theme/colors.mts';
import { cssVariables } from '../src/theme/css-vars.mts';
import { lengthInPx } from '../src/theme/lengths.mts';
import { buildTokens } from '../src/tokens/build.mts';
import { generate } from '../src/tokens/generate.mts';
import { changedInputs, inputHashes, stale } from '../src/tokens/inputs.mts';

const dashboard = fileURLToPath(new URL('../..', import.meta.url));

it('resolves declared primary and radius from globals.css without importing default palette', async () => {
  const tokens = tokensSchema.parse(
    JSON.parse(
      await readFile(
        new URL('../generated/tokens.json', import.meta.url),
        'utf8',
      ),
    ),
  );
  expect(tokens.colors.primary).toMatchObject({
    light: '#0052cc',
    themeAware: true,
    valid: true,
  });
  expect(tokens.colors['sidebar-foreground']).toMatchObject({
    light: null,
    dark: '#e8e9eb',
    valid: true,
  });
  expect(tokens.colors['sidebar-section-title']).toMatchObject({
    light: null,
    valid: true,
  });
  expect(tokens.colors.github.valid).toBe(false);
  expect(tokens.colors['blue-500']).toBeUndefined();
  expect(tokens.scales.borderRadius.lg.px).toBe(8);
});

describe('normalization', () => {
  it('parses comma HSL, deg and slash alpha', () => {
    expect(normalizeColor('hsl(210deg, 100%, 50% / 50%)')).toBe('#0080ff80');
    expect(normalizeColor('hsl(210, 100%, 50%)')).toBe('#0080ff');
    expect(normalizeColor('#24292E;')).toBeNull();
    expect(parseColor('oklch(55.6% 0 none)')).not.toBeNull();
  });
  it('resolves calc and ignores unrelated nested declarations', () => {
    expect(lengthInPx('calc(0.5rem - 2px)')).toBe(6);
    expect(lengthInPx('calc(1rem * 2)')).toBe(32);
    expect(lengthInPx('13%')).toBeNull();
    const css =
      ':root { --radius: 0.5rem; } .dark { --primary: 210, 100%, 50%; } .other .dark { --primary: bad; }';
    expect(cssVariables(css).primary.dark).toBe('210, 100%, 50%');
    const colors = buildTokens(
      {
        primary: 'hsl(var(--primary))',
        missing: 'hsl(var(--missing))',
      },
      {},
      css,
    ).colors;
    expect(colors.primary).toMatchObject({
      light: null,
      dark: '#0080ff',
      valid: true,
    });
    expect(colors.missing).toMatchObject({
      light: null,
      dark: null,
      valid: false,
    });
  });
});

it('detects added, changed and removed inputs without filesystem mutation', async () => {
  const inputs = await inputHashes(dashboard);
  const index = indexSchema.parse(
    JSON.parse(
      await readFile(
        new URL('../generated/index.json', import.meta.url),
        'utf8',
      ),
    ),
  );
  expect(stale(index, inputs)).toEqual({ stale: false, changedInputs: [] });
  expect(
    changedInputs(index, {
      ...inputs,
      'tailwind.config.js': '0'.repeat(64),
      'new.input': '1'.repeat(64),
    }),
  ).toEqual(['new.input', 'tailwind.config.js']);
  const removed = { ...inputs };
  delete removed['tailwind.config.js'];
  expect(changedInputs(index, removed)).toEqual(['tailwind.config.js']);
  expect(await generate(true)).toEqual([]);
});

it('hashes only the declared input extensions, not editor or OS files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'design-doctor-inputs-'));
  try {
    for (const folder of [
      'src/constants',
      'src/styles',
      'src/components/ui/v3',
      'design-doctor/src',
    ]) {
      await mkdir(join(directory, folder), { recursive: true });
    }
    for (const path of [
      'tailwind.config.js',
      'src/constants/screens.cjs',
      'src/styles/globals.css',
      'src/styles/.DS_Store',
      'src/components/ui/v3/button.tsx',
      'src/components/ui/v3/button.test.tsx',
      'src/components/ui/v3/.button.tsx.swp',
      'design-doctor/src/colors.mts',
      'design-doctor/src/.colors.mts.swp',
    ]) {
      await writeFile(join(directory, path), path);
    }
    const inputs = await inputHashes(directory, new Set());
    expect(
      Object.keys(inputs).filter(
        (path) => !path.startsWith('package:') && path !== 'biome:version',
      ),
    ).toEqual([
      'design-doctor/src/colors.mts',
      'src/components/ui/v3/button.tsx',
      'src/constants/screens.cjs',
      'src/styles/globals.css',
      'tailwind.config.js',
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('reports orphans without writes and deletes them when generating', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'design-doctor-'));
  try {
    const configPath = join(directory, 'biome.design.json');
    const output = join(directory, 'generated');
    await mkdir(output);
    await writeFile(join(output, 'old.json'), '{}');
    expect(await generate(true, dashboard, output, configPath)).toEqual([
      'biome.design.json',
      'catalog.json',
      'catalog.md',
      'index.json',
      'old.json',
      'plugins/no-arbitrary-values.grit',
      'plugins/no-direct-radix-imports.grit',
      'plugins/no-inline-styles.grit',
      'plugins/no-raw-colors.grit',
      'plugins/no-reinvented-components.grit',
      'plugins/no-unknown-classes.grit',
      'plugins/require-static-classes.grit',
      'rules.json',
      'rules.md',
      'tokens.json',
      'tokens.md',
    ]);
    expect(await readdir(output)).toEqual(['old.json']);
    await generate(false, dashboard, output, configPath);
    expect(await readFile(configPath, 'utf8')).toBe(
      await readFile(join(dashboard, 'biome.design.json'), 'utf8'),
    );
    expect(await readdir(output)).toEqual([
      'catalog.json',
      'catalog.md',
      'index.json',
      'plugins',
      'rules.json',
      'rules.md',
      'tokens.json',
      'tokens.md',
    ]);
    expect(await generate(true, dashboard, output, configPath)).toEqual([]);
    await mkdir(join(output, 'old/nested'), { recursive: true });
    await writeFile(join(output, 'old/nested/unused.grit'), 'unused');
    await writeFile(join(output, 'plugins/unused.grit'), 'unused');
    await writeFile(join(output, 'tokens.json'), '{}');
    expect(await generate(true, dashboard, output, configPath)).toEqual([
      'old',
      'plugins/unused.grit',
      'tokens.json',
    ]);
    expect(await readFile(join(output, 'tokens.json'), 'utf8')).toBe('{}');
    await generate(false, dashboard, output, configPath);
    expect(await readdir(output)).not.toContain('old');
    expect(await readdir(join(output, 'plugins'))).toEqual([
      'no-arbitrary-values.grit',
      'no-direct-radix-imports.grit',
      'no-inline-styles.grit',
      'no-raw-colors.grit',
      'no-reinvented-components.grit',
      'no-unknown-classes.grit',
      'require-static-classes.grit',
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
