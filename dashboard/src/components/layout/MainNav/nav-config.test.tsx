import type { Org } from '@/features/orgs/projects/hooks/useOrgs';
import { buildNavTreeData } from './nav-config';

const org = {
  slug: 'nhost',
  name: 'Nhost',
  plan: {
    isFree: false,
    name: 'Pro',
  },
  apps: [
    {
      name: 'Dashboard',
      subdomain: 'dashboard',
    },
  ],
} as Org;

const originalEnv = process.env;

function setRuntimeMode(isPlatform: boolean, configServerUrl = '') {
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_NHOST_PLATFORM: isPlatform ? 'true' : 'false',
    NEXT_PUBLIC_NHOST_CONFIGSERVER_URL: configServerUrl,
  };
}

describe('buildNavTreeData', () => {
  afterEach(() => {
    process.env = originalEnv;
  });

  it('preserves item ids, child order, URLs, and enabled states on platform', () => {
    setRuntimeMode(true);

    const items = buildNavTreeData(org).items;

    expect(items.root.children).toEqual([
      'nhost-projects',
      'nhost-settings',
      'nhost-members',
      'nhost-billing',
    ]);
    expect(items['nhost-projects'].children).toEqual([
      'nhost-dashboard',
      'nhost-new-project',
    ]);
    expect(items['nhost-dashboard'].children).toEqual([
      'nhost-dashboard-overview',
      'nhost-dashboard-database',
      'nhost-dashboard-graphql',
      'nhost-dashboard-events',
      'nhost-dashboard-hasura',
      'nhost-dashboard-auth',
      'nhost-dashboard-storage',
      'nhost-dashboard-functions',
      'nhost-dashboard-run',
      'nhost-dashboard-ai',
      'nhost-dashboard-deployments',
      'nhost-dashboard-backups',
      'nhost-dashboard-logs',
      'nhost-dashboard-metrics',
      'nhost-dashboard-settings',
    ]);
    expect(items['nhost-dashboard-overview'].data.targetUrl).toBe(
      '/orgs/nhost/projects/dashboard/',
    );
    expect(items['nhost-dashboard-settings-general'].data.targetUrl).toBe(
      '/orgs/nhost/projects/dashboard/settings',
    );
    expect(items['nhost-dashboard-settings'].isFolder).toBe(true);
    expect(items['nhost-dashboard-deployments'].data.disabled).toBe(false);
    expect(items['nhost-settings'].data.disabled).toBe(false);
  });

  it('preserves disabled platform-only states in self-hosted mode', () => {
    setRuntimeMode(false);

    const items = buildNavTreeData(org).items;

    expect(items['nhost-dashboard-settings'].isFolder).toBe(false);
    expect(items['nhost-dashboard-settings'].children).toBeUndefined();
    expect(items['nhost-dashboard-settings'].data.disabled).toBe(true);
    expect(items['nhost-dashboard-ai'].data.disabled).toBe(true);
    expect(items['nhost-dashboard-deployments'].data.disabled).toBe(true);
    expect(items['nhost-new-project'].data.disabled).toBe(true);
    expect(items['nhost-settings'].data.disabled).toBe(true);
    expect(items['nhost-members'].data.disabled).toBe(true);
    expect(items['nhost-billing'].data.disabled).toBe(true);
    expect(items['nhost-dashboard-graphql-remote-schemas'].data.targetUrl).toBe(
      '/orgs/nhost/projects/dashboard/graphql/remote-schemas',
    );
  });
});
