/*
 * MIT-licensed category policy adapted from shadcn-ui/lint@9a55f6d.
 * Copyright (c) 2026 shadcn. See ../../../NOTICE.md.
 */
import { createRequire } from 'node:module';
import { parseColor } from '../../theme/colors.mts';
import { emitClassRule, normalizeClass } from '../prelude/classes.mts';

const require = createRequire(import.meta.url);
type Category =
  | 'layout'
  | 'spacing'
  | 'typography'
  | 'color'
  | 'shape'
  | 'effects'
  | 'motion';

// Explicit v3 root inventory. Unknown dynamic roots are a generation error,
// rather than silently classifying a newly installed Tailwind plugin as layout.
const roots: Record<Category, string> = {
  layout:
    'inset inset-x inset-y start end top right bottom left z order col col-start col-end row row-start row-end m mx my ms me mt mr mb ml flex aspect size h max-h min-h w min-w max-w flex-shrink shrink flex-grow grow basis origin translate-x translate-y rotate skew-x skew-y scale scale-x scale-y cursor scroll-m scroll-mx scroll-my scroll-ms scroll-me scroll-mt scroll-mr scroll-mb scroll-ml scroll-p scroll-px scroll-py scroll-ps scroll-pe scroll-pt scroll-pr scroll-pb scroll-pl object columns auto-cols auto-rows grid-cols grid-rows align will-change content',
  spacing:
    'border-spacing border-spacing-x border-spacing-y gap gap-x gap-y space-x space-y p px py ps pe pt pr pb pl',
  typography:
    'line-clamp list list-image indent font text leading tracking decoration underline-offset',
  color: 'fill from via to placeholder caret accent',
  shape:
    'rounded rounded-s rounded-e rounded-t rounded-r rounded-b rounded-l rounded-ss rounded-se rounded-ee rounded-es rounded-tl rounded-tr rounded-br rounded-bl border border-x border-y border-s border-e border-t border-r border-b border-l divide-x divide-y divide outline outline-offset ring ring-offset stroke',
  effects:
    'bg bg-opacity border-opacity divide-opacity placeholder-opacity ring-opacity text-opacity opacity shadow blur brightness contrast drop-shadow grayscale hue-rotate invert saturate sepia backdrop-blur backdrop-brightness backdrop-contrast backdrop-grayscale backdrop-hue-rotate backdrop-invert backdrop-opacity backdrop-saturate backdrop-sepia',
  motion:
    'animate transition delay duration ease animate-delay fade-in fade-out zoom-in zoom-out spin-in spin-out slide-in-from-top slide-in-from-bottom slide-in-from-left slide-in-from-right slide-out-to-top slide-out-to-bottom slide-out-to-left slide-out-to-right fill-mode direction repeat',
};
const rootCategory = new Map<string, Category>();
for (const [category, values] of Object.entries(roots)) {
  for (const root of values.split(' ')) {
    if (rootCategory.has(root)) {
      throw new Error(`Duplicate arbitrary root: ${root}`);
    }
    rootCategory.set(root, category as Category);
  }
}

export function probeArbitraryRoots(config: unknown): string[] {
  const { createContext } =
    require('tailwindcss/lib/lib/setupContextUtils.js') as {
      createContext: (config: unknown) => {
        candidateRuleMap: Map<string, [unknown, unknown][]>;
      };
    };
  const context = createContext(config);
  return [...context.candidateRuleMap]
    .filter(
      ([name, rules]) =>
        typeof name === 'string' &&
        rules.some(([, value]) => typeof value === 'function'),
    )
    .map(([name]) => name)
    .sort();
}

export function categoriesFor(
  accepted: readonly string[],
): Record<Category, string[]> {
  const missing = accepted.filter((root) => !rootCategory.has(root));
  if (missing.length) {
    throw new Error(
      `Unmapped Tailwind v3 arbitrary roots: ${missing.join(', ')}`,
    );
  }
  const available = new Set(accepted);
  return Object.fromEntries(
    Object.entries(roots).map(([category, values]) => [
      category,
      values
        .split(' ')
        .filter((root) => available.has(root))
        .sort(),
    ]),
  ) as Record<Category, string[]>;
}

// Ambiguous v3 roots resolve by type hint and value shape, not only their name.
export function arbitraryCategory(
  root: string,
  value: string,
): Category | null {
  const category = rootCategory.get(root);
  if (!category) {
    return null;
  }
  const hint = /^(color|length|size|image|position|shadow|number):/.exec(
    value,
  )?.[1];
  const color =
    hint === 'color' || parseColor(value.replaceAll('_', ' ')) !== null;
  if (root === 'text') {
    return color ? 'color' : 'typography';
  }
  if (root === 'bg') {
    return color ? 'color' : 'effects';
  }
  if (
    /^(?:border(?:-[xystrebl])?|divide|outline|ring|ring-offset|stroke)$/.test(
      root,
    )
  ) {
    return color ? 'color' : 'shape';
  }
  if (root === 'shadow' || root === 'drop-shadow') {
    return color ? 'color' : 'effects';
  }
  if (root === 'decoration') {
    return color ? 'color' : 'typography';
  }
  return category;
}

// Shared by the Grit property branch and the future unknown-class ownership
// check: CSS properties outside these families (e.g. text-align and
// border-collapse) remain layout/unclaimed.
export const propertyPatterns: Record<Exclude<Category, 'layout'>, string> = {
  color: '(?:[a-z-]*-)?color|background|fill|stroke',
  spacing:
    'padding(?:-[a-z-]+)?|gap|row-gap|column-gap|border-spacing(?:-[xy])?',
  typography:
    'font(?:-[a-z-]+)?|letter-spacing|line-height|text-decoration(?:-[a-z-]+)?|text-transform|text-indent|text-underline(?:-[a-z-]+)?|word-spacing|list-style(?:-[a-z-]+)?',
  shape:
    'border(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?(?:-(?:width|style|radius))?|border-[a-z-]+-radius|outline(?:-[a-z-]+)?|--tw-ring-width|--tw-ring-inset',
  effects:
    'box-shadow|text-shadow|opacity|filter|backdrop-filter|mix-blend-mode|background-blend-mode',
  motion: 'transition(?:-[a-z-]+)?|animation(?:-[a-z-]+)?',
};
export function arbitraryPropertyCategory(property: string): Category {
  return (
    (Object.entries(propertyPatterns).find(([, pattern]) =>
      new RegExp(`^(?:${pattern})$`).test(property),
    )?.[0] as Category | undefined) ?? 'layout'
  );
}

// Future no-unknown-classes uses this ownership boundary: arbitrary variants
// alone and layout utilities do not belong to this detector.
export function claimedByArbitraryValues(token: string): boolean {
  const { normalized } = normalizeClass(token);
  if (/^\[([^:\]]+):[^\]]+\]$/.test(normalized)) {
    const [, property] = /^\[([^:\]]+):/.exec(normalized) ?? [];
    return (
      arbitraryPropertyCategory(property) !== 'layout' &&
      !/^\[[^:]+:var\(--[^)]+\)\]$/.test(normalized) &&
      !(
        arbitraryPropertyCategory(property) === 'color' &&
        /^\[[^:]+:(?:rgb|hsl|hwb|oklch|oklab)\(var\(--[^)]+\)(?:\/[^)]+)?\)\]$/.test(
          normalized,
        )
      )
    );
  }
  const match = /^([a-z][a-z0-9-]*)-\[([^\]]+)\](?:\/[^\s]+)?$/.exec(
    normalized,
  );
  return Boolean(
    match &&
      !/^(?:(?:[a-z]+:)?var\(--[^)]+\)|--[A-Za-z0-9_-]+)$/.test(match[2]) &&
      !/^(?:rgb|hsl|hwb|oklch|oklab)\(var\(--[^)]+\)(?:\/[^)]+)?\)$/.test(
        match[2],
      ) &&
      arbitraryCategory(match[1], match[2]) !== null &&
      arbitraryCategory(match[1], match[2]) !== 'layout',
  );
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function arbitraryClaim(accepted: readonly string[]): string {
  const categories = categoriesFor(accepted);
  const appearance = Object.entries(categories)
    .filter(([category]) => category !== 'layout')
    .flatMap(([, values]) => values)
    .sort((a, b) => b.length - a.length || a.localeCompare(b));
  const rootsPattern = appearance.map(escapeRegex).join('|');
  // Reject CSS variables without rejecting literal colors in arbitrary values.
  const propertyPattern = `(?:${Object.values(propertyPatterns).join('|')})`;
  return `$part <: class_normalized($normal), or {
      $normal <: r"^(?:${rootsPattern})-\\[[^\\]]+\\](?:/[^ ]+)?$",
      $normal <: r"^\\[${propertyPattern}:[^\\]]+\\]$"
    },
    not { $normal <: r"^.*-\\[(?:(?:[a-z]+:)?var\\(--[^)]+\\)|--[A-Za-z0-9_-]+)\\](?:/[^ ]+)?$" },
    not { $normal <: r"^\\[[^:]+:var\\(--[^)]+\\)\\]$" },
    not { $normal <: r"^.*-\\[(?:rgb|hsl|hwb|oklch|oklab)\\(var\\(--[^)]+\\)(?:/[^)]+)?\\)\\](?:/[^ ]+)?$" },
    not { $normal <: r"^\\[(?:${propertyPatterns.color}):(?:rgb|hsl|hwb|oklch|oklab)\\(var\\(--[^)]+\\)(?:/[^)]+)?\\)\\]$" }`;
}

export function emitArbitraryValues(accepted: readonly string[]): string {
  return emitClassRule('no-arbitrary-values', {
    gateLevels: [['[']],
    // Tailwind separates class tokens on whitespace; multi-part arbitrary
    // values use underscores, not literal spaces inside one class token.
    bracketAware: false,
    predicate: arbitraryClaim(accepted),
    guidance:
      'Arbitrary appearance value. Use a declared v3 token or scale; see pnpm design-doctor for exact or nearest (not exact) replacements in generated/tokens.md.',
  });
}
