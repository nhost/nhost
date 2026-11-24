/*
 * MIT-licensed nearest-step policy adapted from shadcn-ui/lint@9a55f6d.
 * Copyright (c) 2026 shadcn. See ../../NOTICE.md.
 */
import type { Tokens } from '../contracts/tokens.mts';
import { normalizeClass } from '../grit/prelude/classes.mts';
import {
  arbitraryCategory,
  arbitraryPropertyCategory,
} from '../grit/rules/no-arbitrary-values.mts';
import { parseColor } from './colors.mts';
import { lengthInPx } from './lengths.mts';
import { nearestColorTokens } from './suggest.mts';

const scales: Record<string, string> = {
  text: 'fontSize',
  rounded: 'borderRadius',
  leading: 'lineHeight',
  tracking: 'letterSpacing',
  border: 'borderWidth',
  divide: 'divideWidth',
  outline: 'borderWidth',
  ring: 'borderWidth',
};
const spacingRoots =
  /^(?:p[xysetrbl]?|gap(?:-[xy])?|space-[xy]|border-spacing(?:-[xy])?)$/;
const propertyRoots: Record<string, string> = {
  color: 'text',
  background: 'bg',
  'background-color': 'bg',
  'border-color': 'border',
  'border-radius': 'rounded',
  'font-size': 'text',
  'line-height': 'leading',
  padding: 'p',
  'padding-top': 'pt',
  'padding-right': 'pr',
  'padding-bottom': 'pb',
  'padding-left': 'pl',
  gap: 'gap',
};

export function suggestArbitraryValue(
  subject: string,
  tokens: Tokens,
): string | null {
  const { base, normalized } = normalizeClass(subject);
  const match = /^([a-z][a-z0-9-]*)-\[([^\]]+)\](.*)$/.exec(normalized);
  const property = /^\[([^:\]]+):([^\]]+)\]$/.exec(normalized);
  const root = match?.[1] ?? propertyRoots[property?.[1] ?? ''];
  const value = match?.[2] ?? property?.[2];
  if (!root || !value) {
    return null;
  }
  const category = match
    ? arbitraryCategory(root, value)
    : arbitraryPropertyCategory(property?.[1] ?? '');
  const before = subject.slice(0, subject.length - base.length);
  const modifier = base.slice(0, base.length - normalized.length);
  const suffix = match?.[3] ?? '';
  const candidate = (name: string) =>
    `${before}${modifier}${root}${name === 'DEFAULT' ? '' : `-${name}`}${suffix}`;
  if (category === 'color') {
    const color = parseColor(value.replace(/^color:/, '').replaceAll('_', ' '));
    if (!color) {
      return null;
    }
    const role = /^(?:text|placeholder|caret|decoration|fill|stroke)$/.test(
      root,
    )
      ? 'text'
      : 'surface';
    const names = nearestColorTokens(color, tokens.colors, role, 1, Infinity);
    return names.length
      ? `Nearest, not exact: ${names.map(candidate).join(' or ')}. Check both themes and contrast.`
      : null;
  }
  const px = lengthInPx(
    value.replace(/^(?:length|size|number):/, '').replaceAll('_', ' '),
  );
  if (px === null) {
    return null;
  }
  const scaleName = spacingRoots.test(root)
    ? 'spacing'
    : Object.entries(scales).find(
        ([prefix]) => root === prefix || root.startsWith(`${prefix}-`),
      )?.[1];
  const scale = scaleName && tokens.scales[scaleName];
  if (!scale) {
    return null;
  }
  const steps = Object.entries(scale)
    // Bare ring is 3px and bare outline selects a style, not borderWidth.DEFAULT.
    .filter(
      ([name, step]) =>
        step.px !== null &&
        !(name === 'DEFAULT' && /^(?:ring|outline)(?:-|$)/.test(root)),
    )
    .map(([name, step]) => ({
      name,
      distance: Math.abs((step.px as number) - px),
    }))
    .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name));
  const first = steps[0];
  if (!first) {
    return null;
  }
  // tailwind-merge 1.14 in cn() does not recognize custom font-size names.
  // It classifies them as text colors, which can silently remove the size.
  const caveat = (names: string[]) => {
    const custom =
      root === 'text' &&
      names.find(
        (name) =>
          name !== 'base' &&
          !/^(?:\d+(?:\.\d+)?)?(?:xs|sm|md|lg|xl)$/.test(name),
      );
    return custom
      ? ` In cn(), tailwind-merge 1.14 treats text-${custom} as a text color and can drop it next to another text-* class; check the merged output.`
      : '';
  };
  if (first.distance < 0.0001) {
    return `Exact scale replacement: ${candidate(first.name)}.${caveat([first.name])}`;
  }
  // Offer one or two adjacent scale steps, without inventing undeclared values.
  const nearest = steps
    .filter(({ distance }) => distance === first.distance)
    .slice(0, 2);
  return `Nearest, not exact: ${nearest.map(({ name }) => candidate(name)).join(' or ')}.${caveat(nearest.map(({ name }) => name))}`;
}
