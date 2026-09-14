import {
  getProjectUrl,
  getSettingsPageRoute,
  isHiddenFromPalette,
  orgPages,
  projectAIPages,
  projectDatabasePages,
  projectDeploymentsPages,
  projectFunctionsPages,
  projectGraphQLPages,
  projectMetricsPages,
  projectPages,
  projectRunPages,
  projectStoragePages,
  projectSubPagesBySlug,
} from '@/features/command-palette/catalog';

describe('command palette catalog', () => {
  it('keeps organization pages in sidebar order', () => {
    expect(orgPages.map((page) => page.slug)).toEqual([
      'projects',
      'settings',
      'members',
      'billing',
    ]);
  });

  it('keeps project pages in command palette order', () => {
    expect(projectPages.map((page) => page.slug)).toEqual([
      'overview',
      'database',
      'graphql',
      'events',
      'auth',
      'storage',
      'ai',
      'functions',
      'run',
      'deployments',
      'logs',
      'metrics',
      'settings',
    ]);
  });

  it('resolves project URLs and settings routes', () => {
    expect(getProjectUrl('nhost', 'dashboard')).toBe(
      '/orgs/nhost/projects/dashboard',
    );
    expect(getSettingsPageRoute({ route: '' })).toBe('settings');
  });

  it('gates platform and settings pages', () => {
    expect(
      isHiddenFromPalette('platform', {
        isNotPlatform: true,
        shouldDisableSettings: false,
      }),
    ).toBe(true);
    expect(
      isHiddenFromPalette('settings', {
        isNotPlatform: false,
        shouldDisableSettings: true,
      }),
    ).toBe(true);
    expect(
      isHiddenFromPalette(undefined, {
        isNotPlatform: true,
        shouldDisableSettings: true,
      }),
    ).toBe(false);
  });

  it('keeps database sub-pages in route-tab order', () => {
    expect(projectDatabasePages.map((page) => page.slug)).toEqual([
      'browser',
      'schema',
      'native-queries',
      'sql-console',
      'backups',
      'settings',
    ]);
  });

  it('links SQL Console to its own route outside the browser', () => {
    expect(
      projectDatabasePages.find((page) => page.slug === 'sql-console')?.route,
    ).toBe('database/console/default');
  });

  it('keeps Metrics sub-pages in route-tab order', () => {
    expect(projectMetricsPages.map((page) => page.slug)).toEqual([
      'metrics',
      'settings',
    ]);
  });

  it('keeps Deployments sub-pages in route-tab order', () => {
    expect(projectDeploymentsPages.map((page) => page.slug)).toEqual([
      'deployments',
      'settings',
    ]);
  });

  it('keeps Run sub-pages in route-tab order', () => {
    expect(projectRunPages.map((page) => page.slug)).toEqual([
      'services',
      'settings',
    ]);
  });

  it('keeps Functions sub-pages in route-tab order', () => {
    expect(projectFunctionsPages.map((page) => page.slug)).toEqual([
      'functions',
      'settings',
    ]);
  });

  it('keeps Storage sub-pages in route-tab order', () => {
    expect(projectStoragePages.map((page) => page.slug)).toEqual([
      'storage',
      'settings',
    ]);
  });

  it('keeps AI sub-pages in route-tab order', () => {
    expect(projectAIPages.map((page) => page.slug)).toEqual([
      'assistants',
      'file-stores',
      'auto-embeddings',
      'settings',
    ]);
  });

  it('keeps GraphQL sub-pages in route-tab order', () => {
    expect(projectGraphQLPages.map((page) => page.slug)).toEqual([
      'playground',
      'remote-schemas',
      'actions',
      'metadata',
      'console',
      'settings',
    ]);
  });

  it('exposes project sub-page families used by command palette', () => {
    expect(Object.keys(projectSubPagesBySlug)).toEqual([
      'database',
      'graphql',
      'events',
      'auth',
      'storage',
      'functions',
      'run',
      'deployments',
      'metrics',
      'ai',
    ]);
  });
});
