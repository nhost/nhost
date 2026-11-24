/*
 * MIT-licensed rule policy adapted from shadcn-ui/lint@9a55f6d.
 * Copyright (c) 2026 shadcn. See ../../../NOTICE.md.
 */
import { namedColors } from '../../theme/colors.mts';

const id = 'no-inline-styles';
const docs = `design-doctor/docs/rules/${id}.md`;
// Biome inserts trailing commas when formatting nested expressions across lines.
// Normalize those as well as whitespace so reformatting cannot change a baseline key.
const flatten = (text: string) => {
  let result = `join(split(join(split(join(split(${text}, "\\n"), ""), "\t"), ""), " "), "")`;
  for (const closing of ['}', ']', ')']) {
    result = `join(split(${result}, ",${closing}"), "${closing}")`;
  }
  return result;
};
const diagnostic = (span: string, subject: string, guidance: string) =>
  `register_diagnostic(span=${span}, message=\`[design/${id}] "${subject}" ${guidance} Docs: ${docs}\`, severity="warn")`;

// The name is compared on a syntax node, not source text: braces, type assertions
// and parentheses can all surround the object without changing its members.
const object = `pattern style_object() { or {
  JsObjectExpression(),
  TsAsExpression(expression=$inner) where { $inner <: style_object() },
  TsSatisfiesExpression(expression=$inner) where { $inner <: style_object() },
  JsParenthesizedExpression(expression=$inner) where { $inner <: style_object() }
} }`;
export const allowedStyleNames = [
  'floatingStyles',
  'provided.draggableProps.style',
  'style',
  'props.style',
] as const;
const allowed = `^(?:${allowedStyleNames.map((name) => name.replaceAll('.', '\\.')).join('|')})$`;
const allowedStyle = `pattern allowed_style() { or {
  JsIdentifierExpression() as $leaf where { $leaf <: r"${allowed}" },
  JsStaticMemberExpression() as $leaf where { $leaf <: r"${allowed}" },
  TsAsExpression(expression=$inner) where { $inner <: allowed_style() },
  TsSatisfiesExpression(expression=$inner) where { $inner <: allowed_style() },
  JsParenthesizedExpression(expression=$inner) where { $inner <: allowed_style() }
} }`;
const propertyGuidance =
  "Inline property bypasses design tokens. Use a Tailwind v3 class; for dynamic values use style={{ '--x': value }} with w-[var(--x)]. Colors are defined in design-doctor/generated/tokens.md.";
const colorGuidance =
  'Literal color in a custom property bypasses the theme. Use a declared color from design-doctor/generated/tokens.md instead of injecting a raw color.';
const dynamicGuidance =
  "Unreadable style cannot be checked for tokens. Use classes, or style={{ '--x': value }} with w-[var(--x)] for dynamic values; see design-doctor/generated/tokens.md.";

// A leaf must be literal syntax; identifiers, interpolations and var() references
// are not resolved. Split template chunks are judged separately, not joined.
const color = `pattern literal_color() { or {
  r"(?i)[\\s\\S]*#[0-9a-f]{3,8}(?:[^0-9a-f]|$)[\\s\\S]*",
  r"(?i)[\\s\\S]*(?:rgb|rgba|hsl|hsla|hwb|oklch|oklab|lab|lch|color|color-mix|light-dark)\\([a-z0-9.% ,/+\\-]+\\)[\\s\\S]*",
  r"(?i)[\\s\\S]*(?:^|[^a-z-])(?:${namedColors.join('|')})(?:[^a-z-]|$)[\\s\\S]*"
} }`;

// Compare the exact JSX style expression with this member's object, allowing
// three layers of type assertion, satisfies or parentheses. An ancestry-only
// guard mistakes the host JSX's enclosing render/column object for a nested
// style object; a parameterized recursive Grit pattern overflows Biome's stack.
function objectAtExpression(depth: number): string {
  if (depth === 0) {
    return '$obj';
  }
  const inner = objectAtExpression(depth - 1);
  return `or { $obj, TsAsExpression(expression=${inner}), TsSatisfiesExpression(expression=${inner}), JsParenthesizedExpression(expression=${inner}) }`;
}

export function emitInlineStyles(): string {
  const memberContext = `$member <: within JsObjectExpression(members=$members) as $obj,
    $members <: some $member,
    $obj <: within JsxExpressionAttributeValue(expression=$expr),
    $expr <: ${objectAtExpression(3)},
    $member <: within JsxAttribute(name="style")`;
  const ordinary = `JsPropertyObjectMember(name=$name, value=$value) as $member where {
    ${memberContext},
    or {
      $name <: r"^['\\x22](--[^'\\x22]+)['\\x22]$"($custom) where {
        not { $value <: JsCallExpression() },
        $value <: contains or { JsStringLiteralExpression() as $leaf, JsTemplateChunkElement() as $leaf } where { $leaf <: literal_color() },
        ${diagnostic('$member', '$custom', colorGuidance)}
      },
      $name <: r"^[\\s\\S]+$" where {
        not { $name <: r"^['\\x22]--[^'\\x22]+['\\x22]$" },
        not { $name <: JsComputedMemberName() },
        or {
          $name <: r"^['\\x22]([^'\\x22]+)['\\x22]$"($label),
          $label = ${flatten('$name')}
        },
        ${diagnostic('$member', '$label', propertyGuidance)}
      },
      $name <: JsComputedMemberName() where {
        ${diagnostic('$member', '[computed]', dynamicGuidance)}
      }
    }
  }`;
  const shorthand = `JsShorthandPropertyObjectMember(name=$name) as $member where {
    ${memberContext},
    $label = ${flatten('$name')},
    ${diagnostic('$member', '$label', propertyGuidance)}
  }`;
  const spread = `JsSpread(argument=$arg) as $member where {
    ${memberContext},
    not { $arg <: r"${allowed}" },
    $label = ${flatten('$arg')},
    ${diagnostic('$member', '...$label', dynamicGuidance)}
  }`;
  const dynamic = `JsxAttribute(name="style", initializer=$init) as $attr where {
    or {
      $init <: contains JsxString() where {
        ${diagnostic('$attr', 'style', dynamicGuidance)}
      },
      $init <: contains JsxExpressionAttributeValue(expression=$expr) where {
        not { $expr <: style_object() },
        not { $expr <: allowed_style() },
        not { $expr <: r"^(?:null|undefined)$" },
        or {
          $expr <: JsCallExpression(callee=$callee) where {
            $label = ${flatten('$callee')},
            ${diagnostic('$attr', '$label()', dynamicGuidance)}
          },
          $expr <: r"[\\s\\S]+" where {
            $label = ${flatten('$expr')},
            ${diagnostic('$attr', '$label', dynamicGuidance)}
          }
        }
      }
    }
  }`;
  const elementGuidance =
    'Style elements inject CSS outside the design system. Use classes or declare shared rules in src/styles/globals.css.';
  const element = `JsxOpeningElement(name="style") as $node where {
    ${diagnostic('$node', '<style>', elementGuidance)}
  }`;
  const emptyElement = `JsxSelfClosingElement(name="style") as $node where {
    ${diagnostic('$node', '<style>', elementGuidance)}
  }`;
  return `language js\n\n${object}\n${allowedStyle}\n${color}\n\nor {\n  ${ordinary},\n  ${shorthand},\n  ${spread},\n  ${dynamic},\n  ${element},\n  ${emptyElement}\n}\n`;
}
