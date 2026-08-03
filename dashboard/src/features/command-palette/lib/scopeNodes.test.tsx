import { buildOrgProjectNodes } from '@/features/command-palette/lib/scopeNodes';
import type { CommandNode, PaletteOrg } from '@/features/command-palette/types';

const overview: CommandNode = {
  id: 'project-overview',
  title: 'Overview',
  kind: 'page',
  path: '',
  scope: 'project',
};

const settingsChild: CommandNode = {
  id: 'project-settings-jwt',
  title: 'JWT',
  kind: 'setting',
  path: 'settings/jwt',
  scope: 'project',
  breadcrumb: ['Project Settings'],
};

const settingsGroup: CommandNode = {
  id: 'project-settings',
  title: 'Project Settings',
  kind: 'group',
  path: 'settings',
  scope: 'project',
  children: [settingsChild],
};

const orgProjects: CommandNode = {
  id: 'org-projects',
  title: 'Projects',
  kind: 'org',
  path: 'projects',
  scope: 'org',
};

const tree: CommandNode = {
  id: 'root',
  title: 'Root',
  kind: 'group',
  children: [
    {
      id: 'project-pages',
      title: 'Project pages',
      kind: 'group',
      children: [overview, settingsGroup],
    },
    {
      id: 'org-pages',
      title: 'Organization pages',
      kind: 'group',
      children: [orgProjects],
    },
  ],
};

const orgs: PaletteOrg[] = [
  { slug: 'acme', name: 'Acme', apps: [{ name: 'Shop', subdomain: 'shop' }] },
];

describe('buildOrgProjectNodes', () => {
  it('marks project nodes as search boundaries with fully cloned page trees', () => {
    const [, shop] = buildOrgProjectNodes(orgs, tree);

    expect(shop.searchBoundary).toBe(true);
    expect(shop.children?.map((child) => child.id)).toEqual([
      'switch:project:acme:shop:project-overview',
      'switch:project:acme:shop:project-settings',
    ]);

    const settingsClone = shop.children?.[1];
    const jwtClone = settingsClone?.children?.[0];

    expect(jwtClone?.id).toBe('switch:project:acme:shop:project-settings-jwt');
    expect(jwtClone?.path).toBe('settings/jwt');
    expect(jwtClone?.breadcrumb).toEqual(['Project Settings']);
    expect(jwtClone?.commandPalette).toEqual({
      originalNode: settingsChild,
      orgSlug: 'acme',
      appSubdomain: 'shop',
    });
  });

  it('anchors org and project nodes to their generic navigation nodes', () => {
    const [acme, shop] = buildOrgProjectNodes(orgs, tree);

    expect(acme.commandPalette?.originalNode).toBe(orgProjects);
    expect(acme.commandPalette?.orgSlug).toBe('acme');
    expect(acme.commandPalette?.appSubdomain).toBeUndefined();
    expect(shop.commandPalette?.originalNode).toBe(overview);
    expect(shop.commandPalette?.orgSlug).toBe('acme');
    expect(shop.commandPalette?.appSubdomain).toBe('shop');
  });
});
