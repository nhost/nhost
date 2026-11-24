import postcss from 'postcss';

export interface CssVariable {
  light: string | null;
  dark: string | null;
}

export function cssVariables(css: string): Record<string, CssVariable> {
  const variables: Record<string, CssVariable> = {};
  postcss.parse(css).walkRules((rule) => {
    const selectors = rule.selectors;
    // Only exact theme selectors: descendant rules and :root under another theme do not define tokens.
    const theme = selectors.includes(':root')
      ? 'light'
      : selectors.includes('.dark')
        ? 'dark'
        : null;
    if (!theme) {
      return;
    }
    rule.walkDecls(/^--/, (decl) => {
      const key = decl.prop.slice(2);
      variables[key] ??= { light: null, dark: null };
      variables[key][theme] = decl.value.trim();
    });
  });
  return variables;
}

export function substituteVars(
  value: string,
  vars: Record<string, CssVariable>,
  theme: 'light' | 'dark',
  seen = new Set<string>(),
): string | null {
  let result = value;
  const reference = /var\(--([\w-]+)(?:,\s*([^()]+))?\)/;
  while (reference.test(result)) {
    const match = reference.exec(result);
    if (!match) {
      break;
    }
    const name = match[1];
    if (seen.has(name)) {
      return null;
    }
    const raw = vars[name]?.[theme] ?? vars[name]?.light ?? match[2];
    if (!raw) {
      return null;
    }
    const next = substituteVars(raw, vars, theme, new Set([...seen, name]));
    if (next === null) {
      return null;
    }
    result =
      result.slice(0, match.index) +
      next +
      result.slice(match.index + match[0].length);
  }
  return result;
}
