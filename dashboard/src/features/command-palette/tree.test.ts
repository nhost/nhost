import { CircleHelpIcon, CircleUserIcon } from 'lucide-react';

import { flattenTree } from '@/features/command-palette/lib/flatten';
import { commandPaletteTree } from '@/features/command-palette/tree';

const allNodes = flattenTree(commandPaletteTree);

describe('commandPaletteTree', () => {
  it('uses globally unique ids', () => {
    const ids = allNodes.map((node) => node.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('orders and configures platform root utility commands', () => {
    const rootChildren = commandPaletteTree.children ?? [];

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
    expect(byId.get('project-run-settings')?.breadcrumb).toEqual(['Run']);
    expect(byId.get('project-deployments-settings')?.breadcrumb).toEqual([
      'Deployments',
    ]);
    expect(byId.get('project-metrics-settings')?.breadcrumb).toEqual([
      'Metrics',
    ]);
    expect(byId.get('project-ai-settings')?.breadcrumb).toEqual(['AI']);
    expect(byId.get('project-ai-assistants')?.breadcrumb).toEqual(['AI']);
    expect(byId.get('project-database-settings')?.breadcrumb).toEqual([
      'Database',
    ]);
    expect(byId.get('project-database-browser')?.breadcrumb).toEqual([
      'Database',
    ]);
    expect(
      byId.get('project-database-settings-point-in-time')?.breadcrumb,
    ).toEqual(['Database', 'Settings']);
    // Structural groups have no path, so top-level pages carry no trail.
    expect(byId.get('project-graphql')?.breadcrumb).toBeUndefined();
    expect(byId.get('org-settings')?.breadcrumb).toBeUndefined();
    expect(byId.get('docs')?.breadcrumb).toBeUndefined();
  });

  it('lists the Database settings tabs under Database settings', () => {
    const byId = new Map(allNodes.map((node) => [node.id, node]));

    expect(byId.get('project-database-settings')).toMatchObject({
      title: 'Settings',
      path: 'database/settings',
      keywords: expect.arrayContaining(['database', 'settings']),
    });
    expect(byId.get('project-database-settings-version')).toMatchObject({
      title: 'Database Postgres Version',
      path: 'database/settings?tab=version',
      keywords: expect.arrayContaining(['postgres', 'version']),
    });
    expect(byId.get('project-database-settings-point-in-time')).toMatchObject({
      title: 'Database Point-in-Time Recovery',
      path: 'database/settings?tab=point-in-time',
      gate: 'platform',
    });
    expect(byId.get('project-database-settings-access')).toMatchObject({
      title: 'Database Access',
      path: 'database/settings?tab=access',
      gate: 'platform',
      keywords: expect.arrayContaining(['allowed cidrs']),
    });
  });

  it('routes GraphQL settings through the GraphQL section', () => {
    const byId = new Map(allNodes.map((node) => [node.id, node]));

    expect(byId.get('project-graphql-settings')).toMatchObject({
      title: 'Settings',
      path: 'graphql/settings',
      gate: 'settings',
      keywords: expect.arrayContaining(['graphql', 'settings']),
    });
    expect(byId.has('project-settings-hasura')).toBe(false);
    expect(byId.has('project-hasura')).toBe(false);
    expect(byId.get('project-graphql-console')).toMatchObject({
      title: 'Console',
      path: 'graphql/console',
      keywords: expect.arrayContaining(['hasura']),
    });
    expect(byId.get('project-graphql-settings-engine')).toMatchObject({
      title: 'GraphQL Engine',
      path: 'graphql/settings?tab=engine',
    });
    expect(byId.get('project-graphql-settings-custom-domain')).toMatchObject({
      title: 'GraphQL Custom Domain',
      path: 'graphql/settings?tab=custom-domain',
      gate: 'platform',
    });
  });

  it('routes Auth settings through the Auth area', () => {
    const byId = new Map(allNodes.map((node) => [node.id, node]));

    expect(byId.get('project-auth-settings')).toMatchObject({
      title: 'Settings',
      path: 'auth/settings',
      gate: 'settings',
      keywords: expect.arrayContaining(['auth', 'settings']),
    });
    expect(byId.has('project-settings-authentication')).toBe(false);
    expect(byId.has('project-settings-jwt')).toBe(false);
    expect(byId.has('project-settings-sign-in-methods')).toBe(false);
    expect(byId.has('project-settings-oauth2-provider')).toBe(false);
    expect(byId.has('project-settings-roles-and-permissions')).toBe(false);
    expect(byId.has('project-settings-smtp')).toBe(false);
    expect(byId.get('project-auth-settings-jwt')).toMatchObject({
      title: 'Auth JWT',
      path: 'auth/settings?tab=jwt',
    });
    expect(byId.get('project-auth-settings-smtp')).toMatchObject({
      title: 'Auth SMTP',
      path: 'auth/settings?tab=smtp',
    });
    expect(byId.get('project-auth-settings-custom-domain')).toMatchObject({
      title: 'Auth Custom Domain',
      path: 'auth/settings?tab=custom-domain',
      gate: 'platform',
    });
  });

  it('routes AI settings through the AI area', () => {
    const byId = new Map(allNodes.map((node) => [node.id, node]));

    expect(byId.get('project-ai-settings')).toMatchObject({
      title: 'Settings',
      path: 'ai/settings',
      gate: 'settings',
      keywords: expect.arrayContaining(['ai', 'settings']),
    });
    expect(byId.has('project-settings-ai')).toBe(false);
  });

  it('routes Metrics settings through the Metrics area', () => {
    const byId = new Map(allNodes.map((node) => [node.id, node]));

    expect(byId.get('project-metrics-settings')).toMatchObject({
      title: 'Settings',
      path: 'metrics/settings',
      gate: 'platform',
      keywords: expect.arrayContaining(['metrics', 'settings']),
    });
    expect(byId.has('project-settings-observability')).toBe(false);
  });

  it('routes Deployments settings through the Deployments area', () => {
    const byId = new Map(allNodes.map((node) => [node.id, node]));

    expect(byId.get('project-deployments-settings')).toMatchObject({
      title: 'Settings',
      path: 'deployments/settings',
      gate: 'platform',
      keywords: expect.arrayContaining(['deployments', 'settings']),
    });
    expect(byId.has('project-settings-deployments')).toBe(false);
  });

  it('routes Run settings through the Run area', () => {
    const byId = new Map(allNodes.map((node) => [node.id, node]));

    expect(byId.get('project-run-settings')).toMatchObject({
      title: 'Settings',
      path: 'run/settings',
      gate: 'settings',
      keywords: expect.arrayContaining(['run', 'settings']),
    });
    expect(byId.has('project-settings-rate-limiting')).toBe(false);
    expect(byId.has('project-settings-custom-domains')).toBe(false);
    expect(byId.get('project-run-settings-custom-domain')).toMatchObject({
      title: 'Run Custom Domain',
      path: 'run/settings?tab=custom-domain',
      gate: 'platform',
    });
    expect(byId.get('project-run-settings-rate-limiting')).toMatchObject({
      title: 'Run Rate Limiting',
      path: 'run/settings?tab=rate-limiting',
    });
  });

  it('routes Functions settings through the Functions area', () => {
    const byId = new Map(allNodes.map((node) => [node.id, node]));

    expect(byId.get('project-functions-settings')).toMatchObject({
      title: 'Settings',
      path: 'functions/settings',
      gate: 'settings',
      keywords: expect.arrayContaining(['functions', 'settings']),
    });
    expect(byId.get('project-functions-settings-custom-domain')).toMatchObject({
      title: 'Functions Custom Domain',
      path: 'functions/settings?tab=custom-domain',
      gate: 'platform',
    });
    expect(byId.get('project-functions-settings-rate-limiting')).toMatchObject({
      title: 'Functions Rate Limiting',
      path: 'functions/settings?tab=rate-limiting',
    });
  });

  it('routes Storage settings through the Storage area', () => {
    const byId = new Map(allNodes.map((node) => [node.id, node]));

    expect(byId.get('project-storage-settings')).toMatchObject({
      title: 'Settings',
      path: 'storage/settings',
      gate: 'settings',
      keywords: expect.arrayContaining(['storage', 'settings']),
    });
    expect(byId.has('project-settings-storage')).toBe(false);
    expect(byId.get('project-storage-settings-storage')).toMatchObject({
      title: 'Storage General Settings',
      path: 'storage/settings?tab=storage',
    });
    expect(byId.get('project-storage-settings-rate-limiting')).toMatchObject({
      title: 'Storage Rate Limiting',
      path: 'storage/settings?tab=rate-limiting',
    });
  });

  it('lists the project settings tabs next to Project Settings', () => {
    const byId = new Map(allNodes.map((node) => [node.id, node]));

    expect(byId.get('project-settings-general')).toMatchObject({
      title: 'Project Settings',
      path: 'settings',
      keywords: expect.arrayContaining(['project name', 'pause project']),
    });
    expect(byId.get('project-settings-compute-resources')).toMatchObject({
      title: 'Compute Resources',
      path: 'settings?tab=compute-resources',
      keywords: expect.arrayContaining(['cpu']),
    });
    expect(byId.get('project-settings-environment-variables')).toMatchObject({
      title: 'Environment Variables',
      path: 'settings?tab=environment-variables',
    });
    expect(byId.get('project-settings-secrets')).toMatchObject({
      title: 'Secrets',
      path: 'settings?tab=secrets',
    });
    expect(byId.get('project-settings-editor')).toMatchObject({
      title: 'Configuration Editor',
      path: 'settings?tab=editor',
      keywords: expect.arrayContaining(['toml']),
    });
  });

  it('gates every org page off-platform', () => {
    const orgNodes = allNodes.filter((node) => node.kind === 'org');

    expect(orgNodes.length).toBeGreaterThan(0);
    expect(orgNodes.every((node) => node.gate === 'platform')).toBe(true);
  });
});
