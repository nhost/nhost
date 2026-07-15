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
    // Same predicate the search machinery uses for "has a destination".
    expect(leaves.every((node) => node.path !== undefined)).toBe(true);
  });

  it('stamps breadcrumb trails from navigable ancestors only', () => {
    const byId = new Map(allNodes.map((node) => [node.id, node]));

    expect(byId.get('project-graphql-metadata')?.breadcrumb).toEqual([
      'GraphQL',
    ]);
    expect(byId.get('project-settings-database')?.breadcrumb).toEqual([
      'Settings (Project)',
    ]);
    expect(byId.get('project-database-browser')?.breadcrumb).toEqual([
      'Database',
    ]);
    // Structural groups have no path, so top-level pages carry no trail.
    expect(byId.get('project-graphql')?.breadcrumb).toBeUndefined();
    expect(byId.get('org-settings')?.breadcrumb).toBeUndefined();
    expect(byId.get('docs')?.breadcrumb).toBeUndefined();
  });

  it('includes the standalone Hasura console route node', () => {
    expect(allNodes.some((node) => node.id === 'project-hasura')).toBe(true);
    expect(allNodes.some((node) => node.path === 'hasura')).toBe(true);
  });

  it('gates every org page off-platform', () => {
    const orgNodes = allNodes.filter((node) => node.kind === 'org');

    expect(orgNodes.length).toBeGreaterThan(0);
    expect(orgNodes.every((node) => node.gate === 'platform')).toBe(true);
  });
});
