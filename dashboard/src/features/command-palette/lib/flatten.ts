import type { CommandNode } from '@/features/command-palette/types';

export const flattenTree = (root: CommandNode): CommandNode[] => [
  root,
  ...(root.children ?? []).flatMap(flattenTree),
];

export const flattenSearchableTree = (root: CommandNode): CommandNode[] => [
  root,
  ...(root.searchBoundary
    ? []
    : (root.children ?? []).flatMap(flattenSearchableTree)),
];
