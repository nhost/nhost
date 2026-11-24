import type { Tokens } from '../contracts/tokens.mts';
import { normalizeColor } from '../theme/color-normalize.mts';
import { parseColor } from '../theme/colors.mts';
import { cssVariables, substituteVars } from '../theme/css-vars.mts';
import { lengthInPx } from '../theme/lengths.mts';

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export function sorted<T>(entries: [string, T][]): Record<string, T> {
  return Object.fromEntries(entries.sort(([a], [b]) => compare(a, b)));
}

function flattenColors(
  source: Record<string, unknown>,
  prefix = '',
): [string, string][] {
  return Object.entries(source).flatMap(([key, value]) => {
    const name = key === 'DEFAULT' ? prefix : prefix ? `${prefix}-${key}` : key;
    if (typeof value === 'string') {
      return [[name, value]];
    }
    if (value && typeof value === 'object') {
      return flattenColors(value as Record<string, unknown>, name);
    }
    return [];
  });
}

function resolvedColor(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const candidate = value.replace(/\s*\/\s*<alpha-value>/, '');
  return (
    normalizeColor(candidate) ?? (parseColor(candidate) ? candidate : null)
  );
}

const scaleNames = [
  'spacing',
  'borderRadius',
  'fontSize',
  'lineHeight',
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'margin',
  'padding',
  'borderWidth',
  'divideWidth',
] as const;

export function buildTokens(
  declared: Record<string, unknown>,
  theme: Record<string, unknown>,
  css: string,
): Tokens {
  const variables = cssVariables(css);
  const colors = sorted(
    flattenColors(declared).map(([name, expression]) => {
      const light = substituteVars(expression, variables, 'light');
      const dark = substituteVars(expression, variables, 'dark');
      const lightColor = resolvedColor(light);
      const darkColor = resolvedColor(dark);
      return [
        name,
        {
          expression,
          light: lightColor,
          dark: darkColor,
          themeAware: expression.includes('var(') && lightColor !== darkColor,
          valid: lightColor !== null || darkColor !== null,
        },
      ];
    }),
  );
  const scales = sorted(
    scaleNames.map((name) => {
      const values = (theme[name] ?? {}) as Record<string, unknown>;
      return [
        name,
        sorted(
          Object.entries(values).flatMap(([key, raw]) => {
            const value = Array.isArray(raw) ? raw[0] : raw;
            if (typeof value !== 'string') {
              return [];
            }
            const px = lengthInPx(
              substituteVars(value, variables, 'light') ?? value,
            );
            return [
              [key, { value, px: px === null ? null : Number(px.toFixed(4)) }],
            ] as [string, { value: string; px: number | null }][];
          }),
        ),
      ];
    }),
  );
  return {
    schemaVersion: 1,
    colors,
    cssVariables: sorted(Object.entries(variables)),
    scales,
  };
}
