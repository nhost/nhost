// Class -> category for no-restyle (layout, color, typography, spacing, shape, effects, motion,
// declared, unclassified). A class is judged by what it does in this dashboard: the CSS
// properties the dashboard's own Tailwind generates for it. A few groups whose CSS misleads
// keep shadcn-ui/lint's category. Classes Tailwind cannot generate fall back to the
// tailwind-merge class group (the grammar the dashboard's cn() merges with).
// The class-group trie follows shadcn-ui/lint's grammar/classifier.ts (MIT).
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { GROUP_CATEGORY } from './categories.mjs';

export const CATEGORIES = ['color', 'typography', 'spacing', 'shape', 'effects', 'motion'];

// Groups whose generated CSS would put them elsewhere.
const GROUP_OVERRIDE = {
  sr: 'layout', // sets padding, margin and border-width only to hide the element
  'space-x': 'spacing', // margins on children: the gap between them
  'space-y': 'spacing',
  'space-x-reverse': 'spacing',
  'space-y-reverse': 'spacing',
  'ring-w': 'shape', // box-shadow is how Tailwind draws a ring
  'ring-w-inset': 'shape',
  'ring-offset-w': 'shape',
  // Tailwind 3 opacity utilities only set --tw-*-opacity, which the color then reads.
  'placeholder-opacity': 'color',
  'text-opacity': 'color',
  'bg-opacity': 'color',
  'border-opacity': 'color',
  'divide-opacity': 'color',
  'ring-opacity': 'color',
};

// Per CSS property, checked in this order; the first category any property hits wins.
const PROPERTY_RULES = [
  ['color', /(?:^|-)color$|^(?:fill|stroke)$|^--tw-gradient-(?:from|via|to|stops)$/],
  ['typography', /^(?:font|line-height$|letter-spacing$|text-decoration|text-underline|text-transform$|text-overflow$|text-indent$|text-wrap$|word-spacing$|hyphens$|list-style|-webkit-line-clamp$|-webkit-font-smoothing$|-moz-osx-font-smoothing$)/],
  ['spacing', /^(?:padding|gap$|row-gap$|column-gap$|border-spacing$|--tw-border-spacing)/],
  ['shape', /^(?:border(?:-(?:top|right|bottom|left|inline|block|x|y)(?:-(?:start|end))?)?-(?:width|style)$|border-width$|border-style$|border(?:-[a-z-]+)?-radius$|outline|stroke-width$|--tw-ring-(?:shadow|inset|offset-width)$)/],
  ['effects', /^(?:box-shadow$|--tw-shadow$|opacity$|filter$|backdrop-filter$|--tw-(?:blur|brightness|contrast|grayscale|hue-rotate|invert|saturate|sepia|drop-shadow|backdrop-[a-z-]+)$|mix-blend-mode$|background-(?:blend-mode|image|size|position|repeat|attachment|clip|origin)$|text-shadow$|-?(?:webkit-)?mask)/],
  ['motion', /^(?:transition|animation)|^--tw-(?:enter|exit)-/],
];

const MARKER = /^(?:group|peer)(?:\/[\w-]+)?$/;

// Splits "md:hover:!-mt-2" into variants and the base class.
export function splitClass(token) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < token.length; i += 1) {
    const char = token[i];
    if (char === '[' || char === '(') {
      depth += 1;
    } else if (char === ']' || char === ')') {
      depth -= 1;
    } else if (char === ':' && depth === 0) {
      parts.push(token.slice(start, i));
      start = i + 1;
    }
  }
  let base = token.slice(start);
  const important = base.startsWith('!') || base.endsWith('!');
  base = base.replace(/^!|!$/g, '');
  return { variants: parts, base, important };
}

// The base without its opacity or line-height modifier ("bg-primary/50" -> "bg-primary").
function withoutModifier(base) {
  let depth = 0;
  let slash = -1;
  for (let i = 0; i < base.length; i += 1) {
    const char = base[i];
    if (char === '[' || char === '(') {
      depth += 1;
    } else if (char === ']' || char === ')') {
      depth -= 1;
    } else if (char === '/' && depth === 0) {
      slash = i;
    }
  }
  return slash === -1 ? base : base.slice(0, slash);
}

function buildTrie(config) {
  const node = () => ({ next: new Map(), validators: null, group: null });
  const root = node();
  const at = (start, path) => {
    let current = start;
    for (const part of path.split('-')) {
      if (!current.next.has(part)) {
        current.next.set(part, node());
      }
      current = current.next.get(part);
    }
    return current;
  };
  const add = (def, current, group) => {
    if (typeof def === 'string') {
      (def === '' ? current : at(current, def)).group = group;
    } else if (typeof def === 'function') {
      if (def.isThemeGetter) {
        for (const inner of def(config.theme)) {
          add(inner, current, group);
        }
      } else {
        current.validators ??= [];
        current.validators.push({ test: def, group });
      }
    } else {
      for (const [key, defs] of Object.entries(def)) {
        const child = at(current, key);
        for (const inner of defs) {
          add(inner, child, group);
        }
      }
    }
  };
  for (const [group, defs] of Object.entries(config.classGroups)) {
    for (const def of defs) {
      add(def, root, group);
    }
  }
  return root;
}

function walk(root, parts, start) {
  const path = [root];
  let current = root;
  let index = start;
  while (index < parts.length && current.next.has(parts[index])) {
    current = current.next.get(parts[index]);
    path.push(current);
    index += 1;
  }
  let level = path.length - 1;
  if (index === parts.length) {
    if (current.group) {
      return current.group;
    }
    level -= 1;
  }
  for (; level >= 0; level -= 1) {
    for (const { test, group } of path[level].validators ?? []) {
      if (test(parts.slice(start + level).join('-'))) {
        return group;
      }
    }
  }
  return null;
}

// One classifier per dashboard folder (the worktree's, with its node_modules).
export function createClassifier(dashboard, { cssClasses = [] } = {}) {
  const require = createRequire(join(dashboard, 'package.json'));
  const { getDefaultConfig } = require('tailwind-merge');
  const root = buildTrie(getDefaultConfig());
  const declared = new Set(cssClasses);
  let tailwind = null;
  const generate = (base) => {
    if (!tailwind) {
      const resolveConfig = require('tailwindcss/resolveConfig');
      const { createContext } = require('tailwindcss/lib/lib/setupContextUtils.js');
      const { generateRules } = require('tailwindcss/lib/lib/generateRules.js');
      tailwind = { context: createContext(resolveConfig(require(join(dashboard, 'tailwind.config.js')))), generateRules };
    }
    const rules = tailwind.generateRules(new Set([base]), tailwind.context);
    if (rules.length === 0) {
      return null;
    }
    const properties = new Set();
    for (const [, rule] of rules) {
      rule.walkDecls((declaration) => properties.add(declaration.prop));
    }
    return [...properties];
  };
  const groupOf = (base) => {
    if (base.startsWith('[') && base.endsWith(']')) {
      return null;
    }
    const parts = base.split('-');
    const start = parts[0] === '' && parts.length > 1 ? 1 : 0;
    const plain = withoutModifier(base);
    return walk(root, plain.split('-'), start) ?? walk(root, parts, start);
  };
  const memo = new Map();
  const classify = (token) => {
    if (memo.has(token)) {
      return memo.get(token);
    }
    const { base } = splitClass(token.trim());
    const group = groupOf(base);
    const properties = MARKER.test(base) ? [] : generate(base);
    let category;
    if (MARKER.test(base)) {
      category = 'layout';
    } else if (group && GROUP_OVERRIDE[group]) {
      category = GROUP_OVERRIDE[group];
    } else if (properties) {
      category = PROPERTY_RULES.find(([, pattern]) => properties.some((property) => pattern.test(property)))?.[0] ?? 'layout';
    } else if (declared.has(base)) {
      category = 'declared';
    } else if (group && group in GROUP_CATEGORY) {
      category = GROUP_CATEGORY[group] ?? 'layout';
    } else {
      category = 'unclassified';
    }
    const result = { token, base, group, category, generated: properties !== null };
    memo.set(token, result);
    return result;
  };
  return { classify, groupOf };
}
