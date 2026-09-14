import { useRouter } from 'next/router';
import { vi } from 'vitest';
import DashboardNavigation from '@/components/layout/DashboardNavigation/DashboardNavigation';
import { mockRouter } from '@/tests/mocks';
import { render, screen } from '@/tests/testUtils';

vi.mock('next/router', () => ({
  useRouter: vi.fn(),
}));

const useRouterMock = vi.mocked(useRouter);

const mockRoute = (
  pathname: string,
  asPath: string,
  query: Record<string, string> = {},
) => {
  useRouterMock.mockReturnValue({
    ...mockRouter,
    pathname,
    route: pathname,
    asPath,
    query,
  });
};

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
  vi.stubEnv('NEXT_PUBLIC_NHOST_CONFIGSERVER_URL', 'https://config.local');
  window.localStorage.removeItem('dashboard-sidebar-collapsed');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  window.localStorage.removeItem('dashboard-sidebar-collapsed');
});

describe('DashboardNavigation', () => {
  describe('organization routes', () => {
    it('renders organization links from the current org slug', () => {
      mockRoute('/orgs/[orgSlug]/projects', '/orgs/nhost/projects', {
        orgSlug: 'nhost',
      });

      render(<DashboardNavigation />);

      expect(
        screen.getByRole('navigation', { name: 'Organization navigation' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute(
        'href',
        '/orgs/nhost/projects',
      );
      expect(screen.getByRole('link', { name: 'General' })).toHaveAttribute(
        'href',
        '/orgs/nhost/settings',
      );
      expect(screen.getByRole('link', { name: 'Members' })).toHaveAttribute(
        'href',
        '/orgs/nhost/members',
      );
      expect(screen.getByRole('link', { name: 'Billing' })).toHaveAttribute(
        'href',
        '/orgs/nhost/billing',
      );
    });

    it('marks the active organization route', () => {
      mockRoute(
        '/orgs/[orgSlug]/settings',
        '/orgs/nhost/settings?tab=general',
        { orgSlug: 'nhost' },
      );

      render(<DashboardNavigation />);

      expect(screen.getByRole('link', { name: 'General' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(
        screen.getByRole('link', { name: 'Projects' }),
      ).not.toHaveAttribute('aria-current');
    });

    it('keeps the organization navigation while creating a project', () => {
      mockRoute('/orgs/[orgSlug]/projects/new', '/orgs/nhost/projects/new', {
        orgSlug: 'nhost',
      });

      render(<DashboardNavigation />);

      expect(
        screen.getByRole('navigation', { name: 'Organization navigation' }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Overview' })).toBeNull();
      expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });

    it('falls back to the path while router query params are not ready', () => {
      mockRoute('/orgs/[orgSlug]/projects/new', '/orgs/nhost/projects/new');

      render(<DashboardNavigation />);

      expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute(
        'href',
        '/orgs/nhost/projects',
      );
    });
  });

  describe('project routes', () => {
    const projectQuery = { orgSlug: 'nhost', appSubdomain: 'dashboard' };

    it('renders project links from the current project route', () => {
      mockRoute(
        '/orgs/[orgSlug]/projects/[appSubdomain]',
        '/orgs/nhost/projects/dashboard',
        projectQuery,
      );

      render(<DashboardNavigation />);

      expect(
        screen.getByRole('navigation', { name: 'Project navigation' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute(
        'href',
        '/orgs/nhost/projects/dashboard',
      );
      expect(screen.getByRole('link', { name: 'AI' })).toHaveAttribute(
        'href',
        '/orgs/nhost/projects/dashboard/ai/assistants',
      );
      expect(screen.queryByRole('link', { name: 'Agents' })).toBeNull();
      expect(screen.getByRole('link', { name: 'Database' })).toHaveAttribute(
        'href',
        '/orgs/nhost/projects/dashboard/database/browser/default',
      );
      expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
        'href',
        '/orgs/nhost/projects/dashboard/settings',
      );
    });

    it('marks active project routes', () => {
      mockRoute(
        '/orgs/[orgSlug]/projects/[appSubdomain]/graphql/actions/custom-types',
        '/orgs/nhost/projects/dashboard/graphql/actions/custom-types',
        projectQuery,
      );

      render(<DashboardNavigation />);

      expect(screen.getByRole('link', { name: 'GraphQL' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(
        screen.getByRole('link', { name: 'Overview' }),
      ).not.toHaveAttribute('aria-current');
    });

    it('marks items whose link points deeper than the routes they own', () => {
      mockRoute(
        '/orgs/[orgSlug]/projects/[appSubdomain]/database/schema/[dataSourceSlug]',
        '/orgs/nhost/projects/dashboard/database/schema/default',
        projectQuery,
      );

      render(<DashboardNavigation />);

      expect(screen.getByRole('link', { name: 'Database' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });

    it('keeps Storage active on its settings page', () => {
      mockRoute(
        '/orgs/[orgSlug]/projects/[appSubdomain]/storage/settings',
        '/orgs/nhost/projects/dashboard/storage/settings',
        projectQuery,
      );

      render(<DashboardNavigation />);

      expect(screen.getByRole('link', { name: 'Storage' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });

    it('keeps Functions active on its settings page', () => {
      mockRoute(
        '/orgs/[orgSlug]/projects/[appSubdomain]/functions/settings',
        '/orgs/nhost/projects/dashboard/functions/settings',
        projectQuery,
      );

      render(<DashboardNavigation />);

      expect(screen.getByRole('link', { name: 'Functions' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });

    it('keeps Run active on its settings page', () => {
      mockRoute(
        '/orgs/[orgSlug]/projects/[appSubdomain]/run/settings',
        '/orgs/nhost/projects/dashboard/run/settings?tab=rate-limiting',
        projectQuery,
      );

      render(<DashboardNavigation />);

      expect(screen.getByRole('link', { name: 'Run' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });

    it.each([
      [
        'deployments/settings',
        '/orgs/nhost/projects/dashboard/deployments/settings',
      ],
      [
        'deployments/[deploymentId]',
        '/orgs/nhost/projects/dashboard/deployments/deployment-id',
      ],
    ])('marks only Deployments active on %s', (route, asPath) => {
      mockRoute(
        `/orgs/[orgSlug]/projects/[appSubdomain]/${route}`,
        asPath,
        projectQuery,
      );

      render(<DashboardNavigation />);

      expect(screen.getAllByRole('link', { current: 'page' })).toEqual([
        screen.getByRole('link', { name: 'Deployments' }),
      ]);
      expect(
        screen.getByRole('link', { name: 'Settings' }),
      ).not.toHaveAttribute('aria-current');
    });

    it('marks only Metrics active on its settings page', () => {
      mockRoute(
        '/orgs/[orgSlug]/projects/[appSubdomain]/metrics/settings',
        '/orgs/nhost/projects/dashboard/metrics/settings',
        projectQuery,
      );

      render(<DashboardNavigation />);

      expect(screen.getAllByRole('link', { current: 'page' })).toEqual([
        screen.getByRole('link', { name: 'Metrics' }),
      ]);
      expect(
        screen.getByRole('link', { name: 'Settings' }),
      ).not.toHaveAttribute('aria-current');
    });

    it('marks only AI active on its settings page', () => {
      mockRoute(
        '/orgs/[orgSlug]/projects/[appSubdomain]/ai/settings',
        '/orgs/nhost/projects/dashboard/ai/settings',
        projectQuery,
      );

      render(<DashboardNavigation />);

      expect(screen.getAllByRole('link', { current: 'page' })).toEqual([
        screen.getByRole('link', { name: 'AI' }),
      ]);
      expect(
        screen.getByRole('link', { name: 'Settings' }),
      ).not.toHaveAttribute('aria-current');
    });

    it('falls back to the path while router query params are not ready', () => {
      mockRoute(
        '/orgs/[orgSlug]/projects/[appSubdomain]/ai/file-stores',
        '/orgs/nhost/projects/dashboard/ai/file-stores',
      );

      render(<DashboardNavigation />);

      expect(screen.getByRole('link', { name: 'AI' })).toHaveAttribute(
        'href',
        '/orgs/nhost/projects/dashboard/ai/assistants',
      );
      expect(screen.getByRole('link', { name: 'AI' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });

    it('disables gated items in self-hosted mode', () => {
      vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
      vi.stubEnv('NEXT_PUBLIC_NHOST_CONFIGSERVER_URL', '');
      mockRoute(
        '/orgs/[orgSlug]/projects/[appSubdomain]/settings',
        '/orgs/nhost/projects/dashboard/settings',
        projectQuery,
      );

      render(<DashboardNavigation />);

      expect(screen.queryByRole('link', { name: 'AI' })).toBeNull();
      expect(
        screen.getByText('AI').closest('[aria-disabled="true"]'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Deployments' })).toBeNull();
      expect(screen.queryByRole('link', { name: 'Metrics' })).toBeNull();
      expect(screen.queryByRole('link', { name: 'Settings' })).toBeNull();
      expect(screen.getByRole('link', { name: 'Logs' })).toHaveAttribute(
        'href',
        '/orgs/nhost/projects/dashboard/logs',
      );
    });

    it('links Deployments to its settings page in self-hosted mode', () => {
      vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
      mockRoute(
        '/orgs/[orgSlug]/projects/[appSubdomain]/deployments/settings',
        '/orgs/nhost/projects/dashboard/deployments/settings',
        projectQuery,
      );

      render(<DashboardNavigation />);

      const deployments = screen.getByRole('link', { name: 'Deployments' });
      expect(deployments).toHaveAttribute(
        'href',
        '/orgs/nhost/projects/dashboard/deployments/settings',
      );
      expect(deployments).toHaveAttribute('aria-current', 'page');
    });

    it('links Metrics to its settings page in self-hosted mode', () => {
      vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
      mockRoute(
        '/orgs/[orgSlug]/projects/[appSubdomain]/metrics/settings',
        '/orgs/nhost/projects/dashboard/metrics/settings',
        projectQuery,
      );

      render(<DashboardNavigation />);

      const metrics = screen.getByRole('link', { name: 'Metrics' });
      expect(metrics).toHaveAttribute(
        'href',
        '/orgs/nhost/projects/dashboard/metrics/settings',
      );
      expect(metrics).toHaveAttribute('aria-current', 'page');
    });
  });
});
