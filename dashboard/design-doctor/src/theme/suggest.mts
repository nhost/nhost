/*
 * MIT-licensed color suggestion algorithm adapted from shadcn-ui/lint@9a55f6d.
 * Copyright (c) 2026 shadcn. See ../../NOTICE.md.
 */
import { createRequire } from 'node:module';
import type { Tokens } from '../contracts/tokens.mts';
import { normalizeClass } from '../grit/prelude/classes.mts';
import { colorDistance, type Lab, parseColor } from './colors.mts';

const require = createRequire(import.meta.url);
const palette = require('tailwindcss/colors.js') as Record<string, unknown>;

export const COLOR_FAMILIES = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
] as const;
export const COLOR_PREFIXES = [
  'ring-offset',
  'border-x',
  'border-y',
  'border-t',
  'border-r',
  'border-b',
  'border-l',
  'border-s',
  'border-e',
  'bg',
  'text',
  'border',
  'divide',
  'ring',
  'outline',
  'accent',
  'caret',
  'placeholder',
  'decoration',
  'fill',
  'stroke',
  'from',
  'via',
  'to',
  'shadow',
] as const;

const PRIORITY = [
  'background',
  'foreground',
  'muted',
  'muted-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'ring',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
];
const priorityOf = (name: string) => {
  const index = PRIORITY.indexOf(name);
  return index === -1 ? PRIORITY.length : index;
};
const preference = (name: string, role: 'text' | 'surface') =>
  role === 'text'
    ? Number(name === 'foreground' || name.endsWith('-foreground'))
    : Number(name !== 'foreground' && !name.endsWith('-foreground'));

export function nearestColorTokens(
  lab: Lab,
  tokens: Tokens['colors'],
  role: 'text' | 'surface',
  limit = 2,
  maxDistance = 0.12,
): string[] {
  const groups = new Map<string, { distance: number; names: string[] }>();
  for (const [name, value] of Object.entries(tokens)) {
    if (!value.valid) {
      continue;
    }
    const distances = [value.light, value.dark]
      .map((color) => color && parseColor(color))
      .filter((color): color is Lab => color !== null)
      .map((color) => colorDistance(lab, color));
    const distance = Math.min(...distances);
    if (distance > maxDistance) {
      continue;
    }
    const key = distance.toFixed(3);
    const group = groups.get(key);
    if (group) {
      group.names.push(name);
    } else {
      groups.set(key, { distance, names: [name] });
    }
  }
  let candidates = [...groups.values()]
    .sort((a, b) => a.distance - b.distance)
    .map(
      ({ names }) =>
        names.sort(
          (a, b) =>
            preference(b, role) - preference(a, role) ||
            priorityOf(a) - priorityOf(b) ||
            a.localeCompare(b),
        )[0],
    );
  if (role === 'surface' && candidates.some((name) => preference(name, role))) {
    candidates = candidates.filter((name) => preference(name, role));
  }
  return candidates.slice(0, limit);
}

export function paletteColor(value: string): Lab | null {
  if (value === 'white' || value === 'black') {
    return parseColor(value);
  }
  const [family, shade] = value.split('-');
  if (!COLOR_FAMILIES.includes(family as (typeof COLOR_FAMILIES)[number])) {
    return null;
  }
  const shades = palette[family];
  return shades && typeof shades === 'object'
    ? parseColor((shades as Record<string, string>)[shade] ?? '')
    : null;
}

export function suggestRawColor(
  subject: string,
  tokens: Tokens,
): string | null {
  const svg =
    /^(?:fill|stroke|color|stopColor|floodColor|lightingColor)=(.*)$/.exec(
      subject,
    );
  const normalized = normalizeClass(subject);
  const match = svg
    ? null
    : new RegExp(`^(${COLOR_PREFIXES.join('|')})-(.+)$`).exec(
        normalized.normalized,
      );
  const value = match?.[2].replace(/\/(?:[\w.%]+|\[[^\]]*\])$/, '') ?? '';
  const lab = svg ? parseColor(svg[1]) : paletteColor(value);
  if (!lab) {
    return null;
  }
  const prefix = match?.[1] ?? 'text';
  const role = /^(?:text|placeholder|caret|decoration|fill|stroke)$/.test(
    prefix,
  )
    ? 'text'
    : 'surface';
  const names = nearestColorTokens(lab, tokens.colors, role);
  if (!names.length) {
    return null;
  }
  if (svg) {
    return `Nearest, not exact: ${names.map((name) => `text-${name}`).join(' or ')} with currentColor. Check paint and contrast in both themes.`;
  }
  const opacity = match?.[2].slice(value.length) ?? '';
  const original = normalized.base;
  const before = subject.slice(0, subject.length - original.length);
  const marker = original.match(/^!?-?/)?.[0] ?? '';
  return `Nearest, not exact: ${names.map((name) => `${before}${marker}${prefix}-${name}${opacity}`).join(' or ')}.`;
}
