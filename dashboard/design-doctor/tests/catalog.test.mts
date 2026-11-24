import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalogMeta } from '../catalog.meta.mts';
import { buildCatalog } from '../src/catalog/build.mts';
import { catalogSchema } from '../src/contracts/catalog.mts';
import { inputHashes } from '../src/tokens/inputs.mts';

const dashboard = fileURLToPath(new URL('../..', import.meta.url));

it('resolves Button CVA through its wrapper and preserves the public default', async () => {
  const catalog = catalogSchema.parse(
    JSON.parse(
      await readFile(
        new URL('../generated/catalog.json', import.meta.url),
        'utf8',
      ),
    ),
  );
  const button = catalog.components.find(
    (component) =>
      component.importPath === '@/components/ui/v3/button' &&
      component.name === 'Button',
  );
  expect(button).toMatchObject({
    purpose: catalogMeta['@/components/ui/v3/button#Button'].purpose,
    replaces: ['button'],
    dropIn: false,
    cva: [
      {
        name: 'baseButtonVariants',
        variants: {
          variant: [
            'default',
            'destructive',
            'outline',
            'ghost',
            'subtle',
            'link',
            'menu',
            'menu-destructive',
          ],
          size: [
            'xs',
            'sm',
            'md',
            'lg',
            'inline',
            'icon-xs',
            'icon-sm',
            'icon',
          ],
        },
        defaultVariants: { variant: 'default', size: 'sm' },
        conditionalDefaults: { sizeByVariant: { subtle: 'icon-sm' } },
      },
    ],
  });
  expect(
    catalog.modules.find(
      (module) => module.importPath === '@/components/ui/v3/button',
    )?.exports,
  ).toContain('buttonVariants');
  expect(
    catalog.components.find(
      (component) =>
        component.importPath === '@/components/ui/v3/dialog' &&
        component.name === 'DialogContent',
    )?.radix,
  ).toEqual({ package: '@radix-ui/react-dialog', primitive: 'Content' });
  expect(
    catalog.components.find(
      (component) =>
        component.importPath === '@/components/ui/v3/accordion' &&
        component.name === 'AccordionTrigger',
    )?.radix,
  ).toEqual({ package: '@radix-ui/react-accordion', primitive: 'Trigger' });
  expect(
    catalog.components.find(
      (component) =>
        component.importPath === '@/components/ui/v3/collapsible' &&
        component.name === 'CollapsibleTrigger',
    )?.radix,
  ).toEqual({
    package: '@radix-ui/react-collapsible',
    primitive: 'CollapsibleTrigger',
  });
  expect(
    catalog.components.find(
      (component) =>
        component.importPath === '@/components/ui/v3/sheet' &&
        component.name === 'SheetContent',
    )?.radix,
  ).toEqual({ package: '@radix-ui/react-dialog', primitive: 'Content' });
  expect(
    catalog.components.find(
      (component) =>
        component.importPath === '@/components/presentational/CodeBlock' &&
        component.name === 'CodeBlock',
    )?.source,
  ).toBe('src/components/presentational/CodeBlock/CodeBlock.tsx');
  expect(
    catalog.modules.every((module) => !module.importPath.includes('.test')),
  ).toBe(true);
  expect(catalog.undocumented).toContain(
    '@/components/ui/v3/dialog#DialogContent',
  );
  expect(catalog.undocumented).not.toContain(
    '@/components/ui/v3/button#Button',
  );
});

it('resolves aliased re-exports, index.tsx and hashes transitive source files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'design-doctor-catalog-'));
  const components = join(root, 'src/components');
  try {
    for (const folder of [
      'ui/v3',
      'form',
      'presentational',
      'common/Sample',
      'common/Star',
    ]) {
      await mkdir(join(components, folder), { recursive: true });
    }
    const barrel = join(components, 'common/Sample/index.ts');
    const star = join(components, 'common/Star/Star.tsx');
    await writeFile(
      barrel,
      "export * from '@/components/common/Star';\nexport { Named } from '@/components/common/Named';\n",
    );
    await writeFile(
      join(components, 'common/Star/index.tsx'),
      "export * from './Star';\n",
    );
    await writeFile(star, 'export const Star = () => null;\n');
    await writeFile(
      join(components, 'common/Named.tsx'),
      'export const Named = () => null;\n',
    );
    for (const folder of ['src/constants', 'src/styles']) {
      await mkdir(join(root, folder), { recursive: true });
    }
    for (const file of [
      'tailwind.config.js',
      'src/constants/screens.cjs',
      'src/styles/globals.css',
    ]) {
      await writeFile(join(root, file), '');
    }
    const parsed = new Set<string>();
    const catalog = await buildCatalog(root, {}, parsed);
    expect(
      catalog.modules.find(
        (module) => module.importPath === '@/components/common/Sample',
      )?.exports,
    ).toEqual(['Named', 'Star']);
    expect(
      catalog.components.find(
        (component) =>
          component.importPath === '@/components/common/Sample' &&
          component.name === 'Star',
      )?.source,
    ).toBe('src/components/common/Star/Star.tsx');
    expect(
      catalog.components.find(
        (component) =>
          component.importPath === '@/components/common/Sample' &&
          component.name === 'Named',
      )?.source,
    ).toBe('src/components/common/Named.tsx');
    const path = 'src/components/common/Star/Star.tsx';
    const before = await inputHashes(root, parsed);
    expect(await inputHashes(root)).toEqual(before);
    expect(before[path]).toMatch(/^[a-f0-9]{64}$/);
    await writeFile(
      star,
      'export const Star = () => null;\nexport const New = 1;\n',
    );
    const after = await inputHashes(root);
    expect(after[path]).not.toBe(before[path]);
    expect(
      (await buildCatalog(root, {})).modules.find(
        (module) => module.importPath === '@/components/common/Sample',
      )?.exports,
    ).toEqual(['Named', 'New', 'Star']);
    await writeFile(barrel, "export * from '@/components/common/Missing';\n");
    await expect(buildCatalog(root, {})).rejects.toThrow(
      'Cannot resolve catalog module @/components/common/Missing',
    );
    await writeFile(
      barrel,
      "export { Missing } from '@/components/common/Named';\n",
    );
    await expect(buildCatalog(root, {})).rejects.toThrow(
      'Unresolved catalog re-export: Missing',
    );
    await writeFile(
      barrel,
      "export * as All from '@/components/common/Star';\n",
    );
    await expect(buildCatalog(root, {})).rejects.toThrow(
      'Unsupported catalog re-export',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('rejects metadata keys that no longer point to public components', async () => {
  await expect(
    buildCatalog(dashboard, {
      ...catalogMeta,
      '@/components/ui/v3/button#DoesNotExist': {
        purpose: 'stale',
        replaces: [],
        dropIn: false,
      },
    }),
  ).rejects.toThrow(
    'Unresolved catalog metadata key: @/components/ui/v3/button#DoesNotExist',
  );
  await expect(
    buildCatalog(dashboard, {
      ...catalogMeta,
      '@/components/ui/v3/button#Button': {
        purpose: '',
        replaces: [],
        dropIn: false,
      },
    }),
  ).rejects.toThrow();
});
