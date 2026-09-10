import { useRouter } from 'next/router';
import { vi } from 'vitest';
import AppSidebar, {
  hasAppSidebar,
} from '@/components/layout/AppSidebar/AppSidebar';
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

describe('hasAppSidebar', () => {
  it('covers every route scoped to an organization', () => {
    expect(hasAppSidebar('/orgs/[orgSlug]/projects')).toBe(true);
    expect(hasAppSidebar('/orgs/[orgSlug]/projects/new')).toBe(true);
    expect(hasAppSidebar('/orgs/[orgSlug]/projects/[appSubdomain]/logs')).toBe(
      true,
    );
  });

  it('excludes routes outside an organization', () => {
    expect(hasAppSidebar('/')).toBe(false);
    expect(hasAppSidebar('/onboarding')).toBe(false);
    expect(hasAppSidebar('/support/ticket')).toBe(false);
    expect(hasAppSidebar('/orgs/_/[...slug]')).toBe(false);
    expect(hasAppSidebar('/orgs/_/projects/_/[...slug]')).toBe(false);
  });
});

describe('AppSidebar', () => {
  describe('organization routes', () => {
    it('renders organization links from the current org slug', () => {
      mockRoute('/orgs/[orgSlug]/projects', '/orgs/nhost/projects', {
        orgSlug: 'nhost',
      });

      render(<AppSidebar />);

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

      render(<AppSidebar />);

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

      render(<AppSidebar />);

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

      render(<AppSidebar />);

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

      render(<AppSidebar />);

      expect(
        screen.getByRole('navigation', { name: 'Project navigation' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute(
        'href',
        '/orgs/nhost/projects/dashboard',
      );
      expect(screen.getByRole('link', { name: 'Agents' })).toHaveAttribute(
        'href',
        '/orgs/nhost/projects/dashboard/ai/assistants',
      );
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

      render(<AppSidebar />);

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

      render(<AppSidebar />);

      expect(screen.getByRole('link', { name: 'Database' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });

    it('falls back to the path while router query params are not ready', () => {
      mockRoute(
        '/orgs/[orgSlug]/projects/[appSubdomain]/ai/file-stores',
        '/orgs/nhost/projects/dashboard/ai/file-stores',
      );

      render(<AppSidebar />);

      expect(screen.getByRole('link', { name: 'File Stores' })).toHaveAttribute(
        'href',
        '/orgs/nhost/projects/dashboard/ai/file-stores',
      );
      expect(screen.getByRole('link', { name: 'File Stores' })).toHaveAttribute(
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

      render(<AppSidebar />);

      expect(screen.queryByRole('link', { name: 'Agents' })).toBeNull();
      expect(
        screen.getByText('Agents').closest('[aria-disabled="true"]'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Deployments' })).toBeNull();
      expect(screen.queryByRole('link', { name: 'Metrics' })).toBeNull();
      expect(screen.queryByRole('link', { name: 'Settings' })).toBeNull();
      expect(screen.getByRole('link', { name: 'Logs' })).toHaveAttribute(
        'href',
        '/orgs/nhost/projects/dashboard/logs',
      );
    });
  });
});
