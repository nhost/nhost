import { CircleHelpIcon, CircleUserIcon } from 'lucide-react';

import { flattenTree } from '@/features/command-palette/lib/flatten';
import { commandPaletteNavTree } from '@/features/command-palette/nav-tree';

const allNodes = flattenTree(commandPaletteNavTree);

describe('commandPaletteNavTree', () => {
  it('uses globally unique ids', () => {
    const ids = allNodes.map((node) => node.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('orders and configures platform root utility commands', () => {
    const rootChildren = commandPaletteNavTree.children ?? [];

    expect(rootChildren.slice(-3).map((node) => node.id)).toEqual([
      'account-settings',
      'support',
      'docs',
    ]);

    const accountSettings = rootChildren.find(
      (node) => node.id === 'account-settings',
    );
    expect(accountSettings).toMatchObject({
      id: 'account-settings',
      title: 'Account Settings',
      kind: 'page',
      path: '/account',
      keywords: ['account', 'profile', 'settings'],
      gate: 'platform',
    });
    expect(accountSettings?.icon?.type).toBe(CircleUserIcon);
    expect(accountSettings?.scope).toBeUndefined();
    expect(accountSettings?.breadcrumb).toBeUndefined();

    const support = rootChildren.find((node) => node.id === 'support');
    expect(support).toMatchObject({
      id: 'support',
      title: 'Support',
      kind: 'page',
      path: '/support',
      scope: 'external',
      keywords: ['support', 'help', 'contact'],
      gate: 'platform',
    });
    expect(support?.icon?.type).toBe(CircleHelpIcon);
    expect(support?.breadcrumb).toBeUndefined();
  });

  it('stamps breadcrumb trails from navigable ancestors only', () => {
    const byId = new Map(allNodes.map((node) => [node.id, node]));

    expect(byId.get('project-graphql-metadata')?.breadcrumb).toEqual([
      'GraphQL',
    ]);
    expect(byId.get('project-graphql-settings')?.breadcrumb).toEqual([
      'GraphQL',
    ]);
    expect(byId.get('project-auth-settings')?.breadcrumb).toEqual(['Auth']);
    expect(byId.get('project-storage-settings')?.breadcrumb).toEqual([
      'Storage',
    ]);
    expect(byId.get('project-functions-settings')?.breadcrumb).toEqual([
      'Functions',
    ]);
    expect(byId.get('project-database-settings')?.breadcrumb).toEqual([
      'Database',
    ]);
    expect(byId.get('project-database-browser')?.breadcrumb).toEqual([
      'Database',
    ]);
    // Structural groups have no path, so top-level pages carry no trail.
    expect(byId.get('project-graphql')?.breadcrumb).toBeUndefined();
    expect(byId.get('org-settings')?.breadcrumb).toBeUndefined();
    expect(byId.get('docs')?.breadcrumb).toBeUndefined();
  });

  it('routes GraphQL settings through the GraphQL section', () => {
    const byId = new Map(allNodes.map((node) => [node.id, node]));

    expect(byId.get('project-graphql-settings')).toMatchObject({
      title: 'Settings',
      path: 'graphql/settings',
      gate: 'settings',
      keywords: expect.arrayContaining(['graphql', 'settings', 'engine']),
    });
    expect(byId.has('project-settings-hasura')).toBe(false);
  });

  it('routes Auth settings through the Auth section', () => {
    const byId = new Map(allNodes.map((node) => [node.id, node]));

    expect(byId.get('project-auth-settings')).toMatchObject({
      title: 'Settings',
      path: 'auth/settings',
      gate: 'settings',
      keywords: expect.arrayContaining(['auth', 'settings', 'jwt']),
    });
    expect(byId.has('project-settings-authentication')).toBe(false);
    expect(byId.has('project-settings-jwt')).toBe(false);
    expect(byId.has('project-settings-sign-in-methods')).toBe(false);
    expect(byId.has('project-settings-oauth2-provider')).toBe(false);
    expect(byId.has('project-settings-roles-and-permissions')).toBe(false);
    expect(byId.has('project-settings-smtp')).toBe(false);
  });

  it('routes Functions settings through the Functions section', () => {
    const byId = new Map(allNodes.map((node) => [node.id, node]));

    expect(byId.get('project-functions-settings')).toMatchObject({
      title: 'Settings',
      path: 'functions/settings',
      gate: 'settings',
      keywords: expect.arrayContaining(['functions', 'settings']),
    });
  });

  it('routes Storage settings through the Storage section', () => {
    const byId = new Map(allNodes.map((node) => [node.id, node]));

    expect(byId.get('project-storage-settings')).toMatchObject({
      title: 'Settings',
      path: 'storage/settings',
      gate: 'settings',
      keywords: expect.arrayContaining(['storage', 'settings']),
    });
    expect(byId.has('project-settings-storage')).toBe(false);
  });

  it('routes migrated project-wide settings through General Settings', () => {
    const byId = new Map(allNodes.map((node) => [node.id, node]));
    const generalSettings = byId.get('project-settings-general');

    expect(generalSettings).toMatchObject({
      title: 'General Settings',
      path: 'settings',
      keywords: expect.arrayContaining([
        'environment variables',
        'system environment variables',
        'secrets',
        'configuration editor',
      ]),
    });
    expect(byId.has('project-settings-environment-variables')).toBe(false);
    expect(byId.has('project-settings-secrets')).toBe(false);
    expect(byId.has('project-settings-configuration-editor')).toBe(false);
  });

  it('gates every org page off-platform', () => {
    const orgNodes = allNodes.filter((node) => node.kind === 'org');

    expect(orgNodes.length).toBeGreaterThan(0);
    expect(orgNodes.every((node) => node.gate === 'platform')).toBe(true);
  });
});
