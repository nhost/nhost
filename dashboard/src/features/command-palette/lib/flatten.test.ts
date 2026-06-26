import {
  flattenScope,
  flattenTree,
} from '@/features/command-palette/lib/flatten';
import type { CommandNode } from '@/features/command-palette/types';

const tree: CommandNode = {
  id: 'root',
  title: 'Root',
  kind: 'group',
  children: [
    {
      id: 'project',
      title: 'Project',
      kind: 'group',
      children: [
        {
          id: 'project-overview',
          title: 'Overview',
          kind: 'page',
          path: '',
          scope: 'project',
        },
      ],
    },
    {
      id: 'docs',
      title: 'Docs',
      kind: 'doc',
      path: 'https://docs.nhost.io',
      scope: 'external',
    },
  ],
};

describe('flatten helpers', () => {
  it('flattens the full tree in pre-order', () => {
    expect(flattenTree(tree).map((node) => node.id)).toEqual([
      'root',
      'project',
      'project-overview',
      'docs',
    ]);
  });

  it('returns the direct children for a drill scope', () => {
    expect(flattenScope(tree).map((node) => node.id)).toEqual([
      'project',
      'docs',
    ]);
  });

  it('returns an empty scope for leaves', () => {
    expect(flattenScope(tree.children?.[1] as CommandNode)).toEqual([]);
  });
});
