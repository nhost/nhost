import {
  getProjectUrl,
  getSettingsPageRoute,
  isPageGated,
  orgPages,
  projectAuthPages,
  projectDatabasePages,
  projectDeploymentsPages,
  projectFunctionsPages,
  projectGraphQLPages,
  projectPages,
  projectRunPages,
  projectSettingsPages,
  projectStoragePages,
  projectSubPagesBySlug,
} from '@/features/navigation/nav-config';

describe('navigation nav-config', () => {
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
      'hasura',
      'auth',
      'storage',
      'functions',
      'run',
      'ai',
      'deployments',
      'logs',
      'metrics',
      'settings',
    ]);
    expect(projectPages.find((page) => page.slug === 'settings')?.name).toBe(
      'General Settings',
    );
  });

  it('keeps project settings pages focused on unmigrated legacy settings', () => {
    expect(projectSettingsPages.map((page) => page.slug)).toEqual([
      'general',
      'compute-resources',
      'ai',
      'metrics',
    ]);
  });

  it('resolves project URLs and settings routes', () => {
    expect(getProjectUrl('nhost', 'dashboard')).toBe(
      '/orgs/nhost/projects/dashboard',
    );
    expect(getSettingsPageRoute({ route: '' })).toBe('settings');
    expect(getSettingsPageRoute({ route: 'compute-resources' })).toBe(
      'settings/compute-resources',
    );
  });

  it('gates platform and settings pages', () => {
    expect(
      isPageGated('platform', {
        isNotPlatform: true,
        shouldDisableSettings: false,
      }),
    ).toBe(true);
    expect(
      isPageGated('settings', {
        isNotPlatform: false,
        shouldDisableSettings: true,
      }),
    ).toBe(true);
    expect(
      isPageGated(undefined, {
        isNotPlatform: true,
        shouldDisableSettings: true,
      }),
    ).toBe(false);
  });

  it('keeps Auth sub-pages in route-tab order', () => {
    expect(projectAuthPages.map((page) => page.slug)).toEqual([
      'users',
      'oauth2-clients',
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

  it('keeps database sub-pages in route-tab order', () => {
    expect(projectDatabasePages.map((page) => page.slug)).toEqual([
      'browser',
      'schema',
      'sql-console',
      'backups',
      'settings',
    ]);
  });

  it('keeps GraphQL sub-pages in route-tab order', () => {
    expect(projectGraphQLPages.map((page) => page.slug)).toEqual([
      'playground',
      'remote-schemas',
      'actions',
      'metadata',
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
      'ai',
    ]);
  });
});
