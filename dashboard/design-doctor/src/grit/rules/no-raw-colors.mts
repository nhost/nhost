/*
 * MIT-licensed color detection adapted from shadcn-ui/lint@9a55f6d.
 * Copyright (c) 2026 shadcn. See ../../../NOTICE.md.
 */
import type { Tokens } from '../../contracts/tokens.mts';
import { namedColors } from '../../theme/colors.mts';
import { COLOR_FAMILIES, COLOR_PREFIXES } from '../../theme/suggest.mts';
import { emitClassRule } from '../prelude/classes.mts';

const prefix = `(?:${COLOR_PREFIXES.join('|')})`;
const shade = '(?:50|100|200|300|400|500|600|700|800|900|950)';
const family = `(?:${COLOR_FAMILIES.join('|')})`;
const palette = `(?:${family}-${shade}|white|black)`;
const opacity = '(?:/(?:[\\w.%]+|\\[[^\\]]*\\]))?';
const escapeRegex = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Ownership is deliberately limited to the palette tokens this rule reports.
// no-unknown-classes checks all other unknown classes, including undeclared color-shaped
// utilities, so the two detectors never duplicate a class-token finding.
export function claimedByRawColors() {
  return {
    vocabulary: {
      families: COLOR_FAMILIES,
      prefixes: COLOR_PREFIXES,
      shades: shade,
      svg: namedColors,
    },
    grit: `$part <: class_normalized($normal), $normal <: r"^${prefix}-${palette}${opacity}$"`,
  };
}

const svgNames = 'fill|stroke|color|stopColor|floodColor|lightingColor';
export function svgAllowedVariables(tokens: Tokens): string[] {
  const declaredVars = Object.values(tokens.colors)
    .filter((color) => color.valid)
    .flatMap((color) =>
      [...color.expression.matchAll(/var\(--([a-zA-Z0-9-]+)\)/g)].map(
        (match) => match[1],
      ),
    );
  return [...new Set(declaredVars)].sort();
}

export function emitRawColors(tokens: Tokens): string {
  const { grit } = claimedByRawColors();
  const staticColor = `(?:#[0-9a-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla|hwb|oklch|oklab|lab|lch|color|color-mix)\\([^'\\x22]*\\)|(?:${namedColors.join('|')}))`;
  const declared = svgAllowedVariables(tokens).map(escapeRegex).join('|');
  // Biome's attribute initializer includes the leading '='. Only static
  // strings are judged; expression props and component enum props are not.
  const svg = `JsxAttribute(name=$name, initializer=$initializer) as $attr where {
  $name <: or { ${svgNames
    .split('|')
    .map((name) => `"${name}"`)
    .join(', ')} },
  $attr <: within or { JsxOpeningElement(name=$tag), JsxSelfClosingElement(name=$tag) },
  $tag <: r"^[a-z][a-z0-9:-]*$",
  or {
    $initializer <: r"^=['\\x22](${staticColor})['\\x22]$"($color)
  },
  not { $color <: r"^hsl\\(var\\(--(?:${declared})\\)\\)$" },
  register_diagnostic(span=$attr, message=\`[design/no-raw-colors] "$name=$color" Literal SVG color. Use currentColor with a text token class or a declared CSS color variable (hsl(var(--name)) for channel variables); declare tokens in tailwind.config.js theme.extend.colors and src/styles/globals.css. Docs: design-doctor/docs/rules/no-raw-colors.md\`, severity="warn")
}`;
  return emitClassRule('no-raw-colors', {
    predicate: grit,
    gateLevels: [['-'], ['00', '50', 'white', 'black']],
    substrings: [
      ...COLOR_FAMILIES.map((name) => `-${name}-`),
      '-white',
      '-black',
    ],
    bracketAware: false,
    guidance:
      'Raw palette color. See pnpm design-doctor for nearest (not exact) tokens; declare colors in tailwind.config.js theme.extend.colors and CSS variables in src/styles/globals.css.',
    extraBranch: svg,
  });
}
