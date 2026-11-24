import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import postcss from 'postcss';
import { probeArbitraryRoots } from './no-arbitrary-values.mts';

const require = createRequire(import.meta.url);
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// Only hooks supplied by packages that do not register Tailwind utilities.
// Each exemption must explain who supplies the class and why it is not in v3.
export const unknownConfig: { externalClasses: Record<string, string> } = {
  externalClasses: {
    'group-node':
      'Local selector hook for nested rule-editor :has(.group-node) arbitrary variants.',
    nodrag:
      '@xyflow/react interaction hook disables node dragging on controls.',
    nopan:
      '@xyflow/react interaction hook disables canvas panning on controls.',
    'not-prose':
      '@tailwindcss/typography exclusion marker for descendants of prose.',
    'rct-dark': 'react-complex-tree/lib/style-modern.css dark-theme selector.',
  },
};

export interface UnknownVocabulary {
  classes: string[];
  variants: { name: string; isArbitrary: boolean; values: string[] }[];
  arbitraryRoots: string[];
  cssClasses: string[];
  externalClasses: Record<string, string>;
}

export function unknownVocabulary(
  config: unknown,
  dashboard: string,
): UnknownVocabulary {
  const { createContext } =
    require('tailwindcss/lib/lib/setupContextUtils.js') as {
      createContext: (config: unknown) => {
        getClassList: () => string[];
        getVariants: () => {
          name: string;
          isArbitrary: boolean;
          values: string[];
        }[];
      };
    };
  const context = createContext(config);
  const cssClasses = new Set<string>();
  for (const file of readdirSync(join(dashboard, 'src/styles')).filter((name) =>
    name.endsWith('.css'),
  )) {
    const css = postcss.parse(
      readFileSync(join(dashboard, 'src/styles', file), 'utf8'),
      { from: file },
    );
    css.walkRules((rule) => {
      for (const match of rule.selector.matchAll(/\.((?:\\.|[\w-])+)/g)) {
        cssClasses.add(match[1].replace(/\\(.)/g, '$1'));
      }
    });
  }
  for (const [name, reason] of Object.entries(unknownConfig.externalClasses)) {
    if (!reason.trim()) {
      throw new Error(`External class ${name} needs a reason`);
    }
  }
  return {
    classes: [
      ...new Set([
        ...context.getClassList().filter((name) => typeof name === 'string'),
        ...cssClasses,
        ...Object.keys(unknownConfig.externalClasses),
        'group',
        'peer',
      ]),
    ].sort(compare),
    variants: context.getVariants().map(({ name, isArbitrary, values }) => ({
      name,
      isArbitrary,
      values: [...values],
    })),
    arbitraryRoots: probeArbitraryRoots(config),
    cssClasses: [...cssClasses].sort(compare),
    externalClasses: unknownConfig.externalClasses,
  };
}
