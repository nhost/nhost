import {
  getProjectUrl,
  getSettingsPageRoute,
  isPageGated,
  orgPages,
  projectAuthPages,
  projectDatabasePages,
  projectFunctionsPages,
  projectGraphQLPages,
  projectPages,
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
  });

  it('keeps only the settings pages that still have their own route', () => {
    expect(projectSettingsPages.map((page) => page.slug)).toEqual([
      'general',
      'deployments',
      'custom-domains',
      'rate-limiting',
      'ai',
      'metrics',
    ]);
  });

  it('resolves project URLs and settings routes', () => {
    expect(getProjectUrl('nhost', 'dashboard')).toBe(
      '/orgs/nhost/projects/dashboard',
    );
    expect(getSettingsPageRoute({ route: '' })).toBe('settings');
    expect(getSettingsPageRoute({ route: 'deployments' })).toBe(
      'settings/deployments',
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

  it('keeps database sub-pages in route-tab order', () => {
    expect(projectDatabasePages.map((page) => page.slug)).toEqual([
      'browser',
      'schema',
      'sql-console',
      'backups',
      'settings',
    ]);
  });

  it('keeps Auth sub-pages in route-tab order', () => {
    expect(projectAuthPages.map((page) => page.slug)).toEqual([
      'users',
      'oauth2-clients',
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
      'ai',
    ]);
  });
});
