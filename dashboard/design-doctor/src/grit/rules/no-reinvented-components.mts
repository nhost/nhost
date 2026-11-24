import type { Catalog } from '../../contracts/catalog.mts';

export type Replacement = {
  name: string;
  importPath: string;
  dropIn: boolean;
  variants: Record<string, string[]>;
};

// The catalog's replaces field is the only source of raw-element mappings.
// Refuse unknown selectors rather than silently generating a partial rule.
export function replacements(catalog: Catalog): Record<string, Replacement[]> {
  const map: Record<string, Replacement[]> = {};
  const supported = new Set([
    'button',
    'input',
    'input[type=checkbox]',
    'input[type=radio]',
    'textarea',
    'select',
    'table',
    'a',
  ]);
  for (const component of catalog.components) {
    for (const selector of component.replaces) {
      if (!supported.has(selector)) {
        throw new Error(`Unsupported raw-element selector: ${selector}`);
      }
      map[selector] ??= [];
      map[selector].push({
        name: component.name,
        importPath: component.importPath,
        dropIn: component.dropIn,
        variants: Object.fromEntries(
          component.cva.flatMap((recipe) => Object.entries(recipe.variants)),
        ),
      });
    }
  }
  for (const selector of supported) {
    if (!map[selector]?.length) {
      throw new Error(`Missing catalog replacement for ${selector}`);
    }
    map[selector].sort((a, b) => {
      if (selector === 'input' && a.name !== b.name) {
        if (a.name === 'Input') {
          return -1;
        }
        if (b.name === 'Input') {
          return 1;
        }
      }
      if (a.importPath < b.importPath) {
        return -1;
      }
      if (a.importPath > b.importPath) {
        return 1;
      }
      return 0;
    });
  }
  return map;
}
