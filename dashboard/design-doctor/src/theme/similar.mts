/*
 * MIT-licensed spelling distance adapted from shadcn-ui/lint@9a55f6d.
 * Copyright (c) 2026 shadcn. See ../../NOTICE.md.
 */
import { normalizeClass } from '../grit/prelude/classes.mts';

// Adjacent transpositions count as one edit, as in shadcn's similar.ts.
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const columns = b.length + 1;
  const matrix = Array.from({ length: rows }, (_, index) => {
    const row = new Array<number>(columns).fill(0);
    row[0] = index;
    return row;
  });
  for (let index = 0; index < columns; index++) {
    matrix[0][index] = index;
  }
  for (let row = 1; row < rows; row++) {
    for (let column = 1; column < columns; column++) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost,
      );
      if (
        row > 1 &&
        column > 1 &&
        a[row - 1] === b[column - 2] &&
        a[row - 2] === b[column - 1]
      ) {
        matrix[row][column] = Math.min(
          matrix[row][column],
          matrix[row - 2][column - 2] + 1,
        );
      }
    }
  }
  return matrix[rows - 1][columns - 1];
}

export function didYouMean(
  value: string,
  candidates: Iterable<string>,
  budget = value.length < 6 ? 1 : 2,
): string | null {
  if (value.length < 3) {
    return null;
  }
  let best: { name: string; distance: number } | null = null;
  for (const name of candidates) {
    if (name === value) {
      return null;
    }
    if (Math.abs(name.length - value.length) > budget) {
      continue;
    }
    const distance = editDistance(value, name);
    if (distance > budget) {
      continue;
    }
    if (
      !best ||
      distance < best.distance ||
      (distance === best.distance && name < best.name)
    ) {
      best = { name, distance };
    }
  }
  return best?.name ?? null;
}

const colorUtility =
  /^(?:bg|text|border|ring|outline|placeholder|caret|accent|fill|stroke|from|via|to|decoration)-/;
const fontScale = /^text-(?:xs|sm|md|base|lg|[0-9]+xl)(?:[+-])?$/;
const widthScale = /^(?:border|ring|outline)-(?:[0-9]+(?:\.[0-9]+)?|px)$/;

export function suggestUnknownClass(
  subject: string,
  candidates: Iterable<string>,
  variants: Iterable<string> = [],
): string {
  const { normalized, variants: segments } = normalizeClass(subject);
  if (segments.length) {
    const names = [...variants];
    const correction = segments
      .map((segment) => ({ segment, candidate: didYouMean(segment, names) }))
      .find(({ candidate }) => candidate);
    const hint = correction
      ? ` Did you mean ${correction.candidate} instead of ${correction.segment}?`
      : '';
    return `Use an existing Tailwind v3 variant, or add one with a plugin or addVariant in tailwind.config.js.${hint}`;
  }
  if (
    colorUtility.test(normalized) &&
    !fontScale.test(normalized) &&
    !widthScale.test(normalized)
  ) {
    return 'If this is a color, declare the token in tailwind.config.js theme.extend.colors and its CSS variable in src/styles/globals.css (v3); an undeclared token generates no CSS.';
  }
  if (normalized === 'text-md') {
    return 'Tailwind v3 uses text-base for its 1rem font size; verify that size is intended.';
  }
  const eligible = [...candidates].filter((name) => !name.startsWith('-'));
  const width = /^(border|ring|outline)-(\d+(?:\.\d+)?)$/.exec(normalized);
  let steps: { name: string; distance: number }[] = [];
  if (width) {
    const shape = new RegExp(`^${width[1]}-(\\d+(?:\\.\\d+)?)$`);
    steps = eligible
      .flatMap((name) => {
        const match = shape.exec(name);
        return match
          ? [{ name, distance: Math.abs(Number(match[1]) - Number(width[2])) }]
          : [];
      })
      .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name));
  }
  const suggestion =
    steps[0]?.name ??
    didYouMean(
      normalized,
      fontScale.test(normalized)
        ? eligible.filter((name) => fontScale.test(name))
        : eligible,
    );
  if (!suggestion) {
    return 'Check the generated token catalog or ask design for a supported utility.';
  }
  const prefix = subject.slice(0, subject.length - normalized.length);
  return `Did you mean ${prefix}${suggestion}? Verify that this is the intended v3 utility.`;
}
