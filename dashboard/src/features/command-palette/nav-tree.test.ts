import { flattenTree } from '@/features/command-palette/lib/flatten';
import { commandPaletteNavTree } from '@/features/command-palette/nav-tree';
import type { NodeKind } from '@/features/command-palette/types';

const validKinds = new Set<NodeKind>([
  'page',
  'group',
  'setting',
  'org',
  'project',
  'doc',
]);

const allNodes = flattenTree(commandPaletteNavTree);

describe('commandPaletteNavTree', () => {
  it('uses globally unique ids', () => {
    const ids = allNodes.map((node) => node.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses only valid node kinds', () => {
    expect(allNodes.every((node) => validKinds.has(node.kind))).toBe(true);
  });

  it('keeps containers and leaves structurally valid', () => {
    const containers = allNodes.filter(
      (node) => (node.children ?? []).length > 0,
    );
    const leaves = allNodes.filter(
      (node) => (node.children ?? []).length === 0,
    );

    expect(containers.every((node) => node.kind === 'group')).toBe(true);
    expect(
      leaves.every(
        (node) =>
          Boolean(node.path) ||
          (node.scope === 'project' && node.id === 'project-overview'),
      ),
    ).toBe(true);
  });

  it('includes the standalone Hasura console route node', () => {
    expect(allNodes.some((node) => node.id === 'project-hasura')).toBe(true);
    expect(allNodes.some((node) => node.path === 'hasura')).toBe(true);
  });
});
