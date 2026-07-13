import type { CommandNode } from '@/features/command-palette/types';

export const flattenTree = (root: CommandNode): CommandNode[] => [
  root,
  ...(root.children ?? []).flatMap(flattenTree),
];
