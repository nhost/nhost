import type { CommandNode } from '@/features/command-palette/types';

export const flattenTree = (root: CommandNode): CommandNode[] => {
  const result: CommandNode[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const node = stack.shift();

    if (!node) {
      continue;
    }

    result.push(node);
    stack.unshift(...(node.children ?? []));
  }

  return result;
};

export const flattenScope = (node: CommandNode): CommandNode[] =>
  node.children ?? [];
